-- =====================================================================
-- 한여름 86: 새 수수료(등급제) 바로 시행 — 기사님 개별 동의 방식 (여러 번 실행해도 괜찮아요)
--  ※ 85번 SQL을 먼저 실행한 뒤에 실행하세요.
--  · 새 수수료에 '동의'한 기사님은 동의한 순간부터 새 수수료(3,500원 + 최종 금액 × 등급 %)
--  · 오늘 이후 새로 가입하는 기사님은 가입하자마자 새 수수료
--  · 동의하지 않은 기존 기사님은 새 견적을 낼 수 없고, 이미 낸 견적은 11월 21일 전까지 예전 수수료
--  · 중고장터 사고팔기(매입·재고 판매·개인 간)는 모든 회원 0원 (바로 적용)
-- Supabase → SQL Editor → 전부 붙여 넣고 Run
-- =====================================================================

alter table public.pros add column if not exists fee_v2_at timestamptz;   -- 기존 기사님은 비어 있음(미동의)
alter table public.pros alter column fee_v2_at set default now();          -- 새로 가입하는 기사님은 자동 적용
grant select (fee_v2_at) on public.pros to authenticated;

-- 이 기사님에게 새 수수료를 적용할지
create or replace function private.hy_v2_for(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select now() >= private.hy_v2_from() or exists (select 1 from pros where id = p and fee_v2_at is not null);
$$;

-- 기사님 동의
create or replace function public.agree_fee_v2() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요.'; end if;
  update pros set fee_v2_at = coalesce(fee_v2_at, now()) where id = auth.uid() returning fee_v2_at into t;
  if t is null then raise exception '기사 회원만 동의할 수 있어요.'; end if;
  return t;
end $$;
revoke all on function public.agree_fee_v2() from public, anon;
grant execute on function public.agree_fee_v2() to authenticated;

-- 회원이 직접 동의 시각을 바꾸지 못하게
create or replace function private.hy_guard_grade() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.grade := old.grade; new.grade_override := old.grade_override; new.done_count := old.done_count; new.fee_v2_at := old.fee_v2_at;
  end if;
  return new;
end $$;

-- 미동의 기사님은 새 견적 제출 불가
create or replace function private.hy_quote_needs_v2() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 기사님이 직접 내는 견적만 검사 (고객의 1:1 직접 계약은 통과)
  if auth.uid() is not null and coalesce(new.pro_id, auth.uid()) = auth.uid() and not private.hy_v2_for(auth.uid()) then
    raise exception '새 수수료(기사 등급제)에 동의해야 견적을 낼 수 있어요. 기사 대시보드에서 동의해 주세요.';
  end if;
  return new;
end $$;
drop trigger if exists hy_quote_needs_v2 on public.quotes;
create trigger hy_quote_needs_v2 before insert on public.quotes for each row execute function private.hy_quote_needs_v2();

-- 견적 수락: 날짜 대신 '이 기사님 적용 여부'로 판단
create or replace function public.accept_quote(p_quote bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare q quotes; r requests; f int; bal int; cid bigint; v2 boolean; g text; pct numeric; lbl text; mine boolean;
begin
  select * into q from quotes where id = p_quote for update;
  select * into r from requests where id = q.request_id for update;
  if r.customer_id is distinct from auth.uid() then raise exception '내 견적 요청이 아니에요.'; end if;
  if r.status <> 'open' or q.status <> 'submitted' then raise exception '이미 마감된 견적이에요.'; end if;
  v2 := private.hy_v2_for(q.pro_id);
  mine := exists (select 1 from referrals x where x.customer_id = r.customer_id and x.pro_id = q.pro_id);
  if v2 then
    g := private.hy_recalc_grade(q.pro_id); pct := private.hy_grade_pct(g);
    f := 3500 + round(coalesce(q.price, 0) * pct / 100.0)::int;
    lbl := '3,500원 + 최종 금액의 ' || pct::text || '% (' || private.hy_grade_name(g) || ')';
  else
    f := calc_fee(r.service, q.price); lbl := fee_label(r.service);
  end if;
  select balance into bal from pros where id = q.pro_id;
  if f > coalesce(bal, 0) and not (v2 and mine) then
    update pros set low = true where id = q.pro_id;
    return jsonb_build_object('ok', false, 'reason', 'PRO_LOW_BALANCE');
  end if;
  insert into contracts (kind, request_id, quote_id, provider_id, client_id, provider_name, client_name, fee_payer, service, gu, work_date, price, fee, fee_label, fee_ver, base_fee, fee_pct)
  values ('service', r.id, q.id, q.pro_id, r.customer_id, private.name_of(q.pro_id, true), private.name_of(r.customer_id, false), q.pro_id,
          r.service, r.gu, q.visit, q.price, f, lbl, case when v2 then 2 else 1 end, case when v2 then 3500 end, pct)
  returning id into cid;
  update quotes set status = case when id = q.id then 'selected' else 'rejected' end where request_id = r.id;
  update requests set status = 'matched' where id = r.id;
  perform private.make_thread(cid);
  return jsonb_build_object('ok', true, 'contract_id', cid);
end $function$;

create or replace function public.accept_offer(p_offer bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
-- 중고장터 거래(매입·재고 판매·개인 간)는 모두 수수료 0원
declare o offers; l listings; k text; cid bigint;
begin
  select * into o from offers where id = p_offer for update;
  select * into l from listings where id = o.listing_id for update;
  if l.seller_id is distinct from auth.uid() then raise exception '내 판매글이 아니에요.'; end if;
  if l.status <> 'open' or o.status <> 'submitted' then raise exception '이미 마감된 판매글이에요.'; end if;
  k := case when l.kind = 'stock' then 'stock' when o.buyer_kind = 'pro' then 'sale' else 'c2c' end;
  insert into contracts (kind, listing_id, offer_id, provider_id, client_id, provider_name, client_name, fee_payer, service, title, gu, work_date, price, fee, fee_label)
  values (k, l.id, o.id, l.seller_id, o.buyer_id, private.name_of(l.seller_id, l.kind = 'stock'), o.buyer_name, null,
          case when k = 'stock' then 'freezer_stock' else 'freezer_sale' end, l.title, l.gu, o.pickup, o.price, 0, '수수료 없음 (중고장터)')
  returning id into cid;
  update offers set status = case when id = o.id then 'selected' else 'rejected' end where listing_id = l.id;
  update listings set status = 'sold' where id = l.id;
  perform private.make_thread(cid);
  return jsonb_build_object('ok', true, 'contract_id', cid);
end $function$;

-- 이미 성사됐지만 아직 확정 전인 중고장터 재고 거래도 0원으로
update public.contracts set fee = 0, fee_label = '수수료 없음 (중고장터)', fee_payer = null
 where kind in ('stock', 'sale', 'c2c') and not coalesce(fee_charged, false) and coalesce(fee, 0) > 0;

-- 확인용: 동의한 기사님 수 (처음엔 0명이 정상)
select '새 수수료 동의 방식 설치 완료' as 결과,
       count(*) filter (where fee_v2_at is not null) as 동의한_기사님, count(*) as 전체_기사님
  from public.pros;
