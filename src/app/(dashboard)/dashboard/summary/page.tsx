"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { Button, useToast } from "@/ui";

export default function DailySummaryPage() {
    const { show: toast } = useToast();
    const [sendTime, setSendTime] = useState("20:00");
    const [sending, setSending] = useState(false);
    const [saving, setSaving] = useState(false);
    const [phoneConfigured, setPhoneConfigured] = useState<boolean | null>(null);
    const [cronResult, setCronResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const [prefs, setPrefs] = useState({
        showCategories: true,
        showRemaining: true,
        showTips: true
    });

    // Load current settings to detect if whatsapp_number is configured
    useEffect(() => {
        fetch("/api/settings")
            .then(r => r.ok ? r.json() : [])
            .then((settings: Array<{ key: string; value: string }>) => {
                const phone = settings.find((s) => s.key === "whatsapp_number")?.value;
                setPhoneConfigured(!!phone);
                const time = settings.find((s) => s.key === "daily_summary_time")?.value;
                if (time) setSendTime(time);
            })
            .catch(() => setPhoneConfigured(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ daily_summary_time: sendTime }),
            });
            if (!res.ok) throw new Error();
            toast("Preferencias guardadas", "success");
        } catch {
            toast("Error guardando preferencias", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async () => {
        if (!phoneConfigured) {
            toast("Configura tu número de WhatsApp en Ajustes primero", "error");
            return;
        }
        setSending(true);
        setCronResult(null);
        try {
            const res = await fetch("/api/cron/daily-summary", {
                method: "POST",
                headers: { "x-cron-secret": "coki_cron_secret" }
            });
            const body = await res.json() as { ok?: boolean; error?: string; reason?: string };
            if (!res.ok) {
                setCronResult({ ok: false, msg: body.error ?? "Error desconocido" });
                toast(body.error ?? "Error enviando el resumen", "error");
            } else {
                const msg = body.ok ? "✅ Enviado" : `⚠️ Omitido: ${body.reason ?? "sin datos"}`;
                setCronResult({ ok: !!body.ok, msg });
                toast(msg, body.ok ? "success" : "warning");
            }
        } catch (err: unknown) {
            const msg = (err as Error).message ?? "Error de red";
            setCronResult({ ok: false, msg });
            toast(msg, "error");
        } finally {
            setSending(false);
        }
    };

    const togglePref = (k: keyof typeof prefs) => {
        setPrefs(p => ({ ...p, [k]: !p[k] }));
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Resumen Diario</h1>
                <p className={styles.subtitle}>Configura y previsualiza el reporte enviado por WhatsApp cada noche.</p>
            </header>

            {phoneConfigured === false && (
                <div style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    color: "#fca5a5",
                    fontSize: "0.875rem",
                    marginBottom: "1rem"
                }}>
                    ⚠️ <strong>Sin número configurado.</strong> Ve a{" "}
                    <a href="/dashboard/settings" style={{ color: "#f87171", textDecoration: "underline" }}>
                        Ajustes
                    </a>{" "}
                    y guarda tu número de WhatsApp para poder enviar el resumen.
                </div>
            )}

            <div className={styles.grid}>
                {/* Configuration Panel */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}>Configuración de Envío</h2>

                    <div className={styles.field}>
                        <label className={styles.label}>Horario de Entrega</label>
                        <input
                            type="time"
                            className={styles.timeInput}
                            value={sendTime}
                            onChange={e => setSendTime(e.target.value)}
                        />
                        <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                            Nota: El envío está automatizado por un cron job en el servidor.
                        </p>
                    </div>

                    <label className={styles.label}>Contenido del Reporte</label>
                    <div className={styles.checkboxList}>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={prefs.showCategories}
                                onChange={() => togglePref("showCategories")}
                            />
                            <span className={styles.checkboxLabel}>Incluir desglose por top 3 categorías</span>
                        </label>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={prefs.showRemaining}
                                onChange={() => togglePref("showRemaining")}
                            />
                            <span className={styles.checkboxLabel}>Mostrar presupuesto diario restante y alertas</span>
                        </label>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={prefs.showTips}
                                onChange={() => togglePref("showTips")}
                            />
                            <span className={styles.checkboxLabel}>Consejos y motivación financiera</span>
                        </label>
                    </div>

                    <Button variant="primary" style={{ width: "100%", marginBottom: "1rem" }} onClick={handleSave} disabled={saving}>
                        {saving ? "Guardando..." : "Guardar Preferencias"}
                    </Button>
                    <Button variant="secondary" style={{ width: "100%" }} onClick={handleSendTest} disabled={sending || !phoneConfigured}>
                        {sending ? "Enviando..." : "Enviar Prueba Ahora"}
                    </Button>

                    {cronResult && (
                        <div style={{
                            marginTop: "1rem",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            background: cronResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            border: `1px solid ${cronResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: cronResult.ok ? "#86efac" : "#fca5a5",
                            wordBreak: "break-word",
                        }}>
                            {cronResult.msg}
                        </div>
                    )}
                </div>

                {/* Preview Panel */}
                <div>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>Vista Previa en WhatsApp</h2>
                    <div className={styles.waPreview}>
                        <div className={styles.waHeader}>
                            <div className={styles.waAvatar}>🤖</div>
                            <div>
                                <div style={{ fontSize: "1rem" }}>Coki Finance</div>
                                <div style={{ fontSize: "0.75rem", color: "#d1d5db" }}>en línea</div>
                            </div>
                        </div>
                        <div className={styles.waBody}>
                            <div className={styles.waMessage}>
                                <pre>{`📉 *Resumen de hoy ${new Date().toLocaleDateString("es-LA")}*

💸 *Gastos del día:* Bs 150.00
💰 *Ingresos:* Bs 0.00
🍔 *Top 3 Categorías:*
 1. 🌮 Comida: Bs 100
 2. 🚕 Transporte: Bs 50

${prefs.showRemaining ? `⚠️ *Alerta:* Te pasaste tu límite diario en Bs 20.00.\n🗓️ *Presupuesto libre para mañana:* Bs 48.50.` : ""}

${prefs.showTips ? `¡Sigue así! Recuerda registrar todos tus gastos pequeños.` : ""}`}</pre>
                                <div className={styles.waFooter}>
                                    {new Date().toLocaleTimeString("es-LA", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
