import { NextRequest, NextResponse } from "next/server";
import { SupabaseAccountRepository } from "@/infrastructure/db/supabase/category-account.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const balanceRepo = new SupabaseAccountBalanceRepository();
        const accounts = await balanceRepo.findAllWithAccounts();
        return NextResponse.json(accounts);
    } catch {
        // Fallback: return accounts without balances
        try {
            const repo = new SupabaseAccountRepository();
            const accounts = await repo.findAll();
            return NextResponse.json(accounts);
        } catch {
            return NextResponse.json({ error: "Failed to load accounts" }, { status: 503 });
        }
    }
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json() as { name: string; slug: string };
        const repo = new SupabaseAccountRepository();
        const account = await repo.create(body);
        return NextResponse.json(account);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
