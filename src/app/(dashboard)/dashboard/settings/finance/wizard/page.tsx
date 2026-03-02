"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, ToastContainer, useToast, Select } from "@/ui";
import styles from "./page.module.css";

type WizardStep = "income" | "fixed_bills" | "savings" | "accounts" | "summary";

interface IncomeSource { id: string; name: string; amount_monthly_bs: number; is_active: boolean }
interface FixedBill { id: string; name: string; amount_bs: number; due_day: number; account_id: string | null; autopay: boolean; is_active: boolean }
interface AccountWithBalance { id: string; name: string; slug: string; active: boolean; balance: { balance_bs: number } | null }
interface WizardSummary {
    total_income_monthly_bs: number;
    total_fixed_bills_monthly_bs: number;
    savings_bs: number;
    free_monthly_bs: number;
    daily_free_bs: number;
    working_days: number;
    has_risk: boolean;
    is_incomplete: boolean;
}

const STEPS: Array<{ key: WizardStep; label: string }> = [
    { key: "income", label: "Ingresos" },
    { key: "fixed_bills", label: "Fijos" },
    { key: "savings", label: "Ahorro" },
    { key: "accounts", label: "Cuentas" },
    { key: "summary", label: "Resumen" },
];

export default function FinanceWizardPage() {
    const router = useRouter();
    const { toasts, show, dismiss } = useToast();
    const [step, setStep] = useState<WizardStep>("income");

    // Data
    const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
    const [fixedBills, setFixedBills] = useState<FixedBill[]>([]);
    const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
    const [savingsTarget, setSavingsTarget] = useState("0");
    const [workingDays, setWorkingDays] = useState("22");
    const [summary, setSummary] = useState<WizardSummary | null>(null);

    // Add income form
    const [newIncomeName, setNewIncomeName] = useState("");
    const [newIncomeAmount, setNewIncomeAmount] = useState("");
    const [addingIncome, setAddingIncome] = useState(false);

    // Add fixed bill form
    const [newBillName, setNewBillName] = useState("");
    const [newBillAmount, setNewBillAmount] = useState("");
    const [newBillDay, setNewBillDay] = useState("1");
    const [newBillAccount, setNewBillAccount] = useState("");
    const [addingBill, setAddingBill] = useState(false);

    // Balance updates
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [savingBalance, setSavingBalance] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [incRes, billRes, finRes] = await Promise.all([
                fetch("/api/finance/income-sources"),
                fetch("/api/finance/fixed-bills"),
                fetch("/api/settings/finance"),
            ]);
            if (incRes.ok) setIncomeSources(await incRes.json() as IncomeSource[]);
            if (billRes.ok) setFixedBills(await billRes.json() as FixedBill[]);
            if (finRes.ok) {
                const data = await finRes.json() as {
                    summary: WizardSummary;
                    accounts_with_balances: AccountWithBalance[];
                    savings_target_bs: number;
                    working_days: number;
                };
                setAccounts(data.accounts_with_balances ?? []);
                setSavingsTarget(String(data.savings_target_bs ?? 0));
                setWorkingDays(String(data.working_days ?? 22));
                setSummary(data.summary);
                // Initialize balance inputs
                const bals: Record<string, string> = {};
                (data.accounts_with_balances ?? []).forEach((a) => {
                    bals[a.id] = String(a.balance?.balance_bs ?? 0);
                });
                setBalances(bals);
            }
        } catch {
            show("Error al cargar datos", "error");
        }
    }, [show]);

    useEffect(() => { void loadData(); }, [loadData]);

    async function addIncomeSource() {
        if (!newIncomeName.trim() || !newIncomeAmount) return;
        setAddingIncome(true);
        try {
            const res = await fetch("/api/finance/income-sources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newIncomeName.trim(), amount_monthly_bs: parseFloat(newIncomeAmount) }),
            });
            if (res.ok) {
                const src = await res.json() as IncomeSource;
                setIncomeSources((p) => [...p, src]);
                setNewIncomeName("");
                setNewIncomeAmount("");
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al agregar", "error");
            }
        } finally { setAddingIncome(false); }
    }

    async function deleteIncomeSource(id: string) {
        await fetch(`/api/finance/income-sources/${id}`, { method: "DELETE" });
        setIncomeSources((p) => p.filter((s) => s.id !== id));
    }

    async function addFixedBill() {
        if (!newBillName.trim() || !newBillAmount) return;
        setAddingBill(true);
        try {
            const res = await fetch("/api/finance/fixed-bills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newBillName.trim(),
                    amount_bs: parseFloat(newBillAmount),
                    due_day: parseInt(newBillDay),
                    account_id: newBillAccount || null,
                }),
            });
            if (res.ok) {
                const bill = await res.json() as FixedBill;
                setFixedBills((p) => [...p, bill]);
                setNewBillName("");
                setNewBillAmount("");
                setNewBillDay("1");
                setNewBillAccount("");
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al agregar", "error");
            }
        } finally { setAddingBill(false); }
    }

    async function deleteFixedBill(id: string) {
        await fetch(`/api/finance/fixed-bills/${id}`, { method: "DELETE" });
        setFixedBills((p) => p.filter((b) => b.id !== id));
    }

    async function saveBalance(accountId: string) {
        setSavingBalance(accountId);
        try {
            const res = await fetch(`/api/finance/accounts/${accountId}/balance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ balance_bs: parseFloat(balances[accountId] ?? "0") }),
            });
            if (res.ok) {
                show("Saldo actualizado", "success");
            } else {
                show("Error al guardar saldo", "error");
            }
        } finally { setSavingBalance(null); }
    }

    function computeLocalSummary() {
        const savings = Math.max(0, parseFloat(savingsTarget || "0"));
        const days = Math.max(1, Math.round(parseFloat(workingDays || "22")));

        const totalIncome = incomeSources
            .filter((s) => s.is_active)
            .reduce((sum, s) => sum + Number(s.amount_monthly_bs), 0);

        const totalFixed = fixedBills
            .filter((b) => b.is_active)
            .reduce((sum, b) => sum + Number(b.amount_bs), 0);

        const freeMonthly = Math.max(0, totalIncome - totalFixed - savings);

        setSummary({
            total_income_monthly_bs: Math.round(totalIncome * 100) / 100,
            total_fixed_bills_monthly_bs: Math.round(totalFixed * 100) / 100,
            savings_bs: Math.round(savings * 100) / 100,
            free_monthly_bs: Math.round(freeMonthly * 100) / 100,
            daily_free_bs: Math.round((freeMonthly / days) * 100) / 100,
            working_days: days,
            has_risk: totalFixed > totalIncome,
            is_incomplete: totalIncome === 0,
        });
    }

    async function handleFinalSave() {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/finance", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    savings_target_bs: parseFloat(savingsTarget || "0"),
                    working_days: parseInt(workingDays || "22"),
                }),
            });
            if (res.ok) {
                show("Configuracion guardada", "success");
                setTimeout(() => router.push("/dashboard/settings/finance"), 1000);
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al guardar", "error");
            }
        } finally { setSaving(false); }
    }

    function goNext() {
        const idx = STEPS.findIndex((s) => s.key === step);
        if (idx < STEPS.length - 1) {
            if (step === "accounts") computeLocalSummary();
            setStep(STEPS[idx + 1].key);
        }
    }

    function goBack() {
        const idx = STEPS.findIndex((s) => s.key === step);
        if (idx > 0) setStep(STEPS[idx - 1].key);
    }

    const currentIdx = STEPS.findIndex((s) => s.key === step);

    const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Finance Setup Wizard</h1>
                <p className={styles.subtitle}>Configura tus ingresos, gastos fijos y saldos</p>
            </div>

            {/* Step indicators */}
            <div className={styles.steps}>
                {STEPS.map((s, i) => (
                    <React.Fragment key={s.key}>
                        <div className={`${styles.step} ${step === s.key ? styles.stepActive : ""} ${i < currentIdx ? styles.stepDone : ""}`}>
                            <div className={styles.stepDot}>
                                {i < currentIdx ? "✓" : i + 1}
                            </div>
                            <span className={styles.stepLabel}>{s.label}</span>
                        </div>
                        {i < STEPS.length - 1 && <div className={styles.stepSep} />}
                    </React.Fragment>
                ))}
            </div>

            <Card>
                <div className={styles.card}>
                    {/* ── Step 1: Income Sources ── */}
                    {step === "income" && (
                        <>
                            <div>
                                <p className={styles.sectionTitle}>Fuentes de ingreso</p>
                                <p className={styles.sectionSub}>Define cuánto ganás por mes. Al menos 1 fuente.</p>
                            </div>

                            {incomeSources.length > 0 && (
                                <div className={styles.list}>
                                    {incomeSources.map((s) => (
                                        <div key={s.id} className={styles.listItem}>
                                            <div className={styles.listItemLeft}>
                                                <span className={styles.listItemName}>{s.name}</span>
                                            </div>
                                            <span className={styles.listItemAmount}>Bs {Number(s.amount_monthly_bs).toFixed(2)}/mes</span>
                                            <Button variant="secondary" onClick={() => deleteIncomeSource(s.id)}>×</Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={styles.addForm}>
                                <p style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Agregar fuente</p>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Nombre</label>
                                        <Input
                                            value={newIncomeName}
                                            onChange={(e) => setNewIncomeName(e.target.value)}
                                            placeholder="Ej: Salario, Freelance"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Monto/mes (Bs)</label>
                                        <Input
                                            type="number"
                                            value={newIncomeAmount}
                                            onChange={(e) => setNewIncomeAmount(e.target.value)}
                                            placeholder="0.00"
                                            min="0.01"
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="primary"
                                    onClick={addIncomeSource}
                                    disabled={addingIncome || !newIncomeName.trim() || !newIncomeAmount}
                                >
                                    {addingIncome ? "Agregando..." : "Agregar"}
                                </Button>
                            </div>

                            {incomeSources.length === 0 && (
                                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-warning, #f59e0b)" }}>
                                    Necesitas al menos 1 fuente de ingreso para continuar.
                                </p>
                            )}
                        </>
                    )}

                    {/* ── Step 2: Fixed Bills ── */}
                    {step === "fixed_bills" && (
                        <>
                            <div>
                                <p className={styles.sectionTitle}>Gastos fijos mensuales</p>
                                <p className={styles.sectionSub}>Mensualidades, servicios, alquileres. Estos no afectan tu límite diario libre.</p>
                            </div>

                            {fixedBills.length > 0 && (
                                <div className={styles.list}>
                                    {fixedBills.map((b) => (
                                        <div key={b.id} className={styles.listItem}>
                                            <div className={styles.listItemLeft}>
                                                <span className={styles.listItemName}>{b.name}</span>
                                                <span className={styles.listItemSub}>Día {b.due_day}</span>
                                            </div>
                                            <span className={styles.listItemAmount}>Bs {Number(b.amount_bs).toFixed(2)}</span>
                                            <Button variant="secondary" onClick={() => deleteFixedBill(b.id)}>×</Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={styles.addForm}>
                                <p style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Agregar factura fija</p>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Nombre</label>
                                        <Input
                                            value={newBillName}
                                            onChange={(e) => setNewBillName(e.target.value)}
                                            placeholder="Ej: Alquiler, Netflix"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Monto (Bs)</label>
                                        <Input
                                            type="number"
                                            value={newBillAmount}
                                            onChange={(e) => setNewBillAmount(e.target.value)}
                                            placeholder="0.00"
                                            min="0.01"
                                        />
                                    </div>
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Día de vencimiento</label>
                                        <Input
                                            type="number"
                                            value={newBillDay}
                                            onChange={(e) => setNewBillDay(e.target.value)}
                                            min="1"
                                            max="31"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>Cuenta (opcional)</label>
                                        <Select
                                            value={newBillAccount}
                                            onChange={(e) => setNewBillAccount(e.target.value)}
                                            options={[{ value: "", label: "Sin cuenta" }, ...accountOptions]}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="primary"
                                    onClick={addFixedBill}
                                    disabled={addingBill || !newBillName.trim() || !newBillAmount}
                                >
                                    {addingBill ? "Agregando..." : "Agregar"}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Savings ── */}
                    {step === "savings" && (
                        <>
                            <div>
                                <p className={styles.sectionTitle}>Ahorro objetivo</p>
                                <p className={styles.sectionSub}>¿Cuánto queres reservar por mes? Podés poner 0 si no querés ahorrar por ahora.</p>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Ahorro mensual (Bs)</label>
                                <Input
                                    type="number"
                                    value={savingsTarget}
                                    onChange={(e) => setSavingsTarget(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Días laborables por mes</label>
                                <Input
                                    type="number"
                                    value={workingDays}
                                    onChange={(e) => setWorkingDays(e.target.value)}
                                    placeholder="22"
                                    min="1"
                                    max="31"
                                />
                                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>
                                    Se usa para calcular el límite diario libre. Default: 22.
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── Step 4: Account Balances ── */}
                    {step === "accounts" && (
                        <>
                            <div>
                                <p className={styles.sectionTitle}>Saldos actuales</p>
                                <p className={styles.sectionSub}>Ingresá el saldo actual de cada cuenta. Podés dejarlo en 0 y completarlo después.</p>
                            </div>

                            <div>
                                {accounts.map((a) => (
                                    <div key={a.id} className={styles.balanceRow}>
                                        <span className={styles.balanceName}>{a.name}</span>
                                        <div className={styles.balanceInput}>
                                            <Input
                                                type="number"
                                                value={balances[a.id] ?? "0"}
                                                onChange={(e) => setBalances((p) => ({ ...p, [a.id]: e.target.value }))}
                                                placeholder="0.00"
                                                min="0"
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => saveBalance(a.id)}
                                            disabled={savingBalance === a.id}
                                        >
                                            {savingBalance === a.id ? "..." : "Guardar"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Step 5: Summary ── */}
                    {step === "summary" && summary && (
                        <>
                            <div>
                                <p className={styles.sectionTitle}>Resumen de configuracion</p>
                                <p className={styles.sectionSub}>Así queda tu presupuesto. Si todo se ve bien, guardá y finalizá.</p>
                            </div>

                            <div className={styles.summaryBox}>
                                <div className={styles.summaryRow}>
                                    <span className={styles.summaryLabel}>Ingresos mensuales</span>
                                    <span className={styles.summaryValue}>Bs {summary.total_income_monthly_bs.toFixed(2)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span className={styles.summaryLabel}>− Gastos fijos</span>
                                    <span className={`${styles.summaryValue} ${summary.has_risk ? styles.risk : ""}`}>
                                        Bs {summary.total_fixed_bills_monthly_bs.toFixed(2)}
                                    </span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span className={styles.summaryLabel}>− Ahorro objetivo</span>
                                    <span className={styles.summaryValue}>Bs {summary.savings_bs.toFixed(2)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span className={styles.summaryLabel}>= Gasto libre mensual</span>
                                    <span className={styles.summaryHighlight}>Bs {summary.free_monthly_bs.toFixed(2)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span className={styles.summaryLabel}>Límite diario libre ({summary.working_days} días)</span>
                                    <span className={styles.summaryHighlight}>Bs {summary.daily_free_bs.toFixed(2)}/día</span>
                                </div>
                            </div>

                            {summary.has_risk && (
                                <p className={styles.risk} style={{ fontSize: "var(--font-size-sm)" }}>
                                    ⚠️ Tus gastos fijos superan tus ingresos. Revisá antes de guardar.
                                </p>
                            )}
                            {summary.is_incomplete && (
                                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-warning,#f59e0b)" }}>
                                    Todavía no tienes ingresos configurados. El límite calculado será 0.
                                </p>
                            )}
                        </>
                    )}

                    {/* Navigation */}
                    <div className={styles.actions}>
                        {currentIdx > 0 && (
                            <Button variant="secondary" onClick={goBack}>← Anterior</Button>
                        )}
                        {step !== "summary" && (
                            <Button
                                variant="primary"
                                onClick={goNext}
                                disabled={step === "income" && incomeSources.length === 0}
                            >
                                Siguiente →
                            </Button>
                        )}
                        {step === "summary" && (
                            <Button variant="primary" onClick={handleFinalSave} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar y Finalizar"}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </div>
    );
}
