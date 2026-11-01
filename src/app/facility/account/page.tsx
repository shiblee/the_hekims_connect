import { redirect } from "next/navigation";

// The staff profile now lives in Facility Profile → My profile.
export default function Page() {
  redirect("/facility/profile/account");
}
