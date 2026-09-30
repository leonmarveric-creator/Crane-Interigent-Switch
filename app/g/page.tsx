import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toCabinRoom } from "@/lib/cabinData";

export const dynamic = "force-dynamic";
export const metadata = { title: "NFC シールの書き込み · CRANE NEST", robots: { index: false, follow: false } };

const SPOTS: [string, string][] = [["", "ホーム（全部）"], ["key", "お部屋の鍵"], ["wc", "トイレ"], ["ent", "エントランス"], ["ci", "チェックイン"], ["map", "周辺マップ"], ["gacha", "ごはんガチャ"], ["air", "空港（出発の日だけ）"]];

/** オーナー用: NFC シールに書き込むアドレスの一覧 (部屋ごと・貼る場所ごと)。QR もそのまま印刷できる */
export default async function NfcIndex() {
  if (!isStaff()) redirect("/staff/login?next=/staff");
  const h = headers(); const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("is_active", true).order("building").order("slug");
  const rooms = ((data ?? []) as any[]).map((r) => ({ slug: String(r.slug), c: toCabinRoom(r) }));
  const groups = [...rooms.map((r) => ({ key: r.slug, title: `${r.c.kanji} のお部屋（${r.slug}）`, spots: SPOTS })), { key: "lounge", title: "共用スペース・ラウンジ（鍵の案内なし）", spots: SPOTS.filter(([k]) => k !== "key") }];
  const qr = (u: string) => QRCode.toString(u, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const rows = await Promise.all(groups.map(async (g) => ({ ...g, items: await Promise.all(g.spots.map(async ([k, n]) => { const u = `${origin}/g/${encodeURIComponent(g.key)}${k ? `?s=${k}` : ""}`; return { n, u, svg: await qr(u) }; })) })));
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 60px", fontFamily: "-apple-system,'Hiragino Sans',sans-serif", color: "#16202c", background: "#f5f7fa", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>NFC シールに書き込むアドレス</h1>
      <p style={{ margin: "0 0 18px", color: "#5b6b80", fontSize: 14, lineHeight: 1.7 }}>
        iPhone の「NFC Tools」などのアプリで、シールに <b>URL</b> として書き込んでください。アドレスをタップすると開いて確認でき、長押しでコピーできます。<br />
        QR は印刷してシールの横に貼ると、NFC が使えないスマホでも開けます。
      </p>
      {rows.map((g) => (
        <section key={g.key} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
          <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{g.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
            {g.items.map((it) => (
              <div key={it.u} style={{ border: "1px solid #e1e6ee", borderRadius: 12, padding: 10, textAlign: "center" }}>
                <b style={{ display: "block", fontSize: 14, marginBottom: 6 }}>{it.n}</b>
                <div style={{ width: 120, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: it.svg }} />
                <a href={it.u} target="_blank" rel="noopener" style={{ display: "block", marginTop: 6, fontSize: 11.5, wordBreak: "break-all", color: "#2f6fbf", userSelect: "all" }}>{it.u}</a>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
