import {
    parseAndDecideWithAI,
    parseFinanceMessageV2,
    type ParseReferenceItem,
} from "@/application/services/finance-parser";
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
import { BalanceLedgerService } from "@/application/services/balance-ledger";

export interface FinanceHandlerInput {
    text: string;
    from: string;
    inboundMessageId: string;
}

const HIGH_CONFIDENCE = 0.8;
const REVIEW_CONFIDENCE = 0.55;

export async function handleFinanceMessage(input: FinanceHandlerInput): Promise<void> {
    const { text, from, inboundMessageId } = input;

    const catRepo = new SupabaseCategoryRepository();
    const accRepo = new SupabaseAccountRepository();
    const [categories, accounts] = await Promise.all([
        catRepo.findAll(),
        accRepo.findAll(),
    ]);

    const configRepo = new SupabaseConfigRepository();
    const resolver = new ConfigResolver(configRepo);
    const aiModel = (await resolver.get("ai_model")) ?? "qwen-3-32b";
    const aiSystemPrompt = await resolver.get("ai_system_prompt");
    const featureNluV2 = ((await resolver.get("feature_nlu_v2")) ?? "true").toLowerCase() === "true";

    const categoryRefs: ParseReferenceItem[] = categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
    }));
    const accountRefs: ParseReferenceItem[] = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
    }));

    const parsed = featureNluV2
        ? await parseFinanceMessageV2(
            text,
            categoryRefs,
            accountRefs,
            { model: aiModel, systemPrompt: aiSystemPrompt },
        )
        : await parseLegacyParser(text, categories, accounts, aiModel, aiSystemPrompt);

    if (!parsed.amount_bs) {
        await sendWhatsAppMessage(
            from,
            "No pude detectar el monto. Ejemplo: 35 pasaje, o ingreso 500 sueldo.",
        );
        return;
    }

    const category = parsed.category_slug
        ? categories.find((c) => c.slug === parsed.category_slug) ?? null
        : null;
    const account = parsed.account_slug
        ? accounts.find((a) => a.slug === parsed.account_slug) ?? null
        : null;

    const type = parsed.type ?? "expense";
    const missingCategory = !category && type === "expense";
    const missingAccount = !account;

    if (missingCategory || missingAccount || parsed.confidence < REVIEW_CONFIDENCE) {
        const draftRepo = new SupabaseDraftTransactionRepository();
        const draftManager = new DraftManager(draftRepo, catRepo, accRepo);
        await draftManager.startDraft(
            text,
            {
                type,
                amount_bs: parsed.amount_bs,
                category_id: category?.id ?? null,
                account_id: account?.id ?? null,
                note: parsed.note ?? text,
                confidence: parsed.confidence,
            },
            from,
            inboundMessageId,
        );
        return;
    }

    const timezone = (await resolver.get("timezone")) ?? "America/La_Paz";
    const budgetRepo = new SupabaseBudgetRepository();
    const txRepo = new SupabaseTransactionRepository();

    const [budget, categoryLimits, currentSpend] = await Promise.all([
        budgetRepo.getOrCreate(),
        budgetRepo.listCategoryBudgets(),
        txRepo.getCurrentSpend(timezone),
    ]);

    const checkResult = BudgetChecker.check({
        budget,
        categoryLimits,
        transaction: {
            amount_bs: parsed.amount_bs,
            type,
            category_id: category?.id,
        },
        currentSpend,
    });

    let status: "pending" | "confirmed" = "confirmed";
    let expiresAt: string | null = null;
    const needsConfidenceReview = parsed.confidence < HIGH_CONFIDENCE;
    if (needsConfidenceReview || checkResult.exceeds) {
        status = "pending";
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 30);
        expiresAt = expires.toISOString();
    }

    const tx = await txRepo.create({
        type,
        amount_bs: parsed.amount_bs,
        category_id: category?.id ?? null,
        account_id: account!.id,
        note: parsed.note ?? text,
        source: "whatsapp",
        inbound_message_id: inboundMessageId,
        from_number: from,
        status,
        bucket: "free",
        exceeded_daily: checkResult.exceeded_daily,
        exceeded_monthly: checkResult.exceeded_monthly,
        exceeded_category: checkResult.exceeded_category,
        confirmation_expires_at: expiresAt,
    });

    if (status === "pending") {
        const warningLines: string[] = [];
        if (needsConfidenceReview) {
            warningLines.push(`Necesito confirmacion (${Math.round(parsed.confidence * 100)}% confianza).`);
        }
        if (checkResult.exceeds) {
            warningLines.push(...checkResult.messages);
        }
        const confirmLines = [
            ...warningLines,
            `Operacion: ${type === "income" ? "Ingreso" : "Gasto"} ${parsed.amount_bs.toFixed(2)} Bs`,
            `Categoria: ${category?.name ?? "Sin categoria"}`,
            `Cuenta: ${account?.name ?? "Sin cuenta"}`,
            "Confirmo esta transaccion? (Responde SI o NO)",
        ];
        await sendWhatsAppMessage(from, confirmLines.join("\n"));
        return;
    }

    try {
        const balanceRepo = new SupabaseAccountBalanceRepository();
        await BalanceLedgerService.applyOnCreate(tx, balanceRepo);
    } catch (e) {
        console.error("[Finance] Failed to adjust account balance:", e);
    }

    const [todaySummary, monthSummary, accountsWithBalances] = await Promise.all([
        txRepo.getSummary("today", timezone),
        txRepo.getSummary("month", timezone),
        new SupabaseAccountBalanceRepository().findAllWithAccounts(),
    ]);

    const matchedAccount = accountsWithBalances.find((a) => a.id === account?.id);
    const accountBalance = matchedAccount?.balance?.balance_bs;
    const replyLines = [
        `Registrado: ${type === "income" ? "Ingreso" : "Gasto"} ${parsed.amount_bs.toFixed(2)} Bs`,
        `Categoria: ${category?.name ?? "Sin categoria"}`,
        `Cuenta: ${account?.name ?? "Sin cuenta"}${accountBalance !== undefined ? ` (${accountBalance.toFixed(2)} Bs)` : ""}`,
        "",
        `Hoy: -${todaySummary.total_expense_bs.toFixed(2)} | +${todaySummary.total_income_bs.toFixed(2)} Bs`,
        `Mes: -${monthSummary.total_expense_bs.toFixed(2)} | +${monthSummary.total_income_bs.toFixed(2)} Bs`,
    ];

    await sendWhatsAppMessage(from, replyLines.join("\n"));
}

async function parseLegacyParser(
    text: string,
    categories: Array<{ id: string; name: string; slug: string }>,
    accounts: Array<{ id: string; name: string; slug: string }>,
    model: string,
    systemPrompt?: string,
) {
    const legacy = await parseAndDecideWithAI(text, categories, accounts, {
        model,
        systemPrompt,
    });
    const legacyCategory = legacy.category_id ? categories.find((c) => c.id === legacy.category_id) ?? null : null;
    const legacyAccount = legacy.account_id ? accounts.find((a) => a.id === legacy.account_id) ?? null : null;

    return {
        type: legacy.type,
        amount_bs: legacy.amount_bs,
        category_slug: legacyCategory?.slug ?? null,
        account_slug: legacyAccount?.slug ?? null,
        note: legacy.note ?? text,
        confidence: 0.9,
        reason: "legacy_parser",
        used_ai: legacy.used_ai,
    };
}
