/** 旅の記念: ゲストのページ (/k/<token>) に渡すデータと HTML の外枠 (サーバ専用) */
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ksExamples, ksLinks, ksSettings, toOrder, type KsInvite } from "@/lib/keepsake";

export const KS_ASSET_V = "1";

/** ゲストに見せる申し込みの状態 (完成品はお渡し済みのときだけ、期限つきのリンクで) */
export async function guestOrders(inviteId: string) {
  const { data, error } = await supabaseAdmin.from("keepsake_orders").select("*").eq("invite_id", inviteId).order("created_at");
  if (error) return [];
  const orders = (data ?? []).map(toOrder);
  const links = await ksLinks(orders.filter((o) => o.status === "done").flatMap((o) => o.results.map((f) => f.path)), 6 * 3600);
  return orders.map((o) => ({
    kind: o.kind, status: o.status,
    results: o.status === "done" ? o.results.map((f) => ({ name: f.name, type: f.type, url: links[f.path] ?? null })) : [],
    link: o.status === "done" ? o.link : null,
  }));
}

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "");

export async function guestHtml(o: { inv: KsInvite | null; expired: boolean; cabin: boolean; origin: string; token: string; lang: string | null }): Promise<string> {
  let ks: any;
  if (!o.inv) ks = { gone: o.expired ? "expired" : "none", lang: o.lang };
  else {
    const inv = o.inv;
    const [orders, examples, settings, qr] = await Promise.all([
      guestOrders(inv.id), inv.gifts.includes("art") ? ksExamples() : [], ksSettings(),
      o.cabin ? QRCode.toDataURL(`${o.origin}/k/${inv.token}`, { margin: 2, width: 460, errorCorrectionLevel: "M" }).catch(() => null) : null,
    ]);
    ks = { token: inv.token, cabin: o.cabin, name: inv.name, lang: inv.lang || o.lang, gifts: inv.gifts, status: inv.status, cardGiven: !!inv.cardGivenAt, orders, examples, settings, expires: inv.expiresAt, qr };
  }
  return `<!doctype html><html lang="${/^(ja|zh|ko)$/.test(String(ks.lang)) ? ks.lang : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#070d18"><title>Crane Nest · Keepsake</title><link rel="stylesheet" href="/keepsake/guest.css?v=${KS_ASSET_V}"></head><body><div id="app"></div><script>window.KS=${json(ks)}</script><script src="/keepsake/guest.js?v=${KS_ASSET_V}"></script></body></html>`;
}
