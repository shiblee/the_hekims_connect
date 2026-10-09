import { ConsultationForm } from "@/components/facility/views/consultation-form";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsultationForm visitId={id} />;
}
