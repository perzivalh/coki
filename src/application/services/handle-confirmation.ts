import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import { sendWhatsAppMessage } from "@/application/services/whatsapp-sender";
import { isNegativeConfirmation, isPositiveConfirmation } from "./conversation-intent";
import { BalanceLedgerService } from "./balance-ledger";

export async function handleConfirmationMessage(text: string, from: string): Promise<boolean> {
    const isYes = isPositiveConfirmation(text);
    const isNo = isNegativeConfirmation(text);
    if (!isYes && !isNo) return false;

    const txRepo = new SupabaseTransactionRepository();
    const pendingTx = await txRepo.findLatestPendingForSourceAndSender("whatsapp", from);
    if (!pendingTx) return false;

    if (pendingTx.confirmation_expires_at) {
        const expiresAt = new Date(pendingTx.confirmation_expires_at).getTime();
        if (Date.now() > expiresAt) {
            await txRepo.update(pendingTx.id, { status: "cancelled" });
            await sendWhatsAppMessage(from, "La confirmacion expiro. Transaccion cancelada.");
            return true;
        }
    }

    if (isYes) {
        const updated = await txRepo.update(pendingTx.id, { status: "confirmed" });
        try {
            const balanceRepo = new SupabaseAccountBalanceRepository();
            await BalanceLedgerService.applyOnStatusTransition(
                pendingTx,
                updated,
                balanceRepo,
            );
        } catch (err) {
            console.error("[Confirmation] Failed to adjust balance:", err);
        }
        await sendWhatsAppMessage(
            from,
            `Confirmado. ${updated.type === "income" ? "Ingreso" : "Gasto"} de ${updated.amount_bs.toFixed(2)} Bs guardado.`,
        );
        return true;
    }

    await txRepo.update(pendingTx.id, { status: "cancelled" });
    await sendWhatsAppMessage(from, "Transaccion cancelada.");
    return true;
}
