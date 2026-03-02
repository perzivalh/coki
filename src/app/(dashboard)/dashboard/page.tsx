// Dashboard root redirect — /dashboard → /dashboard/today
import { redirect } from "next/navigation";
export default function DashboardPage() {
    redirect("/dashboard/today");
}
