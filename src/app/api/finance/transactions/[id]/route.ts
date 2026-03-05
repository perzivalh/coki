import { NextRequest, NextResponse } from "next/server";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { supabaseService } from "@/infrastructure/db/supabase/client";
import { BalanceLedgerService } from "@/application/services/balance-ledger";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        const body = await req.json();
        const repo = new SupabaseTransactionRepository();
        const before = await repo.findById(id);
        if (!before) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

        const updated = await repo.update(id, body);
        try {
            const balanceRepo = new SupabaseAccountBalanceRepository();
            await BalanceLedgerService.applyOnUpdate(before, updated, balanceRepo);
        } catch (err) {
            console.error("[Transactions PATCH] Failed to adjust balance:", err);
        }
        return NextResponse.json(updated);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        const repo = new SupabaseTransactionRepository();
        const before = await repo.findById(id);
        if (!before) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

        const { error } = await supabaseService.from("transactions").delete().eq("id", id);
        if (error) throw new Error(error.message);

        try {
            const balanceRepo = new SupabaseAccountBalanceRepository();
            await BalanceLedgerService.applyOnDelete(before, balanceRepo);
        } catch (err) {
            console.error("[Transactions DELETE] Failed to adjust balance:", err);
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
