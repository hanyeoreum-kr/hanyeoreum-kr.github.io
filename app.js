/* =====================================================================
   한여름 실서비스 화면 코드 (Supabase 연결)
   - 데이터는 모두 Supabase에 저장되고, 보안 규칙(RLS)·서버 함수가 권한을 검사해요.
   - 이 파일은 화면만 그려요. 금액·상태 변경은 서버 함수(rpc)만 할 수 있어요.
   ===================================================================== */
'use strict';
const C = window.HY_CONFIG || {};
const $ = s => document.querySelector(s);
const CONFIGURED = !!(C.SUPABASE_URL && !/YOUR-/.test(C.SUPABASE_URL) && C.SUPABASE_ANON_KEY && !/YOUR-/.test(C.SUPABASE_ANON_KEY) && window.supabase);
const sb = CONFIGURED ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

/* ---------- 상수 ---------- */
const GU = ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'];
/* 지역: 고객은 서울 + 경기 인접 도시, 기사님 활동 지역은 경기 전체, 용달 도착지는 경기 전체 + 지방 */
const GG_NEAR = ['성남시','하남시','구리시','남양주시','고양시','김포시','부천시','광명시','과천시','안양시','의정부시'];
const GG_ALL = ['수원시','성남시','고양시','용인시','부천시','안산시','안양시','남양주시','화성시','평택시','의정부시','시흥시','파주시','김포시','광명시','광주시','군포시','하남시','오산시','이천시','안성시','의왕시','양주시','구리시','포천시','여주시','동두천시','과천시','가평군','양평군','연천군'];
const FAR = '기타(지방)';
const place = g => !g ? '' : GU.includes(g) ? '서울 ' + g : GG_ALL.includes(g) ? '경기 ' + g : g;
const guOpts = (gg, sel = '', extra = []) => `<optgroup label="서울">${GU.map(g => `<option${g === sel ? ' selected' : ''}>${g}</option>`).join('')}</optgroup><optgroup label="${gg === GG_NEAR ? '경기 (서울 인접)' : '경기'}">${gg.map(g => `<option${g === sel ? ' selected' : ''}>${g}</option>`).join('')}</optgroup>${extra.map(g => `<option${g === sel ? ' selected' : ''}>${g}</option>`).join('')}`;
const SVC = { aircon_install:'에어컨 설치', aircon_repair:'에어컨 수리', aircon_clean:'에어컨 청소', aircon_check:'냉난방 점검', cold_repair:'냉장·냉동 수리', freezer_removal:'냉장·냉동고 철거', heat_repair:'보일러 수리', heat_install:'보일러 교체·설치', heat_clean:'보일러·난방배관 청소', kitchen_repair:'주방설비 수리', kitchen_clean:'후드·덕트 청소', truck:'용달·화물', freezer_sale:'중고 설비 매입·판매', freezer_stock:'중고 재고 매도' };
/* 서비스 분야 (홈 카드 · 견적 요청 · 기사 전문 분야 공통)
   용달·화물(truck)은 운송주선업 허가 전까지 보류: KINDS_OFF 에서 KINDS 로 옮기면 다시 켜져요 */
const KINDS = {
  aircon:{ name:'에어컨', title:'에어컨 수리·청소·설치', desc:'냉난방 에어컨 전문 기사님 매칭', pro:'에어컨 전문 기사님', subs:['수리', '설치', '세척', '냉난방 점검'], svcs:['aircon_repair', 'aircon_clean', 'aircon_install', 'aircon_check'], color:'bg-brand-50 text-brand', avatar:'bg-brand',
    icon:'<path d="M3 6h18v7H3z"/><path d="M6 10h12"/><path d="M7 17c0 1.5-1 2-1 3M12 17c0 1.5-1 2-1 3M17 17c0 1.5-1 2-1 3"/>' },
  cold:{ name:'냉장·냉동', title:'업소용 냉동·냉장고 수리·철거·매입', desc:'업소용 냉장고 · 제빙기 · 저온창고', pro:'업소용 냉장·냉동 전문 기사님', subs:['업소용 냉장고', '제빙기', '저온창고', '철거'], svcs:['cold_repair', 'freezer_removal', 'freezer_sale'], color:'bg-cyan-50 text-cyan-700', avatar:'bg-cyan-600',
    icon:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M5 10h14M9 6v1.5M9 13.5v3"/>' }
};
const KINDS_ON = {
  aircon:KINDS.aircon,
  heat:{ name:'보일러·난방', title:'보일러 수리·교체·청소', desc:'가스·기름 보일러 · 온수 · 난방배관', pro:'보일러·난방 전문 기사님', subs:['보일러 수리', '보일러 교체', '난방배관 청소', '온수기'], svcs:['heat_repair', 'heat_install', 'heat_clean'], color:'bg-rose-50 text-rose-600', avatar:'bg-rose-500',
    icon:'<path d="M12 2.5c1 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 .5-5.5.5-8z"/><path d="M5 21h14"/>' },
  cold:KINDS.cold,
  kitchen:{ name:'주방설비', title:'업소용 주방설비 수리·청소', desc:'식기세척기 · 후드·덕트 · 가스레인지', pro:'업소용 주방설비 전문 기사님', subs:['식기세척기', '후드·덕트 청소', '가스레인지·오븐', '기타 주방설비'], svcs:['kitchen_repair', 'kitchen_clean'], color:'bg-amber-50 text-amber-700', avatar:'bg-amber-500',
    icon:'<path d="M4 10h16v10H4z"/><path d="M4 14h16"/><path d="M8 3v4M12 3v4M16 3v4"/>' }
};
const KINDS_OFF = {
  truck:{ name:'용달·화물', title:'용달·화물 기사 바로 매칭', desc:'설비 운반 · 소형 이사 · 화물', pro:'용달·화물 기사님', subs:['설비 운반', '소형 이사', '일반 화물'], svcs:['truck'], color:'bg-orange-50 text-orange-700', avatar:'bg-orange-500',
    icon:'<path d="M2 7h11v9H2z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>' }
};
Object.keys(KINDS).forEach(k => delete KINDS[k]); Object.assign(KINDS, KINDS_ON);
const GROUPS = Object.entries(KINDS).map(([k, v]) => [v.title, v.svcs, k]);
const TONS = ['다마스', '라보', '1톤', '1.4톤', '2.5톤', '5톤 이상'];
const kindOf = code => { const c = String(code); return c.startsWith('aircon') ? 'aircon' : c.startsWith('heat') ? 'heat' : c.startsWith('kitchen') ? 'kitchen' : c === 'truck' ? 'truck' : 'cold'; };
const svgI = (d, cls = 'h-6 w-6') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const reqWhere = r => r.service === 'truck' ? `${esc(place(r.gu))} → ${esc(place(r.to_gu) || '?')}${r.ton ? ' · ' + esc(r.ton) : ''}${r.lift ? ' · 리프트' : ''}` : esc(place(r.gu));
const SPEC = Object.values(KINDS).map(k => k.name);
const CERTS = ['피복아크용접기능사','온수온돌기능사','가스기능사','에너지관리기능사','가스시설시공업 등록','공조냉동기계기능사','냉동기계산업기사','비파괴검사 검증','고압 세척 장비 보유','진공펌프·가스회수 장비 보유'];
const SL = { bad:'🙁 별로예요', good:'🙂 만족해요', great:'😄 최고예요' };
const TAGS = { bad:['약속 시간 불응','마무리가 지저분함','작업 후 문제 발생'], good:['친절하고 설명이 자세함','약속 시간 준수','깔끔한 작업'], great:['전문성과 완벽한 시공','높은 가성비','친절한 사후 안내'] };
const RWL = { requested:'접수됨', visit_scheduled:'방문 예정', resolved:'해결 완료' };
const QL = { submitted:'제출됨', selected:'선택됨', rejected:'다른 곳 선택' };
const GR = { A:['A급','거의 새것'], B:['B급','사용감 있음'], C:['C급','수리 필요'] };
const GC = { A:'bg-cool text-white', B:'bg-mist', C:'bg-sun/20 text-sun' };
const CAT = { PAYMENT:'결제/수수료', PRO_ISSUE:'기사 불친절/노쇼', AS_REINSPECT:'A/S 재점검', ETC:'기타' };
const CAT_ICON = { PAYMENT:'💳', PRO_ISSUE:'🙅', AS_REINSPECT:'🔁', ETC:'💬' };
const ISSUE = { RUDE:'불친절', NO_SHOW:'노쇼', BAD_WORK:'작업 불만', OTHER:'기타' };
const IST = { RECEIVED:'접수', IN_PROGRESS:'처리 중', ANSWERED:'답변 완료', CLOSED:'종결' };
const IST_CLS = { RECEIVED:'bg-mist text-sea', IN_PROGRESS:'bg-cool/15 text-cool', ANSWERED:'bg-sun/15 text-sun', CLOSED:'bg-sea/10 text-sea/60' };
const EMO = { '에어컨':'❄️', '수리':'🔧', '설치':'🔧', '세척':'❄️', '업소용':'🧊', '냉장':'🧊', '제빙':'🧊', '저온':'🧊', '철거':'🧊', '운반':'🚚', '이사':'🚚', '화물':'🚚' };
const SLA_START = 6 * 36e5, SLA_ANS = 24 * 36e5, FOLLOW = 7 * 864e5;

/* ---------- 작은 도구들 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const won = n => (+n || 0).toLocaleString('ko-KR') + '원';
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const T = v => new Date(v).getTime();
const fmtT = t => new Date(t).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtD = t => new Date(t).toLocaleDateString('ko-KR');
const hms = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
const code = (p, id, n = 6) => `${p}-${String(id).padStart(n, '0')}`;
const reqCode = id => code('REQ', id, 5), conCode = id => code('HY', id), inqCode = id => code('INQ', id);
const emo = f => (Object.entries(EMO).find(([k]) => String(f || '').includes(k)) || [])[1] || '🛠️';
const yn = v => v ? '있음' : '없음';
const B = { p:'rounded-xl bg-sea text-white font-bold px-4 py-2.5 text-sm hover:bg-slate-700 disabled:opacity-60', s:'rounded-xl border border-mist bg-white font-bold px-4 py-2.5 text-sm hover:bg-ice disabled:opacity-60', a:'rounded-xl bg-brand text-white font-bold px-4 py-2.5 text-sm shadow-sm shadow-brand/20 hover:bg-brand-700 disabled:opacity-60' };
const btn = (act, id, label, k = 'p', extra = '') => `<button type="button" data-act="${act}" data-id="${esc(id)}" class="${B[k]} ${extra}">${label}</button>`;
const wbtn = (act, id, label, k = 'a') => btn(act, id, label, k, 'flex-1');
const head = t => `<div class="flex items-start justify-between mb-4"><h2 class="text-2xl font-black">${t}</h2><button type="button" data-mclose aria-label="닫기" class="h-10 w-10 shrink-0 rounded-full hover:bg-ice text-2xl leading-none">&times;</button></div>`;
const card = h => `<div class="rounded-2xl border border-mist p-4 mt-3">${h}</div>`;
const empty = t => `<p class="rounded-2xl bg-ice p-6 text-center text-sea/70">${t}</p>`;
const chipCls = on => `rounded-full border-2 px-3 py-1.5 text-xs font-bold ${on ? 'border-cool bg-cool text-white' : 'border-mist hover:bg-ice'}`;
const chip = (act, id, on) => `<button type="button" data-act="${act}" data-id="${esc(id)}" aria-pressed="${on}" class="${chipCls(on)}">${esc(id)}</button>`;
const row = (k, v) => `<div class="flex justify-between gap-4 py-2 border-b border-dashed border-mist"><dt class="text-sea/60">${k}</dt><dd class="font-bold text-right">${v}</dd></div>`;
const errBox = () => `<p id="merr" role="alert" class="mt-3 text-sm font-bold text-red-600"></p>`;
const setErr = m => { const e = $('#merr'); if (e) e.textContent = m || ''; return false; };
const FREE_CHIP = '<span class="rounded-full bg-cool/15 px-2 py-0.5 text-xs font-bold text-cool">🚚 무료 출장 견적 가능</span>';
const flat = code => /^(aircon|heat|kitchen)/.test(String(code)) || ['truck', 'cold_repair'].includes(code);
const calcFee = (code, price) => ['freezer_removal', 'freezer_stock'].includes(code) ? Math.min(Math.round(price * 0.05), 100000) : flat(code) ? 3000 : 0;
const feeNote = code => ['freezer_removal', 'freezer_stock'].includes(code) ? '거래금액의 5%, 상한 10만 원' : flat(code) ? '3,000원' : '0원';
const errMsg = e => { const m = (e && (e.message || e.error_description)) || String(e || ''); if (/row-level security/i.test(m)) return '권한이 없거나 조건이 맞지 않아요.'; if (/JWT|session/i.test(m)) return '로그인이 필요해요.'; if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요.'; return m.replace(/^.*?ERROR:\s*/, ''); };

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 3200); }
let menuCur = null, chatCur = null;
function openM(html, keep) { const st = keep ? $('#mm-body').scrollTop : 0; menuCur = null; chatCur = null; openInq = null; $('#mm-body').innerHTML = html; $('#mm').classList.remove('hidden'); document.body.classList.add('overflow-hidden'); $('#mm-body').scrollTop = st; }
function closeM() { chatCur = null; menuCur = null; openInq = null; $('#mm').classList.add('hidden'); if ($('#qm').classList.contains('hidden')) document.body.classList.remove('overflow-hidden'); }
const mmOpen = () => !$('#mm').classList.contains('hidden');

/* 버튼을 누르는 동안 중복 클릭 막기 */
async function busy(el, fn) {
  if (el && el.disabled) return; if (el) el.disabled = true;
  try { return await fn(); } catch (e) { const m = errMsg(e); if ($('#merr')) setErr(m); else toast(m); } finally { if (el && document.body.contains(el)) el.disabled = false; }
}
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw error; return data; }

/* ---------- 사진: 줄여서 저장소에 올리기 ---------- */
const shrink = f => new Promise((res, rej) => {
  if (!f.type.startsWith('image/')) return rej(new Error('이미지 파일만 올릴 수 있어요.'));
  if (f.size > 15 * 1024 * 1024) return rej(new Error('15MB 이하 사진만 올릴 수 있어요.'));
  const r = new FileReader(); r.onerror = () => rej(new Error('사진을 읽지 못했어요.'));
  r.onload = () => { const img = new Image(); img.onerror = () => rej(new Error('사진을 읽지 못했어요.'));
    img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(b => b ? res(b) : rej(new Error('사진 변환에 실패했어요.')), 'image/jpeg', 0.8); };
    img.src = r.result; };
  r.readAsDataURL(f);
});
async function uploadPhoto(file) {
  const blob = await shrink(file), path = `${S.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType:'image/jpeg', upsert:false });
  if (error) throw error;
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
}
/* 사진은 4장씩 나눠 올려요 (휴대폰 데이터가 느려도 끊기지 않게) */
async function uploadAll(files, onProg) {
  const list = [...files], out = new Array(list.length); let done = 0, next = 0;
  const work = async () => { while (next < list.length) { const i = next++; out[i] = await uploadPhoto(list[i]); done++; if (onProg) onProg(done, list.length); } };
  await Promise.all(Array.from({ length:Math.min(4, list.length) }, work));
  return out;
}
const spMax = () => sellBulk ? 20 : 5;
const isPhotoUrl = u => typeof u === 'string' && /^https:\/\//.test(u);

/* =====================================================================
   상태 · 데이터 불러오기
   ===================================================================== */
const S = {
  user:null, profile:null, pro:null, admin:false, mode:'customer', view:'main', autoH:24,
  req:[], quo:[], con:[], thr:[], rew:[], lst:[], off:[], inq:[], ntf:[], led:[], chg:[], inc:[], aud:[], prosPub:[], adminPros:[], myRev:[],
  msgs:{}, inqMsgs:{}
};
const me = () => S.user && S.user.id;
const isPro = () => !!S.pro;
const approved = () => S.pro && S.pro.approval === 'APPROVED';
const proPub = id => S.prosPub.find(p => p.id === id) || (S.pro && S.pro.id === id ? S.pro : null) || S.adminPros.find(p => p.id === id);

const Q = {
  lst: () => sb.from('listings').select('*').order('id', { ascending:false }).limit(500),
  prosPub: () => sb.from('pros_public').select('*').limit(1000),
  settings: () => sb.from('settings').select('*'),
  req: () => sb.from('requests').select('*').order('id', { ascending:false }).limit(500),
  quo: () => sb.from('quotes').select('*').order('id', { ascending:false }).limit(1000),
  con: () => sb.from('contracts').select('*').order('id', { ascending:false }).limit(500),
  thr: () => sb.from('threads').select('*').order('id', { ascending:false }).limit(500),
  rew: () => sb.from('rework_claims').select('*').limit(500),
  off: () => sb.from('offers').select('*').order('id', { ascending:false }).limit(1000),
  inq: () => sb.from('inquiries').select('*').order('id', { ascending:false }).limit(500),
  ntf: () => sb.from('notifications').select('*').order('id', { ascending:false }).limit(100),
  led: () => sb.from('ledger').select('*').order('id', { ascending:false }).limit(200),
  chg: () => sb.from('charge_requests').select('*').order('id', { ascending:false }).limit(200),
  inc: () => sb.from('income').select('*').order('id', { ascending:false }).limit(500),
  aud: () => sb.from('audit_log').select('*').order('id', { ascending:false }).limit(100),
  myRev: () => sb.from('reviews').select('id, contract_id, pro_id, mood, stars, tags, body, created_at').order('id', { ascending:false }).limit(500),
  adminPros: () => sb.from('pros').select('*').order('created_at', { ascending:false }).limit(1000),
  pro: () => sb.from('pros').select('*').eq('id', me()).maybeSingle(),
  profile: () => sb.from('profiles').select('*').eq('id', me()).maybeSingle()
};
const PUBLIC = ['lst', 'prosPub', 'settings'];
const PRIVATE = ['req', 'quo', 'con', 'thr', 'rew', 'off', 'inq', 'ntf', 'myRev'];
async function load(key) {
  if (!sb) return;
  if (!PUBLIC.includes(key) && !S.user) return;
  const { data, error } = await Q[key]();
  if (error) { console.warn(key, error.message); return; }
  if (key === 'settings') { const a = (data || []).find(x => x.key === 'auto_hours'); if (a) S.autoH = +a.value || 24; return; }
  if (key === 'pro') { S.pro = data || null; return; }
  if (key === 'profile') { S.profile = data || null; return; }
  if (key === 'myRev') { S.myRev = data || []; return; }
  S[key] = data || [];
}
async function loadAll() {
  const keys = [...PUBLIC];
  if (S.user) {
    keys.push(...PRIVATE, 'pro', 'profile');
    if (S.admin) keys.push('led', 'chg', 'inc', 'aud', 'adminPros');
  }
  await Promise.all(keys.map(load));
  if (S.user && S.pro) await Promise.all([load('led'), load('chg')]);
  render(); watchNew();
}

/* 실시간: 표가 바뀌면 그 표만 다시 불러와요 (보안 규칙이 그대로 적용돼요) */
const TBL = { listings:'lst', pros:'prosPub', settings:'settings', requests:'req', quotes:'quo', contracts:'con', threads:'thr', rework_claims:'rew', offers:'off', inquiries:'inq', notifications:'ntf', ledger:'led', charge_requests:'chg' };
let rtChan = null, pendingLoads = new Set(), loadT = null;
function queueLoad(key) {
  pendingLoads.add(key); clearTimeout(loadT);
  loadT = setTimeout(async () => {
    const ks = [...pendingLoads]; pendingLoads.clear();
    if (ks.includes('prosPub') && S.user) ks.push('pro');
    if (ks.includes('prosPub') && S.admin) ks.push('adminPros');
    if (ks.includes('led') || ks.includes('chg')) { if (S.admin) ks.push('inc'); }
    await Promise.all([...new Set(ks)].map(load));
    render(); refreshOpen(ks); watchNew();
  }, 250);
}
function subscribe() {
  if (!sb) return;
  if (rtChan) sb.removeChannel(rtChan);
  rtChan = sb.channel('hy-' + (me() || 'guest') + '-' + Date.now());
  Object.keys(TBL).forEach(t => rtChan.on('postgres_changes', { event:'*', schema:'public', table:t }, () => queueLoad(TBL[t])));
  if (S.user) {
    rtChan.on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, p => onNewMessage(p.new));
    rtChan.on('postgres_changes', { event:'*', schema:'public', table:'inquiry_msgs' }, p => { const id = (p.new || p.old || {}).inquiry_id; if (id) { delete S.inqMsgs[id]; if (openInq === id) inqDetail(id, true); } });
  }
  rtChan.subscribe();
}
/* 열린 창이 있으면 새 데이터로 다시 그려요 (입력 중인 양식은 건드리지 않아요) */
function refreshOpen(ks) {
  if (!mmOpen()) return;
  if (menuCur === 'cust') return custMenu(true);
  if (menuCur === 'pro') return proMenu(true);
  if (menuCur === 'cs') return csModal(null, true);
  if (menuCur === 'wallet') return walletModal(true);
  if (menuCur === 'cmp' && cmpCur) return compare(cmpCur, true);
  if (menuCur === 'ldet' && ldetCur) return ldet(ldetCur, true);
  if (chatCur && ks.includes('con')) return chatModal(chatCur, true);
}

/* =====================================================================
   로그인 · 회원
   ===================================================================== */
async function onSession(session) {
  const prevId = me();
  S.user = session ? session.user : null;
  S.admin = false; S.pro = null; S.profile = null;
  PRIVATE.concat(['led', 'chg', 'inc', 'aud', 'adminPros']).forEach(k => S[k] = []);
  S.msgs = {}; S.inqMsgs = {};
  if (S.user) { try { S.admin = !!(await rpc('is_admin')); } catch (_) { S.admin = false; } }
  if (!S.user || (S.mode === 'pro' && !S.pro) || (S.mode === 'admin' && !S.admin)) S.mode = 'customer';
  await loadAll();
  if (S.mode === 'pro' && !S.pro) S.mode = 'customer';
  if (prevId !== me()) subscribe();
  if (S.user) rpc('run_housekeeping').then(n => { if (n) queueLoad('con'); }).catch(() => {});
  if (S.user) handleTossReturn();
  updateAuthUI(); showView(S.view === 'pros' || S.view === 'market' ? S.view : 'main');
}
function updateAuthUI() {
  const u = S.user, nm = S.profile ? S.profile.name : (u ? (u.email || '').split('@')[0] : '');
  $('#hdr-auth').textContent = u ? '로그아웃' : '로그인'; $('#hdr-auth').classList.toggle('hidden', !!u);
  $('#hdr-search').classList.toggle('hidden', S.mode !== 'customer');
  $('#hdr-user').style.display = u ? '' : 'none'; $('#hdr-user').textContent = u ? nm + '님' : '';
  const sw = $('#modesw'), on = S.mode === 'pro';
  sw.style.display = isPro() || S.admin ? 'inline-flex' : 'none'; sw.setAttribute('aria-checked', on);
  sw.className = `inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold ${on ? 'bg-brand text-white' : 'bg-mist'}`;
  sw.querySelector('i').style.left = on ? '1.125rem' : '.125rem';
  const ad = $('#hdr-admin'); ad.style.display = S.admin ? '' : 'none'; ad.textContent = S.mode === 'admin' ? '고객 화면' : '관리자';
}
function needLogin(msg) { if (S.user) return false; toast(msg || '로그인 후 이용할 수 있어요.'); authModal('login'); return true; }

let au = { tab:'login', type:'customer', v:{}, areas:new Set(), certs:new Set(), free:false, agree:false, kind:'', subs:new Set(), ton:'', lift:false };
/* 기사 전문 분야 선택 (가입 · 기사 전환 공통) */
const specHTML = (st, pfx) => `<p class="mt-4 text-sm font-bold">전문 분야 <span class="text-sun">(필수)</span></p><div class="mt-2 grid gap-2">${Object.entries(KINDS).map(([k, v]) => `<div class="rounded-2xl border ${st.kind === k ? 'border-brand bg-brand-50' : 'border-mist'} p-3.5">
  <button type="button" data-act="${pfx}kind" data-id="${k}" aria-pressed="${st.kind === k}" class="flex w-full items-center gap-3 text-left"><span class="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${st.kind === k ? 'border-brand' : 'border-slate-300'}">${st.kind === k ? '<i class="h-2.5 w-2.5 rounded-full bg-brand"></i>' : ''}</span><b class="text-sm">${v.pro}</b></button>
  ${st.kind !== k ? '' : k === 'truck' ? `<div class="mt-3 grid gap-2"><label for="${pfx}-ton" class="sr-only">차량 톤수</label><select id="${pfx}-ton" class="w-full rounded-xl border border-mist bg-white px-3 py-3 font-medium"><option value="">차량 톤수 선택</option>${TONS.map(t => `<option${st.ton === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <label class="flex items-center gap-2 text-sm font-bold"><input id="${pfx}-lift" type="checkbox" class="h-5 w-5 accent-brand"${st.lift ? ' checked' : ''}>리프트(파워게이트) 보유</label>
    <div class="flex flex-wrap gap-1.5">${v.subs.map(x => `<button type="button" data-act="${pfx}sub" data-id="${x}" aria-pressed="${st.subs.has(x)}" class="${chipCls(st.subs.has(x))}">${x}</button>`).join('')}</div></div>`
    : `<div class="mt-3 flex flex-wrap gap-1.5">${v.subs.map(x => `<button type="button" data-act="${pfx}sub" data-id="${x}" aria-pressed="${st.subs.has(x)}" class="${chipCls(st.subs.has(x))}">${x}</button>`).join('')}</div>`}</div>`).join('')}</div>`;
function specRead(st, pfx) { const t = $('#' + pfx + '-ton'), l = $('#' + pfx + '-lift'); if (t) st.ton = t.value; if (l) st.lift = l.checked; }
function specErr(st) { return !st.kind ? '전문 분야를 선택해 주세요.' : st.kind === 'truck' ? (!st.ton ? '차량 톤수를 선택해 주세요.' : '') : !st.subs.size ? '세부 분야를 1개 이상 골라 주세요.' : ''; }
function specKind(st, pfx, k) { specRead(st, pfx); st.kind = k; st.subs = new Set(); const box = $('#' + pfx + '-spec'); if (box) box.innerHTML = specHTML(st, pfx); }
function specSub(st, pfx, x, b) { st.subs.has(x) ? st.subs.delete(x) : st.subs.add(x); if (b) { b.setAttribute('aria-pressed', st.subs.has(x)); b.className = chipCls(st.subs.has(x)); } }
const specFields = st => st.subs.size ? [...st.subs] : st.kind === 'truck' ? ['설비 운반'] : [];
const PROV = { kakao:'카카오', google:'구글', naver:'네이버' };
function saveAuth() { specRead(au, 'au'); ['name', 'email', 'pw', 'pw2', 'biz'].forEach(k => { const el = $('#au-' + k); if (el) au.v[k] = el.value; }); const cs = [...document.querySelectorAll('.au-c')]; if (cs.length) au.agree = cs.every(c => c.checked); }
function authModal(tab, type) { if (!sb) return toast('사이트 설정(config.js)이 아직 끝나지 않았어요.'); if (tab) au.tab = tab; if (type) au.type = type; renderAuth(); }
const credBlock = (set, act) => `<p class="mt-4 text-sm font-bold">전문 자격증 · 장비 보유 <span class="text-xs font-normal text-sea/60">(선택)</span></p>
  <div id="${act}-chips" class="mt-2 flex flex-wrap gap-1.5">${[...CERTS, ...[...set].filter(c => !CERTS.includes(c))].map(c => chip(act, c, set.has(c))).join('')}</div>
  <div class="mt-2 flex gap-2"><input id="${act}-in" maxlength="30" aria-label="자격증·장비 직접 입력" placeholder="직접 입력 (예: 가스용접기능사)" class="min-w-0 flex-1 rounded-xl bg-ice px-4 py-3"><button type="button" data-act="${act}add" class="${B.s} shrink-0">+ 추가</button></div>
  <p class="mt-1 text-xs text-sea/60">프로필에 배지로 표시돼요. 자격증 사본은 관리자 승인 때 확인을 요청할 수 있어요.</p>`;
const freeToggle = (on, act) => `<div class="mt-4"><button type="button" data-act="${act}" aria-pressed="${on}" class="${chipCls(on)}">🚚 무료 출장 견적 가능</button></div>`;
const areaBtn = (set, act, g) => `<button type="button" data-act="${act}" data-id="${g}" aria-pressed="${set.has(g)}" class="rounded-lg px-1 py-1.5 text-xs font-bold ${set.has(g) ? 'bg-cool text-white' : 'bg-white hover:bg-mist'}">${g}</button>`;
const areaGrid = (set, act) => `<div class="mt-2 max-h-48 overflow-y-auto rounded-xl bg-ice p-2"><p class="px-1 pb-1 text-[11px] font-bold text-sub">서울</p><div class="grid grid-cols-4 gap-1.5">${GU.map(g => areaBtn(set, act, g)).join('')}</div><p class="px-1 pb-1 pt-3 text-[11px] font-bold text-sub">경기</p><div class="grid grid-cols-4 gap-1.5">${GG_ALL.map(g => areaBtn(set, act, g)).join('')}</div></div>`;
const legalLinks = () => `${C.TERMS_URL ? `<a href="${esc(C.TERMS_URL)}" target="_blank" rel="noopener" class="underline">이용약관</a>` : '이용약관'} 및 ${C.PRIVACY_URL ? `<a href="${esc(C.PRIVACY_URL)}" target="_blank" rel="noopener" class="underline">개인정보처리방침</a>` : '개인정보처리방침'}`;
function renderAuth() {
  const login = au.tab === 'login', pro = au.type === 'pro', v = k => esc(au.v[k] || ''), inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5', lab = (f, t) => `<label for="${f}" class="block mt-4 text-sm font-bold">${t}</label>`;
  const tab = (k, t) => `<button type="button" data-act="atab" data-id="${k}" aria-pressed="${au.tab === k}" class="flex-1 rounded-full py-2.5 text-sm font-bold ${au.tab === k ? 'bg-sea text-white' : 'bg-ice hover:bg-mist'}">${t}</button>`;
  const social = (C.SOCIAL || []).length ? `<div class="mt-5"><p class="text-xs font-bold text-sea/60">간편 ${login ? '로그인' : '가입'}</p><div class="mt-2 grid grid-cols-${Math.min(3, C.SOCIAL.length)} gap-2">${C.SOCIAL.map(k => `<button type="button" data-act="asocial" data-id="${k}" class="rounded-xl border-2 border-mist px-2 py-3 text-sm font-bold hover:bg-ice">${PROV[k] || k}</button>`).join('')}</div>${login ? '' : '<p class="mt-1 text-xs text-sea/60">간편 가입 후 기사로 활동하려면 “기사·업체 등록”에서 정보를 입력해 주세요.</p>'}</div><div class="my-4 flex items-center gap-3 text-xs text-sea/50"><i class="h-px flex-1 bg-mist"></i>또는 이메일로<i class="h-px flex-1 bg-mist"></i></div>` : '';
  const common = `${lab('au-email', '이메일')}<input id="au-email" type="email" autocomplete="email" value="${v('email')}" class="${inp}">
    ${lab('au-pw', login ? '비밀번호' : '비밀번호 (8자 이상, 영문+숫자)')}<input id="au-pw" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" value="${v('pw')}" class="${inp}">
    ${login ? '' : `${lab('au-pw2', '비밀번호 확인')}<input id="au-pw2" type="password" autocomplete="new-password" value="${v('pw2')}" class="${inp}">`}`;
  openM(head('로그인 / 회원가입') + `<div class="flex gap-2">${tab('login', '로그인')}${tab('signup', '회원가입')}</div>` + (login
    ? `${social}${common}${errBox()}${btn('alogin', '', '로그인', 'a', 'mt-2 w-full')}<button type="button" data-act="pwreset" class="mt-3 text-sm font-bold text-cool underline">비밀번호를 잊으셨나요?</button>`
    : `<fieldset class="mt-5"><legend class="text-sm font-bold">회원 유형</legend><div class="mt-2 grid grid-cols-2 gap-3">${[['customer', '일반 회원'], ['pro', '기사·업체 회원']].map(([k, t]) => `<button type="button" data-act="autype" data-id="${k}" aria-pressed="${au.type === k}" class="rounded-2xl border-2 px-3 py-4 text-sm font-bold ${au.type === k ? 'border-cool bg-mist' : 'border-mist hover:bg-ice'}">${t}</button>`).join('')}</div></fieldset>
      ${social}${lab('au-name', pro ? '상호명 / 기사명' : '이름 (닉네임)')}<input id="au-name" maxlength="30" value="${v('name')}" class="${inp}">
      ${pro ? `<div id="au-spec">${specHTML(au, 'au')}</div>
        ${credBlock(au.certs, 'acert')}${freeToggle(au.free, 'afree')}
        <p class="mt-4 text-sm font-bold">활동 가능 지역 <span class="text-xs font-normal text-sea/60">(1곳 이상)</span></p>${areaGrid(au.areas, 'aarea')}
        <p class="mt-4 rounded-xl bg-cool/10 p-3 text-xs leading-relaxed">📄 <b>사업자등록증</b>은 메일 인증 후 로그인하면 기사 화면에서 바로 올릴 수 있어요. 관리자가 사업자등록증을 확인하고 승인하면 견적을 낼 수 있어요.</p>` : ''}
      ${common}
      <div class="mt-4 rounded-2xl border border-mist p-3 text-sm space-y-2">
        <label class="flex items-start gap-2 font-bold"><input id="au-agree" type="checkbox" data-act="agreeall" class="mt-1 h-4 w-4"${au.agree ? ' checked' : ''}><span>아래 필수 항목에 모두 동의해요</span></label>
        <div class="border-t border-mist pt-2 space-y-1.5 text-sea/80">
          <label class="flex items-start gap-2"><input type="checkbox" class="au-c mt-1 h-4 w-4"${au.agree ? ' checked' : ''}><span>[필수] 만 14세 이상이며 ${C.TERMS_URL ? `<a href="${esc(C.TERMS_URL)}" target="_blank" rel="noopener" class="underline">이용약관</a>` : '이용약관'}에 동의</span></label>
          <label class="flex items-start gap-2"><input type="checkbox" class="au-c mt-1 h-4 w-4"${au.agree ? ' checked' : ''}><span>[필수] ${C.PRIVACY_URL ? `<a href="${esc(C.PRIVACY_URL)}" target="_blank" rel="noopener" class="underline">개인정보 수집·이용</a>` : '개인정보 수집·이용'}에 동의</span></label>
          <label class="flex items-start gap-2"><input type="checkbox" class="au-c mt-1 h-4 w-4"${au.agree ? ' checked' : ''}><span>[필수] 개인정보 제3자 제공에 동의 <details class="inline"><summary class="inline cursor-pointer text-cool">내용 보기</summary><span class="mt-1 block rounded-lg bg-ice p-2 text-xs leading-relaxed">제공받는 자: 견적 요청 시 승인된 기사 회원, 계약·장터 거래 시 거래 상대방 회원<br>목적: 견적 작성, 작업·거래 진행, 일정 조율, 14일 재점검<br>항목: 견적 요청 내용(지역·희망일·요청사항·사진), 이름(닉네임)·상호, 거래 내용, 채팅 내용 (전화번호·이메일은 제공하지 않음)<br>기간: 거래 종료(재점검 기간 포함) 시까지<br>동의를 거부할 수 있으나, 거부하면 중개 서비스를 이용할 수 없어요.</span></details></span></label>
        </div>
      </div>
      ${errBox()}${btn('asignup', '', '가입하기', 'a', 'mt-2 w-full')}`));
}
const emailOk = e => /^\S+@\S+\.\S+$/.test(e);
const pwOk = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
async function alogin(el) {
  saveAuth(); const email = (au.v.email || '').trim().toLowerCase(), pw = au.v.pw || '';
  if (!emailOk(email)) return setErr('이메일을 확인해 주세요.');
  if (!pw) return setErr('비밀번호를 입력해 주세요.');
  await busy(el, async () => {
    const { error } = await sb.auth.signInWithPassword({ email, password:pw });
    if (error) return setErr(/confirm/i.test(error.message) ? '이메일 인증이 아직 안 됐어요. 가입할 때 받은 메일의 링크를 눌러 주세요.' : /invalid/i.test(error.message) ? '이메일 또는 비밀번호가 맞지 않아요.' : errMsg(error));
    au.v = {}; closeM(); toast('로그인했어요.');
  });
}
async function asignup(el) {
  saveAuth(); const v = au.v, pro = au.type === 'pro', name = (v.name || '').trim(), email = (v.email || '').trim().toLowerCase(), pw = v.pw || '';
  const err = !name ? (pro ? '상호명 또는 기사명을 입력해 주세요.' : '이름을 입력해 주세요.') : !emailOk(email) ? '이메일 형식을 확인해 주세요.' : !pwOk(pw) ? '비밀번호는 8자 이상, 영문과 숫자를 모두 넣어 주세요.'
    : pw !== v.pw2 ? '두 비밀번호가 달라요.' : pro && specErr(au) ? specErr(au) : pro && !au.areas.size ? '활동 가능 지역을 1곳 이상 선택해 주세요.' : !au.agree ? '필수 약관 3개에 모두 동의해 주세요.' : '';
  if (err) return setErr(err);
  await busy(el, async () => {
    const data = { name, role:au.type };
    if (pro) Object.assign(data, { kind:au.kind, fields:specFields(au), ton:au.kind === 'truck' ? au.ton : null, lift:au.kind === 'truck' && au.lift, areas:[...au.areas], certs:[...au.certs], free:au.free });
    const { data:res, error } = await sb.auth.signUp({ email, password:pw, options:{ data, emailRedirectTo:C.SITE_URL || location.href.split('#')[0] } });
    if (error) return setErr(/registered|exists/i.test(error.message) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : errMsg(error));
    track('signup');
    au = { tab:'login', type:'customer', v:{ email }, areas:new Set(), certs:new Set(), free:false, agree:false, kind:'', subs:new Set(), ton:'', lift:false };
    if (res && res.session) { closeM(); toast(pro ? '가입했어요. 기사 화면에서 사업자등록증을 올려 주세요.' : '가입을 환영해요!'); return; }
    openM(head('메일함을 확인해 주세요') + `<p class="leading-relaxed"><b>${esc(email)}</b>로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.</p><p class="mt-2 text-sm text-sea/60">메일이 안 보이면 스팸함도 확인해 주세요.${pro ? ' 기사 회원은 인증 후 로그인해서 사업자등록증을 올려 주세요. 관리자 승인이 끝나면 견적을 낼 수 있어요.' : ''}</p><div class="mt-4">${btn('auth', '', '로그인 화면으로', 's')}</div>`);
  });
}
async function asocial(p) {
  await busy(null, async () => { const { error } = await sb.auth.signInWithOAuth({ provider:p, options:{ redirectTo:C.SITE_URL || location.href.split('#')[0] } }); if (error) throw error; });
}
function resetStart() {
  saveAuth();
  openM(head('비밀번호 찾기') + `<p class="text-sm leading-relaxed text-sea/80">가입한 이메일을 입력하면 비밀번호를 다시 정하는 링크를 보내드려요.</p>
    <label for="rs-email" class="block mt-4 text-sm font-bold">이메일</label><input id="rs-email" type="email" autocomplete="email" value="${esc(au.v.email || '')}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">${errBox()}
    <div class="mt-4 flex gap-3">${btn('auth', '', '로그인으로', 's')}${wbtn('rssend', '', '재설정 메일 받기')}</div>`);
}
async function resetSend(el) {
  const email = ($('#rs-email').value || '').trim().toLowerCase();
  if (!emailOk(email)) return setErr('이메일 형식을 확인해 주세요.');
  await busy(el, async () => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo:C.SITE_URL || location.href.split('#')[0] });
    if (error) throw error;
    openM(head('메일을 보냈어요') + `<p class="leading-relaxed">가입된 이메일이라면 <b>${esc(email)}</b>로 재설정 링크가 도착해요. 링크를 누르면 이 사이트에서 새 비밀번호를 정할 수 있어요.</p><div class="mt-4"><button type="button" data-mclose class="${B.s}">닫기</button></div>`);
  });
}
function newPwModal() {
  openM(head('새 비밀번호 설정') + `<p class="text-sm text-sea/80">새 비밀번호를 입력해 주세요. (8자 이상, 영문+숫자)</p>
    <label for="rs-pw" class="block mt-4 text-sm font-bold">새 비밀번호</label><input id="rs-pw" type="password" autocomplete="new-password" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
    <label for="rs-pw2" class="block mt-4 text-sm font-bold">새 비밀번호 확인</label><input id="rs-pw2" type="password" autocomplete="new-password" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">${errBox()}
    <div class="mt-4">${btn('rsconfirm', '', '비밀번호 변경', 'a', 'w-full')}</div>`);
}
async function resetConfirm(el) {
  const p1 = $('#rs-pw').value, p2 = $('#rs-pw2').value;
  if (!pwOk(p1)) return setErr('비밀번호는 8자 이상, 영문과 숫자를 모두 넣어 주세요.');
  if (p1 !== p2) return setErr('두 비밀번호가 달라요.');
  await busy(el, async () => { const { error } = await sb.auth.updateUser({ password:p1 }); if (error) throw error; closeM(); toast('비밀번호를 바꿨어요.'); });
}
async function logout() { await sb.auth.signOut(); S.mode = 'customer'; toast('로그아웃했어요.'); }

/* 사업자등록증: 비공개 보관함(docs)에 저장 · 본인과 관리자만 열람 */
const docErr = f => !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type) ? 'JPG·PNG·WEBP 사진이나 PDF만 올릴 수 있어요.' : f.size > 10 * 1024 * 1024 ? '10MB 이하 파일만 올릴 수 있어요.' : '';
async function uploadBizDoc(f) {
  const e = docErr(f); if (e) throw new Error(e);
  const ext = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${me()}/bizdoc-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('docs').upload(path, f, { contentType:f.type, upsert:false });
  if (error) throw error;
  await rpc('set_biz_doc', { p_path:path });
}
async function openBizDoc(path) {
  const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('docs').createSignedUrl(path, 300);
  if (error || !data) { if (w) w.close(); return toast('파일을 열 수 없어요. ' + errMsg(error)); }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}
