// Application Service: Finance Parser
// Strategy 1: Cerebras AI context-aware (receives real categories+accounts, returns direct IDs)
// Strategy 2: Regex fallback (always available)

export interface AIDecision {
    type: "expense" | "income";
    amount_bs: number | null;
    category_id: string | null;  // direct DB id, not a hint
    account_id: string | null;   // direct DB id, only set if explicitly mentioned
    note: string | null;
    used_ai: boolean;
}

// Keywords for regex fallback
const INCOME_KEYWORDS = ["ingreso", "cobré", "cobre", "recibí", "recibi", "cobrado", "sueldo", "pago recibido", "entró", "entro"];
const QR_KEYWORDS = ["qr", "pago qr", "transferencia", "transfer"];

/**
 * Regex-based fallback. Returns null for category_id and account_id so the
 * draft flow will ask interactively.
 * Also exported as parseWithRegex for tests.
 */
export function parseWithRegex(text: string): AIDecision {
    return parseWithRegexFallback(text);
}

function parseWithRegexFallback(text: string): AIDecision {
    const cleaned = text.trim().toLowerCase();
    const isIncome = INCOME_KEYWORDS.some((kw) => cleaned.includes(kw));
    const amountMatch = cleaned.match(/(\d+(?:[.,]\d{1,2})?)/);
    const amount_bs = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;

    let note = cleaned;
    if (amountMatch) note = note.replace(amountMatch[0], "");
    INCOME_KEYWORDS.forEach((kw) => (note = note.replace(kw, "")));
    QR_KEYWORDS.forEach((kw) => (note = note.replace(kw, "")));
    note = note.replace(/\s+/g, " ").trim();

    return {
        type: isIncome ? "income" : "expense",
        amount_bs: amount_bs && amount_bs > 0 ? amount_bs : null,
        category_id: null,  // regex never guesses — let bot ask
        account_id: null,   // regex never guesses — let bot ask
        note: note.length > 0 ? note : text,
        used_ai: false,
    };
}

/**
 * Context-aware AI parser using Cerebras.
 * Receives the real categories and accounts from DB so the AI can return
 * direct IDs instead of vague "hints".
 * Falls back to regex if API key missing or request fails.
 */
export async function parseAndDecideWithAI(
    text: string,
    categories: Array<{ id: string; name: string }>,
    accounts: Array<{ id: string; name: string }>,
): Promise<AIDecision> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
        console.warn("[Finance] CEREBRAS_API_KEY not set — using regex fallback");
        return parseWithRegexFallback(text);
    }

    const catList = categories.length
        ? categories.map((c) => `"${c.name}" (id:${c.id})`).join(", ")
        : "(sin categorías)";
    const accList = accounts.length
        ? accounts.map((a) => `"${a.name}" (id:${a.id})`).join(", ")
        : "(sin cuentas)";

    const prompt = `Eres el asistente de finanzas personales "Coki". Analiza este mensaje de WhatsApp.

Mensaje del usuario: "${text}"

Categorías disponibles: ${catList}
Cuentas disponibles: ${accList}

Responde SOLO con JSON válido, sin ningún texto extra:
{"type":"expense|income","amount_bs":number|null,"category_id":"id|null","account_id":"id|null","note":"string"}

Reglas estrictas:
- type: "income" SOLO si el mensaje habla de cobrar/recibir/sueldo/ingreso. Por defecto "expense".
- amount_bs: el número del monto (sin símbolo de moneda). Si no está claro, null.
- category_id: el id de la categoría más apropiada de la lista. Si no estás seguro, null.
- account_id: el id de la cuenta SOLO si el mensaje la menciona explícitamente (ej: "qr", "transferencia" → cuenta QR; "efectivo", "cash" → cuenta Efectivo). Si no se menciona cuenta, SIEMPRE null.
- note: descripción breve del gasto/ingreso en español.`;

    try {
        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "llama3.1-8b",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`[Cerebras] HTTP ${response.status}: ${errText}`);
            throw new Error(`Cerebras HTTP ${response.status}`);
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        const content = data.choices[0]?.message.content ?? "";
        console.log(`[Cerebras] Raw: ${content}`);

        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) throw new Error("No JSON in response");

        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        // Validate IDs exist in our lists — never trust hallucinated IDs
        const catId = typeof parsed.category_id === "string" && categories.some((c) => c.id === parsed.category_id)
            ? parsed.category_id : null;
        const accId = typeof parsed.account_id === "string" && accounts.some((a) => a.id === parsed.account_id)
            ? parsed.account_id : null;
        const amountRaw = parsed.amount_bs;
        const amount_bs = typeof amountRaw === "number" && amountRaw > 0 ? amountRaw : null;

        console.log(`[Cerebras] Parsed → type:${parsed.type} amount:${amount_bs} cat:${catId} acc:${accId}`);

        return {
            type: parsed.type === "income" ? "income" : "expense",
            amount_bs,
            category_id: catId,
            account_id: accId,
            note: typeof parsed.note === "string" ? parsed.note : text,
            used_ai: true,
        };
    } catch (err) {
        console.error("[Cerebras] Failed, using regex fallback:", err);
        return parseWithRegexFallback(text);
    }
}

// Keep old parseWithAI as thin wrapper for any existing callers
export async function parseWithAI(text: string): Promise<AIDecision & { account_hint: null; category_hint: null; confidence: number; used_ai: boolean; raw: string }> {
    const result = await parseAndDecideWithAI(text, [], []);
    return { ...result, account_hint: null, category_hint: null, confidence: result.used_ai ? 0.9 : 0.7, raw: text };
}
