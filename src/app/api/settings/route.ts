// API Route: GET/PUT /api/settings — manage config from DB
import { NextRequest, NextResponse } from "next/server";
import { ConfigResolver } from "@/application/services/config-resolver";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";

export const runtime = "nodejs";

// Simple auth check — reads JWT from httpOnly cookie
async function isAuthenticated(req: NextRequest): Promise<boolean> {
    const token = req.cookies.get("coki_session")?.value;
    return !!token;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repo = new SupabaseConfigRepository();
    const resolver = new ConfigResolver(repo);
    const settings = await resolver.getAll();
    return NextResponse.json({ settings });
}

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
