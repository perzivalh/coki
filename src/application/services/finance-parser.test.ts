// Unit tests: Finance Parser — regex fallback (updated for AIDecision interface)
import { describe, it, expect } from "vitest";
import { parseWithRegex } from "@/application/services/finance-parser";

describe("parseWithRegex — expense detection", () => {
    it("parses simple expense: '35 almuerzo'", () => {
        const r = parseWithRegex("35 almuerzo");
        expect(r.type).toBe("expense");
        expect(r.amount_bs).toBe(35);
        expect(r.note).toContain("almuerzo");
        expect(r.used_ai).toBe(false);
    });

    it("parses expense with decimal: '35.50 cafe'", () => {
        const r = parseWithRegex("35.50 cafe");
        expect(r.amount_bs).toBe(35.5);
    });

    it("parses expense with comma: '35,50 cafe'", () => {
        const r = parseWithRegex("35,50 cafe");
        expect(r.amount_bs).toBe(35.5);
    });

    it("never assumes an account — account_id is null", () => {
        const r = parseWithRegex("120 gasolina qr");
        expect(r.account_id).toBeNull();
        expect(r.amount_bs).toBe(120);
    });

    it("never assumes cash — account_id null even without qr", () => {
        const r = parseWithRegex("50 supermercado");
        expect(r.account_id).toBeNull();
    });

    it("never assumes a category — category_id is null", () => {
        const r = parseWithRegex("35 almuerzo");
        expect(r.category_id).toBeNull();
    });
});

describe("parseWithRegex — income detection", () => {
    it("detects 'ingreso 5000 sueldo'", () => {
        const r = parseWithRegex("ingreso 5000 sueldo");
        expect(r.type).toBe("income");
        expect(r.amount_bs).toBe(5000);
    });

    it("detects 'cobré 300'", () => {
        const r = parseWithRegex("cobré 300");
        expect(r.type).toBe("income");
        expect(r.amount_bs).toBe(300);
    });
});

describe("parseWithRegex — edge cases", () => {
    it("returns null amount for non-monetary message", () => {
        const r = parseWithRegex("hola como estas");
        expect(r.amount_bs).toBeNull();
    });

    it("returns note as original text when nothing stripped", () => {
        const r = parseWithRegex("hola");
        expect(r.note).toBeTruthy();
    });
});
