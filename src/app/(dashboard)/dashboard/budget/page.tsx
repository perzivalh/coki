"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import { Card, Button, useToast } from "@/ui";
import type { CategoryBudgetWithName } from "@/domain/entities/budget";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";

export default function BudgetPage() {
    const { show: toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // const [budget, setBudget] = useState<Budget | null>(null);
    const [categoryLimits, setCategoryLimits] = useState<CategoryBudgetWithName[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    // Form states
    const [monthlyTotal, setMonthlyTotal] = useState("0");
    const [dailyFree, setDailyFree] = useState("0");

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bRes, cRes, aRes] = await Promise.all([
                fetch("/api/finance/budget"),
                fetch("/api/finance/categories"),
                fetch("/api/finance/accounts"),
            ]);

            if (bRes.ok) {
                const bData = await bRes.json();
                // setBudget(bData.budget);
                setCategoryLimits(bData.categoryLimits);
                setMonthlyTotal(bData.budget?.monthly_total_bs?.toString() || "0");
                setDailyFree(bData.budget?.daily_free_bs?.toString() || "0");
            }
            if (cRes.ok) setCategories(await cRes.json());
            if (aRes.ok) setAccounts(await aRes.json());
        } catch {
            toast("Error cargando los datos", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBudget = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/finance/budget", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    monthly_total_bs: Number(monthlyTotal),
                    daily_free_bs: Number(dailyFree),
                }),
            });
            if (!res.ok) throw new Error();
            toast("Presupuesto general guardado", "success");
        } catch {
            toast("Error al guardar presupuesto", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCategoryLimit = async (categoryId: string, limit: number, active: boolean) => {
        try {
            const res = await fetch("/api/finance/budget", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category_limits: [{ category_id: categoryId, monthly_limit_bs: limit, active }],
                }),
            });
            if (!res.ok) throw new Error();
            toast("Límite de categoría actualizado", "success");
            loadData(); // refresh table
        } catch {
            toast("Error al actualizar límite", "error");
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.skeleton} style={{ width: "200px", marginBottom: "2rem" }} />
                <div className={styles.cardsGrid}>
                    <div className={styles.skeleton} style={{ height: "150px" }} />
                    <div className={styles.skeleton} style={{ height: "150px" }} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Configuración de Finanzas</h1>
            </header>

            {/* General Budget */}
            <div className={styles.cardsGrid}>
                <Card>
                    <div className={styles.budgetCard}>
                        <div className={styles.cardHeader}>
                            <span>💰</span> Presupuesto Mensual Total
                        </div>
                        <div className={styles.inputGroup}>
                            <input
                                type="number"
                                className={styles.input}
                                value={monthlyTotal}
                                onChange={(e) => setMonthlyTotal(e.target.value)}
                                placeholder="Ej: 5000"
                            />
                            <Button disabled={saving} onClick={handleSaveBudget}>
                                {saving ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div className={styles.budgetCard}>
                        <div className={styles.cardHeader}>
                            <span>☕</span> Límite Diario Libre
                        </div>
                        <div className={styles.inputGroup}>
                            <input
                                type="number"
                                className={styles.input}
                                value={dailyFree}
                                onChange={(e) => setDailyFree(e.target.value)}
                                placeholder="Ej: 50"
                            />
                            <Button disabled={saving} onClick={handleSaveBudget}>
                                {saving ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Categories */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>
                    Límites por Categoría
                    <Button variant="secondary">✚ Nueva Categoría</Button>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>Límite Mensual (Bs)</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((cat) => {
                            const config = categoryLimits.find((cl) => cl.category_id === cat.id);
                            const currentLimit = config?.monthly_limit_bs || 0;
                            const isActive = config?.active !== false;

                            return (
                                <tr key={cat.id}>
                                    <td>
                                        <div className={styles.categoryName}>
                                            {cat.icon || "📁"} {cat.name}
                                        </div>
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className={styles.input}
                                            style={{ width: "120px" }}
                                            defaultValue={currentLimit}
                                            onBlur={(e) => {
                                                const val = Number(e.target.value);
                                                if (val !== currentLimit) {
                                                    handleSaveCategoryLimit(cat.id, val, isActive);
                                                }
                                            }}
                                        />
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
                                            {isActive ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            <button className={styles.iconBtn} onClick={() => handleSaveCategoryLimit(cat.id, currentLimit, !isActive)} title={isActive ? "Desactivar" : "Activar"}>
                                                {isActive ? "🚫" : "✅"}
                                            </button>
                                            <button className={`${styles.iconBtn} ${styles.delete}`} title="Eliminar Categoría">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Accounts */}
            <div className={styles.sectionTitle}>
                Configuración de Cuentas
                <Button variant="secondary">✚ Nueva Cuenta</Button>
            </div>
            <div className={styles.accountsGrid}>
                {accounts.map((acc) => (
                    <div key={acc.id} className={styles.accountCard}>
                        <div className={styles.accountInfo}>
                            <span className={styles.accountName}>💳 {acc.name}</span>
                            <span className={`${styles.statusBadge} ${acc.active ? styles.statusActive : styles.statusInactive}`}>
                                {acc.active ? "Activo" : "Inactivo"}
                            </span>
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.iconBtn}>✏️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
