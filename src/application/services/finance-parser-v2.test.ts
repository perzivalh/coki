import { describe, it, expect } from "vitest";
import { parseFinanceMessageV2 } from "./finance-parser";

const categories = [
    { id: "c1", name: "Comida", slug: "comida" },
    { id: "c2", name: "Transporte", slug: "transporte" },
    { id: "c3", name: "Salud", slug: "salud" },
    { id: "c4", name: "Compras", slug: "compras" },
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

    it("maps colloquial food words to comida", async () => {
        const result = await parseFinanceMessageV2("2bs chupete en efectivo", categories, accounts);
        expect(result.category_slug).toBe("comida");
        expect(result.account_slug).toBe("cash");
    });

    it("maps supplements to salud", async () => {
        const result = await parseFinanceMessageV2("20bs preentreno qr", categories, accounts);
        expect(result.category_slug).toBe("salud");
        expect(result.account_slug).toBe("qr");
    });

    it("maps household and paper-like purchases to compras", async () => {
        const result = await parseFinanceMessageV2("3bs papel efectivo", categories, accounts);
        expect(result.category_slug).toBe("compras");
        expect(result.account_slug).toBe("cash");
    });

    it("uses learned aliases passed by settings/history", async () => {
        const result = await parseFinanceMessageV2(
            "18bs churrasco qr",
            categories,
            accounts,
            { categoryAliasesBySlug: { comida: ["churrasco"] } },
        );
        expect(result.category_slug).toBe("comida");
        expect(result.account_slug).toBe("qr");
    });

    it("keeps null amount for non-finance text", async () => {
        const result = await parseFinanceMessageV2("hola como va", categories, accounts);
        expect(result.amount_bs).toBeNull();
    });
});