const bizDocCard = p => `<div class="mt-4 rounded-2xl border-2 ${p.biz_doc ? 'border-cool/40 bg-cool/5' : 'border-sun/50 bg-sun/5'} p-5">
  <p class="font-bold">${p.biz_doc ? '📄 사업자등록증 제출 완료' : '📄 사업자등록증을 올려 주세요'}</p>
  <p class="mt-1 text-sm text-sea/70">${p.biz_doc ? `${fmtT(p.biz_doc_at)}에 제출했어요. 다른 파일로 바꾸려면 다시 올리세요.` : '관리자가 사업자등록증을 확인한 뒤 승인해요. 사진이나 PDF(10MB 이하)를 올려 주세요.'}</p>
  <div class="mt-3 flex flex-wrap items-center gap-2"><input id="bd-file" type="file" accept="image/*,application/pdf" class="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 text-sm">${btn('bdsend', '', p.biz_doc ? '다시 올리기' : '올리기', p.biz_doc ? 's' : 'a')}${p.biz_doc ? btn('bdview', '', '내 파일 보기', 's') : ''}</div></div>`;
async function bdSend(el) {
  const f = ($('#bd-file').files || [])[0]; if (!f) return toast('올릴 파일을 골라 주세요.');
  await busy(el, async () => { await uploadBizDoc(f); await load('pro'); render(); if (mmOpen() && menuCur === 'prof') profModal(); toast('사업자등록증을 올렸어요. 관리자가 확인할게요.'); });
}

/* 일반 회원 → 기사 전환 (간편 가입자 포함) */
let bp = null;
function becomeProModal() {
  if (needLogin('기사 등록은 로그인 후 할 수 있어요.')) return;
  if (isPro()) { setMode('pro'); return; }
  bp = bp || { areas:new Set(), certs:new Set(), free:false, kind:'', subs:new Set(), ton:'', lift:false };
  const inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5';
  openM(head('기사·업체로 등록') + `<p class="text-sm text-sea/70">정보를 보내면 관리자가 확인하고 승인해요. 승인되면 견적을 낼 수 있어요.</p>
    <label for="bp-name" class="block mt-4 text-sm font-bold">상호명 / 기사명</label><input id="bp-name" maxlength="30" value="${esc(S.profile ? S.profile.name : '')}" class="${inp}">
    <div id="bp-spec">${specHTML(bp, 'bp')}</div>
    ${credBlock(bp.certs, 'bcert')}${freeToggle(bp.free, 'bfree')}
    <p class="mt-4 text-sm font-bold">활동 가능 지역</p>${areaGrid(bp.areas, 'barea')}
    <label for="bp-doc" class="block mt-4 text-sm font-bold">사업자등록증 <span class="text-xs font-normal text-sea/60">(사진 또는 PDF · 10MB 이하)</span></label><input id="bp-doc" type="file" accept="image/*,application/pdf" class="${inp} text-sm">
    <p class="mt-1 text-xs text-sea/60">관리자만 볼 수 있는 비공개 보관함에 저장돼요. 사업자가 없는 개인 기사님은 나중에 고객센터로 문의해 주세요.</p>${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('bpsend', '', '등록 신청')}</div>`, true);
}
async function bpSend(el) {
  const name = $('#bp-name').value.trim(), doc = ($('#bp-doc').files || [])[0];
  if (!name) return setErr('상호명 또는 기사명을 입력해 주세요.');
  specRead(bp, 'bp'); if (specErr(bp)) return setErr(specErr(bp));
  if (!bp.areas.size) return setErr('활동 가능 지역을 1곳 이상 선택해 주세요.');
  if (doc && docErr(doc)) return setErr(docErr(doc));
  if (!doc && !S.admin) return setErr('사업자등록증을 올려 주세요.');
  await busy(el, async () => {
    await rpc('become_pro', { p_name:name, p_fields:specFields(bp), p_areas:[...bp.areas], p_certs:[...bp.certs], p_free:bp.free, p_biz:'', p_kind:bp.kind, p_ton:bp.kind === 'truck' ? bp.ton : null, p_lift:bp.kind === 'truck' && bp.lift });
    if (doc) await uploadBizDoc(doc);
    if (S.admin) await rpc('admin_set_approval', { p_pro:me(), p_approve:true });   // 관리자 본인은 바로 승인
    bp = null; await Promise.all([load('pro'), load('profile'), load('prosPub')]); closeM(); updateAuthUI();
    toast(S.admin ? '관리자 계정에 기사 모드를 켰어요.' : '기사 등록을 신청했어요. 사업자등록증을 확인하고 승인해 드릴게요.'); setMode('pro');
  });
}
function toggleIn(set, id, act) {
  set.has(id) ? set.delete(id) : set.add(id);
  document.querySelectorAll(`[data-act="${act}"][data-id="${CSS.escape(id)}"]`).forEach(b => {
    const on = set.has(id); b.setAttribute('aria-pressed', on);
    b.className = /area$/.test(act) ? `rounded-lg px-1 py-1.5 text-xs font-bold ${on ? 'bg-cool text-white' : 'bg-white hover:bg-mist'}` : chipCls(on);
    if (!on && /cert$/.test(act) && !CERTS.includes(id)) b.remove();
  });
}
function addCert(act, set) {
  const inp = $('#' + act + '-in'), v = inp.value.trim().replace(/\s+/g, ' ');
  if (!v) return toast('추가할 자격증이나 장비를 입력해 주세요.');
  if (set.has(v)) { inp.value = ''; return toast('이미 추가된 항목이에요.'); }
  set.add(v);
  const ex = document.querySelector(`[data-act="${act}"][data-id="${CSS.escape(v)}"]`);
  if (ex) { ex.setAttribute('aria-pressed', true); ex.className = chipCls(true); }
  else $('#' + act + '-chips').insertAdjacentHTML('beforeend', chip(act, v, true));
  inp.value = ''; inp.focus();
}

/* =====================================================================
   화면 전환 · 공통 렌더링
   ===================================================================== */
function setMode(m) {
  if (m === 'pro' && !isPro()) return becomeProModal();
  if (m === 'admin' && !S.admin) return;
  S.mode = m; closeM(); showView('main'); updateAuthUI(); window.scrollTo(0, 0); render();
  if (m !== 'customer') loadAll();   // 기사·관리자 화면으로 바꿀 때 최신 데이터로
}
function showView(v) {
  S.view = v; const c = S.mode === 'customer', main = c && v === 'main';
  $('#cview').classList.toggle('hidden', !main);
  $('#mview').classList.toggle('hidden', !(c && v === 'market'));
  $('#fview').classList.toggle('hidden', !(c && v === 'pros'));
  $('#pview').classList.toggle('hidden', c);
  document.querySelectorAll('.dnav').forEach(a => { a.removeAttribute('aria-current'); if (c && a.dataset.nav === v) a.setAttribute('aria-current', 'page'); });
  window.scrollTo(0, 0); tabState();
  if (S.mode === 'customer') setTimeout(() => track('view', v), 1500);
}
/* 휴대폰 하단 탭: 지금 보는 화면 표시 · 알림 숫자 */
function tabState() { document.querySelectorAll('#mbar-c [data-tab]').forEach(b => b.toggleAttribute('aria-current', S.mode === 'customer' && b.dataset.tab === S.view)); document.querySelectorAll('#mbar-c [aria-current]').forEach(b => b.setAttribute('aria-current', 'page')); }
function setBadge(el, n) { if (!el) return; let b = el.querySelector('.tbadge'); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'tbadge absolute top-1 left-1/2 ml-1.5 min-w-[18px] rounded-full bg-sun px-1 text-center text-[10px] not-italic leading-[18px] text-white'; el.append(b); } b.textContent = n > 9 ? '9+' : n; }
/* 휴대폰 전체 메뉴 (☰) */
/* 회원 탈퇴 신청 */
async function delModal() {
  if (needLogin()) return;
  let req = null; try { req = await rpc('my_deletion_status'); } catch (e) {}
  if (req) return openM(head('회원 탈퇴 신청됨') + `<p class="leading-relaxed">${esc(new Date(req).toLocaleString('ko-KR'))}에 탈퇴를 신청하셨어요. 진행 중인 거래가 없으면 <b>7일 안에</b> 처리돼요. 처리되면 이름·이메일이 지워지고 다시 로그인할 수 없어요.</p>
    <div class="mt-5 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${btn('delcancel', '', '탈퇴 신청 취소', 's')}</div>`);
  openM(head('회원 탈퇴') + `<ul class="space-y-2 rounded-2xl bg-ice p-4 text-sm leading-relaxed">
      <li>탈퇴하면 이름·이메일·프로필이 지워지고 같은 계정으로 다시 로그인할 수 없어요.</li>
      <li>진행 중인 계약·분쟁이 있으면 끝난 뒤에 처리돼요.</li>
      <li>기사 회원의 남은 예치금은 약관에 따라 환불해 드려요.</li>
      <li>계약·결제 기록은 법에 따라 정해진 기간 동안 이름 없이 보관돼요.</li></ul>
    <label for="del-why" class="mt-4 block text-sm font-bold">떠나시는 이유 (선택)</label><textarea id="del-why" rows="2" maxlength="200" class="mt-2 w-full resize-none rounded-xl bg-ice px-4 py-3"></textarea>
    <label class="mt-3 flex items-start gap-2 text-sm"><input id="del-ok" type="checkbox" class="mt-1 h-4 w-4"> 위 내용을 확인했고 탈퇴를 신청해요.</label>${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${btn('delgo', '', '탈퇴 신청', 'p')}</div>`);
}
async function delGo(el) {
  if (!$('#del-ok').checked) return setErr('확인란에 체크해 주세요.');
  await busy(el, async () => { await rpc('request_account_deletion', { p_reason:$('#del-why').value.trim() }); closeM(); toast('탈퇴를 신청했어요. 7일 안에 처리돼요.'); });
}
let DL = null, dlAt = 0;
function loadDels(force) {
  if (!S.admin || (!force && Date.now() - dlAt < 60000)) return;
  dlAt = Date.now();
  rpc('admin_list_deletions').then(d => { DL = d || []; if (S.mode === 'admin') adminView(); }).catch(() => { DL = []; });
}
function delCard() {
  loadDels();
  if (!DL || !DL.length) return '';
  return `<section class="mt-8 rounded-3xl border-2 border-sun/40 bg-white p-5 sm:p-6"><h2 class="text-xl font-bold">회원 탈퇴 신청 ${DL.length}건</h2><p class="mt-1 text-sm text-sea/70">진행 중 거래가 없으면 처리할 수 있어요. 남은 예치금은 먼저 계좌로 돌려준 뒤 처리하세요.</p>
    ${DL.map(d => `<div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ice px-4 py-3 text-sm"><div><b>${esc(d.name || '이름 없음')}</b> · ${esc(d.email || '')} · ${d.role === 'pro' ? '기사' : '고객'}<p class="text-xs text-sea/60">${esc(new Date(d.delete_req).toLocaleString('ko-KR'))} 신청${d.open_deals ? ` · <b class="text-sun">진행 중 거래 ${d.open_deals}건</b>` : ''}${d.balance ? ` · 예치금 ${won(d.balance)}` : ''}</p></div>
      ${d.open_deals ? '<span class="text-xs font-bold text-sea/50">거래 끝난 뒤 처리</span>' : btn(d.balance ? 'deldone2' : 'deldone', d.id, d.balance ? '환불했어요 · 탈퇴 처리' : '탈퇴 처리', 's')}</div>`).join('')}</section>`;
}
function navMenu() {
  const it = (attrs, t, cls = '') => `<button type="button" ${attrs} class="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left font-bold hover:bg-ice ${cls}">${t}<span class="text-sea/30" aria-hidden="true">›</span></button>`;
  openM(head('전체 메뉴') + `<div class="-mx-2 divide-y divide-mist">
    <div class="py-1">${it('data-act="qopen0"', '⚡ 무료 견적 요청', 'text-brand')}${it('data-act="pros"', '기사님 찾기', 'text-cyan-600')}${it('data-act="mkt"', '중고마켓', 'text-emerald-600')}${it('data-act="gopro"', '기사님 등록', 'text-sun')}</div>
    <div class="py-1">${it('data-act="navgo" data-id="#process"', '이용 방법')}${it('data-act="guarantee"', '14일 재점검 안심 보장')}${it('data-act="cs"', '고객센터')}</div>
    <div class="py-1">${standalone() ? '' : it('data-act="install"', '홈 화면에 앱 추가')}${canNote() && Notification.permission === 'default' && S.user ? it('data-act="notifon"', '🔔 알림 켜기') : ''}${S.user ? it('data-act="auth"', '로그아웃', 'text-sea/60') + it('data-act="delacct"', '회원 탈퇴', 'text-sm text-sea/45') : it('data-act="auth"', '로그인 / 회원가입')}</div></div>
    ${S.user ? `<p class="mt-3 px-2 text-xs text-sea/50">${esc((S.profile && S.profile.name) || S.user.email || '')}님으로 로그인 중</p>` : ''}`);
}
function sellOpen() { if (S.mode === 'customer' && S.view !== 'market') openMarket(); sellModal('normal'); }
function openPros() { closeM(); if (S.mode !== 'customer') S.mode = 'customer', updateAuthUI(); showView('pros'); renderPros(); }
function openMarket() { closeM(); if (S.mode !== 'customer') S.mode = 'customer', updateAuthUI(); showView('market'); renderMarket(); }

const myReqs = () => S.req.filter(r => r.customer_id === me());
const myCons = () => S.con.filter(c => c.client_id === me() || c.provider_id === me());
const conFor = (k, id) => S.con.find(c => c[k] === id);
const reviewOf = cid => S.myRev.find(r => r.contract_id === cid);
const reworkOf = cid => S.rew.find(r => r.contract_id === cid);
const unreadN = () => S.inq.filter(i => i.user_id === me() && i.unread).length;

function render() {
  const cust = S.mode === 'customer';
  const n = !S.user ? 0 : cust ? myReqs().filter(r => r.status === 'open').length + S.con.filter(c => c.client_id === me() && c.status === 'pending').length : S.con.filter(c => c.provider_id === me() && c.status !== 'completed').length;
  const need = cust && S.con.some(c => c.client_id === me() && c.status === 'pending');
  $('#fab').innerHTML = (cust ? '내 요청 관리' : '내 견적·계약') + (n ? ` <span class="ml-1 rounded-full bg-sun px-2 py-0.5 text-xs">${n}</span>` : '') + (need ? ' <span class="ml-1 rounded-full bg-white px-2 py-0.5 text-xs text-sea">확인 필요</span>' : '') + (cust && unreadN() ? ' <span class="ml-1 rounded-full bg-sun px-2 py-0.5 text-xs">새 답변</span>' : '');
  setBadge($('#mbar-menu'), cust ? n + (S.user ? unreadN() : 0) : 0); setBadge($('#mbar-pmenu'), cust ? 0 : n);
  $('#fab').style.display = S.mode === 'admin' ? 'none' : '';
  $('#mbar').style.display = S.mode === 'admin' ? 'none' : '';
  if ($('#inst').style.display !== 'none') instPlace();
  const proMode = S.mode === 'pro', bal = S.pro ? won(S.pro.balance) : '';
  $('#hdr-bal').style.display = proMode && approved() ? '' : 'none'; $('#hdr-bal').textContent = '예치금 ' + bal;
  $('#mbar-bal').style.display = proMode && approved() ? '' : 'none';
  $('#mbar-c').classList.toggle('hidden', !cust); $('#mbar-p').classList.toggle('hidden', cust); $('#mbar-p').classList.toggle('grid', !cust); tabState();
  $('#hdr-quote').style.display = cust ? '' : 'none';
  const nb = $('#noti-badge'), nn = S.user ? S.ntf.filter(x => !x.read).length : 0; nb.style.display = nn ? '' : 'none'; nb.textContent = nn > 9 ? '9+' : nn;
  renderHome(); renderFeed();
  if (S.view === 'market' && cust) renderMarket();
  if (S.view === 'pros' && cust) renderPros();
  if (proMode) proView();
  if (S.mode === 'admin') adminView();
}

/* =====================================================================
   장터 (메인 미리보기 · 전용 화면 · 상세 · 판매 · 제안)
   ===================================================================== */
