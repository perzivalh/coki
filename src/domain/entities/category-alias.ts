export type CategoryAliasSource = "draft_category_selection" | "manual";

export interface CategoryAlias {
    id: string;
    category_id: string;
    alias_text: string;
    normalized_alias: string;
    source: CategoryAliasSource;
    usage_count: number;
    created_at: string;
    updated_at: string;
    last_seen_at: string;
}
