// Domain Entity: InboundMessage (WhatsApp)
export interface InboundMessage {
    id: string;
    wa_message_id: string;
    from_number: string;
    message_type: string;
    body: string | null;
    raw_payload: unknown;
    received_at: string;
    processed: boolean;
}
