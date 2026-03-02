// API: GET /api/finance/fixed-bills + POST
import { NextRequest, NextResponse } from "next/server";
import { SupabaseFixedBillRepository } from "@/infrastructure/db/supabase/fixed-bill.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const repo = new SupabaseFixedBillRepository();
        const bills = await repo.findAll();
        return NextResponse.json(bills);
    } catch {
        return NextResponse.json({ error: "Failed to load fixed bills" }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await req.json() as {
            name: string;
            amount_bs: number;
            due_day: number;
            account_id?: string | null;
            autopay?: boolean;
        };
        if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
        if (!body.amount_bs || body.amount_bs <= 0) {
            return NextResponse.json({ error: "amount_bs must be > 0" }, { status: 400 });
        }
        if (!body.due_day || body.due_day < 1 || body.due_day > 31) {
            return NextResponse.json({ error: "due_day must be between 1 and 31" }, { status: 400 });
        }
        const repo = new SupabaseFixedBillRepository();
        const bill = await repo.create({
            name: body.name.trim(),
            amount_bs: body.amount_bs,
            due_day: body.due_day,
            account_id: body.account_id ?? null,
            autopay: body.autopay ?? false,
        });
        return NextResponse.json(bill, { status: 201 });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
