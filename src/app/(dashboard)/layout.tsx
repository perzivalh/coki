// Dashboard layout — wraps all dashboard pages with AppShell and auth guard
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/ui";
import "@/ui/styles/variables.css";

async function getSession() {
    const cookieStore = await cookies();
    return cookieStore.get("coki_session")?.value ?? null;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const token = await getSession();
    if (!token) redirect("/login");

    return <AppShell>{children}</AppShell>;
}
