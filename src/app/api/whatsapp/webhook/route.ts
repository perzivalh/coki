// API Route: GET /api/whatsapp/webhook (verify) + POST (ingest + process)
// Sprint 2.5: handles interactive replies, audio/image drafts, and draft-pending flow
import { NextRequest, NextResponse } from "next/server";
import { ingestWhatsAppMessage } from "@/application/use-cases/ingest-whatsapp-message";
import type { WhatsAppPayload } from "@/application/use-cases/ingest-whatsapp-message";
import { SupabaseMessageRepository } from "@/infrastructure/db/supabase/message.repository";
import { SupabaseDraftTransactionRepository } from "@/infrastructure/db/supabase/draft-transaction.repository";
import { ConversationOrchestrator } from "@/application/services/conversation-orchestrator";
import { DraftManager } from "@/application/services/draft-manager";
import { completeDraftTransaction } from "@/application/services/draft-finalizer";
import {
    SupabaseCategoryRepository,
    SupabaseAccountRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { SupabaseCategoryAliasRepository } from "@/infrastructure/db/supabase/category-alias.repository";
import { sendWhatsAppMessage } from "@/application/services/whatsapp-sender";
import { supabaseService } from "@/infrastructure/db/supabase/client";

export const runtime = "nodejs";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "coki_verify_token";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return new NextResponse(challenge ?? "", { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as WhatsAppPayload;
        const messageRepo = new SupabaseMessageRepository();
        const { count } = await ingestWhatsAppMessage(payload, messageRepo);

        if (count === 0) return NextResponse.json({ ok: true });

        const messages =
            payload.entry?.flatMap(
                (e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []
            ) ?? [];

        for (const msg of messages) {
            const from = msg.from;

            const { data: savedMsg } = await supabaseService
                .from("inbound_messages")
                .select("id")
                .eq("wa_message_id", msg.id)
                .single();

            const inboundMessageId = savedMsg?.id ?? "";

            // CASE 1: Interactive reply (button or list selection)
            if (msg.type === "interactive") {
                await handleInteractiveReply(msg, from, inboundMessageId);
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-draft" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            // CASE 2: Audio message
            if (msg.type === "audio") {
                await handleMediaMessage("audio", msg.audio?.id ?? "", from);
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-draft" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            // CASE 3: Image message
            if (msg.type === "image") {
                await handleMediaMessage("image", msg.image?.id ?? "", from);
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-draft" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            // CASE 4: Text message
            if (msg.type !== "text" || !msg.text?.body) continue;
            const text = msg.text.body.trim();

            const orchestrator = new ConversationOrchestrator();
            const intent = await orchestrator.process({ text, from, inboundMessageId });
            await supabaseService
                .from("inbound_messages")
                .update({ skill: `conversation:${intent}` })
                .eq("wa_message_id", msg.id);
        }
    } catch (err) {
        console.error("[WhatsApp] Error processing webhook:", err);
    }

    return NextResponse.json({ ok: true });
}

async function handleInteractiveReply(
    msg: {
        id: string;
        interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
        };
    },
    from: string,
    inboundMessageId: string,
): Promise<void> {
    const selectedId =
        msg.interactive?.button_reply?.id ??
        msg.interactive?.list_reply?.id;

    if (!selectedId) return;

    const draftRepo = new SupabaseDraftTransactionRepository();

    if (selectedId === "new_transaction") {
        const pending = await draftRepo.findPendingForUser(from);
        if (pending) await draftRepo.markAbandoned(pending.id);
        await sendWhatsAppMessage(from, "Listo. Enviame el nuevo gasto o ingreso.");
        return;
    }

    if (selectedId === "continue_pending") {
        const context = await draftRepo.findByStepContext(from);
        if (!context) {
            await sendWhatsAppMessage(from, "No hay registro pendiente para continuar.");
            return;
        }
        const manager = new DraftManager(
            draftRepo,
            new SupabaseCategoryRepository(),
            new SupabaseAccountRepository(),
        );
        await manager.resendQuestion(context.draft, context.step, from);
        return;
    }

    if (selectedId.startsWith("balance_")) {
        const accountId = selectedId.replace("balance_", "");
        const accountRepo = new SupabaseAccountRepository();
        const account = await accountRepo.findById(accountId);
        if (!account) {
            await sendWhatsAppMessage(from, "No encontre esa cuenta.");
            return;
        }
        const balanceRepo = new SupabaseAccountBalanceRepository();
        const balance = await balanceRepo.findByAccountId(accountId);
        await sendWhatsAppMessage(
            from,
            `Saldo ${account.name}: ${Number(balance?.balance_bs ?? 0).toFixed(2)} Bs`,
        );
        return;
    }

    const context = await draftRepo.findByStepContext(from);

    if (!context) {
        await sendWhatsAppMessage(from, "No encontre registro pendiente. Envia un mensaje nuevo.");
        return;
    }

    const { draft, step } = context;
    const catRepo = new SupabaseCategoryRepository();
    const accRepo = new SupabaseAccountRepository();
    const aliasRepo = new SupabaseCategoryAliasRepository();
    const draftManager = new DraftManager(draftRepo, catRepo, accRepo, aliasRepo);

    const result = await draftManager.handleReply(draft, step, selectedId, from);

    if ("completed" in result && result.completed) {
        await completeDraftTransaction(result.transactionInput, from, inboundMessageId);
    }
}

async function handleMediaMessage(
    kind: "audio" | "image",
    providerMediaId: string,
    from: string,
): Promise<void> {
    console.log(`[WhatsApp] ${kind} ignored for now, providerMediaId=${providerMediaId}`);
    await sendWhatsAppMessage(
        from,
        "Por ahora proceso solo texto. Enviame el gasto o ingreso escrito y lo registro.",
    );
}
