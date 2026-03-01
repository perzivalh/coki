"use client";
import React from "react";
import styles from "./DataTable.module.css";
import { EmptyState } from "@/ui/components/EmptyState/EmptyState";

export interface Column<T> {
    key: keyof T | string;
    header: React.ReactNode;
    render?: (row: T, index: number) => React.ReactNode;
    align?: "left" | "center" | "right";
    width?: string;
}

export interface DataTableProps<T extends object> {
    columns: Column<T>[];
    data: T[];
    rowKey: keyof T | ((row: T) => string);
    loading?: boolean;
    emptyMessage?: string;
}

export function DataTable<T extends object>({
    columns,
    data,
    rowKey,
    loading = false,
    emptyMessage = "No data available",
}: DataTableProps<T>) {
    const getKey = (row: T): string => {
        if (typeof rowKey === "function") return rowKey(row);
        return String(row[rowKey]);
    };

    if (loading) {
        return (
            <div className={styles.loadingWrap}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={styles.skeleton} />
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return <EmptyState message={emptyMessage} />;
    }

    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={String(col.key)}
                                className={styles.th}
                                style={{ width: col.width, textAlign: col.align ?? "left" }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={getKey(row)} className={styles.tr}>
                            {columns.map((col) => (
                                <td
                                    key={String(col.key)}
                                    className={styles.td}
                                    style={{ textAlign: col.align ?? "left" }}
                                >
                                    {col.render
                                        ? col.render(row, index)
                                        : String((row as Record<string, unknown>)[String(col.key)] ?? "")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
