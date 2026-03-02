// Domain Entity: Budget
export interface Budget {
    id: string;
    monthly_total_bs: number;
    daily_free_bs: number;
    updated_at: string;
}

export interface CategoryBudget {
    id: string;
    category_id: string;
    monthly_limit_bs: number;
    active: boolean;
}

export interface CategoryBudgetWithName extends CategoryBudget {
    category_name: string;
    category_slug: string;
    category_icon: string | null;
}
