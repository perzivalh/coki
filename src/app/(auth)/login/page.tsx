"use client";
import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PinInput, Button, useToast, ToastContainer } from "@/ui";
import styles from "./page.module.css";

export default function LoginPage() {
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const { toasts, show, dismiss } = useToast();
    const router = useRouter();

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (pin.length < 4) {
            show("Ingresa al menos 4 dígitos", "warning");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/pin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });
            const data = await res.json() as { ok?: boolean; error?: string; retry_after_seconds?: number };
            if (res.ok) {
                router.push("/dashboard/today");
            } else if (res.status === 429) {
                const mins = Math.ceil((data.retry_after_seconds ?? 900) / 60);
                show(`Demasiados intentos. Intenta en ${mins} minutos.`, "error");
            } else {
                setAttempts((a) => a + 1);
                show(data.error ?? "PIN incorrecto", "error");
                setPin("");
            }
        } catch {
            show("Error de red. Intenta de nuevo.", "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <div className={styles.brand}>
                    <div className={styles.logoBox}>🤖</div>
                    <h1 className={styles.appName}>Coki Finance</h1>
                    <p className={styles.appSub}>Tu asistente financiero personal</p>
                </div>

                <div className={styles.pinSection}>
                    <h2 className={styles.pinTitle}>Enter PIN</h2>
                    <p className={styles.pinHint}>Ingresa tu PIN para acceder al dashboard</p>

                    <form onSubmit={handleSubmit} className={styles.form} id="login-form">
                        <PinInput
                            value={pin}
                            onChange={setPin}
                            error={attempts > 0}
                            disabled={loading}
                        />
                        {attempts > 0 && (
                            <p className={styles.attemptsWarning}>
                                {attempts} intento{attempts !== 1 ? "s" : ""} fallido{attempts !== 1 ? "s" : ""}
                            </p>
                        )}
                        <Button
                            type="submit"
                            variant="primary"
                            loading={loading}
                            className={styles.submitBtn}
                            id="login-submit"
                        >
                            Unlock Dashboard →
                        </Button>
                    </form>
                </div>

                <p className={styles.footer}>© 2026 Coki Finance. Secure connection.</p>
            </div>
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </main>
    );
}
