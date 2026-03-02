import { NextRequest, NextResponse } from "next/server";
import { SupabaseCategoryRepository } from "@/infrastructure/db/supabase/category-account.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const repo = new SupabaseCategoryRepository();
        const categories = await repo.findAll();
        return NextResponse.json(categories);
    } catch {
        return NextResponse.json({ error: "Failed to load categories" }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json() as { name: string; slug: string; icon?: string };
        const repo = new SupabaseCategoryRepository();
        const category = await repo.create(body);
        return NextResponse.json(category);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
