import { describe, it, expect } from "vitest";
import { BudgetChecker } from "./budget-checker";
import type { Budget, CategoryBudgetWithName } from "@/domain/entities/budget";
import type { CurrentSpendSummary } from "@/domain/contracts/finance";

describe("Budget Checker", () => {
    const defaultBudget: Budget = {
        id: "1",
        monthly_total_bs: 1000,
        daily_free_bs: 100,
        updated_at: new Date().toISOString()
    };

    const emptySpend: CurrentSpendSummary = {
        today_bs: 0,
        month_bs: 0,
        month_by_category_bs: {}
    };

    const categories: CategoryBudgetWithName[] = [
        {
            id: "cat1",
            category_id: "food-cat-id",
            category_name: "Food",
            category_icon: "🍔",
            category_slug: "food",
            monthly_limit_bs: 500,
            active: true
        }
    ];

    it("should not exceed limits when within daily free and monthly budget", () => {
        const result = BudgetChecker.check({
            transaction: { amount_bs: 50, type: "expense" },
            budget: defaultBudget,
            categoryLimits: categories,
            currentSpend: emptySpend
        });

        expect(result.exceeds).toBe(false);
        expect(result.exceeded_daily).toBe(false);
        expect(result.exceeded_monthly).toBe(false);
    });

    it("should exceed daily free budget", () => {
        const result = BudgetChecker.check({
            transaction: { amount_bs: 150, type: "expense" },
            budget: defaultBudget,
            categoryLimits: categories,
            currentSpend: { ...emptySpend, today_bs: 0 }
        });

        expect(result.exceeds).toBe(true);
        expect(result.exceeded_daily).toBe(true);
    });

    it("should exceed monthly budget", () => {
        const result = BudgetChecker.check({
            transaction: { amount_bs: 100, type: "expense" }, // Small amount, but month is full
            budget: defaultBudget,
            categoryLimits: categories,
            currentSpend: { ...emptySpend, month_bs: 950 } // 950 + 100 = 1050 > 1000
        });

        expect(result.exceeds).toBe(true);
        expect(result.exceeded_monthly).toBe(true);
    });

    it("should let incomes pass without limits", () => {
        const result = BudgetChecker.check({
            transaction: { amount_bs: 1500, type: "income" }, // Huge amount
            budget: defaultBudget,
            categoryLimits: categories,
            currentSpend: emptySpend
        });

        expect(result.exceeds).toBe(false);
    });

    it("should exceed category limit", () => {
        const result = BudgetChecker.check({
            transaction: { amount_bs: 200, type: "expense", category_id: "food-cat-id" },
            budget: defaultBudget,
            categoryLimits: categories, // 500 limit
            currentSpend: { ...emptySpend, month_by_category_bs: { "food-cat-id": 400 } }
        });

        expect(result.exceeds).toBe(true);
        expect(result.exceeded_category).toBe(true);
        expect(result.exceeded_daily).toBe(true);
    });
});
