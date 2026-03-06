import { extractAmountCandidate, normalizeTextEsBo } from "./conversation-intent";

export interface ParseReferenceItem {
    id: string;
    name: string;
    slug: string;
}

export interface ParsedFinanceV2 {
    type: "expense" | "income" | null;
    amount_bs: number | null;
    category_slug: string | null;
    account_slug: string | null;
    note: string | null;
    confidence: number;
    reason: string;
    used_ai: boolean;
}

export interface ParseFinanceOptions {
    model?: string;
    systemPrompt?: string;
    categoryAliasesBySlug?: Record<string, string[]>;
}

export interface AIDecision {
    type: "expense" | "income";
    amount_bs: number | null;
    category_id: string | null;
    account_id: string | null;
    note: string | null;
    used_ai: boolean;
}

const INCOME_KEYWORDS = [
    "ingreso",
    "cobre",
    "cobrado",
    "recibi",
    "sueldo",
    "me pagaron",
    "pago recibido",
    "entro",
];

const ACCOUNT_ALIASES: Record<string, string[]> = {
    cash: ["efectivo", "cash", "billete"],
    qr: ["qr", "transferencia", "transfer", "banco", "tarjeta"],
};

const DEFAULT_CATEGORY_ALIASES: Record<string, string[]> = {
    comida: [
        "almuerzo",
        "desayuno",
        "cena",
        "merienda",
        "snack",
        "gaseosa",
        "refresco",
        "saltena",
        "saltenas",
        "chupete",
        "dulce",
        "cafe",
        "pizza",
        "hamburguesa",
        "helado",
        "pan",
        "pollo",
        "jugo",
    ],
    transporte: [
        "pasaje",
        "micro",
        "trufi",
        "taxi",
        "uber",
        "indrive",
        "gasolina",
        "nafta",
        "combustible",
        "parqueo",
        "peaje",
    ],
    salud: [
        "farmacia",
        "medicina",
        "medicamento",
        "doctor",
        "consulta",
        "dentista",
        "vitamina",
        "suplemento",
        "proteina",
        "creatina",
        "preentreno",
        "ibuprofeno",
        "paracetamol",
    ],
    compras: [
        "ropa",
        "polera",
        "pantalon",
        "zapato",
        "papel",
        "papel higienico",
        "cuaderno",
        "lapiz",
        "jabon",
        "shampoo",
        "detergente",
        "mercado",
    ],
    ocio: [
        "chela",
        "cerveza",
        "trago",
        "tragos",
        "cine",
        "juego",
        "steam",
        "spotify",
        "netflix",
        "salida",
    ],
    servicios: [
        "luz",
        "agua",
        "internet",
        "wifi",
        "telefono",
        "celular",
        "recarga",
        "gas",
        "alquiler",
        "factura",
        "suscripcion",
    ],
};

function clampConfidence(confidence: number): number {
    if (!Number.isFinite(confidence)) return 0;
    return Math.max(0, Math.min(1, confidence));
}

function guessType(normalized: string): "expense" | "income" | null {
    if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "income";
    if (normalized.length > 0) return "expense";
    return null;
}

