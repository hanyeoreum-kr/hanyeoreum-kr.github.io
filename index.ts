// 네이버 로그인 서버 함수 (Supabase Edge Function 이름: naver-login)
// 필요한 비밀값(Secrets): NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, SITE_URL
// 손님(가입 없이 견적 보낸 임시 계정)이 네이버로 가입하면, 같은 계정에 이메일을 붙여서 견적이 그대로 이어지게 해요.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ID = Deno.env.get("NAVER_CLIENT_ID") || "";
const SECRET = Deno.env.get("NAVER_CLIENT_SECRET") || "";
const SITE = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "") + "/";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FN = SB_URL + "/functions/v1/naver-login";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const back = (q: string) => new Response(null, { status: 302, headers: { Location: SITE + "?" + q } });
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...CORS, "Content-Type": "application/json" } });
const HEX32 = /^[0-9a-f]{32}$/;

// 손님 계정 번호를 state에 담을 때 위조를 막는 서명
async function sign(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SB_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  return Array.from(sig.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join(""); // 16자
}
const hexToUuid = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url), p = u.searchParams;

  // 1) 사이트가 "네이버 버튼을 보여도 되나?" 물어볼 때
  if (p.get("cfg")) return json({ on: !!(ID && SECRET && SITE.length > 1) });

  // 2) 버튼을 눌렀을 때: 네이버 로그인 화면 주소를 만들어요
  if (p.get("start")) {
    const ns = p.get("ns") || "";
    if (!HEX32.test(ns)) return new Response("bad request", { status: 400, headers: CORS });
    let state = ns;
    if (p.get("json")) {
      // 손님 계정으로 로그인한 상태라면 그 계정 번호를 서명해서 같이 보내요
      try {
        const tk = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (tk) {
          const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data } = await admin.auth.getUser(tk);
          const usr = data && data.user;
          if (usr && (usr as any).is_anonymous) {
            const uid = usr.id.replace(/-/g, "");
            state = ns + uid + (await sign(ns + uid));
          }
        }
      } catch (_) { /* 실패하면 그냥 일반 네이버 로그인으로 진행 */ }
    }
    const url = "https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=" + encodeURIComponent(ID) +
      "&redirect_uri=" + encodeURIComponent(FN) + "&state=" + state;
    if (p.get("json")) return json({ url });
    return new Response(null, { status: 302, headers: { Location: url } });
  }

  // 3) 네이버에서 돌아왔을 때
  const state = p.get("state") || "";
  const ns = state.slice(0, 32);
  if (!HEX32.test(ns) || (state.length !== 32 && state.length !== 80)) return new Response("bad request", { status: 400 });
  if (p.get("error")) return back("naver_err=cancel&ns=" + ns);
  const code = p.get("code");
  if (!code) return back("naver_err=fail&ns=" + ns);

  try {
    const tr = await fetch("https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=" + encodeURIComponent(ID) +
      "&client_secret=" + encodeURIComponent(SECRET) + "&code=" + encodeURIComponent(code) + "&state=" + state);
    const tk = await tr.json();
    if (!tk.access_token) return back("naver_err=fail&ns=" + ns);
    const mr = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: "Bearer " + tk.access_token } });
    const me = (await mr.json()).response || {};
    const email = String(me.email || "").trim().toLowerCase();
    if (!email) return back("naver_err=noemail&ns=" + ns);

    const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const meta = { name: me.name || "", provider: "naver" };

    // 손님 계정이 있으면 그 계정에 네이버 이메일을 붙여요 (보낸 견적이 그대로 이어져요)
    let linked = false;
    if (state.length === 80) {
      const uidHex = state.slice(32, 64), sig = state.slice(64);
      if (/^[0-9a-f]{32}$/.test(uidHex) && sig === (await sign(ns + uidHex))) {
        const { error } = await admin.auth.admin.updateUserById(hexToUuid(uidHex), { email, email_confirm: true, user_metadata: meta });
        linked = !error; // 이미 가입된 이메일이면 실패 → 아래 일반 로그인으로 진행
      }
    }
    if (!linked) await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta }).catch(() => {});

    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: SITE + "?ns=" + ns } });
    const link = data && data.properties && data.properties.action_link;
    if (error || !link) return back("naver_err=fail&ns=" + ns);
    return new Response(null, { status: 302, headers: { Location: link } });
  } catch (_) {
    return back("naver_err=fail&ns=" + ns);
  }
});
