import { MizajView } from "@/components/facility/views/mizaj";

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  return <MizajView initialPatientId={patientId} />;
}
