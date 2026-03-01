// Infrastructure: Cerebras LLM Wrapper (OpenAI-compatible API)
// Sprint 0: stub wrapper only — no business logic, just the HTTP client.

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface CerebrasResponse {
    id: string;
    choices: Array<{
        message: { role: string; content: string };
        finish_reason: string;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class CerebrasClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly model: string;

    constructor(
        apiKey?: string,
        baseUrl = "https://api.cerebras.ai/v1",
        model = "qwen-3-32b"
    ) {
        this.apiKey = apiKey ?? process.env.CEREBRAS_API_KEY ?? "";
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
        const fullMessages: ChatMessage[] = systemPrompt
            ? [{ role: "system", content: systemPrompt }, ...messages]
            : messages;

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: fullMessages,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Cerebras API error ${response.status}: ${err}`);
        }

        const data = (await response.json()) as CerebrasResponse;
        return data.choices[0]?.message.content ?? "";
    }
}
