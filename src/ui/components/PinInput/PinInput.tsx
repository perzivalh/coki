"use client";
import React, { useRef, useEffect, useCallback } from "react";
import styles from "./PinInput.module.css";

export interface PinInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: boolean;
    disabled?: boolean;
}

export function PinInput({ length = 4, value, onChange, error, disabled }: PinInputProps) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

    const focus = (index: number) => {
        inputs.current[index]?.focus();
    };

    useEffect(() => {
        if (!disabled) focus(Math.min(value.length, length - 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
            if (e.key === "Backspace") {
                e.preventDefault();
                const newVal = value.slice(0, -1);
                onChange(newVal);
                if (index > 0) focus(index - 1);
            } else if (e.key === "ArrowLeft" && index > 0) {
                focus(index - 1);
            } else if (e.key === "ArrowRight" && index < length - 1) {
                focus(index + 1);
            }
        },
        [value, onChange, length]
    );

    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            if (!ch) return;
            const newVal = value.slice(0, index) + ch + value.slice(index + 1);
            onChange(newVal.slice(0, length));
            if (index < length - 1) focus(index + 1);
        },
        [value, onChange, length]
    );

    return (
        <div className={styles.wrapper} role="group" aria-label="PIN input">
            {digits.map((digit, i) => (
                <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInput(e, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onClick={() => focus(i)}
                    className={`${styles.box} ${error ? styles.boxError : ""} ${digit ? styles.boxFilled : ""}`}
                    disabled={disabled}
                    aria-label={`PIN digit ${i + 1}`}
                />
            ))}
        </div>
    );
}