let fp = 0, fpages = 1, ldetCur = null, sellKind = 'normal', sp = [], sellBulk = false, bk = [];
/* 일괄 판매: 자주 파는 종목 */
const ITEMS = ['업소용 냉장고(4도어)', '업소용 냉동고', '냉장·냉동 겸용', '테이블 냉장고', '쇼케이스', '반찬 냉장고(밧드)', '음료 냉장고', '아이스크림 냉동고', '김치냉장고', '제빙기', '에어컨'];
const itemsOf = l => Array.isArray(l.items) ? l.items : [];
const itemsN = l => itemsOf(l).reduce((t, x) => t + (+x.q || 0), 0);
const MK = { q:'', grades:new Set(), sort:'new', tab:'all', free:false };
const FAV = new Set((() => { try { return JSON.parse(localStorage.getItem('hy_fav') || '[]'); } catch (_) { return []; } })());
const saveFav = () => { try { localStorage.setItem('hy_fav', JSON.stringify([...FAV])); } catch (_) {} };
const ago = t => { const m = Math.floor((Date.now() - T(t)) / 6e4); return m < 1 ? '방금 전' : m < 60 ? m + '분 전' : m < 1440 ? Math.floor(m / 60) + '시간 전' : Math.floor(m / 1440) + '일 전'; };
const heart = id => FAV.has(id) ? '❤️' : '🤍';
const favBtn = id => `<button type="button" data-act="fav" data-id="${id}" aria-pressed="${FAV.has(id)}" aria-label="관심 목록에 담기" class="h-10 w-10 shrink-0 rounded-full hover:bg-ice text-xl">${heart(id)}</button>`;
const sellerFree = l => l.kind === 'stock' && !!(proPub(l.seller_id) || {}).free;
const thumb = l => l.photos && l.photos[0] ? `<img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy" class="aspect-[4/3] w-full object-cover">` : `<div class="aspect-[4/3] grid place-items-center bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-200" aria-hidden="true">${svgI(KINDS.cold.icon, 'h-12 w-12')}</div>`;
const thumbSq = l => l.photos && l.photos[0] ? `<img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy" class="h-full w-full object-cover">` : `<span class="grid h-full w-full place-items-center bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-200" aria-hidden="true">${svgI(KINDS.cold.icon, 'h-9 w-9')}</span>`;
const badge = l => `${itemsOf(l).length ? `<span class="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-white">일괄 ${itemsN(l)}대</span>` : ''}<span class="rounded-full px-2.5 py-0.5 text-xs font-bold ${GC[l.grade]}">${GR[l.grade][0]}</span>${l.kind === 'stock' ? '<span class="rounded-full bg-sea px-2.5 py-0.5 text-xs font-bold text-white">업체 재고</span>' : ''}${sellerFree(l) ? FREE_CHIP : ''}`;
const lstate = l => l.status === 'open' ? (l.seller_id === me() ? `받은 제안 ${S.off.filter(o => o.listing_id === l.id).length}건` : '판매 중') : l.status === 'sold' ? '거래 완료' : '판매 종료';
const lcard = l => `<button type="button" data-act="ldet" data-id="${l.id}" class="text-left overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 lg:rounded-3xl ${l.status !== 'open' ? 'opacity-60' : ''}">${thumb(l)}
  <div class="p-3 sm:p-4"><div class="flex flex-wrap items-center gap-1.5">${badge(l)}</div><p class="mt-1 text-xs text-sea/60">${esc(place(l.gu))} · ${l.years}년 사용</p>
  <p class="mt-1.5 font-bold line-clamp-1">${esc(l.title)}</p><p class="mt-0.5 text-lg font-black text-brand md:text-xl">${won(l.price)}</p>
  <p class="mt-1 text-xs text-sea/60">${lstate(l)}</p></div></button>`;
function renderFeed() {
  const all = S.lst.filter(l => l.status !== 'closed');
  fpages = Math.max(1, Math.ceil(all.length / 4)); fp = Math.min(fp, fpages - 1);
  $('#feed').innerHTML = all.length ? all.slice(fp * 4, fp * 4 + 4).map(lcard).join('') : `<div class="col-span-2 lg:col-span-4">${empty(sb ? '아직 등록된 판매글이 없어요. 첫 판매글을 올려 보세요.' : '사이트 설정이 끝나면 판매글이 보여요.')}</div>`;
  $('#fpager').innerHTML = fpages > 1 ? `<button type="button" data-act="fprev" class="${B.s}">이전</button><span class="text-sm font-bold" aria-live="polite">${fp + 1} / ${fpages}</span><button type="button" data-act="fnext" class="${B.s}">다음</button>` : '';
}
const mrow = l => `<div class="flex items-start gap-2 py-3 sm:py-4 border-b border-mist ${l.status === 'open' ? '' : 'opacity-60'}">
  <button type="button" data-act="ldet" data-id="${l.id}" class="flex min-w-0 flex-1 gap-3 sm:gap-4 text-left">
    <span class="block h-20 w-20 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-2xl">${thumbSq(l)}</span>
    <span class="min-w-0 flex-1"><span class="block font-bold line-clamp-2">${esc(l.title)}</span>
      <span class="block mt-1 text-xs text-sea/60">${esc(place(l.gu))} · ${ago(l.created_at)} · ${l.years}년 사용</span>
      <span class="block mt-0.5 sm:mt-1 text-base sm:text-lg font-bold">${won(l.price)}</span>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">${badge(l)}${l.seller_id === me() ? '<span class="rounded-full bg-sun/15 px-2.5 py-0.5 text-xs font-bold text-sun">내 글</span>' : ''}<span class="text-xs text-sea/60">${lstate(l)}</span></span></span></button>${favBtn(l.id)}</div>`;
