"use client";
import React, { useEffect, useCallback } from "react";
import styles from "./Toast.module.css";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastMessage {
    id: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
}

interface ToastItemProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const { id, message, variant = "info", duration = 4000 } = toast;

    useEffect(() => {
        const timer = setTimeout(() => onDismiss(id), duration);
        return () => clearTimeout(timer);
    }, [id, duration, onDismiss]);

    return (
        <div className={`${styles.toast} ${styles[`toast--${variant}`]}`} role="alert">
            <span className={styles.message}>{message}</span>
            <button className={styles.close} onClick={() => onDismiss(id)} aria-label="Dismiss">✕</button>
        </div>
    );
}

export interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className={styles.container} aria-live="polite">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

// Convenience hook
export function useToast() {
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((message: string, variant: ToastVariant = "info", duration = 4000) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant, duration }]);
        return id;
    }, []);

    return { toasts, show, dismiss };
}
