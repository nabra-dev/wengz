import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildOpenApiDocument } from "@/server/openapi";

export async function GET(req: Request) {
  try {
    // OpenAPI document is admin-only in production.
    if (process.env.NODE_ENV === "production") {
      const session = await getServerSession(authOptions);
      if (session?.user?.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;
    const baseUrl = `${origin}/api/rest`;
    const doc = buildOpenApiDocument(baseUrl);
    return NextResponse.json(doc);
  } catch (err: any) {
    // Return error in JSON to aid debugging in Swagger UI
    return NextResponse.json(
      { error: err?.message || "Failed to generate OpenAPI document" },
      { status: 500 }
    );
  }
}
