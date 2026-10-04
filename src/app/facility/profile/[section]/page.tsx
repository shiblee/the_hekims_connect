import { notFound } from "next/navigation";
import { ProfileView } from "@/components/facility/views/profile";

const VALID_SECTIONS = ["overview", "location", "capacity", "services", "staff"];

export default async function FacilityProfileSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section)) notFound();
  return <ProfileView section={section} />;
}
