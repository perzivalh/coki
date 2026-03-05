import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConfirmationMessage } from "./handle-confirmation";

const mockTransactionRepo = {
    findLatestPendingForSourceAndSender: vi.fn(),
    update: vi.fn(),
};

const mockBalanceRepo = {
    adjust: vi.fn(),
};

const mockApplyOnStatusTransition = vi.fn();

vi.mock("@/infrastructure/db/supabase/transaction.repository", () => ({
    SupabaseTransactionRepository: vi.fn().mockImplementation(() => mockTransactionRepo),
}));

vi.mock("@/infrastructure/db/supabase/account-balance.repository", () => ({
    SupabaseAccountBalanceRepository: vi.fn().mockImplementation(() => mockBalanceRepo),
}));

vi.mock("@/application/services/whatsapp-sender", () => ({
    sendWhatsAppMessage: vi.fn(),
}));

vi.mock("./balance-ledger", () => ({
    BalanceLedgerService: {
        applyOnStatusTransition: (...args: unknown[]) => mockApplyOnStatusTransition(...args),
    },
}));

describe("handleConfirmationMessage", () => {
    const phoneNumber = "12345678";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("ignores messages that are not confirmations", async () => {
        const result = await handleConfirmationMessage("hola", phoneNumber);
        expect(result).toBe(false);
    });

    it("returns false when there is no pending transaction for this sender", async () => {
        mockTransactionRepo.findLatestPendingForSourceAndSender.mockResolvedValueOnce(null);
        const result = await handleConfirmationMessage("si", phoneNumber);
        expect(mockTransactionRepo.findLatestPendingForSourceAndSender).toHaveBeenCalledWith("whatsapp", phoneNumber);
        expect(result).toBe(false);
    });

    it("confirms transaction on yes and adjusts balance via ledger", async () => {
        const futureDate = new Date(Date.now() + 10000).toISOString();
        mockTransactionRepo.findLatestPendingForSourceAndSender.mockResolvedValueOnce({
            id: "tx-1",
            status: "pending",
            type: "expense",
            amount_bs: 50,
            account_id: "acc-1",
            confirmation_expires_at: futureDate,
        });
        mockTransactionRepo.update.mockResolvedValueOnce({
            id: "tx-1",
            status: "confirmed",
            type: "expense",
            amount_bs: 50,
            account_id: "acc-1",
        });

        const result = await handleConfirmationMessage("SI", phoneNumber);
        expect(mockTransactionRepo.update).toHaveBeenCalledWith("tx-1", { status: "confirmed" });
        expect(mockApplyOnStatusTransition).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    it("cancels transaction on no", async () => {
        const futureDate = new Date(Date.now() + 10000).toISOString();
        mockTransactionRepo.findLatestPendingForSourceAndSender.mockResolvedValueOnce({
            id: "tx-2",
            status: "pending",
            type: "expense",
            amount_bs: 50,
            account_id: "acc-1",
            confirmation_expires_at: futureDate,
        });
        mockTransactionRepo.update.mockResolvedValueOnce({ id: "tx-2", status: "cancelled" });

        const result = await handleConfirmationMessage("no", phoneNumber);
        expect(mockTransactionRepo.update).toHaveBeenCalledWith("tx-2", { status: "cancelled" });
        expect(result).toBe(true);
    });
});
