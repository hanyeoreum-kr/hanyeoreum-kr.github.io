-- =====================================================================
-- 한여름 85: 기사 등급제 + 수수료 개편 (여러 번 실행해도 괜찮아요)
--  · 등급: 🐣 새싹(10%) / 🦅 우수(7%, 완료 10건+ · 평점 4.5↑) / 👑 베스트(5%, 완료 30건+ · 평점 4.8↑)
--    (평점은 후기 3개 이상부터 반영 · 관리자가 직접 지정도 가능)
--  · 2026-11-21 00:00(한국시간) 이후 성사된 거래부터:
--      거래 확정 시 3,500원 + 최종 결제 금액 × 등급 %  (한도 없음)
--      최종 결제 금액은 고객이 확정할 때 입력 · 미입력(자동 확정)이면 견적 금액 기준
--      냉장·냉동 철거·재고 5%도 같은 방식으로 통일 · 내 손님(추천) 거래는 계속 0원
--  · 자동 확정 시간 48시간
-- Supabase → SQL Editor → 전부 붙여 넣고 Run
-- =====================================================================

-- 1) 새 칸
alter table public.pros      add column if not exists grade text not null default 'sprout';
alter table public.pros      add column if not exists grade_override text;
alter table public.pros      add column if not exists done_count int not null default 0;
alter table public.contracts add column if not exists fee_ver int not null default 1;
alter table public.contracts add column if not exists final_price int;
alter table public.contracts add column if not exists fee_pct numeric;
alter table public.contracts add column if not exists base_fee int;

grant select (grade, grade_override, done_count) on public.pros to authenticated;
grant select (fee_ver, final_price, fee_pct, base_fee) on public.contracts to authenticated;

-- 2) 설정: 새 수수료 시작일 · 자동 확정 48시간
do $$
begin
  update public.settings set value = to_jsonb('2026-11-21T00:00:00+09:00'::text) where key = 'fee_v2_from';
  if not found then insert into public.settings (key, value) values ('fee_v2_from', to_jsonb('2026-11-21T00:00:00+09:00'::text)); end if;
  update public.settings set value = to_jsonb(48) where key = 'auto_hours';
  if not found then insert into public.settings (key, value) values ('auto_hours', to_jsonb(48)); end if;
end $$;

-- 3) 도우미
create or replace function private.hy_v2_from() returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::timestamptz from settings where key = 'fee_v2_from'), '2026-11-21 00:00:00+09'::timestamptz);
$$;

create or replace function private.hy_grade_pct(g text) returns numeric
language sql immutable as $$
  select case g when 'crown' then 5::numeric when 'eagle' then 7::numeric else 10::numeric end;
$$;

create or replace function private.hy_grade_name(g text) returns text
language sql immutable as $$
  select case g when 'crown' then '👑 베스트' when 'eagle' then '🦅 우수' else '🐣 새싹' end;
$$;

create or replace function private.hy_recalc_grade(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d int; n int; av numeric; o text; g text;
begin
  select rating_count, case when coalesce(rating_count, 0) > 0 then rating_sum / rating_count end, grade_override
    into n, av, o from pros where id = p;
  if not found then return null; end if;
  select count(*) into d from contracts where provider_id = p and status = 'completed';
  n := coalesce(n, 0);
  g := coalesce(o, case when d >= 30 and n >= 3 and av >= 4.8 then 'crown'
                        when d >= 10 and n >= 3 and av >= 4.5 then 'eagle'
                        else 'sprout' end);
  update pros set grade = g, done_count = d where id = p and (grade is distinct from g or done_count is distinct from d);
  return g;
end $$;

-- 4) 회원이 직접 등급·수수료 칸을 못 바꾸게 막기
create or replace function private.hy_guard_grade() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.grade := old.grade; new.grade_override := old.grade_override; new.done_count := old.done_count;
  end if;
  return new;
end $$;
drop trigger if exists hy_guard_grade on public.pros;
create trigger hy_guard_grade before update on public.pros for each row execute function private.hy_guard_grade();

create or replace function private.hy_guard_fee_cols() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.fee_ver := old.fee_ver; new.final_price := old.final_price; new.fee_pct := old.fee_pct; new.base_fee := old.base_fee;
    new.fee := old.fee; new.fee_label := old.fee_label;
  end if;
  return new;
end $$;
drop trigger if exists hy_guard_fee_cols on public.contracts;
create trigger hy_guard_fee_cols before update on public.contracts for each row execute function private.hy_guard_fee_cols();

-- 청소 3,500원 고정 트리거는 예전 방식 거래에만 적용
create or replace function public.hy_clean_fee() returns trigger
language plpgsql as $$
begin
  if coalesce(new.fee_ver, 1) = 1 and (new.service like 'clean%' or new.service like 'home%')
     and coalesce(new.fee, -1) <> 3500 and coalesce(new.fee_charged, false) = false then
    new.fee := 3500;
  end if;
  return new;
end $$;

