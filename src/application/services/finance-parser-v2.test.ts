import { describe, it, expect } from "vitest";
import { parseFinanceMessageV2 } from "./finance-parser";

const categories = [
    { id: "c1", name: "Comida", slug: "comida" },
    { id: "c2", name: "Transporte", slug: "transporte" },
];

const accounts = [
    { id: "a1", name: "Efectivo", slug: "cash" },
    { id: "a2", name: "QR", slug: "qr" },
];

describe("parseFinanceMessageV2 (regex fallback)", () => {
    it("parses amount with compact currency format", async () => {
        const result = await parseFinanceMessageV2("300bs comida en qr", categories, accounts);
        expect(result.amount_bs).toBe(300);
        expect(result.account_slug).toBe("qr");
    });

    it("detects income keywords", async () => {
        const result = await parseFinanceMessageV2("ingreso 500 sueldo", categories, accounts);
        expect(result.type).toBe("income");
        expect(result.amount_bs).toBe(500);
    });

    it("keeps null amount for non-finance text", async () => {
        const result = await parseFinanceMessageV2("hola como va", categories, accounts);
        expect(result.amount_bs).toBeNull();
    });
});
