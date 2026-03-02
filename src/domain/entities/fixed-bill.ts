// Domain Entity: FixedBill
export interface FixedBill {
    id: string;
    name: string;
    amount_bs: number;
    due_day: number;
    account_id: string | null;
    autopay: boolean;
    is_active: boolean;
    created_at: string;
}

export interface FixedBillWithAccount extends FixedBill {
    account: { id: string; name: string; slug: string } | null;
}
