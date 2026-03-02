// API: GET /api/finance/income-sources + POST
import { NextRequest, NextResponse } from "next/server";
import { SupabaseIncomeSourceRepository } from "@/infrastructure/db/supabase/income-source.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const repo = new SupabaseIncomeSourceRepository();
        const sources = await repo.findAll();
        return NextResponse.json(sources);
    } catch {
        return NextResponse.json({ error: "Failed to load income sources" }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await req.json() as { name: string; amount_monthly_bs: number };
        if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
        if (!body.amount_monthly_bs || body.amount_monthly_bs <= 0) {
            return NextResponse.json({ error: "amount_monthly_bs must be > 0" }, { status: 400 });
        }
        const repo = new SupabaseIncomeSourceRepository();
        const source = await repo.create({ name: body.name.trim(), amount_monthly_bs: body.amount_monthly_bs });
        return NextResponse.json(source, { status: 201 });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
