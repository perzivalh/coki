"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button, Input, useToast, ToastContainer, Card } from "@/ui";
import styles from "./page.module.css";

interface Setting {
    key: string;
    value: string;
    description: string | null;
}

const EDITABLE_SETTINGS = [
    { key: "timezone", label: "Zona Horaria", placeholder: "America/La_Paz", type: "text" },
    { key: "currency", label: "Moneda", placeholder: "Bs", type: "text" },
    { key: "whatsapp_number", label: "Número WhatsApp (E.164)", placeholder: "+591xxxxxxxx", type: "text" },
    { key: "daily_summary_time", label: "Hora Resumen Diario (HH:MM)", placeholder: "08:00", type: "text" },
];

export default function SettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toasts, show, dismiss } = useToast();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json() as Setting[];
                const map: Record<string, string> = {};
                data.forEach((s) => { map[s.key] = s.value; });
                setSettings(map);
            }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (res.ok) show("Configuración guardada", "success");
            else show("Error al guardar", "error");
        } catch {
            show("Error de red", "error");
        } finally { setSaving(false); }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Configuración</h1>
                <p className={styles.subtitle}>Parámetros del sistema Coki</p>
            </div>

            <form onSubmit={handleSave} className={styles.form}>
                <Card>
                    <div className={styles.cardInner}>
                        <h2 className={styles.sectionTitle}>General</h2>
                        <div className={styles.fields}>
                            {EDITABLE_SETTINGS.map((s) => (
                                <div key={s.key} className={styles.field}>
                                    <label className={styles.label} htmlFor={`setting-${s.key}`}>{s.label}</label>
                                    <Input
                                        id={`setting-${s.key}`}
                                        value={settings[s.key] ?? ""}
                                        onChange={(e) => setSettings((prev) => ({ ...prev, [s.key]: e.target.value }))}
                                        placeholder={s.placeholder}
                                        disabled={loading}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className={styles.cardInner}>
                        <h2 className={styles.sectionTitle}>Features activas</h2>
                        <div className={styles.features}>
                            {["feature_finance", "feature_tasks", "feature_docs"].map((key) => (
                                <div key={key} className={styles.featureRow}>
                                    <div>
                                        <p className={styles.featureLabel}>{key.replace("feature_", "Skill: ")}</p>
                                        <p className={styles.featureSub}>{settings[key] === "true" ? "Activo" : "Inactivo"}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${styles.toggle} ${settings[key] === "true" ? styles.toggleOn : styles.toggleOff}`}
                                        onClick={() => setSettings((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }))}
                                        id={`toggle-${key}`}
                                    >
                                        {settings[key] === "true" ? "ON" : "OFF"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <div className={styles.actions}>
                    <Button type="submit" variant="primary" disabled={saving} id="settings-save-btn">
                        {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                </div>
            </form>

            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </div>
    );
}
