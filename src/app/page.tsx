import { redirect } from "next/navigation";

// Root redirect: / → /login
export default function RootPage() {
  redirect("/login");
}
