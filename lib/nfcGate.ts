/**
 * コンシェルジュ (/g/[部屋]) の入口: ゲストの 4 桁 (電話番号の下 4 桁 = エントランス・お部屋と同じ番号) で本人確認。
 *   エントランスの鍵 (/key) やお部屋 (/room) で確認済みなら、そのまま入れる (Cookie は共通・チェックアウトまで)。
 *   確認できたゲストにだけ、手動で開けるための暗証番号 (エントランス・お部屋) を渡す。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";
import { authorizeRoomRequest } from "@/lib/auth";
import { resolveGuestKey, getSmartKeySettings } from "@/lib/smartkey";
import { toCabinRoom } from "@/lib/cabinData";

export interface GuideCodes { ent: string | null; room: string | null }
/** チェックアウトのボタン用 (このゲストの予約の、実際のチェックアウト時刻と、済んでいればその時刻) */
export interface GuideCheckout { checkOut: string; done: string | null }
export type GuideAccess =
  | { ok: true; codes: GuideCodes | null; co?: GuideCheckout | null }
  | { ok: false; redirect: string }
  | { ok: false; redirect?: undefined; entranceSlug: string | null; roomSlug: string | null; roomKanji: string | null };

const clean = (v: any) => { const s = String(v ?? "").trim(); return s ? s.slice(0, 16) : null; };

export async function guideAccess(key: string): Promise<GuideAccess> {
  const k = decodeURIComponent(key || "").trim().toLowerCase();
  const [{ data: rs }, entQ] = await Promise.all([
    supabaseAdmin.from("rooms").select("*").eq("is_active", true),
    supabaseAdmin.from("entrances").select("slug, building, keypad_code").eq("is_active", true).order("slug").then((r) => r, () => ({ data: null } as any)),
  ]);
  const ents = (((entQ as any)?.data ?? []) as any[]);
  const rooms = ((rs ?? []) as any[]).map((r) => ({ raw: r, c: toCabinRoom(r) }));
  const hit = rooms.find((r) => String(r.raw.slug || "").toLowerCase() === k || r.c.kanji === k || r.c.slug === k) ?? null;
  const building = hit ? (hit.raw.building || "Crane Nest") : "Crane Nest";
  const ent = ents.find((e) => (e.building || "Crane Nest") === building) ?? ents[0] ?? null;

  // スタッフは確認なしで見られる (暗証番号も)
  if (isStaff()) return { ok: true, codes: { ent: clean(ent?.keypad_code), room: clean(hit?.raw.keypad_code) } };

  // (1) エントランスで確認済み (チェックアウトまで有効)
  if (ent) {
    const ctx = await resolveGuestKey(ent.slug).catch(() => null);
    const rv: any = ctx?.reservation ?? null;
    // チェックアウトボタンで退室したゲストも、チェックアウト時刻の 3 時間後までは地図・送迎の案内を見られる (暗証番号は出さない)
    const left = !!(ctx && ctx.room && ctx.state === "expired" && rv?.guest_checkout_at && Date.now() < Date.parse(rv.check_out) + 3 * 3600e3);
    if (ctx && ctx.room && (ctx.state === "active" || ctx.state === "before" || left)) {
      // 別のお部屋のページを開いた → 自分のお部屋のコンシェルジュへ
      if (hit && ctx.room.id !== hit.raw.id) return { ok: false, redirect: `/g/${encodeURIComponent(ctx.room.slug)}` };
      const co: GuideCheckout | null = hit && rv ? { checkOut: rv.check_out, done: rv.guest_checkout_at ?? null } : null;
      if (left) return { ok: true, codes: null, co };
      // お部屋の番号は、滞在が始まってから (前のゲストがまだいる時間には出さない)
      return { ok: true, codes: { ent: clean(ctx.data.keypadCode), room: hit && ctx.state === "active" ? clean(ctx.room.keypad_code) : null }, co: ctx.state === "active" ? co : null };
    }
  }
  // (2) お部屋のページで確認済み
  if (hit) {
    const stay = await authorizeRoomRequest(String(hit.raw.slug)).catch(() => null);
    if (stay) {
      const co: GuideCheckout = { checkOut: stay.reservation.check_out, done: stay.reservation.guest_checkout_at ?? null };
      if (co.done) return { ok: true, codes: null, co };
      const st = await getSmartKeySettings().catch(() => null);
      return { ok: true, codes: { ent: st && st.show_keypad_code === false ? null : clean(ent?.keypad_code), room: clean(stay.room.keypad_code) }, co };
    }
  }
  return { ok: false, entranceSlug: ent?.slug ?? null, roomSlug: hit ? String(hit.raw.slug) : null, roomKanji: hit?.c.kanji ?? null };
}

