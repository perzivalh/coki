// Skill Stub: Docs
// Sprint 0 scaffold only — no business logic implemented.
import type { ISkillHandler, SkillContext, SkillResult } from "@/domain/contracts";

export class DocsSkill implements ISkillHandler {
    readonly name = "docs" as const;

    canHandle(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes("documento") || lower.includes("nota") || lower.includes("archivo");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async handle(_ctx: SkillContext): Promise<SkillResult> {
        // TODO Sprint 1: implement docs skill logic
        return { reply: "[Docs skill — not yet implemented]" };
    }
}
