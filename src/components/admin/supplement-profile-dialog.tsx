"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2, RefreshCw, TriangleAlert, ShieldCheck, Stethoscope, Factory, FlaskConical, Leaf, Check, X, RotateCcw,
  History, Link2, Search, Pause, Play, Square, CircleHelp, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- types

interface Ref { n: number; snippet: string | null }
interface Prov {
  id: string; rationale: string | null; evidenceType: string; verificationStatus: string;
  confidence: number | null; provenance: string; reviewNote: string | null; refs: Ref[];
}
interface FieldRow { field: string; value: any; verificationStatus: string; confidence: number | null; provenance: string; note: string | null; refs: Ref[] }
interface Profile {
  kind: "supplement" | "medication";
  status: string; errorMessage: string | null; enrichedAt: string | null; enrichmentVersion: number; completeness: number;
  category: string | null; unknownFields: string[]; legacyCautions: string[]; legacyIngredients: string[]; unmatchedUses: string[];
  fields: FieldRow[];
  complaints: (Prov & { label: string; relationType: string; targetActive: boolean })[];
  symptoms: (Prov & { label: string; targetActive: boolean })[];
  allergies: (Prov & { label: string; relation: string; targetActive: boolean })[];
  ingredients: (Prov & { label: string; linkedTag: { id: string; label: string } | null; role: string | null; proportion: string | null })[];
  safety: (Prov & { label: string; category: string; severity: string | null; medication: { id: string; label: string } | null })[];
  sources: { n: number; url: string; title: string | null; domain: string }[];
}
interface Revision { id: string; reason: string; summary: string | null; createdAt: string; actorName: string | null }
type Review = (subjectType: string, subjectKey: string, status: "verified" | "rejected" | "unverified") => void;

const FIELD_LABELS: Record<string, string> = {
  herbType: "Category", unaniName: "Unani name", englishName: "English name", urduName: "Urdu name", hindiName: "Hindi name",
  arabicName: "Arabic name", botanicalName: "Botanical name", family: "Botanical family", partsUsed: "Part used", mizaj: "Mizaj (temperament)",
  synonyms: "Synonyms", actions: "Actions (Afaal)", dosageForms: "Dosage forms", routes: "Administration routes", brands: "Brands",
  preparation: "Preparation", summary: "Summary", traditionalDescription: "Traditional Unani description", modernEvidence: "Modern scientific evidence",
  genericName: "Generic name (INN)", saltForm: "Salt / chemical form", therapeuticClass: "Therapeutic class", pharmacologicalClass: "Pharmacological class",
  mechanism: "Mechanism of action", atcCode: "ATC code", rxStatus: "Prescription status", productStatus: "Product status", strengths: "Available strengths & formulations",
};
const RELATION_LABELS: Record<string, string> = {
  approved_indication: "Approved indication", evidence_supported: "Evidence-supported use", symptom_relief: "Symptom relief",
  off_label: "Off-label", not_recommended: "Not recommended",
};
const SAFETY_LABELS: Record<string, string> = {
  contraindication: "Contraindications", precaution: "Precautions", pregnancy: "Pregnancy", lactation: "Breastfeeding",
  pediatric: "Children", adverse_effect: "Adverse effects", toxicity: "Toxicity / overdose", interaction: "Drug interactions", allergy_warning: "Allergy & hypersensitivity warnings",
  warning: "Warnings", geriatric: "Older adults", renal: "Kidney impairment", hepatic: "Liver impairment", monitoring: "Monitoring", food_interaction: "Food interactions",
};
const UNKNOWN_LABELS: Record<string, string> = {
  pregnancy: "Pregnancy", lactation: "Breastfeeding", pediatric: "Children", interactions: "Drug interactions", allergy: "Allergy",
  renal: "Kidney impairment", hepatic: "Liver impairment",
};
const EVIDENCE_LABELS: Record<string, string> = { traditional: "Traditional", clinical: "Clinical", preclinical: "Preclinical", regulatory: "Label / pharmacopoeia / regulator", unspecified: "Evidence unspecified" };

// ---------------------------------------------------------------- small pieces

function StatusPill({ status, hasRefs, provenance }: { status: string; hasRefs: boolean; provenance: string }) {
  const map: Record<string, [string, string]> = {
    verified: ["Verified", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"],
    rejected: ["Rejected", "bg-muted text-muted-foreground border-border"],
    conflict: ["Conflicting sources", "bg-destructive/10 text-destructive border-destructive/30"],
    unverified: ["Unverified", "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"],
  };
  const [label, cls] = map[status] ?? map.unverified;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <Badge variant="outline" className={cn("text-[10px] font-normal px-1.5 py-0", cls)}>{label}</Badge>
      {!hasRefs && status !== "verified" && (
        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground" title={provenance === "legacy" ? "Model knowledge only — not search-backed" : "No source matched this claim"}>
          No source
        </Badge>
      )}
    </span>
  );
}

