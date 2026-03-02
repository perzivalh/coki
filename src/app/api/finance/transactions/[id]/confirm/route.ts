import { NextRequest, NextResponse } from "next/server";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        const repo = new SupabaseTransactionRepository();
        const updated = await repo.update(id, { status: "confirmed" });
        return NextResponse.json(updated);
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