function renderMarket() {
  const mine = S.lst.filter(l => l.seller_id === me()).length;
  $('#mtabs').innerHTML = [['all', '전체'], ['mine', `내 판매글 (${mine})`], ['fav', `관심 (${FAV.size})`]].map(([k, t]) => `<button type="button" data-act="mtab" data-id="${k}" aria-pressed="${MK.tab === k}" class="shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm font-bold ${MK.tab === k ? 'bg-sea text-white' : 'bg-ice hover:bg-mist'}">${t}</button>`).join('');
  $('#mchips').innerHTML = ['A', 'B', 'C'].map(g => `<button type="button" data-act="mgr" data-id="${g}" aria-pressed="${MK.grades.has(g)}" class="shrink-0 rounded-full border-2 px-2.5 py-1 text-xs sm:text-sm font-bold ${MK.grades.has(g) ? 'border-cool bg-cool text-white' : 'border-mist hover:bg-ice'}">${g}급</button>`).join('')
    + `<button type="button" data-act="mfree" aria-pressed="${MK.free}" class="shrink-0 rounded-full border-2 px-2.5 py-1 text-xs sm:text-sm font-bold ${MK.free ? 'border-cool bg-cool text-white' : 'border-mist hover:bg-ice'}">🚚 무료 출장 견적 가능만</button>`;
  let rows = S.lst.filter(l => MK.tab === 'mine' ? l.seller_id === me() : l.status !== 'closed');
  if (MK.tab === 'fav') rows = rows.filter(l => FAV.has(l.id));
  if (MK.grades.size) rows = rows.filter(l => MK.grades.has(l.grade));
  if (MK.free) rows = rows.filter(sellerFree);
  if (MK.q) rows = rows.filter(l => (l.title + ' ' + l.descr + ' ' + l.gu + ' ' + l.loc + ' ' + itemsOf(l).map(x => x.n).join(' ')).toLowerCase().includes(MK.q));
  rows.sort(MK.sort === 'low' ? (a, b) => a.price - b.price : MK.sort === 'high' ? (a, b) => b.price - a.price : (a, b) => b.id - a.id);
  $('#mcount').textContent = `${rows.length}개의 판매글`;
  $('#mrows').innerHTML = rows.map(mrow).join('') || `<div class="mt-6">${empty(MK.tab === 'mine' ? (S.user ? '아직 올린 판매글이 없어요. “+ 판매글”로 첫 글을 올려 보세요.' : '로그인하면 내 판매글을 볼 수 있어요.') : MK.tab === 'fav' ? '🤍를 눌러 마음에 드는 판매글을 담아 보세요.' : '조건에 맞는 판매글이 없어요.')}</div>`;
}
function ldet(id, keep) {
  const l = S.lst.find(x => x.id === +id); if (!l) return toast('판매글을 찾을 수 없어요.');
  ldetCur = l.id;
  const mine = l.seller_id === me(), offs = S.off.filter(o => o.listing_id === l.id).sort((a, b) => b.price - a.price), myOff = S.off.find(o => o.listing_id === l.id && o.buyer_id === me());
  const ch = t => `<span class="rounded-full bg-ice px-2.5 py-1">${t}</span>`, asPro = S.mode === 'pro' && approved();
  let foot;
  if (mine) {
    foot = `<h3 class="mt-6 font-bold">받은 제안 ${offs.length}건</h3>` + (offs.map(o => card(`<div class="flex items-start justify-between gap-3"><div><p class="font-bold">${esc(o.buyer_name)}</p><p class="text-sm text-cool font-bold">${o.buyer_kind === 'pro' ? '매입 업체' : '개인 구매자'}</p></div><p class="font-display text-2xl">${won(o.price)}</p></div>
      <p class="mt-2 text-sm">${esc(o.msg) || '메시지 없음'}</p><p class="text-xs text-sea/60 mt-1">${o.buyer_kind === 'pro' ? '수거 가능일' : '거래 희망일'} ${esc(o.pickup)}</p>
      <div class="mt-3">${l.status === 'open' ? btn('lpick', o.id, '이 제안으로 거래하기', 'a') : `<span class="text-sm font-bold">${QL[o.status]}</span>`}</div>`)).join('') || `<div class="mt-2">${empty('아직 제안이 없어요.')}</div>`)
      + `<p class="mt-3 text-xs text-sea/60">${l.kind === 'stock' ? '거래가 최종 확정될 때 거래금액의 5%(건당 최대 10만 원)가 예치금에서 차감돼요. 구매자는 수수료가 없어요.' : '일반 판매는 수수료가 없어요.'}</p>`
      + (l.status === 'open' ? `<div class="mt-4">${btn('lclose', l.id, '판매글 내리기', 's')}</div>` : (conFor('listing_id', l.id) ? `<div class="mt-4">${btn('rcpt', conFor('listing_id', l.id).id, '거래 내역 보기', 's')}</div>` : ''));
  } else {
    foot = `<div class="mt-5">${myOff ? `<p class="font-bold text-cool">내 제안 ${won(myOff.price)} · ${QL[myOff.status]}</p>` : l.status === 'open' ? btn('oopen', l.id, asPro ? '매입 제안하기' : '구매 제안하기', 'a', 'w-full') : ''}</div><p class="mt-2 text-xs text-sea/60">제안이 선택되면 판매자와 채팅방이 열려요. 제안 내역은 판매자만 볼 수 있어요.</p>`;
  }
  openM(head(esc(l.title)) + (l.photos && l.photos.length ? `<div class="flex snap-x gap-2 overflow-x-auto pb-1">${l.photos.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" class="shrink-0 snap-start"><img src="${esc(u)}" alt="판매 사진 ${i + 1}" loading="lazy" class="h-44 rounded-xl object-cover"></a>`).join('')}</div>${l.photos.length > 2 ? `<p class="mt-1 text-xs text-sea/50">사진 ${l.photos.length}장 · 옆으로 밀어서 보기 · 누르면 크게 보여요</p>` : ''}` : thumb(l)) + `
    <div class="mt-3 flex items-center justify-between"><p class="font-display text-3xl">${won(l.price)}</p>${favBtn(l.id)}</div>
    <div class="mt-2 flex flex-wrap gap-2 text-xs">${badge(l)}${ch(GR[l.grade][1])}${ch(l.years + '년 사용')}${ch('엘리베이터 ' + yn(l.elev))}${ch('사다리차 ' + (l.ladder ? '가능' : '불가'))}</div>
    ${itemsOf(l).length ? `<div class="mt-4 rounded-2xl border-2 border-sun/40 bg-sun/5 p-4"><p class="text-sm font-bold">일괄 판매 구성 · 총 ${itemsN(l)}대</p><ul class="mt-2 space-y-1 text-sm">${itemsOf(l).map(x => `<li class="flex justify-between gap-3"><span>${esc(x.n)}</span><b class="tabular-nums">${+x.q}대</b></li>`).join('')}</ul><p class="mt-2 text-xs text-sea/60">표시된 가격은 전체를 한 번에 사는 가격이에요.</p></div>` : ''}
    <p class="mt-3 text-sm text-sea/70">${esc(place(l.gu))}${l.loc ? ' · ' + esc(l.loc) : ''} · ${ago(l.created_at)}</p>${l.descr ? `<p class="mt-2 leading-relaxed whitespace-pre-wrap">${esc(l.descr)}</p>` : ''}` + foot + sellerMore(l), keep);
  menuCur = 'ldet';
}
function sellerMore(l) {
  const more = S.lst.filter(x => x.seller_id === l.seller_id && x.id !== l.id && x.status === 'open').slice(0, 6);
  if (!more.length) return '';
  return `<h3 class="mt-6 font-bold">${l.seller_id === me() ? '내 다른 판매글' : '이 판매자의 다른 물건'} ${more.length}개</h3><div class="mt-2 flex gap-2 overflow-x-auto pb-1">${more.map(x => `<button type="button" data-act="ldet" data-id="${x.id}" class="w-32 shrink-0 overflow-hidden rounded-xl border border-mist text-left"><span class="block h-20 overflow-hidden">${thumbSq(x)}</span><span class="block px-2 pt-1.5 text-xs font-bold line-clamp-1">${esc(x.title)}</span><span class="block px-2 pb-2 text-xs text-sea/70">${won(x.price)}</span></button>`).join('')}</div>${l.seller_id === me() ? '' : '<p class="mt-2 text-xs text-sea/60">여러 개를 함께 사고 싶다면 제안 메시지에 적어 주세요.</p>'}`;
}
function bkDraw() {
  const box = $('#bk-box'); if (!box) return;
  box.classList.toggle('hidden', !sellBulk);
  document.querySelectorAll('[data-act="smode"]').forEach(b => { const on = (b.dataset.id === 'bulk') === sellBulk; b.setAttribute('aria-pressed', on); b.className = `rounded-xl py-3 text-sm font-bold ${on ? 'bg-sea text-white' : 'text-sea/60'}`; });
  $('#sl-title-l').textContent = sellBulk ? '판매글 제목 (비워 두면 자동으로 만들어요)' : '제품명';
  $('#sl-price-l').textContent = sellBulk ? '일괄 희망 가격 · 전체 합계(원)' : '희망 판매 가격(원)';
  $('#sl-years-l').textContent = sellBulk ? '평균 사용 연식(년)' : '사용 연식(년)';
  $('#sp-lab').textContent = sellBulk ? `사진 추가하기 (최대 20장 · 물건마다 찍어 주세요) ${sp.length ? sp.length + '/20' : ''}` : `사진 추가하기 (최대 5장) ${sp.length ? sp.length + '/5' : ''}`;
  $('#bk-chips').innerHTML = ITEMS.map((n, i) => `<button type="button" data-act="bkadd" data-id="${i}" class="rounded-full border-2 px-3 py-1.5 text-xs font-bold ${bk.some(x => x.n === n) ? 'border-cool bg-cool/10 text-sea' : 'border-mist hover:bg-ice'}">+ ${n}</button>`).join('');
  $('#bk-list').innerHTML = bk.length ? bk.map((x, i) => `<li class="flex items-center gap-2 rounded-xl bg-white px-3 py-2"><span class="min-w-0 flex-1 truncate text-sm font-bold">${esc(x.n)}</span>
    <button type="button" data-act="bkq" data-id="${i}:-1" aria-label="${esc(x.n)} 한 대 빼기" class="h-8 w-8 rounded-full bg-ice font-bold">−</button><span class="w-8 text-center font-bold tabular-nums">${x.q}</span><button type="button" data-act="bkq" data-id="${i}:1" aria-label="${esc(x.n)} 한 대 더하기" class="h-8 w-8 rounded-full bg-ice font-bold">+</button>
    <button type="button" data-act="bkrm" data-id="${i}" aria-label="${esc(x.n)} 빼기" class="ml-1 text-xl leading-none text-sea/40">&times;</button></li>`).join('') + `<li class="px-1 pt-1 text-right text-sm font-bold">총 ${bk.reduce((t, x) => t + x.q, 0)}대 · ${bk.length}종목</li>` : '<li class="rounded-xl bg-white px-3 py-4 text-center text-sm text-sea/60">위에서 파실 물건 종목을 눌러 담아 주세요.</li>';
}
function bkAdd(n) { n = String(n || '').trim().slice(0, 30); if (!n) return; const f = bk.find(x => x.n === n); if (f) f.q = Math.min(f.q + 1, 99); else if (bk.length < 20) bk.push({ n, q:1 }); else return toast('종목은 20개까지 담을 수 있어요.'); bkDraw(); }
function sellModal(kind) {
  if (needLogin('판매글은 로그인 후 올릴 수 있어요.')) return;
  if (kind === 'stock' && !approved()) return toast('승인된 기사·업체만 재고 판매글을 올릴 수 있어요.');
  sellKind = kind === 'stock' ? 'stock' : 'normal'; sp = []; bk = []; sellBulk = false;
  const lab = (f, t) => `<label for="${f}" class="block mt-4 text-sm font-bold">${t}</label>`, inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5';
  openM(head(sellKind === 'stock' ? '중고 재고 판매글 올리기' : '중고 냉동·냉장고 판매글') + `${sellKind === 'stock' ? '<p class="mb-4 rounded-xl bg-cool/10 p-3 text-sm leading-relaxed">거래가 확정되면 <b>거래금액의 5%(건당 최대 10만 원)</b>만 예치금에서 차감돼요.</p>' : ''}
    <div class="grid grid-cols-2 gap-1 rounded-2xl bg-ice p-1" role="group" aria-label="판매 방식"><button type="button" data-act="smode" data-id="one" aria-pressed="true" class="rounded-xl py-3 text-sm font-bold bg-sea text-white">한 대만 팔기</button><button type="button" data-act="smode" data-id="bulk" aria-pressed="false" class="rounded-xl py-3 text-sm font-bold text-sea/60">여러 대 일괄 판매</button></div>
    <div id="bk-box" class="hidden mt-3 rounded-2xl border-2 border-sun/40 bg-sun/5 p-4"><p class="text-sm font-bold">파실 물건을 모두 담아 주세요</p><p class="mt-0.5 text-xs text-sea/60">폐업·리뉴얼 매장은 한 번에 올리면 매입 업체 연락이 더 빨라요.</p>
      <div id="bk-chips" class="mt-3 flex flex-wrap gap-1.5"></div>
      <div class="mt-2 flex gap-2"><input id="bk-in" maxlength="30" placeholder="목록에 없으면 직접 입력 (예: 냉장 진열대)" class="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 text-sm"><button type="button" data-act="bkcustom" class="shrink-0 rounded-xl bg-sea px-3 text-sm font-bold text-white">담기</button></div>
      <ul id="bk-list" class="mt-3 space-y-1.5"></ul></div>
    <label class="mt-4 flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-cool/50 bg-ice px-4 py-6 text-center cursor-pointer hover:bg-mist"><span id="sp-lab" class="font-bold">사진 추가하기 (최대 5장)</span><input id="sp-file" type="file" accept="image/*" multiple class="sr-only"></label>
    <ul id="sp-thumbs" class="mt-3 grid grid-cols-5 gap-2"></ul>
    <label id="sl-title-l" for="sl-title" class="block mt-4 text-sm font-bold">제품명</label><input id="sl-title" maxlength="40" placeholder="예) 4도어 업소용 냉장고" class="${inp}">
    <label id="sl-price-l" for="sl-price" class="block mt-4 text-sm font-bold">희망 판매 가격(원)</label><input id="sl-price" type="number" min="1000" step="1000" inputmode="numeric" class="${inp}">
    <fieldset class="mt-4"><legend class="text-sm font-bold">제품 상태</legend><div class="mt-2 grid grid-cols-3 gap-2">${Object.keys(GR).map(k => `<label class="relative"><input type="radio" name="sg" value="${k}" class="peer sr-only"><span class="block rounded-xl border-2 border-mist py-3 text-center cursor-pointer hover:bg-ice peer-checked:border-cool peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-cool"><b>${GR[k][0]}</b><br><span class="text-xs text-sea/60">${GR[k][1]}</span></span></label>`).join('')}</div></fieldset>
    <label id="sl-years-l" for="sl-years" class="block mt-4 text-sm font-bold">사용 연식(년)</label><input id="sl-years" type="number" min="0" max="40" inputmode="numeric" placeholder="예) 3" class="${inp}">
    ${lab('sl-gu', '매장 위치 (서울·경기 인접)')}<select id="sl-gu" class="${inp}"><option value="">지역을 선택하세요</option>${guOpts(GG_NEAR)}</select>
    <input id="sl-loc" maxlength="40" aria-label="상세 위치" placeholder="상세 위치 예) 삼성역 인근 1층 (번지까지는 적지 마세요)" class="${inp}">
    <div class="mt-4 grid grid-cols-2 gap-3"><div><label for="sl-elev" class="text-sm font-bold">엘리베이터</label><select id="sl-elev" class="${inp}"><option value="">선택</option><option value="y">있음</option><option value="n">없음</option></select></div>
    <div><label for="sl-lad" class="text-sm font-bold">사다리차 이용</label><select id="sl-lad" class="${inp}"><option value="">선택</option><option value="y">가능</option><option value="n">불가</option></select></div></div>
    ${lab('sl-desc', '설명 (선택)')}<textarea id="sl-desc" rows="3" maxlength="300" class="${inp} resize-none"></textarea>${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('ssend', '', '판매글 올리기')}</div>`);
  bkDraw();
}
function spThumbs() { const u = $('#sp-thumbs'); if (u) u.innerHTML = sp.map((f, i) => `<li class="relative aspect-square"><img src="${URL.createObjectURL(f)}" alt="판매 사진 ${i + 1}" class="h-full w-full rounded-xl object-cover"><button type="button" data-act="sprm" data-id="${i}" aria-label="사진 ${i + 1} 삭제" class="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-sea text-white text-sm leading-none">&times;</button></li>`).join(''); }
async function ssend(el) {
  const g = id => $(id).value.trim(), grade = document.querySelector('input[name="sg"]:checked')?.value, price = +$('#sl-price').value, years = $('#sl-years').value;
  if (sellBulk && !g('#sl-title') && bk.length) $('#sl-title').value = (bk.length > 1 ? `${bk[0].n} 외 ${bk.length - 1}종 일괄 (총 ${bk.reduce((t, x) => t + x.q, 0)}대)` : `${bk[0].n} ${bk[0].q}대 일괄`).slice(0, 40);
  const err = sp.length > spMax() ? `사진이 ${sp.length}장이에요. 한 대 판매는 5장까지예요. 사진을 줄이거나 ‘여러 대 일괄 판매’를 눌러 주세요.` : sellBulk && !bk.length ? '일괄 판매할 물건 종목을 담아 주세요.' : sellBulk && bk.length === 1 && bk[0].q < 2 ? '일괄 판매는 2대 이상일 때 써 주세요. 한 대면 ‘한 대만 팔기’를 눌러 주세요.' : !g('#sl-title') ? '제품명을 입력해 주세요.' : !(price >= 1000) ? '희망 판매 가격을 입력해 주세요.' : !grade ? '제품 상태(A/B/C급)를 선택해 주세요.'
    : years === '' || +years < 0 ? '사용 연식을 입력해 주세요.' : !g('#sl-gu') ? '매장 위치를 선택해 주세요.' : !$('#sl-elev').value || !$('#sl-lad').value ? '엘리베이터와 사다리차 여부를 선택해 주세요.' : '';
  if (err) return setErr(err);
  await busy(el, async () => {
    el.textContent = '올리는 중...';
    const photos = await uploadAll(sp, (d, t) => { if (t > 1) el.textContent = `사진 올리는 중 ${d}/${t}`; });
    const { error } = await sb.from('listings').insert({ kind:sellKind, title:g('#sl-title'), price, grade, years:+years, gu:g('#sl-gu'), loc:g('#sl-loc'), elev:$('#sl-elev').value === 'y', ladder:$('#sl-lad').value === 'y', descr:g('#sl-desc'), photos, items:sellBulk ? bk.map(x => ({ n:x.n, q:x.q })) : [] });
    track('sell');
    if (error) throw error;
    sp = []; bk = []; closeM(); await load('lst'); fp = 0; render(); toast('판매글을 올렸어요.');
  });
  if (el && document.body.contains(el)) el.textContent = '판매글 올리기';
}
function offerModal(lid) {
  if (needLogin('제안은 로그인 후 할 수 있어요.')) return;
  const l = S.lst.find(x => x.id === +lid), asPro = S.mode === 'pro' && approved();
  if (asPro && S.pro.online === false) return toast('휴무 중에는 매입 제안을 낼 수 없어요.');
  openM(head(asPro ? '매입 제안하기' : '구매 제안하기') + `<p class="text-sm"><b>${esc(l.title)}</b> · 희망가 ${won(l.price)}</p>${itemsOf(l).length ? `<p class="mt-2 rounded-xl bg-sun/10 p-3 text-sm">일괄 판매 <b>${itemsN(l)}대 전체</b>에 대한 제안이에요.</p>` : ''}
    <p class="mt-3 rounded-xl bg-cool/10 p-3 text-sm leading-relaxed">${asPro ? '매입 제안은 <b>무료</b>이고 매입 수수료도 0원이에요.' : '구매자는 수수료가 없어요. 조건은 판매자와 채팅으로 조율해요.'}</p>
    <label for="op" class="block mt-4 text-sm font-bold">제안 금액(원)</label><input id="op" type="number" min="1000" step="1000" inputmode="numeric" value="${l.price}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
    <label for="od" class="block mt-4 text-sm font-bold">${asPro ? '철거/수거 가능일' : '거래 희망일'}</label><input id="od" type="date" min="${today()}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
    <label for="om" class="block mt-4 text-sm font-bold">한 줄 메시지</label><input id="om" maxlength="100" placeholder="예) 현장 확인 후 당일 수거해요." class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-act="ldet" data-id="${l.id}" class="${B.s}">취소</button>${wbtn('osend', l.id, '제안 보내기')}</div>`);
}
async function osend(el, lid) {
  const price = +$('#op').value, pickup = $('#od').value, msg = $('#om').value.trim(), asPro = S.mode === 'pro' && approved();
  if (!(price >= 1000)) return setErr('제안 금액을 입력해 주세요.');
  if (!pickup || pickup < today()) return setErr('오늘 이후 날짜를 선택해 주세요.');
  await busy(el, async () => {
    const { error } = await sb.from('offers').insert({ listing_id:+lid, buyer_kind:asPro ? 'pro' : 'customer', price, pickup, msg });
    if (error) throw (error.code === '23505' ? new Error('이미 제안한 판매글이에요.') : error);
    await load('off'); closeM(); toast('제안을 보냈어요. 판매자가 선택하면 채팅방이 열려요.');
  });
}
async function lpick(el, oid) {
  await busy(el, async () => {
    const r = await rpc('accept_offer', { p_offer:+oid });
    if (!r.ok) { toast(`예치금이 부족해요. 수수료 ${won(r.need)}가 필요해요.`); return walletModal(); }
    await Promise.all(['lst', 'off', 'con', 'thr'].map(load)); render(); receipt(r.contract_id, true); toast('거래가 체결됐어요. 채팅방에서 일정을 조율해 보세요.');
  });
}
async function lclose(el, lid) {
  await busy(el, async () => { const { error } = await sb.from('listings').update({ status:'closed' }).eq('id', +lid); if (error) throw error; await load('lst'); closeM(); render(); toast('판매글을 내렸어요.'); });
}

/* =====================================================================
   기사찾기 · 기사 프로필
   ===================================================================== */
const FS = { kind:'', gu:'', sort:'rating', free:false };
const pbadges = p => `${p.biz_verified ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">사업자 인증</span>' : ''}${p.online === false ? '<span class="rounded-full bg-sun/15 px-2 py-0.5 text-xs font-bold text-sun">휴무</span>' : ''}`;
const prate = p => p.rating_count ? `★ ${(+p.rating).toFixed(1)} · 후기 ${p.rating_count}` : '신규 · 아직 후기가 없어요';
const ptags = p => (p.fields || []).map(f => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">${esc(f)}</span>`).join('') + (p.free ? '<span class="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand">무료 출장 견적</span>' : '');
const cbadge = q => `<span class="rounded-full border border-sea/30 bg-white px-2.5 py-0.5 text-xs font-bold">${q.includes('장비') ? '🧰' : '🏅'} ${esc(q)}</span>`;
const pcerts = (p, all) => { const q = p.certs || [], shown = all ? q : q.slice(0, 3); return shown.map(cbadge).join('') + (!all && q.length > 3 ? `<span class="text-xs text-sea/60">외 ${q.length - 3}</span>` : ''); };
const proAvatar = (p, cls = 'h-14 w-14 text-xl') => `<span class="grid ${cls} shrink-0 place-items-center rounded-2xl font-black text-white ${(KINDS[p.kind] || KINDS.aircon).avatar}" aria-hidden="true">${esc((p.name || '?').trim()[0])}</span>`;
const pkindLine = p => `${(KINDS[p.kind] || KINDS.aircon).name}${p.kind === 'truck' && p.ton ? ` · ${esc(p.ton)}${p.lift ? ' 리프트' : ''}` : ''}`;
function proCard(p) {
  return `<article class="flex flex-col rounded-3xl bg-white p-4 shadow-card lg:p-6">
    <button type="button" data-act="pdet" data-id="${p.id}" class="flex w-full flex-col gap-3 text-left">
      <span class="flex items-center gap-3">${proAvatar(p)}
        <span class="min-w-0 flex-1"><span class="flex flex-wrap items-center gap-1.5"><b class="text-[17px]">${esc(p.name)}</b>${pbadges(p)}</span>
        <span class="mt-0.5 block text-sm"><b class="text-brand">${pkindLine(p)}</b> <span class="text-sub">· ${p.rating_count ? `<b class="text-amber-500">★ ${(+p.rating).toFixed(1)}</b> 후기 ${p.rating_count}` : '신규'}${p.done ? ` · 완료 ${p.done}건` : ''}</span></span></span></span>
      ${p.bio ? `<span class="line-clamp-2 text-sm text-slate-600">${esc(p.bio)}</span>` : ''}
      <span class="flex flex-wrap gap-1.5">${ptags(p)}</span>
      ${(p.certs || []).length ? `<span class="flex flex-wrap items-center gap-1.5">${pcerts(p)}</span>` : ''}
      <span class="border-t border-mist pt-3 text-xs text-sub">활동 지역 ${(p.areas || []).slice(0, 4).join(' · ')}${(p.areas || []).length > 4 ? ` 외 ${p.areas.length - 4}곳` : ''}</span></button>
    <div class="mt-3 grid grid-cols-[1fr_1.4fr] gap-2">${p.id === me() ? '<p class="col-span-2 text-center text-xs text-sub">내 프로필이에요</p>' : `${btn('pchat', p.id, '안심 채팅', 's', 'py-2.5')}${btn('preq', p.id, '견적 요청', 'a', 'py-2.5')}`}</div></article>`;
}
function renderPros() {
  let ps = [...S.prosPub];
  const kinds = [['', '전체'], ...Object.entries(KINDS).map(([k, v]) => [k, v.name])];
  $('#fkinds-m').innerHTML = kinds.map(([k, t]) => `<button type="button" data-act="fkind" data-id="${k}" aria-pressed="${FS.kind === k}" class="shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold ${FS.kind === k ? 'border-brand bg-brand text-white' : 'border-mist bg-white text-slate-600'}">${t}</button>`).join('');
  $('#fkinds-d').innerHTML = kinds.map(([k, t]) => `<button type="button" data-act="fkind" data-id="${k}" aria-pressed="${FS.kind === k}" class="flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold ${FS.kind === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}">${t}<span class="text-xs opacity-70">${k ? S.prosPub.filter(p => (p.kind || 'aircon') === k).length : S.prosPub.length}</span></button>`).join('');
  $('#fchips').innerHTML = `<button type="button" data-act="ffree" aria-pressed="${FS.free}" class="rounded-2xl border px-3 py-2.5 text-sm font-bold ${FS.free ? 'border-brand bg-brand text-white' : 'border-mist bg-white'}">무료 견적</button>`;
  $('#ffree2').checked = FS.free;
  if (FS.kind) ps = ps.filter(p => (p.kind || 'aircon') === FS.kind);
  if (FS.free) ps = ps.filter(p => p.free);
  if (FS.gu) ps = ps.filter(p => (p.areas || []).includes(FS.gu));
  ps.sort(FS.sort === 'reviews' ? (a, b) => b.rating_count - a.rating_count : FS.sort === 'done' ? (a, b) => (b.done || 0) - (a.done || 0) : FS.sort === 'new' ? (a, b) => T(b.created_at) - T(a.created_at) : (a, b) => b.rating - a.rating || b.rating_count - a.rating_count);
  $('#pcount').textContent = `${ps.length}명`;
  $('#prows').innerHTML = ps.map(proCard).join('') || `<div class="lg:col-span-2">${empty(S.prosPub.length ? '조건에 맞는 기사님이 없어요. 필터를 바꿔 보세요.' : '아직 등록된 기사님이 없어요. 곧 만나요!')}</div>`;
}
/* 홈: 3대 분야 카드 · 기사님 미리보기 */
function renderHome() {
  const cats = $('#cats');
  if (cats && !cats.dataset.done) { cats.dataset.done = 1;
    cats.innerHTML = Object.entries(KINDS).map(([k, c]) => `<button type="button" data-act="qcat" data-id="${k}" class="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-card transition active:scale-[.99] lg:flex-col lg:items-start lg:gap-5 lg:p-7 lg:hover:-translate-y-1 lg:hover:shadow-xl">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${c.color} lg:h-16 lg:w-16">${svgI(c.icon, 'h-7 w-7 lg:h-8 lg:w-8')}</span>
      <span class="min-w-0 flex-1"><b class="block text-[17px] leading-snug lg:text-xl">${c.title}</b><span class="mt-0.5 block text-sm text-sub lg:mt-1 lg:text-[15px]">${c.desc}</span>
        <span class="mt-4 hidden flex-wrap gap-1.5 lg:flex">${c.svcs.map(x => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">${SVC[x].replace('에어컨 ', '').replace('냉장·냉동고 ', '').replace('냉장·냉동 ', '')}</span>`).join('')}</span></span>
      <span class="text-xl text-slate-300 lg:hidden" aria-hidden="true">›</span><span class="hidden text-sm font-black text-brand lg:inline">견적 요청하기 →</span></button>`).join(''); }
  const hp = $('#home-pros'); if (!hp) return;
  const top = [...S.prosPub].sort((a, b) => b.rating - a.rating || b.rating_count - a.rating_count).slice(0, 4);
  hp.innerHTML = top.length ? top.map(p => `<button type="button" data-act="pdet" data-id="${p.id}" class="w-44 shrink-0 rounded-2xl bg-white p-4 text-left shadow-card transition lg:w-auto lg:rounded-3xl lg:p-5 lg:hover:-translate-y-1">
    ${proAvatar(p, 'h-12 w-12 text-base')}<b class="mt-3 block truncate">${esc(p.name)}</b><span class="block text-xs font-bold text-brand">${pkindLine(p)}</span>
    <span class="mt-1 block text-sm">${p.rating_count ? `<b class="text-amber-500">★ ${(+p.rating).toFixed(1)}</b> <span class="text-xs text-sub">후기 ${p.rating_count}</span>` : '<span class="text-xs text-sub">신규 기사님</span>'}</span><span class="mt-1 block truncate text-xs text-sub">${esc((p.areas || []).slice(0, 2).join(' · '))}</span></button>`).join('')
    : `<div class="w-full rounded-2xl bg-white p-6 text-center text-sm text-sub shadow-card lg:col-span-4">기사님 모집 중이에요. 곧 만나요!</div>`;
}
const careerHtml = p => `<h3 class="mt-5 font-bold">경력</h3><ul class="mt-2 space-y-2">${(p.career || []).map(c => `<li class="flex gap-3 rounded-xl bg-ice px-4 py-3 text-sm"><span class="w-24 shrink-0 font-bold text-cool">${esc(c.y)}</span><span class="min-w-0 flex-1">${esc(c.t)}</span></li>`).join('') || '<li class="text-sm text-sea/60">등록된 경력이 없어요.</li>'}</ul>`;
const portCard = (p, x, extra = '') => `<li class="relative overflow-hidden rounded-xl border border-mist bg-white">${x.img ? `<img src="${esc(x.img)}" alt="${esc(x.t)}" loading="lazy" class="aspect-[4/3] w-full object-cover">` : `<div class="aspect-[4/3] grid place-items-center bg-mist text-4xl" aria-hidden="true">${emo((p.fields || [])[0])}</div>`}<div class="p-3"><p class="text-sm font-bold">${esc(x.t)}</p>${x.n ? `<p class="mt-0.5 text-xs text-sea/70">${esc(x.n)}</p>` : ''}<p class="mt-1 text-xs text-sea/50">${esc(x.d || '')}</p></div>${extra}</li>`;
async function pdet(id, back) {
  const p = proPub(id); if (!p) return toast('기사 정보를 찾을 수 없어요.');
  const { data:revs } = await sb.from('reviews').select('mood, stars, tags, body, created_at').eq('pro_id', id).order('id', { ascending:false }).limit(30);
  openM(head(esc(p.name)) + `<div class="flex items-center gap-4">${proAvatar(p, 'h-16 w-16 text-2xl')}<div class="min-w-0"><p class="text-sm font-bold text-brand">${(KINDS[p.kind] || KINDS.aircon).pro}</p><div class="mt-1 flex flex-wrap items-center gap-2">${pbadges(p)}<span class="text-sm font-bold text-amber-500">${prate(p)}</span></div>${p.done ? `<p class="mt-0.5 text-xs text-sub">완료 거래 ${p.done}건</p>` : ''}</div></div>
    ${p.kind === 'truck' && p.ton ? `<p class="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">차량 ${esc(p.ton)}${p.lift ? ' · 리프트(파워게이트) 보유' : ''}</p>` : ''}
    <div class="mt-3 flex flex-wrap gap-1.5">${ptags(p)}</div>
    ${p.bio ? `<p class="mt-3 rounded-xl bg-ice p-4 text-sm font-medium leading-relaxed">“${esc(p.bio)}”</p>` : ''}
    <h3 class="mt-5 font-bold">전문 자격증 · 장비 <span class="text-xs font-normal text-sea/60">(기사님이 직접 등록)</span></h3>
    <div class="mt-2 flex flex-wrap gap-1.5">${pcerts(p, true) || '<span class="text-sm text-sea/60">등록된 자격·장비가 없어요.</span>'}</div><p class="mt-2 text-sm text-sea/70">활동 지역 ${(p.areas || []).join(', ')}</p>
    ${careerHtml(p)}
    <h3 class="mt-5 font-bold">포트폴리오</h3>${(p.portfolio || []).length ? `<ul class="mt-2 grid grid-cols-2 gap-2">${p.portfolio.map(x => portCard(p, x)).join('')}</ul>` : '<p class="mt-2 text-sm text-sea/60">등록된 포트폴리오가 없어요.</p>'}
    <h3 class="mt-5 font-bold">실거래 후기 ${(revs || []).length}건</h3>
    ${(revs || []).length ? revs.map(r => card(`<p class="text-sm font-bold">${SL[r.mood]} <span class="font-normal text-sun">${'★'.repeat(r.stars)}</span> <span class="font-normal text-xs text-sea/50">· ${fmtD(r.created_at)}</span></p>${(r.tags || []).length || r.body ? `<p class="mt-1 text-sm">${(r.tags || []).map(esc).join(' · ')}${r.body ? (r.tags.length ? ' — ' : '') + esc(r.body) : ''}</p>` : ''}`)).join('') : `<div class="mt-2">${empty('아직 후기가 없어요.')}</div>`}
    ${back ? `<div class="mt-5">${btn(back.act, back.id || '', back.label, 's')}</div>` : ''}
    ${p.id === me() ? '' : `<div class="sticky bottom-0 -mx-6 mt-5 grid grid-cols-[1fr_1.6fr] gap-2 border-t border-mist bg-white px-6 pt-3">${btn('pchat', p.id, '안심 채팅', 's', 'py-3')}${btn('preq', p.id, '이 기사님께 견적 요청', 'a', 'py-3')}</div>`}`);
}
async function pchat(el, pid) {
  if (needLogin('채팅은 로그인 후 할 수 있어요.')) return;
  await busy(el, async () => { const tid = await rpc('open_chat', { p_pro:pid }); await load('thr'); chatModal(tid); });
}

/* =====================================================================
   견적 요청 (멀티스텝)
   ===================================================================== */
const qm = $('#qm');
let qstep = 1, qopener = null, qphotos = [], qsending = false;
const qform = { service:'', district:'', date:'', details:'', to:'', ton:'', lift:false, target:null, targetName:'' };
function qErr(msg) { const e = $('#qm-err'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
function qShow(n) {
  qstep = n; qErr('');
  document.querySelectorAll('#qm [data-step]').forEach(s => s.classList.toggle('hidden', +s.dataset.step !== n));
  [...$('#qm-bar').children].forEach((b, i) => b.className = `h-1.5 rounded-full ${i < n ? 'bg-cool' : 'bg-mist'}`);
  $('#qm-label').textContent = n < 4 ? `${n} / 3 단계${qform.targetName ? ` · 지정 기사님: ${qform.targetName}` : ''}` : '';
  const truck = (n === 2 && (document.querySelector('input[name="qm-svc"]:checked') || {}).value === 'truck') || (n === 2 && qform.service === 'truck');
  $('#qm-truck').classList.toggle('hidden', !truck); $('#qm-gu-l').textContent = truck ? '출발지' : '작업 지역';
  $('#qm-back').classList.toggle('hidden', n === 1 || n === 4);
  $('#qm-next').textContent = n === 3 ? (S.user ? '견적 요청 보내기' : '로그인하고 보내기') : n === 4 ? '닫기' : '다음';
  $('#qm-next').disabled = false;
  qm.querySelector('.overflow-y-auto').scrollTop = 0;
}
function qReset() {
  Object.assign(qform, { service:'', district:'', date:'', details:'', to:'', ton:'', lift:false, target:null, targetName:'' });
  $('#qm-to').value = ''; $('#qm-ton').value = ''; $('#qm-lift').checked = false; qCat('');
  qphotos.forEach(p => URL.revokeObjectURL(p.url)); qphotos = []; qThumbs();
  document.querySelectorAll('input[name="qm-svc"]').forEach(r => r.checked = false);
  $('#qm-gu').value = ''; $('#qm-date').value = ''; $('#qm-details').value = ''; $('#qm-count').textContent = '0 / 500';
}
/* 견적 1단계: 특정 분야만 보여주기 ('' = 전체) */
function qCat(k) { document.querySelectorAll('#qm-services fieldset').forEach(f => f.classList.toggle('hidden', !!k && f.dataset.cat !== k)); const a = $('#qm-allcat'); if (a) a.classList.toggle('hidden', !k); }
function openQuote(pre = {}, trigger) {
  if (pre.service === 'freezer_sale') return sellOpen();
  if (S.mode !== 'customer') setMode('customer');
  if (qstep === 4) qReset();
  qopener = trigger || document.activeElement;
  if (pre.service) { qform.service = pre.service; const r = document.querySelector(`input[name="qm-svc"][value="${pre.service}"]`); if (r) r.checked = true; }
  if (pre.district) { qform.district = pre.district; $('#qm-gu').value = pre.district; }
  if (pre.target) { qform.target = pre.target; qform.targetName = pre.targetName || ''; }
  qCat(pre.cat || '');
  $('#qm-date').min = today();
  qm.classList.remove('hidden'); document.body.classList.add('overflow-hidden');
  qShow(qform.service ? 2 : 1);
}
function closeQuote() { qm.classList.add('hidden'); if (!mmOpen()) document.body.classList.remove('overflow-hidden'); if (qstep === 4) { qReset(); qstep = 1; } if (qopener && qopener.focus) qopener.focus(); }
function qThumbs() { $('#qm-thumbs').innerHTML = qphotos.map((p, i) => `<li class="relative aspect-square"><img src="${p.url}" alt="첨부 사진 ${i + 1}" class="h-full w-full rounded-xl object-cover"><button type="button" data-rm="${i}" aria-label="사진 ${i + 1} 삭제" class="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-sea text-white text-sm leading-none">&times;</button></li>`).join(''); }
async function qNext() {
  if (qstep === 4) return closeQuote();
  if (qstep === 1) { const r = document.querySelector('input[name="qm-svc"]:checked'); if (!r) return qErr('서비스를 선택해 주세요.'); qform.service = r.value;
    if (r.value === 'freezer_sale') { r.checked = false; qform.service = ''; closeQuote(); return sellOpen(); }
    if (qform.target && !KINDS[kindOf(r.value)].svcs.includes(r.value)) qform.target = null; }
  if (qstep === 2) {
    qform.district = $('#qm-gu').value; qform.date = $('#qm-date').value;
    if (!qform.district) return qErr('작업할 구를 선택해 주세요.');
    if (!qform.date) return qErr('작업 희망일을 입력해 주세요.');
    if (qform.date < today()) return qErr('오늘 이후 날짜를 선택해 주세요.');
    if (qform.service === 'truck') { qform.to = $('#qm-to').value; qform.ton = $('#qm-ton').value; qform.lift = $('#qm-lift').checked;
      if (!qform.to) return qErr('도착지 구를 선택해 주세요.'); if (!qform.ton) return qErr('희망 차량을 선택해 주세요.'); }
  }
  if (qstep < 3) return qShow(qstep + 1);
  if (!sb) return qErr('사이트 설정이 아직 끝나지 않았어요.');
  if (!S.user) { toast('견적 요청은 로그인 후 보낼 수 있어요. 입력한 내용은 그대로 있어요.'); return authModal('login'); }
  qform.details = $('#qm-details').value.trim();
  if (qsending) return; qsending = true;
  const b = $('#qm-next'); b.disabled = true; b.textContent = '보내는 중...';
  try {
    const photos = await uploadAll(qphotos.map(p => p.file));
    const truck = qform.service === 'truck', row = { service:qform.service, gu:qform.district, wish_date:qform.date, details:qform.details, photos };
    if (truck) Object.assign(row, { to_gu:qform.to, ton:qform.ton, lift:qform.lift });
    if (qform.target) row.target_pro = qform.target;
    const { data, error } = await sb.from('requests').insert(row).select('id').single();
    if (!error) track('quote');
    if (error) throw error;
    const rows = [['요청 번호', reqCode(data.id)], ['서비스', SVC[qform.service]], truck ? ['출발 → 도착', `${place(qform.district)} → ${place(qform.to)}`] : ['지역', place(qform.district)], ...(truck ? [['차량', qform.ton + (qform.lift ? ' · 리프트' : '')]] : []), ...(qform.targetName ? [['지정 기사님', qform.targetName]] : []), ['희망일', qform.date], ['사진', photos.length + '장']];
    $('#qm-summary').innerHTML = rows.map(([k, v]) => `<div class="flex justify-between gap-4"><dt class="text-sea/60">${k}</dt><dd class="font-bold text-right">${esc(v)}</dd></div>`).join('');
    await load('req'); render(); qShow(4);
  } catch (e) { qErr(errMsg(e) || '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'); b.disabled = false; b.textContent = '견적 요청 보내기'; }
  finally { qsending = false; }
}

/* =====================================================================
   고객: 내 요청 관리 · 견적 비교 · 계약 · 내역서 · 보증서
   ===================================================================== */
let cmpCur = null;
const wdOf = c => c.kind === 'service' ? '작업' : c.kind === 'sale' ? '수거' : '인도';
const remainMs = c => c.paused ? (c.remaining_sec || 0) * 1000 : Math.max(0, T(c.deadline) - Date.now());
const pctLeft = c => Math.max(0, Math.min(100, remainMs(c) / ((c.auto_hours || 24) * 36e5) * 100));
const conTitle = c => c.kind === 'service' ? SVC[c.service] : esc(c.title || SVC[c.service]);
const pendBlock = c => `<div class="w-full rounded-2xl border border-sun/30 bg-sun/10 p-4">
  <p class="text-sm font-bold text-sun">기사님이 작업 완료를 요청했어요</p>
  <p class="mt-2 text-xs text-sea/70">${c.paused ? '신고가 접수되어 자동 확정이 일시 정지됐어요.' : `자동 확정까지 남은 시간 (${c.auto_hours}시간 기준)`}</p>
  <p class="font-display text-4xl mt-1 tabular-nums" data-timer="${c.id}">${hms(remainMs(c))}</p>
  <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><i class="block h-full bg-sun" data-bar="${c.id}" style="width:${pctLeft(c)}%"></i></div>
  <p class="mt-2 text-xs leading-relaxed text-sea/70">결과가 괜찮다면 거래를 확정해 주세요. 확인하지 않으면 남은 시간이 지난 뒤 자동으로 확정되고, 무상 A/S 보증이 시작돼요.</p>
  <div class="mt-3 flex flex-wrap gap-2">${btn('cfin', c.id, '✅ 거래 확정하기', 'a')}${btn('creport', c.id, '🚨 문제가 있어요', 's')}</div></div>`;
function conBlock(c) {
  if (!c) return '';
  const v = reviewOf(c.id), w = reworkOf(c.id), client = c.client_id === me(), svc = c.kind === 'service';
  const st = c.status === 'completed' ? '거래 확정 완료' : c.status === 'pending' ? '거래 확정 대기' : '계약 체결 · ' + wdOf(c) + ' 예정';
  return `<span class="text-sm font-bold w-full">${esc(client ? c.provider_name : c.client_name)} · ${won(c.price)} · ${st}</span>
    ${btn('rcpt', c.id, '작업 내역서', 's')}${btn('chatc', c.id, '채팅방', 's')}${c.warranty_no ? btn('warr', c.id, '무상 A/S 보증서', 's') : ''}
    ${!svc && c.status === 'confirmed' ? btn('cfin', c.id, '✅ 거래 완료', 'a') : ''}
    ${c.status === 'pending' && client ? pendBlock(c) : ''}
    ${svc && client && c.status === 'completed' && !v ? btn('rev', c.id, '후기 작성', 'a') : ''}
    ${svc && c.status === 'confirmed' ? `<span class="text-xs text-sea/60 w-full">작업이 끝나면 기사님이 완료를 요청해요. 그 뒤 확정하면 후기를 남길 수 있어요.</span>` : ''}
    ${v ? `<span class="text-sm w-full">내 후기: ${SL[v.mood]} ${'★'.repeat(v.stars)}${(v.tags || []).length ? ' · ' + v.tags.map(esc).join(', ') : ''}${v.body ? ' — ' + esc(v.body) : ''}</span>` : ''}
    ${svc && client && v && v.mood === 'bad' && !w && c.status === 'completed' ? btn('rew', c.id, '재점검 신청') : ''}${w ? `<span class="text-sm font-bold text-cool w-full">재점검: ${RWL[w.status]}</span>` : ''}`;
}
function custMenu(keep) {
  if (!S.user) { openM(head('내 요청 관리') + `<p class="leading-relaxed text-sea/80">견적 요청, 계약, 판매글은 로그인 후 볼 수 있어요.</p><div class="mt-4">${btn('auth', '', '로그인 / 회원가입', 'a')}</div>`); return; }
  const my = myReqs(), ml = S.lst.filter(l => l.seller_id === me()), buys = S.con.filter(c => c.client_id === me() && c.kind !== 'service'), pre = S.thr.filter(t => t.contract_id == null && t.u1 === me());
  const nb = notifBtn() && my.length ? `<div class="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-sun/10 p-3 text-sm"><span>견적이 도착하면 바로 알려 드릴까요?</span>${notifBtn()}</div>` : '';
  openM(head('내 요청 관리') + nb + (my.length || ml.length || buys.length || pre.length ? '' : empty('아직 요청이 없어요. 무료 견적을 요청하거나 판매글을 올려 보세요.')) +
    (my.length ? '<h3 class="mt-2 font-bold">견적 요청</h3>' : '') + my.map(r => {
      const qs = S.quo.filter(q => q.request_id === r.id), c = conFor('request_id', r.id);
      return card(`<div class="flex justify-between gap-2"><p class="font-bold">${SVC[r.service]} · ${reqWhere(r)}${r.target_pro ? ' · <span class="text-sun">지정 요청</span>' : ''}</p><span class="text-xs rounded-full bg-mist px-2 py-1 h-fit shrink-0 whitespace-nowrap">${r.status === 'open' ? '견적 받는 중' : r.status === 'matched' ? '계약 완료' : '요청 마감'}</span></div>
        <p class="text-xs text-sea/60 mt-1">${reqCode(r.id)} · 희망일 ${esc(r.wish_date)} · 사진 ${(r.photos || []).length}장</p>
        <div class="mt-3 flex flex-wrap gap-2 items-center">${r.status === 'open' ? (qs.length ? btn('cmp', r.id, `받은 견적 ${qs.length}건 비교`) : '<span class="text-sm text-sea/60">기사님 견적을 기다리는 중이에요</span>') + btn('rclose', r.id, '요청 취소', 's') : conBlock(c)}</div>`);
    }).join('') +
    (ml.length ? '<h3 class="mt-6 font-bold">내 판매글</h3>' + ml.map(l => { const c = conFor('listing_id', l.id), n = S.off.filter(o => o.listing_id === l.id).length;
      return card(`<div class="flex justify-between gap-2"><p class="font-bold">${esc(l.title)} · ${won(l.price)}</p><span class="text-xs rounded-full bg-mist px-2 py-1 h-fit shrink-0 whitespace-nowrap">${l.status === 'open' ? '판매 중' : l.status === 'sold' ? '거래 체결' : '판매 종료'}</span></div>
        <div class="mt-3 flex flex-wrap gap-2 items-center">${l.status === 'open' ? btn('ldet', l.id, n ? `받은 제안 ${n}건 보기` : '판매글 보기', n ? 'p' : 's') : conBlock(c)}</div>`); }).join('') : '') +
    (buys.length ? '<h3 class="mt-6 font-bold">내 구매</h3>' + buys.map(c => card(`<p class="font-bold">${conTitle(c)} · ${esc(c.gu)}</p><div class="mt-3 flex flex-wrap gap-2 items-center">${conBlock(c)}</div>`)).join('') : '') +
    (pre.length ? '<h3 class="mt-6 font-bold">상담 채팅</h3>' + pre.map(t => card(`<div class="flex items-center justify-between gap-2"><p class="text-sm font-bold">${esc(t.u2_name)} 기사님</p>${btn('chat', t.id, '채팅방 열기', 's')}</div>`)).join('') : '') +
    `<h3 class="mt-6 font-bold">고객센터</h3>` + card(`<p class="text-sm text-sea/75">결제·기사·A/S 관련 궁금한 점을 1:1로 문의하고 처리 상태를 확인해요.</p><div class="mt-3 flex flex-wrap gap-2">${btn('inqnew', '', '✏️ 1:1 문의하기', 'a')}${btn('cs', '', `내 문의 내역${unreadN() ? ' · 새 답변 ' + unreadN() : ''}`, 's')}</div>`), keep);
  menuCur = 'cust';
}
async function rclose(el, rid) {
  await busy(el, async () => { const { error } = await sb.from('requests').update({ status:'closed' }).eq('id', +rid); if (error) throw error; await load('req'); render(); custMenu(true); toast('견적 요청을 취소했어요.'); });
}
function compare(rid, keep) {
  cmpCur = +rid;
  const r = S.req.find(x => x.id === +rid); if (!r) return;
  const qs = S.quo.filter(q => q.request_id === r.id).sort((a, b) => a.price - b.price);
  openM(head('받은 견적 비교') + `<p class="text-sm text-sea/70">${SVC[r.service]} · ${reqWhere(r)} · 계약하면 다른 견적은 자동 마감돼요.</p>` +
    (qs.map(q => { const p = proPub(q.pro_id) || { name:'기사', rating:0, rating_count:0 };
      return card(`<div class="flex items-start justify-between gap-3"><div><p class="font-bold">${esc(p.name)}</p><p class="text-sm text-cool font-bold">${prate(p)}</p>${p.bio ? `<p class="mt-1 text-xs text-sea/70">${esc(p.bio)}</p>` : ''}<div class="mt-1 flex flex-wrap gap-1.5">${pcerts(p)}</div>${p.free ? '<div class="mt-1">' + FREE_CHIP + '</div>' : ''}</div><p class="font-display text-2xl">${won(q.price)}</p></div>
      <p class="mt-2 text-sm">${esc(q.msg) || '메시지 없음'}</p><p class="text-xs text-sea/60 mt-1">작업 가능일 ${esc(q.visit)}</p>
      <div class="mt-3 flex flex-wrap gap-2">${btn('pq', q.pro_id, '프로필 보기', 's')}${r.status === 'open' ? btn('pick', q.id, '계약하기', 'a') : `<span class="text-sm font-bold">${QL[q.status]}</span>`}</div>`); }).join('') || `<div class="mt-3">${empty('아직 도착한 견적이 없어요.')}</div>`) + `<div class="mt-4">${btn('menu', '', '← 내 요청으로', 's')}</div>`, keep);
  menuCur = 'cmp';
}
async function pick(el, qid) {
  await busy(el, async () => {
    const r = await rpc('accept_quote', { p_quote:+qid });
    if (!r.ok) return toast('기사님의 예치금이 부족해 지금은 계약할 수 없어요. 다른 견적을 고르거나 잠시 후 다시 시도해 주세요.');
    await Promise.all(['req', 'quo', 'con', 'thr'].map(load)); render(); receipt(r.contract_id, true); toast('계약이 체결됐어요. 채팅방에서 기사님과 일정을 조율해 보세요.');
  });
}
function receipt(cid, fresh) {
  const c = S.con.find(x => x.id === +cid); if (!c) return;
  const svc = c.kind === 'service', provLabel = svc ? '담당 기사' : '판매자', cliLabel = svc ? '고객' : '구매자';
  openM(head('한여름 안심 작업 내역서') + `<div class="rounded-2xl bg-ice p-5"><p class="font-display text-xl text-cool">${conCode(c.id)}</p>
    <dl class="mt-3 text-sm">${row('발급일', fmtD(c.created_at))}${row(svc ? '서비스' : '품목', conTitle(c))}${row('지역', esc(place(c.gu)))}${row(provLabel, esc(c.provider_name))}${row(cliLabel, esc(c.client_name))}${c.work_date ? row(wdOf(c) + ' 예정일', esc(c.work_date)) : ''}${row('확정 금액', won(c.price))}
    ${c.fee_payer === me() || S.admin ? row('수수료 (기사·업체 예치금에서 차감)', `${won(c.fee)} · ${esc(c.fee_label)}${c.fee_charged ? ' · 차감 완료' : ' · 거래 확정 시 차감'}`) : ''}${row('상태', c.status === 'completed' ? '거래 확정 (' + esc(c.method || '') + ')' : c.status === 'pending' ? '확정 대기' : '진행 중')}</dl></div>
    <p class="mt-4 rounded-xl bg-cool/10 p-3 text-sm leading-relaxed">💬 전화번호를 공개하지 않고 한여름 채팅으로 연락해요.${svc ? '<br>작업 후 <b>14일 이내</b> 같은 증상이 생기면 담당 기사님의 우선 방문 재점검을 신청할 수 있어요.' : ''}</p>
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${wbtn('chatc', c.id, fresh ? '채팅방 열기' : '채팅방', 'p')}</div>`);
}
function warrModal(cid, fresh) {
  const c = S.con.find(x => x.id === +cid); if (!c || !c.warranty_no) return;
  const left = Math.max(0, Math.ceil((T(c.warranty_until) - Date.now()) / 864e5)), w = reworkOf(c.id), v = reviewOf(c.id), client = c.client_id === me();
  openM(head('한여름 무상 A/S 전자 보증서') + `<div class="relative rounded-2xl border-2 border-sea/15 bg-ice p-5">
    <span class="absolute right-4 top-4 grid h-20 w-20 -rotate-12 place-items-center rounded-full border-2 border-sun text-center font-display text-sm leading-tight text-sun" aria-hidden="true">한여름<br>안심보증</span>
    <p class="font-display text-xl text-cool pr-24">${esc(c.warranty_no)}</p>
    <dl class="mt-3 text-sm">${row('발급일', fmtD(c.done_at))}${row('서비스', SVC[c.service])}${row('지역', esc(place(c.gu)))}${row('담당 기사', esc(c.provider_name))}${row('작업 금액', won(c.price))}${row('확정 방식', esc(c.method))}${row('보증 기간', `${fmtD(c.done_at)} ~ ${fmtD(c.warranty_until)} (14일)`)}${row('작업 내역서', conCode(c.id))}</dl></div>
    <p class="mt-4 rounded-xl bg-cool/10 p-3 text-sm leading-relaxed">보증 기간 안에 <b>같은 증상</b>이 다시 생기면 담당 기사님이 <b>우선 방문해 무상으로 재점검</b>해요. <span class="font-bold text-cool">남은 기간 ${left}일</span><br><span class="text-xs text-sea/60">보증 범위는 작업 내역서에 적힌 작업과 같은 증상에 한해요.</span></p>
    ${w ? `<p class="mt-3 text-sm font-bold text-cool">재점검: ${RWL[w.status]}</p>` : ''}
    <div class="mt-4 flex flex-wrap gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${client && fresh && !v ? btn('rev', c.id, '후기 남기기', 's') : ''}${client && !w && left > 0 ? btn('rew', c.id, '무상 재점검 신청', 'a') : ''}</div>`);
}
async function confirmDeal(el, cid) {
  const c = S.con.find(x => x.id === +cid); if (!c) return;
  await busy(el, async () => {
    await rpc('confirm_contract', { p_contract:c.id });
    await Promise.all(['con', 'myRev'].map(load)); render();
    const nc = S.con.find(x => x.id === c.id) || c;
    if (nc.client_id === me() && nc.kind === 'service') { warrModal(nc.id, true); setTimeout(() => { if (!reviewOf(nc.id)) openRm(nc.id); }, 600); toast('거래가 확정됐어요. 무상 A/S 보증서가 발급됐어요.'); }
    else { closeM(); toast(nc.fee && nc.fee_payer === me() ? `거래가 확정됐어요. 수수료 ${won(nc.fee)}가 예치금에서 차감됐어요.` : '거래가 확정됐어요.'); }
  });
}

/* =====================================================================
   채팅
   ===================================================================== */
async function loadMsgs(tid) {
  const { data, error } = await sb.from('messages').select('*').eq('thread_id', tid).order('id', { ascending:true }).limit(500);
  if (error) throw error; S.msgs[tid] = data || [];
}
function onNewMessage(m) {
  const list = S.msgs[m.thread_id];
  if (list && !list.some(x => x.id === m.id)) list.push(m);
  if (chatCur === m.thread_id) chatModal(m.thread_id, true);
  else if (m.sender_id && m.sender_id !== me()) { const t = S.thr.find(x => x.id === m.thread_id); if (t) { const who = t.u1 === me() ? t.u2_name : t.u1_name, txt = m.kind === 'photo' ? '사진' : String(m.body).slice(0, 30); toast(`💬 ${who}: ${txt}`); phoneNote('새 메시지', `${who}: ${txt}`); } }
  if (!S.thr.some(t => t.id === m.thread_id)) queueLoad('thr');
}
const qa = (act, id, t) => `<button type="button" data-act="${act}" data-id="${id}" class="rounded-full border-2 border-mist bg-white px-3.5 py-2 text-xs sm:text-sm font-bold hover:bg-ice">${t}</button>`;
async function chatModal(tid, keep) {
  tid = +tid;
  let t = S.thr.find(x => x.id === tid);
  if (!t) { await load('thr'); t = S.thr.find(x => x.id === tid); if (!t) return toast('채팅방을 찾을 수 없어요.'); }
  if (!S.msgs[tid]) { try { await loadMsgs(tid); } catch (e) { return toast(errMsg(e)); } }
  const c = t.contract_id ? S.con.find(x => x.id === t.contract_id) : null, other = t.u1 === me() ? t.u2_name : t.u1_name, imCust = t.u1 === me();
  const i0 = $('#chat-in'), draft = keep && i0 ? i0.value : '', focused = keep && document.activeElement === i0;
  const acts = [qa('qphoto', tid, '📷 사진 보내기'), qa('qsched', tid, '📅 일정 변경 요청')];
  if (c) { if (c.status !== 'completed') acts.push(qa('cfin', c.id, c.kind === 'service' ? '✅ 거래 확정' : '✅ 거래 완료')); acts.push(qa('qreport', c.id, '🚨 분쟁/재점검 신고')); }
  else if (imCust) acts.push(qa('qdirect', tid, '📝 합의 내용으로 계약하기'));
  else acts.push(qa('qask', tid, '📝 계약 등록 요청'));
  openM(head('안심 채팅') + `<p class="text-xs text-sea/60">${c ? conCode(c.id) + ' · ' : ''}상대: ${esc(other)} · 전화번호는 공개되지 않아요</p>
    <div id="chatbox" class="mt-3 h-[42vh] min-h-[14rem] sm:h-72 overflow-y-auto rounded-2xl bg-ice p-3 space-y-2">${(S.msgs[tid] || []).map(m => m.kind === 'sys'
      ? `<p class="text-center text-xs text-sea/60">${esc(m.body)}</p>`
      : `<div class="flex ${m.sender_id === me() ? 'justify-end' : ''}"><div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.sender_id === me() ? 'bg-sea text-white' : 'bg-white'}">${m.photo && isPhotoUrl(m.photo) ? `<a href="${esc(m.photo)}" target="_blank" rel="noopener"><img src="${esc(m.photo)}" alt="보낸 사진" class="mb-1 block max-h-48 rounded-xl"></a>` : ''}${m.kind === 'photo' ? '' : esc(m.body)}<p class="mt-0.5 text-[10px] opacity-60">${fmtT(m.created_at)}</p></div></div>`).join('')}</div>
    <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="빠른 실행">${acts.join('')}<input id="chat-photo" type="file" accept="image/*" class="sr-only" tabindex="-1" aria-hidden="true"></div>
    <div class="mt-2 flex gap-2"><input id="chat-in" maxlength="1000" aria-label="메시지" placeholder="메시지를 입력하세요" class="min-w-0 flex-1 rounded-xl bg-ice px-4 py-3">${btn('csend', tid, '보내기')}</div>`);
  chatCur = tid;
  const b = $('#chatbox'); b.scrollTop = b.scrollHeight;
  const i1 = $('#chat-in'); i1.value = draft; if (keep ? focused : innerWidth >= 768) i1.focus();
}
async function chatOfContract(cid) {
  let t = S.thr.find(x => x.contract_id === +cid);
  if (!t) { await load('thr'); t = S.thr.find(x => x.contract_id === +cid); }
  if (!t) return toast('채팅방을 찾을 수 없어요.');
  chatModal(t.id);
}
async function csend(el, tid) {
  const i = $('#chat-in'), body = i.value.trim(); if (!body) return;
  await busy(el, async () => { const { error } = await sb.from('messages').insert({ thread_id:+tid, body }); if (error) throw error; i.value = ''; await loadMsgs(+tid); chatModal(+tid, true); $('#chat-in').focus(); });
}
async function sendChatPhoto(f) {
  const tid = chatCur; if (!tid || !f) return;
  toast('사진을 보내는 중이에요...');
  try { const url = await uploadPhoto(f); const { error } = await sb.from('messages').insert({ thread_id:tid, kind:'photo', body:'사진', photo:url }); if (error) throw error; await loadMsgs(tid); chatModal(tid, true); }
  catch (e) { toast(errMsg(e)); }
}
function directModal(tid) {
  const t = S.thr.find(x => x.id === +tid), p = proPub(t.u2) || { fields:[], areas:[] }, codes = (KINDS[p.kind] || KINDS.aircon).svcs.filter(c => c !== 'freezer_sale');
  const guess = codes[0];
  const inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5', lab = (f, x) => `<label for="${f}" class="block mt-4 text-sm font-bold">${x}</label>`;
  openM(head('합의 내용으로 계약하기') + `<p class="text-sm"><b>${esc(t.u2_name)}</b> 기사님과 채팅으로 합의한 내용을 계약으로 등록해요.</p>
    <p class="mt-2 rounded-xl bg-cool/10 p-3 text-xs leading-relaxed">등록하면 작업 내역서가 발급되고 계약 채팅방이 열려요.</p>
    ${lab('dc-svc', '서비스')}<select id="dc-svc" class="${inp}">${codes.map(c => `<option value="${c}"${c === guess ? ' selected' : ''}>${SVC[c]}</option>`).join('')}</select>
    ${lab('dc-gu', '작업 지역')}<select id="dc-gu" class="${inp}">${guOpts(GG_ALL, (p.areas || [])[0])}</select>
    ${lab('dc-date', '작업 날짜')}<input id="dc-date" type="date" min="${today()}" class="${inp}">
    ${lab('dc-price', '합의 금액(원)')}<input id="dc-price" type="number" min="1000" step="1000" inputmode="numeric" class="${inp}">${errBox()}
    <div class="mt-4 flex gap-3">${btn('chat', t.id, '취소', 's')}${wbtn('dsend', t.id, '계약 등록')}</div>`);
}
async function dsend(el, tid) {
  const t = S.thr.find(x => x.id === +tid), date = $('#dc-date').value, price = +$('#dc-price').value;
  if (!date || date < today()) return setErr('오늘 이후의 작업 날짜를 선택해 주세요.');
  if (!(price >= 1000)) return setErr('합의 금액을 입력해 주세요.');
  await busy(el, async () => {
    const r = await rpc('direct_contract', { p_pro:t.u2, p_service:$('#dc-svc').value, p_gu:$('#dc-gu').value, p_date:date, p_price:price });
    if (!r.ok) return setErr('기사님의 예치금이 부족해 지금은 계약할 수 없어요.');
    await Promise.all(['req', 'quo', 'con', 'thr'].map(load)); render(); receipt(r.contract_id, true); toast('계약이 등록됐어요.');
  });
}

/* =====================================================================
   후기 · 재점검 · 신고
   ===================================================================== */
let rv = null, rmCid = null, rmStars = 5;
function revModal(cid) {
  if (!rv || rv.cid !== +cid) rv = { cid:+cid, s:null, tags:[], other:'' };
  const list = rv.s ? [...TAGS[rv.s], '기타'] : [];
  openM(head('거래는 어떠셨나요?') + `<div class="grid grid-cols-3 gap-3">${Object.keys(SL).map(k => `<button type="button" data-act="rvs" data-id="${k}" aria-pressed="${rv.s === k}" class="rounded-2xl border-2 px-2 py-5 font-bold text-sm ${rv.s === k ? 'border-cool bg-mist' : 'border-mist hover:bg-ice'}">${SL[k]}</button>`).join('')}</div>
    ${rv.s ? `<p class="mt-5 text-sm font-bold">어떤 점이 그랬나요? (최대 3개)</p><div class="mt-2 flex flex-wrap gap-2">${list.map(t => `<button type="button" data-act="rvt" data-id="${esc(t)}" aria-pressed="${rv.tags.includes(t)}" class="rounded-full border-2 px-4 py-2 text-sm font-medium ${rv.tags.includes(t) ? 'border-cool bg-cool text-white' : 'border-mist hover:bg-ice'}">${t}</button>`).join('')}</div>` : '<p class="mt-5 text-sm text-sea/60">먼저 만족도를 선택해 주세요.</p>'}
    ${rv.tags.includes('기타') ? `<input id="rv-other" maxlength="50" value="${esc(rv.other)}" aria-label="기타 한 줄평" placeholder="한 줄로 알려주세요 (50자 이내)" class="mt-3 w-full rounded-xl bg-ice px-4 py-3">` : ''}${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">나중에</button>${wbtn('rvsend', rv.cid, '후기 남기기')}</div>`);
}
async function rvsend(el, cid) {
  const other = ($('#rv-other')?.value || '').trim();
  if (!rv.s) return setErr('만족도를 선택해 주세요.');
  if (!rv.tags.length) return setErr('태그를 1개 이상 선택해 주세요.');
  if (rv.tags.includes('기타') && !other) return setErr("'기타'를 고르면 한 줄평을 적어 주세요.");
  await busy(el, async () => {
    const bad = rv.s === 'bad';
    await rpc('submit_review', { p_contract:+cid, p_stars:null, p_mood:rv.s, p_tags:rv.tags.filter(t => t !== '기타'), p_body:other });
    rv = null; await Promise.all(['myRev', 'prosPub'].map(load)); render(); toast('후기를 남겼어요. 감사합니다!');
    bad ? rewModal(cid) : closeM();
  });
}
function openRm(cid) {
  rmCid = +cid; rmStars = 5; $('#rm-text').value = ''; paintStars(); $('#rm').classList.remove('hidden');
}
function paintStars() { $('#rm-stars').innerHTML = [1, 2, 3, 4, 5].map(i => `<button type="button" data-star="${i}" aria-label="${i}점" class="${i <= rmStars ? 'text-sun' : 'text-gray-300'}">★</button>`).join(''); }
async function rmSubmit() {
  const b = $('#rm-submit'); if (b.disabled) return; b.disabled = true;
  try {
    await rpc('submit_review', { p_contract:rmCid, p_stars:rmStars, p_mood:null, p_tags:[], p_body:$('#rm-text').value.trim() });
    $('#rm').classList.add('hidden'); await Promise.all(['myRev', 'prosPub'].map(load)); render(); toast('소중한 후기가 등록되었어요.');
    if (rmStars <= 2) rewModal(rmCid);
  } catch (e) { toast(errMsg(e)); } finally { b.disabled = false; }
}
function rewModal(cid) {
  const c = S.con.find(x => x.id === +cid); if (!c) return;
  const left = Math.max(0, Math.ceil((T(c.warranty_until) - Date.now()) / 864e5));
  openM(head('재점검을 도와드릴게요') + `<p class="leading-relaxed">작업 후 <b>14일 이내</b> 같은 증상이 있으면 담당 기사님(${esc(c.provider_name)})이 <b>우선 방문해 재점검</b>하도록 한여름이 연결해 드려요. <span class="text-cool font-bold">남은 기간 ${left}일</span></p>
    <label for="rw-sym" class="block mt-4 text-sm font-bold">어떤 문제가 있나요?</label>
    <textarea id="rw-sym" rows="3" maxlength="300" placeholder="예) 작업 후 실외기에서 소음이 나요." class="mt-2 w-full rounded-xl bg-ice px-4 py-3 resize-none"></textarea>${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">괜찮아요</button>${wbtn('rwsend', c.id, '우선 방문 재점검 신청')}</div>`);
}
async function rwsend(el, cid) {
  const sym = $('#rw-sym').value.trim(); if (!sym) return setErr('증상을 적어 주세요.');
  await busy(el, async () => { await rpc('request_rework', { p_contract:+cid, p_symptom:sym }); await load('rew'); render(); closeM(); toast('재점검을 신청했어요. 담당 기사님께 전달돼요.'); });
}
let rpFrom = 'chat';
function rpModal(cid, pre, from) {
  rpFrom = from || 'chat';
  const c = S.con.find(x => x.id === +cid); if (!c) return;
  const cust = c.client_id === me(), canRw = cust && c.kind === 'service' && c.status === 'completed';
  const def = pre || (canRw ? '재점검' : '분쟁');
  const reasons = cust ? ['작업 결과가 요청과 달라요', '같은 증상이 다시 생겼어요', '약속한 금액보다 더 요구해요', '연락이 되지 않아요', '기타'] : ['상대방과 연락이 되지 않아요', '작업 범위 밖의 추가 작업을 요구해요', '일정 변경이 반복돼요', '기타'];
  const radio = (v, t) => `<label class="relative"><input type="radio" name="rp-type" value="${v}" class="peer sr-only"${def === v ? ' checked' : ''}><span class="block rounded-2xl border-2 border-mist px-3 py-4 text-center text-sm font-bold cursor-pointer hover:bg-ice peer-checked:border-cool peer-checked:bg-mist">${t}</span></label>`;
  openM(head('분쟁·재점검 신고') + `<p class="text-sm text-sea/70">${esc(cust ? c.provider_name : c.client_name)}님과의 거래(${conCode(c.id)})에 대한 신고예요. 접수하면 관리자가 확인하고 고객센터로 답변드려요.</p>
    ${canRw ? `<fieldset class="mt-4"><legend class="text-sm font-bold">신고 유형</legend><div class="mt-2 grid grid-cols-2 gap-3">${radio('분쟁', '분쟁 신고')}${radio('재점검', '재점검 신청')}</div></fieldset>` : ''}
    <label for="rp-reason" class="block mt-4 text-sm font-bold">사유</label><select id="rp-reason" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5 font-medium">${reasons.map(r => `<option>${r}</option>`).join('')}</select>
    <label for="rp-detail" class="block mt-4 text-sm font-bold">상세 내용</label><textarea id="rp-detail" rows="3" maxlength="300" placeholder="상황을 구체적으로 적어 주세요." class="mt-2 w-full rounded-xl bg-ice px-4 py-3 resize-none"></textarea>
    ${c.status === 'pending' ? '<p class="mt-2 text-xs text-sea/60">분쟁으로 접수하면 자동 확정 타이머가 일시 정지돼요.</p>' : ''}${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('rpsend', c.id, '신고 접수')}</div>`);
}
async function rpsend(el, cid) {
  const type = document.querySelector('input[name="rp-type"]:checked')?.value || '분쟁', reason = $('#rp-reason').value, detail = $('#rp-detail').value.trim();
  await busy(el, async () => {
    const codeTxt = await rpc('report_issue', { p_contract:+cid, p_type:type, p_reason:reason, p_detail:detail });
    await Promise.all(['con', 'inq', 'rew'].map(load)); render(); toast(`${type === '재점검' ? '재점검 신청' : '신고'}을 접수했어요 (${codeTxt})`);
    if (rpFrom === 'chat') chatOfContract(cid); else if (S.mode === 'customer') custMenu(); else proMenu();
  });
}

/* =====================================================================
   기사·업체 대시보드
   ===================================================================== */
const stat = (k, v) => `<div class="rounded-2xl bg-white border border-mist p-4"><p class="text-sm text-sea/70">${k}</p><p class="font-display text-2xl sm:text-3xl mt-1">${v}</p></div>`;
const pendingCharge = () => S.chg.find(c => c.pro_id === me() && c.status === 'requested');
function proView() {
  const p = S.pro; if (!p) { $('#pview').innerHTML = empty('기사 정보를 불러오는 중이에요.'); return; }
  const on = p.online !== false, ok = p.approval === 'APPROVED';
  const kd = KINDS[p.kind] || KINDS.aircon;
  const top = `<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-bold text-brand">${kd.pro}${p.kind === 'truck' && p.ton ? ` · ${esc(p.ton)}${p.lift ? ' 리프트' : ''}` : ''}</p><h1 class="text-2xl font-black lg:text-3xl">${esc(p.name)} 기사님</h1><p class="mt-1 text-sm text-sub">${prate({ rating:p.rating_count ? p.rating_sum / p.rating_count : 0, rating_count:p.rating_count })}</p></div>
    <div class="flex flex-wrap items-center gap-2">${notifBtn()}${btn('mypage', '', '마이페이지', 's')}${btn('profedit', '', '프로필 수정', 's')}<button type="button" role="switch" aria-checked="${on}" data-act="online" class="inline-flex items-center gap-3 rounded-full px-5 py-2.5 font-bold ${on ? 'bg-cool text-white' : 'bg-mist'}">${on ? '영업중' : '휴무'}<span class="relative h-5 w-9 rounded-full bg-white/60" aria-hidden="true"><i class="absolute top-0.5 h-4 w-4 rounded-full ${on ? 'bg-white' : 'bg-sea/50'} transition-all" style="left:${on ? '1.125rem' : '.125rem'}"></i></span></button></div></div>`;
  if (!ok) {
    $('#pview').innerHTML = top + (p.approval === 'PENDING'
      ? `${bizDocCard(p)}<div class="mt-6 rounded-3xl bg-sun/10 p-6"><p class="font-bold text-sun text-lg">관리자 승인을 기다리고 있어요</p><p class="mt-2 text-sm leading-relaxed text-sea/80">${p.biz_doc ? '사업자등록증을 확인하고 있어요. 보통 1영업일 안에 승인돼요.' : '위에서 사업자등록증을 먼저 올려 주세요. 확인 후 승인해 드려요.'} 그동안 마이페이지에서 한 줄 소개·경력·포트폴리오를 채워 두면 고객에게 더 잘 보여요.</p><div class="mt-4 flex flex-wrap gap-2">${btn('mypage', '', '마이페이지 채우기', 'a')}${btn('inqnew', '', '고객센터 문의', 's')}</div></div>`
      : `<div class="mt-6 rounded-3xl bg-red-50 p-6"><p class="font-bold text-red-700 text-lg">기사 등록이 승인되지 않았어요</p><p class="mt-2 text-sm text-sea/80">자세한 내용은 고객센터로 문의해 주세요.</p><div class="mt-4">${btn('inqnew', '', '고객센터 문의', 'a')}</div></div>`);
    return;
  }
  const kind = p.kind || 'aircon';
  const open = S.req.filter(r => r.status === 'open' && r.customer_id !== me() && (r.target_pro === me() || (!r.target_pro && kindOf(r.service) === kind)))
    .sort((a, b) => ((b.target_pro === me()) - (a.target_pro === me())) || ((p.areas || []).includes(b.gu) - (p.areas || []).includes(a.gu)) || b.id - a.id);
  const mineQ = S.quo.filter(q => q.pro_id === me()), cons = S.con.filter(c => c.provider_id === me());
  const pc = pendingCharge();
  $('#pview').innerHTML = top + (on ? '' : '<p class="mt-4 rounded-xl bg-sun/15 p-3 text-sm font-bold text-sun">휴무 중에는 새 견적·매입 제안을 낼 수 없고, 기사찾기에 휴무로 표시돼요.</p>') + `
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-brand to-brand-800 p-6 text-white shadow-lg shadow-brand/30">
      <div><p class="text-sm text-white/70">선충전 예치금${p.balance < 3000 ? ' <span class="ml-2 rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-white">잔액 부족</span>' : ''}</p><p class="font-display text-4xl mt-1">${won(p.balance)}</p>${pc ? `<p class="mt-1 text-xs text-sun font-bold">충전 확인 중 · ${won(pc.amount)}</p>` : ''}</div>
      <div class="flex flex-wrap gap-2"><button type="button" data-act="wallet" class="rounded-2xl bg-white px-5 py-3 text-sm font-black text-brand">충전 · 내역</button></div></div>
    <p class="mt-2 text-xs text-sub">견적 제출은 무료예요. <b>거래가 확정될 때만</b> 에어컨·냉장냉동 수리·용달은 건당 3,000원, 냉장·냉동고 철거·재고 판매는 확정 금액의 5%(최대 10만 원)가 예치금에서 자동 차감돼요. 고객이 취소하면 차감되지 않아요.</p>
    ${p.low ? '<p class="mt-3 rounded-xl bg-sun/15 p-3 text-sm font-bold text-sun">예치금이 부족해 고객이 계약하지 못한 견적이 있어요. 충전하면 고객이 바로 계약할 수 있어요.</p>' : ''}
    <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">${stat('열린 요청', open.length + '건')}${stat('내가 낸 견적', mineQ.length + '건')}${stat('진행 중 계약', cons.filter(c => c.status !== 'completed').length + '건')}${stat('완료 거래', cons.filter(c => c.status === 'completed').length + '건')}</div>
    <h2 class="mt-10 text-2xl font-black">들어온 견적 요청</h2><p class="mt-1 text-sm text-sub">${kd.name} 분야 요청만 보여요. 나를 지정한 요청과 내 활동 지역 요청이 먼저 나와요.</p>
    <div class="mt-4 grid md:grid-cols-2 gap-4">${open.length ? open.map(proReq).join('') : empty('지금 열린 요청이 없어요. 새 요청이 들어오면 여기에 바로 떠요.')}</div>
    ${kind === 'cold' ? `<h2 class="mt-10 text-2xl font-black">중고 냉동·냉장고 매입</h2><p class="mt-1 text-sm text-sub">매입 제안은 무료이고 매입 수수료도 0원이에요.</p>
    <div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${S.lst.filter(l => l.status === 'open' && l.seller_id !== me()).map(proListing).join('') || empty('지금 올라온 판매글이 없어요.')}</div>
    <div class="mt-10 flex flex-wrap items-center justify-between gap-3"><h2 class="text-2xl font-black">내 재고 판매</h2>${btn('stockopen', '', '재고 판매글 올리기', 'a')}</div>
    <p class="mt-1 text-sm text-sub">보유 중인 중고 재고를 소비자나 다른 업체에 팔 수 있어요. 거래 확정 시 거래금액의 5%(건당 최대 10만 원)만 차감돼요.</p>
    <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">${S.lst.filter(l => l.seller_id === me() && l.kind === 'stock').map(lcard).join('') || `<div class="col-span-2">${empty('아직 올린 재고가 없어요.')}</div>`}</div>` : ''}`;
}
function proReq(r) {
  const my = S.quo.find(q => q.request_id === r.id && q.pro_id === me()), mine = (S.pro.areas || []).includes(r.gu);
  const k = KINDS[kindOf(r.service)];
  return `<article class="rounded-3xl bg-white p-5 shadow-card ${r.target_pro === me() ? 'ring-2 ring-sun' : mine ? 'ring-1 ring-brand-200' : ''}">
    <div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-3 py-1 text-sm font-bold ${k.color}">${SVC[r.service]}</span>${r.target_pro === me() ? '<span class="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-white">나를 지정한 요청</span>' : ''}${mine ? '<span class="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand">내 지역</span>' : ''}</div>
    <p class="mt-2 font-bold">${reqWhere(r)}</p><p class="text-sm text-sub">희망일 ${esc(r.wish_date)}</p>
    <p class="mt-3 leading-relaxed line-clamp-3 whitespace-pre-wrap">${esc(r.details) || '<span class="text-sea/50">세부 요청사항 없음</span>'}</p>
    ${(r.photos || []).length ? `<div class="mt-3 flex gap-2">${r.photos.slice(0, 5).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="고객 첨부 사진" loading="lazy" class="h-16 w-16 rounded-xl object-cover"></a>`).join('')}</div>` : ''}
    <p class="mt-3 text-xs text-sea/60">${reqCode(r.id)} · ${ago(r.created_at)} · 확정 시 수수료 ${feeNote(r.service)} · 제출은 무료</p>
    <div class="mt-3">${my ? `<span class="font-bold text-cool">내 견적 ${won(my.price)} · ${QL[my.status]}</span>` : btn('qopen', r.id, '무료 견적 제출', 'a')}</div></article>`;
}
function proListing(l) {
  const my = S.off.find(o => o.listing_id === l.id && o.buyer_id === me());
  return `<article class="overflow-hidden rounded-2xl bg-white border border-mist">${thumb(l)}<div class="p-4">
    <div class="flex flex-wrap items-center gap-1.5">${badge(l)}<span class="text-xs text-sea/60">${esc(place(l.gu))} · ${l.years}년 사용</span></div>
    <p class="mt-2 font-bold">${esc(l.title)}</p><p class="font-display text-2xl">${won(l.price)}</p>
    <p class="text-xs text-sea/60 mt-1">엘리베이터 ${yn(l.elev)} · 사다리차 ${l.ladder ? '가능' : '불가'}</p>
    <div class="mt-3 flex flex-wrap gap-2">${btn('ldet', l.id, '자세히', 's')}${my ? `<span class="self-center font-bold text-cool">내 제안 ${won(my.price)} · ${QL[my.status]}</span>` : btn('oopen', l.id, l.kind === 'stock' ? '구매 제안' : '매입 제안', 'a')}</div></div></article>`;
}
function quoteModal(rid) {
  const r = S.req.find(x => x.id === +rid), p = S.pro, need = calcFee(r.service, 1);
  if (p.online === false) return toast('휴무 중에는 견적을 낼 수 없어요. “영업중”으로 바꿔 주세요.');
  if (need > p.balance) return lowModal(need);
  openM(head('무료 견적 제출') + `<p class="text-sm"><b>${SVC[r.service]}</b> · ${reqWhere(r)} · 희망일 ${esc(r.wish_date)}</p>
    <p class="mt-3 rounded-xl bg-cool/10 p-3 text-sm leading-relaxed">견적 제출은 <b>무료</b>예요. 거래가 확정될 때만 수수료(${feeNote(r.service)})가 예치금에서 차감돼요.</p>
    <label for="qp" class="block mt-4 text-sm font-bold">견적 금액(원)</label><input id="qp" type="number" min="1000" step="1000" inputmode="numeric" placeholder="예) 90000" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5 font-medium">
    <label for="qd" class="block mt-4 text-sm font-bold">작업 가능일</label><input id="qd" type="date" min="${today()}" value="${esc(r.wish_date >= today() ? r.wish_date : today())}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5 font-medium">
    <label for="qmsg" class="block mt-4 text-sm font-bold">한 줄 메시지</label><input id="qmsg" maxlength="100" placeholder="예) 자재 포함 가격이고 당일 작업 가능해요." class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('qsend', r.id, '견적 제출하기')}</div>`);
}
async function qsend(el, rid) {
  const price = +$('#qp').value, visit = $('#qd').value, msg = $('#qmsg').value.trim();
  if (!(price >= 1000)) return setErr('견적 금액을 입력해 주세요.');
  if (!visit || visit < today()) return setErr('오늘 이후의 작업 가능일을 선택해 주세요.');
  await busy(el, async () => {
    const { error } = await sb.from('quotes').insert({ request_id:+rid, price, visit, msg });
    if (error) throw (error.code === '23505' ? new Error('이미 견적을 제출한 요청이에요.') : /row-level/.test(error.message) ? new Error('견적을 낼 수 없어요. 예치금·영업 상태·요청 마감 여부를 확인해 주세요.') : error);
    await load('quo'); closeM(); render(); toast('견적을 제출했어요. 고객이 계약하면 채팅방이 열려요.');
  });
}
function lowModal(need) {
  const b = S.pro.balance;
  openM(head('예치금이 부족해요') + `<p class="leading-relaxed">견적은 무료지만, 거래가 확정되면 수수료가 <b>예치금에서 자동 차감</b>돼요. 차감할 예치금이 있어야 견적을 낼 수 있어요.</p>
    <dl class="mt-4 rounded-2xl bg-ice p-5 text-sm">${row('현재 예치금', won(b))}${row('확정 시 차감액', won(need))}${row('부족한 금액', `<span class="text-sun">${won(Math.max(0, need - b))}</span>`)}</dl>
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">나중에</button>${wbtn('wallet', '', '예치금 충전하기')}</div>`);
}
function walletModal(keep) {
  if (!S.pro) return;
  const p = S.pro, pc = pendingCharge(), list = S.led.filter(l => l.pro_id === me()).slice(0, 20), bank = C.BANK || {};
  openM(head('선충전 예치금') + `<div class="rounded-2xl bg-sea p-5 text-white"><p class="text-sm text-white/70">현재 예치금</p><p class="font-display text-4xl mt-1">${won(p.balance)}</p></div>
    <p class="mt-3 text-sm text-sea/75 leading-relaxed">거래가 확정되면 수수료가 이 예치금에서 자동으로 차감돼요. 견적 제출과 매입 제안은 무료예요.</p>
    <h3 class="mt-5 font-bold">충전하기</h3>
    ${C.TOSS_CLIENT_KEY ? tossBlock() : pc ? `<p class="mt-2 rounded-xl bg-sun/10 p-4 text-sm"><b>${won(pc.amount)}</b> 충전 신청을 확인하고 있어요 (입금자명 ${esc(pc.depositor)}). 입금이 확인되면 바로 반영돼요.</p>` : `
    <ol class="mt-2 space-y-1 rounded-xl bg-ice p-4 text-sm"><li>1. 아래 계좌로 충전할 금액을 입금해요.</li><li class="font-bold">${esc(bank.name || '')} ${esc(bank.account || '')} (예금주 ${esc(bank.holder || '')})</li><li>2. 입금한 금액과 입금자명을 적고 충전 신청을 눌러요.</li><li>3. 관리자가 입금을 확인하면 예치금에 반영돼요.</li></ol>
    <fieldset class="mt-3"><legend class="text-sm font-bold">입금 금액</legend><div class="mt-2 grid grid-cols-2 gap-3">${[10000, 30000, 50000, 100000].map((a, i) => `<label class="relative"><input type="radio" name="ch-amt" value="${a}" class="peer sr-only"${i === 1 ? ' checked' : ''}><span class="block rounded-2xl border-2 border-mist px-3 py-4 text-center font-bold cursor-pointer hover:bg-ice peer-checked:border-cool peer-checked:bg-mist">${won(a)}</span></label>`).join('')}</div></fieldset>
    <label for="ch-name" class="block mt-3 text-sm font-bold">입금자명</label><input id="ch-name" maxlength="20" value="${esc(p.name)}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">${errBox()}
    <div class="mt-3">${btn('chargego', '', '입금했어요 · 충전 신청', 'a', 'w-full')}</div>`}
    <h3 class="mt-6 font-bold">예치금 내역</h3>${list.map(l => card(`<div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">${esc(l.text)}</p><p class="text-xs text-sea/60">${fmtT(l.created_at)} · 잔액 ${won(l.balance_after)}</p></div><p class="font-bold ${l.amount < 0 ? 'text-sun' : 'text-cool'}">${l.amount < 0 ? '−' : '+'}${won(Math.abs(l.amount))}</p></div>`)).join('') || `<div class="mt-2">${empty('아직 내역이 없어요.')}</div>`}`, keep);
  menuCur = 'wallet';
}
/* 토스페이먼츠: 결제가 승인되면 서버가 확인하고 예치금에 바로 넣어요 (관리자 승인 없음) */
let payMethod = 'CARD', tossBusy = false;
const PAY = { CARD:'카드 · 간편결제', TRANSFER:'계좌이체' };
const tossBlock = () => `<p class="mt-2 text-sm text-sea/75">결제가 끝나면 <b>바로</b> 예치금에 들어가요.</p>
  <fieldset class="mt-3"><legend class="text-sm font-bold">충전 금액</legend><div class="mt-2 grid grid-cols-2 gap-3">${[10000, 30000, 50000, 100000].map((a, i) => `<label class="relative"><input type="radio" name="ch-amt" value="${a}" class="peer sr-only"${i === 1 ? ' checked' : ''}><span class="block rounded-2xl border-2 border-mist px-3 py-4 text-center font-bold cursor-pointer hover:bg-ice peer-checked:border-cool peer-checked:bg-mist">${won(a)}</span></label>`).join('')}</div></fieldset>
  <fieldset class="mt-3"><legend class="text-sm font-bold">결제 수단</legend><div class="mt-2 grid grid-cols-2 gap-2">${Object.entries(PAY).map(([k, t]) => `<button type="button" data-act="paymeth" data-id="${k}" aria-pressed="${payMethod === k}" class="rounded-xl border-2 px-2 py-3 text-sm font-bold ${payMethod === k ? 'border-cool bg-mist' : 'border-mist hover:bg-ice'}">${t}</button>`).join('')}</div></fieldset>${errBox()}
  <div class="mt-3">${btn('tosspay', '', '토스페이먼츠로 결제하기', 'a', 'w-full')}</div><p class="mt-2 text-xs text-sea/60">카드·간편결제(토스페이·카카오페이 등)·계좌이체를 쓸 수 있어요. 결제 영수증은 토스페이먼츠에서 발급돼요.</p>`;
function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://js.tosspayments.com/v2/standard'; s.onload = res; s.onerror = () => rej(new Error('결제 모듈을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); document.head.appendChild(s); });
}
async function tossPay(el) {
  const amt = +(document.querySelector('input[name="ch-amt"]:checked') || {}).value;
  if (!amt) return setErr('충전 금액을 골라 주세요.');
  await busy(el, async () => {
    await loadTossSdk();
    const orderId = await rpc('create_charge_order', { p_amount:amt });
    const back = (C.SITE_URL || location.href).split(/[?#]/)[0];
    const req = { method:payMethod, amount:{ currency:'KRW', value:amt }, orderId, orderName:`한여름 예치금 충전 ${won(amt)}`, successUrl:back + '?toss=success', failUrl:back + '?toss=fail', customerEmail:S.user.email, customerName:S.pro.name };
    if (payMethod === 'CARD') req.card = { useEscrow:false, flowMode:'DEFAULT', useCardPoint:false, useAppCardOnly:false };
    await window.TossPayments(C.TOSS_CLIENT_KEY).payment({ customerKey:me() }).requestPayment(req);
  });
}
/* 결제창에서 돌아왔을 때: 서버(toss-confirm)가 토스에 승인 요청 → 성공하면 예치금 즉시 반영 */
async function handleTossReturn() {
  const q = new URLSearchParams(location.search), t = q.get('toss');
  if (!t || tossBusy) return; tossBusy = true;
  const clean = () => history.replaceState(null, '', location.pathname + location.hash);
  if (t === 'fail') { clean(); return toast(q.get('message') || '결제가 취소됐어요.'); }
  if (!S.user) { tossBusy = false; return toast('로그인하면 결제 확인을 이어서 할게요.'); }
  toast('결제를 확인하고 있어요...');
  const { data, error } = await sb.functions.invoke('toss-confirm', { body:{ paymentKey:q.get('paymentKey'), orderId:q.get('orderId'), amount:+q.get('amount') } });
  clean();
  let msg = data && data.message;
  if (!msg && error && error.context && error.context.json) { try { msg = (await error.context.json()).message; } catch (_) {} }
  if (error || !data || !data.ok) return toast(msg || '결제 확인에 실패했어요. 고객센터로 문의해 주세요.');
  await Promise.all([load('pro'), load('led')]);
  if (S.mode !== 'pro') setMode('pro'); else render();
  walletModal(); toast(`${won(data.amount)}이 예치금에 충전됐어요.`);
}
async function chargeGo(el) {
  const amt = +(document.querySelector('input[name="ch-amt"]:checked') || {}).value, name = $('#ch-name').value.trim();
  if (!name) return setErr('입금자명을 적어 주세요.');
  await busy(el, async () => { await rpc('request_charge', { p_amount:amt, p_depositor:name }); await load('chg'); walletModal(true); toast('충전 신청을 보냈어요. 입금이 확인되면 반영돼요.'); });
}
function proMenu(keep) {
  if (!S.pro) return;
  const qs = S.quo.filter(q => q.pro_id === me()), offs = S.off.filter(o => o.buyer_id === me()), cs = S.con.filter(c => c.provider_id === me() || (c.client_id === me() && c.kind === 'sale'));
  const pre = S.thr.filter(t => t.contract_id == null && t.u2 === me());
  openM(head('내 견적·계약 관리') + `<p class="font-bold">${esc(S.pro.name)}</p>
    ${pre.length ? '<h3 class="mt-4 font-bold">상담 채팅</h3>' + pre.map(t => card(`<div class="flex items-center justify-between gap-2"><p class="text-sm font-bold">${esc(t.u1_name)} 고객님</p>${btn('chat', t.id, '채팅방 열기', 's')}</div>`)).join('') : ''}
    <h3 class="mt-4 font-bold">진행 중인 계약 · 정산</h3>${cs.length ? cs.map(c => { const w = reworkOf(c.id), v = reviewOf(c.id), prov = c.provider_id === me();
      return card(`<p class="font-bold">${conTitle(c)} · ${esc(c.gu)} · ${won(c.price)}</p>
        <p class="text-xs text-sea/60">${conCode(c.id)} · ${esc(prov ? c.client_name : c.provider_name)} · ${c.status === 'completed' ? '완료' : c.status === 'pending' ? '고객 확인 대기' : wdOf(c) + ' 예정 ' + esc(c.work_date || '')}${c.fee_payer === me() ? ` · 수수료 ${won(c.fee)}${c.fee_charged ? ' 차감 완료' : ' (확정 시 차감)'}` : ''}</p>
        ${v ? `<p class="mt-1 text-sm">받은 후기: ${SL[v.mood]} ${'★'.repeat(v.stars)}${(v.tags || []).length ? ' · ' + v.tags.map(esc).join(', ') : ''}${v.body ? ' — ' + esc(v.body) : ''}</p>` : ''}
        ${c.status === 'pending' ? `<div class="mt-2 rounded-xl bg-sun/10 p-3 text-sm"><p class="font-bold text-sun">${c.paused ? '신고 접수 · 자동 확정 일시 정지' : '고객 확인 대기 중'}</p><p class="mt-1 text-xs text-sea/70">자동 확정까지</p><p class="font-display text-2xl tabular-nums" data-timer="${c.id}">${hms(remainMs(c))}</p><div class="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><i class="block h-full bg-sun" data-bar="${c.id}" style="width:${pctLeft(c)}%"></i></div></div>` : ''}
        ${c.warranty_no ? `<p class="mt-1 text-xs text-sea/60">무상 A/S 보증번호 ${esc(c.warranty_no)}</p>` : ''}
        <div class="mt-2 flex flex-wrap gap-2">${btn('rcpt', c.id, '내역서', 's')}${btn('chatc', c.id, '채팅방', 's')}${c.kind === 'service' && prov && c.status === 'confirmed' ? btn('done', c.id, '작업 완료 요청') : ''}${c.status !== 'completed' ? btn('cfin', c.id, c.kind === 'service' ? '✅ 거래 확정' : '✅ 거래 완료', 'a') : ''}
        ${w && w.status !== 'resolved' && prov ? btn('rwstep', c.id, `재점검: ${w.status === 'requested' ? '방문 일정 확정' : '재점검 완료'}`, 'a') : ''}${w && w.status === 'resolved' ? '<span class="text-sm font-bold text-cool">재점검 해결 완료</span>' : ''}</div>`); }).join('') : `<div class="mt-2">${empty('아직 계약이 없어요.')}</div>`}
    <h3 class="mt-6 font-bold">제출한 견적</h3>${qs.length ? qs.slice(0, 30).map(q => { const r = S.req.find(x => x.id === q.request_id); return card(`<p class="font-bold">${r ? SVC[r.service] + ' · ' + esc(r.gu) : reqCode(q.request_id)} · ${won(q.price)}</p><p class="text-xs text-sea/60">${QL[q.status]} · ${fmtT(q.created_at)}</p>`); }).join('') : `<div class="mt-2">${empty('제출한 견적이 없어요.')}</div>`}
    <h3 class="mt-6 font-bold">내 매입·구매 제안</h3>${offs.map(o => { const l = S.lst.find(x => x.id === o.listing_id); return card(`<p class="font-bold">${l ? esc(l.title) : '판매글'} · ${won(o.price)}</p><p class="text-xs text-sea/60">${QL[o.status]}</p>`); }).join('') || `<div class="mt-2">${empty('제출한 제안이 없어요.')}</div>`}
    <div class="mt-6">${btn('cs', '', '고객센터 · 내 문의', 's')}</div>`, keep);
  menuCur = 'pro';
}
async function doneReq(el, cid) {
  await busy(el, async () => { await rpc('request_completion', { p_contract:+cid }); await load('con'); render(); proMenu(true); toast(`작업 완료를 요청했어요. 고객이 확인하지 않으면 ${S.autoH}시간 뒤 자동 확정돼요.`); });
}
async function rwStep(el, cid) {
  await busy(el, async () => { await rpc('advance_rework', { p_contract:+cid }); await load('rew'); proMenu(true); });
}
async function toggleOnline(el) {
  await busy(el, async () => { const v = S.pro.online === false; const { error } = await sb.from('pros').update({ online:v }).eq('id', me()); if (error) throw error; S.pro.online = v; render(); toast(v ? '영업중으로 바꿨어요.' : '휴무로 바꿨어요.'); });
}
async function savePro(patch) { const { error } = await sb.from('pros').update(patch).eq('id', me()); if (error) throw error; Object.assign(S.pro, patch); }
function mypageModal(keep) {
  const p = S.pro, inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3';
  openM(head('마이페이지') + `<p class="text-sm text-sea/70">기사찾기와 받은 견적에서 고객에게 보이는 내용이에요.</p>
    <h3 class="mt-5 font-bold">한 줄 소개</h3>
    <label for="mp-bio" class="sr-only">한 줄 소개</label><input id="mp-bio" maxlength="60" value="${esc(p.bio || '')}" placeholder="고객에게 가장 먼저 보이는 한 문장" class="${inp}">
    <div class="mt-2">${btn('mpbio', '', '한 줄 소개 저장', 's')}</div>
    <h3 class="mt-6 font-bold">경력</h3>
    <ul class="mt-2 space-y-2">${(p.career || []).map((c, i) => `<li class="flex items-start gap-3 rounded-xl bg-ice px-4 py-3 text-sm"><span class="w-24 shrink-0 font-bold text-cool">${esc(c.y)}</span><span class="min-w-0 flex-1">${esc(c.t)}</span><button type="button" data-act="mpcrm" data-id="${i}" aria-label="경력 삭제" class="h-6 w-6 shrink-0 rounded-full text-lg leading-none hover:bg-white">&times;</button></li>`).join('') || '<li class="text-sm text-sea/60">아직 등록한 경력이 없어요.</li>'}</ul>
    <div class="mt-2 grid grid-cols-[6.5rem_1fr_auto] gap-2"><input id="mp-cy" maxlength="16" aria-label="경력 기간" placeholder="기간" class="min-w-0 rounded-xl bg-ice px-3 py-3"><input id="mp-ct" maxlength="60" aria-label="경력 내용" placeholder="한 일, 근무처" class="min-w-0 rounded-xl bg-ice px-3 py-3">${btn('mpcadd', '', '+ 추가', 's')}</div>
    <h3 class="mt-6 font-bold">포트폴리오</h3>
    <ul class="mt-2 grid grid-cols-2 gap-3">${(p.portfolio || []).map((x, i) => portCard(p, x, `<button type="button" data-act="mpprm" data-id="${i}" aria-label="포트폴리오 삭제" class="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-white text-lg leading-none">&times;</button>`)).join('') || '<li class="col-span-2 text-sm text-sea/60">아직 등록한 작업이 없어요. 실제 시공 사진을 올리면 선택받기 쉬워요.</li>'}</ul>
    <input id="mp-pt" maxlength="40" aria-label="작업 제목" placeholder="작업 제목" class="${inp}"><input id="mp-pn" maxlength="60" aria-label="작업 설명" placeholder="설명 (선택)" class="${inp}">
    <div class="mt-2 flex gap-2"><input id="mp-pf" type="file" accept="image/*" aria-label="작업 사진" class="min-w-0 flex-1 rounded-xl bg-ice px-3 py-2.5 text-sm">${btn('mppadd', '', '+ 추가', 's')}</div>${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${S.pro.approval === 'APPROVED' ? wbtn('pdetme', '', '고객에게 보이는 프로필') : ''}</div>`, keep);
}
let pe = null;
function profModal() {
  const p = S.pro; pe = { certs:new Set(p.certs || []), areas:new Set(p.areas || []), free:!!p.free, kind:p.kind || 'aircon', subs:new Set((p.fields || []).filter(f => (KINDS[p.kind || 'aircon'].subs).includes(f))), ton:p.ton || '', lift:!!p.lift };
  openM(head('프로필 수정') + `<label for="pe-name" class="block text-sm font-bold">상호명 / 기사명</label><input id="pe-name" maxlength="30" value="${esc(p.name)}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
    <div id="pe-spec">${specHTML(pe, 'pe')}</div>
    ${credBlock(pe.certs, 'pecert')}${freeToggle(pe.free, 'pefree')}
    <p class="mt-4 text-sm font-bold">활동 가능 지역</p>${areaGrid(pe.areas, 'pearea')}${bizDocCard(p)}${errBox()}
    <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('pesave', '', '저장하기')}</div>`);
  menuCur = 'prof';
}
async function peSave(el) {
  const name = $('#pe-name').value.trim();
  if (!name) return setErr('상호명 또는 기사명을 입력해 주세요.');
  specRead(pe, 'pe'); if (specErr(pe)) return setErr(specErr(pe));
  if (!pe.areas.size) return setErr('활동 가능 지역을 1곳 이상 선택해 주세요.');
  await busy(el, async () => { await savePro({ name, kind:pe.kind, ton:pe.kind === 'truck' ? pe.ton : null, lift:pe.kind === 'truck' && pe.lift, fields:specFields(pe), areas:[...pe.areas], certs:[...pe.certs].slice(0, 20), free:pe.free }); closeM(); render(); toast('프로필을 저장했어요.'); });
}

/* =====================================================================
   고객센터 (1:1 문의 · 알림)
   ===================================================================== */
let csTab = 'list', openInq = null, iq = { cat:'PAYMENT', cid:'', issue:'NO_SHOW', title:'', body:'' };
const stBadge = s => `<span class="rounded-full px-2.5 py-0.5 text-xs font-bold ${IST_CLS[s]}">${IST[s]}</span>`;
const conLabel = c => `${conCode(c.id)} · ${c.kind === 'service' ? SVC[c.service] : c.title} · ${c.client_id === me() ? c.provider_name : c.client_name} (${c.status === 'completed' ? '완료' : c.status === 'pending' ? '확인 대기' : '진행 중'})`;
function csModal(tab, keep) {
  if (tab) csTab = tab;
  const contact = [C.CS_PHONE ? `📞 ${esc(C.CS_PHONE)}` : '', C.CS_EMAIL ? `✉️ ${esc(C.CS_EMAIL)}` : ''].filter(Boolean).join(' · ');
  if (!S.user) return openM(head('고객센터') + `<p class="leading-relaxed text-sea/80">1:1 문의와 처리 상태 조회는 로그인 후 이용할 수 있어요.</p>${contact ? `<p class="mt-2 text-sm text-sea/70">${contact}</p>` : ''}<div class="mt-4">${btn('auth', '', '로그인 / 회원가입', 'a')}</div>`);
  const list = S.inq.filter(i => i.user_id === me()), nts = S.ntf, unread = unreadN();
  const tabB = (k, t, n) => `<button type="button" data-act="cstab" data-id="${k}" aria-pressed="${csTab === k}" class="${chipCls(csTab === k)}">${t}${n ? ` <span class="ml-1 rounded-full bg-sun px-1.5 text-white">${n}</span>` : ''}</button>`;
  const body = csTab === 'list'
    ? (list.length ? list.map(i => card(`<div class="flex flex-wrap items-center justify-between gap-2"><p class="font-bold">${CAT_ICON[i.cat]} ${esc(i.title)}</p>${stBadge(i.status)}</div>
        <p class="mt-1 text-xs text-sea/60">${inqCode(i.id)} · ${CAT[i.cat]} · ${fmtT(i.created_at)}${i.unread ? ' · <b class="text-sun">새 답변</b>' : ''}</p><div class="mt-3">${btn('inqdet', i.id, '상세 보기', 's')}</div>`)).join('') : `<div class="mt-3">${empty('아직 문의 내역이 없어요.')}</div>`)
    : (nts.length ? nts.map(n => card(`<p class="text-sm font-bold">${n.read ? '' : '<span class="mr-1 text-sun">●</span>'}${esc(n.title)}</p><p class="mt-1 text-xs text-sea/70">${esc(n.body)}</p><p class="mt-1 text-xs text-sea/50">${fmtT(n.created_at)}</p>${n.inquiry_id ? `<div class="mt-2">${btn('inqdet', n.inquiry_id, '문의 보기', 's')}</div>` : ''}`)).join('') : `<div class="mt-3">${empty('받은 알림이 없어요.')}</div>`);
  openM(head('고객센터') + `<div class="rounded-2xl bg-ice p-4"><p class="font-bold">무엇을 도와드릴까요?</p><p class="mt-1 text-sm text-sea/70">결제·기사·A/S 관련 궁금한 점을 남겨 주시면 <b>하루 안에</b> 담당자가 직접 답변드려요.</p>${contact ? `<p class="mt-1 text-xs text-sea/60">${contact}</p>` : ''}<div class="mt-3">${btn('inqnew', '', '✏️ 1:1 문의하기', 'a')}</div></div>
    <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="고객센터 메뉴">${tabB('list', '내 문의 내역', unread)}${tabB('ntf', '알림', nts.filter(n => !n.read).length)}</div>${body}`, keep);
  menuCur = 'cs';
}
function saveIq() { [['cid', 'iq-cid'], ['issue', 'iq-issue'], ['title', 'iq-title'], ['body', 'iq-body']].forEach(([k, id]) => { const el = $('#' + id); if (el) iq[k] = el.value; }); }
const eligibleCons = cat => myCons().filter(c => cat !== 'AS_REINSPECT' || (c.kind === 'service' && c.status === 'completed' && Date.now() - T(c.done_at) <= 14 * 864e5));
function inqForm(reset) {
  if (needLogin('문의는 로그인 후 남길 수 있어요.')) return;
  if (reset) iq = { cat:'PAYMENT', cid:'', issue:'NO_SHOW', title:'', body:'' };
  const needC = iq.cat !== 'ETC', cons = eligibleCons(iq.cat), inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5', lab = (f, t) => `<label for="${f}" class="block mt-4 text-sm font-bold">${t}</label>`;
  if (needC && !cons.some(c => String(c.id) === String(iq.cid))) iq.cid = cons[0] ? String(cons[0].id) : '';
  const catB = k => `<button type="button" data-act="iqcat" data-id="${k}" aria-pressed="${iq.cat === k}" class="rounded-2xl border-2 px-3 py-4 text-sm font-bold ${iq.cat === k ? 'border-cool bg-mist' : 'border-mist hover:bg-ice'}"><span aria-hidden="true">${CAT_ICON[k]}</span> ${CAT[k]}</button>`;
  openM(head('1:1 문의하기') + `<fieldset><legend class="text-sm font-bold">문의 유형</legend><div class="mt-2 grid grid-cols-2 gap-3">${Object.keys(CAT).map(catB).join('')}</div></fieldset>
    ${needC ? `${lab('iq-cid', '관련 계약')}${cons.length ? `<select id="iq-cid" class="${inp}">${cons.map(c => `<option value="${c.id}"${String(iq.cid) === String(c.id) ? ' selected' : ''}>${esc(conLabel(c))}</option>`).join('')}</select>` : `<p class="mt-2 rounded-xl bg-sun/10 p-3 text-sm text-sea/80">${iq.cat === 'AS_REINSPECT' ? '작업 완료 후 14일 이내의 계약이 없어요. 기간이 지났다면 “기타”로 문의해 주세요.' : '문의할 수 있는 계약이 없어요. 계약과 무관한 내용은 “기타”로 남겨 주세요.'}</p>`}` : ''}
    ${iq.cat === 'PRO_ISSUE' ? `${lab('iq-issue', '어떤 문제가 있었나요?')}<select id="iq-issue" class="${inp}">${Object.entries(ISSUE).map(([k, t]) => `<option value="${k}"${iq.issue === k ? ' selected' : ''}>${t}</option>`).join('')}</select>` : ''}
    ${lab('iq-title', '제목 (5~100자)')}<input id="iq-title" maxlength="100" value="${esc(iq.title)}" class="${inp}">
    ${lab('iq-body', '내용 (10~2,000자)')}<textarea id="iq-body" rows="5" maxlength="2000" class="${inp} resize-none" placeholder="상황을 구체적으로 적어 주세요. 날짜와 시간, 금액이 있으면 함께 알려 주세요.">${esc(iq.body)}</textarea>
    ${lab('iq-f', '사진 첨부 (선택 · 최대 5장)')}<input id="iq-f" type="file" accept="image/*" multiple class="${inp} text-sm">${errBox()}
    <div class="mt-4 flex gap-3">${btn('cs', '', '취소', 's')}${wbtn('inqsend', '', '문의 접수하기')}</div>`);
}
async function inqSend(el) {
  saveIq(); const needC = iq.cat !== 'ETC', title = iq.title.trim(), body = iq.body.trim(), files = [...($('#iq-f').files || [])];
  if (needC && !iq.cid) return setErr('관련 계약을 선택해 주세요.');
  if (title.length < 5) return setErr('제목은 5자 이상 입력해 주세요.');
  if (body.length < 10) return setErr('내용은 10자 이상 입력해 주세요.');
  if (files.length > 5) return setErr('사진은 최대 5장까지 올릴 수 있어요.');
  await busy(el, async () => {
    const photos = await uploadAll(files);
    const c = await rpc('create_inquiry', { p_cat:iq.cat, p_issue:iq.cat === 'PRO_ISSUE' ? iq.issue : null, p_contract:needC ? +iq.cid : null, p_title:title, p_body:body, p_photos:photos });
    await load('inq'); render();
    openM(head('문의가 접수됐어요') + `<div class="rounded-2xl bg-ice p-5 text-center"><p class="text-sm text-sea/70">문의 번호</p><p class="font-display text-3xl mt-1">${esc(c)}</p></div>
      <p class="mt-4 text-sm leading-relaxed text-sea/80">담당자가 내용을 확인하고 <b>하루(24시간) 안에</b> 답변드려요. 노쇼·분쟁처럼 급한 건은 먼저 처리해요. 답변이 등록되면 고객센터 알림으로 알려드려요.</p>
      <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${wbtn('cs', '', '내 문의 내역')}</div>`);
  });
}
async function inqMsgs(id, force) {
  if (!S.inqMsgs[id] || force) { const { data, error } = await sb.from('inquiry_msgs').select('*').eq('inquiry_id', id).order('id'); if (error) throw error; S.inqMsgs[id] = data || []; }
  return S.inqMsgs[id];
}
async function inqDetail(id, keep) {
  id = +id; const i = S.inq.find(x => x.id === id); if (!i) return csModal();
  let msgs; try { msgs = await inqMsgs(id, keep); } catch (e) { return toast(errMsg(e)); }
  if (i.unread && i.user_id === me()) { rpc('mark_inquiry_read', { p_inquiry:id }).then(() => Promise.all([load('inq'), load('ntf')])).then(render).catch(() => {}); }
  const steps = ['RECEIVED', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'], idx = steps.indexOf(i.status);
  const at = s => ({ RECEIVED:i.created_at, IN_PROGRESS:i.t_in, ANSWERED:i.t_ans, CLOSED:i.t_close })[s];
  const bar = `<ol class="grid grid-cols-4 gap-1 text-center text-xs">${steps.map((s, k) => `<li><span class="mx-auto grid h-7 w-7 place-items-center rounded-full font-bold ${k <= idx ? 'bg-cool text-white' : 'bg-mist text-sea/50'}">${k + 1}</span><p class="mt-1 font-bold ${k <= idx ? '' : 'text-sea/50'}">${IST[s]}</p><p class="text-sea/50">${k <= idx && at(s) ? fmtT(at(s)) : ''}</p></li>`).join('')}</ol>`;
  const mh = msgs.map(m => m.kind === 'ANSWER'
    ? `<div class="mr-8 rounded-2xl rounded-tl-sm bg-sea p-4 text-white"><p class="text-xs text-white/70">한여름 고객센터 · ${fmtT(m.created_at)}</p><p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">${esc(m.body)}</p></div>`
    : `<div class="ml-8 rounded-2xl rounded-tr-sm bg-mist p-4"><p class="text-xs text-sea/60">${m.kind === 'FOLLOWUP' ? '추가 문의' : '내 문의'} · ${fmtT(m.created_at)}</p><p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">${esc(m.body)}</p>${(m.photos || []).length ? `<div class="mt-2 flex flex-wrap gap-2">${m.photos.filter(isPhotoUrl).map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="첨부 사진" class="h-16 w-16 rounded-lg object-cover"></a>`).join('')}</div>` : ''}</div>`).join('');
  const canFu = i.status === 'ANSWERED' && Date.now() - T(i.t_ans) <= FOLLOW;
  openM(head(inqCode(i.id)) + `<div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-ice px-2.5 py-0.5 text-xs font-bold">${CAT_ICON[i.cat]} ${CAT[i.cat]}${i.issue ? ' · ' + ISSUE[i.issue] : ''}</span>${stBadge(i.status)}</div>
    <p class="mt-2 font-bold">${esc(i.title)}</p>${i.contract_id ? `<p class="text-xs text-sea/60">관련 계약 ${conCode(i.contract_id)}</p>` : ''}
    <div class="mt-4">${bar}</div><div class="mt-4 space-y-3">${mh}</div>
    ${canFu ? `<label for="fu-body" class="block mt-4 text-sm font-bold">추가 문의 <span class="font-normal text-sea/60">(답변 후 7일 이내)</span></label><textarea id="fu-body" rows="3" maxlength="2000" class="mt-2 w-full rounded-xl bg-ice px-4 py-3 resize-none"></textarea>${errBox()}<div class="mt-2">${btn('inqfu', i.id, '추가 문의 보내기', 'a')}</div>` : ''}
    ${i.status === 'CLOSED' ? '<p class="mt-4 rounded-xl bg-ice p-3 text-sm">종결된 문의예요. 이어서 궁금한 점은 새 문의로 접수해 주세요.</p>' : ''}
    <div class="mt-4 flex flex-wrap gap-3">${btn('cs', '', '목록으로', 's')}${i.status === 'CLOSED' ? btn('inqnew', '', '새 문의하기', 'a') : ''}${i.status === 'RECEIVED' && !i.live ? btn('inqdel', i.id, '문의 취소', 's') : ''}</div>`, keep);
  openInq = id;
}
async function inqFollow(el, id) {
  const body = ($('#fu-body').value || '').trim(); if (body.length < 5) return setErr('내용을 5자 이상 입력해 주세요.');
  await busy(el, async () => { await rpc('add_followup', { p_inquiry:+id, p_body:body }); await load('inq'); delete S.inqMsgs[+id]; inqDetail(id); toast('추가 문의를 보냈어요.'); });
}
async function inqDel(el, id) {
  await busy(el, async () => { await rpc('cancel_inquiry', { p_inquiry:+id }); await load('inq'); render(); csModal(); toast('문의를 취소했어요.'); });
}

/* =====================================================================
   관리자 (admins 표의 이메일로 인증된 계정만 — 서버에서도 매번 검사해요)
   ===================================================================== */
let AF = 'ALL';
const slaOver = i => { const t = Date.now(), c = T(i.created_at); return (i.status === 'RECEIVED' && t - c > SLA_START) || ((i.status === 'RECEIVED' || i.status === 'IN_PROGRESS') && t - c > SLA_ANS); };
/* 관리자: 방문 통계 카드 */
let VS = null, vsAt = 0;
function loadVisits(force) {
  if (!S.admin || (!force && Date.now() - vsAt < 60000)) return;
  vsAt = Date.now();
  rpc('admin_visit_stats', { p_days:14 }).then(d => { VS = d; if (S.mode === 'admin') adminView(); }).catch(() => { VS = { err:true }; if (S.mode === 'admin') adminView(); });
}
function visitCard() {
  loadVisits();
  const box = b => `<section class="mt-8 rounded-3xl border border-mist bg-white p-5 sm:p-6"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="text-xl font-bold">방문 통계</h2><span class="text-xs text-sea/50">운영자 본인 방문은 빼고 세요 · 최근 14일</span></div>${b}</section>`;
  if (!VS) return box('<p class="mt-3 text-sm text-sea/60">불러오는 중...</p>');
  if (VS.err) return box('<p class="mt-3 rounded-xl bg-sun/10 p-3 text-sm">방문 통계를 불러오지 못했어요. Supabase에서 <b>update_03.sql</b>을 실행했는지 확인해 주세요.</p>');
  const days = VS.daily || [], mx = Math.max(1, ...days.map(d => d.visitors)), last = days.length - 1;
  const bars = days.map((d, i) => { const h = Math.round(d.visitors / mx * 100), dd = String(d.day).slice(8, 10); return `<div class="flex min-w-0 flex-1 flex-col items-center gap-1" title="${esc(String(d.day))} 방문자 ${d.visitors}명 · 조회 ${d.views}회"><span class="text-[10px] tabular-nums ${i === last ? 'font-bold text-sea' : 'text-sea/50'}">${d.visitors || ''}</span><div class="flex h-24 w-full items-end"><div class="w-full rounded-t ${i === last ? 'bg-cool' : 'bg-cool/35'}" style="height:${d.visitors ? Math.max(h, 4) : 0}%"></div></div><span class="text-[10px] tabular-nums text-sea/50">${+dd}</span></div>`; }).join('');
  const pg = VS.pages || {}, refs = VS.refs || [];
  const mini = (t, v, sub) => `<div class="rounded-2xl bg-ice p-3"><p class="text-xs text-sea/60">${t}</p><p class="mt-0.5 font-display text-2xl tabular-nums">${v}</p>${sub ? `<p class="text-[11px] text-sea/50">${sub}</p>` : ''}</div>`;
  return box(`<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">${mini('오늘 방문자', (VS.today_visitors || 0) + '명', `조회 ${VS.today_views || 0}회`)}${mini('최근 7일 방문자', (VS.week_visitors || 0) + '명')}${mini('휴대폰으로 방문', (VS.mobile_pct || 0) + '%')}${mini('앱으로 설치해 사용', (VS.app_pct || 0) + '%', `새 설치 ${VS.week_install || 0}명`)}</div>
    <div class="mt-5 flex items-end gap-1" role="img" aria-label="최근 14일 하루 방문자 수">${bars}</div>
    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <div><h3 class="text-sm font-bold">어디서 왔나요 (7일)</h3><ul class="mt-2 space-y-1 text-sm">${refs.length ? refs.map(r => `<li class="flex justify-between gap-3"><span class="truncate">${esc(r.ref)}</span><b class="tabular-nums">${r.n}명</b></li>`).join('') : '<li class="text-sea/50">아직 기록이 없어요</li>'}</ul><p class="mt-2 text-[11px] leading-relaxed text-sea/50">홍보 링크 끝에 <b>?from=이름</b>을 붙이면 여기에 따로 보여요. 예) hanyeoreum-kr.github.io/?from=당근</p></div>
      <div><h3 class="text-sm font-bold">최근 7일 실제 행동</h3><ul class="mt-2 space-y-1 text-sm"><li class="flex justify-between"><span>견적 요청</span><b class="tabular-nums">${VS.week_quote || 0}건</b></li><li class="flex justify-between"><span>회원가입</span><b class="tabular-nums">${VS.week_signup || 0}명</b></li><li class="flex justify-between"><span>판매글 등록</span><b class="tabular-nums">${VS.week_listing || 0}건</b></li><li class="flex justify-between text-sea/60"><span>장터 · 기사찾기 화면 조회</span><b class="tabular-nums">${pg.market || 0} · ${pg.pros || 0}회</b></li></ul></div>
    </div>`);
}
function adminView() {
  if (!S.admin) { $('#pview').innerHTML = ''; return; }
  const open = S.inq.filter(i => i.status === 'RECEIVED' || i.status === 'IN_PROGRESS').length, over = S.inq.filter(slaOver).length, wait = S.con.filter(c => c.status === 'pending').length;
  const pend = S.adminPros.filter(p => p.approval === 'PENDING'), chg = S.chg.filter(c => c.status === 'requested');
  const day = new Date().toDateString(), fee = S.inc.filter(l => new Date(l.created_at).toDateString() === day).reduce((s, l) => s + l.amount, 0), feeAll = S.inc.reduce((s, l) => s + l.amount, 0);
  const proName = id => (S.adminPros.find(p => p.id === id) || {}).name || '기사';
  const list = AF === 'ALL' ? S.inq : S.inq.filter(i => i.status === AF), cnt = s => S.inq.filter(i => i.status === s).length;
  const fchip = (k, t, n) => `<button type="button" data-act="ifilt" data-id="${k}" aria-pressed="${AF === k}" class="${chipCls(AF === k)}">${t} ${n}</button>`;
  const cst = c => c.status === 'completed' ? '완료' : c.status === 'pending' ? `확인 대기 · <span class="tabular-nums" data-timer="${c.id}">${hms(remainMs(c))}</span>${c.paused ? ' (정지)' : ''}` : '진행 중';
  $('#pview').innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-3"><div><h1 class="font-display text-3xl sm:text-4xl">관리자 대시보드</h1><p class="mt-1 text-sm text-sea/70">한여름 운영 · ${esc(S.user.email)}</p></div><div class="flex flex-wrap gap-2">${notifBtn()}${btn('refresh', '', '새로고침', 's')}</div></div>
    <div class="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">${stat('처리 대기 민원', open + '건')}${stat('응답 기한 초과', over + '건')}${stat('확정 대기 계약', wait + '건')}${stat('승인 대기 기사', pend.length + '명')}${stat('충전 확인 대기', chg.length + '건')}${stat('오늘 수수료', won(fee))}</div>
    ${delCard()}${visitCard()}

    <div class="mt-8 grid lg:grid-cols-2 gap-6">
      <section class="rounded-3xl border border-mist bg-white p-6"><h2 class="text-xl font-bold">예치금 충전 확인</h2><p class="mt-1 text-sm text-sea/70">통장에 입금된 걸 확인한 뒤 승인하세요. 승인하면 바로 기사 예치금에 더해져요.</p>
        ${chg.map(c => card(`<div class="flex flex-wrap items-start justify-between gap-2"><div><p class="font-bold">${esc(proName(c.pro_id))} · ${won(c.amount)}</p><p class="text-xs text-sea/60">입금자명 ${esc(c.depositor)} · ${fmtT(c.created_at)}</p></div><div class="flex gap-2">${btn('chgok', c.id, '입금 확인 · 승인', 'a')}${btn('chgno', c.id, '반려', 's')}</div></div>`)).join('') || `<div class="mt-3">${empty('확인할 충전 신청이 없어요.')}</div>`}</section>
      <section class="rounded-3xl border border-mist bg-white p-6"><h2 class="text-xl font-bold">기사 가입 승인</h2><p class="mt-1 text-sm text-sea/70">사업자등록증을 열어 상호·대표자를 확인하세요. 사업자 상태(휴·폐업)는 국세청 홈택스에서 조회할 수 있어요.</p>
        ${pend.map(p => card(`<p class="font-bold">${esc(p.name)}</p><p class="mt-1 text-xs text-sea/70">${(p.fields || []).map(esc).join(', ')} · ${(p.areas || []).map(esc).join(', ')}</p><p class="mt-1 text-xs ${p.biz_doc ? 'text-cool font-bold' : 'text-red-600 font-bold'}">${p.biz_doc ? '📄 사업자등록증 제출됨 · ' + fmtT(p.biz_doc_at) : '📄 사업자등록증 미제출'}</p>${(p.certs || []).length ? `<p class="text-xs text-sea/70">자격/장비 ${p.certs.map(esc).join(', ')}</p>` : ''}<p class="text-xs text-sea/50">가입 ${fmtT(p.created_at)}</p><div class="mt-3 flex flex-wrap gap-2">${p.biz_doc ? btn('pdoc', p.id, '사업자등록증 보기', 'p') : ''}${btn('papprove', p.id, '승인', 'a')}${btn('preject', p.id, '반려', 's')}</div>`)).join('') || `<div class="mt-3">${empty('승인 대기 중인 기사가 없어요.')}</div>`}
        <details class="mt-4"><summary class="cursor-pointer text-sm font-bold">승인된 기사 ${S.adminPros.filter(p => p.approval === 'APPROVED').length}명 보기</summary>${S.adminPros.filter(p => p.approval !== 'PENDING').map(p => `<div class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ice px-3 py-2 text-sm"><span>${esc(p.name)} · 예치금 ${won(p.balance)} · ${p.approval === 'APPROVED' ? '활동 중' : '반려/정지'}${p.biz_doc ? ` <button type="button" data-act="pdoc" data-id="${p.id}" class="ml-1 underline text-cool">등록증</button>` : ''}</span>${p.approval === 'APPROVED' ? btn('preject', p.id, '활동 정지', 's') : btn('papprove', p.id, '다시 승인', 's')}</div>`).join('')}</details></section>
    </div>

    <h2 class="mt-10 text-2xl font-bold">민원 처리 <span class="text-base font-normal text-sea/60">1:1 문의 · 분쟁·재점검 신고</span></h2>
    <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="상태 필터">${fchip('ALL', '전체', S.inq.length)}${Object.keys(IST).map(s => fchip(s, IST[s], cnt(s))).join('')}</div>
    <div class="mt-1">${list.map(i => card(`<div class="flex flex-wrap items-center gap-2"><span class="font-display text-lg">${inqCode(i.id)}</span>${stBadge(i.status)}<span class="rounded-full bg-ice px-2.5 py-0.5 text-xs font-bold">${CAT[i.cat]}</span>${i.priority === 'HIGH' ? '<span class="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-white">긴급</span>' : ''}${slaOver(i) ? '<span class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">응답 기한 초과</span>' : ''}${i.by_role === '기사' ? '<span class="rounded-full bg-mist px-2.5 py-0.5 text-xs font-bold">기사 신고</span>' : ''}</div>
      <p class="mt-2 text-sm font-bold">${esc(i.title)}</p><p class="text-xs text-sea/60">${fmtT(i.created_at)}${i.assignee ? ' · 담당 ' + esc(i.assignee) : ' · 담당자 없음'}${i.live && i.status !== 'CLOSED' ? ' · <b class="text-sun">자동 확정 타이머 정지 중</b>' : ''}</p>
      <div class="mt-3 flex flex-wrap gap-2">${i.status === 'RECEIVED' ? btn('iassign', i.id, '처리 시작', 'a') : ''}${btn('iadm', i.id, i.status === 'CLOSED' ? '이력 보기' : '상세·답변', 's')}${i.status === 'ANSWERED' ? btn('iclose', i.id, '종결', 's') : ''}</div>`)).join('') || `<div class="mt-3">${empty('해당 상태의 문의가 없어요.')}</div>`}</div>

    <div class="mt-10 grid lg:grid-cols-2 gap-6">
      <section class="rounded-3xl border border-mist bg-white p-6"><h2 class="text-xl font-bold">자동 확정 시간</h2><p class="mt-2 text-sm leading-relaxed text-sea/75">기사님이 작업 완료를 요청한 뒤 고객이 확인하지 않으면 이 시간이 지나 자동 확정돼요. 다음 요청부터 적용돼요.</p>
        <div class="mt-4 flex gap-2" role="group" aria-label="자동 확정 시간">${[24, 48].map(h => `<button type="button" data-act="aauto" data-id="${h}" aria-pressed="${S.autoH === h}" class="${chipCls(S.autoH === h)}">${h}시간</button>`).join('')}</div></section>
      <section class="rounded-3xl bg-sea p-6 text-white"><h2 class="text-xl font-bold">수수료 수입</h2><p class="font-display text-4xl mt-2">${won(feeAll)}</p><p class="text-xs text-white/60">누적 · 거래가 확정되면 기사 예치금에서 차감돼 여기에 쌓여요.</p>
        <div class="mt-3 max-h-56 overflow-y-auto">${S.inc.slice(0, 30).map(l => `<div class="flex justify-between gap-3 border-b border-dashed border-white/20 py-2 text-sm"><span>${fmtT(l.created_at)} · ${esc(l.text)} · ${esc(proName(l.pro_id))}</span><b>+${won(l.amount)}</b></div>`).join('') || '<p class="mt-2 text-sm text-white/70">아직 수수료 수입이 없어요.</p>'}</div></section>
    </div>

    <h2 class="mt-10 text-2xl font-bold">최근 계약</h2>
    <div class="mt-1">${S.con.slice(0, 40).map(c => card(`<div class="flex flex-wrap items-center justify-between gap-2"><p class="font-bold">${conCode(c.id)} · ${conTitle(c)} · ${esc(c.gu)} · ${won(c.price)}</p><span class="text-sm">${cst(c)}</span></div><p class="text-xs text-sea/60">${esc(c.provider_name)} ↔ ${esc(c.client_name)} · 수수료 ${won(c.fee)}${c.fee_charged ? ' 차감' : ''}${c.warranty_no ? ' · 보증 ' + esc(c.warranty_no) : ''}</p>`)).join('') || `<div class="mt-3">${empty('아직 계약이 없어요.')}</div>`}</div>

    <div class="mt-10 grid lg:grid-cols-2 gap-6">
      <section><h2 class="text-2xl font-bold">예치금 거래 로그</h2>${S.led.slice(0, 15).map(l => card(`<div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">${esc(l.text)}</p><p class="text-xs text-sea/60">${esc(proName(l.pro_id))} · ${fmtT(l.created_at)}</p></div><p class="font-bold ${l.amount < 0 ? 'text-sun' : 'text-cool'}">${l.amount < 0 ? '−' : '+'}${won(Math.abs(l.amount))}</p></div>`)).join('') || `<div class="mt-3">${empty('아직 거래가 없어요.')}</div>`}</section>
      <section><h2 class="text-2xl font-bold">처리 이력 <span class="text-base font-normal text-sea/60">수정·삭제 불가</span></h2><ul class="mt-3 space-y-2">${S.aud.slice(0, 20).map(a => `<li class="rounded-xl bg-ice px-4 py-3 text-sm"><div class="flex flex-wrap justify-between gap-2"><b>${esc(a.action)} · ${esc(a.target || '')}</b><span class="text-xs text-sea/60">${fmtT(a.created_at)}</span></div><p class="text-xs text-sea/70">${esc(a.admin_email || '시스템')} · ${esc(JSON.stringify(a.before || {}))} → ${esc(JSON.stringify(a.after || {}))}${a.reason ? ' · ' + esc(a.reason) : ''}</p></li>`).join('') || '<li class="text-sm text-sea/60">아직 처리 이력이 없어요.</li>'}</ul></section>
    </div>`;
}
async function inqAdmin(id, keep) {
  id = +id; const i = S.inq.find(x => x.id === id); if (!i) return;
  let msgs, who = null;
  try { msgs = await inqMsgs(id, true); const r = await sb.from('profiles').select('name, email').eq('id', i.user_id).maybeSingle(); who = r.data; } catch (e) { return toast(errMsg(e)); }
  const c = i.contract_id ? S.con.find(x => x.id === i.contract_id) : null;
  openM(head(inqCode(i.id)) + `<div class="flex flex-wrap items-center gap-2">${stBadge(i.status)}<span class="rounded-full bg-ice px-2.5 py-0.5 text-xs font-bold">${CAT[i.cat]}${i.issue ? ' · ' + ISSUE[i.issue] : ''}</span>${i.priority === 'HIGH' ? '<span class="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold text-white">긴급</span>' : ''}</div>
    <p class="mt-2 font-bold">${esc(i.title)}</p><p class="text-xs text-sea/60">${who ? esc(who.name) + ' · ' + esc(who.email) : ''} (${esc(i.by_role)}) · ${fmtT(i.created_at)} 접수${i.assignee ? ' · 담당 ' + esc(i.assignee) : ''}</p>
    ${c ? `<p class="text-xs text-sea/60">계약 ${conCode(c.id)} · ${conTitle(c)} · ${esc(c.provider_name)} ↔ ${esc(c.client_name)} · ${won(c.price)}</p>` : ''}
    ${i.live && i.status !== 'CLOSED' ? '<p class="mt-2 rounded-xl bg-sun/10 p-3 text-xs font-bold text-sun">이 신고는 계약의 자동 확정 타이머를 멈추고 있어요. 종결하면 남은 시간부터 다시 시작돼요.</p>' : ''}
    <div class="mt-4 space-y-3">${msgs.map(m => `<div class="rounded-2xl p-4 ${m.kind === 'ANSWER' ? 'bg-sea text-white mr-8' : m.kind === 'INTERNAL_NOTE' ? 'border-2 border-dashed border-sun/50 bg-sun/5' : 'bg-mist ml-8'}"><p class="text-xs ${m.kind === 'ANSWER' ? 'text-white/70' : 'text-sea/60'}">${{ QUESTION:'문의', FOLLOWUP:'추가 문의', ANSWER:'최종 답변', INTERNAL_NOTE:'내부 메모 (고객에게 안 보임)' }[m.kind]} · ${fmtT(m.created_at)}</p><p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed">${esc(m.body)}</p>${(m.photos || []).length ? `<div class="mt-2 flex flex-wrap gap-2">${m.photos.filter(isPhotoUrl).map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="첨부 사진" class="h-16 w-16 rounded-lg object-cover"></a>`).join('')}</div>` : ''}</div>`).join('')}</div>
    ${i.status === 'CLOSED' ? '' : `<label for="ia-body" class="block mt-5 text-sm font-bold">${i.status === 'ANSWERED' ? '내부 메모' : '최종 답변 / 내부 메모'}</label><textarea id="ia-body" rows="4" maxlength="2000" class="mt-2 w-full rounded-xl bg-ice px-4 py-3 resize-none" placeholder="${i.status === 'ANSWERED' ? '내부 메모는 고객에게 보이지 않아요.' : '“최종 답변 등록”을 누르면 고객 고객센터 알림에 바로 표시돼요.'}"></textarea>${errBox()}
    <div class="mt-2 flex flex-wrap gap-2">${btn('inote', i.id, '내부 메모 저장', 's')}${i.status !== 'ANSWERED' ? btn('ianswer', i.id, '최종 답변 등록', 'a') : btn('iclose', i.id, '종결', 'a')}${i.status === 'RECEIVED' ? btn('iassign', i.id, '처리 시작', 's') : ''}</div>`}
    <div class="mt-4"><button type="button" data-mclose class="${B.s}">닫기</button></div>`, keep);
  openInq = null; menuCur = 'iadm'; iadmCur = id;
}
let iadmCur = null;
async function adminAct(el, id, action) {
  const body = action === 'note' || action === 'answer' ? ($('#ia-body').value || '').trim() : null;
  if (action === 'note' && body.length < 2) return setErr('메모 내용을 입력해 주세요.');
  if (action === 'answer' && body.length < 5) return setErr('답변을 5자 이상 입력해 주세요.');
  await busy(el, async () => {
    await rpc('admin_inquiry', { p_inquiry:+id, p_action:action, p_body:body });
    await Promise.all(['inq', 'con', 'aud'].map(load)); render();
    if (mmOpen() && menuCur === 'iadm') inqAdmin(id, true);
    toast({ assign:'처리를 시작했어요.', note:'내부 메모를 저장했어요.', answer:'답변을 등록했어요. 고객에게 알림이 갔어요.', close:'종결했어요.' }[action]);
  });
}
async function adminSimple(el, fn, args, msg, keys) {
  await busy(el, async () => { await rpc(fn, args); await Promise.all(keys.map(load)); render(); toast(msg); });
}

/* =====================================================================
   이벤트 연결
   ===================================================================== */
const ACT = {
  home: () => { closeM(); if (S.mode !== 'customer') setMode('customer'); else showView('main'); },
  back: () => { closeM(); showView('main'); },
  mkt: openMarket, pros: openPros, cs: () => csModal(), cstab: t => csModal(t),
  auth: () => S.user ? logout() : authModal('login'),
  atab: k => { saveAuth(); au.tab = k; renderAuth(); }, autype: k => { saveAuth(); au.type = k; renderAuth(); },
  pekind: k => specKind(pe, 'pe', k), pesub: (x, el) => specSub(pe, 'pe', x, el), aukind: k => specKind(au, 'au', k), ausub: (x, el) => specSub(au, 'au', x, el), bpkind: k => specKind(bp, 'bp', k), bpsub: (x, el) => specSub(bp, 'bp', x, el),
  aarea: g => toggleIn(au.areas, g, 'aarea'), acert: c => toggleIn(au.certs, c, 'acert'), acertadd: () => addCert('acert', au.certs),
  afree: () => { au.free = !au.free; const b = document.querySelector('[data-act="afree"]'); b.setAttribute('aria-pressed', au.free); b.className = chipCls(au.free); },
  alogin: (id, el) => alogin(el), asignup: (id, el) => asignup(el), asocial: p => asocial(p),
  pwreset: resetStart, rssend: (id, el) => resetSend(el), rsconfirm: (id, el) => resetConfirm(el),
  gopro: () => S.user ? (isPro() ? setMode('pro') : becomeProModal()) : authModal('signup', 'pro'),
  barea: g => toggleIn(bp.areas, g, 'barea'), bcert: c => toggleIn(bp.certs, c, 'bcert'), bcertadd: () => addCert('bcert', bp.certs),
  bfree: () => { bp.free = !bp.free; const b = document.querySelector('[data-act="bfree"]'); b.setAttribute('aria-pressed', bp.free); b.className = chipCls(bp.free); },
  bpsend: (id, el) => bpSend(el), bdsend: (id, el) => bdSend(el), bdview: () => S.pro && S.pro.biz_doc && openBizDoc(S.pro.biz_doc),
  agreeall: (id, el) => document.querySelectorAll('.au-c').forEach(c => c.checked = el.checked),
  pdoc: id => { const p = S.adminPros.find(x => x.id === id); if (p && p.biz_doc) openBizDoc(p.biz_doc); },
  tosspay: (id, el) => tossPay(el), paymeth: k => { payMethod = k; walletModal(true); },
  modesw: () => setMode(S.mode === 'pro' ? 'customer' : 'pro'),
  admin: () => setMode(S.mode === 'admin' ? 'customer' : 'admin'),
  menu: () => !S.user ? custMenu() : S.mode === 'pro' ? proMenu() : custMenu(),
  fprev: () => { fp = (fp - 1 + fpages) % fpages; renderFeed(); }, fnext: () => { fp = (fp + 1) % fpages; renderFeed(); },
  mtab: k => { MK.tab = k; renderMarket(); }, mgr: g => { MK.grades.has(g) ? MK.grades.delete(g) : MK.grades.add(g); renderMarket(); }, mfree: () => { MK.free = !MK.free; renderMarket(); },
  ffree: () => { FS.free = !FS.free; renderPros(); }, fkind: k => { FS.kind = k || ''; renderPros(); },
  qcat: k => { closeM(); openQuote({ cat:k }); }, qopen0: () => { closeM(); openQuote({}); },
  preq: id => { const p = proPub(id); if (!p) return; closeM(); const k = p.kind || 'aircon'; openQuote({ cat:k, service:k === 'truck' ? 'truck' : '', target:p.id, targetName:p.name }); toast(`${p.name} 기사님께만 보이는 견적 요청을 작성해요.`); },
  noti: () => { if (needLogin('알림은 로그인 후 볼 수 있어요.')) return; csModal('ntf'); },
  guarantee: () => openM(head('14일 재점검 안심 보장제') + `<ul class="space-y-3 text-sm leading-relaxed">
    <li class="rounded-2xl bg-ice p-4"><b>무엇을 보장하나요?</b><br><span class="text-sub">거래가 확정된 뒤 14일 안에 같은 부위에서 같은 증상이 다시 생기면, 담당 기사님의 재점검 방문을 연결해요.</span></li>
    <li class="rounded-2xl bg-ice p-4"><b>어떻게 신청하나요?</b><br><span class="text-sub">내 요청(MY) → 완료된 거래 → [14일 재점검 신청]을 누르고 증상과 사진을 올려 주세요.</span></li>
    <li class="rounded-2xl bg-ice p-4"><b>제외되는 경우</b><br><span class="text-sub">고객 과실, 천재지변, 소모품 교체, 작업과 관계없는 부위의 고장은 제외돼요. 자세한 기준은 이용약관을 따라요.</span></li></ul>
    <div class="mt-4"><button type="button" data-mclose class="${B.s} w-full">확인</button></div>`),
  fav: id => { id = +id; FAV.has(id) ? FAV.delete(id) : FAV.add(id); saveFav(); document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach(b => { b.textContent = heart(id); b.setAttribute('aria-pressed', FAV.has(id)); }); if (S.view === 'market') renderMarket(); },
  ldet: id => ldet(id), sellopen: () => sellOpen(), stockopen: () => sellModal('stock'),
  sprm: i => { sp.splice(+i, 1); spThumbs(); bkDraw(); }, ssend: (id, el) => ssend(el),
  oopen: id => offerModal(id), osend: (id, el) => osend(el, id), lpick: (id, el) => lpick(el, id), lclose: (id, el) => lclose(el, id),
  pdet: id => pdet(id), pq: id => pdet(id, { act:'cmp', id:cmpCur, label:'← 받은 견적으로' }), pchat: (id, el) => pchat(el, id),
  cmp: id => compare(id), pick: (id, el) => pick(el, id), rclose: (id, el) => rclose(el, id),
  rcpt: id => receipt(id, false), warr: id => warrModal(id, false), chat: id => chatModal(id), chatc: id => chatOfContract(id),
  csend: (id, el) => csend(el, id), qphoto: () => $('#chat-photo').click(),
  qsched: () => { const i = $('#chat-in'); i.value = '일정 변경을 요청드려요. 가능한 날짜와 시간을 알려 주세요.'; i.focus(); },
  qask: () => { const i = $('#chat-in'); i.value = '합의한 금액과 날짜로 “합의 내용으로 계약하기”를 눌러 주세요.'; i.focus(); },
  qdirect: id => directModal(id), dsend: (id, el) => dsend(el, id),
  cfin: (id, el) => confirmDeal(el, id), creport: id => rpModal(id, '분쟁', 'menu'), qreport: id => rpModal(id, '', 'chat'), rpsend: (id, el) => rpsend(el, id),
  rev: id => revModal(id), rvsend: (id, el) => rvsend(el, id), rew: id => rewModal(id), rwsend: (id, el) => rwsend(el, id),
  rvs: k => { rv.s = k; rv.tags = []; rv.other = ''; revModal(rv.cid); },
  rvt: t => { const i = rv.tags.indexOf(t); rv.other = $('#rv-other')?.value || rv.other; if (i >= 0) rv.tags.splice(i, 1); else if (rv.tags.length >= 3) return toast('태그는 최대 3개까지 고를 수 있어요.'); else rv.tags.push(t); revModal(rv.cid); },
  online: (id, el) => toggleOnline(el), qopen: id => quoteModal(id), qsend: (id, el) => qsend(el, id),
  done: (id, el) => doneReq(el, id), rwstep: (id, el) => rwStep(el, id),
  smode: id => { sellBulk = id === 'bulk'; const m = $('#merr'); if (m) m.textContent = ''; bkDraw(); },
  bkadd: id => bkAdd(ITEMS[+id]), bkcustom: () => { const i = $('#bk-in'); bkAdd(i.value); i.value = ''; i.focus(); },
  bkq: id => { const [i, d] = id.split(':').map(Number); const x = bk[i]; if (!x) return; x.q = Math.max(1, Math.min(99, x.q + d)); bkDraw(); },
  bkrm: id => { bk.splice(+id, 1); bkDraw(); },
  delacct: () => { closeM(); delModal(); }, delgo: (id, el) => delGo(el),
  delcancel: (id, el) => busy(el, async () => { await rpc('cancel_account_deletion'); closeM(); toast('탈퇴 신청을 취소했어요.'); }),
  deldone: (id, el) => { if (!confirmBox(el)) return; busy(el, async () => { await rpc('admin_delete_account', { p_user:id, p_refunded:false }); loadDels(true); toast('탈퇴 처리했어요.'); }); },
  deldone2: (id, el) => { if (!confirmBox(el)) return; busy(el, async () => { await rpc('admin_delete_account', { p_user:id, p_refunded:true }); loadDels(true); await load('adminPros'); render(); toast('예치금 환불 기록 후 탈퇴 처리했어요.'); }); },
  navmenu: () => navMenu(), ptop: () => { closeM(); window.scrollTo({ top:0, behavior:'smooth' }); },
  navgo: id => { closeM(); if (S.mode !== 'customer' || S.view !== 'main') setMode('customer'); setTimeout(() => document.querySelector(id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 80); },
  notifon: () => notifOn(), install: () => installApp(), instclose: () => instHide(3),
  wallet: () => walletModal(), chargego: (id, el) => chargeGo(el),
  mypage: () => mypageModal(), profedit: profModal, pesave: (id, el) => peSave(el),
  pecert: c => toggleIn(pe.certs, c, 'pecert'), pecertadd: () => addCert('pecert', pe.certs), pearea: g => toggleIn(pe.areas, g, 'pearea'),
  pefree: () => { pe.free = !pe.free; const b = document.querySelector('[data-act="pefree"]'); b.setAttribute('aria-pressed', pe.free); b.className = chipCls(pe.free); },
  pdetme: () => pdet(me(), { act:'mypage', label:'← 마이페이지로' }),
  mpbio: (id, el) => busy(el, async () => { await savePro({ bio:$('#mp-bio').value.trim() }); toast('한 줄 소개를 저장했어요.'); }),
  mpcadd: (id, el) => { const y = $('#mp-cy').value.trim(), t = $('#mp-ct').value.trim(); if (!t) return setErr('경력 내용을 입력해 주세요.');
    busy(el, async () => { await savePro({ career:[{ y:y || '기간 미입력', t }, ...(S.pro.career || [])].slice(0, 20) }); mypageModal(true); }); },
  mpcrm: (i, el) => busy(el, async () => { const c = [...(S.pro.career || [])]; c.splice(+i, 1); await savePro({ career:c }); mypageModal(true); }),
  mppadd: (id, el) => { const t = $('#mp-pt').value.trim(), n = $('#mp-pn').value.trim(), f = $('#mp-pf').files[0]; if (!t) return setErr('작업 제목을 입력해 주세요.');
    busy(el, async () => { const img = f ? await uploadPhoto(f) : null, d = new Date(); await savePro({ portfolio:[{ t, n, d:`${d.getFullYear()}.${pad(d.getMonth() + 1)}`, img }, ...(S.pro.portfolio || [])].slice(0, 20) }); mypageModal(true); toast('포트폴리오를 추가했어요.'); }); },
  mpprm: (i, el) => busy(el, async () => { const p = [...(S.pro.portfolio || [])]; p.splice(+i, 1); await savePro({ portfolio:p }); mypageModal(true); }),
  inqnew: () => inqForm(true), iqcat: k => { saveIq(); iq.cat = k; iq.cid = ''; inqForm(); }, inqsend: (id, el) => inqSend(el),
  inqdet: id => inqDetail(id), inqfu: (id, el) => inqFollow(el, id), inqdel: (id, el) => inqDel(el, id),
  refresh: () => { loadVisits(true); loadDels(true); return loadAll().then(() => toast('새로 불러왔어요.')); },
  ifilt: k => { AF = k; render(); }, iadm: id => inqAdmin(id),
  iassign: (id, el) => adminAct(el, id, 'assign'), inote: (id, el) => adminAct(el, id, 'note'), ianswer: (id, el) => adminAct(el, id, 'answer'), iclose: (id, el) => adminAct(el, id, 'close'),
  aauto: (h, el) => adminSimple(el, 'admin_set_auto_hours', { p_hours:+h }, `다음 작업 완료 요청부터 ${h}시간 뒤 자동 확정돼요.`, ['settings', 'aud']),
  papprove: (id, el) => adminSimple(el, 'admin_set_approval', { p_pro:id, p_approve:true }, '기사를 승인했어요.', ['adminPros', 'prosPub', 'aud']),
  preject: (id, el) => { if (!confirmBox(el)) return; adminSimple(el, 'admin_set_approval', { p_pro:id, p_approve:false }, '반려(정지)했어요.', ['adminPros', 'prosPub', 'aud']); },
  chgok: (id, el) => { if (!confirmBox(el)) return; adminSimple(el, 'admin_handle_charge', { p_charge:+id, p_approve:true }, '충전을 승인했어요.', ['chg', 'led', 'adminPros', 'aud']); },
  chgno: (id, el) => adminSimple(el, 'admin_handle_charge', { p_charge:+id, p_approve:false }, '충전 신청을 반려했어요.', ['chg', 'aud'])
};
/* 중요한 관리자 버튼은 두 번 눌러야 실행 (실수 방지) */
function confirmBox(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1'; const t = el.textContent; el.textContent = '한 번 더 누르면 실행';
  setTimeout(() => { if (document.body.contains(el)) { delete el.dataset.armed; el.textContent = t; } }, 3000);
  return false;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) { if (b.tagName === 'A') e.preventDefault(); const f = ACT[b.dataset.act]; if (f) { if (!sb && !['home', 'back', 'mkt', 'pros', 'fprev', 'fnext', 'mtab', 'mgr', 'mfree', 'ffree', 'fav'].includes(b.dataset.act)) return toast('사이트 설정(config.js)이 아직 끝나지 않았어요.'); f(b.dataset.id, b); } return; }
  if (e.target.closest('[data-mclose]')) return closeM();
  if (e.target.closest('[data-rmclose]')) return $('#rm').classList.add('hidden');
  const st = e.target.closest('[data-star]'); if (st) { rmStars = +st.dataset.star; paintStars(); return; }
  if (e.target.closest('#rm-submit')) return rmSubmit();
  const q = e.target.closest('a[href="#quote"]'); if (q) { e.preventDefault(); return openQuote({ service:q.dataset.svc || '' }, q); }
  const a = e.target.closest('a[href="#process"], a[href="#services"], a[href="#safety"], a[href="#pro"], a[href="#pro-calc"]');
  if (a) { const t = document.querySelector(a.getAttribute('href')); if (!t || t.offsetParent === null) { if (S.view !== 'main' || S.mode !== 'customer') { setMode('customer'); setTimeout(() => document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior:'smooth' }), 50); e.preventDefault(); } return; }
    e.preventDefault(); t.scrollIntoView({ behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' }); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#rm').classList.contains('hidden')) return $('#rm').classList.add('hidden'); if (mmOpen()) return closeM(); if (!qm.classList.contains('hidden')) return closeQuote(); }
  if (e.key === 'Enter' && e.target.id === 'bk-in' && !e.isComposing) { e.preventDefault(); return ACT.bkcustom(); }
  if (e.key === 'Enter' && e.target.id === 'chat-in' && !e.isComposing) { e.preventDefault(); document.querySelector('[data-act="csend"]')?.click(); }
  if (e.key === 'Enter' && /^(acert|pecert|bcert)-in$/.test(e.target.id) && !e.isComposing) { e.preventDefault(); ACT[e.target.id.replace('-in', '') + 'add'](); }
  if (e.key === 'Enter' && /^au-(email|pw|pw2)$/.test(e.target.id) && !e.isComposing) { e.preventDefault(); document.querySelector(au.tab === 'login' ? '[data-act="alogin"]' : '[data-act="asignup"]')?.click(); }
});
document.addEventListener('change', e => {
  if (e.target.classList.contains('au-c')) { const all = $('#au-agree'); if (all) all.checked = [...document.querySelectorAll('.au-c')].every(c => c.checked); }
  if (e.target.id === 'chat-photo') { sendChatPhoto(e.target.files[0]); e.target.value = ''; }
  if (e.target.id === 'sp-file') { for (const f of e.target.files) { if (sp.length >= spMax()) { setErr(sellBulk ? '일괄 판매는 사진을 최대 20장까지 올릴 수 있어요.' : '사진은 최대 5장까지 올릴 수 있어요. 여러 대라면 ‘여러 대 일괄 판매’를 눌러 주세요 (최대 20장).'); break; } if (f.type.startsWith('image/')) sp.push(f); } e.target.value = ''; spThumbs(); bkDraw(); }
});
$('#qm-file').addEventListener('change', e => {
  qErr('');
  for (const f of e.target.files) { if (qphotos.length >= 5) { qErr('사진은 최대 5장까지 올릴 수 있어요.'); break; } if (!f.type.startsWith('image/')) { qErr('이미지 파일만 올릴 수 있어요.'); continue; } qphotos.push({ file:f, url:URL.createObjectURL(f) }); }
  e.target.value = ''; qThumbs();
});
$('#qm-thumbs').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; URL.revokeObjectURL(qphotos[+b.dataset.rm].url); qphotos.splice(+b.dataset.rm, 1); qThumbs(); });
$('#qm-details').addEventListener('input', e => $('#qm-count').textContent = `${e.target.value.length} / 500`);
$('#qm-next').addEventListener('click', qNext);
$('#qm-back').addEventListener('click', () => qShow(qstep - 1));
qm.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeQuote(); });
document.addEventListener('submit', e => {
  if (e.target.id !== 'quick') return; e.preventDefault();
  openQuote({ service:$('#svc').value, district:$('#gu').value }, e.submitter);
});
$('#mq').addEventListener('input', e => { MK.q = e.target.value.trim().toLowerCase(); renderMarket(); });
$('#msort').addEventListener('change', e => { MK.sort = e.target.value; renderMarket(); });
['fg', 'fsort', 'fg2', 'fsort2'].forEach(id => $('#' + id).addEventListener('change', e => { FS[e.target.dataset.f] = e.target.value; ['fg', 'fg2'].forEach(x => $('#' + x).value = FS.gu); ['fsort', 'fsort2'].forEach(x => $('#' + x).value = FS.sort); renderPros(); }));
$('#ffree2').addEventListener('change', e => { FS.free = e.target.checked; renderPros(); });

