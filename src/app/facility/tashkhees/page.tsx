import { TashkheesView } from "@/components/facility/views/tashkhees";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  // Small text a notch larger on the clinical steps (see .text-up in globals.css).
  return <div className="text-up"><TashkheesView patientId={patientId} /></div>;
}
