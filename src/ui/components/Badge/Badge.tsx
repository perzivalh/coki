"use client";
import React from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "default" | "success" | "warning" | "danger";

export interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    dot?: boolean;
}

export function Badge({ variant = "default", children, dot }: BadgeProps) {
    return (
        <span className={`${styles.badge} ${styles[`badge--${variant}`]}`}>
            {dot && <span className={styles.dot} />}
            {children}
        </span>
    );
}
