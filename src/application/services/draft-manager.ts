import type {
    ICategoryRepository,
    IAccountRepository,
    IDraftTransactionRepository,
    CreateTransactionInput,
} from "@/domain/contracts/finance";
import type { DraftTransaction, BotPendingStep, StepType } from "@/domain/entities/draft-transaction";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";
import { normalizeTextEsBo } from "./conversation-intent";
import { sendInteractiveButtons, sendInteractiveList } from "./whatsapp-interactive";

export type MissingField = "type" | "category" | "account";

export interface ParsedFinanceData {
    type?: "expense" | "income";
    amount_bs?: number;
    category_id?: string | null;
    category_hint?: string | null;
    account_id?: string | null;
    account_hint?: string | null;
    note?: string | null;
    confidence?: number;
}

export interface DraftStartResult {
    draft: DraftTransaction;
    step: BotPendingStep;
}

export interface DraftCompleteResult {
    completed: true;
    transactionInput: CreateTransactionInput;
    draft: DraftTransaction;
}

export type DraftReplyResult = DraftStartResult | DraftCompleteResult;

interface MatchCandidate {
    id: string;
    score: number;
}

const TYPE_SYNONYMS: Record<"expense" | "income", string[]> = {
    expense: ["gasto", "egreso", "pague", "compre", "salio"],
    income: ["ingreso", "cobre", "recibi", "me pagaron", "entrada"],
};

const ACCOUNT_ALIASES_BY_SLUG: Record<string, string[]> = {
    cash: ["efectivo", "cash", "billete"],
    qr: ["qr", "transferencia", "banco", "tarjeta", "transfer"],
};

export class DraftManager {
    constructor(
        private draftRepo: IDraftTransactionRepository,
        private catRepo: ICategoryRepository,
        private accRepo: IAccountRepository,
    ) { }

    async startDraft(
        raw_input: string,
        parsed: ParsedFinanceData,
        from: string,
        inboundMessageId?: string,
    ): Promise<DraftStartResult> {
        const missingFields = this.getMissingFields(parsed);

        const draft = await this.draftRepo.create({
            raw_input,
            from_number: from,
            parsed_json: {
                ...parsed,
                inbound_message_id: inboundMessageId ?? null,
            },
            missing_fields: missingFields,
        });

        const step = await this.askNextQuestion(draft.id, missingFields, from, parsed);
        return { draft, step };
    }

    async handleReply(
        draft: DraftTransaction,
        step: BotPendingStep,
        selectedId: string,
        from: string,
    ): Promise<DraftReplyResult> {
        await this.draftRepo.deletePendingStep(step.id);

        const currentParsed = (draft.parsed_json ?? {}) as ParsedFinanceData;
        const updatedParsed: ParsedFinanceData = { ...currentParsed };

        switch (step.step_type) {
            case "ask_type":
                updatedParsed.type = selectedId as "expense" | "income";
                break;
            case "ask_category":
                updatedParsed.category_id = selectedId === "none" ? null : selectedId;
                break;
            case "ask_account":
                updatedParsed.account_id = selectedId;
                break;
            default:
                break;
        }

        const remaining = this.getMissingFields(updatedParsed);
        await this.draftRepo.updateParsed(draft.id, updatedParsed as Record<string, unknown>, remaining);

        if (remaining.length === 0) {
            const completedDraft = await this.draftRepo.markComplete(draft.id);

            const txInput: CreateTransactionInput = {
                type: updatedParsed.type ?? "expense",
                amount_bs: updatedParsed.amount_bs ?? 0,
                category_id: updatedParsed.category_id ?? null,
                account_id: updatedParsed.account_id ?? "",
                note: updatedParsed.note ?? null,
                source: "whatsapp",
                inbound_message_id: (updatedParsed as Record<string, unknown>).inbound_message_id as string ?? null,
                from_number: from,
                status: "confirmed",
                bucket: "free",
            };

            return { completed: true, transactionInput: txInput, draft: completedDraft };
        }

        const updatedDraft = { ...draft, parsed_json: updatedParsed as Record<string, unknown>, missing_fields: remaining };
        const nextStep = await this.askNextQuestion(draft.id, remaining, from, updatedParsed);
        return { draft: updatedDraft as DraftTransaction, step: nextStep };
    }

    async handleTextReply(
        draft: DraftTransaction,
        step: BotPendingStep,
        text: string,
        from: string,
    ): Promise<{ handled: boolean; result?: DraftReplyResult; message?: string }> {
        const normalized = normalizeTextEsBo(text);
        if (!normalized) return { handled: false, message: "No te entendi. Responde con una opcion." };

        let selectedId: string | null = null;

        if (step.step_type === "ask_type") {
            selectedId = this.matchType(normalized);
            if (!selectedId) {
                return { handled: false, message: "Es gasto o ingreso? Responde: gasto o ingreso." };
            }
        } else if (step.step_type === "ask_account") {
            const accounts = await this.accRepo.findAll();
            selectedId = this.matchAccount(normalized, accounts);
            if (!selectedId) {
                const options = accounts.slice(0, 4).map((a) => a.name).join(", ");
                return { handled: false, message: `No pude ubicar la cuenta. Opciones: ${options}.` };
            }
        } else if (step.step_type === "ask_category") {
            const categories = await this.catRepo.findAll();
            selectedId = this.matchCategory(normalized, categories);
            if (!selectedId) {
                const options = categories.slice(0, 5).map((c) => c.name).join(", ");
                return { handled: false, message: `No pude ubicar la categoria. Opciones: ${options}.` };
            }
        }

        if (!selectedId) {
            return { handled: false, message: "No pude procesar esa respuesta. Probemos de nuevo." };
        }

        const result = await this.handleReply(draft, step, selectedId, from);
        return { handled: true, result };
    }

