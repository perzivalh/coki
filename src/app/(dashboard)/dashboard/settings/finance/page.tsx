"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ToastContainer, useToast } from "@/ui";
import styles from "./page.module.css";

interface FinanceSummary {
    total_income_monthly_bs: number;
    total_fixed_bills_monthly_bs: number;
    savings_bs: number;
    free_monthly_bs: number;
    daily_free_bs: number;
    working_days: number;
    has_risk: boolean;
    is_incomplete: boolean;
}

interface FinanceData {
    summary: FinanceSummary;
    income_sources: Array<{ id: string; name: string; amount_monthly_bs: number; is_active: boolean }>;
    fixed_bills: Array<{ id: string; name: string; amount_bs: number; due_day: number; is_active: boolean }>;
    savings_target_bs: number;
    working_days: number;
}

function StatCard({ label, value, note, className }: {
    label: string;
    value: string;
    note?: string;
    className?: string;
}) {
    return (
        <Card>
            <div className={styles.card}>
                <p className={styles.cardLabel}>{label}</p>
                <p className={`${styles.cardValue} ${className ?? ""}`}>{value}</p>
                {note && <p className={styles.cardNote}>{note}</p>}
            </div>
        </Card>
    );
}

export default function FinanceOverviewPage() {
    const router = useRouter();
    const [data, setData] = useState<FinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const { toasts, show, dismiss } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings/finance");
            if (res.ok) {
                setData(await res.json() as FinanceData);
            } else {
                show("Error al cargar configuración", "error");
            }
        } catch {
            show("Error de red", "error");
        } finally {
            setLoading(false);
        }
    }, [show]);

    useEffect(() => { void load(); }, [load]);

    if (loading) {
        return <div className={styles.loading}>Cargando configuración...</div>;
    }

    const summary = data?.summary;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Finance Overview</h1>
                    <p className={styles.subtitle}>Resumen de tu configuración financiera</p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => router.push("/dashboard/settings/finance/wizard")}
                >
                    Configurar Wizard
                </Button>
            </div>

            {summary?.is_incomplete && (
                <div className={styles.infoBox}>
                    ⚠️ <strong>Configuración incompleta.</strong> Ingresa al Wizard para definir tus ingresos y límites.
                </div>
            )}

            {summary?.has_risk && (
                <div className={`${styles.infoBox} ${styles.risk}`}>
                    🚨 <strong>Riesgo financiero:</strong> Tus gastos fijos superan tus ingresos.
                </div>
            )}

            <div className={styles.cards}>
                <StatCard
                    label="Ingresos mensuales"
                    value={`Bs ${(summary?.total_income_monthly_bs ?? 0).toFixed(2)}`}
                    note="Suma de todas las fuentes activas"
                />
                <StatCard
                    label="Gastos fijos"
                    value={`Bs ${(summary?.total_fixed_bills_monthly_bs ?? 0).toFixed(2)}`}
                    note="Mensualidades comprometidas"
                    className={summary?.has_risk ? styles.risk : undefined}
                />
                <StatCard
                    label="Ahorro objetivo"
                    value={`Bs ${(summary?.savings_bs ?? 0).toFixed(2)}`}
                    note="Por mes"
                />
                <StatCard
                    label="Gasto libre mensual"
                    value={`Bs ${(summary?.free_monthly_bs ?? 0).toFixed(2)}`}
                    note="Ingresos − Fijos − Ahorro"
                />
                <StatCard
                    label="Límite diario libre"
                    value={`Bs ${(summary?.daily_free_bs ?? 0).toFixed(2)}`}
                    note={`Calculado para ${summary?.working_days ?? 22} días/mes`}
                />
            </div>

            {(data?.income_sources?.length ?? 0) > 0 && (
                <Card>
                    <div className={styles.card}>
                        <p className={styles.sectionTitle}>Fuentes de ingreso</p>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left", padding: "4px 0", color: "var(--color-text-muted)" }}>Nombre</th>
                                    <th style={{ textAlign: "right", padding: "4px 0", color: "var(--color-text-muted)" }}>Monto/mes</th>
                                    <th style={{ textAlign: "right", padding: "4px 0", color: "var(--color-text-muted)" }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.income_sources.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ padding: "6px 0" }}>{s.name}</td>
                                        <td style={{ textAlign: "right", padding: "6px 0" }}>Bs {Number(s.amount_monthly_bs).toFixed(2)}</td>
                                        <td style={{ textAlign: "right", padding: "6px 0", color: s.is_active ? "var(--color-success,#22c55e)" : "var(--color-text-muted)" }}>
                                            {s.is_active ? "Activo" : "Inactivo"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </div>
    );
}
