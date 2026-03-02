import { describe, test, expect } from "vitest";
// Unit tests: FinanceWizard — computeWizardSummary
import { computeWizardSummary } from "./finance-wizard";
import type { IncomeSource } from "@/domain/entities/income-source";
import type { FixedBill } from "@/domain/entities/fixed-bill";

function makeIncome(amount: number, active = true): IncomeSource {
    return { id: "i1", name: "Salario", amount_monthly_bs: amount, is_active: active, created_at: "" };
}

function makeBill(amount: number, active = true): FixedBill {
    return { id: "b1", name: "Alquiler", amount_bs: amount, due_day: 1, account_id: null, autopay: false, is_active: active, created_at: "" };
}

describe("computeWizardSummary", () => {
    test("basic calculation: income - fixed - savings = free_monthly", () => {
        const summary = computeWizardSummary(
            [makeIncome(5000)],
            [makeBill(2000)],
            500,
            22,
        );
        expect(summary.total_income_monthly_bs).toBe(5000);
        expect(summary.total_fixed_bills_monthly_bs).toBe(2000);
        expect(summary.savings_bs).toBe(500);
        expect(summary.free_monthly_bs).toBe(2500);
        expect(summary.daily_free_bs).toBeCloseTo(2500 / 22, 1);
    });

    test("daily free limit uses working days correctly", () => {
        const summary = computeWizardSummary([makeIncome(3000)], [], 0, 30);
        expect(summary.daily_free_bs).toBeCloseTo(100, 1);
        expect(summary.working_days).toBe(30);
    });

    test("has_risk when fixed > income", () => {
        const summary = computeWizardSummary([makeIncome(1000)], [makeBill(2000)], 0, 22);
        expect(summary.has_risk).toBe(true);
        expect(summary.free_monthly_bs).toBe(0); // clamped at 0
    });

    test("is_incomplete when no income sources", () => {
        const summary = computeWizardSummary([], [], 0, 22);
        expect(summary.is_incomplete).toBe(true);
        expect(summary.free_monthly_bs).toBe(0);
        expect(summary.daily_free_bs).toBe(0);
    });

    test("inactive sources and bills are excluded from totals", () => {
        const summary = computeWizardSummary(
            [makeIncome(5000, true), makeIncome(1000, false)],
            [makeBill(1000, true), makeBill(500, false)],
            0,
            22,
        );
        expect(summary.total_income_monthly_bs).toBe(5000);
        expect(summary.total_fixed_bills_monthly_bs).toBe(1000);
        expect(summary.free_monthly_bs).toBe(4000);
    });

    test("savings clamped to 0 if negative passed", () => {
        const summary = computeWizardSummary([makeIncome(3000)], [], -100, 22);
        expect(summary.savings_bs).toBe(0);
        expect(summary.free_monthly_bs).toBe(3000);
    });

    test("working_days clamped to minimum 1", () => {
        const summary = computeWizardSummary([makeIncome(3000)], [], 0, 0);
        expect(summary.working_days).toBe(1);
        expect(summary.daily_free_bs).toBe(3000);
    });

    test("multiple income sources are summed", () => {
        const sources = [makeIncome(3000), { ...makeIncome(2000), id: "i2", name: "Freelance" }];
        const summary = computeWizardSummary(sources, [], 0, 22);
        expect(summary.total_income_monthly_bs).toBe(5000);
    });

    test("free_monthly_bs never goes below 0 even if fijos > income", () => {
        const summary = computeWizardSummary([makeIncome(100)], [makeBill(500)], 200, 22);
        expect(summary.free_monthly_bs).toBeGreaterThanOrEqual(0);
        expect(summary.daily_free_bs).toBeGreaterThanOrEqual(0);
    });
});