/** 4 桁を入れる画面 (言語はスマホの設定 / ?lang= に合わせる) */
export function gateHtml(a: { entranceSlug: string | null; roomSlug: string | null; roomKanji: string | null }): string {
  const D = JSON.stringify(a).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>CRANE NEST · Concierge</title><meta name="robots" content="noindex"><meta name="theme-color" content="#070d18">
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(120% 80% at 50% 0%,#12233f,#070d18 70%);color:#eaf2fc;font-family:system-ui,"Hiragino Sans","Noto Sans JP","PingFang SC",sans-serif}
main{max-width:420px;margin:0 auto;padding:max(28px,env(safe-area-inset-top)) 22px 40px;text-align:center}
.lg{display:flex;gap:6px;justify-content:center;margin-bottom:26px}.lg button{font:inherit;font-size:13px;color:#aab7cc;background:none;border:1px solid #2b3a55;border-radius:999px;padding:7px 14px}.lg button.on{background:#7fd4ff;color:#06131f;border-color:#7fd4ff;font-weight:700}
.br{letter-spacing:.34em;font-size:12px;color:#7fd4ff}.rm{font:700 64px "Hiragino Mincho ProN","Noto Serif JP",serif;margin:10px 0 2px;color:#ffd58a}
h1{font-size:21px;margin:8px 0 8px}p{font-size:14px;color:#a9bbd3;line-height:1.7;margin:0 0 18px}
#pin{width:100%;height:68px;border-radius:16px;border:1px solid #33598f;background:#0c1830;color:#fff;font:700 34px ui-monospace,Menlo,monospace;letter-spacing:.5em;text-align:center;padding-left:.5em;outline:none}
#pin:focus{border-color:#7fd4ff;box-shadow:0 0 0 3px rgba(127,212,255,.2)}
#nm{display:none;width:100%;height:52px;margin-top:10px;border-radius:14px;border:1px solid #33598f;background:#0c1830;color:#fff;font:inherit;font-size:16px;padding:0 14px;outline:none}
#go{width:100%;height:58px;margin-top:14px;border:0;border-radius:16px;background:linear-gradient(135deg,#4ef0a4,#22b889);color:#04140d;font:700 18px inherit}#go:disabled{opacity:.5}
#er{min-height:22px;margin-top:12px;font-size:14px;color:#ff9b9b}small{display:block;margin-top:20px;font-size:12px;color:#7d8fa8;line-height:1.7}</style></head><body><main>
<div class="lg"><button data-l="en">EN</button><button data-l="zh">中文</button><button data-l="ko">한국어</button><button data-l="ja">日本語</button></div>
<div class="br">CRANE NEST · CONCIERGE</div><div class="rm" id="rm"></div><h1 id="t"></h1><p id="s"></p>
<input id="pin" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="4" placeholder="••••"><input id="nm" autocomplete="name">
<button id="go"></button><div id="er"></div><small id="n"></small></main>
<script>
const A=${D};
const T={ja:{t:"ご予約の 4 桁を入力",s:"ご予約の電話番号の下 4 桁です。エントランスの鍵と同じ番号で、チェックアウトまでこのページを使えます。",go:"入る",nm:"お名前（ご予約のお名前）",need:"同じ番号のご予約があります。お名前も入力してください。",bad:"番号が違います。もう一度お確かめください。",lock:"しばらく入力できません。{M} 分後にもう一度お試しください。",no:"いま有効なご予約が見つかりません。",net:"通信できませんでした。もう一度お試しください。",n:"番号が分からないときは、スタッフにお尋ねください。"},
en:{t:"Enter your 4-digit code",s:"It is the last 4 digits of the phone number on your booking — the same code as the entrance key. You can use this page until check-out.",go:"Enter",nm:"Your name (as on the booking)",need:"Another booking has the same code. Please enter your name as well.",bad:"That code is not right. Please check and try again.",lock:"Too many tries. Please try again in {M} minutes.",no:"We could not find an active booking.",net:"Connection failed. Please try again.",n:"If you do not know your code, please ask our staff."},
zh:{t:"请输入 4 位数字",s:"即预订电话号码的后 4 位，与大门钥匙相同。退房前都可以使用此页面。",go:"进入",nm:"姓名（预订时的姓名）",need:"有相同号码的预订，请同时输入姓名。",bad:"号码不正确，请再确认一次。",lock:"暂时无法输入，请在 {M} 分钟后再试。",no:"没有找到有效的预订。",net:"连接失败，请再试一次。",n:"不知道号码时，请询问工作人员。"},
ko:{t:"4자리 번호를 입력하세요",s:"예약하신 전화번호의 마지막 4자리입니다. 현관 열쇠와 같은 번호이며, 체크아웃까지 이 페이지를 이용할 수 있습니다.",go:"들어가기",nm:"성함 (예약하신 이름)",need:"같은 번호의 예약이 있습니다. 성함도 입력해 주세요.",bad:"번호가 맞지 않습니다. 다시 확인해 주세요.",lock:"잠시 입력할 수 없습니다. {M}분 후에 다시 시도해 주세요.",no:"유효한 예약을 찾을 수 없습니다.",net:"연결에 실패했습니다. 다시 시도해 주세요.",n:"번호를 모르시면 직원에게 문의해 주세요."}};
let L=(()=>{try{const q=new URLSearchParams(location.search).get("lang");if(q&&T[q])return q}catch(e){}const n=(navigator.language||"en").toLowerCase();return n.startsWith("ja")?"ja":n.startsWith("zh")?"zh":n.startsWith("ko")?"ko":"en"})();
const $=id=>document.getElementById(id);let busy=false;
function draw(){const t=T[L];document.documentElement.lang=L==="zh"?"zh-CN":L;$("t").textContent=t.t;$("s").textContent=t.s;$("go").textContent=t.go;$("n").textContent=t.n;$("nm").placeholder=t.nm;$("rm").textContent=A.roomKanji||"";document.querySelectorAll("[data-l]").forEach(b=>b.classList.toggle("on",b.dataset.l===L))}
document.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{L=b.dataset.l;draw()});
async function send(){const pin=$("pin").value.replace(/\\D/g,""),t=T[L];if(pin.length<4||busy)return;busy=true;$("go").disabled=true;$("er").textContent="";
 const name=$("nm").value.trim();let r=null,j=null;
 try{r=A.entranceSlug?await fetch("/api/key/"+encodeURIComponent(A.entranceSlug)+"/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({digits:pin,name})})
  :await fetch("/api/room/"+encodeURIComponent(A.roomSlug||"")+"/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin,name})});j=await r.json().catch(()=>null)}catch(e){}
 if(r&&r.ok&&j&&j.ok){location.reload();return}
 busy=false;$("go").disabled=false;
 if(!r){$("er").textContent=t.net;return}
 if(r.status===429){$("er").textContent=t.lock.replace("{M}",(j&&j.retryAfterMin)||10);return}
 if(r.status===409||(j&&j.needName)){$("nm").style.display="block";$("er").textContent=t.need;$("nm").focus();return}
 if(r.status===403||r.status===404){$("er").textContent=t.no;return}
 $("er").textContent=t.bad;$("pin").value="";$("pin").focus()}
$("go").onclick=send;$("pin").addEventListener("input",()=>{const v=$("pin").value.replace(/\\D/g,"").slice(0,4);$("pin").value=v;if(v.length===4&&$("nm").style.display!=="block")send()});
$("pin").addEventListener("keydown",e=>{if(e.key==="Enter")send()});$("nm").addEventListener("keydown",e=>{if(e.key==="Enter")send()});
draw();
</script></body></html>`;
}