/* 타이머 표시 · 기한 지난 자동 확정 처리 */
let hkAt = 0;
setInterval(() => {
  document.querySelectorAll('[data-timer]').forEach(el => { const c = S.con.find(x => x.id === +el.dataset.timer); if (c && c.status === 'pending') el.textContent = hms(remainMs(c)); });
  document.querySelectorAll('[data-bar]').forEach(el => { const c = S.con.find(x => x.id === +el.dataset.bar); if (c && c.status === 'pending') el.style.width = pctLeft(c) + '%'; });
  const due = S.con.some(c => c.status === 'pending' && !c.paused && T(c.deadline) <= Date.now());
  if (S.user && (due ? Date.now() - hkAt > 15000 : Date.now() - hkAt > 300000)) { hkAt = Date.now(); rpc('run_housekeeping').then(n => { if (n) queueLoad('con'); }).catch(() => {}); }
}, 1000);

/* =====================================================================
   방문 통계: 이름·IP 없이 무작위 번호로 방문 수만 세요 (관리자 화면에서 확인)
   ===================================================================== */
let VID_ = null; const VID = () => VID_ || (VID_ = (() => { let v = lsGet('hy_vid'); if (!v || v.length < 8) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 20); lsSet('hy_vid', v); } return v; })());
const SRC = (() => { try { const q = new URLSearchParams(location.search), u = q.get('from') || q.get('utm_source'); if (u) return u.slice(0, 40); const r = document.referrer && new URL(document.referrer).hostname.replace(/^www\./, ''); return r && r !== location.hostname ? r.slice(0, 80) : ''; } catch (e) { return ''; } })();
const seenView = new Set();
function track(kind, path) {
  if (!sb || S.admin || (kind === 'view' && seenView.has(path))) return;
  if (kind === 'view') seenView.add(path);
  sb.from('visits').insert({ vid:VID(), kind, path:String(path || '').slice(0, 40), ref:SRC, mobile:innerWidth < 768, app:standalone() }).then(() => {}, () => {});
}

