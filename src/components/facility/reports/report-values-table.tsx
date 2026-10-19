"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { ReportValue } from "@/lib/reports";
import { ArrowDown, ArrowUp } from "lucide-react";

/** Test values as printed on a report — out-of-range ones highlighted first so they're seen at a glance. */
export function ReportValuesTable({ values }: { values: ReportValue[] }) {
  const t = useTranslations("clinic.reports");
  const isOff = (v: ReportValue) => v.flag === "high" || v.flag === "low" || v.flag === "abnormal";
  const sorted = [...values].sort((a, b) => Number(isOff(b)) - Number(isOff(a)));
  const offCount = values.filter(isOff).length;
  return (
    <div className="space-y-2">
      {offCount > 0 && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("off_range", { off: offCount, total: values.length })}</p>
      )}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr className="text-start">
              <th className="px-3 py-2 font-medium">{t("col_test")}</th>
              <th className="px-3 py-2 font-medium text-end">{t("col_result")}</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">{t("col_reference")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, i) => {
              const off = isOff(v);
              return (
                <tr key={`${v.name}-${i}`} className={cn("border-t border-border/40", off && "bg-amber-500/5")}>
                  <td className="px-3 py-1.5">{v.name}</td>
                  <td className={cn("px-3 py-1.5 text-end font-semibold whitespace-nowrap", off && "text-amber-600 dark:text-amber-400")}>
                    <span className="inline-flex items-center gap-1">
                      {v.flag === "high" && <ArrowUp className="h-3 w-3" />}
                      {v.flag === "low" && <ArrowDown className="h-3 w-3" />}
                      {v.value}
                      {v.unit && <span className="text-xs font-normal text-muted-foreground">{v.unit}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground hidden sm:table-cell">{v.range || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
