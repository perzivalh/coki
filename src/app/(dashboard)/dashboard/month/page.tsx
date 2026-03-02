"use client";
import React, { useEffect, useState, useCallback } from "react";
import { SummaryCard, ProgressBar, EmptyState } from "@/ui";
import styles from "./page.module.css";
import type { TransactionWithRelations } from "@/domain/entities/transaction";
import type { FinanceSummary } from "@/domain/contracts/finance";

interface CategoryTotal { slug: string; name: string; icon: string | null; total: number; count: number; pct: number; }
const CATEGORY_COLORS = ["#f97316", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16"];

export default function MonthPage() {
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [categories, setCategories] = useState<CategoryTotal[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const from = `${year}-${month}-01T00:00:00Z`;
            const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
            const to = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59Z`;

            const [summaryRes, txRes] = await Promise.all([
                fetch("/api/finance/summary?range=month"),
                fetch(`/api/finance/transactions?from=${from}&to=${to}&limit=100`),
            ]);
            if (summaryRes.ok) setSummary(await summaryRes.json() as FinanceSummary);
            if (txRes.ok) {
                const data = await txRes.json() as { data: TransactionWithRelations[] };
                const catMap = new Map<string, CategoryTotal>();
                for (const tx of data.data ?? []) {
                    if (tx.type !== "expense") continue;
                    const key = tx.category?.slug ?? "sin-categoria";
                    const existing = catMap.get(key);
                    if (existing) { existing.total += tx.amount_bs; existing.count++; }
                    else catMap.set(key, { slug: key, name: tx.category?.name ?? "Sin categoría", icon: tx.category?.icon ?? null, total: tx.amount_bs, count: 1, pct: 0 });
                }
                const sorted = [...catMap.values()].sort((a, b) => b.total - a.total);
                const maxTotal = sorted[0]?.total ?? 1;
                sorted.forEach((c) => { c.pct = Math.round((c.total / maxTotal) * 100); });
                setCategories(sorted);
            }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);
    const monthLabel = new Date().toLocaleDateString("es-LA", { month: "long", year: "numeric" });

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h1>
                <p className={styles.subtitle}>Resumen financiero del mes</p>
            </div>
            <div className={styles.cards}>
                <SummaryCard label="Total Ingresos" amount={summary?.total_income_bs ?? 0} variant="income" icon="📈" />
                <SummaryCard label="Total Gastos" amount={-(summary?.total_expense_bs ?? 0)} variant="expense" icon="📉" />
                <SummaryCard label="Neto del Mes" amount={summary?.net_bs ?? 0} variant="dark" icon="💰" />
            </div>
            {categories.length > 0 ? (
                <div className={styles.catSection}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Top Categorías</h2></div>
                    <div className={styles.catList}>
                        {categories.map((cat, i) => (
                            <div key={cat.slug} className={styles.catItem}>
                                <div className={styles.catMeta}>
                                    <span className={styles.catIcon}>{cat.icon ?? "📦"}</span>
                                    <div><p className={styles.catName}>{cat.name}</p><p className={styles.catCount}>{cat.count} transacción{cat.count !== 1 ? "es" : ""}</p></div>
                                </div>
                                <ProgressBar value={cat.pct} rightLabel={`Bs ${cat.total.toFixed(2)}`} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : !loading ? (
                <EmptyState icon="📊" title="Sin gastos este mes" message="Registra transacciones por WhatsApp para ver el resumen." />
            ) : null}
        </div>
    );
}
