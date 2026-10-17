import { PatientDetail } from "@/components/facility/views/patient-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientDetail patientId={id} />;
}
