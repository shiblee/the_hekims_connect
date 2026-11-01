import { MizajView } from "@/components/facility/views/mizaj";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  // Small text a notch larger on the clinical steps (see .text-up-lg in globals.css; the same size on all five steps).
  return <div className="text-up-lg"><MizajView initialPatientId={patientId} /></div>;
}
