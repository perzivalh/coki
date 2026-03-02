// API: POST /api/finance/fixed-bills/[id]/pay — creates a fixed transaction
import { NextRequest, NextResponse } from "next/server";
import { SupabaseFixedBillRepository } from "@/infrastructure/db/supabase/fixed-bill.repository";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseAccountRepository } from "@/infrastructure/db/supabase/category-account.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
        const billRepo = new SupabaseFixedBillRepository();
        const bill = await billRepo.findById(id);

        if (!bill) return NextResponse.json({ error: "Fixed bill not found" }, { status: 404 });
        if (!bill.is_active) return NextResponse.json({ error: "Fixed bill is inactive" }, { status: 400 });

        // Resolve account — if none on bill, fallback to default
        let accountId = bill.account_id;
        if (!accountId) {
            const accRepo = new SupabaseAccountRepository();
            const defaultAcc = await accRepo.findDefault();
            accountId = defaultAcc.id;
        }

        const txRepo = new SupabaseTransactionRepository();
        const transaction = await txRepo.create({
            type: "expense",
            amount_bs: bill.amount_bs,
            category_id: null,
            account_id: accountId,
            note: `Pago fijo: ${bill.name}`,
            source: "web",
            status: "confirmed",
            bucket: "fixed",
        });

        return NextResponse.json({ transaction }, { status: 201 });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
