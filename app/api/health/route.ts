import { NextResponse } from "next/server";

/** Lightweight liveness probe. Does not touch env or external services. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
