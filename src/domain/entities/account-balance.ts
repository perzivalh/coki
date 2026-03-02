// Domain Entity: AccountBalance
export type BalanceSource = "manual" | "adjustment" | "system";

export interface AccountBalance {
    id: string;
    account_id: string;
    balance_bs: number;
    source: BalanceSource;
    updated_at: string;
}

export interface AccountWithBalance {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created_at: string;
    balance: AccountBalance | null;
}
