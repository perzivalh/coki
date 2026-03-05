// API Routes: GET + POST /api/finance/transactions
import { NextRequest, NextResponse } from "next/server";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import {
    SupabaseCategoryRepository,
    SupabaseAccountRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import type { CreateTransactionInput } from "@/domain/contracts/finance";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { BalanceLedgerService } from "@/application/services/balance-ledger";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const result = await new SupabaseTransactionRepository().list({
        cursor: searchParams.get("cursor") ?? undefined,
        limit: Number(searchParams.get("limit") ?? 20),
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        q: searchParams.get("q") ?? undefined,
    });

    return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as Partial<CreateTransactionInput> | null;
    if (!body?.type || !body?.amount_bs || !body?.account_id) {
        return NextResponse.json({ error: "type, amount_bs y account_id son requeridos" }, { status: 400 });
    }
    if (!["expense", "income"].includes(body.type)) {
        return NextResponse.json({ error: "type debe ser expense|income" }, { status: 400 });
    }
    if (body.amount_bs <= 0) {
        return NextResponse.json({ error: "amount_bs debe ser mayor a 0" }, { status: 400 });
    }

    // Validate account_id
    const accRepo = new SupabaseAccountRepository();
    const account = await accRepo.findById(body.account_id);
    if (!account) return NextResponse.json({ error: "account_id no encontrada" }, { status: 404 });

    // Validate category_id if provided
    if (body.category_id) {
        const catRepo = new SupabaseCategoryRepository();
        const category = await catRepo.findById(body.category_id);
        if (!category) return NextResponse.json({ error: "category_id no encontrada" }, { status: 404 });
    }

    const txRepo = new SupabaseTransactionRepository();
    const tx = await txRepo.create({
        type: body.type,
        amount_bs: body.amount_bs,
        category_id: body.category_id ?? null,
        account_id: body.account_id,
        note: body.note ?? null,
        source: "web",
        occurred_at: body.occurred_at,
    });

    // Adjust account balance
    try {
        const balanceRepo = new SupabaseAccountBalanceRepository();
        await BalanceLedgerService.applyOnCreate(tx, balanceRepo);
    } catch (e) {
        console.error("[Transactions API] Failed to adjust account balance:", e);
    }

    return NextResponse.json(tx, { status: 201 });
}
