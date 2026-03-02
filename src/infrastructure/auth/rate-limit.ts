// Utility: Auth rate limiter using Supabase login_attempts table
import { supabaseService } from "@/infrastructure/db/supabase/client";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export interface RateLimitResult {
    allowed: boolean;
    retry_after_seconds?: number;
}

export async function checkLoginRateLimit(ipAddress: string): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await supabaseService
        .from("login_attempts")
        .select("attempted_at")
        .eq("ip_address", ipAddress)
        .eq("success", false)
        .gte("attempted_at", windowStart)
        .order("attempted_at", { ascending: false });

    if (error) {
        console.error("[RateLimit] Error checking attempts:", error);
        return { allowed: true }; // fail open
    }

    const failedAttempts = (data ?? []).length;
    if (failedAttempts >= MAX_ATTEMPTS) {
        const oldestInWindow = data![data!.length - 1]?.attempted_at;
        const resetAt = new Date(new Date(oldestInWindow).getTime() + WINDOW_MINUTES * 60 * 1000);
        const retry_after_seconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
        return { allowed: false, retry_after_seconds: Math.max(retry_after_seconds, 0) };
    }

    return { allowed: true };
}

export async function recordLoginAttempt(ipAddress: string, success: boolean): Promise<void> {
    await supabaseService.from("login_attempts").insert({
        ip_address: ipAddress,
        success,
        attempted_at: new Date().toISOString(),
    });
}
