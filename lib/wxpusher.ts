// =========================================================
// WxPusher push notification helper (server only)
//   Uses standard appToken + UID list, or simple SPT for one-person alerts.
//   Secrets stay in server env vars.
// =========================================================

export interface WxPusherSendOptions {
  title: string;
  content: string;
  appToken?: string;
  uids?: string;
  spt?: string;
}

export interface WxPusherSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

interface WxPusherResponseItem {
  uid?: string | null;
  code?: number;
  status?: string;
}

interface WxPusherResponse {
  code?: number;
  msg?: string;
  data?: WxPusherResponseItem[];
  success?: boolean;
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function sendWxPusher(options: WxPusherSendOptions): Promise<WxPusherSendResult> {
  const appToken = options.appToken || process.env.WXPUSHER_APP_TOKEN;
  const uids = splitCsv(options.uids || process.env.WXPUSHER_UIDS);
  const spts = splitCsv(options.spt || process.env.WXPUSHER_SPT);
  const useStandardPush = !!appToken && uids.length > 0;
  const useSimplePush = !useStandardPush && spts.length > 0;

  if (!useStandardPush && !useSimplePush) {
    return {
      ok: false,
      skipped: true,
      error: "WXPUSHER_APP_TOKEN/WXPUSHER_UIDS または WXPUSHER_SPT 未設定",
    };
  }

  try {
    const res = await fetch(
      useStandardPush
        ? "https://wxpusher.zjiecode.com/api/send/message"
        : "https://wxpusher.zjiecode.com/api/send/message/simple-push",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useStandardPush
            ? {
                appToken,
                content: options.content,
                summary: options.title.slice(0, 100),
                contentType: 1,
                uids,
                verifyPayType: 0,
              }
            : {
                content: options.content,
                summary: options.title.slice(0, 100),
                contentType: 1,
                ...(spts.length === 1 ? { spt: spts[0] } : { sptList: spts }),
              }
        ),
      }
    );

    if (!res.ok) return { ok: false, error: `WxPusher HTTP ${res.status}` };

    const json = (await res.json().catch(() => ({}))) as WxPusherResponse;
    if (json.code !== 1000 || json.success === false) {
      return { ok: false, error: `WxPusher code ${json.code ?? "unknown"}: ${json.msg || "送信失敗"}` };
    }

    const failed = json.data?.find((item) => typeof item.code === "number" && item.code !== 1000);
    if (failed) {
      return { ok: false, error: `WxPusher UID ${failed.uid || "unknown"}: ${failed.status || "送信失敗"}` };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "WxPusher 送信失敗" };
  }
}
