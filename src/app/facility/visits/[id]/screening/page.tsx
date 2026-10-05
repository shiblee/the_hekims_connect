import { ScreeningForm } from "@/components/facility/views/screening-form";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScreeningForm visitId={id} />;
}
