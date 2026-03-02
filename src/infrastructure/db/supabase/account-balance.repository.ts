// Infrastructure: SupabaseAccountBalanceRepository
import type { IAccountBalanceRepository } from "@/domain/contracts/finance";
import type { AccountBalance, AccountWithBalance, BalanceSource } from "@/domain/entities/account-balance";
import { supabaseService } from "./client";

export class SupabaseAccountBalanceRepository implements IAccountBalanceRepository {
    async findByAccountId(account_id: string): Promise<AccountBalance | null> {
        const { data, error } = await supabaseService
            .from("account_balances")
            .select("*")
            .eq("account_id", account_id)
            .maybeSingle();
        if (error) return null;
        return data as AccountBalance | null;
    }

    async upsert(account_id: string, balance_bs: number, source: BalanceSource): Promise<AccountBalance> {
        const { data, error } = await supabaseService
            .from("account_balances")
            .upsert(
                { account_id, balance_bs, source, updated_at: new Date().toISOString() },
                { onConflict: "account_id" }
            )
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to upsert account balance: ${error?.message}`);
        return data as AccountBalance;
    }

    /** Increments (positive) or decrements (negative) the account balance. */
    async adjust(account_id: string, delta_bs: number): Promise<AccountBalance> {
        const current = await this.findByAccountId(account_id);
        const newBalance = (current?.balance_bs ?? 0) + delta_bs;
        return this.upsert(account_id, newBalance, "adjustment");
    }

    async findAllWithAccounts(): Promise<AccountWithBalance[]> {
        const [accountsResult, balancesResult] = await Promise.all([
            supabaseService.from("accounts").select("*").order("name"),
            supabaseService.from("account_balances").select("*"),
        ]);

        if (accountsResult.error) throw new Error(`Failed to fetch accounts: ${accountsResult.error.message}`);

        const accounts = (accountsResult.data ?? []) as Array<{
            id: string; name: string; slug: string; active: boolean; created_at: string;
        }>;
        const balances = (balancesResult.data ?? []) as AccountBalance[];
        const balanceMap = new Map(balances.map((b) => [b.account_id, b]));

        return accounts.map((acc) => ({
            ...acc,
            balance: balanceMap.get(acc.id) ?? null,
        }));
    }
}
