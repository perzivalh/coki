import { describe, it, expect, vi } from "vitest";
import { handleConfirmationMessage } from "./handle-confirmation";

const mockTransactionRepo = {
    findLatestPendingForSource: vi.fn(),
    update: vi.fn(),
};

// Mock dependencies
vi.mock("@/infrastructure/db/supabase/transaction.repository", () => {
    return {
        SupabaseTransactionRepository: vi.fn().mockImplementation(() => mockTransactionRepo)
    };
});
vi.mock("@/application/services/whatsapp-sender", () => ({
    sendWhatsAppMessage: vi.fn()
}));

describe("Handle Confirmation Message", () => {
    const phoneNumber = "12345678";

    it("should ignore messages that are not SI or NO", async () => {
        const result = await handleConfirmationMessage("Hola", phoneNumber);
        expect(result).toBe(false);
    });

    it("should indicate no pending if user says SI but has no pending tx", async () => {
        mockTransactionRepo.findLatestPendingForSource.mockResolvedValueOnce(null);
        const result = await handleConfirmationMessage("si", phoneNumber);
        expect(result).toBe(false);
    });

    it("should confirm transaction on SI", async () => {
        const futureDate = new Date(Date.now() + 10000).toISOString();
        mockTransactionRepo.findLatestPendingForSource.mockResolvedValueOnce({
            id: "tx-1", confirmation_expires_at: futureDate, amount_bs: 50
        });
        mockTransactionRepo.update.mockResolvedValueOnce({ id: "tx-1", status: "confirmed" });

        const result = await handleConfirmationMessage("SI", phoneNumber);
        expect(mockTransactionRepo.update).toHaveBeenCalledWith("tx-1", { status: "confirmed" });
        expect(result).toBe(true);
    });

    it("should cancel transaction on NO", async () => {
        const futureDate = new Date(Date.now() + 10000).toISOString();
        mockTransactionRepo.findLatestPendingForSource.mockResolvedValueOnce({
            id: "tx-2", confirmation_expires_at: futureDate, amount_bs: 50
        });
        mockTransactionRepo.update.mockResolvedValueOnce({ id: "tx-2", status: "cancelled" });

        const result = await handleConfirmationMessage("no", phoneNumber);
        expect(mockTransactionRepo.update).toHaveBeenCalledWith("tx-2", { status: "cancelled" });
        expect(result).toBe(true);
    });

    it("should handle expired transactions by canceling them automatically", async () => {
        const pastDate = new Date(Date.now() - 10000).toISOString();
        mockTransactionRepo.findLatestPendingForSource.mockResolvedValueOnce({
            id: "tx-3", confirmation_expires_at: pastDate, amount_bs: 50
        });
        mockTransactionRepo.update.mockResolvedValueOnce({ id: "tx-3", status: "cancelled" });

        // If user says SI but it's expired
        const result = await handleConfirmationMessage("sí", phoneNumber);
        expect(mockTransactionRepo.update).toHaveBeenCalledWith("tx-3", { status: "cancelled" });
        expect(result).toBe(true);
    });
});
