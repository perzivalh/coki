"use client";
import React from "react";
import styles from "./Card.module.css";

export interface CardProps {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    padding?: "none" | "sm" | "md";
    className?: string;
}

export function Card({ title, subtitle, actions, children, padding = "md", className = "" }: CardProps) {
    return (
        <div className={`${styles.card} ${className}`}>
            {(title || actions) && (
                <div className={styles.header}>
                    <div>
                        {title && <h3 className={styles.title}>{title}</h3>}
                        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    </div>
                    {actions && <div className={styles.actions}>{actions}</div>}
                </div>
            )}
            <div className={`${styles.body} ${styles[`body--${padding}`]}`}>{children}</div>
        </div>
    );
}
