import { describe, it, expect } from "vitest";
import { extractCategoryAliasCandidates } from "./category-alias-learning";

describe("extractCategoryAliasCandidates", () => {
    it("extracts meaningful tokens from colloquial transaction text", () => {
        const result = extractCategoryAliasCandidates("3bs papel higienico en efectivo");
        expect(result).toContain("papel");
        expect(result).toContain("papel higienico");
    });

    it("skips mostly control/account words", () => {
        const result = extractCategoryAliasCandidates("20 bs en qr");
        expect(result.length).toBe(0);
    });
});
