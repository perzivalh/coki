import { describe, it, expect } from "vitest";
import {
    isBalanceQuery,
    looksLikeTransaction,
    isCancelCommand,
    isPositiveConfirmation,
    isNegativeConfirmation,
    extractAmountCandidate,
} from "./conversation-intent";

describe("conversation-intent", () => {
    it("detects balance queries", () => {
        expect(isBalanceQuery("cuanto me queda en qr")).toBe(true);
        expect(isBalanceQuery("saldo total")).toBe(true);
    });

    it("detects transaction-like free text", () => {
        expect(looksLikeTransaction("1bs pasaje efectivo")).toBe(true);
        expect(looksLikeTransaction("ingreso 300 pago")).toBe(true);
    });

    it("detects control and confirmation commands", () => {
        expect(isCancelCommand("nuevo")).toBe(true);
        expect(isPositiveConfirmation("si")).toBe(true);
        expect(isNegativeConfirmation("no")).toBe(true);
    });

    it("extracts amount from mixed formats", () => {
        expect(extractAmountCandidate("300bs")).toBe(300);
        expect(extractAmountCandidate("bs 300,50")).toBe(300.5);
        expect(extractAmountCandidate("+37 en qr")).toBe(37);
    });
});
