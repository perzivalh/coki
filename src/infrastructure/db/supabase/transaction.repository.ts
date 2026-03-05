// Infrastructure: SupabaseTransactionRepository
import type {
    ITransactionRepository,
    CreateTransactionInput,
    ListTransactionsInput,
    ListTransactionsResult,
    FinanceSummary,
    UpdateTransactionInput,
} from "@/domain/contracts/finance";
import type { Transaction, TransactionWithRelations, TransactionBucket } from "@/domain/entities/transaction";
import { supabaseService } from "./client";

export class SupabaseTransactionRepository implements ITransactionRepository {
    async create(input: CreateTransactionInput): Promise<Transaction> {
        const { data, error } = await supabaseService
            .from("transactions")
            .insert({
                type: input.type,
                amount_bs: input.amount_bs,
                category_id: input.category_id ?? null,
                account_id: input.account_id,
                note: input.note ?? null,
                source: input.source,
                occurred_at: input.occurred_at ?? new Date().toISOString(),
                inbound_message_id: input.inbound_message_id ?? null,
                from_number: input.from_number ?? null,
                status: input.status ?? "confirmed",
                bucket: input.bucket ?? "free",
                exceeded_daily: input.exceeded_daily ?? false,
                exceeded_monthly: input.exceeded_monthly ?? false,
                exceeded_category: input.exceeded_category ?? false,
                confirmation_expires_at: input.confirmation_expires_at ?? null,
            })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create transaction: ${error?.message}`);
        return data as Transaction;
    }

    async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
        const { data, error } = await supabaseService
            .from("transactions")
            .update(input)
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update transaction: ${error?.message}`);
        return data as Transaction;
    }

    async findById(id: string): Promise<Transaction | null> {
        const { data, error } = await supabaseService
            .from("transactions")
            .select()
            .eq("id", id)
            .single();
        if (error || !data) return null;
        return data as Transaction;
    }

    async findLatestPendingForSource(source: string): Promise<Transaction | null> {
        const { data, error } = await supabaseService
            .from("transactions")
            .select()
            .eq("source", source)
            .eq("status", "pending")
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return null;
        return data as Transaction | null;
    }

    async findLatestPendingForSourceAndSender(source: string, from: string): Promise<Transaction | null> {
        const { data, error } = await supabaseService
            .from("transactions")
            .select()
            .eq("source", source)
            .eq("from_number", from)
            .eq("status", "pending")
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return null;
        return data as Transaction | null;
    }

    async list(input: ListTransactionsInput): Promise<ListTransactionsResult> {
        const limit = Math.min(input.limit ?? 20, 100);

        let query = supabaseService
            .from("transactions")
            .select(
                `*, category:categories(id,name,slug,icon), account:accounts(id,name,slug)`,
                { count: "exact" }
            )
            .order("occurred_at", { ascending: false })
            .limit(limit + 1); // fetch one extra to detect has_more

        if (input.cursor) query = query.lt("occurred_at", input.cursor);
        if (input.from) query = query.gte("occurred_at", input.from);
        if (input.to) query = query.lte("occurred_at", input.to);
        if (input.q) {
            query = query.or(`note.ilike.%${input.q}%`);
        }
        if (input.status) {
            query = query.eq("status", input.status);
        }
        if (input.bucket) {
            query = query.eq("bucket", input.bucket);
        }

        const { data, error, count } = await query;
        if (error) throw new Error(`Failed to list transactions: ${error.message}`);

        const rows = (data ?? []) as TransactionWithRelations[];
        const has_more = rows.length > limit;
        const trimmed = has_more ? rows.slice(0, limit) : rows;
        const next_cursor = has_more ? trimmed[trimmed.length - 1]?.occurred_at ?? null : null;

        return {
            data: trimmed,
            next_cursor,
            has_more,
            total_count: count ?? 0,
        };
    }

    async getSummary(range: "today" | "month", timezone: string, bucket?: TransactionBucket): Promise<FinanceSummary> {
        // Compute date range in the given timezone using Intl
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const todayStr = formatter.format(now); // YYYY-MM-DD in local timezone

        // Converts "YYYY-MM-DD" + "HH:MM:SS" in `timezone` → UTC ISO string
        function localToUtc(dateStr: string, time: string): string {
            const noonUtc = new Date(`${dateStr}T12:00:00Z`);
            const dtf = new Intl.DateTimeFormat("en-CA", {
                timeZone: timezone,
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false,
            });
            const parts = dtf.formatToParts(noonUtc);
            const pm = Object.fromEntries(parts.map(p => [p.type, p.value]));
            const localNoonMs = new Date(`${pm.year}-${pm.month}-${pm.day}T${pm.hour}:${pm.minute}:${pm.second}Z`).getTime();
            const offsetMs = localNoonMs - noonUtc.getTime();
            return new Date(new Date(`${dateStr}T${time}Z`).getTime() - offsetMs).toISOString();
        }

        let fromUtc: string;
        let toUtc: string;

        if (range === "today") {
            fromUtc = localToUtc(todayStr, "00:00:00");
            toUtc = localToUtc(todayStr, "23:59:59");
        } else {
            const [yr, mo] = todayStr.split("-").map(Number);
            const firstDayStr = `${yr}-${String(mo).padStart(2, "0")}-01`;
            const lastDayDate = new Date(yr, mo, 0);
            const lastDayStr = `${yr}-${String(mo).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
            fromUtc = localToUtc(firstDayStr, "00:00:00");
            toUtc = localToUtc(lastDayStr, "23:59:59");
        }

        let summaryQuery = supabaseService
            .from("transactions")
            .select("type, amount_bs")
            .eq("status", "confirmed")
            .gte("occurred_at", fromUtc)
            .lte("occurred_at", toUtc);

        if (bucket) summaryQuery = summaryQuery.eq("bucket", bucket);

        const { data, error } = await summaryQuery;
        if (error) throw new Error(`Failed to get summary: ${error.message}`);

        const rows = (data ?? []) as { type: string; amount_bs: number }[];
        const total_income_bs = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount_bs), 0);
        const total_expense_bs = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount_bs), 0);

        return {
            range,
            date: todayStr,
            total_income_bs: Math.round(total_income_bs * 100) / 100,
            total_expense_bs: Math.round(total_expense_bs * 100) / 100,
            net_bs: Math.round((total_income_bs - total_expense_bs) * 100) / 100,
            currency: "Bs",
            timezone,
        };
    }

    async getCurrentSpend(timezone: string): Promise<{ today_bs: number; month_bs: number; month_by_category_bs: Record<string, number> }> {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
        const todayStr = formatter.format(now);

        function localToUtc(dateStr: string, time: string): string {
            const noonUtc = new Date(`${dateStr}T12:00:00Z`);
            const dtf = new Intl.DateTimeFormat("en-CA", {
                timeZone: timezone,
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false,
            });
            const parts = dtf.formatToParts(noonUtc);
            const pm = Object.fromEntries(parts.map(p => [p.type, p.value]));
            const localNoonMs = new Date(`${pm.year}-${pm.month}-${pm.day}T${pm.hour}:${pm.minute}:${pm.second}Z`).getTime();
            const offsetMs = localNoonMs - noonUtc.getTime();
            return new Date(new Date(`${dateStr}T${time}Z`).getTime() - offsetMs).toISOString();
        }

        const [yr, mo] = todayStr.split("-").map(Number);
        const firstDayStr = `${yr}-${String(mo).padStart(2, "0")}-01`;

        const firstDayOfMonthUtc = localToUtc(firstDayStr, "00:00:00");
        const startOfTodayUtc = localToUtc(todayStr, "00:00:00");

        const { data, error } = await supabaseService
            .from("transactions")
            .select("amount_bs, category_id, occurred_at")
            .eq("type", "expense")
            .eq("status", "confirmed")
            .gte("occurred_at", firstDayOfMonthUtc);

        if (error) throw new Error(`Failed to get current spend: ${error.message}`);

        const rows = (data ?? []) as { amount_bs: number; category_id: string | null; occurred_at: string }[];

        let today_bs = 0;
        let month_bs = 0;
        const month_by_category_bs: Record<string, number> = {};

        const todayStartMs = new Date(startOfTodayUtc).getTime();

        for (const row of rows) {
            const amt = Number(row.amount_bs);
            month_bs += amt;

            if (row.category_id) {
                month_by_category_bs[row.category_id] = (month_by_category_bs[row.category_id] || 0) + amt;
            }

            if (new Date(row.occurred_at).getTime() >= todayStartMs) {
                today_bs += amt;
            }
        }

        return { today_bs, month_bs, month_by_category_bs };
    }

    async findRecentWithRelations(limit: number): Promise<TransactionWithRelations[]> {
        const { data, error } = await supabaseService
            .from("transactions")
            .select(`*, category:categories(id,name,slug,icon), account:accounts(id,name,slug)`)
            .order("occurred_at", { ascending: false })
            .limit(limit);
        if (error) throw new Error(`Failed to fetch recent: ${error.message}`);
        return (data ?? []) as TransactionWithRelations[];
    }
}
