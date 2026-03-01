"use client";
import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, useToast, ToastContainer } from "@/ui";
import styles from "./page.module.css";

export default function LoginPage() {
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const { toasts, show, dismiss } = useToast();
    const router = useRouter();

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!pin || pin.length < 4) {
            show("PIN must be at least 4 digits", "warning");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });
            if (res.ok) {
                router.push("/dashboard");
            } else {
                const data = (await res.json()) as { error?: string };
                show(data.error ?? "Login failed", "error");
            }
        } catch {
            show("Network error — please try again", "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <div className={styles.brand}>
                    <span className={styles.logo}>🤖</span>
                    <h1 className={styles.title}>Coki</h1>
                    <p className={styles.subtitle}>Tu asistente personal</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} id="login-form">
                    <Input
                        id="pin-input"
                        label="PIN de acceso"
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        loading={loading}
                        className={styles.submitBtn}
                        id="login-submit"
                    >
                        Ingresar
                    </Button>
                </form>
            </div>

            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </main>
    );
}
