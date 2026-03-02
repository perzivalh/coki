// API: GET /api/settings/finance + PUT (wizard save)
import { NextRequest, NextResponse } from "next/server";
import { SupabaseIncomeSourceRepository } from "@/infrastructure/db/supabase/income-source.repository";
import { SupabaseFixedBillRepository } from "@/infrastructure/db/supabase/fixed-bill.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { SupabaseBudgetRepository } from "@/infrastructure/db/supabase/budget.repository";
import { SupabaseConfigRepository } from "@/infrastructure/db/supabase/config.repository";
import { ConfigResolver } from "@/application/services/config-resolver";
import { computeWizardSummary } from "@/application/services/finance-wizard";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [incomeSources, fixedBills, accountsWithBalances] = await Promise.all([
            new SupabaseIncomeSourceRepository().findAll(),
            new SupabaseFixedBillRepository().findAll(),
            new SupabaseAccountBalanceRepository().findAllWithAccounts(),
        ]);

        const configRepo = new SupabaseConfigRepository();
        const resolver = new ConfigResolver(configRepo);
        const savingsTarget = Number((await resolver.get("savings_target_bs")) ?? "0");
        const workingDays = Number((await resolver.get("working_days")) ?? "22");

        const summary = computeWizardSummary(
            incomeSources,
            fixedBills,
            savingsTarget,
            workingDays,
        );

        return NextResponse.json({
            summary,
            income_sources: incomeSources,
            fixed_bills: fixedBills,
            accounts_with_balances: accountsWithBalances,
            savings_target_bs: savingsTarget,
            working_days: workingDays,
        });
    } catch {
        return NextResponse.json({ error: "Failed to load finance settings" }, { status: 503 });
    }
}

export async function PUT(req: NextRequest) {
    if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json() as {
            savings_target_bs?: number;
            working_days?: number;
        };

        const configRepo = new SupabaseConfigRepository();

        if (body.savings_target_bs !== undefined) {
            if (body.savings_target_bs < 0) {
                return NextResponse.json({ error: "savings_target_bs cannot be negative" }, { status: 400 });
            }
            await configRepo.set("savings_target_bs", String(body.savings_target_bs));
        }

        if (body.working_days !== undefined) {
            const days = Math.round(body.working_days);
            if (days < 1 || days > 31) {
                return NextResponse.json({ error: "working_days must be between 1 and 31" }, { status: 400 });
            }
            await configRepo.set("working_days", String(days));
        }

        // Re-compute budget limits and persist to budgets table
        const [incomeSources, fixedBills] = await Promise.all([
            new SupabaseIncomeSourceRepository().findAll(),
            new SupabaseFixedBillRepository().findAll(),
        ]);

        const resolver = new ConfigResolver(configRepo);
        const savingsTarget = Number((await resolver.get("savings_target_bs")) ?? "0");
        const workingDays = Number((await resolver.get("working_days")) ?? "22");

        const summary = computeWizardSummary(incomeSources, fixedBills, savingsTarget, workingDays);

        // Sync computed limits to budgets table so BudgetChecker can use them
        const budgetRepo = new SupabaseBudgetRepository();
        await budgetRepo.update({
            monthly_total_bs: summary.free_monthly_bs,
            daily_free_bs: summary.daily_free_bs,
        });

        return NextResponse.json({ ok: true, summary });
    } catch (err: unknown) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
}
