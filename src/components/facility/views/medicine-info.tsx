"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, BadgeCheck, Info, Loader2 } from "lucide-react";

interface Claim { value: string; verified: boolean }
interface MedicineInfoData {
  label: string; kind: string;
  profile: null | {
    category: string | null;
    names: Record<"unani" | "english" | "urdu" | "hindi" | "arabic" | "botanical" | "family" | "generic" | "salt", Claim | null>;
    synonyms: string[];
    mizaj: Claim | null; partsUsed: Claim | null; summary: Claim | null; traditional: Claim | null; modern: Claim | null; preparation: Claim | null;
    therapeuticClass: Claim | null; pharmacologicalClass: Claim | null; mechanism: Claim | null; rxStatus: Claim | null;
    actions: string[]; forms: string[]; routes: string[]; strengths: string[]; brands: string[];
    ingredients: { label: string; role: string | null; verified: boolean }[];
    uses: { label: string; verified: boolean }[];
    safety: { text: string; category: string; severity: string | null; verified: boolean }[];
    allergies: { label: string; verified: boolean }[];
    notDocumented: string[];
  };
}

const cache = new Map<string, MedicineInfoData>();
const SAFETY_CATS = ["contraindication", "precaution", "pregnancy", "lactation", "pediatric", "adverse_effect", "toxicity", "interaction", "allergy_warning"];
const ROLES = ["principal", "supporting", "base", "vehicle"];
/** Profile field name → the label key used in this pop-up (for "Not documented"). */
const FIELD_KEY: Record<string, string> = {
  unaniName: "mi_unani", englishName: "mi_english", urduName: "mi_urdu", hindiName: "mi_hindi", arabicName: "mi_arabic", botanicalName: "mi_botanical",
  family: "mi_family", partsUsed: "mi_parts", mizaj: "mi_mizaj", preparation: "mi_preparation", summary: "mi_summary", traditionalDescription: "mi_traditional",
  modernEvidence: "mi_modern", actions: "mi_actions", dosageForms: "mi_forms", routes: "mi_routes", brands: "mi_brands", synonyms: "mi_synonyms",
  genericName: "mi_generic", saltForm: "mi_salt", therapeuticClass: "mi_class", pharmacologicalClass: "mi_pharm_class", mechanism: "mi_mechanism",
  rxStatus: "mi_rx_status", strengths: "mi_strengths", ingredients: "mi_ingredients", herbType: "mi_type",
};

export interface PatientNote { level: "high" | "caution" | "info"; text: string; verified: boolean }

/**
 * ⓘ next to a prescribed medicine (or, with `children`, a text link): opens everything the
 * catalogue holds about it, with the safety notes that match this patient on top.
 */
