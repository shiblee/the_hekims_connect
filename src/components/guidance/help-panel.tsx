"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CircleHelp, Loader2, Map, Play, RotateCcw, StepForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { guideUi } from "@/lib/guidance/ui-strings";
import { RTL_LANGS, type GuideLang } from "@/lib/guidance/content";
import { GuideText } from "./guide-text";
import { useGuidance } from "./guidance-provider";

interface DocResp {
  doc: { moduleKey: string; moduleName: string; title: string; lang: GuideLang; rtl: boolean; isFallback: boolean; version: number; updatedAt: string | null; sections: { key: string; text: string }[]; faqs: { id: string; q: string; a: string }[] };
  related: { key: string; name: string; route: string; hasDoc: boolean }[];
}

/** The "?" button: shown only when this page has a tour or tutorial for this user. */
export function HelpButton({ floating, className }: { floating?: boolean; className?: string }) {
  const g = useGuidance();
  if (!g?.state.on) return null;
  const s = g.state;
  const has = (s.docsOn && s.module?.hasDoc) || (s.toursOn && (s.pageTours?.length ?? 0) > 0);
  if (!has) return null;
  const ui = guideUi(s.lang ?? "en");
  return (
    <Button
      type="button"
      data-tour="shell.help"
      variant={floating ? "default" : "ghost"}
      size="icon"
      onClick={() => g.setHelpOpen(true)}
      aria-label={ui.helpTitle}
      title={ui.helpTitle}
      className={cn(floating && "fixed bottom-5 end-5 z-40 h-12 w-12 rounded-full shadow-lg", className)}
    >
      <CircleHelp className={floating ? "h-6 w-6" : "h-5 w-5"} />
    </Button>
  );
}

/** Side panel with this page's tours (start / resume / restart), its tutorial, and related modules. */
export function HelpPanel() {
  const g = useGuidance();
  const [data, setData] = useState<DocResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const moduleKey = g?.state.module?.key;
  const wantDoc = !!(g?.helpOpen && g.state.docsOn && g.state.module?.hasDoc);
  const key = openKey ?? moduleKey;

  useEffect(() => {
    if (!wantDoc && !openKey) return;
    if (!g || !key) return;
    let stale = false;
    Promise.resolve().then(() => { if (!stale) setLoading(true); });
    g.client.get<DocResp>(`/api/guidance/doc?module=${encodeURIComponent(key)}`)
      .then((r) => { if (!stale) setData(r); })
      .catch(() => { if (!stale) setData(null); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [g, key, wantDoc, openKey]);

  if (!g) return null;
  const s = g.state;
  const lang = data?.doc.lang ?? (s.lang as GuideLang) ?? "en";
  const ui = guideUi(s.lang ?? "en");
  const rtl = RTL_LANGS.includes((s.lang ?? "en") as GuideLang);
  const tours = s.toursOn && !openKey ? s.pageTours ?? [] : [];
  const close = (o: boolean) => { g.setHelpOpen(o); if (!o) setOpenKey(null); };

  return (
    <Sheet open={g.helpOpen} onOpenChange={close}>
      <SheetContent side={rtl ? "left" : "right"} className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg" dir={rtl ? "rtl" : "ltr"}>
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 font-serif text-xl"><CircleHelp className="h-5 w-5 text-primary" /> {ui.helpTitle}</SheetTitle>
          <SheetDescription>{data?.doc.moduleName ?? s.module?.name}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-5">
          {tours.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Map className="h-4 w-4 text-primary" /> {ui.tours}</h3>
              <ul className="space-y-2">
                {tours.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.state === "completed" ? ui.finished : t.state === "skipped" ? ui.skipped : t.state === "in_progress" ? ui.inProgress : ""}
                        {t.outdated && ` · ${ui.updatedTour}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      {t.state === "in_progress" && <Button size="sm" onClick={() => g.startTour(t.id, true)}><StepForward className="h-3.5 w-3.5 rtl:rotate-180" /> {ui.resumeTour}</Button>}
                      <Button size="sm" variant={t.state === "in_progress" ? "outline" : "default"} onClick={() => g.startTour(t.id)}>
                        {t.state === "new" ? <><Play className="h-3.5 w-3.5 rtl:rotate-180" /> {ui.startTour}</> : <><RotateCcw className="h-3.5 w-3.5" /> {ui.restartTour}</>}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data ? (
            <article dir={data.doc.rtl ? "rtl" : "ltr"} lang={data.doc.lang} className="space-y-5">
              <h2 className="flex items-start gap-2 font-serif text-lg font-semibold"><BookOpen className="mt-1 h-4 w-4 shrink-0 text-primary" /> {data.doc.title}</h2>
              {data.doc.isFallback && <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{guideUi(lang).fallback}</p>}
              {data.doc.sections.map((sec) => (
                <section key={sec.key}>
                  <h3 className="mb-1.5 text-sm font-semibold">{guideUi(lang).sections[sec.key] ?? sec.key}</h3>
                  <GuideText text={sec.text} className="text-muted-foreground" />
                </section>
              ))}
              {data.doc.faqs.length > 0 && (
                <section>
                  <h3 className="mb-1 text-sm font-semibold">{guideUi(lang).questions}</h3>
                  <Accordion type="multiple">
                    {data.doc.faqs.map((f) => (
                      <AccordionItem key={f.id} value={f.id}>
                        <AccordionTrigger className="text-start text-sm">{f.q}</AccordionTrigger>
                        <AccordionContent><GuideText text={f.a} className="text-muted-foreground" /></AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              )}
              {data.related.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">{guideUi(lang).related}</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.related.map((r) => (
                      <span key={r.key} className="inline-flex items-center overflow-hidden rounded-full border border-border text-xs">
                        <Link href={r.route} onClick={() => close(false)} className="px-3 py-1.5 font-medium hover:bg-muted">{r.name}</Link>
                        {r.hasDoc && <button type="button" onClick={() => setOpenKey(r.key)} className="border-s border-border px-2.5 py-1.5 text-primary hover:bg-primary/10" title={guideUi(lang).openTutorial}><BookOpen className="h-3.5 w-3.5" /></button>}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                {data.doc.updatedAt && guideUi(lang).updated(new Date(data.doc.updatedAt).toLocaleDateString(data.doc.lang, { day: "numeric", month: "long", year: "numeric" }))} · {guideUi(lang).version(data.doc.version)}
              </p>
            </article>
          ) : tours.length === 0 && <p className="text-sm text-muted-foreground">{ui.noHelp}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
