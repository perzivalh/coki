"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SummaryCard, TransactionRow, EmptyState } from "@/ui";
import styles from "./page.module.css";
import type { TransactionWithRelations } from "@/domain/entities/transaction";
import type { FinanceSummary } from "@/domain/contracts/finance";
import type { AccountWithBalance } from "@/domain/entities/account-balance";

export default function TodayPage() {
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [recent, setRecent] = useState<TransactionWithRelations[]>([]);
    const [dailyLimit, setDailyLimit] = useState<number | null>(null);
    const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryRes, txRes, budgetRes, accountsRes] = await Promise.all([
                fetch("/api/finance/summary?range=today"),
                fetch("/api/finance/transactions?limit=5"),
                fetch("/api/finance/budget"),
                fetch("/api/finance/accounts"),
            ]);
            if (summaryRes.ok) setSummary(await summaryRes.json() as FinanceSummary);
            if (txRes.ok) {
                const data = await txRes.json() as { data: TransactionWithRelations[] };
                setRecent(data.data ?? []);
            }
            if (budgetRes.ok) {
                const { budget } = await budgetRes.json() as { budget: { daily_free_bs: number } };
                setDailyLimit(budget?.daily_free_bs ?? null);
            }
            if (accountsRes.ok) {
                const data = await accountsRes.json() as AccountWithBalance[];
                setAccounts(data.filter((a) => a.active));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const today = new Date().toLocaleDateString("es-LA", {
        weekday: "long", day: "numeric", month: "long",
        timeZone: summary?.timezone ?? "America/La_Paz",
    });

    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance?.balance_bs ?? 0), 0);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <p className={styles.section}>DASHBOARD</p>
                <h1 className={styles.title}>
                    {loading ? "Cargando..." : `Hoy, ${today}`}
                </h1>
            </div>

            <div className={styles.cards}>
                <SummaryCard label="Gastos del Día" amount={-(summary?.total_expense_bs ?? 0)} variant="expense" icon="📉" />
                <SummaryCard label="Ingresos del Día" amount={summary?.total_income_bs ?? 0} variant="income" icon="📈" />
                <SummaryCard label="Neto del Día" amount={summary?.net_bs ?? 0} variant="dark" icon="💰" />
                {dailyLimit !== null && dailyLimit > 0 && (
                    <SummaryCard
                        label="Límite Diario — Restante"
                        amount={dailyLimit - (summary?.total_expense_bs ?? 0)}
                        variant={(dailyLimit - (summary?.total_expense_bs ?? 0)) >= 0 ? "income" : "expense"}
                        icon="🎯"
                    />
                )}
            </div>

            {/* Account balances — wallet view */}
            {!loading && accounts.length > 0 && (
                <div className={styles.section2}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Mis Cuentas</h2>
                        <span className={styles.viewAll}>Total: <strong>Bs {totalBalance.toFixed(2)}</strong></span>
                    </div>
                    <div className={styles.walletGrid}>
                        {accounts.map((acc) => (
                            <div key={acc.id} className={styles.walletCard}>
                                <div className={styles.walletIcon}>
                                    {acc.slug === "qr" ? "📱" : acc.slug === "cash" ? "💵" : "🏦"}
                                </div>
                                <div className={styles.walletInfo}>
                                    <p className={styles.walletName}>{acc.name}</p>
                                    <p className={styles.walletBalance}>
                                        Bs {(acc.balance?.balance_bs ?? 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.section2}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Actividad Reciente</h2>
                    <Link href="/dashboard/history" className={styles.viewAll}>Ver todo →</Link>
                </div>
                <div className={styles.activityList}>
                    {loading ? (
                        <div className={styles.skeleton}>
                            {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
                        </div>
                    ) : recent.length === 0 ? (
                        <EmptyState icon="📭" title="Sin transacciones hoy" message="Envía un mensaje por WhatsApp: '35 almuerzo' para registrar un gasto." />
                    ) : (
                        recent.map((tx) => (
                            <TransactionRow key={tx.id} transaction={tx} timezone={summary?.timezone ?? "America/La_Paz"} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
