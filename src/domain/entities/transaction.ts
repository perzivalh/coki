// Domain Entity: Transaction
import type { Category } from "./category";
import type { Account } from "./account";

export type TransactionType = "expense" | "income";
export type TransactionSource = "whatsapp" | "web";
export type TransactionStatus = "pending" | "confirmed" | "cancelled" | "draft";
export type TransactionBucket = "free" | "fixed";

export interface Transaction {
    id: string;
    type: TransactionType;
    amount_bs: number;
    category_id: string | null;
    account_id: string;
    note: string | null;
    source: TransactionSource;
    occurred_at: string;
    created_at: string;
    inbound_message_id: string | null;
    status: TransactionStatus;
    bucket: TransactionBucket;
    exceeded_daily: boolean;
    exceeded_monthly: boolean;
    exceeded_category: boolean;
    confirmation_expires_at: string | null;
}

export interface TransactionWithRelations extends Transaction {
    category: Category | null;
    account: Account;
}
