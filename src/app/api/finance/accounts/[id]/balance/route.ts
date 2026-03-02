// API: POST /api/finance/accounts/[id]/balance — reconcile account balance
import { NextRequest, NextResponse } from "next/server";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { SupabaseAccountRepository } from "@/infrastructure/db/supabase/category-account.repository";
import type { BalanceSource } from "@/domain/entities/account-balance";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
        const body = await req.json() as { balance_bs: number; source?: BalanceSource };

        if (body.balance_bs === undefined || body.balance_bs === null) {
            return NextResponse.json({ error: "balance_bs is required" }, { status: 400 });
        }

        // Verify account exists
        const accRepo = new SupabaseAccountRepository();
        const account = await accRepo.findById(id);
        if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

        const balanceRepo = new SupabaseAccountBalanceRepository();
        const balance = await balanceRepo.upsert(
            id,
            Number(body.balance_bs),
            body.source ?? "manual"
        );

        return NextResponse.json(balance);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
