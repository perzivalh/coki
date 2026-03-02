import { NextRequest, NextResponse } from "next/server";
import { DailySummaryService } from "@/application/services/daily-summary.service";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";
import { ConfigResolver } from "@/application/services/config-resolver";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    // Basic protection
    const authHeader = req.headers.get("Authorization") || req.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET || "coki_cron_secret";

    if (authHeader !== `Bearer ${expected}` && authHeader !== expected) {
        return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
    }

    try {
        const configRepo = new SupabaseConfigRepository();
        const resolver = new ConfigResolver(configRepo);

        const timezone = (await resolver.get("timezone")) ?? "America/La_Paz";
        const phone = await resolver.get("whatsapp_number");

        if (!phone) {
            return NextResponse.json({ error: "No owner phone configured. Set 'whatsapp_number' in Settings." }, { status: 400 });
        }

        const result = await DailySummaryService.send(timezone, String(phone));
        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("Cron failed:", err);
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
