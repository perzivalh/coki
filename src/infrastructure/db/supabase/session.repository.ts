// Infrastructure: SessionRepository (Supabase)
import type { ISessionRepository } from "@/domain/contracts";
import type { Session } from "@/domain/entities";
import { supabaseService } from "./client";

export class SupabaseSessionRepository implements ISessionRepository {
    async create(userId: string, token: string, expiresAt: Date): Promise<Session> {
        const { data, error } = await supabaseService
            .from("sessions")
            .insert({
                user_id: userId,
                token,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single();
        if (error || !data) throw new Error("Failed to create session");
        return data as Session;
    }

    async findByToken(token: string): Promise<Session | null> {
        const { data, error } = await supabaseService
            .from("sessions")
            .select("*")
            .eq("token", token)
            .gt("expires_at", new Date().toISOString())
            .single();
        if (error || !data) return null;
        return data as Session;
    }

    async deleteByToken(token: string): Promise<void> {
        await supabaseService.from("sessions").delete().eq("token", token);
    }
}
