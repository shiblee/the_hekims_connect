import { PatientsView } from "@/components/facility/views/patients";

export default function Page() {
  // Small text a notch larger (see .text-up-lg in globals.css; the same size as the patient steps).
  return <div className="text-up-lg"><PatientsView /></div>;
}