-- 5) 견적 수락
create or replace function public.accept_quote(p_quote bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare q quotes; r requests; f int; bal int; cid bigint; v2 boolean; g text; pct numeric; lbl text; mine boolean;
begin
  select * into q from quotes where id = p_quote for update;
  select * into r from requests where id = q.request_id for update;
  if r.customer_id is distinct from auth.uid() then raise exception '내 견적 요청이 아니에요.'; end if;
  if r.status <> 'open' or q.status <> 'submitted' then raise exception '이미 마감된 견적이에요.'; end if;
  v2 := now() >= private.hy_v2_from();
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

-- 6) 중고마켓 제안 수락 (재고 판매도 3,500원 + 등급 %로 통일 · 개인 매입/개인 간 거래는 그대로 무료)
create or replace function public.accept_offer(p_offer bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare o offers; l listings; k text; f int; payer uuid; bal int; cid bigint; v2 boolean; g text; pct numeric; lbl text;
begin
  select * into o from offers where id = p_offer for update;
  select * into l from listings where id = o.listing_id for update;
  if l.seller_id is distinct from auth.uid() then raise exception '내 판매글이 아니에요.'; end if;
  if l.status <> 'open' or o.status <> 'submitted' then raise exception '이미 마감된 판매글이에요.'; end if;
  k := case when l.kind = 'stock' then 'stock' when o.buyer_kind = 'pro' then 'sale' else 'c2c' end;
  v2 := now() >= private.hy_v2_from() and k = 'stock';
  payer := case when k = 'stock' then l.seller_id end;
  if v2 then
    g := private.hy_recalc_grade(payer); pct := private.hy_grade_pct(g);
    f := 3500 + round(coalesce(o.price, 0) * pct / 100.0)::int;
    lbl := '3,500원 + 최종 금액의 ' || pct::text || '% (' || private.hy_grade_name(g) || ')';
  else
    f := case when k = 'stock' then calc_fee('freezer_stock', o.price) else 0 end;
    lbl := case when k = 'stock' then fee_label('freezer_stock') else '수수료 없음' end;
  end if;
  if f > 0 then
    select balance into bal from pros where id = payer;
    if bal is null or f > bal then return jsonb_build_object('ok', false, 'reason', 'LOW_BALANCE', 'need', f); end if;
  end if;
  insert into contracts (kind, listing_id, offer_id, provider_id, client_id, provider_name, client_name, fee_payer, service, title, gu, work_date, price, fee, fee_label, fee_ver, base_fee, fee_pct)
  values (k, l.id, o.id, l.seller_id, o.buyer_id, private.name_of(l.seller_id, l.kind = 'stock'), o.buyer_name, payer,
          case when k = 'stock' then 'freezer_stock' else 'freezer_sale' end, l.title, l.gu, o.pickup, o.price, f, lbl,
          case when v2 then 2 else 1 end, case when v2 then 3500 end, pct)
  returning id into cid;
  update offers set status = case when id = o.id then 'selected' else 'rejected' end where listing_id = l.id;
  update listings set status = 'sold' where id = l.id;
  perform private.make_thread(cid);
  return jsonb_build_object('ok', true, 'contract_id', cid);
end $function$;

-- 7) 거래 확정 (고객은 최종 결제 금액을 함께 입력)
drop function if exists public.confirm_contract(bigint);
create or replace function public.confirm_contract(p_contract bigint, p_final int default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare c contracts;
begin
  select * into c from contracts where id = p_contract;
  if c.id is null or auth.uid() not in (c.provider_id, c.client_id) then raise exception '거래 당사자만 확정할 수 있어요.'; end if;
  if c.status = 'completed' then return; end if;
  if c.paused then raise exception '신고가 처리될 때까지 확정이 멈춰 있어요.'; end if;
  if c.fee_ver = 2 and auth.uid() = c.client_id then
    if p_final is null then raise exception '기사님께 실제로 결제한 최종 금액을 적어 주세요.'; end if;
    if p_final < 0 or p_final > 100000000 then raise exception '최종 결제 금액을 다시 확인해 주세요.'; end if;
    update contracts set final_price = p_final where id = c.id;
    perform private.sys_msg(c.id, '고객님이 최종 결제 금액을 ' || to_char(p_final, 'FM999,999,999') || '원으로 입력했어요.');
  end if;
  perform private.complete_contract(c.id, case when auth.uid() = c.client_id then '고객 확정' else '기사 확정' end);
end $function$;
revoke all on function public.confirm_contract(bigint, int) from public, anon;
grant execute on function public.confirm_contract(bigint, int) to authenticated;

-- 8) 확정 처리 (수수료 차감)
create or replace function private.complete_contract(p_id bigint, p_method text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare c contracts; nb int; g text; pct numeric; amt int; tot int; lbl text;
begin
  select * into c from contracts where id = p_id for update;
  if c.status = 'completed' then return; end if;
  if c.fee_ver = 2 and c.fee_payer is not null and not coalesce(c.fee_charged, false) then
    g := private.hy_recalc_grade(c.fee_payer); pct := private.hy_grade_pct(g);
    amt := coalesce(c.final_price, c.price, 0);
    tot := coalesce(c.base_fee, 3500) + round(amt * pct / 100.0)::int;
    lbl := '3,500원 + ' || case when c.final_price is not null then '최종 ' else '견적 ' end || to_char(amt, 'FM999,999,999') || '원의 ' || pct::text || '% (' || private.hy_grade_name(g) || ')';
    update contracts set fee = tot, fee_pct = pct, fee_label = lbl where id = c.id;
    c.fee := tot; c.fee_label := lbl;
  end if;
  if c.fee > 0 and not c.fee_charged and c.fee_payer is not null then
    update pros set balance = balance - c.fee, low = (balance - c.fee) < 3500 where id = c.fee_payer returning balance into nb;
    insert into ledger (pro_id, amount, balance_after, text)
      values (c.fee_payer, -c.fee, nb, '수수료 자동 차감 · ' || coalesce(nullif(c.title, ''), svc_name(c.service)) || ' ' || c.gu
              || case when c.fee_ver = 2 then ' · ' || c.fee_label else '' end);
    insert into income (contract_id, pro_id, amount, text) values (c.id, c.fee_payer, c.fee, coalesce(nullif(c.title, ''), svc_name(c.service)) || ' ' || c.gu);
  end if;
  update contracts set status = 'completed', done_at = now(), method = p_method, paused = false, fee_charged = true,
    warranty_no = case when kind = 'service' then 'WR-' || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD') || '-' || lpad(id::text, 6, '0') end,
    warranty_until = case when kind = 'service' then now() + interval '14 days' end
  where id = p_id;
  if c.fee_payer is not null then update pros set low = balance < 3500 where id = c.fee_payer; end if;  -- 내 손님 면제로 돌려받은 경우 반영
  if c.provider_id is not null then perform private.hy_recalc_grade(c.provider_id); end if;
  perform private.sys_msg(p_id, case when c.kind = 'service' then '거래가 확정됐어요 (' || p_method || '). 무상 A/S 전자 보증서가 발급됐어요.' else '거래가 완료됐어요 (' || p_method || ').' end);
end $function$;

-- 9) 후기 → 등급 다시 계산
create or replace function public.submit_review(p_contract bigint, p_stars integer, p_mood text, p_tags text[], p_body text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare c contracts; m text; s int;
begin
  select * into c from contracts where id = p_contract;
  if c.client_id is distinct from auth.uid() or c.kind <> 'service' then raise exception '내 거래에만 후기를 남길 수 있어요.'; end if;
  if c.status <> 'completed' then raise exception '거래가 확정된 뒤에 후기를 남길 수 있어요.'; end if;
  s := coalesce(p_stars, case p_mood when 'bad' then 1 when 'good' then 4 else 5 end);
  if s not between 1 and 5 then raise exception '별점은 1~5점이에요.'; end if;
  m := coalesce(p_mood, case when s >= 5 then 'great' when s >= 3 then 'good' else 'bad' end);
  insert into reviews (contract_id, pro_id, customer_id, mood, stars, tags, body)
  values (c.id, c.provider_id, c.client_id, m, s, coalesce(p_tags[1:3], '{}'), left(coalesce(p_body, ''), 200));
  update pros set rating_sum = rating_sum + s, rating_count = rating_count + 1 where id = c.provider_id;
  perform private.hy_recalc_grade(c.provider_id);
exception when unique_violation then raise exception '이미 후기를 남긴 거래예요.';
end $function$;

-- 10) 모두가 보는 등급 목록 · 관리자 등급 지정
create or replace function public.pros_grades_public()
returns table(id uuid, grade text, done int)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.grade, p.done_count from pros p where p.approval = 'APPROVED'
$$;
grant execute on function public.pros_grades_public() to anon, authenticated;

