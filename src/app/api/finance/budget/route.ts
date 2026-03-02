import { NextRequest, NextResponse } from "next/server";
import { SupabaseBudgetRepository } from "@/infrastructure/db/supabase/budget.repository";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    const token = req.cookies.get("coki_session")?.value;
    return !!token;
}

// GET /api/finance/budget → returns { budget, categoryLimits }
export async function GET(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const repo = new SupabaseBudgetRepository();
        const [budget, categoryLimits] = await Promise.all([
            repo.getOrCreate(),
            repo.listCategoryBudgets(),
        ]);
        return NextResponse.json({ budget, categoryLimits });
    } catch {
        return NextResponse.json({ error: "Failed to load budget" }, { status: 503 });
    }
}

// PATCH /api/finance/budget → updates global budget AND category limits
export async function PATCH(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await req.json() as {
            monthly_total_bs?: number;
            daily_free_bs?: number;
            category_limits?: Array<{ category_id: string; monthly_limit_bs: number; active: boolean }>;
        };

        const repo = new SupabaseBudgetRepository();

        if (body.monthly_total_bs !== undefined || body.daily_free_bs !== undefined) {
            await repo.update({
                monthly_total_bs: body.monthly_total_bs,
                daily_free_bs: body.daily_free_bs,
            });
        }

        if (body.category_limits) {
            await Promise.all(
                body.category_limits.map((cl) =>
                    repo.upsertCategoryBudget(cl.category_id, cl.monthly_limit_bs, cl.active)
                )
            );
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Failed to update budget" }, { status: 503 });
    }
}
