"use client";

import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

/** この端末で Face ID / 指紋を登録したかの目印 (ログイン画面にボタンを出すため)。 */
export const PASSKEY_FLAG = "staffPasskey";

export const passkeySupported = () => {
  try { return browserSupportsWebAuthn(); } catch { return false; }
};
export const hasPasskeyHere = () => {
  try { return localStorage.getItem(PASSKEY_FLAG) === "1"; } catch { return false; }
};
const setFlag = (on: boolean) => {
  try { on ? localStorage.setItem(PASSKEY_FLAG, "1") : localStorage.removeItem(PASSKEY_FLAG); } catch { /* noop */ }
};

export type PasskeyResult = { ok: true } | { ok: false; error: string };

async function postJson(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.ok !== false, ...j };
}

/** Face ID / 指紋を登録 (ログイン中に呼ぶ)。 */
export async function registerPasskey(): Promise<PasskeyResult> {
  try {
    const o = await postJson("/api/staff/passkey/register/options");
    if (!o.ok) return { ok: false, error: o.error || "ERR" };
    const att = await startRegistration({ optionsJSON: o.options });
    const v = await postJson("/api/staff/passkey/register/verify", att);
    if (!v.ok) return { ok: false, error: v.error || "ERR" };
    setFlag(true);
    return { ok: true };
  } catch (e: any) {
    // すでにこの端末で登録済み
    if (e?.name === "InvalidStateError" || e?.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") { setFlag(true); return { ok: true }; }
    return { ok: false, error: e?.name === "NotAllowedError" ? "CANCELLED" : "ERR" };
  }
}

/** Face ID / 指紋でログイン。 */
export async function loginWithPasskey(): Promise<PasskeyResult> {
  try {
    const o = await postJson("/api/staff/passkey/login/options");
    if (!o.ok) { if (o.error === "NO_PASSKEYS") setFlag(false); return { ok: false, error: o.error || "ERR" }; }
    const asr = await startAuthentication({ optionsJSON: o.options });
    const v = await postJson("/api/staff/passkey/login/verify", asr);
    if (!v.ok) { if (v.error === "UNKNOWN") setFlag(false); return { ok: false, error: v.error || "ERR" }; }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name === "NotAllowedError" ? "CANCELLED" : "ERR" };
  }
}

export const forgetPasskeyHere = () => setFlag(false);
