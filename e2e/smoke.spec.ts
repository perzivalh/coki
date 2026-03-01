// E2E Tests: Login page + OpenAPI endpoint
import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
    test("renders the login form", async ({ page }) => {
        await page.goto("/login");
        await expect(page.locator("h1")).toContainText("Coki");
        await expect(page.locator("#pin-input")).toBeVisible();
        await expect(page.locator("#login-submit")).toBeVisible();
    });

    test("shows error for short PIN", async ({ page }) => {
        await page.goto("/login");
        await page.locator("#pin-input").fill("12");
        await page.locator("#login-submit").click();
        // Toast appears
        await expect(page.getByRole("alert")).toBeVisible();
    });
});

test.describe("API: /api/hello", () => {
    test("returns 200 and ok:true", async ({ request }) => {
        const res = await request.get("/api/hello");
        expect(res.status()).toBe(200);
        const body = await res.json() as { ok: boolean };
        expect(body.ok).toBe(true);
    });
});

test.describe("API: /api/openapi", () => {
    test("returns valid OpenAPI JSON", async ({ request }) => {
        const res = await request.get("/api/openapi");
        expect(res.status()).toBe(200);
        const body = await res.json() as { openapi: string; paths: Record<string, unknown> };
        expect(body.openapi).toMatch(/^3\./);
        expect(body.paths["/hello"]).toBeDefined();
        expect(body.paths["/auth/login"]).toBeDefined();
        expect(body.paths["/whatsapp/webhook"]).toBeDefined();
    });
});
