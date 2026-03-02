"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SummaryCard, TransactionRow, EmptyState } from "@/ui";
import styles from "./page.module.css";
import type { TransactionWithRelations } from "@/domain/entities/transaction";
import type { FinanceSummary } from "@/domain/contracts/finance";

export default function TodayPage() {
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [recent, setRecent] = useState<TransactionWithRelations[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryRes, txRes] = await Promise.all([
                fetch("/api/finance/summary?range=today"),
                fetch("/api/finance/transactions?limit=5"),
            ]);
            if (summaryRes.ok) setSummary(await summaryRes.json() as FinanceSummary);
            if (txRes.ok) {
                const data = await txRes.json() as { data: TransactionWithRelations[] };
                setRecent(data.data ?? []);
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

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <p className={styles.section}>DASHBOARD</p>
                <h1 className={styles.title}>
                    {loading ? "Cargando..." : `Hoy, ${today}`}
                </h1>
            </div>

            {/* Summary cards */}
            <div className={styles.cards}>
                <SummaryCard
                    label="Gastos del Día"
                    amount={-(summary?.total_expense_bs ?? 0)}
                    variant="expense"
                    icon="📉"
                />
                <SummaryCard
                    label="Ingresos del Día"
                    amount={summary?.total_income_bs ?? 0}
                    variant="income"
                    icon="📈"
                />
                <SummaryCard
                    label="Neto del Día"
                    amount={summary?.net_bs ?? 0}
                    variant="dark"
                    icon="💰"
                />
            </div>

            {/* Recent activity */}
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
                        <EmptyState
                            icon="📭"
                            title="Sin transacciones hoy"
                            message="Envía un mensaje por WhatsApp: '35 almuerzo' para registrar un gasto."
                        />
                    ) : (
                        recent.map((tx) => (
                            <TransactionRow
                                key={tx.id}
                                transaction={tx}
                                timezone={summary?.timezone ?? "America/La_Paz"}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
