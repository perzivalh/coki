// Domain Contracts: Finance Repositories
import type { Transaction, TransactionWithRelations, TransactionType, TransactionStatus, TransactionBucket } from "../entities/transaction";
import type { Category } from "../entities/category";
import type { Account } from "../entities/account";
import type { Budget, CategoryBudget, CategoryBudgetWithName } from "../entities/budget";
import type { DailySummary } from "../entities/daily-summary";
import type { IncomeSource } from "../entities/income-source";
import type { FixedBill, FixedBillWithAccount } from "../entities/fixed-bill";
import type { AccountBalance, AccountWithBalance, BalanceSource } from "../entities/account-balance";
import type { DraftTransaction, BotPendingStep, StepType } from "../entities/draft-transaction";

export interface CreateTransactionInput {
    type: TransactionType;
    amount_bs: number;
    category_id?: string | null;
    account_id: string;
    note?: string | null;
    source: "whatsapp" | "web";
    occurred_at?: string;
    inbound_message_id?: string | null;
    status?: TransactionStatus;
    bucket?: TransactionBucket;
    exceeded_daily?: boolean;
    exceeded_monthly?: boolean;
    exceeded_category?: boolean;
    confirmation_expires_at?: string | null;
}

export interface UpdateTransactionInput {
    amount_bs?: number;
    category_id?: string | null;
    account_id?: string;
    note?: string | null;
    occurred_at?: string;
    status?: TransactionStatus;
    bucket?: TransactionBucket;
    exceeded_daily?: boolean;
    exceeded_monthly?: boolean;
    exceeded_category?: boolean;
}

export interface ListTransactionsInput {
    cursor?: string;
    limit?: number;
    from?: string;
    to?: string;
    q?: string;
    status?: TransactionStatus;
    bucket?: TransactionBucket;
}

export interface ListTransactionsResult {
    data: TransactionWithRelations[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
}

export interface FinanceSummary {
    range: "today" | "month";
    date: string;
    total_income_bs: number;
    total_expense_bs: number;
    net_bs: number;
    currency: string;
    timezone: string;
}

export interface CurrentSpendSummary {
    today_bs: number;
    month_bs: number;
    month_by_category_bs: Record<string, number>;
}

export interface ITransactionRepository {
    create(input: CreateTransactionInput): Promise<Transaction>;
    update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
    findById(id: string): Promise<Transaction | null>;
    findLatestPendingForSource(source: string): Promise<Transaction | null>;
    list(input: ListTransactionsInput): Promise<ListTransactionsResult>;
    getSummary(range: "today" | "month", timezone: string, bucket?: TransactionBucket): Promise<FinanceSummary>;
    getCurrentSpend(timezone: string): Promise<{ today_bs: number; month_bs: number; month_by_category_bs: Record<string, number> }>;
    findRecentWithRelations(limit: number): Promise<TransactionWithRelations[]>;
}

export interface ICategoryRepository {
    findAll(): Promise<Category[]>;
    findBySlug(slug: string): Promise<Category | null>;
    findById(id: string): Promise<Category | null>;
    create(input: { name: string; slug: string; icon?: string }): Promise<Category>;
    update(id: string, input: Partial<{ name: string; icon: string; active: boolean }>): Promise<Category>;
    delete(id: string): Promise<void>;
}

export interface IAccountRepository {
    findAll(): Promise<Account[]>;
    findBySlug(slug: string): Promise<Account | null>;
    findById(id: string): Promise<Account | null>;
    findDefault(): Promise<Account>;
    create(input: { name: string; slug: string }): Promise<Account>;
    update(id: string, input: Partial<{ name: string; active: boolean }>): Promise<Account>;
    findAllWithBalances(): Promise<AccountWithBalance[]>;
}

export interface IBudgetRepository {
    getOrCreate(): Promise<Budget>;
    update(input: Partial<{ monthly_total_bs: number; daily_free_bs: number }>): Promise<Budget>;
    listCategoryBudgets(): Promise<CategoryBudgetWithName[]>;
    upsertCategoryBudget(category_id: string, monthly_limit_bs: number, active?: boolean): Promise<CategoryBudget>;
    deleteCategoryBudget(category_id: string): Promise<void>;
}

export interface IDailySummaryRepository {
    findByDate(date: string): Promise<DailySummary | null>;
    create(date: string, payload: Record<string, unknown>): Promise<DailySummary>;
    markSent(id: string): Promise<void>;
    markFailed(id: string): Promise<void>;
}

// ── Sprint 2.5 contracts ──────────────────────────────────────────────────────

export interface IIncomeSourceRepository {
    findAll(): Promise<IncomeSource[]>;
    findById(id: string): Promise<IncomeSource | null>;
    create(input: { name: string; amount_monthly_bs: number }): Promise<IncomeSource>;
    update(id: string, input: Partial<{ name: string; amount_monthly_bs: number; is_active: boolean }>): Promise<IncomeSource>;
    delete(id: string): Promise<void>;
}

export interface IFixedBillRepository {
    findAll(): Promise<FixedBillWithAccount[]>;
    findById(id: string): Promise<FixedBill | null>;
    create(input: { name: string; amount_bs: number; due_day: number; account_id?: string | null; autopay?: boolean }): Promise<FixedBill>;
    update(id: string, input: Partial<{ name: string; amount_bs: number; due_day: number; account_id: string | null; autopay: boolean; is_active: boolean }>): Promise<FixedBill>;
    delete(id: string): Promise<void>;
}

export interface IAccountBalanceRepository {
    findByAccountId(account_id: string): Promise<AccountBalance | null>;
    upsert(account_id: string, balance_bs: number, source: BalanceSource): Promise<AccountBalance>;
    findAllWithAccounts(): Promise<AccountWithBalance[]>;
}

export interface IDraftTransactionRepository {
    create(input: { raw_input?: string; parsed_json?: Record<string, unknown>; missing_fields: string[] }): Promise<DraftTransaction>;
    findPendingForUser(): Promise<DraftTransaction | null>;
    updateParsed(id: string, parsed_json: Record<string, unknown>, missing_fields: string[]): Promise<DraftTransaction>;
    markComplete(id: string): Promise<DraftTransaction>;
    markAbandoned(id: string): Promise<DraftTransaction>;
    getPendingStep(draft_id: string): Promise<BotPendingStep | null>;
    addPendingStep(draft_id: string, step_type: StepType, message_context: { from: string; wa_message_id?: string }): Promise<BotPendingStep>;
    deletePendingStep(id: string): Promise<void>;
    findByStepContext(from: string): Promise<{ draft: DraftTransaction; step: BotPendingStep } | null>;
}
