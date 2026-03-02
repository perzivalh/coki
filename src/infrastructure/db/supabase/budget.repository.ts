// Infrastructure: Budget Repository (Supabase)
import type { IBudgetRepository } from "@/domain/contracts/finance";
import type { Budget, CategoryBudget, CategoryBudgetWithName } from "@/domain/entities/budget";
import { supabaseService } from "./client";

export class SupabaseBudgetRepository implements IBudgetRepository {
    async getOrCreate(): Promise<Budget> {
        const { data, error } = await supabaseService
            .from("budgets")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch budget: ${error.message}`);

        if (!data) {
            // Seed it
            try {
                const res = await supabaseService
                    .from("budgets")
                    .insert({ monthly_total_bs: 0, daily_free_bs: 0 })
                    .select()
                    .single();
                if (res.error) throw new Error(`Failed to create budget: ${res.error.message}`);
                return res.data as Budget; // Changed to return directly
            } catch (err: unknown) {
                console.error("Budget creation failed", err);
                throw new Error(`Failed to create budget: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        return data as Budget;
    }

    async update(input: Partial<{ monthly_total_bs: number; daily_free_bs: number }>): Promise<Budget> {
        const current = await this.getOrCreate();
        const { data, error } = await supabaseService
            .from("budgets")
            .update({
                monthly_total_bs: input.monthly_total_bs ?? current.monthly_total_bs,
                daily_free_bs: input.daily_free_bs ?? current.daily_free_bs,
                updated_at: new Date().toISOString(),
            })
            .eq("id", current.id)
            .select()
            .single();

        if (error || !data) throw new Error(`Failed to update budget: ${error?.message}`);
        return data as Budget;
    }

    async listCategoryBudgets(): Promise<CategoryBudgetWithName[]> {
        const { data, error } = await supabaseService
            .from("category_budgets")
            .select(`
                *,
                category:categories(name, slug, icon)
            `);

        if (error) throw new Error(`Failed to list category budgets: ${error.message}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data || []).map((row: any) => ({
            id: row.id,
            category_id: row.category_id,
            monthly_limit_bs: row.monthly_limit_bs,
            active: row.active,
            category_name: row.category?.name || "Unknown",
            category_slug: row.category?.slug || "unknown",
            category_icon: row.category?.icon,
        }));
    }

    async upsertCategoryBudget(category_id: string, monthly_limit_bs: number, active: boolean = true): Promise<CategoryBudget> {
        const { data, error } = await supabaseService
            .from("category_budgets")
            .upsert({
                category_id,
                monthly_limit_bs,
                active,
            }, { onConflict: "category_id" })
            .select()
            .single();

        if (error || !data) throw new Error(`Failed to upsert category budget: ${error?.message}`);
        return data as CategoryBudget;
    }

    async deleteCategoryBudget(category_id: string): Promise<void> {
        const { error } = await supabaseService
            .from("category_budgets")
            .delete()
            .eq("category_id", category_id);

        if (error) throw new Error(`Failed to delete category budget: ${error.message}`);
    }
}
