// API Route: POST /api/auth/pin/login — PIN login with rate-limiting
import { NextRequest, NextResponse } from "next/server";
import { SupabaseUserRepository } from "@/infrastructure/db/supabase/user.repository";
import { SupabaseSessionRepository } from "@/infrastructure/db/supabase/session.repository";
import { loginWithPin } from "@/application/use-cases/login-with-pin";
import {
    checkLoginRateLimit,
    recordLoginAttempt,
} from "@/infrastructure/auth/rate-limit";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get("cf-connecting-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);

    // Rate limit check
    const rl = await checkLoginRateLimit(ip);
    if (!rl.allowed) {
        return NextResponse.json(
            {
                error: `Demasiados intentos. Intenta en ${Math.ceil((rl.retry_after_seconds ?? 900) / 60)} minutos.`,
                retry_after_seconds: rl.retry_after_seconds,
            },
            { status: 429 }
        );
    }

    const body = await req.json().catch(() => null) as { pin?: string } | null;
    if (!body?.pin || typeof body.pin !== "string") {
        return NextResponse.json({ error: "PIN requerido" }, { status: 400 });
    }

    try {
        const userRepo = new SupabaseUserRepository();
        const sessionRepo = new SupabaseSessionRepository();
        const { token, expiresAt } = await loginWithPin(body.pin, userRepo, sessionRepo);

        await recordLoginAttempt(ip, true);

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
        await recordLoginAttempt(ip, false);

        if (message === "Invalid PIN") {
            return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
        }
        if (message === "No user configured") {
            return NextResponse.json({ error: "Sistema no configurado" }, { status: 503 });
        }
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
