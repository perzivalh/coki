"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button, Card, Input, Modal, Select, ToastContainer, useToast } from "@/ui";
import styles from "./page.module.css";

interface FixedBill {
    id: string;
    name: string;
    amount_bs: number;
    due_day: number;
    account_id: string | null;
    autopay: boolean;
    is_active: boolean;
    account: { id: string; name: string } | null;
}

interface Account { id: string; name: string; slug: string }

export default function FixedBillsPage() {
    const [bills, setBills] = useState<FixedBill[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBill, setEditingBill] = useState<FixedBill | null>(null);
    const [paying, setPaying] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formDay, setFormDay] = useState("1");
    const [formAccount, setFormAccount] = useState("");
    const [formAutopay, setFormAutopay] = useState(false);
    const [formSaving, setFormSaving] = useState(false);

    const { toasts, show, dismiss } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [billsRes, accRes] = await Promise.all([
                fetch("/api/finance/fixed-bills"),
                fetch("/api/finance/accounts"),
            ]);
            if (billsRes.ok) setBills(await billsRes.json() as FixedBill[]);
            if (accRes.ok) setAccounts(await accRes.json() as Account[]);
        } catch {
            show("Error al cargar datos", "error");
        } finally { setLoading(false); }
    }, [show]);

    useEffect(() => { void load(); }, [load]);

    function openNew() {
        setEditingBill(null);
        setFormName("");
        setFormAmount("");
        setFormDay("1");
        setFormAccount("");
        setFormAutopay(false);
        setShowModal(true);
    }

    function openEdit(bill: FixedBill) {
        setEditingBill(bill);
        setFormName(bill.name);
        setFormAmount(String(bill.amount_bs));
        setFormDay(String(bill.due_day));
        setFormAccount(bill.account_id ?? "");
        setFormAutopay(bill.autopay);
        setShowModal(true);
    }

    async function handleSave() {
        if (!formName.trim() || !formAmount) return;
        setFormSaving(true);
        try {
            const body = {
                name: formName.trim(),
                amount_bs: parseFloat(formAmount),
                due_day: parseInt(formDay),
                account_id: formAccount || null,
                autopay: formAutopay,
            };

            let res: Response;
            if (editingBill) {
                res = await fetch(`/api/finance/fixed-bills/${editingBill.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            } else {
                res = await fetch("/api/finance/fixed-bills", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            }

            if (res.ok) {
                show(editingBill ? "Factura actualizada" : "Factura creada", "success");
                setShowModal(false);
                void load();
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al guardar", "error");
            }
        } finally { setFormSaving(false); }
    }

    async function handleToggleActive(bill: FixedBill) {
        const res = await fetch(`/api/finance/fixed-bills/${bill.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: !bill.is_active }),
        });
        if (res.ok) {
            setBills((p) => p.map((b) => b.id === bill.id ? { ...b, is_active: !b.is_active } : b));
        }
    }

    async function handlePay(bill: FixedBill) {
        setPaying(bill.id);
        try {
            const res = await fetch(`/api/finance/fixed-bills/${bill.id}/pay`, { method: "POST" });
            if (res.ok) {
                show(`Pago de "${bill.name}" registrado (Bs ${Number(bill.amount_bs).toFixed(2)})`, "success");
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al pagar", "error");
            }
        } finally { setPaying(null); }
    }

    const accountOptions = [
        { value: "", label: "Sin cuenta" },
        ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ];

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Gastos Fijos</h1>
                    <p className={styles.subtitle}>Mensualidades y pagos recurrentes</p>
                </div>
                <Button variant="primary" onClick={openNew}>+ Nueva factura</Button>
            </div>

            <Card>
                {loading ? (
                    <div className={styles.empty}>Cargando...</div>
                ) : bills.length === 0 ? (
                    <div className={styles.empty}>
                        No hay facturas fijas aún.{" "}
                        <button
                            onClick={openNew}
                            style={{ color: "var(--color-primary,#6366f1)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                        >
                            Agregar primera
                        </button>
                    </div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.billsTable}>
                            <thead>
                                <tr>
                                    <th className={styles.th}>Nombre</th>
                                    <th className={styles.th}>Monto</th>
                                    <th className={styles.th}>Día</th>
                                    <th className={styles.th}>Cuenta</th>
                                    <th className={styles.th}>Estado</th>
                                    <th className={styles.th}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((b) => (
                                    <tr key={b.id} className={!b.is_active ? styles.inactive : ""}>
                                        <td className={styles.td}><strong>{b.name}</strong></td>
                                        <td className={styles.td}>Bs {Number(b.amount_bs).toFixed(2)}</td>
                                        <td className={styles.td}>Día {b.due_day}</td>
                                        <td className={styles.td}>{b.account?.name ?? "—"}</td>
                                        <td className={styles.td}>
                                            <span className={`${styles.badge} ${b.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                                                {b.is_active ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className={styles.td}>
                                            <div className={styles.actions}>
                                                {b.is_active && (
                                                    <Button
                                                        variant="primary"
                                                        onClick={() => handlePay(b)}
                                                        disabled={paying === b.id}
                                                    >
                                                        {paying === b.id ? "..." : "Pagar"}
                                                    </Button>
                                                )}
                                                <Button variant="secondary" onClick={() => openEdit(b)}>Editar</Button>
                                                <Button variant="secondary" onClick={() => handleToggleActive(b)}>
                                                    {b.is_active ? "Desactivar" : "Activar"}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingBill ? "Editar factura fija" : "Nueva factura fija"}
            >
                <div className={styles.modal}>
                    <div className={styles.field}>
                        <label className={styles.label}>Nombre</label>
                        <Input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Ej: Alquiler, Netflix, Gym"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Monto (Bs)</label>
                        <Input
                            type="number"
                            value={formAmount}
                            onChange={(e) => setFormAmount(e.target.value)}
                            placeholder="0.00"
                            min="0.01"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Día de vencimiento</label>
                        <Input
                            type="number"
                            value={formDay}
                            onChange={(e) => setFormDay(e.target.value)}
                            min="1"
                            max="31"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Cuenta</label>
                        <Select
                            value={formAccount}
                            onChange={(e) => setFormAccount(e.target.value)}
                            options={accountOptions}
                        />
                    </div>

                    <div className={styles.modalActions}>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={formSaving || !formName.trim() || !formAmount}
                        >
                            {formSaving ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </div>
            </Modal>

            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </div>
    );
}
