// Infrastructure: SupabaseFixedBillRepository
import type { IFixedBillRepository } from "@/domain/contracts/finance";
import type { FixedBill, FixedBillWithAccount } from "@/domain/entities/fixed-bill";
import { supabaseService } from "./client";

export class SupabaseFixedBillRepository implements IFixedBillRepository {
    async findAll(): Promise<FixedBillWithAccount[]> {
        const { data, error } = await supabaseService
            .from("fixed_bills")
            .select("*, account:accounts(id,name,slug)")
            .order("due_day", { ascending: true });
        if (error) throw new Error(`Failed to list fixed bills: ${error.message}`);
        return (data ?? []) as FixedBillWithAccount[];
    }

    async findById(id: string): Promise<FixedBill | null> {
        const { data, error } = await supabaseService
            .from("fixed_bills")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (error) return null;
        return data as FixedBill | null;
    }

    async create(input: {
        name: string;
        amount_bs: number;
        due_day: number;
        account_id?: string | null;
        autopay?: boolean;
    }): Promise<FixedBill> {
        const { data, error } = await supabaseService
            .from("fixed_bills")
            .insert({
                name: input.name,
                amount_bs: input.amount_bs,
                due_day: input.due_day,
                account_id: input.account_id ?? null,
                autopay: input.autopay ?? false,
            })
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to create fixed bill: ${error?.message}`);
        return data as FixedBill;
    }

    async update(
        id: string,
        input: Partial<{
            name: string;
            amount_bs: number;
            due_day: number;
            account_id: string | null;
            autopay: boolean;
            is_active: boolean;
        }>
    ): Promise<FixedBill> {
        const { data, error } = await supabaseService
            .from("fixed_bills")
            .update(input)
            .eq("id", id)
            .select()
            .single();
        if (error || !data) throw new Error(`Failed to update fixed bill: ${error?.message}`);
        return data as FixedBill;
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabaseService
            .from("fixed_bills")
            .delete()
            .eq("id", id);
        if (error) throw new Error(`Failed to delete fixed bill: ${error.message}`);
    }
}
