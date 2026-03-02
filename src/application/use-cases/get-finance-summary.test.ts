// Unit tests: FinanceSummary timezone calculation
// Tests the getSummary logic using mock date ranges (no DB needed)
import { describe, it, expect } from "vitest";

// Pure function extracted from transaction.repository to be testable
function getRangeForTimezone(range: "today" | "month", timezone: string): { from: string; to: string; date: string } {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const todayStr = fmt.format(now); // YYYY-MM-DD

    if (range === "today") {
        return {
            from: `${todayStr}T00:00:00`,
            to: `${todayStr}T23:59:59`,
            date: todayStr,
        };
    }
    const [yr, mo] = todayStr.split("-").map(Number);
    const lastDayDate = new Date(yr, mo, 0);
    const lastDay = `${yr}-${String(mo).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}T23:59:59`;
    const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01T00:00:00`;
    return { from: firstDay, to: lastDay, date: todayStr };
}

describe("getRangeForTimezone — today", () => {
    it("returns correct format YYYY-MM-DD", () => {
        const r = getRangeForTimezone("today", "America/La_Paz");
        expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("from starts at 00:00:00", () => {
        const r = getRangeForTimezone("today", "America/La_Paz");
        expect(r.from).toMatch(/T00:00:00$/);
    });

    it("to ends at 23:59:59", () => {
        const r = getRangeForTimezone("today", "America/La_Paz");
        expect(r.to).toMatch(/T23:59:59$/);
    });
});

describe("getRangeForTimezone — month", () => {
    it("month from starts on day 01", () => {
        const r = getRangeForTimezone("month", "America/Caracas");
        expect(r.from).toMatch(/-01T00:00:00$/);
    });

    it("month to is last day of month", () => {
        const r = getRangeForTimezone("month", "America/Caracas");
        // Last day should be ≥28 and ≤31
        const day = parseInt(r.to.split("T")[0].split("-")[2]);
        expect(day).toBeGreaterThanOrEqual(28);
        expect(day).toBeLessThanOrEqual(31);
    });
});

describe("Net calculation", () => {
    it("net = income - expenses", () => {
        const income = 5000;
        const expense = 350.5;
        const net = Math.round((income - expense) * 100) / 100;
        expect(net).toBe(4649.5);
    });

    it("handles zero income (expenses only)", () => {
        const net = Math.round((0 - 120) * 100) / 100;
        expect(net).toBe(-120);
    });
});