/* =====================================================================
   새 소식 알림: 새 견적 요청·견적 도착·계약·충전 신청 등을 알려줘요
   (앱/사이트가 열려 있거나 방금 내려둔 동안 동작 · 폰 알림은 '알림 켜기' 후)
   ===================================================================== */
let W = null, nBadge = 0; const baseTitle = document.title;
const canNote = () => 'Notification' in window && window.isSecureContext;
const notifBtn = () => canNote() && Notification.permission === 'default' ? `<button type="button" data-act="notifon" class="rounded-xl border-2 border-sun/60 bg-sun/10 font-bold px-4 py-2.5 text-sm text-sea">🔔 알림 켜기</button>` : '';
async function notifOn() {
  if (!canNote()) return toast(isIOS() && !standalone() ? '아이폰은 홈 화면에 추가한 앱에서 알림을 켤 수 있어요.' : '이 브라우저는 알림을 지원하지 않아요.');
  const r = await Notification.requestPermission().catch(() => 'denied');
  toast(r === 'granted' ? '알림을 켰어요. 새 소식이 오면 알려 드릴게요.' : '알림이 꺼져 있어요. 브라우저 설정에서 허용할 수 있어요.');
  render(); refreshOpen(['con']);
}
function phoneNote(t, b) {
  if (!document.hidden) return;
  nBadge++; document.title = `(${nBadge}) ${baseTitle}`;
  if (!canNote() || Notification.permission !== 'granted') return;
  const opt = { body:b, icon:'icon-192.png', badge:'icon-192.png', tag:'hy-' + Date.now(), vibrate:[120, 60, 120] };
  const sw = navigator.serviceWorker;
  (sw ? sw.getRegistration() : Promise.resolve(null)).then(r => r ? r.showNotification('한여름 · ' + t, opt) : new Notification('한여름 · ' + t, opt)).catch(() => {});
}
function alertUser(t, b) { toast(`🔔 ${t} · ${b}`); try { navigator.vibrate && navigator.vibrate(120); } catch (e) {} phoneNote(t, b); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && nBadge) { nBadge = 0; document.title = baseTitle; } });
function snapW() {
  return { uid:me(), req:new Set(S.req.map(r => r.id)), quo:new Set(S.quo.map(q => q.id)), con:new Map(S.con.map(c => [c.id, c.status])), off:new Set(S.off.map(o => o.id)),
    chg:new Set(S.chg.map(c => c.id)), inq:new Set(S.inq.map(i => i.id)), pp:new Set(S.adminPros.filter(p => p.approval === 'PENDING').map(p => p.id)) };
}
function watchNew() {
  if (!S.user) { W = null; return; }
  const n = snapW(); if (!W || W.uid !== n.uid) { W = n; return; }
  const out = [], nm = c => c.title || SVC[c.service] || '거래';
  if (approved()) S.req.filter(r => !W.req.has(r.id) && r.status === 'open' && r.customer_id !== me() && (r.target_pro === me() || kindOf(r.service) === (S.pro.kind || 'aircon'))).forEach(r => out.push([r.target_pro === me() ? '나를 지정한 견적 요청' : '새 견적 요청', `${SVC[r.service] || ''} · ${r.service === 'truck' ? `${r.gu} → ${r.to_gu}` : r.gu}`]));
  S.quo.filter(q => !W.quo.has(q.id) && S.req.some(r => r.id === q.request_id && r.customer_id === me())).forEach(q => out.push(['새 견적 도착', `${won(q.price)} 견적이 도착했어요`]));
  S.con.forEach(c => {
    const was = W.con.get(c.id); if (was === c.status) return;
    if (was === undefined) { if (c.provider_id === me()) out.push(['계약 성사', `${nm(c)} 계약이 맺어졌어요`]); }
    else if (c.status === 'pending' && c.client_id === me()) out.push(['완료 확인 요청', `${nm(c)} 작업 완료를 확인해 주세요`]);
    else if (c.status === 'completed' && c.provider_id === me()) out.push(['거래 확정', `${nm(c)} 거래가 확정됐어요`]);
  });
  S.off.filter(o => !W.off.has(o.id) && o.buyer_id !== me() && S.lst.some(l => l.id === o.listing_id && l.seller_id === me())).forEach(o => out.push(['새 매입 제안', `${won(o.price)} 제안이 왔어요`]));
  if (S.admin) {
    S.chg.filter(c => !W.chg.has(c.id) && c.status === 'requested').forEach(c => out.push(['충전 신청', `${won(c.amount)} · 입금자 ${c.depositor}`]));
    S.inq.filter(i => !W.inq.has(i.id) && i.user_id !== me()).forEach(i => out.push(['새 문의·신고', i.title]));
    S.adminPros.filter(p => p.approval === 'PENDING' && !W.pp.has(p.id)).forEach(p => out.push(['기사 가입 신청', `${p.name} · 승인 대기`]));
  }
  W = n; out.slice(0, 3).forEach(([t, b], i) => setTimeout(() => alertUser(t, b), i * 3400));
}