export function MedicineInfoButton({ tagId, name, patientNotes = [], children, className }: {
  tagId: string; name: string; patientNotes?: PatientNote[]; children?: ReactNode; className?: string;
}) {
  const td = useTranslations("clinic.dossier");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedicineInfoData | null>(() => cache.get(tagId) ?? null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (cache.has(tagId)) { setData(cache.get(tagId)!); return; }
    setFailed(false);
    api.get<MedicineInfoData>(`/api/facility/medications/${tagId}/info`)
      .then((d) => { cache.set(tagId, d); setData(d); })
      .catch(() => setFailed(true));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      {children
        ? <button type="button" onClick={() => { setOpen(true); load(); }} className={cn("text-start hover:underline", className)}>{children}</button>
        : (
          <button type="button" onClick={() => { setOpen(true); load(); }} aria-label={td("mi_open", { name })} title={td("mi_open", { name })}
            className="rounded-full p-0.5 text-primary/80 hover:bg-primary/10 hover:text-primary">
            <Info className="h-4 w-4" />
          </button>
        )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{name}</DialogTitle>
          <DialogDescription>{data?.profile?.category ? `${data.profile.category} · ` : ""}{td("mi_from")}</DialogDescription>
        </DialogHeader>
        {patientNotes.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{td("mi_for_patient")}</h3>
            <ul className="space-y-1.5">
              {patientNotes.map((n, i) => (
                <li key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                  n.level === "high" ? "border-destructive/40 bg-destructive/5" : n.level === "caution" ? "border-amber-500/30 bg-amber-500/5" : "border-border/50")}>
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", n.level === "high" ? "text-destructive" : n.level === "caution" ? "text-amber-600" : "text-muted-foreground")} />
                  <span>{n.text}<Mark verified={n.verified} /></span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {failed ? <p className="text-sm text-destructive">{td("mi_failed")}</p>
          : !data ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {td("mi_loading")}</p>
            : !data.profile ? <p className="text-sm text-muted-foreground">{td("mi_none")}</p>
              : <InfoBody p={data.profile} />}
      </DialogContent>
    </Dialog>
  );
}

function Mark({ verified }: { verified: boolean }) {
  const td = useTranslations("clinic.dossier");
  return verified
    ? <span className="ms-1.5 inline-flex items-center gap-0.5 align-middle text-[11px] font-medium text-emerald-700 dark:text-emerald-400"><BadgeCheck className="h-3 w-3" />{td("mi_verified")}</span>
    : <span className="ms-1.5 align-middle rounded-full border border-amber-500/40 px-1.5 text-[11px] text-amber-700 dark:text-amber-400">{td("mi_unverified")}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5 border-t border-border/50 pt-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Pills({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((x) => <span key={x} className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-sm">{x}</span>)}</div>;
}

function InfoBody({ p }: { p: NonNullable<MedicineInfoData["profile"]> }) {
  const td = useTranslations("clinic.dossier");
  const names = (["unani", "english", "urdu", "hindi", "arabic", "botanical", "family", "generic", "salt"] as const).filter((k) => p.names[k]);
  const facts = ([
    ["mi_mizaj", p.mizaj], ["mi_parts", p.partsUsed], ["mi_class", p.therapeuticClass], ["mi_pharm_class", p.pharmacologicalClass], ["mi_rx_status", p.rxStatus],
  ] as const).filter(([, v]) => v);
  const prose = ([
    ["mi_summary", p.summary], ["mi_traditional", p.traditional], ["mi_mechanism", p.mechanism], ["mi_preparation", p.preparation], ["mi_modern", p.modern],
  ] as const).filter(([, v]) => v);
  const lists = ([["mi_actions", p.actions], ["mi_forms", p.forms], ["mi_routes", p.routes], ["mi_strengths", p.strengths], ["mi_brands", p.brands]] as const).filter(([, v]) => v.length);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">{td("mi_note")}</p>

      {p.safety.length > 0 && (
        <Section title={td("mi_safety")}>
          <ul className="space-y-1.5">
            {p.safety.map((s, i) => (
              <li key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                s.severity === "high" || s.category === "contraindication" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5")}>
                <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", s.severity === "high" || s.category === "contraindication" ? "text-destructive" : "text-amber-600")} />
                <span>
                  <span className="font-semibold">{SAFETY_CATS.includes(s.category) ? td(`mi_cat_${s.category}`) : s.category}</span>
                  {s.severity && ["high", "moderate", "low"].includes(s.severity) && <span className="text-muted-foreground"> · {td(`mi_sev_${s.severity}`)}</span>}
                  {" — "}{s.text}<Mark verified={s.verified} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.allergies.length > 0 && (
        <Section title={td("mi_allergies")}>
          <Pills items={p.allergies.map((a) => a.label)} />
        </Section>
      )}

      {names.length > 0 && (
        <Section title={td("mi_names")}>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {names.map((k) => (
              <div key={k}><dt className="inline text-muted-foreground">{td(`mi_${k}`)}: </dt><dd className={cn("inline font-medium", k === "botanical" && "italic")}>{p.names[k]!.value}</dd></div>
            ))}
          </dl>
          {p.synonyms.length > 0 && <p className="text-sm"><span className="text-muted-foreground">{td("mi_synonyms")}: </span>{p.synonyms.join(", ")}</p>}
        </Section>
      )}

      {facts.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1 border-t border-border/50 pt-3 sm:grid-cols-2">
          {facts.map(([k, v]) => <div key={k}><dt className="inline text-muted-foreground">{td(k)}: </dt><dd className="inline font-medium">{v!.value}<Mark verified={v!.verified} /></dd></div>)}
        </dl>
      )}

      {prose.map(([k, v]) => (
        <Section key={k} title={td(k)}>
          <p className="whitespace-pre-line">{v!.value}<Mark verified={v!.verified} /></p>
        </Section>
      ))}

      {p.uses.length > 0 && <Section title={td("mi_uses")}><Pills items={p.uses.map((u) => u.label)} /></Section>}

      {p.ingredients.length > 0 && (
        <Section title={td("mi_ingredients")}>
          <Pills items={p.ingredients.map((x) => (x.role && ROLES.includes(x.role) ? `${x.label} · ${td(`mi_role_${x.role}`)}` : x.label))} />
        </Section>
      )}

      {lists.map(([k, v]) => <Section key={k} title={td(k)}><Pills items={[...v]} /></Section>)}

      {p.notDocumented.length > 0 && (
        <p className="border-t border-border/50 pt-3 text-[13px] text-muted-foreground">
          {td("mi_not_documented", { items: p.notDocumented.map((f) => (FIELD_KEY[f] ? td(FIELD_KEY[f]) : f)).join(", ") })}
        </p>
      )}
    </div>
  );
}
