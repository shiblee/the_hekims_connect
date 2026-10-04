import { redirect } from "next/navigation";

export default function PatientIndex() {
  redirect("/patient/dashboard");
}
