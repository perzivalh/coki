// Unit tests: Skills (SkillHandler contract)
import { describe, it, expect } from "vitest";
import { FinanceSkill } from "@/skills/finance/finance.skill";
import { TasksSkill } from "@/skills/tasks/tasks.skill";
import { DocsSkill } from "@/skills/docs/docs.skill";
import { IntentRouter } from "@/application/services/intent-router";

const ctx = { message: "test", senderNumber: "+1234567890" };

describe("FinanceSkill", () => {
    const skill = new FinanceSkill();

    it("has correct name", () => expect(skill.name).toBe("finance"));
    it("matches finance keywords", () => {
        expect(skill.canHandle("cuanto es mi saldo")).toBe(true);
        expect(skill.canHandle("hola amigo")).toBe(false);
    });
    it("returns a reply stub", async () => {
        const result = await skill.handle(ctx);
        expect(typeof result.reply).toBe("string");
    });
});

describe("TasksSkill", () => {
    const skill = new TasksSkill();
    it("matches tasks keywords", () => expect(skill.canHandle("nueva tarea pendiente")).toBe(true));
});

describe("DocsSkill", () => {
    const skill = new DocsSkill();
    it("matches docs keywords", () => expect(skill.canHandle("guardar documento")).toBe(true));
});

describe("IntentRouter", () => {
    it("routes to the correct skill", async () => {
        const router = new IntentRouter();
        router.register(new FinanceSkill());
        router.register(new TasksSkill());
        router.register(new DocsSkill());

        const intent = router.resolveIntent("mi saldo actual");
        expect(intent).toBe("finance");
    });

    it("returns unknown for unmatched messages", async () => {
        const router = new IntentRouter();
        router.register(new FinanceSkill());
        const intent = router.resolveIntent("hello world");
        expect(intent).toBe("unknown");
    });

    it("returns a reply for matched message", async () => {
        const router = new IntentRouter();
        router.register(new FinanceSkill());
        const result = await router.route({ ...ctx, message: "mi gasto del mes" });
        expect(typeof result.reply).toBe("string");
    });
});