function stripForNote(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function buildCategoryAliases(
    categories: ParseReferenceItem[],
    learnedBySlug: Record<string, string[]> = {},
): Record<string, string[]> {
    const aliases: Record<string, string[]> = {};
    for (const category of categories) {
        const defaults = DEFAULT_CATEGORY_ALIASES[category.slug] ?? [];
        const learned = learnedBySlug[category.slug] ?? [];
        const merged = [...defaults, ...learned].map((value) => normalizeTextEsBo(value));
        const deduped = Array.from(new Set(merged)).filter((value) => value.length > 0);
        if (deduped.length > 0) aliases[category.slug] = deduped;
    }
    return aliases;
}

function resolveSlugMatch(
    text: string,
    items: ParseReferenceItem[],
    aliases?: Record<string, string[]>,
): { slug: string; score: number } | null {
    const normalized = normalizeTextEsBo(text);
    let best: { slug: string; score: number } | null = null;

    for (const item of items) {
        const itemName = normalizeTextEsBo(item.name);
        const itemSlug = normalizeTextEsBo(item.slug);
        const tokens = new Set<string>([itemName, itemSlug]);
        for (const alias of aliases?.[item.slug] ?? []) tokens.add(normalizeTextEsBo(alias));

        let score = 0;
        for (const token of tokens) {
            if (!token) continue;
            if (normalized === token) score = Math.max(score, 1);
            else if (normalized.includes(` ${token} `) || normalized.startsWith(`${token} `) || normalized.endsWith(` ${token}`)) score = Math.max(score, 0.85);
            else if (token.length >= 4 && normalized.includes(token)) score = Math.max(score, 0.7);
        }

        if (!best || score > best.score) {
            best = { slug: item.slug, score };
        }
    }

    if (!best || best.score < 0.7) return null;
    return best;
}

function slugFromTextMatch(text: string, items: ParseReferenceItem[], aliases?: Record<string, string[]>): string | null {
    return resolveSlugMatch(text, items, aliases)?.slug ?? null;
}

function applyCategoryHeuristic(
    current: ParsedFinanceV2,
    normalizedText: string,
    categories: ParseReferenceItem[],
    learnedAliasesBySlug: Record<string, string[]> = {},
): ParsedFinanceV2 {
    const categoryAliases = buildCategoryAliases(categories, learnedAliasesBySlug);
    const heuristic = resolveSlugMatch(normalizedText, categories, categoryAliases);
    if (!heuristic) return current;

    if (!current.category_slug) {
        return {
            ...current,
            category_slug: heuristic.slug,
            confidence: clampConfidence(Math.max(current.confidence, heuristic.score >= 0.95 ? 0.84 : 0.74)),
            reason: `${current.reason}+category_alias`,
        };
    }

    if (current.category_slug !== heuristic.slug && current.confidence < 0.75 && heuristic.score >= 0.88) {
        return {
            ...current,
            category_slug: heuristic.slug,
            confidence: clampConfidence(Math.max(current.confidence, 0.78)),
            reason: `${current.reason}+category_alias_override`,
        };
    }

    return current;
}

function parseWithRegexV2(
    text: string,
    categories: ParseReferenceItem[],
    accounts: ParseReferenceItem[],
    learnedAliasesBySlug: Record<string, string[]> = {},
): ParsedFinanceV2 {
    const normalized = normalizeTextEsBo(text);
    const amount_bs = extractAmountCandidate(normalized);
    const type = guessType(normalized);
    const account_slug = slugFromTextMatch(normalized, accounts, ACCOUNT_ALIASES);
    const categoryAliases = buildCategoryAliases(categories, learnedAliasesBySlug);
    const category_slug = slugFromTextMatch(normalized, categories, categoryAliases);

    let confidence = 0.35;
    if (type) confidence += 0.15;
    if (amount_bs) confidence += 0.3;
    if (account_slug) confidence += 0.1;
    if (category_slug) confidence += 0.1;

    return applyCategoryHeuristic({
        type,
        amount_bs,
        category_slug,
        account_slug,
        note: stripForNote(text),
        confidence: clampConfidence(confidence),
        reason: "regex_fallback",
        used_ai: false,
    }, normalized, categories, learnedAliasesBySlug);
}

function extractJsonObject(content: string): Record<string, unknown> | null {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced?.[1] ?? content;
    const direct = raw.trim();

    try {
        return JSON.parse(direct) as Record<string, unknown>;
    } catch {
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null;
        const slice = raw.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(slice) as Record<string, unknown>;
        } catch {
            return null;
        }
    }
}