/* =====================================================================
   모바일 웹앱: 홈 화면 설치 · 오프라인 표시 · 다시 열 때 새로고침
   ===================================================================== */
const PWA = { prompt: null };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const inApp = () => /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(navigator.userAgent);
const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
function instPlace() { const bar = $('#mbar'), h = bar && bar.style.display !== 'none' ? bar.offsetHeight : 0; $('#inst').style.bottom = (h + 12) + 'px'; }
function instShow() {
  if (standalone() || innerWidth >= 768) return;
  const until = +lsGet('hy_inst_hide2') || 0; if (Date.now() < until) return;
  $('#inst-sub').textContent = PWA.prompt ? '홈 화면에 추가하면 바로 열려요' : inApp() ? '크롬·사파리로 열면 추가할 수 있어요' : isIOS() ? '공유 버튼 → 홈 화면에 추가' : '메뉴 → 홈 화면에 추가';
  instPlace(); $('#inst').style.display = '';
}
function instHide(days) { $('#inst').style.display = 'none'; if (days) lsSet('hy_inst_hide2', Date.now() + days * 864e5); }
async function installApp() {
  if (PWA.prompt) { PWA.prompt.prompt(); const r = await PWA.prompt.userChoice.catch(() => ({})); PWA.prompt = null; instHide(r.outcome === 'accepted' ? 365 : 7); return; }
  instHide(3);
  if (inApp()) {
    const url = location.origin + location.pathname, kakao = /KAKAOTALK/i.test(navigator.userAgent);
    const ext = kakao ? 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
      : isAndroid() ? 'intent://' + location.host + location.pathname + '#Intent;scheme=https;package=com.android.chrome;end' : '';
    return openM(`<h3 class="font-display text-2xl">홈 화면에 추가하기</h3>
    <p class="mt-2 text-sm leading-relaxed text-sea/70">카카오톡·네이버·인스타그램 앱 안에서는 홈 화면에 추가할 수 없어요. <b>${isIOS() ? '사파리' : '크롬(또는 삼성 인터넷)'}</b>${isIOS() ? '로' : '으로'} 열어서 추가해 주세요.</p>
    ${ext ? `<a href="${ext}" class="mt-5 block w-full rounded-xl bg-brand py-3.5 text-center font-bold text-white">${isIOS() ? '사파리로' : '크롬으로'} 열기</a>` : ''}
    <p class="mt-4 text-sm leading-relaxed">${ext ? '버튼이 안 되면 ' : ''}화면 오른쪽 위나 아래의 <b>⋯ 또는 ⋮ 메뉴</b> → <b>‘다른 브라우저로 열기’</b>를 눌러요.</p>
    <button type="button" data-mclose class="mt-6 w-full rounded-xl bg-ice py-3 font-bold">확인</button>`);
  }
  if (!isIOS()) return openM(`<h3 class="font-display text-2xl">홈 화면에 추가하기</h3>
    <ol class="mt-4 space-y-3 text-sm">
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">1</span><span>오른쪽 위(삼성 인터넷은 아래)의 <b>메뉴 버튼</b> <span class="inline-block rounded border border-mist px-1.5">⋮</span> 또는 <span class="inline-block rounded border border-mist px-1.5">≡</span> 을 눌러요</span></li>
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">2</span><span><b>‘홈 화면에 추가’</b> 또는 <b>‘앱 설치’</b>를 눌러요</span></li>
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">3</span><span><b>‘추가’</b> 또는 <b>‘설치’</b>를 누르면 끝!</span></li>
    </ol>
    <button type="button" data-mclose class="mt-6 w-full rounded-xl bg-sea py-3 font-bold text-white">확인</button>`);
  openM(`<h3 class="font-display text-2xl">홈 화면에 추가하기</h3>
    <p class="mt-2 text-sm text-sea/70">아이폰은 <b>사파리</b>에서만 추가할 수 있어요.</p>
    <ol class="mt-4 space-y-3 text-sm">
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">1</span><span>화면 아래(또는 위)의 <b>공유 버튼</b> <span class="inline-block rounded border border-mist px-1.5">⬆︎</span> 을 눌러요</span></li>
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">2</span><span>목록을 내려서 <b>‘홈 화면에 추가’</b>를 눌러요</span></li>
      <li class="flex gap-3"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-white font-bold">3</span><span>오른쪽 위 <b>‘추가’</b>를 누르면 끝!</span></li>
    </ol>
    <button type="button" data-mclose class="mt-6 w-full rounded-xl bg-sea py-3 font-bold text-white">확인</button>`);
}
/* 휴대폰 키보드가 올라오면 아래에서 올라오는 창도 키보드 위로 올려요 */
function fitSheets() {
  const v = window.visualViewport; if (!v) return;
  const mob = innerWidth < 640, kb = Math.max(0, innerHeight - v.height - v.offsetTop);
  ['#mm-body', '#qm-box'].forEach(id => { const e = $(id); if (!e) return;
    e.style.bottom = mob && kb > 80 ? kb + 'px' : ''; e.style.maxHeight = mob && kb > 80 ? (v.height * 0.94) + 'px' : ''; });
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitSheets); visualViewport.addEventListener('scroll', fitSheets); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.prompt = e; setTimeout(instShow, 2500); });
addEventListener('appinstalled', () => { track('install'); PWA.prompt = null; instHide(365); toast('홈 화면에 한여름이 추가됐어요'); });
function netState() { $('#offline').style.display = navigator.onLine ? 'none' : ''; }
addEventListener('offline', netState);
addEventListener('online', () => { netState(); if (sb) { subscribe(); loadAll(); } toast('다시 연결됐어요'); });
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (sb && hiddenAt && Date.now() - hiddenAt > 20000) { subscribe(); loadAll().then(() => refreshOpen(Object.values(TBL))).catch(() => {}); }
  hiddenAt = 0;
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* =====================================================================
   시작
   ===================================================================== */
