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
      <div class="mt-6 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
        <label for="qm-phone" class="block text-sm font-bold">📱 휴대폰 번호 <span class="text-sun">(필수)</span></label>
        <p class="mt-1 text-xs text-sea/70">견적이 도착하면 카카오톡으로 알려드려요. <b>기사님께는 공개되지 않아요.</b></p>
        <input id="qm-phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-1234-5678" class="mt-2 w-full rounded-xl bg-white px-4 py-3.5 font-medium">
        <label class="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input id="qm-agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-brand">
          <span>견적 도착 알림(카카오톡) 수신과 이를 위한 휴대폰 번호 수집·이용에 동의해요 <b class="text-sun">(필수)</b>
          <details class="mt-1"><summary class="cursor-pointer text-xs font-bold text-cool">내용 보기</summary><span class="mt-1 block rounded-lg bg-white p-2 text-xs leading-relaxed">항목: 휴대폰 번호<br>목적: 견적 도착 등 견적·계약 진행 알림 발송<br>보유 기간: 회원 탈퇴 또는 동의 철회 시까지<br>발송 대행: 솔라피(SOLAPI) · 카카오<br>번호는 기사님께 제공하지 않아요. 동의하지 않으면 견적 요청을 보낼 수 없어요. 자세한 내용은 <a href="privacy.html" target="_blank" rel="noopener" class="underline">개인정보처리방침</a>을 확인해 주세요.</span></details></span></label>
      </div>`);
    const inp = document.getElementById('qm-phone');
    inp.addEventListener('input', () => { inp.value = phFmt(phDigits(inp.value)); });
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
    if (!inp.value && NP.saved.phone) { inp.value = phFmt(NP.saved.phone); if (NP.saved.notify_ok && ag) ag.checked = true; }
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
    if (msg) { e.stopPropagation(); e.preventDefault(); qErr(msg); (phOk(d) ? ag : inp).focus(); return; }
    NP.pending = d;
  }, true);

  /* 단계 화면이 바뀔 때: 3단계면 저장된 번호 채우기, 4단계(접수 완료)면 번호 저장 */
  const _qShow = qShow;
  qShow = function (n) {
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
    <p class="font-bold">💳 사용할 수 있는 카드가 없나요?</p>
    <p class="mt-1 text-xs leading-relaxed text-sea/70">아직 결제가 안 되는 카드사가 있어요. 고객센터로 문의하시면 계좌이체 충전 방법을 안내해 드려요.</p>
    <div class="mt-2">${btn('inqcharge', '', '계좌이체 충전 문의하기', 's')}</div></div>`;
  const _wallet = walletModal;
  walletModal = function (keep) {
    _wallet(keep);
    try {
      if (document.getElementById('card-help')) return;
      const b = document.querySelector('#mm-body [data-act="tosspay"]');
      if (b && b.parentElement) b.parentElement.insertAdjacentHTML('afterend', cardHelp());
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
  const DEV = {
    aircon:{ t:'에어컨 종류와 대수', items:['벽걸이', '스탠드', '2in1 (스탠드+벽걸이)', '천장형 1way', '천장형 2way', '천장형 4way', '창문형', '실외기'] },
    heat:{ t:'보일러·온수기 종류와 대수', items:['가스보일러', '기름보일러', '전기보일러', '온수기', '라디에이터'] },
    cold:{ t:'설비 종류와 대수', items:['업소용 냉장고', '업소용 냉동고', '냉장·냉동 겸용', '테이블 냉장고', '쇼케이스', '제빙기', '저온창고'] },
    kitchen:{ t:'설비 종류와 대수', items:['식기세척기', '후드·덕트', '가스레인지·화구', '오븐', '튀김기', '기타 주방설비'] },
    home:{ t:'가전 종류와 대수', items:['통돌이 세탁기', '드럼 세탁기', '건조기', '가정용 냉장고', '김치냉장고', '식기세척기', '정수기', '기타 가전'] }
  };
  const PY = ['10평 미만', '10평대', '20평대', '30평대', '40평대', '50평대', '60평 이상'];
  const DV = { kind:'', counts:{}, py:'' };
  const devKind = () => qform.service === 'truck' || !qform.service ? '' : (qform.etc || kindOf(qform.service));
  const devTotal = () => Object.values(DV.counts).reduce((a, b) => a + b, 0);
  const devLine = () => DV.kind === 'clean' ? (DV.py ? `[평수] ${DV.py}` : '') : (devTotal() ? '[기기] ' + Object.entries(DV.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}대`).join(' · ') : '');
  function devRender() {
    const sec = document.querySelector('#qm [data-step="2"]'); if (!sec) return;
    const k = devKind(); if (k !== DV.kind) { DV.kind = k; DV.counts = {}; DV.py = ''; }
    let box = document.getElementById('qm-dev');
    if (!DEV[k] && k !== 'clean') { if (box) box.remove(); return; }
    if (!box) { const dl = document.querySelector('#qm label[for="qm-date"]'); (dl || sec.lastElementChild).insertAdjacentHTML('beforebegin', '<div id="qm-dev"></div>'); box = document.getElementById('qm-dev'); }
    const opt = !!qform.etc;
    if (k === 'clean') {
      box.innerHTML = `<p class="mt-5 text-sm font-bold">청소할 곳 평수 ${opt ? '<span class="font-normal text-sea/60">(선택)</span>' : '<span class="text-sun">(필수)</span>'}</p>
        <div class="mt-2 grid grid-cols-4 gap-2">${PY.map(x => `<button type="button" data-py="${x}" class="rounded-xl border-2 px-1 py-2.5 text-xs font-bold ${DV.py === x ? 'border-brand bg-brand-50 text-brand' : 'border-mist bg-white'}">${x}</button>`).join('')}</div>`;
      return;
    }
    box.innerHTML = `<p class="mt-5 text-sm font-bold">${DEV[k].t} ${opt ? '<span class="font-normal text-sea/60">(선택)</span>' : '<span class="text-sun">(필수)</span>'}</p>
      <p class="mt-1 text-xs text-sea/60">해당하는 종류의 대수를 + 로 눌러 주세요. 여러 종류를 함께 고를 수 있어요.</p>
      <ul class="mt-2 divide-y divide-mist rounded-2xl border border-mist bg-white">${DEV[k].items.map(it => { const n = DV.counts[it] || 0; return `<li class="flex items-center gap-2 px-3 py-2.5"><span class="min-w-0 flex-1 text-sm font-bold ${n ? 'text-brand' : ''}">${it}</span>
        <button type="button" data-dv="${it}" data-d="-1" aria-label="${it} 한 대 빼기" class="h-8 w-8 rounded-full bg-ice font-bold ${n ? '' : 'opacity-40'}">−</button><span class="w-8 text-center font-bold tabular-nums">${n}</span><button type="button" data-dv="${it}" data-d="1" aria-label="${it} 한 대 더하기" class="h-8 w-8 rounded-full bg-brand font-bold text-white">+</button></li>`; }).join('')}</ul>
      ${devTotal() ? `<p class="mt-2 text-right text-sm font-bold text-brand">총 ${devTotal()}대</p>` : ''}`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#qm-dev [data-dv], #qm-dev [data-py]'); if (!b) return;
    if (b.dataset.py) DV.py = DV.py === b.dataset.py ? '' : b.dataset.py;
    else { const it = b.dataset.dv, n = Math.max(0, Math.min(50, (DV.counts[it] || 0) + +b.dataset.d)); if (n) DV.counts[it] = n; else delete DV.counts[it]; }
    qErr(''); devRender();
  });
  /* 2단계 '다음'을 누르면: 필수 확인 → 요청사항 맨 위에 한 줄로 적어 둬요 (기사님이 그대로 봐요) */
  if (qmEl) qmEl.addEventListener('click', e => {
    if (!e.target.closest('#qm-next') || qstep !== 2) return;
    const k = DV.kind; if (!DEV[k] && k !== 'clean') return;
    if (!qform.etc && (k === 'clean' ? !DV.py : !devTotal())) { e.stopPropagation(); e.preventDefault(); qErr(k === 'clean' ? '청소할 곳의 평수를 골라 주세요.' : '종류와 대수를 1대 이상 골라 주세요.'); return; }
    const d = document.getElementById('qm-details'); if (!d) return;
    const rest = d.value.replace(/^\[(기기|평수)\][^\n]*\n?/, ''), line = devLine();
    d.value = line ? line + (rest ? '\n' + rest : '') : rest;
    d.dispatchEvent(new Event('input', { bubbles:true }));
  }, true);
  const _qShow2 = qShow;
  qShow = function (n) { _qShow2(n); if (n === 2) devRender(); if (n === 4) { DV.kind = ''; DV.counts = {}; DV.py = ''; } };
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
          <h2 class="text-xl font-bold">작업일이 지났는데 완료 요청이 없는 계약 ${list.length}건</h2>
          <p class="mt-1 text-sm text-sea/70">기사님이 '작업 완료 요청'을 안 눌러서 수수료가 아직 안 빠진 건이에요. 작업이 끝난 게 확인되면 대신 눌러 주세요. 고객에게 확인 요청이 가고, 고객이 확정하지 않아도 ${S.autoH}시간 뒤 자동 확정돼요.</p>
          ${list.map(c => `<div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"><div><b>${conCode(c.id)} · ${conTitle(c)} · ${won(c.price)}</b><p class="text-xs text-sea/60">👷 ${esc(c.provider_name)} ↔ ${esc(c.client_name)} · 작업일 ${esc(c.work_date || '미정')}</p></div>${btn('acomp', c.id, '완료 요청 대신 보내기', 'a')}</div>`).join('')}</section>`);
      }
    } catch (_) {}
  };
  ACT.acomp = (id, el) => {
    if (!confirmBox(el)) return;
    busy(el, async () => { await rpc('start_completion', { p_contract:+id }); await load('con'); render(); toast(`완료 요청을 보냈어요. 고객이 확인하지 않아도 ${S.autoH}시간 뒤 자동 확정돼요.`); });
  };

  /* 관리자 요청 상세: 계약 정보 */
  const _areq = areqModal;
  areqModal = function (id) {
    _areq(id);
    try {
      const c = conOfReq(+id), body = document.getElementById('mm-body'); if (!c || !body) return;
      const close = body.querySelector('[data-mclose].' + B.s.split(' ')[0]) || [...body.querySelectorAll('[data-mclose]')].pop();
      const box = `<div class="mt-5 rounded-2xl border-2 border-sea/15 bg-ice p-4 text-sm"><p class="font-bold">🤝 계약 정보 · ${conCode(c.id)}</p>
        <dl class="mt-2 grid grid-cols-[84px_1fr] gap-y-1.5"><dt class="text-sea/60">기사님</dt><dd class="font-bold">${esc(c.provider_name || '')}</dd><dt class="text-sea/60">계약 금액</dt><dd class="font-bold">${won(c.price)}${c.final_price != null ? ` → 최종 ${won(c.final_price)}` : ''}</dd>
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
  RST.done = ['계약 성사', 'bg-sea text-white']; RST.fin = ['거래 완료', 'bg-emerald-600 text-white'];
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
    return `<section class="mt-8 rounded-3xl border-2 border-cool/30 bg-white p-5 sm:p-6"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="text-xl font-bold">고객 견적 요청 한눈에 보기</h2><span class="text-xs text-sea/50">줄을 누르면 상세 내용 · 받은 견적 · 계약이 보여요</span></div>
      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">${mini('오늘 들어온 요청', today + '건')}${mini('최근 7일 요청', week.length + '건')}${mini('견적 0건 · 2시간 넘음', late.length + '건', late.length > 0)}${mini('작업일 지났는데 완료 요청 없음', stuck.length + '건', stuck.length > 0)}${mini('7일 계약 성사율', rate + '%')}</div>
      <div class="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><b class="mr-1 text-xs text-sea/60">많이 찾는 지역(7일)</b> ${top(byGu, place)}</p><p><b class="mr-1 text-xs text-sea/60">많이 찾는 서비스(7일)</b> ${top(bySvc, k => SVC[k] || k)}</p></div>
      <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="요청 상태 필터">${fchip('wait', '견적 대기')}${fchip('got', '견적 받음')}${fchip('done', '계약 성사')}${fchip('fin', '거래 완료')}${fchip('closed', '마감·취소')}${fchip('ALL', '전체')}</div>
      <div class="mt-3 hidden grid-cols-[92px_1.4fr_1fr_100px_90px_130px] gap-3 border-b-2 border-mist px-2 pb-2 text-xs font-bold text-sea/60 sm:grid"><span>번호·접수</span><span>서비스 · 성사 기사님</span><span>지역</span><span>희망일</span><span>고객</span><span class="text-right">상태</span></div>
      <div class="max-h-[520px] overflow-y-auto">${list.map(row).join('') || `<div class="mt-3">${empty(RF === 'wait' ? '견적을 기다리는 요청이 없어요. 👍' : '해당하는 요청이 없어요.')}</div>`}</div></section>`;
  };
  const _areq2 = areqModal;
  areqModal = function (id) {
    _areq2(id);
    try { const r = S.adminReq.find(x => x.id === +id), b = document.querySelector('#mm-body span.rounded-full'); if (r && b) { const st = RST[rstate(r)]; b.textContent = st[0]; b.className = `rounded-full px-2.5 py-0.5 text-xs font-bold ${st[1]}`; } } catch (_) {}
  };
})();
