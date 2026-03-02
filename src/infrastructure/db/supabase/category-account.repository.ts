// Infrastructure: Category + Account Repositories (Supabase)
import type { ICategoryRepository, IAccountRepository } from "@/domain/contracts/finance";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";
import type { AccountWithBalance, AccountBalance } from "@/domain/entities/account-balance";
import { supabaseService } from "./client";

export class SupabaseCategoryRepository implements ICategoryRepository {
    async findAll(): Promise<Category[]> {
        const { data, error } = await supabaseService
            .from("categories")
            .select("*")
            .eq("active", true)
            .order("name");
        if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
        return (data ?? []) as Category[];
    }

    async findBySlug(slug: string): Promise<Category | null> {
        const { data, error } = await supabaseService
            .from("categories")
            .select("*")
            .eq("slug", slug)
            .single();
        if (error || !data) return null;
        return data as Category;
    }

    async findById(id: string): Promise<Category | null> {
        const { data, error } = await supabaseService
            .from("categories")
            .select("*")
            .eq("id", id)
            .single();
        if (error || !data) return null;
        return data as Category;
    }

    async create(input: { name: string; slug: string; icon?: string }): Promise<Category> {
        const { data, error } = await supabaseService
            .from("categories")
            .insert({ name: input.name, slug: input.slug, icon: input.icon })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create category: ${error?.message}`);
        return data as Category;
    }

    async update(id: string, input: Partial<{ name: string; icon: string; active: boolean }>): Promise<Category> {
        const { data, error } = await supabaseService
            .from("categories")
            .update(input)
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update category: ${error?.message}`);
        return data as Category;
    }

    async delete(id: string): Promise<void> {
        // Soft delete or hard delete? Usually for categories we do soft delete (active = false)
        // because of foreign key constraints on transactions. Let's do a hard delete attempt,
        // and if it fails due to FK, we'll let it bubble up, or we can soft delete.
        // The contract asks for delete. Let's hard delete for now.
        const { error } = await supabaseService
            .from("categories")
            .delete()
            .eq("id", id);
        if (error) throw new Error(`Failed to delete category: ${error.message}`);
    }
}

export class SupabaseAccountRepository implements IAccountRepository {
    async findAll(): Promise<Account[]> {
        const { data, error } = await supabaseService
            .from("accounts")
            .select("*")
            .eq("active", true)
            .order("name");
        if (error) throw new Error(`Failed to fetch accounts: ${error.message}`);
        return (data ?? []) as Account[];
    }

    async findBySlug(slug: string): Promise<Account | null> {
        const { data, error } = await supabaseService
            .from("accounts")
            .select("*")
            .eq("slug", slug)
            .single();
        if (error || !data) return null;
        return data as Account;
    }

    async findById(id: string): Promise<Account | null> {
        const { data, error } = await supabaseService
            .from("accounts")
            .select("*")
            .eq("id", id)
            .single();
        if (error || !data) return null;
        return data as Account;
    }

    async findDefault(): Promise<Account> {
        const account = await this.findBySlug("cash");
        if (!account) throw new Error("Default account 'cash' not found");
        return account;
    }

    async create(input: { name: string; slug: string }): Promise<Account> {
        const { data, error } = await supabaseService
            .from("accounts")
            .insert({ name: input.name, slug: input.slug })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create account: ${error?.message}`);
        return data as Account;
    }

    async update(id: string, input: Partial<{ name: string; active: boolean }>): Promise<Account> {
        const { data, error } = await supabaseService
            .from("accounts")
            .update(input)
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update account: ${error?.message}`);
        return data as Account;
    }

    async findAllWithBalances(): Promise<AccountWithBalance[]> {
        const [accountsResult, balancesResult] = await Promise.all([
            supabaseService.from("accounts").select("*").order("name"),
            supabaseService.from("account_balances").select("*"),
        ]);
        if (accountsResult.error) throw new Error(`Failed to fetch accounts: ${accountsResult.error.message}`);

        const accounts = (accountsResult.data ?? []) as Account[];
        const balances = (balancesResult.data ?? []) as AccountBalance[];
        const balanceMap = new Map(balances.map((b) => [b.account_id, b]));

        return accounts.map((acc) => ({
            ...acc,
            balance: balanceMap.get(acc.id) ?? null,
        }));
    }
}
