// Skill Stub: Tasks
// Sprint 0 scaffold only — no business logic implemented.
import type { ISkillHandler, SkillContext, SkillResult } from "@/domain/contracts";

export class TasksSkill implements ISkillHandler {
    readonly name = "tasks" as const;

    canHandle(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes("tarea") || lower.includes("pendiente") || lower.includes("recordatorio");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async handle(_ctx: SkillContext): Promise<SkillResult> {
        // TODO Sprint 1: implement tasks skill logic
        return { reply: "[Tasks skill — not yet implemented]" };
    }
}
