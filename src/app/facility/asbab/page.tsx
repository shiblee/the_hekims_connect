import { AsbabView } from "@/components/facility/views/asbab";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  return <AsbabView patientId={patientId} />;
}
