// Application Service: DraftManager — WhatsApp interactive state machine for incomplete transactions
import type { ICategoryRepository, IAccountRepository, IDraftTransactionRepository, CreateTransactionInput } from "@/domain/contracts/finance";
import type { DraftTransaction, BotPendingStep, StepType } from "@/domain/entities/draft-transaction";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";
import { sendInteractiveButtons, sendInteractiveList } from "./whatsapp-interactive";
import { sendWhatsAppMessage } from "./whatsapp-sender";

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

export class DraftManager {
    constructor(
        private draftRepo: IDraftTransactionRepository,
        private catRepo: ICategoryRepository,
        private accRepo: IAccountRepository,
    ) {}

    /**
     * Called when a message is parsed but has missing fields.
     * Creates a draft and sends the first interactive question.
     */
    async startDraft(
        raw_input: string,
        parsed: ParsedFinanceData,
        from: string,
        inboundMessageId?: string,
    ): Promise<DraftStartResult> {
        const missingFields = this.getMissingFields(parsed);

        const draft = await this.draftRepo.create({
            raw_input,
            parsed_json: {
                ...parsed,
                inbound_message_id: inboundMessageId ?? null,
            },
            missing_fields: missingFields,
        });

        const step = await this.askNextQuestion(draft.id, missingFields, from, parsed);
        return { draft, step };
    }

    /**
     * Called when an interactive button/list reply arrives.
     * Applies the answer and either moves to next question or completes the draft.
     */
    async handleReply(
        draft: DraftTransaction,
        step: BotPendingStep,
        selectedId: string,
        from: string,
    ): Promise<DraftReplyResult> {
        // Delete the current pending step
        await this.draftRepo.deletePendingStep(step.id);

        // Apply the selected value
        const currentParsed = (draft.parsed_json ?? {}) as ParsedFinanceData;
        let updatedParsed: ParsedFinanceData = { ...currentParsed };

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
        }

        // Compute remaining missing fields
        const remaining = this.getMissingFields(updatedParsed);
        await this.draftRepo.updateParsed(draft.id, updatedParsed as Record<string, unknown>, remaining);

        if (remaining.length === 0) {
            // Draft complete — build transaction input
            const completedDraft = await this.draftRepo.markComplete(draft.id);

            await sendWhatsAppMessage(
                from,
                `✅ Registrado: ${updatedParsed.type === "income" ? "💰" : "💸"} ${(updatedParsed.amount_bs ?? 0).toFixed(2)} Bs`
            );

            const txInput: CreateTransactionInput = {
                type: updatedParsed.type ?? "expense",
                amount_bs: updatedParsed.amount_bs ?? 0,
                category_id: updatedParsed.category_id ?? null,
                account_id: updatedParsed.account_id ?? "",
                note: updatedParsed.note ?? null,
                source: "whatsapp",
                inbound_message_id: (updatedParsed as Record<string, unknown>).inbound_message_id as string ?? null,
                status: "confirmed",
                bucket: "free",
            };

            return { completed: true, transactionInput: txInput, draft: completedDraft };
        }

        // More questions needed
        const updatedDraft = { ...draft, parsed_json: updatedParsed as Record<string, unknown>, missing_fields: remaining };
        const nextStep = await this.askNextQuestion(draft.id, remaining, from, updatedParsed);
        return { draft: updatedDraft as DraftTransaction, step: nextStep };
    }

    /**
     * Determines which fields are still missing from the parsed data.
     */
    getMissingFields(parsed: ParsedFinanceData): MissingField[] {
        const missing: MissingField[] = [];
        if (!parsed.type) missing.push("type");
        if (!parsed.category_id && parsed.type === "expense") missing.push("category");
        if (!parsed.account_id) missing.push("account");
        return missing;
    }

    /**
     * Asks the next question via WhatsApp interactive message.
     */
    private async askNextQuestion(
        draftId: string,
        missingFields: MissingField[],
        from: string,
        parsed: ParsedFinanceData,
    ): Promise<BotPendingStep> {
        const nextField = missingFields[0];
        let stepType: StepType;

        if (nextField === "type") {
            stepType = "ask_type";
            await sendInteractiveButtons(
                from,
                `Recibí: *${parsed.note ?? "tu mensaje"}*\n¿Es un gasto o un ingreso?`,
                [
                    { id: "expense", title: "💸 Gasto" },
                    { id: "income", title: "💰 Ingreso" },
                ],
            );
        } else if (nextField === "category") {
            stepType = "ask_category";
            const categories = await this.catRepo.findAll();
            const body = `¿A qué categoría corresponde?\n💵 ${(parsed.amount_bs ?? 0).toFixed(0)} Bs`;

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
                    { id: "none", title: "Sin categoría" },
                ];
                await sendInteractiveList(
                    from,
                    body,
                    "Ver categorías",
                    [{ title: "Categorías", rows }],
                );
            }
        } else {
            // account
            stepType = "ask_account";
            const accounts = await this.accRepo.findAll();
            const body = `¿Con qué cuenta pagás?\n💵 ${(parsed.amount_bs ?? 0).toFixed(0)} Bs`;

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

        return await this.draftRepo.addPendingStep(draftId, stepType, { from });
    }
}
