// Unit tests: DraftManager — state machine
import { describe, test, expect, vi } from "vitest";
import { DraftManager } from "./draft-manager";
import type { IDraftTransactionRepository, ICategoryRepository, IAccountRepository } from "@/domain/contracts/finance";
import type { DraftTransaction, BotPendingStep } from "@/domain/entities/draft-transaction";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";
import type { AccountWithBalance } from "@/domain/entities/account-balance";

// ── Mock factories ────────────────────────────────────────────────────────────

function mockDraft(overrides: Partial<DraftTransaction> = {}): DraftTransaction {
    return {
        id: "draft-1",
        raw_input: "35 almuerzo",
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

function mockCategory(id: string, name: string): Category {
    return { id, name, slug: name.toLowerCase(), icon: null, active: true, created_at: "" };
}

function mockAccount(id: string, name: string): Account {
    return { id, name, slug: name.toLowerCase(), active: true, created_at: "" };
}

// ── Mock repositories ─────────────────────────────────────────────────────────

function makeDraftRepo(draft: DraftTransaction): IDraftTransactionRepository {
    const steps: BotPendingStep[] = [];
    return {
        create: vi.fn().mockResolvedValue(draft),
        findPendingForUser: vi.fn().mockResolvedValue(draft),
        updateParsed: vi.fn().mockImplementation((id: string, json: Record<string, unknown>, missing: string[]) =>
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DraftManager.getMissingFields", () => {
    const manager = new DraftManager(
        makeDraftRepo(mockDraft()),
        makeCatRepo([]),
        makeAccRepo([]),
    );

    test("returns category and account when both missing for expense", () => {
        const missing = manager.getMissingFields({ type: "expense", amount_bs: 35 });
        expect(missing).toContain("category");
        expect(missing).toContain("account");
    });

    test("returns only account when category is present", () => {
        const missing = manager.getMissingFields({ type: "expense", amount_bs: 35, category_id: "cat-1" });
        expect(missing).not.toContain("category");
        expect(missing).toContain("account");
    });

    test("does not require category for income", () => {
        const missing = manager.getMissingFields({ type: "income", amount_bs: 100 });
        expect(missing).not.toContain("category");
        expect(missing).toContain("account");
    });

    test("returns empty when all fields present", () => {
        const missing = manager.getMissingFields({ type: "expense", amount_bs: 35, category_id: "cat-1", account_id: "acc-1" });
        expect(missing).toHaveLength(0);
    });

    test("returns type when type missing", () => {
        const missing = manager.getMissingFields({ amount_bs: 35 });
        expect(missing).toContain("type");
    });
});

describe("DraftManager.handleReply — ask_category step", () => {
    test("resolves category and moves to ask_account", async () => {
        const cat = mockCategory("cat-1", "Comida");
        const acc = mockAccount("acc-1", "Efectivo");
        const draft = mockDraft({
            parsed_json: { type: "expense", amount_bs: 35, note: "almuerzo", account_id: null },
            missing_fields: ["category", "account"],
        });
        const step = mockStep("ask_category");

        const draftRepo = makeDraftRepo(draft);
        const catRepo = makeCatRepo([cat]);
        const accRepo = makeAccRepo([acc]);
        const manager = new DraftManager(draftRepo, catRepo, accRepo);

        const result = await manager.handleReply(draft, step, "cat-1", "+591123456");

        expect("completed" in result).toBe(false);
        if (!("completed" in result)) {
            expect(result.step.step_type).toBe("ask_account");
        }
        expect(draftRepo.deletePendingStep).toHaveBeenCalledWith(step.id);
    });
});

describe("DraftManager.handleReply — ask_account step (completes draft)", () => {
    test("completes draft when account is the last missing field", async () => {
        const acc = mockAccount("acc-1", "Efectivo");
        const draft = mockDraft({
            parsed_json: { type: "expense", amount_bs: 35, category_id: "cat-1", account_id: null },
            missing_fields: ["account"],
        });
        const step = mockStep("ask_account");

        const draftRepo = makeDraftRepo(draft);
        const catRepo = makeCatRepo([]);
        const accRepo = makeAccRepo([acc]);
        const manager = new DraftManager(draftRepo, catRepo, accRepo);

        const result = await manager.handleReply(draft, step, "acc-1", "+591123456");

        expect("completed" in result).toBe(true);
        if ("completed" in result && result.completed) {
            expect(result.transactionInput.account_id).toBe("acc-1");
            expect(result.transactionInput.type).toBe("expense");
            expect(result.transactionInput.amount_bs).toBe(35);
        }
        expect(draftRepo.markComplete).toHaveBeenCalledWith(draft.id);
    });
});
