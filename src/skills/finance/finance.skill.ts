// Skills: Finance Handler — Sprint 2.5 (AI context-aware)
// Flow: load context → AI decides with full category+account list → draft if missing → budget → tx

import { parseAndDecideWithAI } from "@/application/services/finance-parser";
import { sendWhatsAppMessage } from "@/application/services/whatsapp-sender";
import { DraftManager } from "@/application/services/draft-manager";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import {
    SupabaseCategoryRepository,
    SupabaseAccountRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";
import { SupabaseBudgetRepository } from "@/infrastructure/db/supabase/budget.repository";
import { SupabaseDraftTransactionRepository } from "@/infrastructure/db/supabase/draft-transaction.repository";
import { ConfigResolver } from "@/application/services/config-resolver";
import { BudgetChecker } from "@/application/services/budget-checker";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";

export interface FinanceHandlerInput {
    text: string;
    from: string;
    inboundMessageId: string;
}

export async function handleFinanceMessage(input: FinanceHandlerInput): Promise<void> {
    const { text, from, inboundMessageId } = input;

    // 1. Load categories and accounts FIRST — pass them to the AI as context
    const catRepo = new SupabaseCategoryRepository();
    const accRepo = new SupabaseAccountRepository();

    const [categories, accounts] = await Promise.all([
        catRepo.findAll(),
        accRepo.findAll(),
    ]);

    // 2. AI decides: receives real category/account list, returns direct IDs (no hints)
    const decision = await parseAndDecideWithAI(text, categories, accounts);

    if (!decision.amount_bs) {
        await sendWhatsAppMessage(
            from,
            "❓ No encontré un monto. Prueba: `35 almuerzo` o `ingreso 500 sueldo`"
        );
        return;
    }

    // 3. If AI couldn't determine category or account, start interactive draft flow
    const missingCategory = !decision.category_id && decision.type === "expense";
    const missingAccount = !decision.account_id;

    if (missingAccount || missingCategory) {
        const draftRepo = new SupabaseDraftTransactionRepository();
        const draftManager = new DraftManager(draftRepo, catRepo, accRepo);
        await draftManager.startDraft(
            text,
            {
                type: decision.type,
                amount_bs: decision.amount_bs,
                category_id: decision.category_id,
                account_id: decision.account_id,
                note: decision.note ?? text,
            },
            from,
            inboundMessageId,
        );
        return;
    }

    // 4. Resolve objects for response message and budget check
    const category = categories.find((c) => c.id === decision.category_id) ?? null;
    const account = accounts.find((a) => a.id === decision.account_id)!;

    // 5. Load config and budget limits
    const configRepo = new SupabaseConfigRepository();
    const resolver = new ConfigResolver(configRepo);
    const timezone = (await resolver.get("timezone")) ?? "America/La_Paz";

    const budgetRepo = new SupabaseBudgetRepository();
    const txRepo = new SupabaseTransactionRepository();

    const [budget, categoryLimits, currentSpend] = await Promise.all([
        budgetRepo.getOrCreate(),
        budgetRepo.listCategoryBudgets(),
        txRepo.getCurrentSpend(timezone),
    ]);

    // 6. Check budget constraints
    const checkResult = BudgetChecker.check({
        budget,
        categoryLimits,
        transaction: {
            amount_bs: decision.amount_bs,
            type: decision.type,
            category_id: decision.category_id ?? undefined,
        },
        currentSpend,
    });

    // 7. Create transaction
    let status: "pending" | "confirmed" = "confirmed";
    let expiresAt: string | null = null;

    if (checkResult.exceeds) {
        status = "pending";
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 30);
        expiresAt = expires.toISOString();
    }

    await txRepo.create({
        type: decision.type,
        amount_bs: decision.amount_bs,
        category_id: decision.category_id,
        account_id: account.id,
        note: decision.note,
        source: "whatsapp",
        inbound_message_id: inboundMessageId,
        status,
        bucket: "free",
        exceeded_daily: checkResult.exceeded_daily,
        exceeded_monthly: checkResult.exceeded_monthly,
        exceeded_category: checkResult.exceeded_category,
        confirmation_expires_at: expiresAt,
    });

    // 7b. Adjust account balance immediately (only for confirmed transactions)
    const balanceRepo = new SupabaseAccountBalanceRepository();
    let updatedBalance: number | null = null;
    if (status === "confirmed") {
        const delta = decision.type === "expense" ? -decision.amount_bs : decision.amount_bs;
        try {
            const newBal = await balanceRepo.adjust(account.id, delta);
            updatedBalance = newBal.balance_bs;
        } catch (e) {
            console.error("[Finance] Failed to adjust account balance:", e);
        }
    }

    // 8. Send reply
    if (status === "pending") {
        const warnings = checkResult.messages.map((m: string) => `⚠️ ${m}`).join("\n");
        const confirmMsg = [
            warnings,
            ``,
            `Gasto: ${decision.amount_bs.toFixed(2)} Bs en ${category?.name ?? "Sin categoría"}`,
            `¿Confirmo esta transacción? (Responde *SI* o *NO*)`
        ].join("\n");
        await sendWhatsAppMessage(from, confirmMsg);
        return;
    }

    const [todaySummary, monthSummary] = await Promise.all([
        txRepo.getSummary("today", timezone),
        txRepo.getSummary("month", timezone),
    ]);

    // Compute daily remaining (account for the newly created transaction)
    const spentToday = currentSpend.today_bs + (decision.type === "expense" ? decision.amount_bs : 0);
    const dailyRemaining = budget.daily_free_bs > 0 ? budget.daily_free_bs - spentToday : null;

    // Compute category monthly remaining (only if a limit > 0 is set for this category)
    const catLimit = categoryLimits.find(
        (cl) => cl.category_id === decision.category_id && cl.active && cl.monthly_limit_bs > 0
    );
    const catSpent = (currentSpend.month_by_category_bs[decision.category_id ?? ""] ?? 0) +
        (decision.type === "expense" ? decision.amount_bs : 0);
    const catRemaining = catLimit ? catLimit.monthly_limit_bs - catSpent : null;

    const aiTag = decision.used_ai ? "🤖" : "📐";
    const typeEmoji = decision.type === "income" ? "💰" : "💸";
    const accountLine = updatedBalance !== null
        ? `💳 ${account.name}: *${updatedBalance.toFixed(2)} Bs* disponibles`
        : `💳 Cuenta: ${account.name}`;
    const replyLines = [
        `✅ Registrado ${aiTag}: ${typeEmoji} ${decision.amount_bs.toFixed(2)} Bs`,
        `📂 Categoría: ${category?.name ?? "Sin categoría"}`,
        accountLine,
        ``,
        `📊 Hoy: -${todaySummary.total_expense_bs.toFixed(2)} | +${todaySummary.total_income_bs.toFixed(2)} Bs`,
        `📅 Mes: -${monthSummary.total_expense_bs.toFixed(2)} | +${monthSummary.total_income_bs.toFixed(2)} Bs`,
    ];

    if (dailyRemaining !== null) {
        const dailyIcon = dailyRemaining >= 0 ? "✅" : "⚠️";
        replyLines.push(`${dailyIcon} Límite diario: quedan *${dailyRemaining.toFixed(2)} Bs*`);
    }
    if (catRemaining !== null) {
        const catIcon = catRemaining >= 0 ? "✅" : "⚠️";
        replyLines.push(`${catIcon} ${category?.name ?? "Categoría"}: quedan *${catRemaining.toFixed(2)} Bs* este mes`);
    }

    const reply = replyLines.join("\n");

    await sendWhatsAppMessage(from, reply);
}