(function init() {
  const opts = guOpts(GG_NEAR);
  $('#gu').innerHTML = '<option value="">지역 선택</option>' + opts; $('#qm-gu').insertAdjacentHTML('beforeend', opts); $('#qm-to').insertAdjacentHTML('beforeend', guOpts(GG_ALL, '', [FAR]));
  $('#qm-ton').insertAdjacentHTML('beforeend', TONS.map(t => `<option>${t}</option>`).join(''));
  $('#svc').innerHTML = Object.values(KINDS).map(k => `<optgroup label="${k.name}">${k.svcs.map(c => `<option value="${c}">${SVC[c]}</option>`).join('')}</optgroup>`).join('');
  const short = c => c === 'freezer_sale' ? '매입·판매 (장터)' : SVC[c].replace('에어컨 ', '').replace('냉장·냉동고 ', '').replace('냉장·냉동 ', '');
  $('#qm-services').innerHTML = GROUPS.map(([title, codes, k]) => `<fieldset data-cat="${k}"><legend class="flex items-center gap-2 text-sm font-bold text-sub"><span class="grid h-7 w-7 place-items-center rounded-lg ${KINDS[k].color}">${svgI(KINDS[k].icon, 'h-4 w-4')}</span>${title}</legend><div class="mt-2 grid ${codes.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5">${codes.map(c => `<label class="relative"><input type="radio" name="qm-svc" value="${c}" class="peer sr-only"><span class="block rounded-2xl border-2 border-mist px-3 py-4 text-center font-bold cursor-pointer hover:bg-ice peer-checked:border-brand peer-checked:bg-brand-50 peer-checked:text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">${short(c)}</span></label>`).join('')}</div></fieldset>`).join('')
    + '<button type="button" id="qm-allcat" class="hidden text-sm font-bold text-brand underline">다른 서비스도 보기</button>';
  $('#qm-allcat').addEventListener('click', () => qCat(''));
  ['fg', 'fg2'].forEach(id => $('#' + id).innerHTML = '<option value="">전체 지역</option>' + guOpts(GG_ALL));
  const fsvc = $('#fc-svc'), famt = $('#fc-amt'), fupd = () => { const p = Math.max(0, +famt.value || 0), f = calcFee(fsvc.value, p); $('#fc-out').textContent = won(f); $('#fc-note').textContent = ['freezer_removal', 'freezer_stock'].includes(fsvc.value) ? (f >= 100000 ? '거래금액의 5% · 건당 상한 10만 원이 적용돼요' : '거래금액의 5%') : f ? '건당 정액 · 금액과 관계없이 같아요' : '중고 매입은 수수료가 없어요'; };
  fsvc.addEventListener('change', fupd); famt.addEventListener('input', fupd); fupd();
  const z = C.BIZ || {}, ph = (v, d) => v ? esc(v) : d;
  $('#foot').innerHTML = `<div class="lg:grid lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-10">
    <div><p class="font-logo text-xl text-[#0C2D48] lg:text-2xl">한여름<span class="text-[#1AA7C7]">.</span></p>
      <p class="mt-2">상호: ${ph(z.name, '한여름')} | 대표: ${ph(z.ceo, 'OOO')} | 사업자등록번호: ${ph(z.bizNo, 'OOO-OO-OOOOO')}</p>
      <p>통신판매업 신고: ${ph(z.mailOrderNo, '제OOOO-서울OO-OOOO호')} | 주소: ${ph(z.address, '서울특별시 OO구 OO로 OO')}</p>
      <p>고객센터: ${ph(C.CS_PHONE, 'OOOO-OOOO')}${C.CS_EMAIL ? ` | 이메일: ${esc(C.CS_EMAIL)}` : ''}</p></div>
    <div class="mt-5 hidden lg:mt-0 lg:block"><p class="font-bold text-sea">서비스</p><ul class="mt-3 space-y-2">${Object.entries(KINDS).map(([k, v]) => `<li><button type="button" data-act="qcat" data-id="${k}" class="hover:text-sea">${v.title}</button></li>`).join('')}<li><button type="button" data-act="mkt" class="hover:text-sea">중고마켓</button></li></ul></div>
    <div class="mt-5 hidden lg:mt-0 lg:block"><p class="font-bold text-sea">고객지원</p><ul class="mt-3 space-y-2"><li><button type="button" data-act="guarantee" class="hover:text-sea">14일 재점검 안심 보장</button></li><li><button type="button" data-act="cs" class="hover:text-sea">고객센터 · 1:1 문의</button></li><li><button type="button" data-act="gopro" class="hover:text-sea">기사님 등록</button></li><li><button type="button" data-act="install" class="hover:text-sea">앱 설치 안내</button></li></ul></div></div>
  <p class="mt-5 flex flex-wrap gap-x-3 font-bold text-slate-500">${C.TERMS_URL ? `<a class="underline" href="${esc(C.TERMS_URL)}" target="_blank" rel="noopener">이용약관</a>` : ''}${C.PRIVACY_URL ? `<a class="underline" href="${esc(C.PRIVACY_URL)}" target="_blank" rel="noopener">개인정보처리방침</a>` : ''}<a class="underline" href="delete-account.html">회원 탈퇴 안내</a></p>
  <p class="mt-3 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 lg:text-xs">한여름은 당사자 간 매칭을 제공하는 중개 플랫폼이며, 거래 및 운송 자체의 당사자가 아닙니다. (14일 재점검 안심 보장제 운영)</p>
  <p class="mt-3">&copy; ${new Date().getFullYear()} 한여름. All rights reserved.</p>`;
  qShow(1); qm.classList.add('hidden');
  netState(); setTimeout(instShow, 4000);
  if (!standalone()) $('#hero-inst').classList.remove('hidden');
  /* 앱 바로가기(아이콘 길게 누르기): ?go=quote / market / pros */
  try { const q = new URLSearchParams(location.search), go = q.get('go');
    if (go || q.has('app')) { q.delete('go'); q.delete('app'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
    if (go) setTimeout(() => { if (go === 'market') openMarket(); else if (go === 'pros') openPros(); else if (go === 'quote') openQuote({}); else if (go === 'delete') delModal(); }, 1500);
  } catch (e) {}
  if (!sb) { $('#setup-warn').classList.remove('hidden'); render(); return; }
  render();
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') setTimeout(newPwModal, 400);
    if (ev === 'TOKEN_REFRESHED') return;
    const id = session && session.user ? session.user.id : null;
    if (ev === 'INITIAL_SESSION' || id !== (me() || null)) setTimeout(() => onSession(session), 0);
  });
})();
