// Infrastructure: SupabaseIncomeSourceRepository
import type { IIncomeSourceRepository } from "@/domain/contracts/finance";
import type { IncomeSource } from "@/domain/entities/income-source";
import { supabaseService } from "./client";

export class SupabaseIncomeSourceRepository implements IIncomeSourceRepository {
    async findAll(): Promise<IncomeSource[]> {
        const { data, error } = await supabaseService
            .from("income_sources")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) throw new Error(`Failed to list income sources: ${error.message}`);
        return (data ?? []) as IncomeSource[];
    }

    async findById(id: string): Promise<IncomeSource | null> {
        const { data, error } = await supabaseService
            .from("income_sources")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (error) return null;
        return data as IncomeSource | null;
    }

    async create(input: { name: string; amount_monthly_bs: number }): Promise<IncomeSource> {
        const { data, error } = await supabaseService
            .from("income_sources")
            .insert({ name: input.name, amount_monthly_bs: input.amount_monthly_bs })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create income source: ${error?.message}`);
        return data as IncomeSource;
    }

    async update(id: string, input: Partial<{ name: string; amount_monthly_bs: number; is_active: boolean }>): Promise<IncomeSource> {
        const { data, error } = await supabaseService
            .from("income_sources")
            .update(input)
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update income source: ${error?.message}`);
        return data as IncomeSource;
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabaseService
            .from("income_sources")
            .delete()
            .eq("id", id);
        if (error) throw new Error(`Failed to delete income source: ${error.message}`);
    }
}
