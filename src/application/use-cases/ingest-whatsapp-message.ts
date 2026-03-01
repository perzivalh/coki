// Application Use-Case: Ingest WhatsApp Message (stub)
// Saves raw payload to DB without processing business logic.
import type { InboundMessage } from "@/domain/entities";

export interface IMessageRepository {
    save(message: Omit<InboundMessage, "id">): Promise<InboundMessage>;
}

export interface WhatsAppPayload {
    entry?: Array<{
        changes?: Array<{
            value?: {
                messages?: Array<{
                    id: string;
                    from: string;
                    type: string;
                    text?: { body: string };
                    timestamp: string;
                }>;
            };
        }>;
    }>;
}

export async function ingestWhatsAppMessage(
    payload: WhatsAppPayload,
    messageRepo: IMessageRepository
): Promise<{ count: number }> {
    const messages =
        payload.entry?.flatMap(
            (e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []
        ) ?? [];

    for (const msg of messages) {
        await messageRepo.save({
            wa_message_id: msg.id,
            from_number: msg.from,
            message_type: msg.type,
            body: msg.text?.body ?? null,
            raw_payload: msg,
            received_at: new Date(Number(msg.timestamp) * 1000).toISOString(),
            processed: false,
        });
    }

    return { count: messages.length };
}
