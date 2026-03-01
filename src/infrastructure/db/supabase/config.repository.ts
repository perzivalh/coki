// Infrastructure: ConfigRepository (Supabase)
import type { IConfigRepository } from "@/application/services/config-resolver";
import type { Config } from "@/domain/entities";
import { supabaseService } from "./client";

export class SupabaseConfigRepository implements IConfigRepository {
    async getAll(): Promise<Config[]> {
        const { data, error } = await supabaseService.from("settings").select("*");
        if (error) throw new Error("Failed to fetch settings");
        return (data ?? []) as Config[];
    }

    async get(key: string): Promise<Config | null> {
        const { data, error } = await supabaseService
            .from("settings")
            .select("*")
            .eq("key", key)
            .single();
        if (error || !data) return null;
        return data as Config;
    }

    async set(key: string, value: string, description?: string): Promise<Config> {
        const { data, error } = await supabaseService
            .from("settings")
            .upsert({ key, value, description, updated_at: new Date().toISOString() })
            .select()
            .single();
        if (error || !data) throw new Error("Failed to upsert setting");
        return data as Config;
    }
}
