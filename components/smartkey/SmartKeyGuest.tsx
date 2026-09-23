"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SmartKeyScreen, { type Door } from "./SmartKeyScreen";
import type { GuestKeyData, KeyState, SmartKeySettings } from "@/lib/smartkeyLogic";
import type { SkLang } from "@/lib/smartkeyI18n";

/** ゲスト用: 実際の API に接続したスマートキー画面。 */
export default function SmartKeyGuest({
  data, settings, state, initialLang,
}: { data: GuestKeyData; settings: SmartKeySettings; state: KeyState; initialLang: SkLang }) {
  const router = useRouter();
  const [lang, setLang] = useState<SkLang>(initialLang);
  const base = `/api/key/${encodeURIComponent(data.entranceSlug)}`;

  const post = async (url: string, body: unknown) => {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok && j.ok !== false, error: j.error as string | undefined };
    } catch {
      return { ok: false, error: "NETWORK" };
    }
  };

  return (
    <SmartKeyScreen
      data={data}
      settings={settings}
      state={state}
      lang={lang}
      onLang={(l) => {
        setLang(l);
        try { localStorage.setItem("skLang", l); } catch { /* noop */ }
      }}
      doors={data.roomSlug ? 2 : 1}
      roomPanelHref={data.roomSlug ? `/room/${data.roomSlug}?lang=${lang === "zh-TW" ? "zh" : lang}` : null}
      onVerify={async (name, digits) => {
        const r = await post(`${base}/verify`, { name, digits });
        if (r.ok) router.refresh();
        return r;
      }}
      onCommand={(door: Door, action) => post(`${base}/cmd`, { door, action })}
      onVerifyAgain={async () => {
        await fetch(`${base}/verify`, { method: "DELETE" }).catch(() => null);
        router.refresh();
      }}
    />
  );
}
