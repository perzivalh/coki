"use client";
import React, { useId } from "react";
import styles from "./Select.module.css";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    placeholder?: string;
}

export function Select({ label, options, error, hint, placeholder, className = "", id: propId, ...rest }: SelectProps) {
    const generatedId = useId();
    const id = propId ?? generatedId;

    return (
        <div className={styles.wrapper}>
            {label && <label className={styles.label} htmlFor={id}>{label}</label>}
            <div className={styles.selectWrap}>
                <select
                    id={id}
                    className={[styles.select, error ? styles.error : "", className].filter(Boolean).join(" ")}
                    {...rest}
                >
                    {placeholder && <option value="" disabled>{placeholder}</option>}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <span className={styles.arrow}>▾</span>
            </div>
            {error && <span className={styles.errorMsg}>{error}</span>}
            {!error && hint && <span className={styles.hint}>{hint}</span>}
        </div>
    );
}
