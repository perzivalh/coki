import { describe, test, expect, vi } from "vitest";
import { DraftManager } from "./draft-manager";
import type { IDraftTransactionRepository, ICategoryRepository, IAccountRepository, ICategoryAliasRepository } from "@/domain/contracts/finance";
import type { DraftTransaction, BotPendingStep } from "@/domain/entities/draft-transaction";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";
import type { AccountWithBalance } from "@/domain/entities/account-balance";

function mockDraft(overrides: Partial<DraftTransaction> = {}): DraftTransaction {
    return {
        id: "draft-1",
        raw_input: "35 almuerzo",
        from_number: "+591123456",
        parsed_json: { type: "expense", amount_bs: 35, note: "almuerzo" },
        missing_fields: ["category", "account"],
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

function mockStep(step_type: BotPendingStep["step_type"], overrides: Partial<BotPendingStep> = {}): BotPendingStep {
    return {
        id: "step-1",
        draft_id: "draft-1",
        step_type,
        message_context: { from: "+591123456" },
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

function mockCategory(id: string, name: string, slug = name.toLowerCase()): Category {
    return { id, name, slug, icon: null, active: true, created_at: "" };
}

function mockAccount(id: string, name: string, slug = name.toLowerCase()): Account {
    return { id, name, slug, active: true, created_at: "" };
}

function makeDraftRepo(draft: DraftTransaction): IDraftTransactionRepository {
    const steps: BotPendingStep[] = [];
    return {
        create: vi.fn().mockResolvedValue(draft),
        findPendingForUser: vi.fn().mockResolvedValue(draft),
        updateParsed: vi.fn().mockImplementation((_id: string, json: Record<string, unknown>, missing: string[]) =>
            Promise.resolve({ ...draft, parsed_json: json, missing_fields: missing })),
        markComplete: vi.fn().mockResolvedValue({ ...draft, status: "complete" }),
        markAbandoned: vi.fn().mockResolvedValue({ ...draft, status: "abandoned" }),
        getPendingStep: vi.fn().mockImplementation((draft_id: string) =>
            Promise.resolve(steps.find((s) => s.draft_id === draft_id) ?? null)),
        addPendingStep: vi.fn().mockImplementation((draft_id: string, step_type: BotPendingStep["step_type"], message_context: { from: string }) => {
            const step = mockStep(step_type, { draft_id, message_context });
            steps.push(step);
            return Promise.resolve(step);
        }),
        deletePendingStep: vi.fn().mockResolvedValue(undefined),
        findByStepContext: vi.fn().mockResolvedValue(null),
    };
}

function makeCatRepo(categories: Category[]): ICategoryRepository {
    return {
        findAll: vi.fn().mockResolvedValue(categories),
        findBySlug: vi.fn().mockImplementation((slug: string) =>
            Promise.resolve(categories.find((c) => c.slug === slug) ?? null)),
        findById: vi.fn().mockImplementation((id: string) =>
            Promise.resolve(categories.find((c) => c.id === id) ?? null)),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };
}

function makeAccRepo(accounts: Account[]): IAccountRepository {
    return {
        findAll: vi.fn().mockResolvedValue(accounts),
        findBySlug: vi.fn().mockImplementation((slug: string) =>
            Promise.resolve(accounts.find((a) => a.slug === slug) ?? null)),
        findById: vi.fn().mockImplementation((id: string) =>
            Promise.resolve(accounts.find((a) => a.id === id) ?? null)),
        findDefault: vi.fn().mockResolvedValue(accounts[0]),
        create: vi.fn(),
        update: vi.fn(),
        findAllWithBalances: vi.fn().mockResolvedValue(accounts.map((a) => ({ ...a, balance: null }) as AccountWithBalance)),
    };
}

describe("DraftManager.getMissingFields", () => {
    const manager = new DraftManager(makeDraftRepo(mockDraft()), makeCatRepo([]), makeAccRepo([]));

    test("returns category and account when both missing for expense", () => {
        const missing = manager.getMissingFields({ type: "expense", amount_bs: 35 });
        expect(missing).toContain("category");
        expect(missing).toContain("account");
    });

    test("does not require category for income", () => {
        const missing = manager.getMissingFields({ type: "income", amount_bs: 100 });
        expect(missing).not.toContain("category");
        expect(missing).toContain("account");
    });
});

describe("DraftManager.handleReply", () => {
    test("moves from category to account", async () => {
        const cat = mockCategory("cat-1", "Comida", "comida");
        const acc = mockAccount("acc-1", "Efectivo", "cash");
        const draft = mockDraft({
            parsed_json: { type: "expense", amount_bs: 35, note: "almuerzo", account_id: null },
            missing_fields: ["category", "account"],
        });
        const step = mockStep("ask_category");

        const manager = new DraftManager(makeDraftRepo(draft), makeCatRepo([cat]), makeAccRepo([acc]));
        const result = await manager.handleReply(draft, step, "cat-1", "+591123456");
        expect("completed" in result).toBe(false);
        if (!("completed" in result)) expect(result.step.step_type).toBe("ask_account");
    });

    test("completes when account is last missing field", async () => {
        const acc = mockAccount("acc-1", "Efectivo", "cash");
        const draft = mockDraft({
            parsed_json: { type: "expense", amount_bs: 35, category_id: "cat-1", account_id: null },
            missing_fields: ["account"],
        });
        const step = mockStep("ask_account");

        const manager = new DraftManager(makeDraftRepo(draft), makeCatRepo([]), makeAccRepo([acc]));
        const result = await manager.handleReply(draft, step, "acc-1", "+591123456");
        expect("completed" in result).toBe(true);
        if ("completed" in result && result.completed) {
            expect(result.transactionInput.account_id).toBe("acc-1");
            expect(result.transactionInput.amount_bs).toBe(35);
        }
    });
});

describe("DraftManager.handleTextReply", () => {
    test("matches account by alias text", async () => {
        const acc = mockAccount("acc-1", "Efectivo", "cash");
        const draft = mockDraft({
            parsed_json: { type: "expense", amount_bs: 20, category_id: "cat-1", account_id: null },
            missing_fields: ["account"],
        });
        const step = mockStep("ask_account");

        const manager = new DraftManager(makeDraftRepo(draft), makeCatRepo([]), makeAccRepo([acc]));
        const result = await manager.handleTextReply(draft, step, "pague en efectivo", "+591123456");

        expect(result.handled).toBe(true);
        expect(result.result).toBeTruthy();
    });
});

describe("DraftManager alias learning", () => {
    test("learns aliases when category is selected manually", async () => {
        const cat = mockCategory("cat-1", "Comida", "comida");
        const acc = mockAccount("acc-1", "Efectivo", "cash");
        const draft = mockDraft({
            raw_input: "3bs papel efectivo",
            parsed_json: { type: "expense", amount_bs: 3, note: "papel", account_id: "acc-1" },
            missing_fields: ["category"],
        });
        const step = mockStep("ask_category");

        const aliasRepo: ICategoryAliasRepository = {
            upsertAlias: vi.fn().mockResolvedValue({
                id: "alias-1",
                category_id: "cat-1",
                alias_text: "papel",
                normalized_alias: "papel",
                source: "draft_category_selection",
                usage_count: 1,
                created_at: "",
                updated_at: "",
                last_seen_at: "",
            }),
            listByCategoryIds: vi.fn().mockResolvedValue([]),
        };

        const manager = new DraftManager(makeDraftRepo(draft), makeCatRepo([cat]), makeAccRepo([acc]), aliasRepo);
        await manager.handleReply(draft, step, "cat-1", "+591123456");

        expect(aliasRepo.upsertAlias).toHaveBeenCalled();
    });
});
