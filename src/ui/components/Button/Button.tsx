"use client";
import React from "react";
import "@/ui/styles/components.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    children,
    className = "",
    disabled,
    ...rest
}: ButtonProps) {
    const classes = [
        "btn",
        `btn--${variant}`,
        size !== "md" ? `btn--${size}` : "",
        loading ? "btn--loading" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button className={classes} disabled={disabled || loading} {...rest}>
            {!loading && icon && <span className="btn__icon">{icon}</span>}
            {children}
        </button>
    );
}
