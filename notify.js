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
      if (!tossOn() || document.getElementById('card-help')) return;
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
})();
