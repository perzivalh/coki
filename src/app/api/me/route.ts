// API Route: GET /api/me — verify session
import { NextRequest, NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/infrastructure/db/supabase/session.repository";
import { jwtVerify } from "jose";

export const runtime = "nodejs";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET ?? "change-me-in-production-at-least-32-chars"
);

export async function GET(req: NextRequest) {
    const token = req.cookies.get("coki_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const sessionRepo = new SupabaseSessionRepository();
        const session = await sessionRepo.findByToken(token);
        if (!session) return NextResponse.json({ error: "Session expired" }, { status: 401 });

        return NextResponse.json({ ok: true, user_id: payload.sub });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
