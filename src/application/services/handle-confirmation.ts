// Application Service: Handle WhatsApp Confirmations
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { sendWhatsAppMessage } from "@/application/services/whatsapp-sender";

export async function handleConfirmationMessage(text: string, from: string): Promise<boolean> {
    const normalized = text.trim().toLowerCase();
    const isYes = normalized === "si" || normalized === "sí";
    const isNo = normalized === "no";

    if (!isYes && !isNo) {
        return false; // Not a confirmation message
    }

    const txRepo = new SupabaseTransactionRepository();
    const pendingTx = await txRepo.findLatestPendingForSource("whatsapp");

    if (!pendingTx) {
        return false; // No pending transaction found
    }

    // Check expiration
    if (pendingTx.confirmation_expires_at) {
        const expiresAt = new Date(pendingTx.confirmation_expires_at).getTime();
        const now = new Date().getTime();
        if (now > expiresAt) {
            await txRepo.update(pendingTx.id, { status: "cancelled" });
            await sendWhatsAppMessage(from, "⏳ La solicitud de confirmación ha expirado. Gasto cancelado.");
            return true;
        }
    }

    if (isYes) {
        await txRepo.update(pendingTx.id, { status: "confirmed" });
        await sendWhatsAppMessage(from, `✅ Confirmado. Gasto de ${pendingTx.amount_bs.toFixed(2)} Bs guardado (excediendo límites).`);
    } else {
        await txRepo.update(pendingTx.id, { status: "cancelled" });
        await sendWhatsAppMessage(from, "🚫 Gasto cancelado. No se sumará a los totales.");
    }

    return true; // Handled
}
