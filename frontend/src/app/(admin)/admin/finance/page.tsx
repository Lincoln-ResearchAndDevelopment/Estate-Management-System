import { redirect } from "next/navigation";

// Finance lives in its own workspace (payments, outstanding, analytics, services, reports).
export default function AdminFinanceRedirect() {
  redirect("/finance");
}
