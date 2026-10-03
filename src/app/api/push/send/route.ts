import { NextResponse } from "next/server";

/**
 * Intentionally not a public send endpoint.
 * Push is triggered from notification helpers after in-app create.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Use notification helpers; this route is reserved." },
    { status: 405 }
  );
}
