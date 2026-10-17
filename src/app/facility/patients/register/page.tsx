import { PatientRegistrationWizard } from "@/components/facility/views/patient-registration-wizard";

export default async function Page({ searchParams }: { searchParams: Promise<{ visitId?: string }> }) {
  const { visitId } = await searchParams;
  return <PatientRegistrationWizard visitId={visitId} />;
}
