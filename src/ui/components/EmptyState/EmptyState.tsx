"use client";
import React from "react";
import styles from "./EmptyState.module.css";
import { Button } from "@/ui/components/Button/Button";

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title?: string;
    message?: string;
    action?: { label: string; onClick: () => void };
}

export function EmptyState({
    icon = "🗂️",
    title = "Nothing here yet",
    message,
    action,
}: EmptyStateProps) {
    return (
        <div className={styles.wrapper}>
            <div className={styles.icon}>{icon}</div>
            <p className={styles.title}>{title}</p>
            {message && <p className={styles.message}>{message}</p>}
            {action && (
                <Button variant="secondary" size="sm" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}
