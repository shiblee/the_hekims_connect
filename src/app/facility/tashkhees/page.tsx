import { TashkheesView } from "@/components/facility/views/tashkhees";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  return <TashkheesView patientId={patientId} />;
}
