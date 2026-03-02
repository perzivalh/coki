// Domain Entity: DailySummary
export type DailySummaryStatus = "pending" | "sent" | "failed";

export interface DailySummary {
    id: string;
    date: string; // YYYY-MM-DD
    sent_at: string | null;
    payload_json: Record<string, unknown> | null;
    delivery_status: DailySummaryStatus;
}
