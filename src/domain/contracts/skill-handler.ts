// Domain Contracts: Skill handler interface

export type IntentName = "finance" | "tasks" | "docs" | "unknown";

export interface SkillContext {
    message: string;
    senderNumber: string;
    metadata?: Record<string, unknown>;
}

export interface SkillResult {
    reply: string;
    data?: Record<string, unknown>;
}

export interface ISkillHandler {
    readonly name: IntentName;
    canHandle(message: string): boolean;
    handle(ctx: SkillContext): Promise<SkillResult>;
}
