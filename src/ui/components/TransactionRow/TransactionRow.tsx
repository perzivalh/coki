"use client";
import React from "react";
import styles from "./TransactionRow.module.css";
import { Badge } from "@/ui/components/Badge/Badge";
import type { TransactionWithRelations } from "@/domain/entities/transaction";

export interface TransactionRowProps {
    transaction: TransactionWithRelations;
    timezone?: string;
    onClick?: () => void;
}

function formatDate(iso: string, timezone: string): { date: string; time: string } {
    const d = new Date(iso);
    const date = d.toLocaleDateString("es-LA", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("es-LA", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    return { date, time };
}

export function TransactionRow({ transaction: tx, timezone = "America/La_Paz", onClick }: TransactionRowProps) {
    const { date, time } = formatDate(tx.occurred_at, timezone);
    const isIncome = tx.type === "income";
    const sign = isIncome ? "+" : "-";
    const amtClass = isIncome ? styles.income : styles.expense;

    return (
        <div className={`${styles.row} ${onClick ? styles.clickable : ''}`} onClick={onClick}>
            <div className={styles.dateCell}>
                <p className={styles.date}>{date}</p>
                <p className={styles.time}>{time}</p>
            </div>
            <div className={styles.mainCell}>
                <span className={styles.categoryIcon}>{tx.category?.icon ?? "💸"}</span>
                <div>
                    <p className={styles.note}>{tx.note ?? "(sin nota)"}</p>
                    {tx.category && (
                        <p className={styles.categoryName}>{tx.category.name}</p>
                    )}
                </div>
            </div>
            <div className={styles.categoryCell}>
                {tx.category && (
                    <Badge variant={isIncome ? "success" : "default"}>{tx.category.name}</Badge>
                )}
            </div>
            <div className={styles.accountCell}>
                <p className={styles.account}>{tx.account.name}</p>
            </div>
            <div className={styles.amountCell}>
                <p className={`${styles.amount} ${amtClass}`}>
                    {sign}Bs {Math.abs(tx.amount_bs).toFixed(2)}
                </p>
            </div>
        </div>
    );
}
