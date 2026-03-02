// Application Service: Budget Checker
import type { Budget, CategoryBudgetWithName } from "@/domain/entities/budget";

export interface BudgetCheckResult {
    exceeds: boolean;
    exceeded_daily: boolean;
    exceeded_monthly: boolean;
    exceeded_category: boolean;
    messages: string[];
}

export class BudgetChecker {
    /**
     * Checks if a new transaction exceeds any configured limits.
     */
    static check(params: {
        budget: Budget;
        categoryLimits: CategoryBudgetWithName[];
        transaction: {
            amount_bs: number;
            type: "expense" | "income";
            category_id?: string | null;
        };
        currentSpend: {
            today_bs: number;
            month_bs: number;
            month_by_category_bs: Record<string, number>;
        };
    }): BudgetCheckResult {
        const res: BudgetCheckResult = {
            exceeds: false,
            exceeded_daily: false,
            exceeded_monthly: false,
            exceeded_category: false,
            messages: [],
        };

        // Incomes don't exceed budgets
        if (params.transaction.type === "income") {
            return res;
        }

        const amt = params.transaction.amount_bs;

        // 1. Check daily free limit (only if configured > 0)
        if (params.budget.daily_free_bs > 0) {
            const projectedDaily = params.currentSpend.today_bs + amt;
            if (projectedDaily > params.budget.daily_free_bs) {
                res.exceeds = true;
                res.exceeded_daily = true;
                const over = projectedDaily - params.budget.daily_free_bs;
                res.messages.push(`Excedes tu límite diario libre por Bs ${over.toFixed(2)}.`);
            }
        }

        // 2. Check monthly total limit (only if configured > 0)
        if (params.budget.monthly_total_bs > 0) {
            const projectedMonthly = params.currentSpend.month_bs + amt;
            if (projectedMonthly > params.budget.monthly_total_bs) {
                res.exceeds = true;
                res.exceeded_monthly = true;
                const over = projectedMonthly - params.budget.monthly_total_bs;
                res.messages.push(`Excedes tu presupuesto mensual total por Bs ${over.toFixed(2)}.`);
            }
        }

        // 3. Check category monthly limit
        if (params.transaction.category_id) {
            const catLimit = params.categoryLimits.find(
                (c) => c.category_id === params.transaction.category_id && c.active && c.monthly_limit_bs > 0
            );

            if (catLimit) {
                const currentCatSpend = params.currentSpend.month_by_category_bs[params.transaction.category_id] || 0;
                const projectedCat = currentCatSpend + amt;
                if (projectedCat > catLimit.monthly_limit_bs) {
                    res.exceeds = true;
                    res.exceeded_category = true;
                    const over = projectedCat - catLimit.monthly_limit_bs;
                    res.messages.push(
                        `Excedes el límite de la categoría ${catLimit.category_name} por Bs ${over.toFixed(2)}.`
                    );
                }
            }
        }

        return res;
    }
}
