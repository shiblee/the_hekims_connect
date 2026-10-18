import { AssessmentReport } from "@/components/facility/report/assessment-report";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ visit?: string }> }) {
  const { id } = await params;
  const { visit } = await searchParams;
  return <AssessmentReport patientId={id} visitId={visit} />;
}
