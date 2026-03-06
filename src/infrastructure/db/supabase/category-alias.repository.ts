import type { ICategoryAliasRepository } from "@/domain/contracts/finance";
import type { CategoryAlias, CategoryAliasSource } from "@/domain/entities/category-alias";
import { normalizeTextEsBo } from "@/application/services/conversation-intent";
import { supabaseService } from "./client";

export class SupabaseCategoryAliasRepository implements ICategoryAliasRepository {
    async upsertAlias(
        category_id: string,
        alias_text: string,
        source: CategoryAliasSource = "draft_category_selection",
    ): Promise<CategoryAlias> {
        const normalized_alias = normalizeTextEsBo(alias_text);
        const now = new Date().toISOString();

        const { data: existing, error: findError } = await supabaseService
            .from("category_aliases")
            .select("*")
            .eq("category_id", category_id)
            .eq("normalized_alias", normalized_alias)
            .maybeSingle();

        if (findError) throw new Error(`Failed to find category alias: ${findError.message}`);

        if (existing) {
            const { data, error } = await supabaseService
                .from("category_aliases")
                .update({
                    alias_text,
                    source,
                    usage_count: Number(existing.usage_count ?? 0) + 1,
                    updated_at: now,
                    last_seen_at: now,
                })
                .eq("id", existing.id)
                .select()
                .single();
            if (error || !data) throw new Error(`Failed to update category alias: ${error?.message}`);
            return data as CategoryAlias;
        }

        const { data, error } = await supabaseService
            .from("category_aliases")
            .insert({
                category_id,
                alias_text,
                normalized_alias,
                source,
                usage_count: 1,
                updated_at: now,
                last_seen_at: now,
            })
            .select()
            .single();

        if (error || !data) throw new Error(`Failed to create category alias: ${error?.message}`);
        return data as CategoryAlias;
    }

    async listByCategoryIds(categoryIds: string[]): Promise<CategoryAlias[]> {
        if (categoryIds.length === 0) return [];
        const { data, error } = await supabaseService
            .from("category_aliases")
            .select("*")
            .in("category_id", categoryIds)
            .order("usage_count", { ascending: false })
            .order("updated_at", { ascending: false });

        if (error) throw new Error(`Failed to list category aliases: ${error.message}`);
        return (data ?? []) as CategoryAlias[];
    }
}
