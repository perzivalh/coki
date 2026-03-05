import { handleFinanceMessage } from "@/skills/finance/finance.skill";
import { handleConfirmationMessage } from "./handle-confirmation";
import { DraftManager } from "./draft-manager";
import { completeDraftTransaction } from "./draft-finalizer";
import {
    ConversationIntent,
    isBalanceQuery,
    isCancelCommand,
    isHelpCommand,
    looksLikeTransaction,
    normalizeTextEsBo,
} from "./conversation-intent";
import { sendWhatsAppMessage } from "./whatsapp-sender";
import { sendInteractiveButtons, sendInteractiveList } from "./whatsapp-interactive";
import { SupabaseDraftTransactionRepository } from "@/infrastructure/db/supabase/draft-transaction.repository";
import {
    SupabaseAccountRepository,
    SupabaseCategoryRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";

export interface ConversationInput {
    text: string;
    from: string;
    inboundMessageId: string;
}

const ACCOUNT_ALIASES_BY_SLUG: Record<string, string[]> = {
    cash: ["efectivo", "cash", "billete"],
    qr: ["qr", "transferencia", "tarjeta", "banco"],
};

export class ConversationOrchestrator {
    async process(input: ConversationInput): Promise<ConversationIntent> {
        const text = input.text.trim();
        const normalized = normalizeTextEsBo(text);
        if (!normalized) {
            await sendWhatsAppMessage(input.from, "No recibi texto. Enviame un gasto, ingreso o saldo.");
            return "unknown";
        }

        const draftRepo = new SupabaseDraftTransactionRepository();
        const pendingContext = await draftRepo.findByStepContext(input.from);

        if (pendingContext) {
            const intent = await this.handlePendingStep(input, pendingContext.draft.id, pendingContext.step.id, text, normalized);
            if (intent) return intent;
        }

        const handledConfirmation = await handleConfirmationMessage(text, input.from);
        if (handledConfirmation) return "pending_tx_confirmation";

        if (isBalanceQuery(text)) {
            await this.handleBalanceQuery(input.from, normalized);
            return "balance_query";
        }

        if (isHelpCommand(text)) {
            await sendWhatsAppMessage(
                input.from,
                "Comandos: saldo, saldo qr, saldo efectivo, cancelar, nuevo. Tambien podes escribir directo: 35 pasaje, ingreso 300.",
            );
            return "unknown";
        }

        if (isCancelCommand(text)) {
            await sendWhatsAppMessage(input.from, "No hay flujo pendiente. Enviame el nuevo movimiento.");
            return "cancel_flow";
        }

        if (looksLikeTransaction(text)) {
            await handleFinanceMessage(input);
            return "new_transaction";
        }

        await sendWhatsAppMessage(
            input.from,
            "No te entendi. Ejemplos: 37 saltenas en qr, ingreso 300 pago nayan, saldo qr.",
        );
        return "unknown";
    }

    private async handlePendingStep(
        input: ConversationInput,
        draftId: string,
        stepId: string,
        text: string,
        normalized: string,
    ): Promise<ConversationIntent | null> {
        const draftRepo = new SupabaseDraftTransactionRepository();
        const context = await draftRepo.findByStepContext(input.from);
        if (!context || context.draft.id !== draftId || context.step.id !== stepId) return null;

        const catRepo = new SupabaseCategoryRepository();
        const accRepo = new SupabaseAccountRepository();
        const draftManager = new DraftManager(draftRepo, catRepo, accRepo);

        if (isCancelCommand(normalized)) {
            await draftRepo.markAbandoned(context.draft.id);
            await sendWhatsAppMessage(input.from, "Registro pendiente cancelado. Enviame el nuevo movimiento.");
            return "cancel_flow";
        }

        if (normalized === "continuar") {
            await draftManager.resendQuestion(context.draft, context.step, input.from);
            return "pending_step_reply";
        }

        const textReplyResult = await draftManager.handleTextReply(
            context.draft,
            context.step,
            text,
            input.from,
        );

        if (textReplyResult.handled && textReplyResult.result) {
            if ("completed" in textReplyResult.result && textReplyResult.result.completed) {
                await completeDraftTransaction(
                    textReplyResult.result.transactionInput,
                    input.from,
                    input.inboundMessageId,
                );
            }
            return "pending_step_reply";
        }

        if (looksLikeTransaction(text)) {
            await sendInteractiveButtons(
                input.from,
                "Tenes un registro pendiente. Queres continuarlo o crear uno nuevo?",
                [
                    { id: "continue_pending", title: "Continuar" },
                    { id: "new_transaction", title: "Crear nuevo" },
                ],
            );
            return "pending_step_reply";
        }

        if (textReplyResult.message) {
            await sendWhatsAppMessage(input.from, textReplyResult.message);
        }
        await draftManager.resendQuestion(context.draft, context.step, input.from);
        return "pending_step_reply";
    }

    private async handleBalanceQuery(from: string, normalizedText: string): Promise<void> {
        const balanceRepo = new SupabaseAccountBalanceRepository();
        const accounts = await balanceRepo.findAllWithAccounts();
        if (!accounts.length) {
            await sendWhatsAppMessage(from, "No hay cuentas configuradas todavia.");
            return;
        }

        const matched = this.matchAccountFromText(normalizedText, accounts.map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
            balance_bs: a.balance?.balance_bs ?? 0,
        })));

        if (matched) {
            await sendWhatsAppMessage(
                from,
                `Saldo ${matched.name}: ${Number(matched.balance_bs).toFixed(2)} Bs`,
            );
            return;
        }

        const asksSpecific = normalizedText.includes("en ") || normalizedText.includes("de ");
        if (asksSpecific) {
            if (accounts.length <= 3) {
                await sendInteractiveButtons(
                    from,
                    "No ubique la cuenta. Cual queres consultar?",
                    accounts.map((a) => ({ id: `balance_${a.id}`, title: a.name.slice(0, 20) })),
                );
            } else {
                await sendInteractiveList(
                    from,
                    "No ubique la cuenta. Elegi una:",
                    "Ver cuentas",
                    [{
                        title: "Cuentas",
                        rows: accounts.slice(0, 10).map((a) => ({
                            id: `balance_${a.id}`,
                            title: a.name.slice(0, 24),
                        })),
                    }],
                );
            }
            return;
        }

        const total = accounts.reduce((sum, account) => sum + Number(account.balance?.balance_bs ?? 0), 0);
        const maxUpdated = accounts
            .map((a) => a.balance?.updated_at)
            .filter((v): v is string => Boolean(v))
            .sort()
            .at(-1);
        const lines = [
            `Saldo total: ${total.toFixed(2)} Bs`,
            ...accounts.map((a) => `- ${a.name}: ${Number(a.balance?.balance_bs ?? 0).toFixed(2)} Bs`),
        ];
        if (maxUpdated) lines.push(`Actualizado: ${new Date(maxUpdated).toISOString()}`);
        await sendWhatsAppMessage(from, lines.join("\n"));
    }

    private matchAccountFromText(
        normalizedText: string,
        accounts: Array<{ id: string; name: string; slug: string; balance_bs: number }>,
    ): { id: string; name: string; slug: string; balance_bs: number } | null {
        type Match = { account: { id: string; name: string; slug: string; balance_bs: number }; score: number };
        const matches: Match[] = [];

        for (const account of accounts) {
            const tokens = [
                normalizeTextEsBo(account.slug),
                normalizeTextEsBo(account.name),
                ...(ACCOUNT_ALIASES_BY_SLUG[account.slug] ?? []).map((value) => normalizeTextEsBo(value)),
            ].filter(Boolean);

            let score = 0;
            for (const token of tokens) {
                if (normalizedText === token) score = Math.max(score, 1);
                else if (normalizedText.includes(` ${token} `) || normalizedText.startsWith(`${token} `) || normalizedText.endsWith(` ${token}`)) score = Math.max(score, 0.88);
                else if (token.length >= 4 && normalizedText.includes(token)) score = Math.max(score, 0.74);
            }

            if (score > 0) matches.push({ account, score });
        }

        matches.sort((a, b) => b.score - a.score);
        const best = matches[0];
        const second = matches[1];
        if (!best || best.score < 0.74) return null;
        if (second && Math.abs(best.score - second.score) < 0.08) return null;
        return best.account;
    }
}
