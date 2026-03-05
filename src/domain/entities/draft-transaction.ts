// Domain Entity: DraftTransaction + BotPendingStep
export type DraftStatus = "pending" | "complete" | "abandoned";
export type StepType = "ask_type" | "ask_category" | "ask_account" | "confirm";

export interface DraftTransaction {
    id: string;
    raw_input: string | null;
    from_number: string | null;
    parsed_json: Record<string, unknown> | null;
    missing_fields: string[];
    status: DraftStatus;
    expires_at: string;
    created_at: string;
}

export interface BotPendingStep {
    id: string;
    draft_id: string;
    step_type: StepType;
    message_context: {
        from: string;
        wa_message_id?: string;
    } | null;
    created_at: string;
}
