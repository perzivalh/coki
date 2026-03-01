// API Route: POST /api/auth/logout
import { NextRequest, NextResponse } from "next/server";
import { SupabaseSessionRepository } from "@/infrastructure/db/supabase/session.repository";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const token = req.cookies.get("coki_session")?.value;
    if (token) {
        try {
            const sessionRepo = new SupabaseSessionRepository();
            await sessionRepo.deleteByToken(token);
        } catch {
            // best effort
        }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("coki_session", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
    });
    return response;
}
