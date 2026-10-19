import { redirect } from "next/navigation";

// Staff share the clinic login page (they sign in there with a one-time code).
export default function StaffLoginPage() {
  redirect("/login/facility");
}
