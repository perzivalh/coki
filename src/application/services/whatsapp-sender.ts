// Application Service: WhatsApp Message Sender
// Wrapper for Meta WhatsApp Cloud API send message.

const WA_API_VERSION = "v19.0";

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        console.warn("[WA Sender] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID — skipping send");
        return;
    }

    const res = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: text, preview_url: false },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        console.error("[WA Sender] Failed to send message:", err);
    }
}
