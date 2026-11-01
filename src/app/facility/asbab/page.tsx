import { AsbabView } from "@/components/facility/views/asbab";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  // Small text a notch larger on the clinical steps (see .text-up in globals.css).
  return <div className="text-up"><AsbabView patientId={patientId} /></div>;
}
