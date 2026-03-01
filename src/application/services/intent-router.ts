// Intent Router: routes incoming WhatsApp messages to the correct SkillHandler
import type { ISkillHandler, IntentName, SkillContext, SkillResult } from "@/domain/contracts";

export class IntentRouter {
    private readonly handlers: ISkillHandler[] = [];

    register(handler: ISkillHandler): void {
        this.handlers.push(handler);
    }

    async route(ctx: SkillContext): Promise<SkillResult> {
        const handler = this.handlers.find((h) => h.canHandle(ctx.message));
        if (!handler) {
            return { reply: "No skill handler found for this message." };
        }
        return handler.handle(ctx);
    }

    resolveIntent(message: string): IntentName {
        const handler = this.handlers.find((h) => h.canHandle(message));
        return handler?.name ?? "unknown";
    }
}
