import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/request-session";
import { registerPushDevice } from "@/lib/push";

export const runtime = "nodejs";

/** POST { token, platform, locale? } — register Expo push token for the authed user. */
export async function POST(req: Request) {
  const { session, locale } = await getRequestSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    token?: string;
    platform?: "ios" | "android" | "web";
    locale?: string;
  } | null;

  if (!body?.token || !body.platform) {
    return NextResponse.json({ error: "token and platform required" }, { status: 400 });
  }

  await registerPushDevice({
    userId: session.user.id,
    token: body.token,
    platform: body.platform,
    locale: body.locale ?? locale,
  });

  return NextResponse.json({ success: true });
}
