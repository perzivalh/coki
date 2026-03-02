// Infrastructure: DailySummary Repository (Supabase)
import type { IDailySummaryRepository } from "@/domain/contracts/finance";
import type { DailySummary } from "@/domain/entities/daily-summary";
import { supabaseService } from "./client";

export class SupabaseDailySummaryRepository implements IDailySummaryRepository {
    async findByDate(date: string): Promise<DailySummary | null> {
        const { data, error } = await supabaseService
            .from("daily_summaries")
            .select("*")
            .eq("date", date)
            .maybeSingle();

        if (error) throw new Error(`Failed to find daily summary: ${error.message}`);
        return data as DailySummary | null;
    }

    async create(date: string, payload: Record<string, unknown>): Promise<DailySummary> {
        const { data, error } = await supabaseService
            .from("daily_summaries")
            .insert({
                date,
                payload_json: payload,
                delivery_status: "pending",
            })
            .select()
            .single();

        if (error || !data) throw new Error(`Failed to create daily summary: ${error?.message}`);
        return data as DailySummary;
    }

    async markSent(id: string): Promise<void> {
        const { error } = await supabaseService
            .from("daily_summaries")
            .update({
                delivery_status: "sent",
                sent_at: new Date().toISOString(),
            })
            .eq("id", id);
        if (error) throw new Error(`Failed to mark sent: ${error.message}`);
    }

    async markFailed(id: string): Promise<void> {
        const { error } = await supabaseService
            .from("daily_summaries")
            .update({
                delivery_status: "failed",
            })
            .eq("id", id);
        if (error) throw new Error(`Failed to mark failed: ${error.message}`);
    }
}
