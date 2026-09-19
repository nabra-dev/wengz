import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { rm } from "node:fs/promises";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { chunkTmpDir } from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId")?.trim();
    if (!uploadId) {
      return NextResponse.json({ error: "uploadId required" }, { status: 400 });
    }

    const tmpDir = chunkTmpDir(session.user.id, uploadId);
    await rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Upload abort error:", error);
    return NextResponse.json({ error: "Abort failed" }, { status: 500 });
  }
}
