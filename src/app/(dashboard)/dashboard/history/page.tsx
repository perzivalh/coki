"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Input, EmptyState, Pagination, TransactionRow, Button, EditTransactionModal } from "@/ui";
import styles from "./page.module.css";
import type { TransactionWithRelations } from "@/domain/entities/transaction";

const LIMIT = 20;

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTx, setEditingTx] = useState<TransactionWithRelations | null>(null);
    const [q, setQ] = useState("");
    const [deferredQ, setDeferredQ] = useState("");
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
    const [page, setPage] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const load = useCallback(async (cursor: string | null, search: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT) });
            if (cursor) params.set("cursor", cursor);
            if (search) params.set("q", search);
            const res = await fetch(`/api/finance/transactions?${params.toString()}`);
            if (!res.ok) return;
            const data = await res.json() as { data: TransactionWithRelations[]; has_more: boolean; next_cursor: string | null; total_count: number; };
            setTransactions(data.data);
            setHasMore(data.has_more);
            setNextCursor(data.next_cursor);
            setTotalCount(data.total_count);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { const t = setTimeout(() => setDeferredQ(q), 400); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setCursorStack([null]); setPage(0); void load(null, deferredQ); }, [deferredQ, load]);

    function handleNext() { const s = [...cursorStack, nextCursor]; setCursorStack(s); setPage(page + 1); void load(nextCursor, deferredQ); }
    function handlePrev() { const s = cursorStack.slice(0, -1); setCursorStack(s); setPage(page - 1); void load(s[s.length - 1] ?? null, deferredQ); }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Transaction History</h1>
                    <p className={styles.subtitle}>Tus gastos e ingresos registrados</p>
                </div>
                <Button variant="secondary" id="add-transaction-btn">+ Añadir</Button>
            </div>
            <div className={styles.toolbar}>
                <Input id="history-search" placeholder="Buscar descripción, categoría..." value={q} onChange={(e) => setQ(e.target.value)} className={styles.searchInput} />
            </div>
            <div className={styles.tableWrapper}>
                <div className={styles.tableHeader}>
                    <span>FECHA/HORA</span><span>DESCRIPCIÓN</span><span>CATEGORÍA</span><span>CUENTA</span><span style={{ textAlign: "right" }}>MONTO</span>
                </div>
                {loading ? (
                    <div className={styles.skeletons}>{[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}</div>
                ) : transactions.length === 0 ? (
                    <EmptyState icon="📄" title="Sin transacciones" message={deferredQ ? `No se encontró "${deferredQ}"` : "Aún no hay transacciones registradas."} />
                ) : (
                    transactions.map((tx) => (
                        <TransactionRow
                            key={tx.id}
                            transaction={tx}
                            onClick={() => setEditingTx(tx)}
                        />
                    ))
                )}
                {!loading && transactions.length > 0 && (
                    <Pagination totalCount={totalCount} hasMore={hasMore} hasPrev={page > 0} onNext={handleNext} onPrev={handlePrev} />
                )}
            </div>

            {editingTx && (
                <EditTransactionModal
                    transaction={editingTx}
                    onClose={() => setEditingTx(null)}
                    onSaved={() => {
                        setEditingTx(null);
                        void load(null, deferredQ); // Reload current search/filter state
                    }}
                />
            )}
        </div>
    );
}