function Refs({ refs, sources }: { refs: Ref[]; sources: Profile["sources"] }) {
  if (!refs.length) return null;
  return (
    <span className="inline-flex gap-0.5 align-super">
      {refs.map((r) => {
        const s = sources.find((x) => x.n === r.n);
        return (
          <a key={r.n} href={s?.url} target="_blank" rel="noreferrer" title={s ? `${s.domain}${s.title && s.title !== s.domain ? ` — ${s.title}` : ""}` : undefined}
            className="text-[10px] font-semibold text-primary hover:underline">[{r.n}]</a>
        );
      })}
    </span>
  );
}

function ReviewButtons({ status, onReview }: { status: string; onReview: (s: "verified" | "rejected" | "unverified") => void }) {
  if (status === "verified" || status === "rejected") {
    return (
      <button type="button" onClick={() => onReview("unverified")} title="Undo review" className="text-muted-foreground hover:text-foreground p-1 rounded">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <span className="inline-flex gap-0.5 shrink-0">
      <button type="button" onClick={() => onReview("verified")} title="Verify" className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => onReview("rejected")} title="Reject" className="p-1 rounded text-destructive hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function Section({ icon: Icon, title, children, hint }: { icon: typeof Leaf; title: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ClaimRow({ subjectType, row, sources, onReview, children }: {
  subjectType: string; row: Prov; sources: Profile["sources"]; onReview: Review; children: ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2", row.verificationStatus === "rejected" && "opacity-55")}>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className={cn("text-sm", row.verificationStatus === "rejected" && "line-through")}>{children} <Refs refs={row.refs} sources={sources} /></div>
        {row.rationale && <p className="text-xs text-muted-foreground">{row.rationale}</p>}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <StatusPill status={row.verificationStatus} hasRefs={row.refs.length > 0} provenance={row.provenance} />
          {row.provenance !== "legacy" && <span className="text-[10px] text-muted-foreground">{EVIDENCE_LABELS[row.evidenceType] ?? row.evidenceType}</span>}
          {row.confidence != null && <span className="text-[10px] text-muted-foreground">· confidence {Math.round(row.confidence * 100)}%</span>}
        </div>
      </div>
      <ReviewButtons status={row.verificationStatus} onReview={(s) => onReview(subjectType, row.id, s)} />
    </div>
  );
}

function NotDocumented({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
      <CircleHelp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span><span className="font-medium text-foreground/80">{label}:</span> not documented in the sources found — this is not evidence that it is safe.</span>
    </div>
  );
}

const display = (v: any) => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : [x.manufacturer, x.product].filter(Boolean).join(" — "))).join(" · ");
  return v ?? "";
};

// ---------------------------------------------------------------- profile dialog

