// API Route: GET /api/finance/summary?range=today|month
import { NextRequest, NextResponse } from "next/server";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";
import { ConfigResolver } from "@/application/services/config-resolver";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") as "today" | "month" | null;

    if (!range || !["today", "month"].includes(range)) {
        return NextResponse.json({ error: "range debe ser today|month" }, { status: 400 });
    }

    const bucket = searchParams.get("bucket") as "free" | "fixed" | null;

    const configRepo = new SupabaseConfigRepository();
    const resolver = new ConfigResolver(configRepo);
    const timezone = (await resolver.get("timezone")) ?? "America/La_Paz";

    const txRepo = new SupabaseTransactionRepository();
    const summary = await txRepo.getSummary(range, timezone, bucket ?? undefined);

    return NextResponse.json(summary);
}
