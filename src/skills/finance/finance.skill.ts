// Skill Stub: Finance
// Sprint 0 scaffold only — no business logic implemented.
import type { ISkillHandler, SkillContext, SkillResult } from "@/domain/contracts";

export class FinanceSkill implements ISkillHandler {
    readonly name = "finance" as const;

    canHandle(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes("gasto") || lower.includes("saldo") || lower.includes("finanza");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async handle(_ctx: SkillContext): Promise<SkillResult> {
        // TODO Sprint 1: implement finance skill logic
        return { reply: "[Finance skill — not yet implemented]" };
    }
}
