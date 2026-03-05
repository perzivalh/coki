import type { Transaction, TransactionStatus, TransactionType } from "@/domain/entities/transaction";

interface BalanceAdjustRepository {
    adjust(account_id: string, delta_bs: number): Promise<unknown>;
}

function signedAmount(type: TransactionType, amount: number): number {
    return type === "expense" ? -amount : amount;
}

function hasBalanceEffect(status: TransactionStatus): boolean {
    return status === "confirmed";
}

export class BalanceLedgerService {
    static async applyOnCreate(
        tx: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        repo: BalanceAdjustRepository,
    ): Promise<void> {
        if (!hasBalanceEffect(tx.status)) return;
        await repo.adjust(tx.account_id, signedAmount(tx.type, Number(tx.amount_bs)));
    }

    static async applyOnStatusTransition(
        previous: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        next: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        repo: BalanceAdjustRepository,
    ): Promise<void> {
        if (previous.status === next.status) return;

        if (hasBalanceEffect(previous.status)) {
            await repo.adjust(previous.account_id, -signedAmount(previous.type, Number(previous.amount_bs)));
        }
        if (hasBalanceEffect(next.status)) {
            await repo.adjust(next.account_id, signedAmount(next.type, Number(next.amount_bs)));
        }
    }

    static async applyOnUpdate(
        previous: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        next: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        repo: BalanceAdjustRepository,
    ): Promise<void> {
        if (hasBalanceEffect(previous.status)) {
            await repo.adjust(previous.account_id, -signedAmount(previous.type, Number(previous.amount_bs)));
        }
        if (hasBalanceEffect(next.status)) {
            await repo.adjust(next.account_id, signedAmount(next.type, Number(next.amount_bs)));
        }
    }

    static async applyOnDelete(
        previous: Pick<Transaction, "status" | "type" | "amount_bs" | "account_id">,
        repo: BalanceAdjustRepository,
    ): Promise<void> {
        if (!hasBalanceEffect(previous.status)) return;
        await repo.adjust(previous.account_id, -signedAmount(previous.type, Number(previous.amount_bs)));
    }
}
