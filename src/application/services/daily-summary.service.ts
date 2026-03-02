// Application Service: Daily Summary CRON handler
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseDailySummaryRepository } from "@/infrastructure/db/supabase/daily-summary.repository";
import { SupabaseBudgetRepository } from "@/infrastructure/db/supabase/budget.repository";
import { sendWhatsAppMessage } from "./whatsapp-sender";
import { supabaseService } from "@/infrastructure/db/supabase/client";

export class DailySummaryService {
    static async send(timezone: string, ownerPhone: string): Promise<{ ok: boolean; reason?: string }> {
        console.log("[DailySummary] start — phone:", ownerPhone, "tz:", timezone);
        const dailyRepo = new SupabaseDailySummaryRepository();
        const txRepo = new SupabaseTransactionRepository();
        const budgetRepo = new SupabaseBudgetRepository();

        // 1. Get today's date in local timezone
        const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
        const todayStr = formatter.format(new Date());
        console.log("[DailySummary] todayStr:", todayStr);

        // 2. Idempotency check
        const existing = await dailyRepo.findByDate(todayStr);
        if (existing && existing.delivery_status === "sent") {
            return { ok: false, reason: "Already sent today" };
        }

        // 3. Check if user spoke in the last 24 hours (best-effort — skip if query fails)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count, error: msgError } = await supabaseService
            .from("inbound_messages")
            .select("*", { count: "exact", head: true })
            .gte("created_at", twentyFourHoursAgo);

        if (msgError) {
            console.warn("[DailySummary] Could not check inbound_messages (skipping gate):", msgError.message);
        } else {
            console.log("[DailySummary] inbound_messages count:", count);
            if (!count) {
                return { ok: false, reason: "No user activity in last 24h" };
            }
        }

        // 4. Gather data
        const [currentSpend, budget] = await Promise.all([
            txRepo.getCurrentSpend(timezone),
            budgetRepo.getOrCreate(),
        ]);

        console.log("[DailySummary] today_bs:", currentSpend.today_bs, "month_bs:", currentSpend.month_bs);
        if (currentSpend.today_bs === 0) {
            return { ok: false, reason: "No spending today" };
        }

        // 5. Build message
        // Find top 3 categories
        const catArray = Object.entries(currentSpend.month_by_category_bs).map(([id, amount]) => ({ id, amount }));
        catArray.sort((a, b) => b.amount - a.amount);
        const top3 = catArray.slice(0, 3);

        const lines = [
            `📅 *Resumen Diario* (${todayStr})`,
            ``,
            `💰 *Gasto Total Hoy:* ${currentSpend.today_bs.toFixed(2)} Bs`,
            ``
        ];

        // Format top categories
        if (top3.length > 0) {
            // Need category names. We can fetch them quickly.
            const { data: catData } = await supabaseService.from("categories").select("id, name");
            const catMap = new Map((catData || []).map((c: { id: string; name: string }) => [c.id, c.name]));

            lines.push(`📊 *Top Categorías (Mes):*`);
            top3.forEach((c, idx) => {
                const name = catMap.get(c.id) || "Desconocida";
                lines.push(`${idx + 1}. ${name}: ${c.amount.toFixed(2)} Bs`);
            });
            lines.push(``);
        }

        if (budget.daily_free_bs > 0) {
            lines.push(`🔮 *Presupuesto Diario:* ${budget.daily_free_bs.toFixed(2)} Bs`);
        }
        if (budget.monthly_total_bs > 0) {
            lines.push(`⚠️ *Total Mensual Gasto:* ${currentSpend.month_bs.toFixed(2)} / ${budget.monthly_total_bs.toFixed(2)} Bs`);
        }

        lines.push(``);
        lines.push(`¿Tienes algún gasto pendiente de hoy? Envíamelo y lo registro.`);

        const messageText = lines.join("\n");

        // 6. Create DailySummary log pending
        const summary = existing || await dailyRepo.create(todayStr, { top_categories: top3, today_bs: currentSpend.today_bs });

        // 7. Send WA and update log
        console.log("[DailySummary] sending WA to:", ownerPhone);
        try {
            await sendWhatsAppMessage(ownerPhone, messageText);
            await dailyRepo.markSent(summary.id);
            return { ok: true };
        } catch (err: unknown) {
            console.error("Failed to send WhatsApp summary:", err);
            await dailyRepo.markFailed(summary.id);
            throw new Error("WhatsApp API failed: " + (err instanceof Error ? err.message : "Unknown error"));
        }
    }
}
