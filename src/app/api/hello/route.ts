// API Route: GET /api/hello — health check
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    return NextResponse.json({ ok: true, version: "0.1.0", service: "coki" });
}
