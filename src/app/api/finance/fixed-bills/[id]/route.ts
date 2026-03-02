// API: PATCH /api/finance/fixed-bills/[id] + DELETE
import { NextRequest, NextResponse } from "next/server";
import { SupabaseFixedBillRepository } from "@/infrastructure/db/supabase/fixed-bill.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    try {
        const body = await req.json() as Partial<{
            name: string;
            amount_bs: number;
            due_day: number;
            account_id: string | null;
            autopay: boolean;
            is_active: boolean;
        }>;
        if (body.amount_bs !== undefined && body.amount_bs <= 0) {
            return NextResponse.json({ error: "amount_bs must be > 0" }, { status: 400 });
        }
        if (body.due_day !== undefined && (body.due_day < 1 || body.due_day > 31)) {
            return NextResponse.json({ error: "due_day must be between 1 and 31" }, { status: 400 });
        }
        const repo = new SupabaseFixedBillRepository();
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
        const repo = new SupabaseFixedBillRepository();
        await repo.delete(id);
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
