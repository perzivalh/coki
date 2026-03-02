"use client";
import React from "react";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
    value: number; // 0-100
    label?: string;
    sublabel?: string;
    rightLabel?: string;
    color?: string;
}

export function ProgressBar({ value, label, sublabel, rightLabel, color }: ProgressBarProps) {
    const pct = Math.min(Math.max(value, 0), 100);

    return (
        <div className={styles.wrapper}>
            {(label || rightLabel) && (
                <div className={styles.header}>
                    <div>
                        {label && <p className={styles.label}>{label}</p>}
                        {sublabel && <p className={styles.sublabel}>{sublabel}</p>}
                    </div>
                    {rightLabel && <p className={styles.rightLabel}>{rightLabel}</p>}
                </div>
            )}
            <div className={styles.track}>
                <div
                    className={styles.fill}
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    );
}