    async resendQuestion(draft: DraftTransaction, step: BotPendingStep, from: string): Promise<void> {
        const parsed = (draft.parsed_json ?? {}) as ParsedFinanceData;
        await this.sendQuestion(step.step_type, from, parsed);
    }

    getMissingFields(parsed: ParsedFinanceData): MissingField[] {
        const missing: MissingField[] = [];
        if (!parsed.type) missing.push("type");
        if (!parsed.category_id && parsed.type === "expense") missing.push("category");
        if (!parsed.account_id) missing.push("account");
        return missing;
    }

    private async askNextQuestion(
        draftId: string,
        missingFields: MissingField[],
        from: string,
        parsed: ParsedFinanceData,
    ): Promise<BotPendingStep> {
        const nextField = missingFields[0];
        const stepType = this.fieldToStep(nextField);
        await this.sendQuestion(stepType, from, parsed);
        return await this.draftRepo.addPendingStep(draftId, stepType, { from });
    }

    private fieldToStep(field: MissingField): StepType {
        if (field === "type") return "ask_type";
        if (field === "category") return "ask_category";
        return "ask_account";
    }

    private async sendQuestion(stepType: StepType, from: string, parsed: ParsedFinanceData): Promise<void> {
        if (stepType === "ask_type") {
            await sendInteractiveButtons(
                from,
                `Recibi: *${parsed.note ?? "tu mensaje"}*\nEs un gasto o ingreso?`,
                [
                    { id: "expense", title: "Gasto" },
                    { id: "income", title: "Ingreso" },
                ],
            );
            return;
        }

        if (stepType === "ask_category") {
            const categories = await this.catRepo.findAll();
            const body = `A que categoria corresponde?\nBs ${(parsed.amount_bs ?? 0).toFixed(2)}`;

            if (categories.length <= 3) {
                await sendInteractiveButtons(
                    from,
                    body,
                    categories.map((c: Category) => ({ id: c.id, title: c.name.slice(0, 20) })),
                );
            } else {
                const rows = [
                    ...categories.slice(0, 9).map((c: Category) => ({
                        id: c.id,
                        title: c.name.slice(0, 24),
                    })),
                    { id: "none", title: "Sin categoria" },
                ];
                await sendInteractiveList(
                    from,
                    body,
                    "Ver categorias",
                    [{ title: "Categorias", rows }],
                );
            }
            return;
        }

        const accounts = await this.accRepo.findAll();
        const body = `Con que cuenta pagas?\nBs ${(parsed.amount_bs ?? 0).toFixed(2)}`;

        if (accounts.length <= 3) {
            await sendInteractiveButtons(
                from,
                body,
                accounts.map((a: Account) => ({ id: a.id, title: a.name.slice(0, 20) })),
            );
        } else {
            await sendInteractiveList(
                from,
                body,
                "Ver cuentas",
                [{
                    title: "Cuentas",
                    rows: accounts.slice(0, 10).map((a: Account) => ({
                        id: a.id,
                        title: a.name.slice(0, 24),
                    })),
                }],
            );
        }
    }

    private matchType(normalized: string): "expense" | "income" | null {
        for (const [type, words] of Object.entries(TYPE_SYNONYMS) as Array<["expense" | "income", string[]]>) {
            if (words.some((word) => normalized === word || normalized.includes(word))) {
                return type;
            }
        }
        return null;
    }

    private matchCategory(normalized: string, categories: Category[]): string | null {
        return this.matchByNameOrSlug(
            normalized,
            categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
        );
    }

    private matchAccount(normalized: string, accounts: Account[]): string | null {
        return this.matchByNameOrSlug(
            normalized,
            accounts.map((a) => ({ id: a.id, slug: a.slug, name: a.name })),
            ACCOUNT_ALIASES_BY_SLUG,
        );
    }

    private matchByNameOrSlug(
        normalizedReply: string,
        options: Array<{ id: string; slug: string; name: string }>,
        aliasesBySlug: Record<string, string[]> = {},
    ): string | null {
        const candidates: MatchCandidate[] = [];

        for (const option of options) {
            const normalizedSlug = normalizeTextEsBo(option.slug);
            const normalizedName = normalizeTextEsBo(option.name);
            const aliases = (aliasesBySlug[option.slug] ?? []).map((a) => normalizeTextEsBo(a));
            const tokens = [normalizedSlug, normalizedName, ...aliases].filter(Boolean);

            let score = 0;
            for (const token of tokens) {
                if (normalizedReply === token) score = Math.max(score, 1);
                else if (normalizedReply.includes(` ${token} `) || normalizedReply.startsWith(`${token} `) || normalizedReply.endsWith(` ${token}`)) score = Math.max(score, 0.88);
                else if (token.length >= 4 && normalizedReply.includes(token)) score = Math.max(score, 0.74);
            }

            if (score > 0) candidates.push({ id: option.id, score });
        }

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const second = candidates[1];
        if (!best || best.score < 0.74) return null;
        if (second && Math.abs(best.score - second.score) < 0.08) return null;
        return best.id;
    }
}
