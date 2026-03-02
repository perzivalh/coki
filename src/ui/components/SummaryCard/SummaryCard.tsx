"use client";
import React from "react";
import styles from "./SummaryCard.module.css";

export type SummaryCardVariant = "default" | "income" | "expense" | "dark";

export interface SummaryCardProps {
    label: string;
    amount: number;
    currency?: string;
    delta?: string;
    deltaPositive?: boolean;
    icon?: React.ReactNode;
    variant?: SummaryCardVariant;
}

export function SummaryCard({
    label,
    amount,
    currency = "Bs",
    delta,
    deltaPositive,
    icon,
    variant = "default",
}: SummaryCardProps) {
    const isNegative = amount < 0;
    const formatted = `${currency} ${Math.abs(amount).toFixed(2)}`;
    const displayAmount = isNegative ? `-${formatted}` : formatted;

    return (
        <div className={`${styles.card} ${styles[`card--${variant}`]}`}>
            <div className={styles.header}>
                {icon && <span className={styles.icon}>{icon}</span>}
                {delta && (
                    <span className={`${styles.delta} ${deltaPositive ? styles.deltaPos : styles.deltaNeg}`}>
                        {deltaPositive ? "+" : ""}{delta}
                    </span>
                )}
            </div>
            <p className={styles.label}>{label}</p>
            <p className={`${styles.amount} ${isNegative ? styles.amountNeg : ""}`}>{displayAmount}</p>
        </div>
    );
}
