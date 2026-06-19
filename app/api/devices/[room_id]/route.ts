import { NextRequest, NextResponse } from "next/server";
import { authorizeRoomRequest } from "@/lib/auth";
import { sendSesameCommand, SESAME_CMD } from "@/lib/sesame";
import {
  acTurnOn, acTurnOff, lightTurnOn, lightTurnOff,
  type SwitchBotCreds,
} from "@/lib/switchbot";

export const runtime = "nodejs"; // crypto / aes-cmac のため Edge不可

type Action = "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off";

/**
 * デバイス操作プロキシ。秘密鍵はここ(サーバ)から出ない。
 * 認証は PIN認証で発行された署名付きセッションCookie。
 * POST /api/devices/[room_id]   body: { action }
 *  room_id は rooms.slug を想定。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { room_id: string } }
) {
  const { action } = (await req.json().catch(() => ({}))) as {
    action?: Action;
  };

  const stay = await authorizeRoomRequest(params.room_id);
  if (!stay) {
    return NextResponse.json({ ok: false, error: "ACCESS_DENIED" }, { status: 403 });
  }
  const { room } = stay;

  const sbCreds: SwitchBotCreds = {
    token: room.switchbot_token ?? process.env.SWITCHBOT_TOKEN!,
    secret: room.switchbot_secret ?? process.env.SWITCHBOT_SECRET!,
  };

  try {
    switch (action) {
      case "unlock":
      case "lock": {
        if (!room.sesame_device_uuid || !room.sesame_secret_key || !room.sesame_api_key)
          return NextResponse.json({ ok: false, error: "NO_LOCK" }, { status: 400 });
        const r = await sendSesameCommand(
          {
            deviceUuid: room.sesame_device_uuid,
            secretKey: room.sesame_secret_key,
            apiKey: room.sesame_api_key,
          },
          action === "unlock" ? SESAME_CMD.UNLOCK : SESAME_CMD.LOCK,
          `Guest:${stay.reservation.id.slice(0, 8)}`
        );
        return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
      }

      case "ac_on":
        return respond(await acTurnOn(sbCreds, room.switchbot_ac_device_id));
      case "ac_off":
        return respond(await acTurnOff(sbCreds, room.switchbot_ac_device_id));
      case "light_on":
        return respond(await lightTurnOn(sbCreds, room.switchbot_light_device_id));
      case "light_off":
        return respond(await lightTurnOff(sbCreds, room.switchbot_light_device_id));

      default:
        return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
    }
  } catch (e) {
    console.error("device cmd error", e);
    return NextResponse.json({ ok: false, error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}

function respond(r: { ok: boolean }) {
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
}
