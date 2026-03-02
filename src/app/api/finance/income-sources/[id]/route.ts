// API: PATCH /api/finance/income-sources/[id] + DELETE
import { NextRequest, NextResponse } from "next/server";
import { SupabaseIncomeSourceRepository } from "@/infrastructure/db/supabase/income-source.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const body = await req.json() as Partial<{ name: string; amount_monthly_bs: number; is_active: boolean }>;
        if (body.amount_monthly_bs !== undefined && body.amount_monthly_bs <= 0) {
            return NextResponse.json({ error: "amount_monthly_bs must be > 0" }, { status: 400 });
        }
        const repo = new SupabaseIncomeSourceRepository();
        const updated = await repo.update(id, body);
        return NextResponse.json(updated);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const repo = new SupabaseIncomeSourceRepository();
        await repo.delete(id);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