create or replace function public.admin_set_grade(p_pro uuid, p_grade text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare g text;
begin
  perform private.need_admin();
  if p_grade is not null and p_grade not in ('sprout', 'eagle', 'crown') then raise exception '등급을 다시 골라 주세요.'; end if;
  update pros set grade_override = p_grade where id = p_pro;
  g := private.hy_recalc_grade(p_pro);
  perform private.audit('GRADE_SET', (select name from pros where id = p_pro), null, jsonb_build_object('grade', coalesce(p_grade, 'auto'), 'now', g), null);
  return g;
end $$;
revoke all on function public.admin_set_grade(uuid, text) from public, anon;
grant execute on function public.admin_set_grade(uuid, text) to authenticated;

-- 11) 지금 있는 기사님 등급 계산
do $$ declare r record; begin
  for r in select id from public.pros loop perform private.hy_recalc_grade(r.id); end loop;
end $$;

-- 확인용: 등급별 기사님 수와 시작일이 나오면 성공
select '등급제 설치 완료' as 결과,
       (select value #>> '{}' from public.settings where key = 'fee_v2_from') as 새수수료_시작,
       (select value #>> '{}' from public.settings where key = 'auto_hours') as 자동확정_시간,
       count(*) filter (where grade = 'sprout') as 새싹, count(*) filter (where grade = 'eagle') as 우수, count(*) filter (where grade = 'crown') as 베스트
  from public.pros;
