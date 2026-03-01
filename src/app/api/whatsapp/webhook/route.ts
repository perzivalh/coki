// API Route: GET /api/whatsapp/webhook — verification
// API Route: POST /api/whatsapp/webhook — message ingestion
import { NextRequest, NextResponse } from "next/server";
import { ingestWhatsAppMessage } from "@/application/use-cases/ingest-whatsapp-message";
import type { WhatsAppPayload } from "@/application/use-cases/ingest-whatsapp-message";
import { SupabaseMessageRepository } from "@/infrastructure/db/supabase/message.repository";

export const runtime = "nodejs";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "coki_verify_token";

// GET: Facebook webhook verification handshake
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("[WhatsApp] Webhook verified");
        return new NextResponse(challenge ?? "", { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: receive incoming messages and log to DB
export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as WhatsAppPayload;
        console.log("[WhatsApp] Incoming payload received");

        const messageRepo = new SupabaseMessageRepository();
        const { count } = await ingestWhatsAppMessage(payload, messageRepo);

        return NextResponse.json({ ok: true, ingested: count });
    } catch (err) {
        console.error("[WhatsApp] Error processing webhook:", err);
        // Always return 200 to WhatsApp to prevent retries
        return NextResponse.json({ ok: true });
    }
}
