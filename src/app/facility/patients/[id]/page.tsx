import { PatientRegistrationWizard } from "@/components/facility/views/patient-registration-wizard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Small text a notch larger (see .text-up-lg in globals.css; the same size on all five steps).
  return <div className="text-up-lg"><PatientRegistrationWizard patientId={id} /></div>;
}
