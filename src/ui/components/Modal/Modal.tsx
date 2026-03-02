"use client";
import React, { useEffect, useRef } from "react";
import styles from "./Modal.module.css";
import { Button } from "@/ui/components/Button/Button";

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
            <div
                aria-hidden="true"
                onClick={onClose}
                style={{ position: "absolute", inset: 0, cursor: "pointer" }}
            />
            <div className={`${styles.panel} ${styles[`panel--${size}`]}`} ref={ref}>
                <div className={styles.header}>
                    {title && <h2 className={styles.title}>{title}</h2>}
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
                </div>
                <div className={styles.body}>{children}</div>
                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        </div>
    );
}
