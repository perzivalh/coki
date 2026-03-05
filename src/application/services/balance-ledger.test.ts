import { describe, it, expect, vi } from "vitest";
import { BalanceLedgerService } from "./balance-ledger";

describe("BalanceLedgerService", () => {
    it("applies create delta for confirmed expense", async () => {
        const repo = { adjust: vi.fn().mockResolvedValue(undefined) };
        await BalanceLedgerService.applyOnCreate(
            { status: "confirmed", type: "expense", amount_bs: 20, account_id: "acc-1" },
            repo,
        );
        expect(repo.adjust).toHaveBeenCalledWith("acc-1", -20);
    });

    it("applies pending to confirmed transition", async () => {
        const repo = { adjust: vi.fn().mockResolvedValue(undefined) };
        await BalanceLedgerService.applyOnStatusTransition(
            { status: "pending", type: "expense", amount_bs: 30, account_id: "acc-1" },
            { status: "confirmed", type: "expense", amount_bs: 30, account_id: "acc-1" },
            repo,
        );
        expect(repo.adjust).toHaveBeenCalledWith("acc-1", -30);
    });

    it("reverts previous and applies next on update", async () => {
        const repo = { adjust: vi.fn().mockResolvedValue(undefined) };
        await BalanceLedgerService.applyOnUpdate(
            { status: "confirmed", type: "expense", amount_bs: 10, account_id: "cash" },
            { status: "confirmed", type: "expense", amount_bs: 12, account_id: "qr" },
            repo,
        );
        expect(repo.adjust).toHaveBeenNthCalledWith(1, "cash", 10);
        expect(repo.adjust).toHaveBeenNthCalledWith(2, "qr", -12);
    });

    it("reverts confirmed transaction on delete", async () => {
        const repo = { adjust: vi.fn().mockResolvedValue(undefined) };
        await BalanceLedgerService.applyOnDelete(
            { status: "confirmed", type: "income", amount_bs: 100, account_id: "qr" },
            repo,
        );
        expect(repo.adjust).toHaveBeenCalledWith("qr", -100);
    });
});
