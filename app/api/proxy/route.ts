import { NextResponse } from "next/server";

/**
 * Shopify App Proxy entry point (public withdrawal form).
 *
 * ⚠️ MANDATORY: every request reaching this route MUST have its Shopify proxy
 * signature verified before any processing — see .claude/rules/shopify-app-proxy.md.
 * The full 3-step form and signature verification are implemented in Prompt 3.
 *
 * Until then this is a guarded placeholder: it does no work and exposes no data.
 */
export async function GET() {
  return NextResponse.json(
    { error: "not_implemented", message: "App Proxy form lands in Prompt 3." },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "not_implemented", message: "App Proxy form lands in Prompt 3." },
    { status: 501 },
  );
}
