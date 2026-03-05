import { NextRequest, NextResponse } from "next/server";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { BalanceLedgerService } from "@/application/services/balance-ledger";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        const repo = new SupabaseTransactionRepository();
        const before = await repo.findById(id);
        if (!before) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

        const updated = await repo.update(id, { status: "confirmed" });
        try {
            const balanceRepo = new SupabaseAccountBalanceRepository();
            await BalanceLedgerService.applyOnStatusTransition(before, updated, balanceRepo);
        } catch (err) {
            console.error("[API confirm] Failed to adjust balance:", err);
        }
        return NextResponse.json(updated);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
