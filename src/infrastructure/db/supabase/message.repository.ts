// Infrastructure: InboundMessageRepository (Supabase)
import type { IMessageRepository } from "@/application/use-cases/ingest-whatsapp-message";
import type { InboundMessage } from "@/domain/entities";
import { supabaseService } from "./client";

export class SupabaseMessageRepository implements IMessageRepository {
    async save(message: Omit<InboundMessage, "id">): Promise<InboundMessage> {
        const { data, error } = await supabaseService
            .from("inbound_messages")
            .insert(message)
            .select()
            .single();
        if (error || !data) throw new Error("Failed to save inbound message");
        return data as InboundMessage;
    }
}
