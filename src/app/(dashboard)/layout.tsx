// Dashboard layout — wraps all dashboard pages with AppShell
// Auth guard is handled by src/middleware.ts (Edge runtime, required for Cloudflare Pages)
import { AppShell } from "@/ui";
import "@/ui/styles/variables.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}
