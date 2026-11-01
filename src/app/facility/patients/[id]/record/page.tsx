import { PatientDetail } from "@/components/facility/views/patient-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Small text a notch larger on the record (see .text-up-lg in globals.css).
  return (
    <div className="text-up-lg">
      <PatientDetail patientId={id} />
    </div>
  );
}
