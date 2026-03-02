// API Route: GET/PATCH /api/settings — manage config from DB
import { NextRequest, NextResponse } from "next/server";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    const token = req.cookies.get("coki_session")?.value;
    return !!token;
}

// GET /api/settings → returns Config[] array
export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const repo = new SupabaseConfigRepository();
        const settings = await repo.getAll();
        return NextResponse.json(settings);
    } catch {
        return NextResponse.json({ error: "Failed to load settings" }, { status: 503 });
    }
}

// PATCH /api/settings — bulk update { key: value, ... }
export async function PATCH(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json() as Record<string, string>;
        const repo = new SupabaseConfigRepository();
        const results = await Promise.all(
            Object.entries(body).map(([key, value]) => repo.set(key, value))
        );
        return NextResponse.json({ updated: results.length });
    } catch {
        return NextResponse.json({ error: "Failed to update settings" }, { status: 503 });
    }
}

// PUT /api/settings — single key update (legacy)
export async function PUT(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json() as { key?: string; value?: string; description?: string };
    if (!body.key || !body.value) {
        return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }
    const repo = new SupabaseConfigRepository();
    const updated = await repo.set(body.key, body.value, body.description);
    return NextResponse.json({ setting: updated });
}
