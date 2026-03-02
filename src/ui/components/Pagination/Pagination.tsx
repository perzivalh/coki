"use client";
import React from "react";
import styles from "./Pagination.module.css";

export interface PaginationProps {
    totalCount: number;
    hasMore: boolean;
    onNext: () => void;
    onPrev: () => void;
    hasPrev: boolean;
}

export function Pagination({
    totalCount,
    hasMore,
    onNext,
    onPrev,
    hasPrev,
}: PaginationProps) {
    return (
        <div className={styles.wrapper}>
            <p className={styles.info}>
                {totalCount > 0 ? `${totalCount} resultado${totalCount !== 1 ? "s" : ""}` : "Sin resultados"}
            </p>
            <div className={styles.controls}>
                <button
                    className={styles.btn}
                    onClick={onPrev}
                    disabled={!hasPrev}
                    aria-label="Previous page"
                >
                    ‹ Anterior
                </button>
                <button
                    className={styles.btn}
                    onClick={onNext}
                    disabled={!hasMore}
                    aria-label="Next page"
                >
                    Siguiente ›
                </button>
            </div>
        </div>
    );
}
