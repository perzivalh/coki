// Unit tests: Skills and IntentRouter (Sprint 0 + 01 compatible)
// Note: Sprint 01 replaced FinanceSkill class with handleFinanceMessage function.
// These tests validate the Tasks and Docs skill stubs and IntentRouter directly.
import { describe, it, expect } from "vitest";
import { TasksSkill } from "@/skills/tasks/tasks.skill";
import { DocsSkill } from "@/skills/docs/docs.skill";
import { IntentRouter } from "@/application/services/intent-router";
import { parseWithRegex } from "@/application/services/finance-parser";

const ctx = { message: "test", senderNumber: "+1234567890" };

describe("parseWithRegex (Finance)", () => {
    it("detects expense type by default", () => {
        expect(parseWithRegex("35 almuerzo").type).toBe("expense");
    });
    it("detects income type", () => {
        expect(parseWithRegex("ingreso 500 sueldo").type).toBe("income");
    });
    it("extracts amount", () => {
        expect(parseWithRegex("35 almuerzo").amount_bs).toBe(35);
    });
});

describe("TasksSkill", () => {
    const skill = new TasksSkill();
    it("has correct name", () => expect(skill.name).toBe("tasks"));
    it("matches tasks keywords", () => expect(skill.canHandle("nueva tarea pendiente")).toBe(true));
    it("does not match non-task text", () => expect(skill.canHandle("hola")).toBe(false));
    it("returns a reply stub", async () => {
        const result = await skill.handle(ctx);
        expect(typeof result.reply).toBe("string");
    });
});

describe("DocsSkill", () => {
    const skill = new DocsSkill();
    it("has correct name", () => expect(skill.name).toBe("docs"));
    it("matches docs keywords", () => expect(skill.canHandle("guardar documento")).toBe(true));
    it("returns a reply stub", async () => {
        const result = await skill.handle(ctx);
        expect(typeof result.reply).toBe("string");
    });
});

describe("IntentRouter", () => {
    it("returns unknown for unmatched messages", () => {
        const router = new IntentRouter();
        router.register(new TasksSkill());
        expect(router.resolveIntent("hello world")).toBe("unknown");
    });

    it("routes tasks skill correctly", () => {
        const router = new IntentRouter();
        router.register(new TasksSkill());
        expect(router.resolveIntent("nueva tarea")).toBe("tasks");
    });
});
