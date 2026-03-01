"use client";
import React, { useState } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
    key: string;
    label: React.ReactNode;
    content: React.ReactNode;
    disabled?: boolean;
}

export interface TabsProps {
    items: TabItem[];
    defaultKey?: string;
    onChange?: (key: string) => void;
}

export function Tabs({ items, defaultKey, onChange }: TabsProps) {
    const [active, setActive] = useState(defaultKey ?? items[0]?.key ?? "");

    const handleClick = (key: string) => {
        setActive(key);
        onChange?.(key);
    };

    const current = items.find((i) => i.key === active);

    return (
        <div className={styles.wrapper}>
            <div className={styles.tabList} role="tablist">
                {items.map((item) => (
                    <button
                        key={item.key}
                        role="tab"
                        aria-selected={active === item.key}
                        aria-controls={`tabpanel-${item.key}`}
                        className={`${styles.tab} ${active === item.key ? styles.tabActive : ""}`}
                        onClick={() => handleClick(item.key)}
                        disabled={item.disabled}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div
                role="tabpanel"
                id={`tabpanel-${active}`}
                className={styles.panel}
            >
                {current?.content}
            </div>
        </div>
    );
}