export async function parseFinanceMessageV2(
    text: string,
    categories: ParseReferenceItem[],
    accounts: ParseReferenceItem[],
    options: ParseFinanceOptions = {},
): Promise<ParsedFinanceV2> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) return parseWithRegexV2(text, categories, accounts, options.categoryAliasesBySlug);

    const model = options.model ?? process.env.CEREBRAS_MODEL ?? "qwen-3-32b";
    const normalized = normalizeTextEsBo(text);
    const categoryAliases = buildCategoryAliases(categories, options.categoryAliasesBySlug);
    const catList = categories.map((c) => {
        const hints = categoryAliases[c.slug]?.slice(0, 6).join(", ");
        return hints ? `${c.slug}: ${c.name} (ej: ${hints})` : `${c.slug}: ${c.name}`;
    }).join(", ") || "sin categorias";
    const accList = accounts.map((a) => `${a.slug}: ${a.name}`).join(", ") || "sin cuentas";

    const systemPrompt = options.systemPrompt ?? [
        "Eres un parser de finanzas de WhatsApp.",
        "Responde SOLO JSON valido.",
        "Nunca inventes slugs.",
        "Si no estas seguro, usa null y baja confidence.",
    ].join(" ");

    const userPrompt = [
        `Mensaje: "${text}"`,
        `Mensaje normalizado: "${normalized}"`,
        `Categorias disponibles: ${catList}`,
        `Cuentas disponibles: ${accList}`,
        "JSON estricto:",
        '{"type":"expense|income|null","amount_bs":number|null,"category_slug":"string|null","account_slug":"string|null","note":"string","confidence":number,"reason":"string"}',
        "Reglas:",
        "- confidence entre 0 y 1",
        "- account_slug solo si se menciona cuenta",
        "- type income solo si hay senal de ingreso/cobro",
        "- category_slug debe intentar mapear palabras coloquiales al mejor slug disponible",
        "- si el mensaje menciona un producto o consumo, prefiere la categoria mas cercana antes que null",
    ].join("\n");

    try {
        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                max_tokens: 260,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`[Cerebras parser] HTTP ${response.status}: ${errText}`);
            return parseWithRegexV2(text, categories, accounts, options.categoryAliasesBySlug);
        }

        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "";
        const parsed = extractJsonObject(content);
        if (!parsed) return parseWithRegexV2(text, categories, accounts, options.categoryAliasesBySlug);

        const aiTypeRaw = parsed.type;
        const type = aiTypeRaw === "income" || aiTypeRaw === "expense" ? aiTypeRaw : null;
        const amountRaw = parsed.amount_bs;
        const amount_bs = typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw > 0
            ? Number(amountRaw)
            : null;

        const categorySlugRaw = typeof parsed.category_slug === "string" ? normalizeTextEsBo(parsed.category_slug) : null;
        const accountSlugRaw = typeof parsed.account_slug === "string" ? normalizeTextEsBo(parsed.account_slug) : null;
        const validCategorySlug = categorySlugRaw && categories.some((c) => normalizeTextEsBo(c.slug) === categorySlugRaw)
            ? categories.find((c) => normalizeTextEsBo(c.slug) === categorySlugRaw)?.slug ?? null
            : null;
        const validAccountSlug = accountSlugRaw && accounts.some((a) => normalizeTextEsBo(a.slug) === accountSlugRaw)
            ? accounts.find((a) => normalizeTextEsBo(a.slug) === accountSlugRaw)?.slug ?? null
            : null;

        const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : 0.45;
        const note = typeof parsed.note === "string" && parsed.note.trim().length > 0
            ? parsed.note.trim()
            : stripForNote(text);
        const reason = typeof parsed.reason === "string" ? parsed.reason : "ai_json";

        return applyCategoryHeuristic({
            type,
            amount_bs,
            category_slug: validCategorySlug,
            account_slug: validAccountSlug,
            note,
            confidence: clampConfidence(confidenceRaw),
            reason,
            used_ai: true,
        }, normalized, categories, options.categoryAliasesBySlug);
    } catch (err) {
        console.error("[Cerebras parser] Failed, using regex fallback:", err);
        return parseWithRegexV2(text, categories, accounts, options.categoryAliasesBySlug);
    }
}

export function parseWithRegex(text: string): AIDecision {
    const parsed = parseWithRegexV2(text, [], []);
    return {
        type: parsed.type === "income" ? "income" : "expense",
        amount_bs: parsed.amount_bs,
        category_id: null,
        account_id: null,
        note: parsed.note,
        used_ai: false,
    };
}

export async function parseAndDecideWithAI(
    text: string,
    categories: Array<{ id: string; name: string; slug?: string }>,
    accounts: Array<{ id: string; name: string; slug?: string }>,
    options: ParseFinanceOptions = {},
): Promise<AIDecision> {
    const catRefs: ParseReferenceItem[] = categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug ?? normalizeTextEsBo(c.name).replace(/\s+/g, "-"),
    }));
    const accRefs: ParseReferenceItem[] = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? normalizeTextEsBo(a.name).replace(/\s+/g, "-"),
    }));

    const parsed = await parseFinanceMessageV2(text, catRefs, accRefs, options);
    const category = parsed.category_slug ? catRefs.find((c) => c.slug === parsed.category_slug) : null;
    const account = parsed.account_slug ? accRefs.find((a) => a.slug === parsed.account_slug) : null;

    return {
        type: parsed.type === "income" ? "income" : "expense",
        amount_bs: parsed.amount_bs,
        category_id: category?.id ?? null,
        account_id: account?.id ?? null,
        note: parsed.note ?? text,
        used_ai: parsed.used_ai,
    };
}

export async function parseWithAI(text: string): Promise<AIDecision & {
    account_hint: null;
    category_hint: null;
    confidence: number;
    used_ai: boolean;
    raw: string;
}> {
    const parsed = await parseFinanceMessageV2(text, [], []);
    return {
        type: parsed.type === "income" ? "income" : "expense",
        amount_bs: parsed.amount_bs,
        category_id: null,
        account_id: null,
        note: parsed.note,
        account_hint: null,
        category_hint: null,
        confidence: parsed.confidence,
        used_ai: parsed.used_ai,
        raw: text,
    };
}
