// Application Service: Send WhatsApp Interactive Messages (Reply Buttons + List Messages)
// Meta Cloud API format: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-messages

const WA_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";

export interface ReplyButton {
    id: string;    // max 256 chars, used as payload
    title: string; // max 20 chars
}

export interface ListRow {
    id: string;
    title: string;       // max 24 chars
    description?: string;
}

export interface ListSection {
    title?: string;
    rows: ListRow[];
}

async function postToWhatsApp(payload: unknown): Promise<void> {
    if (!WA_TOKEN) {
        console.warn("[WA Interactive] No WHATSAPP_ACCESS_TOKEN set, skipping send");
        return;
    }
    const res = await fetch(WA_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WA_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[WA Interactive] Send error ${res.status}: ${text}`);
    }
}

/**
 * Send a reply buttons message (max 3 buttons).
 */
export async function sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: ReplyButton[],
): Promise<void> {
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: bodyText },
            action: {
                buttons: buttons.slice(0, 3).map((b) => ({
                    type: "reply",
                    reply: {
                        id: b.id.slice(0, 256),
                        title: b.title.slice(0, 20),
                    },
                })),
            },
        },
    };
    await postToWhatsApp(payload);
}

/**
 * Send a list message (up to 10 rows total across all sections).
 */
export async function sendInteractiveList(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: ListSection[],
): Promise<void> {
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: bodyText },
            action: {
                button: buttonLabel.slice(0, 20),
                sections: sections.map((s) => ({
                    title: s.title?.slice(0, 24),
                    rows: s.rows.slice(0, 10).map((r) => ({
                        id: r.id.slice(0, 256),
                        title: r.title.slice(0, 24),
                        description: r.description?.slice(0, 72),
                    })),
                })),
            },
        },
    };
    await postToWhatsApp(payload);
}
