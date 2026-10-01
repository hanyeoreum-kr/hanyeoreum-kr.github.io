/* =====================================================================
   한여름 사이트 설정 — 이 파일만 고치면 돼요.
   Supabase 대시보드 → Project Settings → API 에서 URL과 anon(public) 키를 복사해 넣으세요.
   anon 키는 공개돼도 괜찮은 키예요. (service_role 키는 절대 여기에 넣지 마세요!)
   ===================================================================== */
window.HY_CONFIG = {
  SUPABASE_URL: 'https://bxzrsggjvrolyxlpwosc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_-DbRd04mxB52782xwt0eig_GxErWPkH',

  // 사이트 주소 (비밀번호 재설정·가입 인증 메일의 링크가 여기로 돌아와요)
  SITE_URL: 'https://l87482305-web.github.io/-/',

  // 관리자 이메일 (화면 표시용 — 실제 권한은 DB의 admins 표에서만 정해져요)
  ADMIN_EMAIL: 'l87482305@gmail.com',

  // 토스페이먼츠 클라이언트 키 (넣으면 카드·간편결제·계좌이체로 바로 충전, 비워 두면 아래 계좌 입금 방식)
  // 토스페이먼츠 개발자센터 → API 키 → '결제위젯 연동 키'가 아닌 'API 개별 연동 키'의 클라이언트 키 (test_ck_... 또는 live_ck_...)
  TOSS_CLIENT_KEY: '',

  // 기사 예치금 충전 계좌 (토스 키가 없을 때만 쓰여요 · 관리자가 입금 확인 후 승인)
  BANK: { name: '은행명', account: '000-0000-0000-00', holder: '예금주' },

  // 간편 로그인: Supabase에서 켠 것만 적으세요. 예) ['kakao', 'google']
  SOCIAL: [],

  // 고객센터 연락처 (비워 두면 표시 안 함)
  CS_PHONE: '',
  CS_EMAIL: 'l87482305@gmail.com',

  // 사업자 정보 (전자상거래법상 하단 표시 필요 — 사업자등록 후 채워 주세요)
  BIZ: { name: '한여름', ceo: '', bizNo: '', mailOrderNo: '', address: '' },

  // 이용약관·개인정보처리방침 페이지 주소 (만들면 넣어 주세요)
  TERMS_URL: '',
  PRIVACY_URL: ''
};
