"use client";
import React, { useId } from "react";
import styles from "./Input.module.css";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
}

export function Input({ label, error, hint, leftIcon, className = "", id: propId, ...rest }: InputProps) {
    const generatedId = useId();
    const id = propId ?? generatedId;

    return (
        <div className={styles.wrapper}>
            {label && (
                <label className={styles.label} htmlFor={id}>
                    {label}
                </label>
            )}
            <div className={styles.inputWrap}>
                {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
                <input
                    id={id}
                    className={[
                        styles.input,
                        leftIcon ? styles.withIcon : "",
                        error ? styles.error : "",
                        className,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    {...rest}
                />
            </div>
            {error && <span className={styles.errorMsg}>{error}</span>}
            {!error && hint && <span className={styles.hint}>{hint}</span>}
        </div>
    );
}
