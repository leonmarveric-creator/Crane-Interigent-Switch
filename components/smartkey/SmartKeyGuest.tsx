"use client";

import { rememberLang } from "@/lib/langCookie";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SmartKeyScreen, { type Door, type CmdResult } from "./SmartKeyScreen";
import type { GuestKeyData, KeyState, SmartKeySettings } from "@/lib/smartkeyLogic";
import { SK, type SkLang } from "@/lib/smartkeyI18n";

type Pos = { lat: number; lng: number; acc: number };

/** 現在地を取得 (エントランスの位置制限用)。失敗はエラーコードで返す。 */
function getPosition(): Promise<Pos | { error: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ error: "GEO_UNAVAILABLE" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => resolve({ error: e.code === e.PERMISSION_DENIED ? "GEO_DENIED" : "GEO_UNAVAILABLE" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 },
    );
  });
}

/** 位置情報の許可がまだ聞かれていないか (聞く前に理由を説明するため)。 */
async function needsExplain(): Promise<boolean> {
  try {
    if (localStorage.getItem("skGeoExplained") === "1") return false;
  } catch { /* noop */ }
  try {
    const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (st && st.state === "granted") return false;
  } catch { /* Safari の古い版など */ }
  return true;
}

/** ゲスト用: 実際の API に接続したスマートキー画面。 */
export default function SmartKeyGuest({
  data, settings, state, initialLang,
}: { data: GuestKeyData; settings: SmartKeySettings; state: KeyState; initialLang: SkLang }) {
  const router = useRouter();
  const [lang, setLang] = useState<SkLang>(initialLang);
  const [ask, setAsk] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);
  const t = SK[lang];
  const base = `/api/key/${encodeURIComponent(data.entranceSlug)}`;
  const roomPanelHref = data.roomSlug ? `/room/${data.roomSlug}?lang=${lang === "zh-TW" ? "zh" : lang}` : null;
  // お部屋の操作パネルを先読みしておく (押した瞬間に切り替わるように)
  useEffect(() => {
    if (state === "active" && roomPanelHref) { try { router.prefetch(roomPanelHref); } catch { /* noop */ } }
  }, [router, state, roomPanelHref]);

  const post = async (url: string, body: unknown): Promise<CmdResult> => {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok && j.ok !== false, error: j.error as string | undefined, distance: typeof j.distance === "number" ? j.distance : undefined };
    } catch {
      return { ok: false, error: "NETWORK" };
    }
  };

  /** はじめての時は「なぜ位置情報が必要か」を先に説明する */
  const explainFirst = async (): Promise<boolean> => {
    if (!(await needsExplain())) return true;
    setAsk(true);
    const ok = await new Promise<boolean>((resolve) => { answer.current = resolve; });
    setAsk(false);
    if (ok) { try { localStorage.setItem("skGeoExplained", "1"); } catch { /* noop */ } }
    return ok;
  };

  const command = async (door: Door, action: "unlock" | "lock"): Promise<CmdResult> => {
    // エントランスの解錠だけ位置を確認 (施錠・お部屋はそのまま)
    if (door === "entrance" && action === "unlock" && data.geofence) {
      if (!(await explainFirst())) return { ok: false, error: "GEO_CANCEL" };
      const pos = await getPosition();
      if ("error" in pos) return { ok: false, error: pos.error };
      return post(`${base}/cmd`, { door, action, pos });
    }
    return post(`${base}/cmd`, { door, action });
  };

  const reply = (ok: boolean) => { answer.current?.(ok); answer.current = null; };

  return (
    <>
      <SmartKeyScreen
        data={data}
        settings={settings}
        state={state}
        lang={lang}
        onLang={(l) => {
          setLang(l);
          try { localStorage.setItem("skLang", l); } catch { /* noop */ }
          rememberLang(l);
        }}
        doors={data.roomSlug ? 2 : 1}
        roomPanelHref={roomPanelHref}
        onVerify={async (name, digits) => {
          const r = await post(`${base}/verify`, { name, digits });
          if (r.ok) router.refresh();
          return r;
        }}
        onCommand={command}
        onVerifyAgain={async () => {
          await fetch(`${base}/verify`, { method: "DELETE" }).catch(() => null);
          router.refresh();
        }}
      />
      {ask && <GeoExplain t={t} onOk={() => reply(true)} onCancel={() => reply(false)} />}
    </>
  );
}

/** 位置情報を使う理由の説明 (ブラウザの許可ダイアログの前に出す) */
function GeoExplain({ t, onOk, onCancel }: { t: (typeof SK)[SkLang]; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0b1a33]/55 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-[#10213f] shadow-2xl">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf1fc] text-3xl">📍</div>
        <h2 className="text-center text-lg font-bold">{t.geoAskTitle}</h2>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-[#10213f]/80">{t.geoAskBody}</p>
        <button onClick={onOk}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-[#0b2f6e] to-[#1253b8] py-3.5 text-[15px] font-semibold text-white shadow active:scale-[0.98]">
          {t.geoAskOk}
        </button>
        <button onClick={onCancel} className="mt-2 w-full rounded-full py-3 text-[14px] font-medium text-[#10213f]/60">
          {t.geoAskCancel}
        </button>
      </div>
    </div>
  );
}
