"use client";

import React, { useState, useEffect } from "react";
import styles from "./EditTransactionModal.module.css";
import { Button, useToast } from "@/ui";
import type { TransactionWithRelations } from "@/domain/entities/transaction";
import type { Category } from "@/domain/entities/category";
import type { Account } from "@/domain/entities/account";

export interface EditTransactionModalProps {
    transaction: TransactionWithRelations;
    onClose: () => void;
    onSaved: () => void;
}

export function EditTransactionModal({ transaction, onClose, onSaved }: EditTransactionModalProps) {
    const { show: toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Select options
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    // Form fields
    const [amount, setAmount] = useState(Math.abs(transaction.amount_bs).toString());
    const [categoryId, setCategoryId] = useState(transaction.category_id || "");
    const [accountId, setAccountId] = useState(transaction.account_id);
    const [note, setNote] = useState(transaction.note || "");
    const [date, setDate] = useState(() => {
        // format ISO for datetime-local input
        return new Date(transaction.occurred_at).toISOString().slice(0, 16);
    });

    useEffect(() => {
        // Fetch categories and accounts
        Promise.all([
            fetch("/api/finance/categories").then(r => r.json()),
            fetch("/api/finance/accounts").then(r => r.json())
        ]).then(([cats, accs]) => {
            setCategories(cats);
            setAccounts(accs);
        }).catch(() => {
            toast("Error cargando opciones", "error");
        });
    }, [toast]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/finance/transactions/${transaction.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount_bs: Number(amount),
                    category_id: categoryId || null,
                    account_id: accountId,
                    note,
                    occurred_at: new Date(date).toISOString(),
                })
            });
            if (!res.ok) throw new Error();
            toast("Transacción actualizada", "success");
            onSaved();
        } catch {
            toast("Error al actualizar la transacción", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de eliminar esta transacción? Esta acción no se puede deshacer.")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/finance/transactions/${transaction.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast("Transacción eliminada", "success");
            onSaved();
        } catch {
            toast("Error al eliminar la transacción", "error");
            setLoading(false);
        }
    };

    const hasWarnings = transaction.exceeded_daily || transaction.exceeded_monthly || transaction.exceeded_category;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Editar Transacción</h2>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.body}>
                    {hasWarnings && (
                        <div className={styles.warning}>
                            ⚠️ Esta transacción excedió los límites de presupuesto configurados.
                        </div>
                    )}

                    <div className={styles.field}>
                        <label className={styles.label}>Fecha y Hora</label>
                        <input type="datetime-local" className={styles.input} value={date} onChange={e => setDate(e.target.value)} />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Monto (Bs)</label>
                        <input type="number" step="0.01" className={styles.input} value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Categoría</label>
                        <select className={styles.select} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            <option value="">(Sin categoría)</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.icon || "📂"} {c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Cuenta</label>
                        <select className={styles.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>💳 {a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Nota</label>
                        <textarea className={styles.textarea} value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                </div>

                <div className={styles.footer}>
                    <Button variant="danger" disabled={loading} onClick={handleDelete}>
                        Eliminar
                    </Button>
                    <div className={styles.actions}>
                        <Button variant="secondary" disabled={loading} onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button variant="primary" disabled={loading} onClick={handleSave}>
                            {loading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