/** Reference profile for one Supplement / Herb or allopathic Medication: claims with sources, review actions and history. */
export function SupplementProfileDialog({ tagId, onOpenChange, onEnriched }: {
  tagId: string | null;
  onOpenChange: (open: boolean) => void;
  onEnriched?: () => void;
}) {
  const [label, setLabel] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [queued, setQueued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState("overview");

  const load = useCallback((id: string, quiet = false) => {
    if (!quiet) setLoading(true);
    return adminApi.get<{ tag: { label: string }; profile: Profile | null; revisions: Revision[]; queued: boolean }>(`/api/admin/supplement-profiles/${id}`)
      .then((res) => { setLabel(res.tag.label); setProfile(res.profile); setRevisions(res.revisions); setQueued(res.queued); return res.queued; })
      .catch((e) => { toast.error(e.message || "Could not load this profile"); return false; })
      .finally(() => setLoading(false));
  }, []);

  // Only load on open — keep the last profile on close so the fade-out
  // animation doesn't flash a misleading "not built yet" state.
  useEffect(() => { if (tagId) { setTab("overview"); load(tagId); } }, [tagId, load]);

  // While a refresh is queued/running, poll until it lands.
  useEffect(() => {
    if (!tagId || !queued) return;
    const t = setInterval(async () => {
      const still = await load(tagId, true);
      if (!still) { onEnriched?.(); toast.success("Profile updated"); }
    }, 6000);
    return () => clearInterval(t);
  }, [tagId, queued, load, onEnriched]);

  const refresh = async () => {
    if (!tagId) return;
    setStarting(true);
    try {
      await adminApi.post(`/api/admin/supplement-profiles/${tagId}/enrich`, {});
      setQueued(true);
      toast.success("Researching — this takes 1-2 minutes. Verified and rejected items are kept.");
    } catch (e: any) {
      toast.error(e.message || "Could not start the refresh");
    } finally {
      setStarting(false);
    }
  };

  const review: Review = async (subjectType, subjectKey, status) => {
    if (!tagId) return;
    try {
      await adminApi.post(`/api/admin/supplement-profiles/${tagId}/review`, { subjectType, subjectKey, status });
      await load(tagId, true);
      onEnriched?.();
    } catch (e: any) {
      toast.error(e.message || "Could not save the review");
    }
  };

  const p = profile;
  const sourced = (p?.enrichmentVersion ?? 0) >= 2;
  const hasData = p?.status === "enriched";
  const pendingSafety = p ? p.safety.filter((s) => s.verificationStatus === "unverified" || s.verificationStatus === "conflict").length : 0;
  const isMed = p?.kind === "medication";

  return (
    <Dialog open={tagId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
            {label || "Profile"}
            {p?.category && <Badge variant="outline" className="text-[10px] font-normal">{p.category}</Badge>}
            {p && hasData && (sourced
              ? <Badge variant="outline" className="text-[10px] font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"><Search className="h-2.5 w-2.5 mr-1" />Search-backed · {p.completeness}% complete</Badge>
              : <Badge variant="outline" className="text-[10px] font-normal text-amber-700 dark:text-amber-400 border-amber-500/30">Not yet sourced</Badge>)}
          </DialogTitle>
        </DialogHeader>

        {queued && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Researching sources for this item — it updates here automatically (usually 1-2 minutes).
          </div>
        )}
        {p?.errorMessage && !queued && (
          <p className="text-xs text-destructive">Last refresh failed: {p.errorMessage}</p>
        )}

        {loading && !p ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !p || !hasData ? (
          <p className="text-sm text-muted-foreground py-2">
            {p?.status === "failed" ? `The profile couldn't be built yet: ${p.errorMessage || "unknown error"}` : `This item's ${isMed ? "medication" : "Unani"} profile hasn't been built yet — it's queued, or you can build it now.`}
          </p>
        ) : (
          <>
            {!sourced && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                This profile came from model knowledge only — none of it has sources yet. Use &quot;Research with sources&quot; to rebuild it from search-backed references.
              </div>
            )}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="relationships">Relationships</TabsTrigger>
                <TabsTrigger value="safety">Safety{pendingSafety > 0 && <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 text-[10px]">{pendingSafety}</span>}</TabsTrigger>
                <TabsTrigger value="sources">Sources ({p.sources.length})</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <FieldList p={p} onReview={review} />
                {p.legacyIngredients.length > 0 && (
                  <Section icon={FlaskConical} title="Key ingredients (unsourced)"><p className="text-sm">{p.legacyIngredients.join(" · ")}</p></Section>
                )}
              </TabsContent>

              <TabsContent value="relationships" className="space-y-5 mt-4">
                <Section icon={Stethoscope} title={isMed ? "Indications & uses — chief complaints" : "Traditionally used for — chief complaints"}
                  hint={isMed ? "Approved indications are kept apart from evidence-supported, symptom-relief and off-label uses." : undefined}>
                  {p.complaints.length ? p.complaints.map((r) => (
                    <ClaimRow key={r.id} subjectType="complaint" row={r} sources={p.sources} onReview={review}>
                      {isMed && RELATION_LABELS[r.relationType] && (
                        <Badge variant="outline" className={cn("mr-1.5 text-[10px] font-normal",
                          r.relationType === "approved_indication" ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                            : r.relationType === "not_recommended" ? "text-destructive border-destructive/40" : "text-muted-foreground")}>
                          {RELATION_LABELS[r.relationType]}
                        </Badge>
                      )}
                      {r.label}{!r.targetActive && <span className="text-xs text-muted-foreground"> (complaint inactive)</span>}
                    </ClaimRow>
                  )) : <p className="text-sm text-muted-foreground">—</p>}
                  {p.unmatchedUses.length > 0 && <p className="text-xs text-muted-foreground">Also documented, not yet in the complaint list: {p.unmatchedUses.join(" · ")}</p>}
                </Section>
                {p.symptoms.length > 0 && (
                  <Section icon={Stethoscope} title="Accompanying acute symptoms (Alamat-e-Izafiya)">
                    {p.symptoms.map((r) => <ClaimRow key={r.id} subjectType="symptom" row={r} sources={p.sources} onReview={review}>{r.label}</ClaimRow>)}
                  </Section>
                )}
                <Section icon={ShieldCheck} title={isMed ? "Used to treat allergic reactions to" : "May help ease reactions to"}>
                  {p.allergies.filter((a) => a.relation === "relief").length
                    ? p.allergies.filter((a) => a.relation === "relief").map((r) => <ClaimRow key={r.id} subjectType="allergy" row={r} sources={p.sources} onReview={review}>{r.label}</ClaimRow>)
                    : <p className="text-sm text-muted-foreground">—</p>}
                </Section>
                {(p.ingredients.length > 0 || p.category?.startsWith("Compound") || isMed) && (
                  <Section icon={FlaskConical} title={isMed ? "Active ingredients & composition" : "Ingredients"}
                    hint={isMed ? "Strength per unit where documented. Linked ingredients point at their own Allopathic Medicine record." : "Linked ingredients point at their own Unani Medicine record."}>
                    {p.ingredients.length ? p.ingredients.map((r) => (
                      <ClaimRow key={r.id} subjectType="ingredient" row={r} sources={p.sources} onReview={review}>
                        <span className="font-medium">{r.label}</span>
                        {r.role && r.role !== "unknown" && <span className="text-xs text-muted-foreground"> · {r.role}</span>}
                        {r.proportion && <span className="text-xs text-muted-foreground"> · {r.proportion}</span>}
                        {r.linkedTag && <Badge variant="outline" className="ml-1.5 text-[10px] font-normal"><Link2 className="h-2.5 w-2.5 mr-1" />{r.linkedTag.label}</Badge>}
                      </ClaimRow>
                    )) : <p className="text-sm text-muted-foreground">—</p>}
                  </Section>
                )}
              </TabsContent>

              <TabsContent value="safety" className="space-y-5 mt-4">
                <p className="text-xs text-muted-foreground">Every safety statement needs a reviewer&apos;s verification before it is relied on clinically.</p>
                <SafetyList p={p} onReview={review} />
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                {p.sources.length ? (
                  <ol className="space-y-2">
                    {p.sources.map((s) => (
                      <li key={s.n} className="text-sm flex gap-2">
                        <span className="text-xs font-semibold text-primary w-6 shrink-0">[{s.n}]</span>
                        <div className="min-w-0">
                          <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:underline break-all">{s.title && s.title !== s.domain ? s.title : s.domain}</a>
                          <p className="text-xs text-muted-foreground break-all">{s.url}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">No sources yet.</p>}
                <p className="text-[11px] text-muted-foreground mt-4">Sources are the web pages the search actually read for each claim. A source being listed does not mean it is authoritative — check it before verifying.</p>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <HistoryTab tagId={tagId!} revisions={revisions} onRestored={() => { load(tagId!, true); onEnriched?.(); }} />
              </TabsContent>
            </Tabs>

            <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-3">
              {isMed
                ? "Reference information compiled by Hakeem Insight from search results — unverified until a reviewer verifies it. It supports clinical review only and is never a prescription; dosing instructions are intentionally not included."
                : "Reference information compiled by Hakeem Insight from search results — unverified until a reviewer verifies it. Traditional use is not proof of clinical benefit. Dosage is intentionally not included."}
              {p.enrichedAt && ` Last updated ${new Date(p.enrichedAt).toLocaleString()}.`}
            </p>
          </>
        )}

        <div className="flex justify-end pt-1">
          <Button size="sm" variant="outline" onClick={refresh} disabled={starting || loading || queued}>
            {starting || queued ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sourced ? <RefreshCw className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
            {sourced ? "Refresh with sources" : "Research with sources"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldList({ p, onReview }: { p: Profile; onReview: Review }) {
  const isNutritional = p.category === "Nutritional Supplement";
  const isHerb = p.category?.startsWith("Single Herb");
  const hidden = new Set(p.kind === "medication" ? [] : [
    ...(!isHerb ? ["botanicalName", "family", "partsUsed"] : []),
    ...(isNutritional ? ["mizaj", "urduName", "hindiName", "arabicName", "traditionalDescription"] : []),
  ]);
  const long = new Set(["summary", "traditionalDescription", "modernEvidence", "preparation", "mechanism"]);
  const rows = p.fields.filter((f) => !hidden.has(f.field) || (Array.isArray(f.value) ? f.value.length : f.value));
  const row = (f: FieldRow) => {
    const empty = Array.isArray(f.value) ? !f.value.length : !f.value;
    const unknown = p.unknownFields.includes(f.field);
    return (
      <div key={f.field} className={cn("rounded-lg border border-border/50 bg-background/40 px-3 py-2", f.verificationStatus === "rejected" && "opacity-55")}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">{FIELD_LABELS[f.field] ?? f.field}</p>
            {empty ? (
              <p className="text-sm text-muted-foreground">{unknown ? "Not documented in the sources found" : "—"}</p>
            ) : (
              <p className={cn("text-sm", f.field === "botanicalName" && "italic", long.has(f.field) && "leading-relaxed", f.verificationStatus === "rejected" && "line-through")}>
                {display(f.value)} <Refs refs={f.refs} sources={p.sources} />
              </p>
            )}
            {f.note && <p className="text-xs text-destructive mt-1">{f.note}</p>}
            {!empty && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <StatusPill status={f.verificationStatus} hasRefs={f.refs.length > 0} provenance={f.provenance} />
                {f.confidence != null && <span className="text-[10px] text-muted-foreground">confidence {Math.round(f.confidence * 100)}%</span>}
              </div>
            )}
          </div>
          {!empty && <ReviewButtons status={f.verificationStatus} onReview={(s) => onReview("field", f.field, s)} />}
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-2">{rows.filter((f) => !long.has(f.field)).map(row)}</div>
      <div className="space-y-2">{rows.filter((f) => long.has(f.field)).map(row)}</div>
    </div>
  );
}

function SafetyList({ p, onReview }: { p: Profile; onReview: Review }) {
  const cautions = p.allergies.filter((a) => a.relation === "caution");
  const byCat = (c: string) => p.safety.filter((s) => s.category === c);
  const order = p.kind === "medication"
    ? ["contraindication", "warning", "allergy_warning", "pregnancy", "lactation", "pediatric", "geriatric", "renal", "hepatic", "interaction", "food_interaction", "monitoring", "precaution", "adverse_effect", "toxicity"]
    : ["contraindication", "pregnancy", "lactation", "pediatric", "interaction", "allergy_warning", "precaution", "adverse_effect", "toxicity"];
  const unknownFor: Record<string, string> = { pregnancy: "pregnancy", lactation: "lactation", pediatric: "pediatric", interaction: "interactions", renal: "renal", hepatic: "hepatic" };
  return (
    <>
      {order.map((c) => {
        const rows = byCat(c);
        const unknown = unknownFor[c] && p.unknownFields.includes(unknownFor[c]);
        if (!rows.length && !unknown) return null;
        return (
          <Section key={c} icon={TriangleAlert} title={SAFETY_LABELS[c]}>
            {rows.map((r) => (
              <ClaimRow key={r.id} subjectType="safety" row={{ ...r, rationale: null }} sources={p.sources} onReview={onReview}>
                {r.severity && <Badge variant="outline" className={cn("mr-1.5 text-[10px] font-normal", r.severity === "high" ? "text-destructive border-destructive/40" : "text-muted-foreground")}>{r.severity}</Badge>}
                {r.medication && <span className="font-medium">{r.medication.label}: </span>}
                {r.label}
              </ClaimRow>
            ))}
            {!rows.length && unknown && <NotDocumented label={UNKNOWN_LABELS[unknownFor[c]]} />}
          </Section>
        );
      })}
      <Section icon={TriangleAlert} title={p.kind === "medication" ? "Allergy list matches — hypersensitivity / cross-reactivity" : "Allergy caution — contains / may cross-react"}>
        {cautions.length ? cautions.map((r) => <ClaimRow key={r.id} subjectType="allergy" row={r} sources={p.sources} onReview={onReview}>{r.label}</ClaimRow>)
          : p.unknownFields.includes("allergy") ? <NotDocumented label="Allergy" /> : <p className="text-sm text-muted-foreground">—</p>}
      </Section>
      {p.legacyCautions.length > 0 && (
        <Section icon={TriangleAlert} title="Cautions (unsourced, from the older profile)">
          <ul className="text-sm space-y-1 list-disc pl-5">{p.legacyCautions.map((c) => <li key={c}>{c}</li>)}</ul>
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- history

interface CompareView { fields: Record<string, string>; relationships: Record<string, string[]>; sources: number; enrichmentVersion: number }

function HistoryTab({ tagId, revisions, onRestored }: { tagId: string; revisions: Revision[]; onRestored: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [cmp, setCmp] = useState<{ before: CompareView; current: CompareView } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const compare = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setCmp(null);
    try {
      setCmp(await adminApi.get(`/api/admin/supplement-profiles/${tagId}/revisions/${id}`));
    } catch (e: any) {
      toast.error(e.message || "Could not load this version");
    }
  };
  const restore = async (r: Revision) => {
    if (!confirm(`Restore this profile to the version saved ${new Date(r.createdAt).toLocaleString()}? The current version is saved first, so this can be undone.`)) return;
    setBusy(r.id);
    try {
      await adminApi.post(`/api/admin/supplement-profiles/${tagId}/revisions/${r.id}/restore`, {});
      toast.success("Profile restored");
      setOpenId(null);
      onRestored();
    } catch (e: any) {
      toast.error(e.message || "Could not restore");
    } finally {
      setBusy(null);
    }
  };

  if (!revisions.length) return <p className="text-sm text-muted-foreground">No earlier versions yet — one is saved automatically before every change.</p>;
  return (
    <div className="space-y-2">
      {revisions.map((r) => (
        <div key={r.id} className="rounded-lg border border-border/50 bg-background/40">
          <div className="flex items-center gap-2 px-3 py-2">
            <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{r.summary || r.reason}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}{r.actorName ? ` · ${r.actorName}` : " · automatic"}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => compare(r.id)}>{openId === r.id ? "Hide" : "Compare"}</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => restore(r)} disabled={busy !== null}>
              {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
            </Button>
          </div>
          {openId === r.id && (
            <div className="border-t border-border/50 px-3 py-2">
              {!cmp ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <CompareTable before={cmp.before} current={cmp.current} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CompareTable({ before, current }: { before: CompareView; current: CompareView }) {
  const changedFields = Object.keys({ ...before.fields, ...current.fields }).filter((k) => (before.fields[k] || "") !== (current.fields[k] || ""));
  const rel = Object.keys(current.relationships).map((k) => {
    const b = new Set(before.relationships[k] || []);
    const c = new Set(current.relationships[k] || []);
    return { k, added: [...c].filter((x) => !b.has(x)), removed: [...b].filter((x) => !c.has(x)) };
  }).filter((r) => r.added.length || r.removed.length);
  if (!changedFields.length && !rel.length) return <p className="text-xs text-muted-foreground">No differences from the current profile.</p>;
  return (
    <div className="space-y-3 text-xs">
      {changedFields.length > 0 && (
        <table className="w-full">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 w-32 font-medium">Field</th><th className="py-1 pr-2 font-medium">This version</th><th className="py-1 font-medium">Current</th></tr></thead>
          <tbody>
            {changedFields.map((k) => (
              <tr key={k} className="align-top border-t border-border/40">
                <td className="py-1 pr-2 text-muted-foreground">{FIELD_LABELS[k] ?? (k === "unknownFields" ? "Not documented" : k)}</td>
                <td className="py-1 pr-2 text-destructive/90">{before.fields[k] || "—"}</td>
                <td className="py-1 text-emerald-700 dark:text-emerald-400">{current.fields[k] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rel.map((r) => (
        <div key={r.k}>
          <p className="font-medium capitalize">{r.k}</p>
          {r.removed.map((x) => <p key={`-${x}`} className="text-destructive/90">− {x}</p>)}
          {r.added.map((x) => <p key={`+${x}`} className="text-emerald-700 dark:text-emerald-400">+ {x}</p>)}
        </div>
      ))}
      <p className="text-muted-foreground">Sources: {before.sources} in this version → {current.sources} now.</p>
    </div>
  );
}

// ---------------------------------------------------------------- settings panel

interface Job { id: string; mode: string; status: string; total: number; processed: number; failed: number; inFlight: number; failedItems: { tagId: string; label: string; error: string }[]; createdAt: string; finishedAt: string | null }
interface EnrichStatus { total: number; sourced: number; notYetSourced: number; failed: number; queued: number; pilotDone: boolean; jobs: Job[] }
interface ReportRecord {
  tagId: string; label: string; active: boolean; status: string; errorMessage: string | null; sourced: boolean; category: string | null;
  completeness: number; sources: number; complaintLinks: number; safetyItems: number; pendingSafety: number; conflicts: number;
  staleLinks: number; unsourcedClaims: number; unknown: string[];
}
interface Report {
  totals: Record<string, number>;
  relationships: Record<string, number>;
  duplicates: { identityLabel: string; identity: { name: string; items: string[] }[]; synonyms: { name: string; items: string[] }[] };
  records: ReportRecord[];
}

const FILTERS: { key: string; label: string; test: (r: ReportRecord) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "review", label: "Needs review", test: (r) => r.pendingSafety > 0 || r.conflicts > 0 },
  { key: "unsourced", label: "Not yet sourced", test: (r) => !r.sourced },
  { key: "conflicts", label: "Conflicts", test: (r) => r.conflicts > 0 },
  { key: "incomplete", label: "Incomplete", test: (r) => r.sourced && r.completeness < 85 },
  { key: "failed", label: "Failed", test: (r) => r.status === "failed" || !!r.errorMessage },
];

const PANEL_TEXT = {
  supplement: {
    title: "Search-backed Unani Profiles",
    intro: "Each Unani medicine is researched with live search: names, Mizaj, actions, traditional and modern evidence, linked complaints, symptoms, allergies, ingredients, safety and drug interactions",
    reviewers: "the Unani team",
  },
  medication: {
    title: "Search-backed Medication Profiles",
    intro: "Each allopathic medicine is researched with live search in product labels, regulators and drug references: generic name, salt, active ingredients and strengths, classes, ATC code, mechanism, indications (approved vs off-label), allergy and hypersensitivity, contraindications, warnings, kidney/liver use, drug and food interactions and adverse effects",
    reviewers: "a clinician or pharmacist",
  },
} as const;

/** Settings card: search-backed enrichment runs, data-quality report and the record-level review list. */
export function SupplementProfilesStatus({ kind = "supplement" }: { kind?: "supplement" | "medication" }) {
  const text = PANEL_TEXT[kind];
  const [status, setStatus] = useState<EnrichStatus | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState("all");
  const [starting, setStarting] = useState<string | null>(null);
  const [openTag, setOpenTag] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    adminApi.get<{ status: EnrichStatus }>(`/api/admin/supplement-profiles?kind=${kind}`).then((r) => setStatus(r.status)).catch(() => {});
  }, [kind]);
  const loadReport = useCallback(() => {
    adminApi.get<Report>(`/api/admin/supplement-profiles/report?kind=${kind}`).then(setReport).catch(() => {});
  }, [kind]);
  useEffect(() => { loadStatus(); loadReport(); }, [loadStatus, loadReport]);

  const activeRun = status?.jobs.find((j) => (j.mode === "pilot" || j.mode === "batch") && (j.status === "running" || j.status === "paused"));
  const anyRunning = !!status?.jobs.some((j) => j.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const a = setInterval(loadStatus, 5000);
    const b = setInterval(loadReport, 20000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [anyRunning, loadStatus, loadReport]);
  // Refresh the report once a run finishes.
  useEffect(() => { if (status && !anyRunning) loadReport(); }, [anyRunning, status, loadReport]);

  const start = async (mode: "pilot" | "batch") => {
    if (mode === "batch" && !status?.pilotDone && !confirm(`The pilot hasn't been run yet. It's recommended to run it and have ${text.reviewers} review those records first. Start the full run anyway?`)) return;
    setStarting(mode);
    try {
      const res = await adminApi.post<{ count: number }>("/api/admin/supplement-profiles/jobs", { mode, kind });
      toast.success(`Researching ${res.count} item${res.count === 1 ? "" : "s"} in the background`);
      loadStatus();
    } catch (e: any) {
      toast.error(e.message || "Could not start");
    } finally {
      setStarting(null);
    }
  };
  const control = async (job: Job, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm("Cancel this run? Items already researched keep their new profiles.")) return;
    try {
      await adminApi.post(`/api/admin/supplement-profiles/jobs/${job.id}`, { action });
      loadStatus();
    } catch (e: any) {
      toast.error(e.message || "Could not update the run");
    }
  };

  const rows = useMemo(() => (report?.records ?? []).filter(FILTERS.find((f) => f.key === filter)!.test), [report, filter]);
  const t = report?.totals;
  const rel = report?.relationships;
  const lastFailures = status?.jobs.find((j) => j.failedItems.length)?.failedItems ?? [];

  return (
    <div className="mt-8 pt-6 border-t border-border/50 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-serif text-base font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {text.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            {text.intro} — every claim with the web sources it came from. Everything is published as <em>Unverified</em> until a reviewer
            verifies it; verified items are never overwritten. Start with the pilot, review it, then run the rest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={status?.pilotDone ? "outline" : "default"} onClick={() => start("pilot")} disabled={!!activeRun || starting !== null || !status?.notYetSourced}>
            {starting === "pilot" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} Run pilot (8 items)
          </Button>
          <Button size="sm" variant={status?.pilotDone ? "default" : "outline"} onClick={() => start("batch")} disabled={!!activeRun || starting !== null || !status?.notYetSourced}>
            {starting === "batch" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Research remaining ({status?.notYetSourced ?? 0})
          </Button>
        </div>
      </div>

      {status && (
        <div className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="font-medium">{status.sourced} of {status.total} search-backed</span>
            <span className="text-xs text-muted-foreground">{status.queued > 0 && `${status.queued} queued`}{status.failed > 0 && <span className="text-destructive"> · {status.failed} failed</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${status.total ? Math.round((status.sourced / status.total) * 100) : 0}%` }} />
          </div>
          {activeRun && (
            <div className="flex items-center gap-3 flex-wrap pt-2 text-sm">
              {activeRun.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
              <span>
                {activeRun.mode === "pilot" ? "Pilot" : "Full run"} {activeRun.status === "paused" ? "paused" : "running"} — {activeRun.processed + activeRun.failed} of {activeRun.total} done
                {activeRun.failed > 0 && <span className="text-destructive"> ({activeRun.failed} failed)</span>}
                {activeRun.status === "running" && activeRun.inFlight > 0 && <span className="text-muted-foreground"> · {activeRun.inFlight} in progress</span>}
              </span>
              <span className="flex gap-1.5 ml-auto">
                {activeRun.status === "running"
                  ? <Button size="sm" variant="outline" className="h-7" onClick={() => control(activeRun, "pause")}><Pause className="h-3 w-3" /> Pause</Button>
                  : <Button size="sm" variant="outline" className="h-7" onClick={() => control(activeRun, "resume")}><Play className="h-3 w-3" /> Resume</Button>}
                <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => control(activeRun, "cancel")}><Square className="h-3 w-3" /> Cancel</Button>
              </span>
            </div>
          )}
        </div>
      )}

      {t && rel && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ["Search-backed", `${t.reviewed} / ${t.substances}`],
            ["Complete · partial · insufficient", `${t.complete} · ${t.partial} · ${t.insufficient}`],
            ["Records with sources", t.withSources],
            ["Records needing review", t.pendingReviewRecords],
            ["Safety items to verify", t.pendingSafetyItems],
            ["Conflicting sources", t.conflicts],
            ["Claims without a source", t.unsourcedClaims],
            ["Verified claims", t.verifiedClaims],
            ["Complaint links", rel.complaints],
            ["Allergy links (ease · caution)", `${rel.allergyRelief} · ${rel.allergyCaution}`],
            ["Safety items · interactions", `${rel.safetyItems} · ${rel.interactions}`],
            ["Ingredients (linked to records)", `${rel.ingredients} (${rel.ingredientsLinkedToRecords})`],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{k}</p>
              <p className="text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>
      )}

      {report && (report.duplicates.identity.length > 0 || report.duplicates.synonyms.length > 0 || (t?.staleLinks ?? 0) > 0) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs space-y-1">
          <p className="font-medium text-amber-800 dark:text-amber-300">Possible duplicates — review before merging (nothing is merged automatically)</p>
          {report.duplicates.identity.map((d) => <p key={`b-${d.name}`}>Same {report.duplicates.identityLabel} <em>{d.name}</em>: {d.items.join(", ")}</p>)}
          {report.duplicates.synonyms.map((d) => <p key={`s-${d.name}`}>Shared synonym &quot;{d.name}&quot;: {d.items.join(", ")}</p>)}
          {(t?.staleLinks ?? 0) > 0 && <p>{t!.staleLinks} relationship(s) point at an inactive complaint, allergy or symptom.</p>}
        </div>
      )}

      {lastFailures.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs space-y-0.5">
          <p className="font-medium text-destructive">Failed in the latest run (retry with &quot;Research remaining&quot; or from the item)</p>
          {lastFailures.map((f) => <p key={f.tagId}><span className="font-medium">{f.label}:</span> {f.error}</p>)}
        </div>
      )}

      {report && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => {
              const n = report.records.filter(f.test).length;
              return (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-background/60")}>
                  {f.label} ({n})
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border border-border/50 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Substance</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Category</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Complete</th>
                  <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Sources</th>
                  <th className="px-3 py-2 font-medium text-right">To review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tagId} onClick={() => setOpenTag(r.tagId)} className="border-t border-border/40 cursor-pointer hover:bg-muted/30">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.status === "failed" ? <span className="text-destructive">Failed</span>
                        : r.sourced ? <span className="text-emerald-600 dark:text-emerald-400">Search-backed</span>
                        : <span className="text-amber-700 dark:text-amber-400">Not yet sourced</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{r.sourced ? `${r.completeness}%` : "—"}</td>
                    <td className="px-3 py-2 text-right text-xs hidden sm:table-cell">{r.sources || "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.pendingSafety + r.conflicts > 0
                        ? <span className="text-amber-700 dark:text-amber-400">{r.pendingSafety} safety{r.conflicts ? ` · ${r.conflicts} conflict` : ""}</span>
                        : "—"}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SupplementProfileDialog tagId={openTag} onOpenChange={(o) => { if (!o) setOpenTag(null); }} onEnriched={() => { loadReport(); loadStatus(); }} />
    </div>
  );
}
