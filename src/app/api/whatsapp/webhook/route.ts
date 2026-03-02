// API Route: GET /api/whatsapp/webhook (verify) + POST (ingest + process)
// Sprint 2.5: handles interactive replies, audio/image drafts, and draft-pending flow
import { NextRequest, NextResponse } from "next/server";
import { ingestWhatsAppMessage } from "@/application/use-cases/ingest-whatsapp-message";
import type { WhatsAppPayload } from "@/application/use-cases/ingest-whatsapp-message";
import { SupabaseMessageRepository } from "@/infrastructure/db/supabase/message.repository";
import { handleFinanceMessage } from "@/skills/finance/finance.skill";
import { handleConfirmationMessage } from "@/application/services/handle-confirmation";
import { DraftManager } from "@/application/services/draft-manager";
import { SupabaseDraftTransactionRepository } from "@/infrastructure/db/supabase/draft-transaction.repository";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import {
    SupabaseCategoryRepository,
    SupabaseAccountRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import { sendWhatsAppMessage } from "@/application/services/whatsapp-sender";
import { sendInteractiveButtons } from "@/application/services/whatsapp-interactive";
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
                await handleMediaMessage("audio", msg.audio?.id ?? "", from, inboundMessageId);
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-draft" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            // CASE 3: Image message
            if (msg.type === "image") {
                await handleMediaMessage("image", msg.image?.id ?? "", from, inboundMessageId);
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-draft" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            // CASE 4: Text message
            if (msg.type !== "text" || !msg.text?.body) continue;
            const text = msg.text.body.trim();

            // Abandon any pending draft and start fresh with new message
            const draftRepo = new SupabaseDraftTransactionRepository();
            const pendingDraft = await draftRepo.findPendingForUser();
            if (pendingDraft) {
                await draftRepo.markAbandoned(pendingDraft.id);
                await sendWhatsAppMessage(from, "Proceso tu nuevo mensaje.");
            }

            // Check SI/NO confirmation for budget-exceeded transaction
            const handledAsConfirmation = await handleConfirmationMessage(text, from);
            if (handledAsConfirmation) {
                await supabaseService
                    .from("inbound_messages")
                    .update({ skill: "finance-confirmation" })
                    .eq("wa_message_id", msg.id);
                continue;
            }

            await supabaseService
                .from("inbound_messages")
                .update({ skill: "finance" })
                .eq("wa_message_id", msg.id);

            await handleFinanceMessage({ text, from, inboundMessageId });
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
    const context = await draftRepo.findByStepContext(from);

    if (!context) {
        await sendWhatsAppMessage(from, "No encontre registro pendiente. Envia un mensaje nuevo.");
        return;
    }

    const { draft, step } = context;
    const catRepo = new SupabaseCategoryRepository();
    const accRepo = new SupabaseAccountRepository();
    const draftManager = new DraftManager(draftRepo, catRepo, accRepo);

    const result = await draftManager.handleReply(draft, step, selectedId, from);

    if ("completed" in result && result.completed) {
        const txRepo = new SupabaseTransactionRepository();
        await txRepo.create({
            ...result.transactionInput,
            inbound_message_id: inboundMessageId,
        });
    }
}

async function handleMediaMessage(
    kind: "audio" | "image",
    providerMediaId: string,
    from: string,
    _inboundMessageId: string,
): Promise<void> {
    const draftRepo = new SupabaseDraftTransactionRepository();

    const existing = await draftRepo.findPendingForUser();
    if (existing) await draftRepo.markAbandoned(existing.id);

    const draft = await draftRepo.create({
        raw_input: `${kind}:${providerMediaId}`,
        parsed_json: {},
        missing_fields: ["type", "amount", "category", "account"],
    });

    await supabaseService.from("attachments").insert({
        draft_id: draft.id,
        kind,
        provider_media_id: providerMediaId,
    });

    await draftRepo.addPendingStep(draft.id, "ask_type", { from });

    const label = kind === "audio" ? "audio" : "foto";
    await sendInteractiveButtons(
        from,
        `Recibi tu ${label}. Es un gasto o ingreso?`,
        [
            { id: "expense", title: "Gasto" },
            { id: "income", title: "Ingreso" },
        ],
    );
}
