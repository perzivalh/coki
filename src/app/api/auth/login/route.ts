// API Route: POST /api/auth/login
import { NextRequest, NextResponse } from "next/server";
import { loginWithPin } from "@/application/use-cases/login-with-pin";
import { SupabaseUserRepository } from "@/infrastructure/db/supabase/user.repository";
import { SupabaseSessionRepository } from "@/infrastructure/db/supabase/session.repository";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { pin?: string };
        if (!body.pin || typeof body.pin !== "string") {
            return NextResponse.json({ error: "PIN required" }, { status: 400 });
        }

        const userRepo = new SupabaseUserRepository();
        const sessionRepo = new SupabaseSessionRepository();
        const { token, expiresAt } = await loginWithPin(body.pin, userRepo, sessionRepo);

        const response = NextResponse.json({ ok: true });
        response.cookies.set("coki_session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            expires: expiresAt,
            path: "/",
        });

        return response;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        const status = message === "Invalid PIN" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
