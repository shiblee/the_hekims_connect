"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Baby, Leaf, ListChecks, Microscope, Siren, Stethoscope } from "lucide-react";
import { FloatingMultiSelect } from "@/components/shared/floating-field";

export interface PickGroup { key: string; label: string; options: string[]; selected: string[]; toggle: (v: string) => void; setAll?: (vals: string[], on: boolean) => void }
const GROUP_ICON: Record<string, typeof Stethoscope> = {
  specialization: Stethoscope, service_diagnostic: Microscope, service_emergency: Siren, service_maternal_child: Baby, service_other: Leaf,
};

/** One search-and-pick field per group (same field as allergies / chief complaints): type or click to see options, chosen ones show as chips. */
export function GroupMultiSelect({ group, error }: { group: PickGroup; error: boolean }) {
  const t = useTranslations("clinic.setup");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const Icon = GROUP_ICON[group.key] ?? ListChecks;
  const results = group.options.filter((o) => !group.selected.includes(o) && (!q || o.toLowerCase().includes(q))).map((o) => ({ id: o, label: o }));
  const chosen = group.options.filter((o) => group.selected.includes(o));
  return (
    <FloatingMultiSelect
      id={`pick-${group.key}`}
      label={chosen.length ? t("n_selected", { count: chosen.length }) : t("search_select")}
      labelIcon={Icon}
      error={error}
      selected={chosen.map((o) => ({ id: o, label: o }))}
      onRemove={(id) => group.toggle(id)}
      query={query}
      onQueryChange={setQuery}
      results={results}
      onPick={(id) => { group.toggle(id); setQuery(""); }}
      openOnFocus
      emptyHint={results.length ? t("n_options", { count: results.length }) : t("all_chosen")}
      placeholder={t("type_search")}
    />
  );
}
