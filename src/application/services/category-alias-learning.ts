import type { ICategoryAliasRepository } from "@/domain/contracts/finance";
import { normalizeTextEsBo } from "./conversation-intent";

const RESERVED_TOKENS = new Set([
    "bs",
    "bolivianos",
    "boliviano",
    "en",
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "con",
    "por",
    "para",
    "y",
    "o",
    "a",
    "al",
    "ingreso",
    "gasto",
    "efectivo",
    "cash",
    "qr",
    "transferencia",
    "transfer",
    "banco",
    "tarjeta",
    "saldo",
    "nuevo",
    "cancelar",
]);

function sanitizeAliasText(input: string): string {
    return normalizeTextEsBo(input)
        .replace(/[.,;:!?()[\]{}"']/g, " ")
        .replace(/\b\d+(?:[.,]\d{1,2})?\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function extractCategoryAliasCandidates(input: string): string[] {
    const clean = sanitizeAliasText(input);
    if (!clean) return [];

    const tokens = clean
        .split(" ")
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !RESERVED_TOKENS.has(t));

    if (tokens.length === 0) return [];

    const candidates = new Set<string>();
    for (const token of tokens) {
        candidates.add(token);
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
        const first = tokens[i];
        const second = tokens[i + 1];
        if (first.length >= 3 && second.length >= 3) {
            candidates.add(`${first} ${second}`);
        }
    }

    return Array.from(candidates)
        .filter((value) => value.length >= 3 && value.length <= 32)
        .slice(0, 6);
}

export async function learnCategoryAliasesFromText(params: {
    aliasRepo: ICategoryAliasRepository;
    categoryId: string;
    rawInput?: string | null;
    note?: string | null;
}): Promise<void> {
    const sourceText = [params.note ?? "", params.rawInput ?? ""]
        .filter((v) => v.trim().length > 0)
        .join(" ");

    const candidates = extractCategoryAliasCandidates(sourceText);
    for (const alias of candidates) {
        try {
            await params.aliasRepo.upsertAlias(params.categoryId, alias, "draft_category_selection");
        } catch (err) {
            console.error("[AliasLearning] Failed to upsert alias:", alias, err);
        }
    }
}
