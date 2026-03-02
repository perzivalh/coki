"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button, Card, Input, Modal, ToastContainer, useToast } from "@/ui";
import styles from "./page.module.css";

interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    active: boolean;
}

const ICON_OPTIONS = ["🍔", "🚕", "🏥", "🛒", "🎬", "⚡", "🏠", "💻", "🎓", "💸", "💳", "🐾", "🎁", "📱", "✈️", "🏋️", "💊", "🎮", "📦", "🔧"];

function slugify(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCat, setEditingCat] = useState<Category | null>(null);

    const [formName, setFormName] = useState("");
    const [formIcon, setFormIcon] = useState("💸");
    const [formSaving, setFormSaving] = useState(false);

    const { toasts, show, dismiss } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/finance/categories");
            if (res.ok) setCategories(await res.json() as Category[]);
        } catch {
            show("Error al cargar categorías", "error");
        } finally { setLoading(false); }
    }, [show]);

    useEffect(() => { void load(); }, [load]);

    function openNew() {
        setEditingCat(null);
        setFormName("");
        setFormIcon("💸");
        setShowModal(true);
    }

    function openEdit(cat: Category) {
        setEditingCat(cat);
        setFormName(cat.name);
        setFormIcon(cat.icon ?? "💸");
        setShowModal(true);
    }

    async function handleSave() {
        if (!formName.trim()) return;
        setFormSaving(true);
        try {
            let res: Response;
            if (editingCat) {
                res = await fetch(`/api/finance/categories/${editingCat.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), icon: formIcon }),
                });
            } else {
                res = await fetch("/api/finance/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), slug: slugify(formName.trim()), icon: formIcon }),
                });
            }
            if (res.ok) {
                show(editingCat ? "Categoría actualizada" : "Categoría creada", "success");
                setShowModal(false);
                void load();
            } else {
                const e = await res.json() as { error: string };
                show(e.error ?? "Error al guardar", "error");
            }
        } finally { setFormSaving(false); }
    }

    async function handleDelete(cat: Category) {
        if (!confirm(`¿Eliminar categoría "${cat.name}"? Las transacciones existentes quedarán sin categoría.`)) return;
        const res = await fetch(`/api/finance/categories/${cat.id}`, { method: "DELETE" });
        if (res.ok) {
            show("Categoría eliminada", "success");
            setCategories((p) => p.filter((c) => c.id !== cat.id));
        } else {
            const e = await res.json() as { error: string };
            show(e.error ?? "Error al eliminar", "error");
        }
    }

    async function handleToggleActive(cat: Category) {
        const res = await fetch(`/api/finance/categories/${cat.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !cat.active }),
        });
        if (res.ok) {
            setCategories((p) => p.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c));
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Categorías</h1>
                    <p className={styles.subtitle}>Clasifica tus gastos e ingresos</p>
                </div>
                <Button variant="primary" onClick={openNew}>+ Nueva categoría</Button>
            </div>

            <Card>
                {loading ? (
                    <div className={styles.empty}>Cargando...</div>
                ) : categories.length === 0 ? (
                    <div className={styles.empty}>No hay categorías.{" "}
                        <button onClick={openNew} style={{ color: "var(--color-primary,#6366f1)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                            Crear primera
                        </button>
                    </div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.catTable}>
                            <thead>
                                <tr>
                                    <th className={styles.th}>Icono</th>
                                    <th className={styles.th}>Nombre</th>
                                    <th className={styles.th}>Slug</th>
                                    <th className={styles.th}>Estado</th>
                                    <th className={styles.th}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((cat) => (
                                    <tr key={cat.id}>
                                        <td className={styles.td}><span className={styles.icon}>{cat.icon ?? "📂"}</span></td>
                                        <td className={styles.td}><strong>{cat.name}</strong></td>
                                        <td className={styles.td} style={{ color: "var(--color-text-muted)", fontFamily: "monospace" }}>{cat.slug}</td>
                                        <td className={styles.td}>
                                            <span style={{ color: cat.active ? "var(--color-success,#22c55e)" : "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontWeight: 600 }}>
                                                {cat.active ? "Activa" : "Inactiva"}
                                            </span>
                                        </td>
                                        <td className={styles.td}>
                                            <div className={styles.actions}>
                                                <Button variant="secondary" onClick={() => openEdit(cat)}>Editar</Button>
                                                <Button variant="secondary" onClick={() => handleToggleActive(cat)}>
                                                    {cat.active ? "Desactivar" : "Activar"}
                                                </Button>
                                                <Button variant="danger" onClick={() => handleDelete(cat)}>Eliminar</Button>
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
                title={editingCat ? "Editar categoría" : "Nueva categoría"}
            >
                <div className={styles.modal}>
                    <div className={styles.field}>
                        <label className={styles.label}>Nombre</label>
                        <Input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Ej: Comida, Transporte, Salud"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Icono</label>
                        <div className={styles.iconRow}>
                            {ICON_OPTIONS.map((ic) => (
                                <button
                                    key={ic}
                                    type="button"
                                    className={`${styles.iconBtn} ${formIcon === ic ? styles.iconBtnSelected : ""}`}
                                    onClick={() => setFormIcon(ic)}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.modalActions}>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={formSaving || !formName.trim()}
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
