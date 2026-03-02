// Application Service: FinanceWizard — computes budget limits from income/fixed/savings
import type { IncomeSource } from "@/domain/entities/income-source";
import type { FixedBill } from "@/domain/entities/fixed-bill";

export interface FinanceWizardSummary {
    total_income_monthly_bs: number;
    total_fixed_bills_monthly_bs: number;
    savings_bs: number;
    free_monthly_bs: number;
    daily_free_bs: number;
    working_days: number;
    has_risk: boolean;  // fixed > income
    is_incomplete: boolean; // total_income = 0
}

export function computeWizardSummary(
    incomeSources: IncomeSource[],
    fixedBills: FixedBill[],
    savingsTarget: number,
    workingDays: number,
): FinanceWizardSummary {
    const activeIncomeSources = incomeSources.filter((s) => s.is_active);
    const activeFixedBills = fixedBills.filter((b) => b.is_active);

    const total_income_monthly_bs = activeIncomeSources.reduce(
        (sum, s) => sum + Number(s.amount_monthly_bs),
        0,
    );

    const total_fixed_bills_monthly_bs = activeFixedBills.reduce(
        (sum, b) => sum + Number(b.amount_bs),
        0,
    );

    const savings = Math.max(0, Number(savingsTarget));
    const days = Math.max(1, Math.round(Number(workingDays)));

    const free_monthly_bs = Math.max(
        0,
        total_income_monthly_bs - total_fixed_bills_monthly_bs - savings,
    );

    const daily_free_bs = Math.round((free_monthly_bs / days) * 100) / 100;

    return {
        total_income_monthly_bs: Math.round(total_income_monthly_bs * 100) / 100,
        total_fixed_bills_monthly_bs: Math.round(total_fixed_bills_monthly_bs * 100) / 100,
        savings_bs: Math.round(savings * 100) / 100,
        free_monthly_bs: Math.round(free_monthly_bs * 100) / 100,
        daily_free_bs,
        working_days: days,
        has_risk: total_fixed_bills_monthly_bs > total_income_monthly_bs,
        is_incomplete: total_income_monthly_bs === 0,
    };
}
