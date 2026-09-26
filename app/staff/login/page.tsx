"use client";

import { useEffect, useState } from "react";
import { Loader2, LogIn, ScanFace, Eye, EyeOff } from "lucide-react";
import { hasPasskeyHere, loginWithPasskey, passkeySupported } from "@/lib/staffPasskeyClient";

/** ログイン後の行き先 (お父さんの送迎画面 /driver からも同じログインを使う) */
function nextUrl() {
  try { const n = new URLSearchParams(location.search).get("next"); if (n === "/driver") return "/driver"; } catch { /* ignore */ }
  return "/staff";
}

/** スタッフのログイン (中文メイン)。 */
export default function StaffLogin() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<null | "wrong" | "notset" | "network">(null);
  const [show, setShow] = useState(false);
  const [pk, setPk] = useState(false);          // この端末で Face ID を登録済み
  const [pkBusy, setPkBusy] = useState(false);
  const [pkErr, setPkErr] = useState(false);
  useEffect(() => { setPk(passkeySupported() && hasPasskeyHere()); }, []);
  const faceLogin = async () => {
    setPkBusy(true); setPkErr(false);
    const r = await loginWithPasskey();
    setPkBusy(false);
    if (r.ok) { location.href = nextUrl(); return; }
    if (r.error !== "CANCELLED") setPkErr(true);
    if (!hasPasskeyHere()) setPk(false);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/staff/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) { location.href = nextUrl(); return; }
    const j = res ? await res.json().catch(() => ({})) : null;
    setErr(!res ? "network" : j?.error === "NOT_CONFIGURED" ? "notset" : "wrong");
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <div className="relative -mx-5 h-[46vh] min-h-[280px] overflow-hidden rounded-b-[36px] shadow-[0_18px_40px_-24px_rgba(59,50,40,0.6)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/staff/xiaobo.jpg" alt="Xiaobo" className="h-full w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#f6efe2] to-transparent" />
      </div>
      <h1 className="relative z-10 mt-3 text-center text-[28px] font-bold tracking-wide">Xiaobo 助手</h1>
      <p className="mt-1 text-center text-base text-[#7a6d5c]">民宿清扫・入住管理</p>
      {pk && (
        <div className="mt-8">
          <button onClick={faceLogin} disabled={pkBusy}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#2f8a57] py-5 text-[22px] font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-60">
            {pkBusy ? <Loader2 className="h-7 w-7 animate-spin" /> : <ScanFace className="h-8 w-8" />} 用 Face ID 登录
          </button>
          {pkErr && <p className="mt-2 text-center text-base font-semibold text-[#d9493e]">没有成功，请再试一次，或用下面的密码登录</p>}
          <p className="mt-6 text-center text-sm text-[#a2968a]">— 或者用密码 —</p>
        </div>
      )}
      <form onSubmit={submit} className={`${pk ? "mt-3" : "mt-8"} space-y-4`}>
        <label className="block text-lg font-semibold">
          密码
          <span className="relative mt-2 block">
            {/* 英字・数字・記号どれでも入力できる (数字だけのキーボードにしない) */}
            <input type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }}
              className="w-full rounded-2xl border-2 border-[#e2d6c2] bg-white py-4 pl-5 pr-14 text-center text-2xl tracking-[0.2em] outline-none focus:border-[#3b7dd8]" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "隐藏密码" : "显示密码"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#7a6d5c]">
              {show ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
            </button>
          </span>
        </label>
        {err === "wrong" && <p className="text-center text-base font-semibold text-[#d9493e]">密码不对，请再试一次（注意大小写）</p>}
        {err === "notset" && <p className="text-center text-base font-semibold text-[#d9493e]">服务器还没有设置密码（STAFF_PASSWORD），请联系家人</p>}
        {err === "network" && <p className="text-center text-base font-semibold text-[#d9493e]">网络连接失败，请再试一次</p>}
        <button type="submit" disabled={busy || !pw}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3b7dd8] py-4 text-xl font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-50">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />} 登录
        </button>
      </form>
    </main>
  );
}
