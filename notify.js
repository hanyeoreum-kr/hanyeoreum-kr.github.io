/* =====================================================================
   한여름 추가 기능 (app.js 다음에 불러와요)
   1) 견적 요청서 3단계: 휴대폰 번호 + 카카오톡 알림 동의
   2) 기사님이 견적을 내면 → 손님에게 첫 견적 알림톡 (서버 함수 alimtalk)
   3) 예치금 충전: 카드가 안 되면 고객센터로 계좌이체 문의
   4) 관리자: 계좌이체 수동 충전
   ===================================================================== */
'use strict';
(function () {
  if (typeof S === 'undefined' || typeof ACT === 'undefined') return;

  /* ---------- 휴대폰 번호 도구 ---------- */
  const phDigits = s => String(s || '').replace(/\D/g, '').slice(0, 11);
  const phFmt = d => d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3) : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
  const phOk = d => /^01[016789]\d{7,8}$/.test(d);
  const phMask = d => d.slice(0, 3) + '-****-' + d.slice(-4);
  const NP = { saved:null, pending:null };

  /* ---------- 1) 요청서 3단계에 번호 칸 넣기 ---------- */
  const step3 = document.querySelector('#qm [data-step="3"]');
  if (step3 && !document.getElementById('qm-phone')) {
    step3.insertAdjacentHTML('beforeend', `
      <div id="qm-phonebox" class="mt-6 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
        <p class="text-base font-black leading-snug">💬 견적이 오면 <span class="text-brand">카톡으로</span> 알려드려요</p>
        <div id="qm-phone-in" class="mt-1">
        <ul class="mt-2 space-y-1 text-xs font-bold text-sea/70"><li>🔒 번호는 기사님께 <span class="text-sun">절대 공개되지 않아요</span></li><li>💬 기사님과는 한여름 안심채팅으로만 대화해요</li><li>📵 광고·스팸 문자는 보내지 않아요</li><li>💸 견적 요청·비교는 끝까지 무료예요</li></ul>
        <label for="qm-phone" class="mt-3 block text-sm font-bold">📱 휴대폰 번호</label>
        <input id="qm-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" class="mt-2 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
        <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="qm-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand">
          <span>견적 도착 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요 <b class="text-sun">(필수)</b>
          <details class="mt-1"><summary class="cursor-pointer text-xs font-bold text-cool">내용 보기</summary><span class="mt-1 block rounded-lg bg-white p-2 text-xs leading-relaxed">항목: 휴대폰 번호<br>목적: 견적 도착 등 견적·계약 진행 알림 발송<br>보유 기간: 회원 탈퇴 또는 동의 철회 시까지<br>발송 대행: 솔라피(SOLAPI) · 카카오<br>번호는 기사님께 제공하지 않아요. 동의하지 않으면 견적 요청을 보낼 수 없어요. 자세한 내용은 <a href="privacy.html" target="_blank" rel="noopener" class="underline">개인정보처리방침</a>을 확인해 주세요.</span></details></span></label>
        </div>
      </div>`);
    const tg = document.getElementById('qm-phone-tg');
    if (tg) tg.addEventListener('click', () => phoneOpen(document.getElementById('qm-phone-in').classList.contains('hidden')));
    const inp = document.getElementById('qm-phone');
    inp.addEventListener('input', () => { inp.value = phFmt(phDigits(inp.value)); });
  }

  function phoneOpen(on) {
    const bx = document.getElementById('qm-phone-in'), tg = document.getElementById('qm-phone-tg'), ar = document.getElementById('qm-phone-ar');
    if (!bx) return; bx.classList.toggle('hidden', !on); if (tg) tg.setAttribute('aria-expanded', on ? 'true' : 'false'); if (ar) ar.textContent = on ? '▴' : '▾';
    if (on) { const i = document.getElementById('qm-phone'); if (i && !i.value) setTimeout(() => { try { i.focus(); } catch (_) {} }, 50); }
  }
  async function fillPhone() {
    const inp = document.getElementById('qm-phone'), ag = document.getElementById('qm-agree');
    if (!inp || !S.user || !sb) return;
    if (!NP.saved || NP.saved.uid !== me()) {
      try {
        const { data } = await sb.from('customer_phones').select('phone, notify_ok').eq('user_id', me()).maybeSingle();
        NP.saved = { uid:me(), phone:data ? data.phone : '', notify_ok:!!(data && data.notify_ok) };
      } catch (_) { NP.saved = { uid:me(), phone:'', notify_ok:false }; }
    }
    if (!inp.value && NP.saved.phone) { inp.value = phFmt(NP.saved.phone); if (NP.saved.notify_ok && ag) ag.checked = true; phoneOpen(true); }
  }
  async function savePhone(d) {
    if (!S.user || !sb) return;
    const now = new Date().toISOString();
    const { error } = await sb.from('customer_phones').upsert({ user_id:me(), phone:d, notify_ok:true, agreed_at:now, updated_at:now });
    if (error) { console.warn('phone save', error.message); return; }
    NP.saved = { uid:me(), phone:d, notify_ok:true };
  }

  /* '견적 요청 보내기'를 누르면 번호·동의부터 확인 (app.js의 처리보다 먼저 실행돼요) */
  const qmEl = document.getElementById('qm');
  if (qmEl) qmEl.addEventListener('click', e => {
    if (!e.target.closest('#qm-next') || qstep !== 3) return;
    const inp = document.getElementById('qm-phone'), ag = document.getElementById('qm-agree');
    if (!inp) return;
    const d = phDigits(inp.value);
    const msg = !phOk(d) ? '알림 받을 휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)' : !(ag && ag.checked) ? '견적 도착 알림 수신에 동의해 주세요.' : '';
    if (msg) { e.stopPropagation(); e.preventDefault(); phoneOpen(true); qErr(msg); (phOk(d) ? ag : inp).focus(); return; }
    NP.pending = d; try { track('qphone3'); } catch (_) {}
  }, true);

  /* 단계 화면이 바뀔 때: 3단계면 저장된 번호 채우기, 4단계(접수 완료)면 번호 저장 */
  const _qShow = qShow;
  function laterPhone() {
    try {
      const old = document.getElementById('qm-phone-later'); if (old) old.remove();
      const sum = document.getElementById('qm-summary'); if (!sum) return;
      if (NP.saved && NP.saved.phone && NP.saved.notify_ok) return;
      sum.insertAdjacentHTML('beforebegin', `<div id="qm-phone-later" class="mt-5 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-left">
        <p class="font-black">💬 견적이 오면 카톡으로 알려 드릴까요? <span class="text-sm font-bold text-sea/60">(선택)</span></p>
        <p class="mt-1 text-xs leading-relaxed text-sea/70">번호는 기사님께 공개되지 않아요. 안 받아도 '내 요청'에서 견적을 볼 수 있어요.</p>
        <input id="pl-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" class="mt-3 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
        <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="pl-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand"><span>견적 도착 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요 <a href="privacy.html" target="_blank" rel="noopener" class="text-xs font-bold text-cool underline">내용 보기</a></span></label>
        <p id="pl-err" role="alert" class="mt-2 text-sm font-bold text-red-600"></p>
        <button type="button" id="pl-save" class="mt-2 w-full rounded-xl bg-sea py-3 font-bold text-white">카톡으로 받기</button></div>`);
      const i = document.getElementById('pl-phone'); if (i) i.addEventListener('input', () => { i.value = phFmt(phDigits(i.value)); });
    } catch (_) {}
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('#pl-save'); if (!b) return;
    const i = document.getElementById('pl-phone'), ag = document.getElementById('pl-agree'), er = document.getElementById('pl-err'), say = m => { if (er) er.textContent = m; };
    const d = phDigits(i && i.value);
    if (!phOk(d)) return say('휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');
    if (!(ag && ag.checked)) return say('알림 수신에 동의해 주세요.');
    b.disabled = true; b.textContent = '저장하는 중...';
    await savePhone(d);
    if (!(NP.saved && NP.saved.phone === d)) { b.disabled = false; b.textContent = '카톡으로 받기'; return say('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    try { track('qphone_late'); } catch (_) {}
    const box = document.getElementById('qm-phone-later'); if (box) box.innerHTML = `<p class="font-bold text-emerald-700">✅ 카톡 알림을 켰어요 <span class="font-normal text-sea/60">· ${esc(phMask(d))}</span></p>`;
  });
  qShow = function (n) {
    const gave = !!NP.pending;
    _qShow(n);
    if (n === 3) fillPhone();
    if (n === 4 && NP.pending) {
      const d = NP.pending; NP.pending = null;
      savePhone(d);
      const sum = document.getElementById('qm-summary');
      if (sum) sum.insertAdjacentHTML('beforeend', `<div class="flex justify-between gap-4"><dt class="text-sea/60">카톡 알림</dt><dd class="font-bold text-right">${esc(phMask(d))}</dd></div>`);
    }
  };

  /* ---------- 2) 기사님이 견적을 내면 손님 알림톡 요청 ---------- */
  const _qsend = ACT.qsend;
  ACT.qsend = async (id, el) => {
    await _qsend(id, el);
    if (sb && S.quo.some(q => q.request_id === +id && q.pro_id === me())) {
      sb.functions.invoke('alimtalk', { body:{ request_id:+id } }).catch(() => {});
    }
  };

  /* ---------- 3) 충전 화면: 카드가 안 되면 고객센터 문의 ---------- */
  const cardHelp = () => `<div id="card-help" class="mt-3 rounded-xl border border-mist bg-ice p-3 text-sm">
    <p class="font-bold">결제가 안 되나요?</p>
    <p class="mt-1 text-xs leading-relaxed text-sea/70">사용할 수 있는 카드가 없으면 고객센터로 문의해 주세요. 계좌이체 충전 방법을 안내해 드려요.</p>
    <div class="mt-2">${btn('inqcharge', '', '계좌이체 충전 문의하기', 's')}</div></div>`;
  /* 카드 안내 문구는 쓰지 않아요 (삼성카드 외에는 모두 결제돼요) */
  const fixTopNotice = () => {};
  const _wallet = walletModal;
  walletModal = function (keep) {
    _wallet(keep);
    try {
      fixTopNotice();
      /* 모든 결제수단이 열려서 '결제가 안 되나요?' 안내는 더 이상 띄우지 않아요 */
    } catch (_) {}
  };
  ACT.inqcharge = () => {
    iq = { cat:'ETC', cid:'', issue:'NO_SHOW', title:'예치금 계좌이체 충전 문의', body:'사용할 수 있는 카드가 없어 계좌이체로 충전하고 싶어요.\n충전할 금액: 원\n입금자명: ' };
    inqForm();
  };

  /* ---------- 4) 관리자: 계좌이체 수동 충전 ---------- */
  const _adminView = adminView;
  adminView = function () {
    _adminView();
    try {
      if (!S.admin || document.getElementById('mc-open')) return;
      const h = [...document.querySelectorAll('#pview h2')].find(x => x.textContent.trim() === '예치금 충전 확인');
      if (!h) return;
      const p = h.nextElementSibling && h.nextElementSibling.tagName === 'P' ? h.nextElementSibling : h;
      p.insertAdjacentHTML('afterend', `<div id="mc-open" class="mt-3 rounded-2xl bg-ice p-3"><p class="text-xs leading-relaxed text-sea/70">카드가 안 돼서 고객센터로 문의한 기사님이 통장에 입금하면, 확인 후 여기서 넣어 주세요.</p><div class="mt-2">${btn('mcharge', '', '✍️ 계좌이체 수동 충전', 'a')}</div></div>`);
    } catch (_) {}
  };
  ACT.mcharge = () => {
    if (!S.admin) return;
    const inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5';
    const ps = [...S.adminPros].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    openM(head('계좌이체 수동 충전') + `<p class="text-sm leading-relaxed text-sea/70">통장에 들어온 입금을 <b>먼저 확인한 뒤</b> 넣어 주세요. 넣으면 바로 기사님 예치금에 더해지고, 예치금 내역과 세무용 엑셀에도 '충전'으로 남아요.</p>
      <label for="mc-pro" class="block mt-4 text-sm font-bold">기사님</label>
      <select id="mc-pro" class="${inp}"><option value="">기사님을 고르세요</option>${ps.map(p => `<option value="${esc(p.id)}">${esc(p.name || '이름 없음')} · 현재 ${won(p.balance)}</option>`).join('')}</select>
      <label for="mc-amt" class="block mt-4 text-sm font-bold">입금 확인한 금액 (원)</label>${moneyInp('mc-amt', '', inp)}
      <label for="mc-memo" class="block mt-4 text-sm font-bold">입금자명</label><input id="mc-memo" maxlength="20" class="${inp}">${errBox()}
      <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('mchargego', '', '예치금 넣기')}</div>`);
    menuCur = 'mcharge';
  };
  ACT.mchargego = (id, el) => {
    const pro = (document.getElementById('mc-pro') || {}).value, amt = moneyVal('#mc-amt'), memo = ((document.getElementById('mc-memo') || {}).value || '').trim();
    if (!pro) return setErr('기사님을 골라 주세요.');
    if (!(amt >= 1000)) return setErr('금액을 1,000원 이상으로 넣어 주세요.');
    if (!memo) return setErr('입금자명을 적어 주세요.');
    if (!confirmBox(el)) return;
    busy(el, async () => {
      await rpc('admin_manual_charge', { p_pro:pro, p_amount:amt, p_memo:memo });
      closeM();
      await Promise.all(['chg', 'led', 'adminPros', 'aud', 'inc'].map(load));
      render(); toast(`${won(amt)}을 예치금에 넣었어요.`);
    });
  };
  /* ---------- 5) 안심 채팅: 위쪽에 고객 요청 내용(이름·사진·요청사항) 보여주기 ---------- */
  let reqCardOpen = true;
  const reqsOfThread = t => {
    const c = t.contract_id ? S.con.find(x => x.id === t.contract_id) : null;
    if (c && c.request_id) { const r = S.req.find(x => x.id === c.request_id) || S.adminReq.find(x => x.id === c.request_id); return r ? [r] : []; }
    const quoted = id => S.quo.some(q => q.request_id === id && q.pro_id === t.u2);
    const other = r => S.con.some(c => c.request_id === r.id && c.provider_id !== t.u2);
    return S.req.filter(r => r.customer_id === t.u1 && r.status !== 'closed' && !other(r))
      .sort((a, b) => ((b.status === 'open') - (a.status === 'open')) || (quoted(b.id) - quoted(a.id)) || b.id - a.id).slice(0, 2);
  };
  const reqCard = (t, rs) => `<details id="chat-req" class="mt-3 rounded-2xl border-2 border-brand-200 bg-brand-50 p-3"${reqCardOpen ? ' open' : ''}>
    <summary class="cursor-pointer text-sm font-bold">📋 고객 요청 내용 · ${esc(t.u1_name || '고객')} 고객님</summary>
    ${rs.map(r => `<div class="mt-2 rounded-xl bg-white p-3 text-sm">
      <p class="font-bold">${esc(svcOf(r) || '')} · ${reqWhere(r)} <span class="text-xs font-normal text-sea/60">${reqCode(r.id)} · 희망일 ${esc(r.wish_date || '-')}</span></p>
      <p class="mt-1 whitespace-pre-wrap leading-relaxed">${esc(r.details) || '<span class="text-sea/50">요청사항 없음</span>'}</p>
      ${(r.photos || []).filter(isPhotoUrl).length ? `<div class="mt-2 flex flex-wrap gap-2">${r.photos.filter(isPhotoUrl).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="고객 사진 ${i + 1}" loading="lazy" class="h-16 w-16 rounded-lg object-cover"></a>`).join('')}</div><p class="mt-1 text-[11px] text-sea/50">사진을 누르면 크게 보여요</p>` : ''}</div>`).join('')}</details>`;
  const _chat = chatModal;
  chatModal = async function (tid, keep) {
    await _chat(tid, keep);
    try {
      const t = S.thr.find(x => x.id === +tid), box = document.getElementById('chatbox');
      if (!t || !box || document.getElementById('chat-req')) return;
      const rs = reqsOfThread(t); if (!rs.length) return;
      box.insertAdjacentHTML('beforebegin', reqCard(t, rs));
      const d = document.getElementById('chat-req');
      d.addEventListener('toggle', () => { reqCardOpen = d.open; });
    } catch (_) {}
  };
  /* ---------- 6) 견적 요청 2단계: 기기 종류·대수 (청소는 평수) ---------- */
  /* 요청서 화면이 옆으로 밀리지 않게 (아이폰 날짜칸·긴 목록 대비) */
  { const st = document.createElement('style'); st.textContent = '#qm,#qm .overflow-y-auto{overflow-x:hidden;overscroll-behavior-x:none}#qm .overflow-y-auto{touch-action:pan-y pinch-zoom}#qm input,#qm select,#qm textarea{max-width:100%;min-width:0;box-sizing:border-box}#qm input[type=date]{display:block;width:100%}#qm .overflow-y-auto{overflow-anchor:none}#mm,#mm-body{overflow-x:hidden;overscroll-behavior-x:none}#mm-body{touch-action:pan-y pinch-zoom}#mm input,#mm select,#mm textarea{max-width:100%;min-width:0;box-sizing:border-box}#mm input[type=date]{display:block;width:100%;min-height:3.25rem;-webkit-appearance:none;appearance:none}'; document.head.appendChild(st); }
  const DEV = {
    aircon:{ t:'에어컨 종류와 대수', items:['벽걸이', '스탠드', '2in1 (스탠드+벽걸이)', '천장형 1way', '천장형 2way', '천장형 4way', '창문형', '실외기'] },
    heat:{ t:'보일러·온수기 종류와 대수', items:['가스보일러', '기름보일러', '전기보일러', '온수기', '라디에이터'] },
    cold:{ t:'설비 종류와 대수', items:['업소용 냉장고', '업소용 냉동고', '냉장·냉동 겸용', '테이블 냉장고', '쇼케이스', '제빙기', '저온창고'] },
    kitchen:{ t:'설비 종류와 대수', items:['식기세척기', '후드·덕트', '가스레인지·화구', '오븐', '튀김기', '기타 주방설비'] },
    home:{ t:'가전 종류와 대수', items:['통돌이 세탁기', '드럼 세탁기', '건조기', '가정용 냉장고', '김치냉장고', '식기세척기', '정수기', '기타 가전'] }
  };
  /* 배관·하수구: 대수 대신 '어디가 / 어떤 건물 / 얼마나 급한지'를 눌러서 골라요 */
  const PL = {
    where:{ t:'문제가 생긴 곳', multi:true, items:['싱크대', '화장실 변기', '세면대', '욕실 바닥 배수구', '베란다 배수구', '세탁기 배수', '수도 계량기', '외부 하수구·맨홀', '천장·벽(누수)', '식당 주방 배관'] },
    bld:{ t:'건물 종류', items:['아파트', '빌라·주택', '오피스텔', '상가·식당', '사무실·공장'] }
  };
  const PV = { where:[], bld:'', hurry:'' };
  const plLine = () => { const p = []; if (PV.where.length) p.push('위치: ' + PV.where.join('·')); if (PV.bld) p.push('건물: ' + PV.bld); if (PV.hurry) p.push('급함: ' + PV.hurry); return p.length ? '[상황] ' + p.join(' / ') : ''; };
  const plChip = (g, x, on) => `<button type="button" data-pl="${g}" data-v="${x}" aria-pressed="${on}" class="rounded-full border-2 px-3 py-2 text-sm font-bold ${on ? 'border-brand bg-brand-50 text-brand' : 'border-mist bg-white'}">${x}</button>`;
  const PY = ['10평 미만', '10평대', '20평대', '30평대', '40평대', '50평대', '60평 이상'];
  const RT = ['원룸', '1.5룸', '투룸', '쓰리룸', '4룸 이상', '상가·사무실'];
  const DV = { kind:'', counts:{}, py:'', rt:'', pyn:'' };
  const cleanTxt = () => [DV.rt, DV.pyn ? DV.pyn + '평' : ''].filter(Boolean).join(' · ');
  const devKind = () => qform.service === 'truck' || !qform.service ? '' : (qform.etc || kindOf(qform.service));
  const devTotal = () => Object.values(DV.counts).reduce((a, b) => a + b, 0);
  const devLine = () => DV.kind === 'plumb' ? plLine() : DV.kind === 'clean' ? (cleanTxt() ? `[평수] ${cleanTxt()}` : '') : (devTotal() ? '[기기] ' + Object.entries(DV.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}대`).join(' · ') : '');
  function devRender0() {
    const sec = document.querySelector('#qm [data-step="2"]'); if (!sec) return;
    const k = devKind(); if (k !== DV.kind) { DV.kind = k; DV.counts = {}; DV.py = ''; DV.rt = ''; DV.pyn = ''; PV.where = []; PV.bld = ''; PV.hurry = ''; }
    let box = document.getElementById('qm-dev');
    if (!DEV[k] && k !== 'clean' && k !== 'plumb') { if (box) box.remove(); return; }
    if (!box) { sec.insertAdjacentHTML('beforeend', '<div id="qm-dev"></div>'); box = document.getElementById('qm-dev'); }
    const opt = true; /* 선택 사항: 몰라도 다음 단계로 넘어갈 수 있어요 */
    if (k === 'plumb') {
      box.innerHTML = Object.entries(PL).map(([g, v]) => `<p class="mt-5 text-sm font-bold">${v.t} <span class="font-normal text-sea/60">(선택${v.multi ? ' · 여러 개 가능' : ''})</span></p>
        <div class="mt-2 flex flex-wrap gap-1.5">${v.items.map(x => plChip(g, x, v.multi ? PV[g].includes(x) : PV[g] === x)).join('')}</div>`).join('')
        + `<p class="mt-3 rounded-xl bg-ice px-3 py-2 text-xs leading-relaxed text-sea/70">📸 막힌 곳·물 새는 곳 사진을 다음 단계에서 올려 주시면 기사님이 더 정확한 견적을 보내요.</p>`;
      return;
    }
    if (k === 'clean') {
      box.innerHTML = `<p class="mt-5 text-sm font-bold">집 구조 <span class="font-normal text-sea/60">(선택)</span></p>
        <div class="mt-2 grid grid-cols-3 gap-2">${RT.map(x => `<button type="button" data-rt="${x}" aria-pressed="${DV.rt === x}" class="rounded-xl border-2 px-1 py-2.5 text-sm font-bold ${DV.rt === x ? 'border-brand bg-brand-50 text-brand' : 'border-mist bg-white'}">${x}</button>`).join('')}</div>
        <p class="mt-4 text-sm font-bold">정확한 평수 <span class="font-normal text-sea/60">(선택 · 아는 만큼)</span></p>
        <div class="mt-2 flex items-center gap-2"><input id="qm-py" type="number" inputmode="decimal" min="1" max="500" step="0.5" value="${esc(DV.pyn)}" placeholder="예) 24" aria-label="평수" class="min-w-0 flex-1 rounded-xl border-2 border-mist bg-white px-4 py-3 text-base font-bold"><span class="shrink-0 font-bold">평</span></div>
        <p class="mt-1 text-xs text-sea/60">전용면적(㎡)만 아시면 ㎡ ÷ 3.3 이 평수예요. 잘 모르겠으면 비워 두셔도 돼요.</p>`;
      return;
    }
    box.innerHTML = `<p class="mt-5 text-sm font-bold">${DEV[k].t} ${opt ? '<span class="font-normal text-sea/60">(선택)</span>' : '<span class="text-sun">(필수)</span>'}</p>
      <p class="mt-1 text-xs text-sea/60">아는 만큼만 + 로 눌러 주세요. <b>잘 모르겠으면 비워 두고 다음 단계에서 사진만 올려도 돼요.</b></p>
      <ul class="mt-2 divide-y divide-mist rounded-2xl border border-mist bg-white">${DEV[k].items.map(it => { const n = DV.counts[it] || 0; return `<li class="flex items-center gap-2 px-3 py-2.5"><span class="min-w-0 flex-1 text-sm font-bold ${n ? 'text-brand' : ''}">${it}</span>
        <button type="button" data-dv="${it}" data-d="-1" aria-label="${it} 한 대 빼기" class="h-8 w-8 rounded-full bg-ice font-bold ${n ? '' : 'opacity-40'}">−</button><span class="w-8 text-center font-bold tabular-nums">${n}</span><button type="button" data-dv="${it}" data-d="1" aria-label="${it} 한 대 더하기" class="h-8 w-8 rounded-full bg-brand font-bold text-white">+</button></li>`; }).join('')}</ul>
      ${devTotal() ? `<p class="mt-2 text-right text-sm font-bold text-brand">총 ${devTotal()}대</p>` : ''}`;
  }
  /* 선택 사항은 접어 둘 수 있어요 (기본: 펼침) */
  let DVOPEN = true, DVLAST = '';
  function devRender() {
    const sc = document.querySelector('#qm .overflow-y-auto'), top = sc ? sc.scrollTop : 0;
    try { devRender1(); } finally { if (sc) sc.scrollTop = top; }
  }
  function devRender1() {
    devRender0();
    const box = document.getElementById('qm-dev'); if (!box || !box.innerHTML.trim()) return;
    const k = DV.kind; if (k !== DVLAST) { DVLAST = k; DVOPEN = true; }
    const t = k === 'plumb' ? '문제 상황 알려주기' : k === 'clean' ? '집 구조·평수' : (DEV[k] ? DEV[k].t : '');
    const sum = k === 'plumb' ? (PV.where.length || PV.bld || PV.hurry ? ' · 입력됨' : '') : k === 'clean' ? (cleanTxt() ? ' · ' + cleanTxt() : '') : (devTotal() ? ` · 총 ${devTotal()}대` : '');
    let inner = box.innerHTML; if (k !== 'plumb') inner = inner.replace(/^\s*<p class="mt-5 text-sm font-bold">[\s\S]*?<\/p>\s*/, '');
    box.innerHTML = `<button type="button" data-dvt="1" aria-expanded="${DVOPEN}" class="mt-5 flex w-full items-center justify-between rounded-xl bg-ice px-4 py-3 text-left"><span class="min-w-0 text-sm font-bold">${t} <span class="font-normal text-sea/60">(선택)${sum}</span></span><span aria-hidden="true" class="ml-2 shrink-0 text-xs font-bold text-sea/60">${DVOPEN ? '▲ 접기' : '▼ 펼치기'}</span></button><div class="${DVOPEN ? '' : 'hidden'}">${inner}</div>`;
  }
  document.addEventListener('click', e => {
    const tg = e.target.closest('#qm-dev [data-dvt]'); if (tg) { DVOPEN = !DVOPEN; devRender(); return; }
    const b = e.target.closest('#qm-dev [data-dv], #qm-dev [data-rt], #qm-dev [data-pl]'); if (!b) return;
    if (b.dataset.pl) { const g = b.dataset.pl, x = b.dataset.v; if (PL[g].multi) PV[g] = PV[g].includes(x) ? PV[g].filter(y => y !== x) : [...PV[g], x]; else PV[g] = PV[g] === x ? '' : x; }
    else if (b.dataset.rt) DV.rt = DV.rt === b.dataset.rt ? '' : b.dataset.rt;
    else { const it = b.dataset.dv, n = Math.max(0, Math.min(50, (DV.counts[it] || 0) + +b.dataset.d)); if (n) DV.counts[it] = n; else delete DV.counts[it]; }
    qErr(''); devRender();
  });
  document.addEventListener('input', e => {
    const t = e.target; if (!t || t.id !== 'qm-py') return;
    let v = String(t.value || '').replace(/[^0-9.]/g, ''); if (+v > 500) v = '500'; DV.pyn = v;
    const sp = document.querySelector('#qm-dev [data-dvt] span.font-normal'); if (sp) sp.textContent = '(선택)' + (cleanTxt() ? ' · ' + cleanTxt() : '');
  });
  /* 2단계 '다음'을 누르면: 필수 확인 → 요청사항 맨 위에 한 줄로 적어 둬요 (기사님이 그대로 봐요) */
  if (qmEl) qmEl.addEventListener('click', e => {
    if (!e.target.closest('#qm-next') || qstep !== 2) return;
    const k = DV.kind; if (!DEV[k] && k !== 'clean' && k !== 'plumb') return;
    const d = document.getElementById('qm-details'); if (!d) return;
    const rest = d.value.replace(/^\[(기기|평수|상황)\][^\n]*\n?/, ''), line = devLine();
    d.value = line ? line + (rest ? '\n' + rest : '') : rest;
    d.dispatchEvent(new Event('input', { bubbles:true }));
  }, true);
  const _qShow2 = qShow;
  qShow = function (n) { _qShow2(n); if (n === 2) devRender(); if (n === 4) { DV.kind = ''; DV.counts = {}; DV.py = ''; DV.rt = ''; DV.pyn = ''; PV.where = []; PV.bld = ''; PV.hurry = ''; } };
  /* ---------- 7) 거래 마무리: 성사 기사님 표시 · 고객 직접 확정 · 관리자 대신 완료 요청 ---------- */
  const conOfReq = id => S.con.find(c => c.request_id === id);
  const CST = c => c.status === 'completed' ? '거래 확정' : c.status === 'pending' ? '고객 확인 대기' : '진행 중';
  const feeTxt = c => c.fee_waived ? '면제(기사님 손님)' : c.fee_charged ? `${won(c.fee)} 차감 완료` : `${won(c.fee)} (확정 때 차감)`;
  const overdue = c => c.kind === 'service' && c.status === 'confirmed' && (!c.work_date || c.work_date <= today());

  /* 관리자 요청 목록: 성사된 기사님 이름 */
  const _adminView2 = adminView;
  adminView = function () {
    _adminView2();
    try {
      if (!S.admin) return;
      const list = S.con.filter(overdue);
      const h = [...document.querySelectorAll('#pview h2')].find(x => x.textContent.trim() === '고객 견적 요청 한눈에 보기');
      if (h && list.length && !document.getElementById('hy-overdue')) {
        h.closest('section').insertAdjacentHTML('afterend', `<section id="hy-overdue" class="mt-6 rounded-3xl border-2 border-sun bg-sun/5 p-5 sm:p-6">
          <h2 class="text-xl font-bold">작업일이 지났는데 완료 요청이 없는 예약 ${list.length}건</h2>
          <p class="mt-1 text-sm text-sea/70">기사님이 '작업 완료 요청'을 안 눌러서 수수료가 아직 안 빠진 건이에요. 작업이 끝난 게 확인되면 대신 눌러 주세요. 고객에게 확인 요청이 가고, 고객이 확정하지 않아도 ${S.autoH}시간 뒤 자동 확정돼요.</p>
          ${list.map(c => `<div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"><div><b>${conCode(c.id)} · ${conTitle(c)} · ${won(c.price)}</b><p class="text-xs text-sea/60">👷 ${esc(c.provider_name)} ↔ ${esc(c.client_name)} · 작업일 ${esc(c.work_date || '미정')}</p></div>${btn('acomp', c.id, '완료 요청 대신 보내기', 'a')}</div>`).join('')}</section>`);
      }
    } catch (_) {}
  };
  ACT.acomp = (id, el) => {
    if (!confirmBox(el)) return;
    busy(el, async () => { await rpc('start_completion', { p_contract:+id }); await load('con'); render(); toast(`완료 요청을 보냈어요. 고객이 확인하지 않아도 ${S.autoH}시간 뒤 자동 확정돼요.`); });
  };

  /* 관리자 요청 상세: 예약 정보 */
  const _areq = areqModal;
  areqModal = function (id) {
    _areq(id);
    try {
      const c = conOfReq(+id), body = document.getElementById('mm-body'); if (!c || !body) return;
      const close = body.querySelector('[data-mclose].' + B.s.split(' ')[0]) || [...body.querySelectorAll('[data-mclose]')].pop();
      const box = `<div class="mt-5 rounded-2xl border-2 border-sea/15 bg-ice p-4 text-sm"><p class="font-bold">🤝 예약 정보 · ${conCode(c.id)}</p>
        <dl class="mt-2 grid grid-cols-[84px_1fr] gap-y-1.5"><dt class="text-sea/60">기사님</dt><dd class="font-bold">${esc(c.provider_name || '')}</dd><dt class="text-sea/60">예약 금액</dt><dd class="font-bold">${won(c.price)}${c.final_price != null ? ` → 최종 ${won(c.final_price)}` : ''}</dd>
        <dt class="text-sea/60">작업일</dt><dd class="font-bold">${esc(c.work_date || '미정')}</dd><dt class="text-sea/60">상태</dt><dd class="font-bold">${CST(c)}</dd><dt class="text-sea/60">수수료</dt><dd class="font-bold">${feeTxt(c)}</dd></dl>
        ${overdue(c) ? `<div class="mt-3">${btn('acomp', c.id, '완료 요청 대신 보내기', 'a')}</div>` : ''}</div>`;
      if (close && close.parentElement) close.parentElement.insertAdjacentHTML('beforebegin', box); else body.insertAdjacentHTML('beforeend', box);
    } catch (_) {}
  };

  /* 고객: 기사님이 완료 요청을 안 눌러도 '작업 끝났어요'로 직접 확정 */
  const _cfin = ACT.cfin;
  ACT.cfin = async (id, el) => {
    const c = S.con.find(x => x.id === +id);
    if (c && c.kind === 'service' && c.status === 'confirmed' && c.client_id === me()) {
      try { await rpc('start_completion', { p_contract:c.id }); await load('con'); }
      catch (e) { return toast(errMsg(e)); }
    }
    return _cfin(id, el);
  };
  const _custMenu = custMenu;
  custMenu = function (keep) {
    _custMenu(keep);
    try {
      S.con.filter(c => c.client_id === me() && overdue(c)).forEach(c => {
        const r = document.querySelector(`#mm-body [data-act="rcpt"][data-id="${c.id}"]`);
        if (r && !document.getElementById('hy-done-' + c.id)) r.insertAdjacentHTML('beforebegin', `<span id="hy-done-${c.id}" class="w-full rounded-xl bg-brand-50 p-3 text-sm"><b>작업이 끝났나요?</b> 결제한 금액을 확인하고 거래를 확정해 주세요. 확정하면 무상 A/S 보증서가 발급돼요.<span class="mt-2 block">${btn('cfin', c.id, '✅ 작업 끝났어요 · 거래 확정', 'a')}</span></span>`);
      });
    } catch (_) {}
  };
  /* ---------- 8) 관리자 요청 목록: 계약 성사 / 거래 완료 구분 · 성사 기사님 ---------- */
  const conOfR = r => conOfReq(r.id);
  const rstate = r => { const c = conOfR(r); if (r.status === 'matched' || c) return c && c.status === 'completed' ? 'fin' : 'done'; return r.status !== 'open' ? 'closed' : reqQs(r.id).length ? 'got' : 'wait'; };
  RST.done = ['예약 확정', 'bg-sea text-white']; RST.fin = ['거래 완료', 'bg-emerald-600 text-white'];
  const conStep = c => !c ? '' : c.status === 'completed' ? `거래 완료 · 수수료 ${won(c.fee)}${c.fee_waived ? ' 면제' : ' 차감'}` : c.status === 'pending' ? `완료 확인 대기 · 자동 확정까지 ${hms(remainMs(c))}` : '작업 진행 중 · 완료 요청 전';
  reqBoard = function () {
    const R = S.adminReq, t0 = T0(), wk = Date.now() - 7 * 24 * HR;
    const today = R.filter(r => +new Date(r.created_at) >= t0).length, week = R.filter(r => +new Date(r.created_at) >= wk);
    const late = R.filter(r => rstate(r) === 'wait' && Date.now() - new Date(r.created_at) > 2 * HR);
    const stuck = S.con.filter(overdue);
    const rate = week.length ? Math.round(week.filter(r => ['done', 'fin'].includes(rstate(r))).length / week.length * 100) : 0;
    const cnt = k => k === 'ALL' ? R.length : R.filter(r => rstate(r) === k).length;
    const list = (RF === 'ALL' ? R : R.filter(r => rstate(r) === RF)).slice(0, 200);
    const byGu = {}; week.forEach(r => byGu[r.gu] = (byGu[r.gu] || 0) + 1);
    const bySvc = {}; week.forEach(r => bySvc[r.service] = (bySvc[r.service] || 0) + 1);
    const top = (o, f) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `<span class="rounded-full bg-ice px-2.5 py-1 text-xs font-bold">${esc(f(k))} ${n}</span>`).join(' ') || '<span class="text-xs text-sea/50">아직 없어요</span>';
    const mini = (t, v, hot) => `<div class="rounded-2xl ${hot ? 'bg-sun/10 ring-2 ring-sun/40' : 'bg-ice'} p-3"><p class="text-xs text-sea/60">${t}</p><p class="mt-0.5 font-display text-2xl tabular-nums ${hot ? 'text-sun' : ''}">${v}</p></div>`;
    const row = r => { const s = rstate(r), st = RST[s], n = reqQs(r.id).length, c = conOfR(r), cu = custOf(r), isLate = s === 'wait' && Date.now() - new Date(r.created_at) > 2 * HR;
      return `<button type="button" data-act="areq" data-id="${r.id}" class="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-mist px-2 py-3 text-left hover:bg-ice sm:grid-cols-[92px_1.4fr_1fr_100px_90px_130px]">
        <span class="hidden text-xs text-sea/60 sm:block"><b class="block text-sea">${reqCode(r.id)}</b>${ago(r.created_at)}</span>
        <span class="min-w-0"><b class="block truncate">${esc(svcOf(r) || r.service)}${r.target_pro ? ' <span class="text-xs text-sun">지정</span>' : ''}${(r.photos || []).length ? ' <span class="text-xs text-sea/50">📷' + r.photos.length + '</span>' : ''}</b><span class="block truncate text-xs text-sea/60 sm:hidden">${reqCode(r.id)} · ${ago(r.created_at)} · ${esc(place(r.gu))} · 희망 ${esc(r.wish_date || '-')}</span>${c ? `<span class="block truncate text-xs font-bold text-brand">🤝 ${esc(c.provider_name)} · ${won(c.final_price != null ? c.final_price : c.price)}</span>` : ''}</span>
        <span class="hidden truncate text-sm sm:block">${esc(place(r.gu))}${r.to_gu ? ' → ' + esc(r.to_gu) : ''}</span>
        <span class="hidden text-sm tabular-nums sm:block">${esc(r.wish_date || '-')}</span>
        <span class="hidden truncate text-sm sm:block">${esc(cu.name || '고객')}</span>
        <span class="row-span-2 flex flex-col items-end gap-1 sm:row-span-1"><span class="rounded-full px-2.5 py-0.5 text-xs font-bold ${st[1]}">${st[0]}${!c && n ? ' ' + n : ''}</span>${c ? `<span class="text-right text-[11px] font-bold ${c.status === 'confirmed' ? 'text-sun' : 'text-sea/60'}">${c.status === 'completed' ? '수수료 ' + won(c.fee) : c.status === 'pending' ? '완료 확인 대기' : '완료 요청 전'}</span>` : ''}${isLate ? '<span class="text-[11px] font-bold text-red-600">2시간+ 무응답</span>' : ''}</span></button>`; };
    const fchip = (k, t) => `<button type="button" data-act="rfilt" data-id="${k}" aria-pressed="${RF === k}" class="${chipCls(RF === k)}">${t} ${cnt(k)}</button>`;
    return `<section class="mt-8 rounded-3xl border-2 border-cool/30 bg-white p-5 sm:p-6"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="text-xl font-bold">고객 견적 요청 한눈에 보기</h2><span class="text-xs text-sea/50">줄을 누르면 상세 내용 · 받은 견적 · 예약이 보여요</span></div>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">${mini('오늘 들어온 요청', today + '건')}${mini('최근 7일 요청', week.length + '건')}${mini('견적 0건 · 2시간 넘음', late.length + '건', late.length > 0)}${mini('작업일 지났는데 완료 요청 없음', stuck.length + '건', stuck.length > 0)}${mini('7일 예약 확정률', rate + '%')}</div>
      <div class="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><b class="mr-1 text-xs text-sea/60">많이 찾는 지역(7일)</b> ${top(byGu, place)}</p><p><b class="mr-1 text-xs text-sea/60">많이 찾는 서비스(7일)</b> ${top(bySvc, k => SVC[k] || k)}</p></div>
      <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="요청 상태 필터">${fchip('wait', '견적 대기')}${fchip('got', '견적 받음')}${fchip('done', '예약 확정')}${fchip('fin', '거래 완료')}${fchip('closed', '마감·취소')}${fchip('ALL', '전체')}</div>
      <div class="mt-3 hidden grid-cols-[92px_1.4fr_1fr_100px_90px_130px] gap-3 border-b-2 border-mist px-2 pb-2 text-xs font-bold text-sea/60 sm:grid"><span>번호·접수</span><span>서비스 · 성사 기사님</span><span>지역</span><span>희망일</span><span>고객</span><span class="text-right">상태</span></div>
      <div class="max-h-[520px] overflow-y-auto">${list.map(row).join('') || `<div class="mt-3">${empty(RF === 'wait' ? '견적을 기다리는 요청이 없어요. 👍' : '해당하는 요청이 없어요.')}</div>`}</div></section>`;
  };
  const _areq2 = areqModal;
  areqModal = function (id) {
    _areq2(id);
    try { const r = S.adminReq.find(x => x.id === +id), b = document.querySelector('#mm-body span.rounded-full'); if (r && b) { const st = RST[rstate(r)]; b.textContent = st[0]; b.className = `rounded-full px-2.5 py-0.5 text-xs font-bold ${st[1]}`; } } catch (_) {}
  };
  /* ---------- 9) 거래 확정은 고객만 (기사님은 '작업 완료 요청'까지) ---------- */
  const proSvc = c => c && c.kind === 'service' && c.provider_id === me() && c.client_id !== me();
  const _cfin9 = ACT.cfin;
  ACT.cfin = (id, el) => {
    const c = S.con.find(x => x.id === +id);
    if (proSvc(c)) {
      openM(head('거래 확정은 고객님이 해요') + `<p class="leading-relaxed text-sea/80">작업이 끝났다면 <b>[작업 완료 요청]</b>을 눌러 주세요. 고객님이 <b>실제 결제한 금액</b>을 확인하고 거래를 확정해요.</p>
        <p class="mt-2 text-sm text-sea/60">고객님이 확인하지 않으면 ${S.autoH}시간 뒤 자동 확정돼요.</p>
        <div class="mt-5 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button>${c.status === 'confirmed' ? wbtn('done', c.id, '작업 완료 요청') : ''}</div>`);
      return;
    }
    return _cfin9(id, el);
  };
  const stripProFin = () => document.querySelectorAll('#mm-body [data-act="cfin"]').forEach(b => { if (proSvc(S.con.find(x => x.id === +b.dataset.id))) b.remove(); });
  const _proMenu9 = proMenu;
  proMenu = function (keep) { _proMenu9(keep); try { stripProFin(); } catch (_) {} };
  const _chat9 = chatModal;
  chatModal = async function (tid, keep) { await _chat9(tid, keep); try { stripProFin(); } catch (_) {} };

  /* ---------- 10) 관리자: 최종 금액 정정 (수수료 차액 자동 차감·환급) ---------- */
  const fixPct = c => { if (c.fee_pct != null && !isNaN(+c.fee_pct)) return +c.fee_pct; const base = c.final_price != null ? c.final_price : c.price; return base > 0 ? Math.round((c.fee - 3500) * 100 / base) : 5; };
  const fixNew = (c, v) => (c.base_fee != null && +c.base_fee === 0) ? 1500 + Math.round(v * fixPct(c) / 100) : 3500 + Math.round(v * fixPct(c) / 100);
  const _adminView10 = adminView;
  adminView = function () {
    _adminView10();
    try {
      if (!S.admin || document.getElementById('fix-open')) return;
      const h = [...document.querySelectorAll('#pview h2')].find(x => x.textContent.trim() === '최근 예약'); if (!h) return;
      h.insertAdjacentHTML('afterend', `<div id="fix-open" class="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-ice p-3 text-sm"><span class="min-w-0 flex-1 text-sea/70">견적보다 실제 금액이 컸는데 견적 금액으로 확정된 거래는 최종 금액을 고치면 <b>수수료 차액이 기사님 예치금에서 자동으로 빠져요.</b></span>${btn('fixopen', '', '✏️ 최종 금액 정정', 'a')}</div>`);
    } catch (_) {}
  };
  ACT.fixopen = () => {
    const list = S.con.filter(c => c.kind === 'service' && c.status === 'completed' && !c.fee_waived && +c.fee_ver === 2).slice(0, 60);
    const inp = 'mt-2 w-full rounded-xl bg-ice px-4 py-3.5';
    openM(head('최종 금액 정정') + (list.length ? `<p class="text-sm leading-relaxed text-sea/70">고객님이 실제로 결제한 금액을 넣으면, 그 기사님 등급 %로 수수료를 다시 계산해서 <b>차액만</b> 예치금에서 빼거나 돌려줘요.</p>
      <label for="fx-con" class="block mt-4 text-sm font-bold">예약</label>
      <select id="fx-con" class="${inp}">${list.map(c => `<option value="${c.id}">${conCode(c.id)} · ${esc(SVC[c.service] || '')} · ${esc(c.provider_name)} · 확정 ${won(c.final_price != null ? c.final_price : c.price)} · 수수료 ${won(c.fee)}</option>`).join('')}</select>
      <label for="fx-amt" class="block mt-4 text-sm font-bold">실제 결제 금액 (원)</label>${moneyInp('fx-amt', '', inp)}
      <label for="fx-why" class="block mt-4 text-sm font-bold">정정 사유</label><input id="fx-why" maxlength="100" placeholder="예) 고객 확인 결과 실제 15만 원 결제" class="${inp}">
      <p id="fx-pre" class="mt-3 rounded-xl bg-brand-50 p-3 text-sm font-bold text-brand"></p>${errBox()}
      <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('fixgo', '', '정정하기')}</div>` : empty('정정할 수 있는 확정 거래가 없어요.')));
    menuCur = 'fix';
    const pre = () => { const c = S.con.find(x => x.id === +($('#fx-con') || {}).value), v = moneyVal('#fx-amt'), el = $('#fx-pre'); if (!el || !c) return;
      if (!v) { el.textContent = `지금: 확정 금액 ${won(c.final_price != null ? c.final_price : c.price)} · 수수료 ${won(c.fee)} (등급 ${fixPct(c)}%)`; return; }
      const nf = fixNew(c, v), d = nf - c.fee; el.textContent = `새 수수료 ${won(nf)} (${fixPct(c)}%${(c.base_fee != null && +c.base_fee === 0) ? ' + 1,500원' : ' + 3,500원'}) → ${d > 0 ? '기사님 예치금에서 ' + won(d) + ' 추가 차감' : d < 0 ? '기사님께 ' + won(-d) + ' 돌려줌' : '차액 없음'}`; };
    ['#fx-con', '#fx-amt'].forEach(sel => { const e = $(sel); if (e) { e.addEventListener('input', pre); e.addEventListener('change', pre); } }); pre();
  };
  ACT.fixgo = (id, el) => {
    const cid = +($('#fx-con') || {}).value, v = moneyVal('#fx-amt'), why = (($('#fx-why') || {}).value || '').trim();
    if (!cid) return setErr('예약을 골라 주세요.');
    if (!(v >= 1000)) return setErr('실제 결제 금액을 넣어 주세요.');
    if (!why) return setErr('정정 사유를 적어 주세요. 기사님 문의 때 근거가 돼요.');
    if (!confirmBox(el)) return;
    busy(el, async () => {
      const r = await rpc('admin_fix_final', { p_contract:cid, p_final:v, p_reason:why });
      closeM(); await Promise.all(['con', 'led', 'inc', 'adminPros', 'aud'].map(load)); render();
      toast(r && r.diff ? (r.diff > 0 ? `수수료 ${won(r.diff)}를 추가로 차감했어요.` : `수수료 ${won(-r.diff)}를 돌려줬어요.`) : '최종 금액을 정정했어요.');
    });
  };
  /* ---------- 11) 작업 완료 요청 → 손님에게 '작업 완료 확인 요청' 알림톡 ---------- */
  const askConfirm = cid => { const c = S.con.find(x => x.id === +cid); if (sb && c && c.status === 'pending') sb.functions.invoke('alimtalk', { body:{ contract_id:+cid } }).catch(() => {}); };
  ['done', 'acomp'].forEach(k => { const f = ACT[k]; if (!f) return; ACT[k] = async (id, el) => { await f(id, el); setTimeout(() => askConfirm(id), 900); }; });

  /* 카톡 버튼(?my=1)으로 들어오면: 로그인 후 '내 요청 관리'를 바로 열어요 */
  (() => {
    let q; try { q = new URLSearchParams(location.search); } catch (_) { return; }
    if (!q.has('my')) return;
    q.delete('my'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    const t0 = Date.now(); let asked = false;
    const tick = () => {
      if (S.user) { if (S.mode !== 'customer') setMode('customer'); setTimeout(() => custMenu(), 300); return; }
      if (!asked && Date.now() - t0 > 2500) { asked = true; toast('로그인하면 거래 확정 화면이 바로 열려요.'); authModal('login'); }
      if (Date.now() - t0 < 180000) setTimeout(tick, 700);
    };
    setTimeout(tick, 800);
  })();
  /* ---------- 12) 후기 사진 (최대 5장) ---------- */
  const RP = { cid:null, files:[] };
  const rpBlock = pfx => `<div id="${pfx}-ph" class="mt-3"><label class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cool/50 bg-ice py-3 text-sm font-bold hover:bg-mist">📷 작업 사진 추가 <span class="font-normal text-sea/60">(선택 · 최대 5장)</span><input id="${pfx}-file" type="file" accept="image/*" multiple class="sr-only"></label><ul id="${pfx}-thumbs" class="mt-2 grid grid-cols-5 gap-2"></ul></div>`;
  const rpDraw = pfx => { const u = document.getElementById(pfx + '-thumbs'); if (u) u.innerHTML = RP.files.map((f, i) => `<li class="relative aspect-square"><img src="${URL.createObjectURL(f)}" alt="후기 사진 ${i + 1}" class="h-full w-full rounded-lg object-cover"><button type="button" data-rprm="${i}" data-pfx="${pfx}" aria-label="사진 ${i + 1} 빼기" class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-sea text-sm leading-none text-white">&times;</button></li>`).join(''); };
  const rpReset = cid => { if (RP.cid !== +cid) { RP.cid = +cid; RP.files = []; } };
  document.addEventListener('change', e => {
    const m = e.target.id && e.target.id.match(/^(rm|rv|rx)-file$/); if (!m) return;
    for (const f of e.target.files) { if (RP.files.length >= 5) { toast('사진은 최대 5장까지 올릴 수 있어요.'); break; } if (f.type.startsWith('image/')) RP.files.push(f); }
    e.target.value = ''; rpDraw(m[1]);
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-rprm]'); if (!b) return; RP.files.splice(+b.dataset.rprm, 1); rpDraw(b.dataset.pfx); });
  async function rpSave(cid) {
    const c = S.con.find(x => x.id === +cid); if (!c || RP.cid !== +cid || !RP.files.length) return;
    const files = RP.files.slice(); RP.files = [];
    try {
      toast('후기 사진을 올리는 중이에요...');
      const photos = await uploadAll(files);
      const { error } = await sb.from('review_photos').upsert({ contract_id:c.id, pro_id:c.provider_id, customer_id:me(), photos });
      if (error) throw error;
      toast('후기와 사진이 등록됐어요. 감사합니다!');
    } catch (e) { console.warn('review photos', e); toast('후기는 등록됐지만 사진은 올리지 못했어요. ' + errMsg(e)); }
  }
  /* 별점 후기 창 (거래 확정 직후) */
  const rmBox = document.getElementById('rm-text');
  if (rmBox && !document.getElementById('rm-ph')) rmBox.insertAdjacentHTML('afterend', rpBlock('rm'));
  const _openRm = openRm;
  openRm = function (cid) { rpReset(cid); RP.files = []; _openRm(cid); rpDraw('rm'); };
  const _rmSubmit = rmSubmit;
  rmSubmit = async function () { const cid = rmCid; await _rmSubmit(); if (document.getElementById('rm').classList.contains('hidden') && reviewOf(cid)) await rpSave(cid); };
  /* 만족도 후기 창 (내 요청 관리 → 후기 작성) */
  const _revModal = revModal;
  revModal = function (cid) { rpReset(cid); _revModal(cid); try { const anchor = document.getElementById('merr'); if (anchor && !document.getElementById('rv-ph')) { anchor.insertAdjacentHTML('beforebegin', rpBlock('rv')); rpDraw('rv'); } } catch (_) {} };
  const _rvsend = ACT.rvsend;
  ACT.rvsend = async (id, el) => { await _rvsend(id, el); if (reviewOf(+id)) await rpSave(id); };
  /* 기사님 프로필: 고객이 올린 실제 작업 사진 */
  const _pdet = pdet;
  pdet = async function (id, back) {
    await _pdet(id, back);
    try {
      const { data } = await sb.from('review_photos').select('photos, created_at').eq('pro_id', id).order('created_at', { ascending:false }).limit(12);
      const urls = (data || []).flatMap(r => r.photos || []).filter(isPhotoUrl).slice(0, 12);
      if (!urls.length || document.getElementById('pdet-rph')) return;
      const h = [...document.querySelectorAll('#mm-body h3')].find(x => /실거래 후기/.test(x.textContent)); if (!h) return;
      h.insertAdjacentHTML('beforebegin', `<div id="pdet-rph"><h3 class="mt-5 font-bold">📷 고객이 올린 작업 사진 ${urls.length}장</h3><div class="mt-2 grid grid-cols-4 gap-2">${urls.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="고객 작업 사진 ${i + 1}" loading="lazy" class="aspect-square w-full rounded-lg object-cover"></a>`).join('')}</div></div>`);
    } catch (_) {}
  };

  /* ---------- 13) 기사님 대시보드: '들어온 견적 요청'을 맨 위로 ---------- */
  const _proView = proView;
  proView = function () {
    _proView();
    try {
      const pv = document.getElementById('pview'), top = pv && pv.firstElementChild;
      const h = [...pv.querySelectorAll('h2')].find(x => x.textContent.trim() === '들어온 견적 요청');
      if (!h || !top || h.closest('#req-top')) return;
      const p = h.nextElementSibling, grid = p && p.nextElementSibling;
      const box = document.createElement('section'); box.id = 'req-top'; box.className = 'mt-6 rounded-3xl border-2 border-brand-200 bg-white p-4 sm:p-5';
      h.className = 'text-xl font-black lg:text-2xl';
      const n = grid ? grid.querySelectorAll('article').length : 0;
      if (n) h.insertAdjacentHTML('beforeend', ` <span class="ml-1 rounded-full bg-sun px-2.5 py-0.5 align-middle text-sm text-white">${n}건</span>`);
      box.append(h); if (p) box.append(p); if (grid) box.append(grid);
      top.insertAdjacentElement('afterend', box);
    } catch (_) {}
  };
  /* ---------- 14) 이미 후기를 쓴 고객도 나중에 사진만 따로 올리기 ---------- */
  const _custMenu14 = custMenu;
  custMenu = function (keep) {
    _custMenu14(keep);
    try {
      S.con.filter(c => c.client_id === me() && c.kind === 'service' && c.status === 'completed' && reviewOf(c.id)).forEach(c => {
        const r = document.querySelector(`#mm-body [data-act="rcpt"][data-id="${c.id}"]`);
        if (r && !document.querySelector(`#mm-body [data-act="rxopen"][data-id="${c.id}"]`)) r.insertAdjacentHTML('afterend', btn('rxopen', c.id, '📷 후기 사진 올리기', 's'));
      });
    } catch (_) {}
  };
  ACT.rxopen = id => {
    const c = S.con.find(x => x.id === +id); if (!c) return;
    RP.cid = c.id; RP.files = [];
    openM(head('후기 사진 올리기') + `<p class="text-sm leading-relaxed text-sea/70">${esc(c.provider_name)} 기사님 작업 사진을 올려 주세요. 기사님 프로필의 '고객이 올린 작업 사진'에 보여요. 전에 올린 사진이 있으면 새 사진으로 바뀌어요.</p>${rpBlock('rx')}${errBox()}
      <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">취소</button>${wbtn('rxsave', c.id, '사진 올리기')}</div>`);
    menuCur = 'rx';
  };
  ACT.rxsave = (id, el) => {
    if (!RP.files.length) return setErr('올릴 사진을 골라 주세요.');
    busy(el, async () => { await rpSave(id); closeM(); });
  };
  /* ---------- 15) 중고장터 문구: 매입·매도(재고 판매) 모두 수수료 0원 ---------- */
  const OLD_STOCK = '거래가 최종 확정될 때 거래금액의 5%(건당 최대 10만 원)가 예치금에서 차감돼요. 구매자는 수수료가 없어요.';
  const NEW_STOCK = '중고장터는 매입·매도(재고 판매) 모두 수수료 0원이에요. 판매자·구매자 누구도 수수료를 내지 않아요.';
  const fixMarketText = root => { try { (root || document).querySelectorAll('#mm-body p, #pview p').forEach(el => { if (el.textContent.trim() === OLD_STOCK) el.textContent = NEW_STOCK; }); } catch (_) {} };
  new MutationObserver(() => fixMarketText()).observe(document.body, { childList:true, subtree:true });
  /* 수수료 계산기: 중고장터 판매·매입은 0원으로 안내 */
  const fsvc = document.getElementById('fc-svc'), famt = document.getElementById('fc-amt'), fnote = document.getElementById('fc-note');
  if (fsvc) {
    [...fsvc.options].forEach(o => { if (o.value === 'freezer_stock') o.textContent = '중고장터 판매 (재고 매도) · 0원'; if (o.value === 'freezer_sale') o.textContent = '중고장터 매입 · 0원'; });
    const note = () => { if (['freezer_stock', 'freezer_sale'].includes(fsvc.value) && fnote) fnote.textContent = '중고장터 매입·매도는 수수료 0원이에요. 판매자·구매자 모두 무료예요.'; };
    fsvc.addEventListener('change', () => setTimeout(note, 0)); if (famt) famt.addEventListener('input', () => setTimeout(note, 0)); note();
  }
  /* ---------- 16) 채팅 알림: 내가 참여한 대화만 (관리자에게 남의 대화 알림 안 뜨게) ---------- */
  const _onNew = onNewMessage;
  onNewMessage = function (m) {
    try {
      const t = S.thr.find(x => x.id === m.thread_id);
      if (t && t.u1 !== me() && t.u2 !== me()) { const list = S.msgs[m.thread_id]; if (list && !list.some(x => x.id === m.id)) list.push(m); return; }
      if (!t && S.admin) { queueLoad('thr'); return; }
    } catch (_) {}
    return _onNew(m);
  };
  /* ---------- 17) 채팅에 전화번호가 나오면: 한여름 밖 거래 주의 안내 ---------- */
  const PHONE_RE = /(01[016789]|0505|0[2-6][0-9]?)[\s.\-)]*\d{3,4}[\s.\-]*\d{4}/;
  const WARN = '⚠️ 전화번호로 따로 연락해 한여름 밖에서 진행한 거래는 작업 내역서, 14일 재점검, 무상 A/S 보증, 분쟁 중재를 받을 수 없고 한여름이 책임지지 않아요. 예약과 결제 확인은 한여름 안에서 진행해 주세요.';
  const hasPhone = t => PHONE_RE.test(String(t || '').replace(/[^\d\s.\-)]/g, ' '));
  const warnBox = () => `<div id="chat-warn" role="note" class="mt-3 rounded-2xl border-2 border-sun/40 bg-sun/10 p-3 text-xs font-bold leading-relaxed text-sea">${WARN}</div>`;
  const _chat17 = chatModal;
  chatModal = async function (tid, keep) {
    await _chat17(tid, keep);
    try {
      const box = document.getElementById('chatbox'); if (!box || document.getElementById('chat-warn')) return;
      if ((S.msgs[+tid] || []).some(m => m.kind !== 'photo' && hasPhone(m.body))) box.insertAdjacentHTML('beforebegin', warnBox());
    } catch (_) {}
  };
  const _csend17 = ACT.csend;
  ACT.csend = (id, el) => {
    try { const i = document.getElementById('chat-in'); if (i && hasPhone(i.value)) toast('전화번호로 따로 진행한 거래는 한여름이 보증하지 않아요.'); } catch (_) {}
    return _csend17(id, el);
  };

  /* ---------- 19) 기사님 공지: 배관·하수구 분야 새로 열림 ---------- */
  const PL_NOTE = 'hy_note_plumb_v1';
  const noteSeen = () => { try { return localStorage.getItem(PL_NOTE) === '1'; } catch (_) { return false; } };
  const _proView19 = proView;
  proView = function () {
    _proView19();
    try {
      return; // 공지 내림
      if (!KINDS.plumb || !S.pro || document.getElementById('note-plumb')) return;
      const has = proKinds(S.pro).includes('plumb');
      if (noteSeen()) return;   // 한 번 닫았으면 다시 안 떠요
      const pv = document.getElementById('pview'), top = pv && (document.getElementById('req-top') || pv.firstElementChild); if (!top) return;
      top.insertAdjacentHTML('afterend', `<section id="note-plumb" class="mt-6 rounded-3xl border-2 border-sky-300 bg-sky-50 p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3"><p class="text-xs font-black tracking-wide text-sky-700">📢 한여름 공지 · NEW</p><button type="button" data-act="noteplx" aria-label="공지 닫기" class="-m-1 rounded-full px-2 text-lg leading-none text-sea/50">×</button></div>
        <h2 class="mt-1 text-lg font-black lg:text-xl">🚰 '배관·하수구' 분야가 새로 열렸어요</h2>
        <p class="mt-1 text-sm leading-relaxed text-sea/80">하수구·싱크대·변기 막힘, <b>겨울 동파·해빙</b>, 누수 탐지, 배관 교체·용접, 수전·싱크대 연결, 하수관 고압 세척 요청을 받을 수 있어요. 겨울에는 급한 요청이 많아 견적이 빨리 성사되는 분야예요.</p>
        <p class="mt-2 text-xs text-sea/60">수수료는 다른 분야와 똑같아요. 기존 분야는 그대로 두고 추가만 하면 돼요.</p>
        <div class="mt-3">${has ? '<p class="text-sm font-bold text-sky-700">✅ 이미 내 분야에 들어 있어요. 새 요청이 오면 바로 보여 드려요.</p>' : btn('noteplgo', '', '내 분야에 배관·하수구 추가하기', 'a')}</div></section>`);
    } catch (_) {}
  };
  ACT.noteplx = () => { try { localStorage.setItem(PL_NOTE, '1'); } catch (_) {} const n = document.getElementById('note-plumb'); if (n) n.remove(); };
  ACT.noteplgo = () => { profModal(); toast("'배관·하수구'를 눌러 고르고 맨 아래 저장을 눌러 주세요."); setTimeout(() => { try { const b = [...document.querySelectorAll('#mm-body button, #mm-body label')].find(x => /배관·하수구/.test(x.textContent)); if (b) b.scrollIntoView({ block:'center' }); } catch (_) {} }, 150); };

  /* ---------- 19-2) 기사님 공지: 인테리어 분야 새로 열림 ---------- */
  const IN_NOTE = 'hy_note_interior_v1';
  const _proView192 = proView;
  proView = function () {
    _proView192();
    try {
      return; // 공지 내림
      if (!KINDS.interior || !S.pro || document.getElementById('note-interior')) return;
      let seen = false; try { seen = localStorage.getItem(IN_NOTE) === '1'; } catch (_) {}
      const has = proKinds(S.pro).includes('interior');
      if (seen) return;   // 한 번 닫았으면 다시 안 떠요
      const pv = document.getElementById('pview'), top = pv && (document.getElementById('req-top') || pv.firstElementChild); if (!top) return;
      top.insertAdjacentHTML('afterend', `<section id="note-interior" class="mt-6 rounded-3xl border-2 border-pink-300 bg-pink-50 p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3"><p class="text-xs font-black tracking-wide text-pink-700">📢 한여름 공지 · NEW</p><button type="button" data-act="noteinx" aria-label="공지 닫기" class="-m-1 rounded-full px-2 text-lg leading-none text-sea/50">×</button></div>
        <h2 class="mt-1 text-lg font-black lg:text-xl">🎨 '인테리어' 분야가 새로 열렸어요</h2>
        <p class="mt-1 text-sm leading-relaxed text-sea/80">도배·장판, 타일·욕실, 도장·페인트, 목공·가구·붙박이, 조명·전기, 샷시·창호, 철거·폐기물, <b>종합 리모델링</b>, 기타 인테리어 요청을 받을 수 있어요. 작업 사진이 있는 프로필이 선택을 많이 받아요.</p>
        <p class="mt-2 text-xs text-sea/60">수수료는 다른 분야와 똑같아요. 기존 분야는 그대로 두고 추가만 하면 돼요.</p>
        <div class="mt-3">${has ? '<p class="text-sm font-bold text-pink-700">✅ 이미 내 분야에 들어 있어요. 새 요청이 오면 바로 보여 드려요.</p>' : btn('noteingo', '', '내 분야에 인테리어 추가하기', 'a')}</div></section>`);
    } catch (_) {}
  };
  ACT.noteinx = () => { try { localStorage.setItem(IN_NOTE, '1'); } catch (_) {} const n = document.getElementById('note-interior'); if (n) n.remove(); };
  ACT.noteingo = () => { profModal(); toast("'인테리어'를 눌러 고르고 맨 아래 저장을 눌러 주세요."); setTimeout(() => { try { const b = [...document.querySelectorAll('#mm-body button, #mm-body label')].find(x => /인테리어/.test(x.textContent)); if (b) b.scrollIntoView({ block:'center' }); } catch (_) {} }, 150); };

  /* ---------- 20) 견적 다시 알림: 첫 알림 후 24시간 지나도 계약 안 한 손님에게 카톡 1번 ----------
     서버가 때가 된 요청만 골라서 보내요. 로그인한 사람이 사이트를 보고 있으면 15분에 한 번 확인을 부탁해요. */
  const RM_KEY = 'hy_remind_at';
  const remindTick = () => {
    try {
      if (!sb || !S.user) return;
      const last = +(localStorage.getItem(RM_KEY) || 0);
      if (Date.now() - last < 15 * 60e3) return;
      localStorage.setItem(RM_KEY, String(Date.now()));
    } catch (_) { return; }
    sb.functions.invoke('alimtalk', { body:{ remind:true } }).catch(() => {});
  };
  setTimeout(remindTick, 8000);
  setInterval(remindTick, 5 * 60e3);

  /* ---------- 21) 기사님 '새 요청 카톡 알림' ----------
     손님이 요청을 보내면 → 그 분야 + 그 동네(옆 구 포함)에서 알림을 켠 기사님 최대 5명에게 카톡 (서버가 골라요) */
  const _qShow21 = qShow;
  qShow = function (n) { _qShow21(n); if (n === 4 && sb && S.user) setTimeout(() => sb.functions.invoke('alimtalk', { body:{ notify_pros:true } }).catch(() => {}), 1500); };

  const PA = { uid:null, row:null, busy:false, off:false };
  const PA_LATER = 'hy_pa_later';
  async function paLoad() {
    if (!sb || !S.user || PA.busy) return;
    if (PA.uid === me()) return;
    PA.busy = true;
    try { const { data, error } = await sb.from('pro_alerts').select('phone, kakao_on').eq('user_id', me()).maybeSingle(); if (error) PA.off = true; PA.row = data || null; PA.uid = me(); }
    catch (_) { PA.off = true; PA.row = null; PA.uid = me(); }
    PA.busy = false;
    if (typeof render === 'function' && S.pro) proView();
  }
  const paLater = () => { try { return Date.now() - +(localStorage.getItem(PA_LATER) || 0) < 864e5; } catch (_) { return false; } };
  const paBox = () => {
    if (PA.off) return '';   // 서버 준비(SQL) 전에는 신청 칸을 안 보여요
    const on = PA.row && PA.row.kakao_on;
    if (on) return `<div id="pa-box" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm"><p class="font-bold text-emerald-700">✅ 새 요청 카톡 알림 켜짐 <span class="font-normal text-sea/60">· ${esc(phMask(PA.row.phone))}</span></p>${btn('paoff', '', '끄기', 's')}</div>`;
    if (paLater()) return '';
    return `<section id="pa-box" class="mt-4 rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3"><h2 class="text-lg font-black">📲 새 견적 요청, 카톡으로 바로 받기</h2><button type="button" data-act="palater" aria-label="나중에" class="-m-1 rounded-full px-2 text-lg leading-none text-sea/50">×</button></div>
      <p class="mt-1 text-sm leading-relaxed text-sea/80">내 분야·내 동네에 손님 요청이 들어오면 카톡으로 알려 드려요. 먼저 견적을 보내는 기사님이 성사될 가능성이 높아요.</p>
      <p class="mt-1 text-xs text-sea/60">요청 하나에 가까운 기사님 몇 분께만 가요. 알림은 무료이고 언제든 끌 수 있어요.</p>
      <input id="pa-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" value="${PA.row ? esc(phFmt(PA.row.phone)) : ''}" class="mt-3 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
      <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="pa-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand">
        <span>새 견적 요청 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요
        <details class="mt-1"><summary class="cursor-pointer text-xs font-bold text-cool">내용 보기</summary><span class="mt-1 block rounded-lg bg-white p-2 text-xs leading-relaxed">항목: 휴대폰 번호<br>목적: 활동 분야·지역의 새 견적 요청 알림 발송<br>보유 기간: 회원 탈퇴 또는 알림을 끌 때까지<br>발송 대행: 솔라피(SOLAPI) · 카카오<br>번호는 손님과 다른 기사님께 공개되지 않아요.</span></details></span></label>
      <p id="pa-err" role="alert" class="mt-2 text-sm font-bold text-red-600"></p>
      <div class="mt-2">${btn('pasave', '', '카톡 알림 받기', 'a')}</div></section>`;
  };
  const _proView21 = proView;
  proView = function () {
    _proView21();
    try {
      if (!S.pro || !sb) return;
      if (PA.uid !== me()) { paLoad(); return; }
      if (document.getElementById('pa-box')) return;
      const pv = document.getElementById('pview'), top = pv && (document.getElementById('req-top') || pv.firstElementChild); if (!top) return;
      const h = paBox(); if (!h) return;
      top.insertAdjacentHTML('afterend', h);
      const inp = document.getElementById('pa-phone');
      if (inp) inp.addEventListener('input', () => { inp.value = phFmt(phDigits(inp.value)); });
    } catch (_) {}
  };
  ACT.pasave = async (id, el) => {
    const d = phDigits((document.getElementById('pa-phone') || {}).value), ag = document.getElementById('pa-agree'), er = document.getElementById('pa-err');
    const say = m => { if (er) er.textContent = m; };
    if (!phOk(d)) return say('휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');
    if (!(ag && ag.checked)) return say('알림 수신에 동의해 주세요.');
    const now = new Date().toISOString();
    const { error } = await sb.from('pro_alerts').upsert({ user_id:me(), phone:d, kakao_on:true, agreed_at:now, updated_at:now });
    if (error) return say('저장하지 못했어요. 잠시 후 다시 해 주세요.');
    PA.row = { phone:d, kakao_on:true };
    const b = document.getElementById('pa-box'); if (b) b.remove(); proView();
    toast('새 요청 카톡 알림을 켰어요.');
  };
  ACT.paoff = async () => {
    const { error } = await sb.from('pro_alerts').update({ kakao_on:false, updated_at:new Date().toISOString() }).eq('user_id', me());
    if (error) return toast('잠시 후 다시 해 주세요.');
    PA.row = Object.assign({}, PA.row, { kakao_on:false });
    try { localStorage.setItem(PA_LATER, String(Date.now())); } catch (_) {}
    const b = document.getElementById('pa-box'); if (b) b.remove();
    toast('카톡 알림을 껐어요. 언제든 다시 켤 수 있어요.');
  };
  ACT.palater = () => { try { localStorage.setItem(PA_LATER, String(Date.now())); } catch (_) {} const b = document.getElementById('pa-box'); if (b) b.remove(); };
  /* ---------- 23) 알림 설정 화면 (☰ 메뉴 → 🔔 알림 설정) ---------- */
  const nsRow = (title, desc, right) => `<div class="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-mist p-4"><div class="min-w-0"><p class="font-bold">${title}</p><p class="mt-1 text-xs leading-relaxed text-sea/60">${desc}</p></div><div class="shrink-0">${right}</div></div>`;
  const nsPill = (txt, on) => `<span class="rounded-full px-2.5 py-1 text-xs font-bold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-ice text-sea/60'}">${txt}</span>`;
  async function nsetModal() {
    if (!S.user) return;
    if (S.pro && sb && PA.uid !== me()) { try { await paLoad(); } catch (_) {} }
    const inApp = (() => { try { return typeof hyApns === 'function' && hyApns(); } catch (_) { return false; } })();   // 아이폰 한여름 앱 안
    const perm = inApp ? (window.__hyTok ? 'granted' : window.__hySt === 'denied' ? 'denied' : 'default')
      : ('Notification' in window && window.isSecureContext) ? Notification.permission : 'unsupported';
    const push = perm === 'granted' ? nsPill('켜짐', true) : perm === 'default' ? btn('nspush', '', '켜기', 'a') : nsPill(perm === 'denied' ? '차단됨' : '사용 불가', false);
    const pushDesc = perm === 'granted' ? (inApp ? '앱을 닫아 두어도 새 소식이 아이폰으로 와요. 끄려면 아이폰 설정 → 한여름 → 알림에서 꺼 주세요.' : '앱을 닫아 두어도 새 소식이 휴대폰으로 와요. 끄려면 휴대폰 설정 → 알림에서 한여름을 꺼 주세요.')
      : perm === 'denied' ? (inApp ? '꺼져 있어요. 아이폰 설정 → 한여름 → 알림에서 허용으로 바꿔 주세요.' : '차단돼 있어요. 휴대폰 설정 → 알림(앱/사이트 알림)에서 한여름을 허용으로 바꿔 주세요.')
      : perm === 'unsupported' ? '이 화면에서는 켤 수 없어요. 아이폰은 Safari에서 [홈 화면에 추가]한 앱에서만 켤 수 있어요.'
      : '예약·채팅·견적 소식이 오면 앱을 닫아 두어도 휴대폰으로 알려 드려요.';
    let kakao = '';
    if (S.pro) {
      const on = PA.row && PA.row.kakao_on;
      if (PA.off) kakao = nsRow('📲 새 요청 카톡 알림', '곧 사용할 수 있어요.', nsPill('준비 중', false));
      else if (on) kakao = nsRow('📲 새 요청 카톡 알림', `내 분야·내 동네에 새 견적 요청이 오면 카톡으로 알려 드려요. (번호 ${esc(phMask(PA.row.phone))})`, btn('nspaoff', '', '끄기', 's'));
      else kakao = `<div class="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"><p class="font-bold">📲 새 요청 카톡 알림 ${nsPill('꺼짐', false)}</p>
        <p class="mt-1 text-sm leading-relaxed text-sea/80">내 분야·내 동네에 손님 요청이 들어오면 카톡으로 알려 드려요. 먼저 견적을 보내는 기사님이 성사될 가능성이 높아요.</p>
        <input id="ns-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" value="${PA.row ? esc(phFmt(PA.row.phone)) : ''}" class="mt-3 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
        <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="ns-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand"><span>새 견적 요청 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요 <span class="block text-xs text-sea/60">번호는 손님과 다른 기사님께 공개되지 않고, 언제든 끌 수 있어요. 발송 대행: 솔라피(SOLAPI)·카카오</span></span></label>
        <p id="ns-err" role="alert" class="mt-2 text-sm font-bold text-red-600"></p><div class="mt-2">${btn('nspaon', '', '카톡 알림 받기', 'a')}</div></div>`;
    }
    const mkt = `<button type="button" data-act="mktgo" class="mt-3 flex w-full items-center justify-between rounded-2xl border border-mist px-4 py-4 text-left font-bold hover:bg-ice"><span>📣 이벤트·혜택 알림</span><span id="mkt-st" class="rounded-full bg-ice px-2.5 py-0.5 text-xs text-sea/60">확인 중</span></button>`;
    const info = S.pro ? '' : '<p class="mt-3 rounded-xl bg-ice p-3 text-xs leading-relaxed text-sea/70">견적이 도착하면 견적을 요청할 때 입력한 번호로 카톡이 가요.</p>';
    openM(head('🔔 알림 설정') + '<p class="text-sm text-sea/70">받고 싶은 알림을 골라 주세요. 예약·채팅 소식은 앱 알림으로 와요.</p>' + nsRow('📱 앱 알림', pushDesc, push) + kakao + mkt + info + '<button type="button" data-act="notiinbox" class="mt-3 flex w-full items-center justify-between rounded-2xl border border-mist px-4 py-4 text-left font-bold hover:bg-ice"><span>📬 받은 알림 보기</span><span class="text-sea/30" aria-hidden="true">›</span></button>');
    try { if (typeof mktPaint === 'function') mktPaint(); } catch (_) {}
    const inp = document.getElementById('ns-phone'); if (inp) inp.addEventListener('input', () => { inp.value = phFmt(phDigits(inp.value)); });
  }
  ACT.nset = () => { nsetModal(); };
  ACT.notiinbox = () => { try { csModal('ntf'); } catch (_) {} };
  ACT.nspush = () => { Promise.resolve().then(() => notifOn()).catch(() => {}).then(() => setTimeout(nsetModal, 700)); };
  ACT.nspaon = async () => {
    const d = phDigits((document.getElementById('ns-phone') || {}).value), ag = document.getElementById('ns-agree'), er = document.getElementById('ns-err');
    const say = m => { if (er) er.textContent = m; };
    if (!phOk(d)) return say('휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');
    if (!(ag && ag.checked)) return say('알림 수신에 동의해 주세요.');
    const now = new Date().toISOString();
    const { error } = await sb.from('pro_alerts').upsert({ user_id:me(), phone:d, kakao_on:true, agreed_at:now, updated_at:now });
    if (error) return say('저장하지 못했어요. 잠시 후 다시 해 주세요.');
    PA.row = { phone:d, kakao_on:true };
    const b = document.getElementById('pa-box'); if (b) b.remove();
    toast('새 요청 카톡 알림을 켰어요.'); nsetModal();
  };
  ACT.nspaoff = async () => {
    const { error } = await sb.from('pro_alerts').update({ kakao_on:false, updated_at:new Date().toISOString() }).eq('user_id', me());
    if (error) return toast('잠시 후 다시 해 주세요.');
    PA.row = Object.assign({}, PA.row, { kakao_on:false });
    toast('카톡 알림을 껐어요. 언제든 다시 켤 수 있어요.'); nsetModal();
  };


  /* ---------- 22) 로그인하러 갔다 와도 견적 요청서가 안 사라지게 ----------
     로그인 안 한 손님이 '로그인하고 보내기'를 누르면 쓴 내용을 휴대폰에 잠깐 저장해 두고,
     카카오·네이버·구글 로그인이나 가입을 마치고 돌아오면 자동으로 이어서 보내 줘요. (2시간 안에만) */
  const QD_KEY = 'hy_quote_draft';
  const qdGet = () => { try { const d = JSON.parse(localStorage.getItem(QD_KEY) || 'null'); return d && Date.now() - d.t < 2 * 3600e3 ? d : null; } catch (_) { return null; } };
  const qdDel = () => { try { localStorage.removeItem(QD_KEY); } catch (_) {} };
  if (qmEl) qmEl.addEventListener('click', e => {
    if (!e.target.closest('#qm-next') || qstep !== 3 || S.user) return;
    try {
      const ag = document.getElementById('qm-agree');
      localStorage.setItem(QD_KEY, JSON.stringify({ t:Date.now(), f:Object.assign({}, qform),
        details:(document.getElementById('qm-details') || {}).value || '', phone:phDigits((document.getElementById('qm-phone') || {}).value),
        agree:!!(ag && ag.checked), photos:(typeof qphotos !== 'undefined' && qphotos.length) || 0 }));
    } catch (_) {}
  }, true);
  let qdBusy = false;
  function qdResume() {
    if (qdBusy || !S.user || !sb) return;
    const d = qdGet(); if (!d) return;
    if (mmOpen && mmOpen()) return;                       // 로그인 창이 닫힌 뒤에
    qdBusy = true; qdDel();
    const qmOpen = qmEl && !qmEl.classList.contains('hidden') && qstep === 3;
    if (!qmOpen) {
      const f = d.f || {};
      openQuote({ cat:f.etc || (f.service ? kindOf(f.service) : ''), service:f.etc ? '' : f.service, district:f.district });
      Object.assign(qform, f);
      const r = document.querySelector(`input[name="qm-svc"][value="${f.etc ? 'etc_' + f.etc : f.service}"]`); if (r) r.checked = true;
      const gu = document.getElementById('qm-gu'); if (gu && f.district) gu.value = f.district;
      const dt = document.getElementById('qm-date'); if (dt && f.date) dt.value = f.date;
      qShow(3);
      const det = document.getElementById('qm-details'); if (det) { det.value = d.details; det.dispatchEvent(new Event('input', { bubbles:true })); }
    }
    const ph = document.getElementById('qm-phone'); if (ph && d.phone && !phDigits(ph.value)) ph.value = phFmt(d.phone);
    const ag = document.getElementById('qm-agree'); if (ag && d.agree) ag.checked = true;
    if (d.photos && !qmOpen) { toast('로그인했어요. 작성하신 요청서를 불러왔어요. 사진만 다시 올리고 보내 주세요.'); qdBusy = false; return; }
    toast('로그인했어요. 작성하신 견적 요청을 이어서 보낼게요.');
    setTimeout(() => { const b = document.getElementById('qm-next'); if (b && qstep === 3) b.click(); qdBusy = false; }, 900);
  }
  setInterval(qdResume, 1000);

  /* ---------- 22) 개업 원큐 견적 (에어컨 · 냉장고 · 청소를 한 번에) ----------
     한 번만 적으면 고른 분야마다 견적 요청이 따로 만들어져요. 알림은 기존 방식(그 분야 기사님 최대 10명)으로 가요. */
  const PK_TAG = '[개업 패키지]';
  const PK_BIZ = ['식당', '카페', '미용실·네일', '사무실', '학원·병원', '기타'];
  const PK_ITEMS = [
    { id:'aircon', icon:'❄️', name:'에어컨', hint:'냉난방 에어컨 설치 · 청소 · 점검', opts:[['aircon_install', '설치'], ['aircon_clean', '청소'], ['aircon_check', '냉난방 점검'], ['aircon_repair', '수리']] },
    { id:'cold', icon:'🧊', name:'냉장·냉동고', hint:'업소용 냉장고 · 냉동고 (중고 구매 · 수리 · 철거)', opts:[['cold_buy', '중고 업소용 구매'], ['cold_repair', '수리 · 점검'], ['freezer_removal', '기존 냉장고 철거']] },
    { id:'clean', icon:'🧹', name:'청소', hint:'공사 뒤 분진 · 준공 청소 (마지막 날짜로 정해 주세요)', opts:[['clean_store', '상가 · 사무실 청소'], ['clean_movein', '입주청소']] }
  ];
  const pkEl = id => document.getElementById(id);
  const pkClone = (id, d) => (pkEl(id) || {}).innerHTML || d;
  const pkErr = m => { const e = pkEl('pk-err'); if (e) { e.textContent = m || ''; e.classList.toggle('hidden', !m); } };
  const pkCard = it => `<div class="mt-3 rounded-2xl border-2 border-mist p-3">
    <label class="flex cursor-pointer items-center gap-3 font-bold"><input type="checkbox" id="pk-on-${it.id}" class="h-5 w-5 shrink-0 accent-brand"><span class="text-xl" aria-hidden="true">${it.icon}</span><span>${it.name}<span class="block text-xs font-medium text-sea/60">${it.hint}</span></span></label>
    <div id="pk-box-${it.id}" class="mt-3 hidden space-y-2">
      <select id="pk-svc-${it.id}" aria-label="${it.name} 세부 작업" class="w-full rounded-xl bg-ice px-3 py-3 font-medium">${it.opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
      <label for="pk-date-${it.id}" class="block text-xs font-bold text-sea/70">희망일</label>
      <input id="pk-date-${it.id}" type="date" min="${today()}" class="w-full rounded-xl bg-ice px-3 py-3 font-medium">
      ${it.id === 'cold' ? `<div id="pk-buy" class="space-y-2"><label for="pk-buyitem" class="block text-xs font-bold text-sea/70">어떤 제품을 찾으세요? <span class="text-sun">(필수)</span></label>
        <input id="pk-buyitem" type="text" maxlength="80" placeholder="예) 4도어 업소용 냉장고 · 45박스 냉동고 · 쇼케이스" class="w-full rounded-xl bg-ice px-3 py-3 font-medium">
        <div class="grid grid-cols-2 gap-2"><input id="pk-buyqty" type="text" maxlength="20" placeholder="수량 (예: 2대)" class="rounded-xl bg-ice px-3 py-3 font-medium"><input id="pk-buybudget" type="text" maxlength="20" placeholder="예산 (선택)" class="rounded-xl bg-ice px-3 py-3 font-medium"></div>
        <p class="text-xs text-sea/60">원하는 제품을 적어 주시면 보유 재고가 있는 업체가 견적을 보내 드려요. 중고장터 거래는 수수료 0원이에요.</p></div>
      <div id="pk-site" class="hidden grid-cols-2 gap-2"><p class="col-span-2 text-xs font-bold text-sea/70">철거는 현장 정보가 필요해요</p>
        <select id="pk-floor" aria-label="물건 위치" class="rounded-xl bg-ice px-3 py-3 font-medium">${pkClone('qm-floor', '<option value="">위치</option>')}</select>
        <select id="pk-elev" aria-label="엘리베이터" class="rounded-xl bg-ice px-3 py-3 font-medium">${pkClone('qm-elev', '<option value="">엘리베이터</option>')}</select>
        <select id="pk-ladder" aria-label="사다리차" class="rounded-xl bg-ice px-3 py-3 font-medium">${pkClone('qm-ladder', '<option value="">사다리차</option>')}</select>
        <select id="pk-park" aria-label="주차" class="rounded-xl bg-ice px-3 py-3 font-medium">${pkClone('qm-park', '<option value="">주차</option>')}</select></div>` : ''}
    </div></div>`;
  const pkForm = () => `<div class="flex items-start justify-between gap-3"><div><h2 class="font-display text-2xl">🔑 개업 원큐 견적</h2>
      <p class="mt-1 text-sm leading-relaxed text-sea/75">한 번만 적으면 고른 분야 기사님들께 견적 요청이 동시에 가요. 견적 요청 · 비교는 무료예요.</p></div>
      <button type="button" data-mclose aria-label="닫기" class="shrink-0 rounded-full bg-ice px-3 py-1.5 text-sm font-bold">닫기</button></div>
    <p class="mt-5 text-sm font-bold">가게 정보</p>
    <div class="mt-2 grid grid-cols-2 gap-2"><select id="pk-biz" aria-label="업종" class="rounded-xl bg-ice px-3 py-3 font-medium"><option value="">업종 (선택)</option>${PK_BIZ.map(b => `<option>${b}</option>`).join('')}</select>
      <input id="pk-py" type="number" inputmode="numeric" min="1" max="999" placeholder="평수 (선택)" class="rounded-xl bg-ice px-3 py-3 font-medium"></div>
    <label for="pk-gu" class="mt-3 block text-sm font-bold">작업 지역</label>
    <select id="pk-gu" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5 font-medium">${pkClone('qm-gu', '<option value="">지역을 선택하세요</option>')}</select>
    <p class="mt-5 text-sm font-bold">필요한 분야를 골라 주세요</p>
    ${PK_ITEMS.map(pkCard).join('')}
    <label for="pk-memo" class="mt-5 block text-sm font-bold">요청사항 (선택)</label>
    <textarea id="pk-memo" rows="3" maxlength="300" placeholder="예) 12평 카페예요. 오픈은 다음 달 초예요. 주차는 건물 앞에 가능해요." class="mt-2 w-full rounded-xl bg-ice px-4 py-3 font-medium"></textarea>
    <div class="mt-5 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4"><p class="text-sm font-black">💬 견적이 오면 카톡으로 알려드려요</p>
      <p class="mt-1 text-xs font-bold text-sea/70">🔒 번호는 기사님께 공개되지 않아요</p>
      <input id="pk-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" class="mt-3 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
      <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="pk-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand"><span>견적 도착 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요 <b class="text-sun">(필수)</b></span></label></div>
    <p id="pk-err" role="alert" class="mt-3 hidden text-sm font-bold text-red-600"></p>
    <button type="button" data-act="pkgo" id="pk-go" class="mt-4 w-full rounded-2xl bg-sun py-4 text-base font-black text-white hover:brightness-95">고른 분야 견적 한 번에 요청하기</button>
    <p class="mt-2 text-center text-xs text-sea/60">분야마다 요청이 따로 만들어지고, 견적도 분야별로 도착해요.</p>`;

  ACT.pkopen = () => {
    if (!sb) return toast('사이트 설정이 아직 끝나지 않았어요.');
    if (S.mode !== 'customer') setMode('customer');
    openM(pkForm());
    (async () => {   // 저장된 번호가 있으면 채워 줘요
      try {
        if (!S.user) return;
        let sv = NP.saved && NP.saved.uid === me() ? NP.saved : null;
        if (!sv) { const { data } = await sb.from('customer_phones').select('phone, notify_ok').eq('user_id', me()).maybeSingle(); sv = { uid:me(), phone:data ? data.phone : '', notify_ok:!!(data && data.notify_ok) }; NP.saved = sv; }
        const i = pkEl('pk-phone'), a = pkEl('pk-agree');
        if (i && !i.value && sv.phone) { i.value = phFmt(sv.phone); if (sv.notify_ok && a) a.checked = true; }
      } catch (_) {}
    })();
  };
  document.addEventListener('change', e => {
    const id = e.target && e.target.id || '';
    if (/^pk-on-/.test(id)) { const b = pkEl('pk-box-' + id.slice(6)); if (b) b.classList.toggle('hidden', !e.target.checked); }
    if (id === 'pk-svc-cold') { const bx = pkEl('pk-buy'); if (bx) bx.classList.toggle('hidden', e.target.value !== 'cold_buy'); }
    if (id === 'pk-svc-cold') { const s = pkEl('pk-site'); if (s) { s.classList.toggle('hidden', e.target.value !== 'freezer_removal'); s.classList.toggle('grid', e.target.value === 'freezer_removal'); } }
  });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'pk-phone') e.target.value = phFmt(phDigits(e.target.value)); });

  let pkBusy = false;
  ACT.pkgo = async () => {
    if (pkBusy) return;
    pkErr('');
    const picks = PK_ITEMS.filter(it => (pkEl('pk-on-' + it.id) || {}).checked);
    if (!picks.length) return pkErr('필요한 분야를 한 가지 이상 골라 주세요.');
    const gu = pkEl('pk-gu').value; if (!gu) return pkErr('작업 지역을 선택해 주세요.');
    const rows = [];
    for (const it of picks) {
      const svc = pkEl('pk-svc-' + it.id).value, date = pkEl('pk-date-' + it.id).value;
      if (!date) return pkErr(`${it.name}의 희망일을 입력해 주세요.`);
      if (date < today()) return pkErr(`${it.name}은 오늘 이후 날짜를 선택해 주세요.`);
      let site = '', buy = '';
      if (svc === 'cold_buy') {
        const bi = pkEl('pk-buyitem').value.trim(); if (!bi) return pkErr('구매하실 제품(예: 4도어 업소용 냉장고)을 적어 주세요.');
        const bq = pkEl('pk-buyqty').value.trim(), bb = pkEl('pk-buybudget').value.trim();
        buy = `[중고 구매 희망] 제품: ${bi}${bq ? ' · 수량: ' + bq : ''}${bb ? ' · 예산: ' + bb : ''}`;
      }
      if (svc === 'freezer_removal') {
        const v = ['pk-floor', 'pk-elev', 'pk-ladder', 'pk-park'].map(x => pkEl(x).value);
        if (v.some(x => !x)) return pkErr('냉장고 철거는 현장 정보(위치 층 · 엘리베이터 · 사다리차 · 주차)를 모두 선택해 주세요.');
        site = `${v[0]} · 엘리베이터 ${v[1]} · 사다리차 ${v[2]} · 주차 ${v[3]}`;
      }
      rows.push({ it, svc:svc === 'cold_buy' ? 'cold_repair' : svc, date, site, buy });
    }
    const d = phDigits(pkEl('pk-phone').value);
    if (!phOk(d)) return pkErr('알림 받을 휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');
    if (!pkEl('pk-agree').checked) return pkErr('견적 도착 알림 수신에 동의해 주세요.');
    const btnGo = pkEl('pk-go'); pkBusy = true; btnGo.disabled = true; btnGo.textContent = '보내는 중...';
    const fail = m => { pkBusy = false; btnGo.disabled = false; btnGo.textContent = '고른 분야 견적 한 번에 요청하기'; pkErr(m); };
    try {
      if (!S.user) {   // 가입 없이 보내기: 임시 손님 계정을 만들고, 안 되면 로그인 창을 보여줘요
        let ok = false; try { const { data, error } = await sb.auth.signInAnonymously({ options:{ captchaToken: await window.hyCaptcha() } }); ok = !error && !!(data && data.session); } catch (_) {}
        for (let i = 0; ok && i < 40 && !S.user; i++) await sleepMs(100);
        if (!ok || !S.user) { fail(''); closeM(); toast('견적 요청은 로그인 후 보낼 수 있어요.'); return authModal('login'); }
      }
      const biz = pkEl('pk-biz').value, py = (pkEl('pk-py').value || '').replace(/\D/g, '').slice(0, 3), memo = pkEl('pk-memo').value.trim();
      const head = `${PK_TAG} ${[biz, py ? py + '평' : ''].filter(Boolean).join(' · ')} (${picks.map(x => x.name).join('·')} 동시 요청)`.replace(/\s+\(/, ' (');
      const made = [], bad = [];
      for (const r of rows) {
        const details = [r.buy, r.site ? `${SITE_TAG} ${r.site}` : '', head, memo].filter(Boolean).join('\n').slice(0, 500);
        try {
          const { data, error } = await sb.from('requests').insert({ service:r.svc, gu, wish_date:r.date, details, photos:[] }).select('id').single();
          if (error) throw error;
          made.push({ id:data.id, svc:r.svc, date:r.date, buy:!!r.buy });
        } catch (e) { bad.push({ svc:r.svc, msg:errMsg(e) }); }
      }
      if (!made.length) return fail(bad[0] ? bad[0].msg : '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
      track('quote');
      await savePhone(d);
      try { await load('req'); render(); } catch (_) {}
      sb.functions.invoke('alimtalk', { body:{ notify_pros:true } }).catch(() => {});
      pkBusy = false;
      const list = made.map(m => `<div class="flex justify-between gap-3 rounded-xl bg-ice px-3 py-2.5 text-sm"><span class="font-bold">${m.buy ? '중고 업소용 구매' : esc(SVC[m.svc] || m.svc)}</span><span class="text-sea/70">${esc(reqCode(m.id))} · ${esc(m.date)}</span></div>`).join('');
      const warn = bad.length ? `<p class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">${bad.map(b => esc(SVC[b.svc] || b.svc)).join(', ')} 요청은 보내지 못했어요. 아래 [닫기] 후 일반 견적 요청으로 다시 보내 주세요.</p>` : '';
      const guest = isGuest() ? `<div class="mt-4 rounded-2xl border-2 border-brand/30 bg-brand-50 p-4 text-left"><p class="font-bold">📩 견적이 도착하면 확인할 수 있게 가입해 주세요</p><p class="mt-1 text-sm text-sea/75">요청 내용은 그대로 이어져요. 가입은 1분이면 끝나요.</p><div class="mt-3 grid gap-2"><button type="button" data-act="guestjoin" data-id="kakao" class="rounded-xl bg-[#FEE500] py-3 font-bold text-black">💬 카카오로 3초 가입</button><button type="button" data-act="guestjoin" data-id="email" class="rounded-xl border-2 border-mist bg-white py-3 font-bold">이메일로 가입</button></div></div>` : '';
      $('#mm-body').innerHTML = `<div class="text-center"><p class="text-4xl" aria-hidden="true">✅</p><h2 class="mt-2 font-display text-2xl">${made.length}개 분야 견적 요청이 접수됐어요</h2>
        <p class="mt-2 text-sm leading-relaxed text-sea/75">분야별 기사님들께 알림이 갔어요. 견적이 도착하면 카톡(${esc(phMask(d))})으로 알려 드려요.</p></div>
        <div class="mt-4 space-y-2">${list}</div>${warn}${guest}
        <button type="button" data-mclose class="mt-5 w-full rounded-2xl bg-sea py-4 font-bold text-white">닫기</button>`;
    } catch (e) { fail(errMsg(e) || '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  /* ---------- 24) 견적 요청: 한 화면에 질문 하나 + 진행률(%) ----------
     기존 1·2·3단계는 그대로 두고, 단계 안의 질문을 한 화면에 하나씩만 보여줘요.
     (지역 → 날짜 → 현장·기기 → 사진·요청사항 → 카톡 알림 번호) 진행률은 '지금 몇 번째 화면인가'로 계산해요. */
  (() => {
    if (!qmEl) return;
    const s2 = qmEl.querySelector('[data-step="2"]'), s3 = qmEl.querySelector('[data-step="3"]'), scroller = qmEl.querySelector('.overflow-y-auto');
    if (!s2 || !s3 || !scroller) return;
    const st = document.createElement('style');
    st.textContent = '#qm .qp-off{display:none!important}#qm-bar,#qm-label{display:none!important}#qm-gu-l,#qm label[for="qm-date"]{display:none}#qm-phonebox{margin-top:1.25rem}#qm-gu,#qm-to,#qm-ton{min-height:3.5rem;font-size:1rem}#qp-fill{transition:width .3s ease}#qm-jump,#qm-allcat{display:none!important}#qm-date{display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;-webkit-appearance:none;appearance:none;text-align:left}';
    document.head.appendChild(st);

    const bar = document.getElementById('qm-bar');
    if (bar && !document.getElementById('qp-top')) bar.insertAdjacentHTML('beforebegin',
      '<div id="qp-top" class="mt-4"><div class="flex items-center gap-3"><div class="h-1.5 flex-1 overflow-hidden rounded-full bg-mist" role="progressbar" aria-label="견적 요청 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="qp-fill" class="block h-full rounded-full bg-brand" style="width:0%"></i></div><span id="qp-pct" class="w-11 text-right text-sm font-bold text-brand">0%</span></div><p id="qp-tgt" class="mt-2 hidden text-sm text-sea/70"></p></div>');
    if (!document.getElementById('qp-head')) s2.parentNode.insertBefore(Object.assign(document.createElement('div'), { id:'qp-head', className:'hidden mb-1', innerHTML:'<h3 id="qp-h" class="text-xl font-bold leading-snug"></h3><p id="qp-s" class="mt-1 text-sm leading-relaxed text-sea/70"></p>' }), s2);

    const QP = { k:'cat', back:false, cat:'' };
    const $q = id => document.getElementById(id);
    const vis = el => el && !el.classList.contains('hidden');
    const TXT = {
      cat:['어떤 분야가 필요하세요?', '분야를 고르면 세부 서비스를 보여 드려요.'],
      svc:['어떤 서비스가 필요하세요?', ''],
      where:['어느 지역이세요?', '작업할 곳의 지역을 골라 주세요.'],
      when:['언제가 좋으세요?', ''],
      truck:['이동 정보를 알려 주세요', ''],
      site:['현장 정보를 알려 주세요', ''],
      dev:['조금 더 알려 주세요', '아는 만큼만 알려 주세요. 몰라도 괜찮아요.'],
      details:['상태를 알려주시면 견적이 더 정확해져요', '사진과 요청사항은 선택이에요. 사진은 최대 5장까지 올릴 수 있어요.'],
      phone:['견적이 오면 카톡으로 알려 드릴게요', '']
    };

    function tag() {
      const t = (el, k) => { if (el) el.dataset.qp = k; };
      t($q('qm-where'), 'where'); t($q('qm-when'), 'when'); t($q('qm-truck'), 'truck'); t($q('qm-site'), 'site'); t($q('qm-dev'), 'dev');
      const s1 = qmEl.querySelector('[data-step="1"]');
      if (s1) {
        t(s1.querySelector('h3'), 'none'); t($q('qm-jump'), 'none'); t($q('qm-services'), 'svc');
        const sv = $q('qm-services');
        if (sv && !$q('qm-cats') && sv.querySelector('fieldset')) {
          const bs = [...sv.querySelectorAll('fieldset')].map(f => { const lg = f.querySelector('legend'); return '<button type="button" data-qcat="' + f.dataset.cat + '" class="flex items-center gap-3 rounded-2xl border-2 border-mist px-4 py-4 text-left font-bold hover:bg-ice">' + (lg ? lg.innerHTML : '') + '</button>'; }).join('');
          sv.insertAdjacentHTML('beforebegin', '<div id="qm-cats" data-qp="cat" class="mt-3 grid gap-2.5">' + bs + '</div><button type="button" id="qp-recat" data-qp="svc" class="mt-1 text-sm font-bold text-brand underline">← 분야 다시 고르기</button>');
          $q('qm-cats').querySelectorAll('legend,[data-qcat] > *').forEach(x => x.classList.remove('text-sub'));
        }
      }
      t(s2.querySelector('h3'), 'none'); t(s3.querySelector('h3'), 'none'); t(s3.querySelector('p'), 'none');
      [...s3.children].forEach(el => { if (!el.dataset.qp) el.dataset.qp = 'details'; });
    }
    function pagesOf(n) {
      if (n === 1) return ['cat', 'svc'];
      if (n === 2) { const p = ['where', 'when']; if (vis($q('qm-truck'))) p.push('truck'); if (vis($q('qm-site'))) p.push('site'); const dv = $q('qm-dev'); if (dv && dv.innerHTML.trim()) p.push('dev'); return p; }
      if (n === 3) return (qform.etc ? ['where', 'when'] : []).concat(['details']);
      return [n === 1 ? 'svc' : 'done'];
    }
    function allPages() {
      const a = [{ s:1, k:'cat' }, { s:1, k:'svc' }];
      if (!qform.etc) pagesOf(2).forEach(k => a.push({ s:2, k }));
      pagesOf(3).forEach(k => a.push({ s:3, k }));
      return a;
    }
    function apply() {
      const n = qstep, ps = pagesOf(n);
      if (ps.indexOf(QP.k) < 0) QP.k = ps[0];
      qmEl.querySelectorAll('[data-qp]').forEach(el => { el.classList.toggle('qp-off', el.dataset.qp === 'none' || el.dataset.qp !== QP.k); });
      const head = $q('qp-head'), box = $q('qp-top');
      const showHead = (n >= 1 && n <= 3) && TXT[QP.k];
      head.classList.toggle('hidden', !showHead);
      if (showHead) {
        let sub = TXT[QP.k][1];
        if (QP.k === 'details' && qform.etc) sub = qform.buy ? '찾으시는 제품을 한 줄만 적어 주세요. 사진은 없어도 돼요.' : '어떤 작업이 필요한지 한 줄만 적어 주세요. 사진은 없어도 돼요.';
        $q('qp-h').textContent = TXT[QP.k][0]; $q('qp-s').textContent = sub; $q('qp-s').classList.toggle('hidden', !sub);
      }
      const all = allPages(), idx = n === 4 ? all.length : Math.max(0, all.findIndex(x => x.s === n && x.k === QP.k));
      const p = Math.round(idx / all.length * 100);
      $q('qp-fill').style.width = p + '%'; $q('qp-pct').textContent = p + '%';
      const pb = box.querySelector('[role="progressbar"]'); if (pb) pb.setAttribute('aria-valuenow', p);
      const tg = $q('qp-tgt'); tg.textContent = qform.targetName ? '지정 기사님: ' + qform.targetName : ''; tg.classList.toggle('hidden', !qform.targetName || n === 4);
      const nx = $q('qm-next'); if (n === 1) nx.style.display = QP.k === 'cat' ? 'none' : '';
      if (n === 2 || n === 3) nx.textContent = (n === 3 && QP.k === 'details') ? '견적 요청 보내기' : '다음';
      qErr(''); scroller.scrollTop = 0;
    }
    const _qShow24 = qShow;
    qShow = function (n) {
      _qShow24(n); tag();
      const ps = pagesOf(n); if (n === 1 && !QP.back) { QP.k = QP.cat ? 'svc' : 'cat'; QP.back = false; apply(); return; }
      QP.k = QP.back && ps.length > 1 ? ps[ps.length - 1] : ps[0]; QP.back = false;
      apply();
    };

    const _qCat24 = qCat;
    qCat = function (k) { QP.cat = k || ''; return _qCat24(k); };
    qmEl.addEventListener('click', e => {
      const c = e.target.closest('[data-qcat]'), r = e.target.closest('#qp-recat');
      if (c) { qCat(c.dataset.qcat); QP.k = 'svc'; apply(); }
      else if (r) { qCat(''); QP.k = 'cat'; apply(); }
    });
    function check(k) {
      if (k === 'cat' && !QP.cat) return '분야를 선택해 주세요.';
      if (k === 'where' && !$q('qm-gu').value) return '작업할 지역을 선택해 주세요.';
      if (k === 'when') { const d = $q('qm-date').value; if (!d) return '작업 희망일을 선택해 주세요.'; if (d < today()) return '오늘 이후 날짜를 선택해 주세요.'; }
      if (k === 'truck') { if (!$q('qm-to').value) return '도착지 지역을 선택해 주세요.'; if (!$q('qm-ton').value) return '희망 차량을 선택해 주세요.'; }
      if (k === 'site' && ['qm-floor', 'qm-elev', 'qm-ladder', 'qm-park'].some(id => !$q(id).value)) return '현장 정보를 모두 선택해 주세요.';
      if (k === 'details' && qform.etc && ($q('qm-details').value.trim().length < 5)) return qform.buy ? '찾으시는 제품을 5자 이상 적어 주세요.' : '어떤 작업이 필요한지 5자 이상 적어 주세요.';
      return '';
    }
    function go(dir) {
      const ps = pagesOf(qstep), i = ps.indexOf(QP.k);
      if (dir < 0) { if (i > 0) { QP.k = ps[i - 1]; apply(); return true; } QP.back = true; return false; }
      if (i < ps.length - 1) { const m = check(QP.k); if (m) { qErr(m); return true; } QP.k = ps[i + 1]; apply(); return true; }
      return false;
    }
    document.addEventListener('click', e => {
      if (!e.isTrusted || qmEl.classList.contains('hidden') || (qstep < 1 || qstep > 3)) return;
      const nx = e.target.closest('#qm-next'), bk = e.target.closest('#qm-back');
      if (!nx && !bk) return;
      if (go(bk ? -1 : 1)) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    qmEl.addEventListener('change', e => {
      if (!e.isTrusted || qstep !== 1 || !e.target || e.target.name !== 'qm-svc') return;
      setTimeout(() => { const b = $q('qm-next'); if (b && qstep === 1) b.click(); }, 150);
    });
  })();


  /* ---------- 25) 견적 접수 후 '가입' 안내에 네이버 버튼 추가 ----------
     손님(임시 계정)이 네이버로 가입해도 방금 보낸 견적이 그대로 이어지게, 로그인 요청에 손님 계정 정보를 함께 보내요.
     네이버 로그인이 켜져 있을 때만 버튼이 보여요. */
  (() => {
    const $q = id => document.getElementById(id);
    async function naverJoin() {
      try {
        const ns = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        sessionStorageSet('hy_ns', ns); try { localStorage.setItem('hy_ns', ns); } catch (_) {}
        let url = NAVER_FN + '?start=1&ns=' + ns;
        try {
          const { data } = await sb.auth.getSession(); const tk = data && data.session && data.session.access_token;
          if (tk) {
            const r = await fetch(NAVER_FN + '?start=1&json=1&ns=' + ns, { headers:{ Authorization:'Bearer ' + tk, apikey:C.SUPABASE_ANON_KEY } });
            const j = r.ok ? await r.json() : null; if (j && j.url) url = j.url;
          }
        } catch (_) {}
        location.href = url;
      } catch (_) { toast('네이버 연결이 아직 준비되지 않았어요. 이메일로 가입해 주세요.'); }
    }
    const _gj = guestJoin;
    guestJoin = function (k) { return k === 'naver' ? naverJoin() : _gj(k); };
    function addBtn() {
      try { if (typeof SOC === 'undefined' || SOC.indexOf('naver') < 0) return; } catch (_) { return; }
      document.querySelectorAll('[data-act="guestjoin"][data-id="email"]').forEach(em => {
        if (em.parentNode.querySelector('[data-id="naver"]')) return;
        em.insertAdjacentHTML('beforebegin', '<button type="button" data-act="guestjoin" data-id="naver" class="rounded-xl bg-[#03C75A] py-3 font-bold text-white"><span class="inline-block align-[-2px]">' + SOC_ICON.naver + '</span> 네이버로 3초 가입</button>');
      });
    }
    new MutationObserver(addBtn).observe(document.body, { childList:true, subtree:true });
    setTimeout(addBtn, 800); setTimeout(addBtn, 2500);
  })();

  /* ---------- 26) 채팅을 보내면 상대방에게 카톡 알림 (서버가 5분에 한 번만 보내요) ---------- */
  (() => {
    const ping = tid => { try { if (sb && tid) sb.functions.invoke('alimtalk', { body:{ chat_thread:+tid } }).catch(() => {}); } catch (_) {} };
    if (typeof csend === 'function') { const _cs = csend; csend = async function (el, tid) { const r = await _cs(el, tid); ping(tid); return r; }; }
    if (typeof sendChatPhoto === 'function') { const _sp = sendChatPhoto; sendChatPhoto = async function (f) { const tid = (typeof chatCur !== 'undefined') ? chatCur : 0; const r = await _sp(f); ping(tid); return r; }; }
  })();

  /* ---------- 27) 하단 메뉴 '인테리어' → '채팅' (채팅 목록 + 안 읽은 채팅 숫자) ---------- */
  (() => {
    const $q = id => document.getElementById(id);
    const mine = t => (t.u1 === me() ? t.u1_read_at : t.u2_read_at) || 0;
    const IC = '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 014 13.5z"/><path d="M8.5 8.5h7M8.5 11.5h4"/></svg>';
    let btn = null, info = { n:0, last:{}, cnt:{} }, busyC = false;

    function swapPro() {
      const p = document.querySelector('#mbar-p [data-act="cs"]');
      if (!p || p.dataset.chat) return;
      p.dataset.chat = '1'; p.setAttribute('data-act', 'chatlist'); p.id = 'mbar-pchat';
      p.innerHTML = IC + '<span>채팅</span>';
      try { window.__chatMark && window.__chatMark(); paint(); } catch (_) {}
    }
    function swapTab() {
      swapPro();
      const b = document.querySelector('#mbar-c [data-act="qcat"][data-id="interior"]');
      if (!b || b.dataset.chat) return;
      b.dataset.chat = '1'; b.setAttribute('data-act', 'chatlist'); b.removeAttribute('data-id'); b.id = 'mbar-chat';
      b.innerHTML = IC + '<span>채팅</span>'; btn = b; paint();
    }
    function paint() { window.__chatN = Math.min(info.n, 99); if (btn) setBadge(btn, window.__chatN); setBadge(document.getElementById('mbar-pchat'), window.__chatN); try { window.__chatMark && window.__chatMark(); } catch (_) {} }

    /* 안 읽은 메시지 수 + 방마다 마지막 메시지를 한 번에 가져와요 */
    async function refresh() {
      if (busyC || !sb || !S.user) { info = { n:0, last:{}, cnt:{} }; paint(); return; }
      busyC = true;
      try {
        await load('thr');
        const ids = (S.thr || []).filter(t => t.u1 === me() || t.u2 === me()).map(t => t.id);
        if (!ids.length) { info = { n:0, last:{}, cnt:{} }; return; }
        const { data } = await sb.from('messages').select('id, thread_id, sender_id, kind, body, created_at')
          .in('thread_id', ids).gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('id', { ascending:false }).limit(800);
        const last = {}, cnt = {}; let n = 0;
        const rd = {}; (S.thr || []).forEach(t => { rd[t.id] = mine(t); });
        for (const m of (data || [])) {
          if (!last[m.thread_id]) last[m.thread_id] = m;
          if (m.sender_id && m.sender_id !== me() && m.kind !== 'sys' && (!rd[m.thread_id] || T(m.created_at) > T(rd[m.thread_id]))) { cnt[m.thread_id] = (cnt[m.thread_id] || 0) + 1; n++; }
        }
        info = { n, last, cnt };
      } catch (_) {} finally { busyC = false; paint(); }
    }

    const prev = m => !m ? '아직 대화가 없어요' : m.kind === 'photo' ? '📷 사진' : String(m.body || '').replace(/\s+/g, ' ').slice(0, 40);
    let listSig = '';
    function listHtml() {
      const T0 = (S.mode === 'customer' || !S.pro) ? '기사님과 채팅' : '손님과 채팅';
      const ts = (S.thr || []).filter(t => t.u1 === me() || t.u2 === me())
        .sort((a, b) => T((info.last[b.id] || b).created_at || 0) - T((info.last[a.id] || a).created_at || 0));
      const rows = ts.map(t => {
        const other = t.u1 === me() ? thN(t, 'u2') : thN(t, 'u1'), m = info.last[t.id], c = info.cnt[t.id] || 0;
        return `<button type="button" data-act="chatopen" data-id="${t.id}" class="mt-3 flex w-full items-center gap-3 rounded-2xl border border-mist p-4 text-left hover:bg-ice">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-black text-brand">${esc(String(other || '?').slice(0, 1))}</span>
          <span class="min-w-0 flex-1"><b class="block truncate">${esc(other || '상대방')}</b><span class="block truncate text-sm ${c ? 'font-bold text-sea' : 'text-sea/60'}">${esc(prev(m))}</span></span>
          <span class="shrink-0 text-right text-xs text-sea/50">${m ? fmtT(m.created_at) : ''}${c ? `<i class="mt-1 block min-w-[20px] rounded-full bg-sun px-1.5 py-0.5 text-center text-[11px] font-bold not-italic text-white">${c}</i>` : ''}</span>
        </button>`;
      }).join('');
      return { sig: ts.map(t => t.id + ':' + ((info.last[t.id] || {}).id || 0) + ':' + (info.cnt[t.id] || 0)).join('|'),
        html: head(T0) + (rows || empty(T0 === '손님과 채팅' ? '아직 채팅이 없어요. 견적을 보내면 손님과 이곳에서 대화할 수 있어요.' : '아직 채팅이 없어요. 견적을 요청하면 기사님과 이곳에서 대화할 수 있어요.')) };
    }
    async function openList() {
      if (!S.user) { toast('로그인하면 기사님과의 채팅을 볼 수 있어요.'); return authModal('login', 'customer'); }
      const T0 = (S.mode === 'customer' || !S.pro) ? '기사님과 채팅' : '손님과 채팅';
      const cached = S.thr && S.thr.length && Object.keys(info.last || {}).length;
      if (cached) {           // 이미 불러온 목록이 있으면 바로 보여주고, 뒤에서 조용히 새로고침 (화면이 깜빡이거나 튀지 않게)
        const v0 = listHtml(); listSig = v0.sig; openM(v0.html);
        await refresh();
        if (menuCur === null && !chatCur && document.querySelector('#mm-body [data-act="chatopen"]')) {
          const v1 = listHtml(); if (v1.sig !== listSig) { const bd = document.getElementById('mm-body'), st = bd ? bd.scrollTop : 0; listSig = v1.sig; openM(v1.html); if (bd) bd.scrollTop = st; }
        }
        return;
      }
      openM(head(T0) + '<p class="rounded-2xl bg-ice p-6 text-center text-sea/70">불러오는 중...</p>');
      await refresh();
      const v = listHtml(); listSig = v.sig; openM(v.html);
    }
    ACT.chatlist = () => { openList(); };
    ACT.chatopen = id => { chatModal(+id).then(refresh); };

    /* 새 메시지가 오면 숫자를 바로 올려요 / 채팅방을 닫거나 읽으면 다시 계산해요 */
    const _onNew = onNewMessage;
    onNewMessage = function (m) { _onNew(m); setTimeout(refresh, 400); };
    const _mr = markRead;
    markRead = function (t) { _mr(t); setTimeout(refresh, 1500); };
    swapTab(); setTimeout(swapTab, 600); setTimeout(swapTab, 2000);
    new MutationObserver(swapTab).observe(document.getElementById('mbar') || document.body, { childList:true, subtree:true });
    setTimeout(refresh, 1500); setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  })();

  /* ── 28. 견적은 예치금 없이 낼 수 있게 (수수료는 거래 확정 때만) ───────── */
  (function () {
    try {
      const _qm = quoteModal;
      quoteModal = function (rid) {
        const p = S && S.pro, b = p && p.balance;
        if (p) p.balance = Math.max(+b || 0, 1e9);   /* 화면의 '예치금 부족' 막힘만 건너뛰어요 */
        try { return _qm(rid); } finally { if (p) p.balance = b; }
      };
    } catch (_) {}
  })();

  /* ── 29. 서류 올리면 바로 승인(국세청 조회) + 관리자 '서류 미확인' 목록 ──── */
  (function () {
    const note = (d) => {
      if (!d) return;
      if (d.approved) setTimeout(() => { try { toast('승인됐어요! 이제 견적을 낼 수 있어요.'); } catch (_) {} }, 700);
      else if (d.verdict === 'closed' || d.verdict === 'unregistered') setTimeout(() => { try { toast('사업자번호가 국세청 조회에서 확인되지 않았어요. 관리자가 직접 확인할게요.'); } catch (_) {} }, 700);
    };
    const verify = async () => {
      if (!sb) return null;
      try { const { data } = await sb.functions.invoke('biz-verify', { body:{} }); return data || null; } catch (_) { return null; }
    };
    const _ub = uploadBizDoc;
    uploadBizDoc = async function (f) { await _ub(f); note(await verify()); };
    let tried = '';
    setInterval(async () => {
      try {
        const p = S && S.pro; if (!p || p.approval !== 'PENDING' || !p.biz_doc || !p.biz_no || tried === p.id + p.biz_doc + p.biz_no) return;
        tried = p.id + p.biz_doc + p.biz_no;
        const d = await verify(); if (d && d.approved) { await load('pro'); render(); note(d); }
      } catch (_) {}
    }, 4000);

    const _av = adminView;
    adminView = function () {
      _av();
      try {
        if (!S.admin || document.getElementById('doc-unchecked')) return;
        const h = [...document.querySelectorAll('#pview h2')].find(x => x.textContent.trim() === '기사 가입 승인'); if (!h) return;
        const sec = h.closest('section') || h.parentElement;
        const all = (S.adminPros || []).filter(p => p.approval === 'APPROVED' && p.biz_doc && !p.doc_checked_at), list = all.slice(0, window.__docN || 5);
        const vt = v => v === 'ok' ? '<span class="font-bold text-cool">국세청 조회 통과</span>' : v === 'unchecked' ? '<span class="text-sea/60">국세청 조회 안 함</span>' : '';
        sec.insertAdjacentHTML('beforebegin', `<section id="doc-unchecked" class="rounded-3xl border-2 border-sun bg-sun/10 p-6"><h2 class="text-xl font-bold">서류 미확인 기사 ${all.length}명</h2><p class="mt-1 text-sm text-sea/70">서류를 올리면 바로 승인된 분들이에요. 등록증을 열어 상호·대표자를 확인하고 <b>확인 완료</b>를 누르세요. 이상하면 <b>활동 정지</b>를 누르세요.</p>
          ${list.map(p => `<div class="mt-3 rounded-2xl bg-white p-4"><p class="font-bold">${esc(p.name || '이름 없음')}</p><p class="mt-1 text-xs text-sea/70">${(p.areas || []).map(esc).join(', ')} · 사업자번호 ${p.biz_no ? esc(bizFmt(p.biz_no)) : '미입력'} · ${vt(p.biz_verify)}</p><p class="text-xs text-sea/50">서류 제출 ${fmtT(p.biz_doc_at)}</p><div class="mt-3 flex flex-wrap gap-2">${btn('pdoc', p.id, '사업자등록증 보기', 'p')}${btn('dcheck', p.id, '확인 완료', 'a')}${btn('preject', p.id, '활동 정지', 's')}</div></div>`).join('') || `<div class="mt-3">${empty('확인할 기사가 없어요.')}</div>`}${all.length > list.length ? `<div class="mt-4 text-center">${btn('dmore', '', '더 보기 (' + (all.length - list.length) + '명 남음)', 's')}</div>` : ''}</section>`);
      } catch (_) {}
    };
    ACT.dmore = () => { window.__docN = (window.__docN || 5) + 5; render(); };
    ACT.dcheck = (id, el) => adminSimple(el, 'admin_mark_doc_checked', { p_pro:id }, '확인 완료로 표시했어요.', ['adminPros']);
  })();

  /* ---------- 30) '줄눈 시공' 분야 추가 (인테리어 안에 새 항목) ---------- */
  (() => {
    try {
      if (SVC.interior_grout) return;
      SVC.interior_grout = '줄눈 시공';
      const K = KINDS && KINDS.interior;
      if (K) {
        const i = K.svcs.indexOf('interior_tile'); K.svcs.splice(i < 0 ? K.svcs.length : i + 1, 0, 'interior_grout');
        const j = (K.subs || []).indexOf('타일·욕실'); if (K.subs) K.subs.splice(j < 0 ? K.subs.length : j + 1, 0, '줄눈 시공');
      }
      const tile = document.querySelector('#qm-services input[value="interior_tile"]'), lab = tile && tile.closest('label');
      if (lab && !document.querySelector('#qm-services input[value="interior_grout"]')) {
        const c = lab.cloneNode(true), inp = c.querySelector('input');
        inp.value = 'interior_grout'; inp.checked = false; c.querySelector('span').textContent = '줄눈 시공'; lab.after(c);
      }
      const op = document.querySelector('#svc option[value="interior_tile"]');
      if (op) op.insertAdjacentHTML('afterend', '<option value="interior_grout">줄눈 시공</option>');
    } catch (_) {}
  })();

  /* ---------- 31) 기사 화면: 안 읽은 채팅이 있으면 아래 메뉴 숫자 + '새 채팅' 표시 + 앱을 열면 안내 ---------- */
  (() => {
    let told = false;
    const proN = () => S.con.filter(c => c.provider_id === me() && c.status !== 'completed').length;
    function mark() {
      try {
        if (!S || !S.user || S.mode === 'customer' || S.mode === 'admin') return;
        const cn = window.__chatN || 0;
        const fab = document.getElementById('fab');
        if (fab && cn && !fab.querySelector('[data-newchat]')) fab.insertAdjacentHTML('beforeend', ` <span data-newchat class="ml-1 rounded-full bg-white px-2 py-0.5 text-xs text-sea">새 채팅 ${cn}</span>`);
        if (cn && !told) { told = true; toast(`새 채팅이 ${cn}개 있어요. 아래 채팅 탭에서 확인해 주세요.`); }
      } catch (_) {}
    }
    window.__chatMark = mark;
    const _r = render;
    render = function () { _r.apply(this, arguments); mark(); };
  })();

  /* ---------- 32) 기사 화면: 알림이 꺼져 있을 때만 맨 위에 '알림 켜기' 안내 + 첫 터치 때 알림 허용 창 ---------- */
  (() => {
    const need = () => {
      try {
        if (!S || !S.user || !S.pro || S.mode !== 'pro') return '';
        if (hyApns()) return window.__hyTok ? '' : 'default';
        if (!canNote()) return '';
        const p = Notification.permission;
        if (p === 'granted') return '';
        if (isIOS() && !standalone()) return 'ios';
        return p === 'denied' ? 'denied' : 'default';
      } catch (_) { return ''; }
    };
    const box = (t, d, b) => `<div id="push-banner" class="mb-4 rounded-2xl border-2 border-sun bg-sun/10 p-4 text-sm"><p class="font-bold">${t}</p><p class="mt-1 leading-relaxed text-sea/80">${d}</p>${b || ''}</div>`;
    function paintBanner() {
      try {
        const old = document.getElementById('push-banner'), n = need(), host = document.getElementById('pview');
        if (!n || !host || host.classList.contains('hidden')) { if (old) old.remove(); return; }
        if (old && old.dataset.s === n) return;
        if (old) old.remove();
        const html = n === 'denied'
          ? box('🔕 알림이 차단돼 있어요', '손님 채팅과 새 요청을 놓칠 수 있어요. 휴대폰 설정 → 앱(또는 크롬) → 알림에서 한여름을 허용해 주세요.')
          : n === 'ios'
            ? box('🔔 알림이 꺼져 있어요', '아이폰은 홈 화면에 추가한 한여름 앱에서만 알림을 켤 수 있어요.', '<button type="button" data-act="install" class="mt-3 w-full rounded-xl bg-sea py-3 font-bold text-white">홈 화면에 추가하기</button>')
            : box('🔔 알림이 꺼져 있어요', '켜 두면 새 견적 요청과 손님 채팅을 앱을 닫아도 바로 받아요. 꺼 두면 손님 연락을 놓칠 수 있어요.', '<button type="button" data-act="notifon" class="mt-3 w-full rounded-xl bg-sea py-3 font-bold text-white">알림 켜기</button>');
        host.insertAdjacentHTML('afterbegin', html);
        const nb = document.getElementById('push-banner'); if (nb) nb.dataset.s = n;
      } catch (_) {}
    }
    const _r = render;
    render = function () { _r.apply(this, arguments); paintBanner(); };
    setInterval(paintBanner, 3000);
    /* 알림이 꺼진 기사님이 앱을 열고 처음 화면을 누를 때 알림 허용 창을 한 번 띄워요 (하루 2번까지) */
    let asked = false;
    document.addEventListener('click', () => {
      try {
        if (asked || need() !== 'default') return;
        let last = 0; try { last = +localStorage.getItem('hy_push_auto') || 0; } catch (_) {}
        if (Date.now() - last < 12 * 3600e3) return;
        asked = true; try { localStorage.setItem('hy_push_auto', String(Date.now())); } catch (_) {}
        setTimeout(() => { try { notifOn(); } catch (_) {} }, 300);
      } catch (_) {}
    }, true);
  })();

  /* ---------- 33) 기사님이 기사 화면을 열면 '수수료가 낮아졌어요' 안내 (한 번만) ---------- */
  (() => {
    const KEY = 'hy_fee_notice_20261124';
    let shown = false;
    const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
    function show() {
      try {
        if (shown || seen() || !S || !S.user || !S.pro || S.mode !== 'pro') return;
        return; // 팝업은 쓰지 않고 아래 공지 카드로 안내해요
        if (typeof mmOpen === 'function' && mmOpen()) return;
        shown = true; try { localStorage.setItem(KEY, '1'); } catch (_) {}
        const row = (n, a, b) => `<div class="flex items-center justify-between rounded-xl bg-ice px-4 py-3 text-sm"><span class="font-bold">${n}</span><span><s class="text-sea/50">${a}</s> <b class="text-brand">→ ${b}</b></span></div>`;
        openM(head('📢 수수료가 낮아졌어요') + `<p class="leading-relaxed text-sea/80">기사님들의 의견을 듣고 수수료를 낮췄어요. 견적은 지금처럼 무료이고, <b>거래가 확정될 때만</b> 아래 수수료가 예치금에서 차감돼요.</p>
          <div class="mt-4 space-y-2">${row('🐣 새싹', '10%', '5%')}${row('🦅 우수', '7%', '4%')}${row('👑 베스트', '5%', '3%')}</div>
          <ul class="mt-4 space-y-1 text-sm leading-relaxed text-sea/80"><li>✓ 정액이 3,500원에서 1,500원으로 낮아졌어요.</li><li>✓ 수수료 = 1,500원 + 최종 금액 × 등급 %</li><li>✓ 아직 확정 전인 거래부터 새 기준으로 계산돼요.</li></ul>
          <button type="button" data-mclose class="mt-5 w-full rounded-2xl bg-sea py-4 font-bold text-white">확인했어요</button>`);
      } catch (_) {}
    }
    const _r = render;
    render = function () { _r.apply(this, arguments); setTimeout(show, 1200); };
  })();

  /* ---------- 34) 기사 화면 공지 카드: 수수료가 낮아졌어요 ---------- */
  (() => {
    const K = 'hy_fee_card_20261124';
    const closed = () => { try { return Date.now() - (+localStorage.getItem(K) || 0) < 864e5; } catch (_) { return false; } };
    const _pv = proView;
    proView = function () {
      _pv();
      try {
        if (!S.pro || closed() || document.getElementById('note-fee')) return;
        const pv = document.getElementById('pview'), top = pv && (document.getElementById('req-top') || pv.firstElementChild); if (!top) return;
        top.insertAdjacentHTML('afterend', `<section id="note-fee" class="mt-6 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3"><p class="text-xs font-black tracking-wide text-emerald-700">📢 한여름 공지 · NEW</p><button type="button" data-act="notefeex" aria-label="공지 닫기" class="-m-1 rounded-full px-2 text-lg leading-none text-sea/50">×</button></div>
          <h2 class="mt-1 text-lg font-black lg:text-xl">💰 수수료가 낮아졌어요</h2>
          <p class="mt-1 text-sm leading-relaxed text-sea/80">견적은 지금처럼 무료이고, <b>거래가 확정될 때만</b> 예치금에서 차감돼요.</p>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div class="rounded-xl bg-white px-2 py-3"><p class="font-bold">🐣 새싹</p><p><s class="text-sea/50">10%</s> <b class="text-brand">→ 5%</b></p></div>
            <div class="rounded-xl bg-white px-2 py-3"><p class="font-bold">🦅 우수</p><p><s class="text-sea/50">7%</s> <b class="text-brand">→ 4%</b></p></div>
            <div class="rounded-xl bg-white px-2 py-3"><p class="font-bold">👑 베스트</p><p><s class="text-sea/50">5%</s> <b class="text-brand">→ 3%</b></p></div></div>
          <p class="mt-2 text-xs leading-relaxed text-sea/60">수수료 = 1,500원 + 최종 금액 × 등급 % · 정액이 3,500원 → 1,500원으로 낮아졌어요 · 확정 전인 거래부터 새 기준이에요.</p></section>`);
      } catch (_) {}
    };
    ACT.notefeex = () => { try { localStorage.setItem(K, String(Date.now())); } catch (_) {} const n = document.getElementById('note-fee'); if (n) n.remove(); };
  })();

  /* ---------- 35) 채팅창: 자판이 올라와도 입력칸이 가려지지 않게 ---------- */
  (() => {
    const mob = () => innerWidth < 640;
    const fit = () => {
      try {
        const inp = document.getElementById('chat-in'); if (!inp || !mob()) return;
        const v = window.visualViewport, box = document.getElementById('chatbox');
        const kb = v ? Math.max(0, innerHeight - v.height - v.offsetTop) : 0;
        const open = kb > 80;
        if (box) { box.style.height = open ? Math.max(120, Math.round((v ? v.height : innerHeight) * 0.3)) + 'px' : ''; box.style.minHeight = open ? '0' : ''; if (open) box.scrollTop = box.scrollHeight; }
        const row = inp.parentElement; if (row) row.style.cssText = 'position:sticky;bottom:-1.5rem;z-index:5;background:#fff;padding:.5rem 0 .75rem;margin-bottom:-1rem';
        if (open) setTimeout(() => { try { inp.scrollIntoView({ block: 'end' }); } catch (_) {} }, 50);
      } catch (_) {}
    };
    document.addEventListener('focusin', e => { if (e.target && e.target.id === 'chat-in') { setTimeout(fit, 120); setTimeout(fit, 400); setTimeout(fit, 800); } });
    document.addEventListener('focusout', e => { if (e.target && e.target.id === 'chat-in') setTimeout(() => { const b = document.getElementById('chatbox'); if (b) { b.style.height = ''; b.style.minHeight = ''; } }, 150); });
    if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); }
    new MutationObserver(() => { const i = document.getElementById('chat-in'); if (i && !i.dataset.kbfit) { i.dataset.kbfit = '1'; fit(); } }).observe(document.body, { childList: true, subtree: true });
  })();

  /* ---------- 36) 채팅 사진: 새 창으로 나가지 않고 화면 안에서 크게 보기 + 닫기 버튼 ---------- */
  (() => {
    let box = null, pushed = false;
    const close = (fromPop) => {
      if (!box) return; box.remove(); box = null;
      if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (_) {} } else pushed = false;
    };
    const open = url => {
      close();
      box = document.createElement('div');
      box.id = 'chat-photo-view';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '사진 크게 보기');
      box.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:3.5rem 0.5rem 1rem';
      const img = document.createElement('img');
      img.src = url; img.alt = '보낸 사진'; img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px';
      const x = document.createElement('button');
      x.type = 'button'; x.textContent = '✕ 닫기';
      x.style.cssText = 'position:absolute;top:max(.75rem,env(safe-area-inset-top));right:.75rem;background:#fff;color:#0b2a3c;font-weight:800;font-size:15px;padding:.6rem 1rem;border-radius:999px;border:0;box-shadow:0 2px 8px rgba(0,0,0,.4)';
      x.addEventListener('click', e => { e.stopPropagation(); close(); });
      box.addEventListener('click', e => { if (e.target !== img) close(); });
      box.appendChild(img); box.appendChild(x); document.body.appendChild(box);
      try { history.pushState({ hyPhoto: 1 }, ''); pushed = true; } catch (_) {}
      try { x.focus(); } catch (_) {}
    };
    document.addEventListener('click', e => {
      const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
      const im = a.querySelector('img'); if (!im || !/^https:\/\//.test(a.getAttribute('href') || '')) return;
      if (a.closest('#chat-photo-view')) return;
      e.preventDefault(); e.stopPropagation(); open(a.getAttribute('href'));
    }, true);
    addEventListener('popstate', () => { if (box) close(true); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box) { e.stopPropagation(); close(); } }, true);
  })();

  /* ---------- 37) 채팅 사진 여러 장 한 번에 보내기 (앨범에서 최대 10장) ---------- */
  (() => {
    const MAX = 10; let sending = false;
    const mark = () => { const i = document.getElementById('chat-photo'); if (i && !i.multiple) i.multiple = true; };
    let rq42 = 0; new MutationObserver(() => { if (rq42) return; rq42 = requestAnimationFrame(() => { rq42 = 0; mark(); }); }).observe(document.body, { childList: true, subtree: true }); mark();
    document.addEventListener('change', async e => {
      const el = e.target; if (!el || el.id !== 'chat-photo' || !el.files || el.files.length < 2) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (sending) { el.value = ''; return; }
      let fs = Array.from(el.files).filter(f => /^image\//.test(f.type || 'image/'));
      el.value = '';
      if (fs.length > MAX) { try { toast('사진은 한 번에 ' + MAX + '장까지 보낼 수 있어요. 앞의 ' + MAX + '장만 보내요.'); } catch (_) {} fs = fs.slice(0, MAX); }
      sending = true;
      try {
        for (let n = 0; n < fs.length; n++) {
          try { toast('사진을 보내는 중이에요... (' + (n + 1) + '/' + fs.length + ')'); } catch (_) {}
          await sendChatPhoto(fs[n]);
        }
        try { toast('사진 ' + fs.length + '장을 보냈어요.'); } catch (_) {}
      } catch (_) {} finally { sending = false; }
    }, true);
  })();

  /* ---------- 38) 내가 보낸 채팅 글/사진 삭제 (상대 화면에는 '삭제된 메시지예요'로 바뀌어요) ---------- */
  (() => {
    const GONE = '삭제된 메시지예요';
    const deletable = m => m && m.sender_id === me() && m.kind !== 'sys' && typeof m.body === 'string'
      && !m.body.startsWith('[예약안내') && m.body !== GONE;
    function paint() {
      try {
        const box = document.getElementById('chatbox'); if (!box || box.dataset.hyDone === '1' || typeof chatCur === 'undefined' || !chatCur) return;
        const list = S.msgs[chatCur] || [], kids = Array.from(box.children);
        if (!list.length || kids.length !== list.length) return;
        box.dataset.hyDone = '1';
        list.forEach((m, i) => {
          const row = kids[i];
          if (m.body === GONE) { const sp = row.querySelector('span'); if (sp) sp.style.cssText = 'font-style:italic;opacity:.7'; return; }
          if (!deletable(m)) return;
          const t = row.querySelector('p'); if (!t || t.querySelector('button[data-hydel]')) return;
          t.insertAdjacentHTML('beforeend', ' <button type="button" data-hydel="' + m.id + '" class="ml-1 underline" style="font-size:10px;opacity:.9" aria-label="이 메시지 삭제">삭제</button>');
        });
      } catch (_) {}
    }
    let rq38 = 0; new MutationObserver(() => { if (rq38) return; rq38 = requestAnimationFrame(() => { rq38 = 0; paint(); }); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', async e => {
      const b = e.target && e.target.closest && e.target.closest('button[data-hydel]'); if (!b || !b.dataset.hydel) return;
      e.preventDefault(); e.stopPropagation();
      if (!confirm('이 메시지를 삭제할까요?\n상대방 화면에도 "삭제된 메시지예요"로 바뀌어요.')) return;
      const tid = chatCur; b.disabled = true;
      try {
        const { error } = await sb.rpc('delete_my_message', { p_id: +b.dataset.hydel });
        if (error) throw error;
        await loadMsgs(tid); chatModal(tid, true); toast('메시지를 삭제했어요.');
      } catch (_) { b.disabled = false; toast('삭제하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
    }, true);
  })();

  /* ---------- 39) 예약 때 기사님 예치금이 부족하면: 막다른 안내 대신 친절한 안내 창 ---------- */
  (() => {
    let lowHit = false;
    if (typeof rpc === 'function') {
      const _rpc = rpc;
      rpc = async function (name, args) { const r = await _rpc.apply(this, arguments); try { if (name === 'accept_quote' && r && r.ok === false) lowHit = true; } catch (_) {} return r; };
    }
    if (typeof pick === 'function') {
      const _pick = pick;
      pick = async function (el, qid) {
        lowHit = false;
        const r = await _pick.apply(this, arguments);
        if (!lowHit) return r;
        lowHit = false;
        try {
          const t = document.getElementById('toast'); if (t) t.classList.add('hidden');
          const rid = (typeof cmpCur !== 'undefined') ? cmpCur : 0;
          openM(head('기사님이 예약 준비 중이에요') + `
            <p class="leading-relaxed">이 기사님은 지금 <b>예약을 바로 받을 수 없는 상태</b>예요. 기사님 쪽 준비가 끝나면 다시 예약할 수 있어요.</p>
            <div class="mt-3 rounded-2xl bg-ice p-4 text-sm leading-relaxed">
              <p class="font-bold">이렇게 해 보세요</p>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                <li>다른 기사님의 견적을 골라 예약해 보세요.</li>
                <li>이 기사님이 좋다면, 잠시 뒤에 <b>예약하기</b>를 다시 눌러 주세요.</li>
              </ul>
            </div>
            <div class="mt-5 flex flex-col gap-2">
              ${rid ? '<button type="button" data-hycmp="' + rid + '" class="w-full rounded-xl bg-sea py-3 font-bold text-white">다른 견적 보기</button>' : ''}
              <button type="button" data-mclose class="w-full rounded-xl bg-ice py-3 font-bold">닫기</button>
            </div>`);
        } catch (_) {}
        return r;
      };
    }
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('[data-hycmp]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      try { compare(+b.dataset.hycmp); } catch (_) {}
    }, true);
  })();

  /* ---------- 40) 고객이 예약하려는데 예치금이 모자라면: 기사님께 '얼마 충전하세요' 안내 ---------- */
  (() => {
    const need = p => { const t = +(p && p.low_target) || 0, b = +(p && p.balance) || 0; return p && p.low && t > b ? t - b : 0; };
    const up = n => Math.max(1000, Math.ceil(n / 1000) * 1000);
    const W = n => (typeof won === 'function' ? won(n) : n.toLocaleString() + '원');
    const _pv = proView;
    proView = function () {
      _pv.apply(this, arguments);
      try {
        const p = S.pro, n = need(p); const old = document.getElementById('note-low'); if (old) old.remove();
        if (!p || !n) return;
        const pv = document.getElementById('pview'), top = pv && (document.getElementById('req-top') || pv.firstElementChild); if (!top) return;
        top.insertAdjacentHTML('afterend', `<section id="note-low" class="mt-4 rounded-3xl border-2 border-sun bg-sun/10 p-4 sm:p-5">
          <p class="text-xs font-black tracking-wide text-sun">⚠️ 고객이 예약하려 했어요</p>
          <h2 class="mt-1 text-lg font-black">예치금을 <span class="text-brand">${W(up(n))}</span> 이상 충전해 주세요</h2>
          <p class="mt-1 text-sm leading-relaxed text-sea/80">고객이 기사님 견적으로 예약하려 했지만, 예치금이 부족해서 예약이 되지 않았어요. 충전하면 고객이 바로 예약할 수 있어요.</p>
          <p class="mt-2 text-xs text-sea/60">예약이 막힌 거래의 수수료 ${W(+p.low_fee || 0)} · 현재 예치금 ${W(+p.balance || 0)} · 부족한 금액 ${W(n)}</p>
          <button type="button" data-act="wallet" class="mt-3 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white">충전하러 가기</button>
        </section>`);
      } catch (_) {}
    };
    if (typeof walletModal === 'function') {
      const _w = walletModal;
      walletModal = function () {
        const r = _w.apply(this, arguments);
        try {
          const n = need(S.pro); if (!n) return r;
          const goal = up(n), opts = Array.from(document.querySelectorAll('input[name="ch-amt"]'));
          const pick = opts.find(o => +o.value >= goal) || opts[opts.length - 1];
          if (pick) pick.checked = true;
          const lg = document.querySelector('#mm-body fieldset legend');
          if (lg && !document.getElementById('low-hint')) lg.insertAdjacentHTML('afterend', '<p id="low-hint" class="mt-1 rounded-lg bg-sun/15 px-3 py-2 text-xs font-bold text-sun">고객 예약을 위해 <b>' + W(goal) + ' 이상</b> 충전이 필요해요. (더 많이 충전해도 돼요)</p>');
        } catch (_) {}
        return r;
      };
    }
  })();

  /* ---------- 41) 채팅 목록 정리: 방마다 '어떤 거래인지' 보이고, 끝난 대화는 접어 둬요 ---------- */
  (() => {
    const label = c => {
      if (!c) return '견적 문의 중';
      const st = c.status === 'completed' ? '거래 완료' : c.status === 'pending' ? '고객 확인 대기' : '예약 확정';
      let ttl = ''; try { ttl = conTitle(c); } catch (_) {}
      let wd = ''; try { wd = c.work_date ? ' · ' + wdOf(c) + ' ' + esc(c.work_date) : ''; } catch (_) {}
      return esc(String(ttl || '')) + wd + ' · ' + st;
    };
    function tidy() {
      try {
        const body = document.getElementById('mm-body'); if (!body) return;
        const btns = Array.from(body.querySelectorAll('[data-act="chatopen"]')); if (!btns.length || body.dataset.hytidy === '1') return;
        body.dataset.hytidy = '1';
        const old = [];
        btns.forEach(b => {
          const t = (S.thr || []).find(x => x.id === +b.dataset.id); if (!t) return;
          const c = t.contract_id ? (S.con || []).find(x => x.id === t.contract_id) : null;
          const name = b.querySelector('b'); if (name && !b.querySelector('[data-hysub]')) name.insertAdjacentHTML('afterend', '<span data-hysub class="block truncate text-xs font-bold text-cool">' + label(c) + '</span>');
          if (c && c.status === 'completed') old.push(b);
        });
        if (old.length && old.length < btns.length) {
          const d = document.createElement('details'); d.className = 'mt-4';
          d.innerHTML = '<summary class="cursor-pointer rounded-xl bg-ice px-4 py-3 text-sm font-bold text-sea/70">지난 대화 (거래 완료) ' + old.length + '개 펼치기</summary>';
          old[0].parentNode.insertBefore(d, old[0]);
          old.forEach(b => d.appendChild(b));
        }
      } catch (_) {}
    }
    let rq41 = 0; new MutationObserver(() => { if (rq41) return; rq41 = requestAnimationFrame(() => { rq41 = 0; const b = document.getElementById('mm-body'); if (b && !b.querySelector('[data-act="chatopen"]')) { delete b.dataset.hytidy; return; } tidy(); }); }).observe(document.body, { childList: true, subtree: true });
  })();

  /* ---------- 42) 고객이 작업 일정을 직접 바꾸기 (기사님께는 채팅으로 알려줘요) ---------- */
  (() => {
    const esc2 = x => String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
    function mark() {
      try {
        const tid = (typeof chatCur !== 'undefined') ? chatCur : 0; if (!tid) return;
        const b = document.querySelector('#mm-body [data-act="qsched"]'); if (!b) return;
        const t = (S.thr || []).find(x => x.id === tid); if (!t || (t.u1 !== me() && t.u2 !== me()) || !t.contract_id) return;
        const c = (S.con || []).find(x => x.id === t.contract_id); if (!c || c.status === 'completed' || c.status === 'cancelled') return;
        b.setAttribute('data-act', 'hysched'); b.setAttribute('data-id', c.id); b.dataset.tid = tid; b.textContent = '📅 일정 직접 변경';
      } catch (_) {}
    }
    let rq42 = 0; new MutationObserver(() => { if (rq42) return; rq42 = requestAnimationFrame(() => { rq42 = 0; mark(); }); }).observe(document.body, { childList: true, subtree: true });
    ACT.hysched = (id, el) => {
      const c = (S.con || []).find(x => x.id === +id); if (!c) return;
      const tid = +(el && el.dataset.tid) || 0;
      openM(head('작업 일정 변경') + `<p class="text-sm leading-relaxed">${c.client_id === me() ? esc2(c.provider_name) + ' 기사님과' : esc2(c.client_name) + ' 고객님과'} 약속한 <b>작업 날짜</b>를 바꿔요.</p>
        <p class="mt-2 rounded-xl bg-ice p-3 text-sm">현재 일정 <b>${esc2(c.work_date || '채팅으로 협의')}</b></p>
        <label for="hy-wd" class="mt-4 block text-sm font-bold">바꿀 날짜</label>
        <input id="hy-wd" type="date" min="${today()}" value="${esc2(/^\d{4}-\d{2}-\d{2}$/.test(c.work_date || '') ? c.work_date : '')}" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
        <p class="mt-2 text-xs text-sea/60">바꾸면 상대방에게 채팅으로 바로 알려요. 시간은 채팅에서 기사님과 정해 주세요.</p>${errBox()}
        <div class="mt-4 flex gap-3"><button type="button" data-act="chatopen" data-id="${tid}" class="${B.s}">취소</button><button type="button" data-act="hysave" data-id="${c.id}" data-tid="${tid}" class="${B.p}">일정 바꾸기</button></div>`);
    };
    ACT.hysave = (id, el) => {
      const d = (document.getElementById('hy-wd') || {}).value, tid = +(el && el.dataset.tid) || 0;
      if (!d || d < today()) return setErr('오늘 이후의 날짜를 선택해 주세요.');
      return busy(el, async () => {
        const { error } = await sb.rpc('change_work_date', { p_contract: +id, p_date: d });
        if (error) { setErr(/cannot|exception/i.test(error.message || '') ? '일정을 바꿀 수 없는 거래예요.' : (error.message || '일정을 바꾸지 못했어요.')); return; }
        await Promise.all(['con', 'thr'].map(load));
        if (tid) { try { await loadMsgs(tid); } catch (_) {} try { sb.functions.invoke('alimtalk', { body: { chat_thread: tid } }).catch(() => {}); } catch (_) {} chatModal(tid); }
        toast('작업 일정을 ' + d + '(으)로 바꿨어요.');
      });
    };
  })();

  /* ---------- 43) 알림톡 '견적 확인' 링크(?k=요청번호.열쇠): 다른 기기에서도 내 견적을 볼 수 있게 요청을 옮겨와요 ---------- */
  (() => {
    let p; try { p = new URLSearchParams(location.search); } catch (_) { return; }
    const k = p.get('k'); const m = k && /^(\d{1,12})\.([A-Za-z0-9]{16,64})$/.exec(k); if (!m) return;
    const rid = +m[1], key = m[2];
    try { p.delete('k'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); } catch (_) {}
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      try {
        for (let n = 0; n < 40 && typeof S === 'undefined'; n++) await sleep(150);
        await sleep(1200);
        if (!sb) return;
        if (!S.user) {   // 이 기기에 로그인 정보가 없으면 임시 계정을 만들어 그 위로 요청을 옮겨요
          try { await sb.auth.signInAnonymously({ options:{ captchaToken: await window.hyCaptcha() } }); } catch (_) {}
          for (let n = 0; n < 40 && !(S.user && S.user.id); n++) await sleep(150);
        }
        if (!S.user) { toast('로그인한 뒤 알림톡 링크를 다시 눌러 주세요.'); return; }
        const { data, error } = await sb.rpc('claim_request', { p_request: rid, p_key: key });
        if (error || !data || !data.ok) {
          const why = data && data.reason;
          toast(why === 'MEMBER' ? '이미 가입한 계정의 요청이에요. 가입한 이메일로 로그인해 주세요.' : why === 'BAD_KEY' ? '링크가 올바르지 않아요. 알림톡의 버튼을 다시 눌러 주세요.' : '견적을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.');
          return;
        }
        await Promise.all(['req', 'quo', 'con', 'thr'].map(load)); render();
        toast('내 견적을 불러왔어요.');
        setTimeout(() => { try { compare(rid); } catch (_) {} }, 400);
      } catch (_) { try { toast('견적을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'); } catch (__) {} }
    })();
  })();


  /* ---------- 44) 비회원이 기존 계정으로 '로그인'해도 보낸 요청이 따라오게: 로그인 직전 열쇠를 기억했다가 로그인 뒤 옮겨요 ---------- */
  (() => {
    const KEY = 'hy_gk';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const getK = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
    const setK = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (_) {} };
    let busyK = false, lastTry = 0;
    // (가) 비회원일 때: 내 요청의 열쇠를 이 기기에 적어 둬요 (가입/로그인/다른 화면 어디서든 쓰려고)
    const remember = async () => {
      try {
        if (busyK || !sb || !S.user || !S.user.is_anonymous) return;
        if (Date.now() - lastTry < 4000) return; lastTry = Date.now(); busyK = true;
        const { data } = await sb.rpc('my_guest_key');
        if (data && /^\d{1,12}\.[A-Za-z0-9]{16,64}$/.test(data)) setK(data);
      } catch (_) {} finally { busyK = false; }
    };
    // (나) 정식 회원으로 로그인된 뒤: 적어 둔 열쇠로 비회원 때 보낸 요청을 지금 계정으로 옮겨요
    const merge = async () => {
      const k = getK(); const m = k && /^(\d{1,12})\.([A-Za-z0-9]{16,64})$/.exec(k);
      if (!m || !sb || !S.user || S.user.is_anonymous || busyK) return;
      busyK = true;
      try {
        const { data, error } = await sb.rpc('claim_request', { p_request: +m[1], p_key: m[2] });
        if (!error && data && data.ok) {
          setK('');
          if (data.moved) { await Promise.all(['req', 'quo', 'con', 'thr'].map(load)); render(); toast('비회원일 때 보낸 견적 요청을 내 계정으로 가져왔어요.'); }
        } else if (data && (data.reason === 'MEMBER' || data.reason === 'BAD_KEY' || data.reason === 'NOT_FOUND')) setK('');
      } catch (_) {} finally { busyK = false; }
    };
    const tick = () => { if (!S || !S.user) return; if (S.user.is_anonymous) remember(); else merge(); };
    (async () => {
      for (let n = 0; n < 60 && !(typeof S !== 'undefined' && sb); n++) await sleep(150);
      if (typeof S === 'undefined' || !sb) return;
      setTimeout(tick, 2500);
      try { sb.auth.onAuthStateChange(() => setTimeout(tick, 1500)); } catch (_) {}
      let rq = 0; new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; if (S.user && S.user.is_anonymous && (S.req || []).length && !getK()) remember(); }); }).observe(document.body, { childList: true, subtree: true });
      // 로그인 창을 열 때(가입 아님)도 한 번 더 적어 둬요
      document.addEventListener('click', () => { if (S.user && S.user.is_anonymous) { lastTry = 0; remember(); } }, true);
    })();
  })();


  /* ---------- 45) 컴퓨터로 요청 → 폰에서 알림톡 보고 가입/로그인: '전화번호 + 요청번호(REQ-xxxxx)'로 내 요청 찾기 ---------- */
  (() => {
    const E = x => String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const form = () => head('내 견적 요청 찾기') + `<p class="text-sm leading-relaxed text-sea/80">컴퓨터 등 다른 곳에서 견적을 요청하셨나요? <b>요청할 때 적은 전화번호</b>와 <b>카톡 알림에 적힌 요청번호</b>를 넣어 주세요.</p>
      <label for="hy-fp" class="mt-4 block text-sm font-bold">전화번호</label>
      <input id="hy-fp" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01012345678" class="mt-2 w-full rounded-xl bg-ice px-4 py-3.5">
      <label for="hy-fr" class="mt-3 block text-sm font-bold">요청번호</label>
      <div class="mt-2 flex items-center gap-2"><span class="shrink-0 rounded-xl bg-mist px-3 py-3.5 font-black text-sea">REQ-</span><input id="hy-fr" type="text" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="00036" class="min-w-0 flex-1 rounded-xl bg-ice px-4 py-3.5"></div>
      <p class="mt-2 text-xs text-sea/60">카톡 알림에 <b>REQ-00036</b>처럼 적혀 있다면 <b>REQ-</b>는 이미 붙어 있으니 <b>00036</b>만 넣어 주세요. (앞의 0도 그대로 넣어 주세요)</p>${errBox()}
      <div class="mt-4 flex gap-3"><button type="button" data-mclose class="${B.s}">닫기</button><button type="button" data-act="hyfindgo" class="${B.p}">내 요청 찾기</button></div>`;
    ACT.hyfind = () => openM(form());
    ACT.hyfindgo = el => {
      const ph = String((document.getElementById('hy-fp') || {}).value || '').replace(/\D/g, '');
      const mm = /(\d{1,12})\s*$/.exec(String((document.getElementById('hy-fr') || {}).value || '').trim());
      if (!/^01[016789]\d{7,8}$/.test(ph)) return setErr('전화번호를 숫자만 정확히 넣어 주세요.');
      if (!mm) return setErr('요청번호의 숫자를 넣어 주세요. (예: 00036)');
      const rid = +mm[1];
      return busy(el, async () => {
        if (!S.user) { try { await sb.auth.signInAnonymously({ options:{ captchaToken: await window.hyCaptcha() } }); } catch (_) {} for (let n = 0; n < 40 && !(S.user && S.user.id); n++) await sleep(150); }
        if (!S.user) return setErr('잠시 뒤 다시 눌러 주세요.');
        const { data, error } = await sb.rpc('claim_by_phone', { p_phone: ph, p_request: rid });
        if (error || !data || !data.ok) {
          const why = data && data.reason;
          return setErr(why === 'MEMBER' ? '이미 가입한 계정의 요청이에요. 가입한 이메일이나 소셜 계정으로 로그인해 주세요.' : why === 'TOO_MANY' ? '시도가 너무 많아요. 한 시간 뒤 다시 해 주세요.' : why === 'NOT_FOUND' ? '일치하는 요청을 찾지 못했어요. 전화번호와 요청번호를 다시 확인해 주세요.' : '찾지 못했어요. 잠시 뒤 다시 해 주세요.');
        }
        await Promise.all(['req', 'quo', 'con', 'thr'].map(load)); closeM(); render();
        toast('내 견적을 불러왔어요. 가입해 두시면 어디서든 볼 수 있어요.');
        setTimeout(() => { try { compare(rid); } catch (_) {} }, 400);
      });
    };
    // 로그인/가입 창 맨 아래에 '내 요청 찾기' 안내를 붙여요
    const inject = () => {
      const body = document.getElementById('mm-body'); if (!body || body.querySelector('[data-hyfindbox]')) return;
      const anchor = body.querySelector('[data-act="alogin"], [data-act="asignup"]'); if (!anchor || (S.user && !S.user.is_anonymous)) return;
      const box = document.createElement('button'); box.type = 'button'; box.dataset.hyfindbox = '1'; box.dataset.act = 'hyfind'; box.className = 'mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-cool/60 bg-ice px-4 py-3 text-left hover:bg-white';
      box.innerHTML = '<span class="text-[15px] font-bold leading-snug text-sea">📩 비회원으로 요청하셨나요? <span class="text-cool">내 견적 찾기</span></span><span class="shrink-0 text-lg font-black text-cool" aria-hidden="true">›</span>';
      const tabs = body.querySelector('[data-act="atab"]'); const row = tabs && tabs.parentElement;
      if (row && row.parentElement === body) row.insertAdjacentElement('afterend', box); else body.appendChild(box);
    };
    (async () => {
      for (let n = 0; n < 60 && !(typeof S !== 'undefined' && sb); n++) await sleep(150);
      let rq = 0; new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; try { inject(); } catch (_) {} }); }).observe(document.body, { childList: true, subtree: true });
    })();
  })();


  /* ---------- 46) 관리자 '총 회원가입': 가입 없이 견적만 보낸 임시 손님(비회원)은 빼고 진짜 가입자만 세요 ---------- */
  (() => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let cache = null, at = 0, loading = false;
    const fmt = n => Number(n).toLocaleString('ko-KR');
    const paint = () => {
      const box = document.getElementById('mem-stat'); if (!box || !cache || box.dataset.hyStat === String(at)) return;
      const pros = (S.adminPros || []).length, tot = Math.max(cache.total, pros);
      box.dataset.hyStat = String(at);
      box.innerHTML = `<p class="text-sm text-sea/70">총 회원가입</p><p class="font-display text-2xl sm:text-3xl mt-1">${fmt(tot)}명</p><p class="mt-1 text-xs text-sea/60">고객 ${fmt(Math.max(0, tot - pros))} · 기사님 ${fmt(pros)}${cache.today ? ` · <b class="text-cool">오늘 +${fmt(cache.today)}</b>` : ''}</p><p class="mt-1 text-xs text-sea/50">비회원 ${fmt(cache.guests)}명은 뺐어요</p>`;
      let g = document.getElementById('mem-stat-guest');
      if (!g) { g = document.createElement('div'); g.id = 'mem-stat-guest'; g.className = 'rounded-2xl bg-white border-2 border-sun/40 p-4'; box.insertAdjacentElement('afterend', g); }
      g.innerHTML = `<p class="text-sm text-sea/70">비회원 유입 (가입 전)</p><p class="font-display text-2xl sm:text-3xl mt-1">${fmt(cache.guests)}명</p><p class="mt-1 text-xs text-sea/60">견적 요청한 비회원 <b>${fmt(cache.guests_req || 0)}</b> · 방문만 ${fmt(Math.max(0, cache.guests - (cache.guests_req || 0)))}${cache.guests_today ? ` · <b class="text-cool">오늘 +${fmt(cache.guests_today)}</b>` : ''}</p><p class="mt-1 text-xs text-sea/50">최근 7일 +${fmt(cache.guests_7d || 0)} · 가입으로 바뀐 사람은 회원에 들어가요</p>`;
    };
    const load = async () => {
      if (loading || Date.now() - at < 60000) return; loading = true;
      try { const { data, error } = await sb.rpc('admin_member_stats'); if (!error && data && typeof data.total === 'number') { cache = data; at = Date.now(); } } catch (_) {} finally { loading = false; }
      paint();
    };
    (async () => {
      for (let n = 0; n < 60 && !(typeof S !== 'undefined' && sb); n++) await sleep(150);
      let rq = 0; new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; try { if (document.getElementById('mem-stat') && S.admin) { paint(); load(); } } catch (_) {} }); }).observe(document.body, { childList: true, subtree: true });
    })();
  })();


  /* ---------- 47) 관리자: '숨김' 처리한 요청도 볼 수 있게 (요청 목록 필터 줄 옆에 '숨김 건 보기') ---------- */
  (() => {
    const E = x => String(x == null ? '' : x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const code = id => { try { return reqCode(id); } catch (_) { return 'REQ-' + String(id).padStart(5, '0'); } };
    const when = t => { try { return fmtT(t); } catch (_) { return String(t || '').slice(0, 16).replace('T', ' '); } };
    const stTxt = r => r.status === 'matched' ? '예약 확정' : r.status === 'open' ? '진행' : '마감·취소';
    let HID = [];
    const view = () => openM(head('숨긴 요청') + `<p class="text-sm text-sea/70">관리자 목록에서 숨긴 요청이에요. 총 <b>${HID.length}</b>건 (최근 100건까지)</p>
      <div class="mt-3 max-h-[60vh] overflow-y-auto">${HID.map(r => `<div class="flex items-center justify-between gap-3 border-b border-mist py-3 text-sm"><div class="min-w-0"><b>${E(code(r.id))}</b> <span class="rounded-full bg-ice px-2 py-0.5 text-xs font-bold">${E(stTxt(r))}</span>
        <p class="mt-1 truncate text-xs text-sea/70">${E((typeof SVC !== 'undefined' && SVC[r.service]) || r.service)} · ${E(r.gu || '')} · 희망일 ${E(r.wish_date || '-')} · 접수 ${E(when(r.created_at))}</p></div>
        <button type="button" data-act="hyunhide" data-id="${r.id}" class="shrink-0 rounded-full border border-mist px-3 py-1.5 text-xs font-bold hover:bg-ice">목록에 다시 보이기</button></div>`).join('') || '<p class="mt-4 text-sm text-sea/60">숨긴 요청이 없어요.</p>'}</div>
      ${errBox()}<div class="mt-4"><button type="button" data-mclose class="${B.s}">닫기</button></div>`);
    ACT.hyhidden = async el => {
      const { data, error } = await sb.from('requests').select('id, service, gu, wish_date, status, created_at, admin_hidden').eq('admin_hidden', true).order('created_at', { ascending: false }).limit(100);
      if (error) { try { toast('숨긴 요청을 불러오지 못했어요.'); } catch (_) {} return; }
      HID = data || []; view();
    };
    ACT.hyunhide = (id, el) => busy(el, async () => {
      const { error } = await sb.from('requests').update({ admin_hidden: false }).eq('id', +id);
      if (error) return setErr('다시 보이게 하지 못했어요. (' + (error.message || '권한') + ')');
      HID = HID.filter(r => r.id !== +id); try { await load('adminReq'); } catch (_) {} view(); toast('목록에 다시 보이게 했어요.');
    });
    const inject = () => {
      if (typeof S === 'undefined' || !S.admin) return;
      const g = document.querySelector('[role="group"][aria-label="요청 상태 필터"]'); if (!g || g.dataset.hyHid) return;
      g.dataset.hyHid = '1';
      g.insertAdjacentHTML('beforeend', '<button type="button" data-act="hyhidden" class="rounded-full border border-dashed border-mist px-3 py-1.5 text-sm font-bold text-sea/70 hover:bg-ice">숨김 건 보기</button>');
    };
    (async () => {
      for (let n = 0; n < 60 && !(typeof S !== 'undefined' && sb); n++) await sleep(150);
      let rq = 0; new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; try { inject(); } catch (_) {} }); }).observe(document.body, { childList: true, subtree: true });
    })();
  })();


  /* ---------- 48) 인테리어 분야 줄이기: 조명·전기 / 목공·가구·붙박이 / 종합 리모델링 빼기 (옛 요청 이름은 그대로 보이게 유지) ---------- */
  (() => {
    const DROP_C = ['interior_light', 'interior_wood', 'interior_full'], DROP_S = ['조명·전기', '목공·가구·붙박이', '종합 리모델링'];
    const apply = () => {
      try {
        const K = typeof KINDS !== 'undefined' && KINDS.interior; if (!K) return;
        if (SVC.interior_full) SVC.interior_full = '기타 인테리어';
        for (let i = K.svcs.length - 1; i >= 0; i--) if (DROP_C.includes(K.svcs[i])) K.svcs.splice(i, 1);
        for (let i = (K.subs || []).length - 1; i >= 0; i--) if (DROP_S.includes(K.subs[i])) K.subs.splice(i, 1);
        K.desc = '도배·장판 · 타일·욕실 · 줄눈 · 도장 · 샷시 · 철거·폐기물';
        K.title = '도배·타일·욕실·도장 인테리어';
        DROP_C.forEach(c => {
          document.querySelectorAll('#qm-services input[value="' + c + '"]').forEach(i => { const l = i.closest('label'); if (l) l.remove(); });
          document.querySelectorAll('#svc option[value="' + c + '"]').forEach(o => o.remove());
        });
        const n = document.getElementById('note-interior');
        if (n) n.querySelectorAll('p').forEach(p => { if (p.textContent.includes('종합 리모델링')) p.innerHTML = '도배·장판, 타일·욕실, 줄눈, 도장·페인트, 샷시·창호, 철거·폐기물, 기타 인테리어 요청을 받을 수 있어요. 작업 사진이 있는 프로필이 선택을 많이 받아요.'; });
        document.querySelectorAll('button[data-act$="sub"]').forEach(b => { if (DROP_S.includes(b.dataset.id)) b.remove(); });
      } catch (_) {}
    };
    apply(); let rq = 0;
    new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; apply(); }); }).observe(document.body, { childList: true, subtree: true });
  })();


  /* ---------- 49) 폰 자판이 올라와도 로그인·견적 창의 입력칸이 가려지지 않게 (누른 칸을 자동으로 화면 가운데로) ---------- */
  (() => {
    const mob = () => innerWidth < 640;
    const inSheet = el => !!(el && el.closest && el.closest('#mm-body, #qm-box'));
    const show = el => {
      try {
        if (!el || !document.contains(el) || document.activeElement !== el) return;
        const v = window.visualViewport; if (!v) { el.scrollIntoView({ block: 'center' }); return; }
        const r = el.getBoundingClientRect(), top = v.offsetTop + 8, bottom = v.offsetTop + v.height - 12;
        if (r.top < top || r.bottom > bottom) el.scrollIntoView({ block: 'center', behavior: 'auto' });
      } catch (_) {}
    };
    document.addEventListener('focusin', e => {
      const el = e.target; if (!mob() || !el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !inSheet(el)) return;
      [150, 400, 800].forEach(ms => setTimeout(() => show(el), ms));
    });
    if (window.visualViewport) visualViewport.addEventListener('resize', () => {
      const el = document.activeElement; if (mob() && el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && inSheet(el)) setTimeout(() => show(el), 120);
    });
  })();


  /* ---------- 50) 수수료 미리 계산: 모든 분야를 고를 수 있게 (공식은 전부 같고, 중고장터 매입·매도만 0원) ---------- */
  (() => {
    try {
      const sel = document.getElementById('fc-svc'); if (!sel || sel.dataset.allsvc) return; sel.dataset.allsvc = '1';
      const L = [['aircon_install', '에어컨 설치·수리·청소'], ['heat_repair', '보일러 수리·교체·청소'], ['plumb_drain', '배관·하수구·누수'], ['clean_home', '입주·이사·상가 청소'], ['home_repair', '생활가전 수리·설치·청소'], ['kitchen_repair', '주방설비·후드·덕트'], ['cold_repair', '냉장·냉동 수리'], ['freezer_removal', '냉장·냉동고 철거'], ['interior_paint', '인테리어 (도배·타일·도장·샷시·철거 등)'], ['freezer_stock', '중고장터 판매 (재고 매도) · 0원'], ['freezer_sale', '중고장터 매입 · 0원']];
      sel.innerHTML = L.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
      sel.value = 'aircon_install'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  })();


  /* ---------- 51) 견적 요청 이탈 기록: 3단계 이후(사진·요청 → 전화번호 → 보내기) 어디서 멈추는지 세기 ---------- */
  (() => {
    const qm = document.getElementById('qm'); if (!qm) return;
    const seen = new Set();
    const mark = k => { try { if (seen.has(k)) return; seen.add(k); if (typeof track === 'function') track(k); } catch (_) {} };
    const on = k => { const el = qm.querySelector('[data-qp="' + k + '"]'); return !!el && !el.classList.contains('qp-off'); };
    let rq = 0;
    const scan = () => {
      try {
        if (qm.classList.contains('hidden') || typeof qstep === 'undefined' || qstep !== 3) return;
        if (on('details')) mark('qdetails');
      } catch (_) {}
    };
    new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; scan(); }); }).observe(qm, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    qm.addEventListener('click', e => { try { if (e.target.closest('#qm-next') && typeof qstep !== 'undefined' && qstep === 3 && on('details')) mark('qsubmit'); } catch (_) {} }, true);
  })();


  /* ---------- 52) 관리자 통계 '어디서 멈출까요?': 3단계 이후 세 줄(사진·요청 / 전화번호 / 보내기 누름) 추가 ---------- */
  (() => {
    let LATE = null, asked = false, rq = 0;
    const num = li => { const b = li && li.querySelector('b'); return b ? (parseInt(String(b.textContent).replace(/[^0-9]/g, ''), 10) || 0) : 0; };
    const find = (ul, t) => [...ul.children].find(li => li.textContent.includes(t));
    const row = (t, v, prev, top) => {
      const drop = prev ? Math.round((1 - v / prev) * 100) : 0, w = Math.max(Math.round(v / Math.max(1, top) * 100), v ? 2 : 0);
      return '<li data-late="1" class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"><span class="text-sm">' + t + '</span><b class="text-sm tabular-nums">' + v + '명' + (drop > 0 ? ' <span class="text-xs font-normal text-sun">(-' + drop + '%)</span>' : '') + '</b><span class="col-span-2 h-2 rounded-full bg-ice"><span class="block h-2 rounded-full bg-cool" style="width:' + w + '%"></span></span></li>';
    };
    const apply = () => {
      try {
        if (typeof S === 'undefined' || !S.admin) return;
        const h = [...document.querySelectorAll('h3')].find(x => x.textContent.includes('어디서 멈출까요')); if (!h) return;
        const ul = h.parentElement.querySelector('ul'); if (!ul || ul.querySelector('[data-late]')) return;
        if (!LATE) { if (!asked) { asked = true; sb.rpc('admin_funnel_late', { p_days: 7 }).then(r => { LATE = r && r.data && !r.error ? r.data : {}; apply(); }, () => { LATE = {}; }); } return; }
        if (!('qdetails' in LATE) && !('qphone' in LATE) && !('qsubmit' in LATE)) return;
        const l3 = find(ul, '3단계로'), done = find(ul, '견적 요청 완료'), top = num(ul.children[0]); if (!l3 || !done) return;
        const a = LATE.qdetails || 0, c = LATE.qsubmit || 0, v3 = num(l3);
        done.insertAdjacentHTML('beforebegin', row('사진·요청 입력 화면', a, v3, top) + row('보내기 누름', c, a, top));
        const dn = num(done), d = c ? Math.round((1 - dn / c) * 100) : 0, bb = done.querySelector('b');
        if (bb) bb.innerHTML = dn + '명' + (d > 0 ? ' <span class="text-xs font-normal text-sun">(-' + d + '%)</span>' : '');
        const lg = find(ul, '로그인 요구'); if (lg && num(lg) === 0) lg.remove();
      } catch (_) {}
    };
    new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; apply(); }); }).observe(document.body, { childList: true, subtree: true });
  })();


  /* ---------- 53) 견적 요청 완료 화면: '가입하세요' 안내를 크고 눈에 띄게 ---------- */
  (() => {
    const T0 = '견적이 도착하면 확인할 수 있게 가입해 주세요';
    const st = document.createElement('style');
    st.textContent = '@keyframes hyglow{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.35)}50%{box-shadow:0 0 0 10px rgba(37,99,235,0)}}'
      + '.hy-gj{border:3px solid #2563eb!important;background:linear-gradient(180deg,#eff6ff,#fff)!important;padding:1.25rem!important;animation:hyglow 2s ease-in-out 3}'
      + '.hy-gj .hy-gt{font-size:19px;line-height:1.35;font-weight:900;color:#0b1b3a}'
      + '.hy-gj .hy-gs{margin-top:.5rem;font-size:14.5px;line-height:1.55;color:#33496b}'
      + '.hy-gj .hy-gb{display:inline-block;margin-bottom:.5rem;border-radius:999px;background:#2563eb;color:#fff;font-size:12px;font-weight:800;padding:.2rem .7rem}'
      + '.hy-gj button[data-act="guestjoin"]{padding-top:.95rem!important;padding-bottom:.95rem!important;font-size:16.5px!important}';
    document.head.appendChild(st);
    const run = () => {
      try {
        document.querySelectorAll('p.font-bold').forEach(p => {
          if (!p.textContent.includes(T0)) return;
          const box = p.parentElement; if (!box || box.classList.contains('hy-gj')) return;
          box.classList.add('hy-gj');
          p.className = 'hy-gt'; p.textContent = '내 견적, 잃어버리지 않게 가입해 두세요';
          p.insertAdjacentHTML('beforebegin', '<span class="hy-gb">1분이면 끝</span><br>');
          const s = p.nextElementSibling; if (s && s.tagName === 'P') { s.className = 'hy-gs'; s.innerHTML = '가입하면 <b>폰·컴퓨터 어디서든</b> 견적 비교 · 채팅 · 작업 후 보증 신청까지 볼 수 있어요.<br>방금 보낸 요청은 그대로 이어져요.'; }
        });
      } catch (_) {}
    };
    let rq = 0; new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; run(); }); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    run();
  })();

  /* ---------- 54) 홈 화면 '지금 한여름' 실시간 현황판 (구·분야·상태만, 이름·번호 없음) ---------- */
  (() => {
    const KEY = 'hy_feed_off';
    const st = document.createElement('style');
    st.textContent = '.hy-fd{margin:14px 0;background:#fff;border:1px solid #d6dfeb;border-radius:14px;overflow:hidden}'
      + '.hy-fd.in{max-width:560px;margin:18px 0 14px 0}'
      + '@keyframes hyin{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'
      + '.hy-fd.fx{position:fixed;left:24px;bottom:24px;width:300px;margin:0;z-index:40;border:1px solid #d6dfeb;box-shadow:0 12px 32px rgba(15,23,42,.18);animation:hyin .5s ease-out}'
      + '.hy-fh{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid #e4eaf3;font-size:12px;color:#64748b}'
      + '.hy-fh b{font-weight:800;color:#0f172a}'
      + '.hy-fdot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:hyfp 2s infinite}'
      + '@keyframes hyfp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}70%,100%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}'
      + '.hy-fx{margin-left:auto;border:0;background:none;color:#94a3b8;font-size:16px;line-height:1;padding:2px 4px;cursor:pointer}'
      + '.hy-fv{overflow:hidden}.hy-fv.mv{-webkit-mask-image:linear-gradient(to bottom,transparent,#000 16%,#000 84%,transparent);mask-image:linear-gradient(to bottom,transparent,#000 16%,#000 84%,transparent)}'
      + '.hy-fl.mv{animation:hyfup var(--d,24s) linear infinite}.hy-fv:hover .hy-fl.mv,.hy-fv:active .hy-fl.mv{animation-play-state:paused}'
      + '@keyframes hyfup{to{transform:translateY(-50%)}}'
      + '@media (prefers-reduced-motion:reduce){.hy-fl.mv{animation:none}}'
      + '.hy-fr{height:38px;display:flex;align-items:center;gap:9px;padding:0 12px;font-size:13px;color:#334155}'
      + '.hy-fi{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}'
      + '.hy-fi svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
      + '.hy-ft{flex:1;min-width:0;line-height:1.25}.hy-ft p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.hy-ft .a{color:#0f172a;font-weight:600}.hy-ft .b{font-size:11.5px;color:#64748b}.hy-ft .b.ok{color:#15803d;font-weight:700}.hy-ft .b.q{color:#1d4ed8;font-weight:700}'
      + '.hy-fm{font-size:11px;color:#94a3b8;flex:none}';
    document.head.appendChild(st);
    const IC = {
      aircon:['#e0f2fe','#0369a1','<path d="M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17"/>'],
      cold:['#e0f2fe','#0369a1','<path d="M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17"/>'],
      heat:['#ffedd5','#c2410c','<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>'],
      plumb:['#dbeafe','#1d4ed8','<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>'],
      clean:['#dcfce7','#15803d','<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'],
      interior:['#ede9fe','#6d28d9','<path d="M14 4l6 6-3 3-6-6zM12 9l-8 8 3 3 8-8"/>'],
      kitchen:['#fef3c7','#b45309','<path d="M6 3v8M10 3v8M8 11v10M17 3c-2 2-2 6 0 8v10"/>'],
      home:['#f1f5f9','#334155','<path d="M4 11l8-7 8 7v9H4z"/>'],
      truck:['#f1f5f9','#334155','<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/>']
    };
    const kOf = c => { c = String(c || ''); return c.startsWith('home') ? 'home' : c.startsWith('clean') ? 'clean' : c.startsWith('aircon') ? 'aircon' : c.startsWith('heat') ? 'heat' : c.startsWith('kitchen') ? 'kitchen' : c.startsWith('plumb') ? 'plumb' : c.startsWith('interior') ? 'interior' : c === 'truck' ? 'truck' : 'cold'; };
    const ago = t => { const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 3 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.floor(m / 60) + '시간 전' : m < 2880 ? '어제' : Math.floor(m / 1440) + '일 전'; };
    const E = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let rows = null, last = 0, busyF = false, shut = false;
    const row = r => {
      const k = kOf(r.service), c = IC[k] || IC.home, qn = +r.qn || 0;
      const stt = r.status === 'completed' ? ['작업 완료', 'ok'] : (r.status === 'confirmed' || r.status === 'matched') ? ['예약 확정', 'ok'] : qn > 0 ? ['상담 진행 중', 'q'] : ['요청 접수', ''];
      const lab = (typeof SVC !== 'undefined' && SVC[r.service]) || (typeof KINDS !== 'undefined' && KINDS[k] && KINDS[k].name) || '';
      return '<div class="hy-fr"><span class="hy-fi" style="background:' + c[0] + ';color:' + c[1] + '"><svg viewBox="0 0 24 24">' + c[2] + '</svg></span>'
        + '<div class="hy-ft"><p class="a">' + E(r.gu) + ' · ' + E(lab) + '</p><p class="b ' + stt[1] + '">' + stt[0] + '</p></div><span class="hy-fm">' + ago(r.created_at) + '</span></div>';
    };
    const draw = () => {
      if (shut) return;
      const pc = window.matchMedia('(min-width:1024px)').matches;
      try { if (!pc && sessionStorage.getItem(KEY)) return; } catch (_) {}
      const cats = document.getElementById('cats');
      if (!cats || document.getElementById('hy-feed') || !rows || !rows.length) return;
      const mv = rows.length >= 4, html = rows.map(row).join('');
      const box = document.createElement('div'); box.id = 'hy-feed'; box.className = 'hy-fd';
      box.innerHTML = '<div class="hy-fh"><span class="hy-fdot"></span><b>지금 한여름</b><button type="button" class="hy-fx" aria-label="닫기">×</button></div>'
        + '<div class="hy-fv' + (mv ? ' mv' : '') + '" style="height:' + (Math.min(rows.length, 3) * 38) + 'px"><div class="hy-fl' + (mv ? ' mv' : '') + '" style="--d:' + (rows.length * 4) + 's">' + html + (mv ? html : '') + '</div></div>';
      if (pc) { box.classList.add('fx'); document.body.appendChild(box); } else cats.parentNode.insertBefore(box, cats);
      box.querySelector('.hy-fx').onclick = () => { shut = true; if (!pc) { try { sessionStorage.setItem(KEY, '1'); } catch (_) {} } box.remove(); };
    };
    const fetchF = async () => {
      if (busyF || (rows && Date.now() - last < 300000)) return; busyF = true;
      try { const { data, error } = await sb.rpc('live_feed', { p_limit: 12 }); if (!error && Array.isArray(data)) { rows = data; last = Date.now(); } } catch (_) {}
      busyF = false; draw();
    };
    let rq = 0;
    new MutationObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; if (document.getElementById('cats') && !document.getElementById('hy-feed')) (rows ? draw() : fetchF()); }); }).observe(document.body, { childList: true, subtree: true });
    if (document.getElementById('cats')) fetchF();
  })();

  /* =====================================================================
     55) 로그인하러 갔다 와도 견적 요청 입력 내용 이어주기
     - 견적 요청을 보내려다 로그인 창이 뜨면 입력한 내용을 이 기기에 30분만 잠깐 저장해요.
     - 카카오·네이버처럼 다른 사이트로 갔다 돌아와 화면이 새로 열려도, 돌아오면 3단계(마지막 단계)로 바로 이어져요.
     - 보낸 뒤에는 지우고, 사진은 저장하지 않아요(다시 올려 주세요).
     ===================================================================== */
  (function () {
    if (typeof authModal !== 'function' || typeof openQuote !== 'function' || typeof qShow !== 'function') return;
    const KEY = 'hy_qdraft', MAXAGE = 30 * 60 * 1000;
    const el = id => document.getElementById(id);
    const val = id => { const e = el(id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };
    const clear = () => { try { localStorage.removeItem(KEY); } catch (_) {} };
    const save = () => {
      try {
        const m = el('qm'); if (!m || m.classList.contains('hidden')) return;
        const r = document.querySelector('input[name="qm-svc"]:checked'); if (!r) return;
        localStorage.setItem(KEY, JSON.stringify({ t:Date.now(), svc:r.value, gu:val('qm-gu'), date:val('qm-date'), details:val('qm-details'),
          floor:val('qm-floor'), elev:val('qm-elev'), ladder:val('qm-ladder'), park:val('qm-park'), to:val('qm-to'), ton:val('qm-ton'), lift:val('qm-lift'), phone:val('qm-phone') }));
      } catch (_) {}
    };
    const setv = (id, v) => { const e = el(id); if (!e || v === undefined || v === null || v === '') return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('input', { bubbles:true })); e.dispatchEvent(new Event('change', { bubbles:true })); };
    const oa = window.authModal; window.authModal = function () { save(); return oa.apply(this, arguments); };
    const oq = window.qShow; window.qShow = function (n) { if (n === 4) clear(); return oq.apply(this, arguments); };   // 요청을 보내면 저장본 삭제

    const restore = async () => {
      let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
      clear();
      if (!d || !d.svc || Date.now() - d.t > MAXAGE || d.svc === 'freezer_sale') return;
      try {
        openQuote({ service:d.svc });
        ['gu:qm-gu', 'date:qm-date', 'details:qm-details', 'floor:qm-floor', 'elev:qm-elev', 'ladder:qm-ladder', 'park:qm-park', 'to:qm-to', 'ton:qm-ton', 'lift:qm-lift']
          .forEach(p => { const [k, id] = p.split(':'); setv(id, d[k]); });
        if (!d.svc.startsWith('etc_') && qstep === 2 && d.gu && d.date) await qNext();   // 2단계 → 3단계
        if (d.details) setv('qm-details', d.details);
        if (d.phone) setTimeout(() => setv('qm-phone', d.phone), 150);
        toast('작성하시던 견적 요청을 불러왔어요. 사진이 있었다면 다시 올려 주세요.');
      } catch (_) {}
    };
    let has = false; try { has = !!localStorage.getItem(KEY); } catch (_) {}
    if (!has) return;
    let tries = 0; const iv = setInterval(() => { tries++; if (S.user || tries > 14) { clearInterval(iv); setTimeout(restore, 1800); } }, 400);
  })();

})();
