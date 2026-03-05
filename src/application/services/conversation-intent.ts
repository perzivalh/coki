export type ConversationIntent =
    | "new_transaction"
    | "pending_step_reply"
    | "pending_tx_confirmation"
    | "balance_query"
    | "cancel_flow"
    | "unknown";

const YES_WORDS = new Set(["si", "s", "ok", "dale", "confirmo", "confirmar", "deuna", "de una"]);
const NO_WORDS = new Set(["no", "nop", "cancelar", "cancela", "anular", "anula", "descartar"]);
const CANCEL_WORDS = new Set(["cancelar", "cancela", "nuevo", "reiniciar", "reset"]);

const HELP_TOKENS = ["ayuda", "help", "comandos"];
const BALANCE_TOKENS = [
    "saldo",
    "balance",
    "cuanto me queda",
    "cuanto queda",
    "cuanto tengo",
    "me queda",
    "disponible",
];
const TX_TOKENS = [
    "ingreso",
    "gasto",
    "compre",
    "pague",
    "cobre",
    "cobro",
    "recibi",
    "recibo",
];

export function normalizeTextEsBo(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s.,+-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function isPositiveConfirmation(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    return YES_WORDS.has(normalized);
}

export function isNegativeConfirmation(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    return NO_WORDS.has(normalized);
}

export function isCancelCommand(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    return CANCEL_WORDS.has(normalized);
}

export function isHelpCommand(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    return HELP_TOKENS.some((token) => normalized.includes(token));
}

export function isBalanceQuery(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    return BALANCE_TOKENS.some((token) => normalized.includes(token));
}

export function extractAmountCandidate(text: string): number | null {
    const normalized = normalizeTextEsBo(text);
    const amountMatch = normalized.match(/(?:\bbs\b\s*)?([+-]?\d+(?:[.,]\d{1,2})?)\s*(?:\bbs\b)?/);
    if (!amountMatch) return null;
    const amount = Number(amountMatch[1].replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
}

export function looksLikeTransaction(text: string): boolean {
    const normalized = normalizeTextEsBo(text);
    if (extractAmountCandidate(normalized) !== null) return true;
    return TX_TOKENS.some((token) => normalized.includes(token));
}
