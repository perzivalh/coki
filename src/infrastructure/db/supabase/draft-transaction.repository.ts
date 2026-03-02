// Infrastructure: SupabaseDraftTransactionRepository
import type { IDraftTransactionRepository } from "@/domain/contracts/finance";
import type { DraftTransaction, BotPendingStep, StepType } from "@/domain/entities/draft-transaction";
import { supabaseService } from "./client";

export class SupabaseDraftTransactionRepository implements IDraftTransactionRepository {
    async create(input: {
        raw_input?: string;
        parsed_json?: Record<string, unknown>;
        missing_fields: string[];
    }): Promise<DraftTransaction> {
        const { data, error } = await supabaseService
            .from("draft_transactions")
            .insert({
                raw_input: input.raw_input ?? null,
                parsed_json: input.parsed_json ?? null,
                missing_fields: input.missing_fields,
                status: "pending",
            })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create draft: ${error?.message}`);
        return data as DraftTransaction;
    }

    async findPendingForUser(): Promise<DraftTransaction | null> {
        const { data, error } = await supabaseService
            .from("draft_transactions")
            .select("*")
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return null;
        return data as DraftTransaction | null;
    }

    async updateParsed(
        id: string,
        parsed_json: Record<string, unknown>,
        missing_fields: string[]
    ): Promise<DraftTransaction> {
        const { data, error } = await supabaseService
            .from("draft_transactions")
            .update({ parsed_json, missing_fields })
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update draft: ${error?.message}`);
        return data as DraftTransaction;
    }

    async markComplete(id: string): Promise<DraftTransaction> {
        const { data, error } = await supabaseService
            .from("draft_transactions")
            .update({ status: "complete" })
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to mark draft complete: ${error?.message}`);
        return data as DraftTransaction;
    }

    async markAbandoned(id: string): Promise<DraftTransaction> {
        const { data, error } = await supabaseService
            .from("draft_transactions")
            .update({ status: "abandoned" })
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to mark draft abandoned: ${error?.message}`);
        return data as DraftTransaction;
    }

    async getPendingStep(draft_id: string): Promise<BotPendingStep | null> {
        const { data, error } = await supabaseService
            .from("bot_pending_steps")
            .select("*")
            .eq("draft_id", draft_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return null;
        return data as BotPendingStep | null;
    }

    async addPendingStep(
        draft_id: string,
        step_type: StepType,
        message_context: { from: string; wa_message_id?: string }
    ): Promise<BotPendingStep> {
        const { data, error } = await supabaseService
            .from("bot_pending_steps")
            .insert({ draft_id, step_type, message_context })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to add pending step: ${error?.message}`);
        return data as BotPendingStep;
    }

    async deletePendingStep(id: string): Promise<void> {
        const { error } = await supabaseService
            .from("bot_pending_steps")
            .delete()
            .eq("id", id);
        if (error) throw new Error(`Failed to delete pending step: ${error.message}`);
    }

    async findByStepContext(from: string): Promise<{ draft: DraftTransaction; step: BotPendingStep } | null> {
        // Find the most recent active bot_pending_step for this phone number
        const { data, error } = await supabaseService
            .from("bot_pending_steps")
            .select("*, draft:draft_transactions!inner(*)")
            .contains("message_context", { from })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;

        const step = {
            id: data.id,
            draft_id: data.draft_id,
            step_type: data.step_type,
            message_context: data.message_context,
            created_at: data.created_at,
        } as BotPendingStep;

        // Verify draft is still pending and not expired
        const draft = data.draft as unknown as DraftTransaction;
        if (draft.status !== "pending") return null;
        if (new Date(draft.expires_at).getTime() < Date.now()) return null;

        return { draft, step };
    }
}
