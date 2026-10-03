"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function FacilityDetailIndexPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/facilities/${id}/overview`);
  }, [id, router]);

  return null;
}
