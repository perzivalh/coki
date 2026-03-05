import type { CreateTransactionInput } from "@/domain/contracts/finance";
import { SupabaseTransactionRepository } from "@/infrastructure/db/supabase/transaction.repository";
import { SupabaseAccountBalanceRepository } from "@/infrastructure/db/supabase/account-balance.repository";
import {
    SupabaseAccountRepository,
    SupabaseCategoryRepository,
} from "@/infrastructure/db/supabase/category-account.repository";
import { BalanceLedgerService } from "./balance-ledger";
import { sendWhatsAppMessage } from "./whatsapp-sender";

export async function completeDraftTransaction(
    input: CreateTransactionInput,
    from: string,
    inboundMessageId: string,
): Promise<void> {
    const txRepo = new SupabaseTransactionRepository();
    const tx = await txRepo.create({
        ...input,
        source: "whatsapp",
        inbound_message_id: input.inbound_message_id ?? inboundMessageId,
        from_number: from,
        status: input.status ?? "confirmed",
    });

    try {
        const balanceRepo = new SupabaseAccountBalanceRepository();
        await BalanceLedgerService.applyOnCreate(tx, balanceRepo);
    } catch (err) {
        console.error("[DraftFinalizer] Failed to adjust balance:", err);
    }

    const accRepo = new SupabaseAccountRepository();
    const catRepo = new SupabaseCategoryRepository();
    const [account, category] = await Promise.all([
        accRepo.findById(tx.account_id),
        tx.category_id ? catRepo.findById(tx.category_id) : Promise.resolve(null),
    ]);

    const amount = Number(tx.amount_bs).toFixed(2);
    await sendWhatsAppMessage(
        from,
        `Registrado: ${tx.type === "income" ? "Ingreso" : "Gasto"} ${amount} Bs\nCategoria: ${category?.name ?? "Sin categoria"}\nCuenta: ${account?.name ?? "-"}`,
    );
}
