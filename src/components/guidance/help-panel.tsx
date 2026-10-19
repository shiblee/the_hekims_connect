"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CircleHelp, GraduationCap, Loader2, Map, Play, RotateCcw, StepForward } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useGuideUi } from "@/lib/guidance/ui-strings";
import { isPatternRoute, RTL_LANGS, type GuideLang } from "@/lib/guidance/content";
import { GuideText } from "./guide-text";
import { useGuidance } from "./guidance-provider";

interface DocResp {
  doc: { moduleKey: string; moduleName: string; title: string; lang: GuideLang; rtl: boolean; isFallback: boolean; version: number; updatedAt: string | null; sections: { key: string; text: string }[]; faqs: { id: string; q: string; a: string }[] };
  related: { key: string; name: string; route: string; hasDoc: boolean }[];
}

interface Catalog { on: boolean; modules: { key: string; name: string; route: string; doc: { title: string } | null; tours: { id: string; title: string; firstRoute: string; state: string }[] }[] }

/** The "?" button: on every page whenever guidance is switched on (the panel always has something to show). */
export function HelpButton({ floating, className }: { floating?: boolean; className?: string }) {
  const g = useGuidance();
  const ui = useGuideUi();
  if (!g?.state.on) return null;
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
  const ui = useGuideUi();
  const [data, setData] = useState<DocResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const path = usePathname() || "/";
  const moduleKey = g?.helpModule ?? g?.state.module?.key;
  const wantDoc = !!(g?.helpOpen && g.state.docsOn && (g.helpModule || g.state.module?.hasDoc));
  const key = openKey ?? moduleKey;

  const client = g?.client;
  useEffect(() => {
    if (!wantDoc && !openKey) return;
    if (!client || !key) return;
    let stale = false;
    Promise.resolve().then(() => { if (!stale) setLoading(true); });
    client.get<DocResp>(`/api/guidance/doc?module=${encodeURIComponent(key)}`)
      .then((r) => { if (!stale) setData(r); })
      .catch(() => { if (!stale) setData(null); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [client, key, wantDoc, openKey]);

  // The full list of tours and tutorials this user can use — fetched each time the panel opens.
  const open = !!g?.helpOpen;
  useEffect(() => {
    if (!open || !client) return;
    let stale = false;
    client.get<Catalog>("/api/guidance/catalog").then((r) => { if (!stale) setCatalog(r); }).catch(() => {});
    return () => { stale = true; };
  }, [open, client]);

  if (!g) return null;
  const s = g.state;
  // Only show a tutorial that belongs to what is being asked for (never a previous page's).
  const doc = (wantDoc || openKey) && data && data.doc.moduleKey === key ? data : null;
  const learningHref = path.startsWith("/admin") ? "/admin/profile/learning" : "/facility/profile/learning";
  const others = (catalog?.modules ?? []).filter((m) => m.key !== key);
  const rtl = RTL_LANGS.includes((s.lang ?? "en") as GuideLang);
  const tours = s.toursOn && !openKey && !g.helpModule ? s.pageTours ?? [] : [];
  const close = (o: boolean) => { g.setHelpOpen(o); if (!o) setOpenKey(null); };

  return (
    <Sheet open={g.helpOpen} onOpenChange={close}>
      <SheetContent side={rtl ? "left" : "right"} className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg" dir={rtl ? "rtl" : "ltr"}>
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 font-serif text-xl"><CircleHelp className="h-5 w-5 text-primary" /> {ui.helpTitle}</SheetTitle>
          <SheetDescription>{doc?.doc.moduleName ?? s.module?.name ?? ui.allHelp}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-5">
          {openKey && (
            <button type="button" onClick={() => setOpenKey(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {ui.back}</button>
          )}
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
          ) : doc ? (
            <article dir={doc.doc.rtl ? "rtl" : "ltr"} lang={doc.doc.lang} className="space-y-5">
              <h2 className="flex items-start gap-2 font-serif text-lg font-semibold"><BookOpen className="mt-1 h-4 w-4 shrink-0 text-primary" /> {doc.doc.title}</h2>
              {doc.doc.isFallback && <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{ui.fallback}</p>}
              {doc.doc.sections.map((sec) => (
                <section key={sec.key}>
                  <h3 className="mb-1.5 text-sm font-semibold">{ui.section(sec.key)}</h3>
                  <GuideText text={sec.text} className="text-muted-foreground" />
                </section>
              ))}
              {doc.doc.faqs.length > 0 && (
                <section>
                  <h3 className="mb-1 text-sm font-semibold">{ui.questions}</h3>
                  <Accordion type="multiple">
                    {doc.doc.faqs.map((f) => (
                      <AccordionItem key={f.id} value={f.id}>
                        <AccordionTrigger className="text-start text-sm">{f.q}</AccordionTrigger>
                        <AccordionContent><GuideText text={f.a} className="text-muted-foreground" /></AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              )}
              {doc.related.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">{ui.related}</h3>
                  <div className="flex flex-wrap gap-2">
                    {doc.related.map((r) => (
                      <span key={r.key} className="inline-flex items-center overflow-hidden rounded-full border border-border text-xs">
                        {isPatternRoute(r.route)
                          ? <span className="px-3 py-1.5 font-medium">{r.name}</span>
                          : <Link href={r.route} onClick={() => close(false)} className="px-3 py-1.5 font-medium hover:bg-muted">{r.name}</Link>}
                        {r.hasDoc && <button type="button" onClick={() => setOpenKey(r.key)} className="border-s border-border px-2.5 py-1.5 text-primary hover:bg-primary/10" title={ui.openTutorial}><BookOpen className="h-3.5 w-3.5" /></button>}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                {doc.doc.updatedAt && ui.updated(new Date(doc.doc.updatedAt).toLocaleDateString(doc.doc.lang, { day: "numeric", month: "long", year: "numeric" }))} · {ui.version(doc.doc.version)}
              </p>
            </article>
          ) : tours.length === 0 && s.module && <p className="text-sm text-muted-foreground">{ui.noHelp}</p>}

          {!openKey && (
            <section className={cn((s.module || tours.length > 0) && "border-t border-border pt-5")}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold"><GraduationCap className="h-4 w-4 text-primary" /> {ui.allHelp}</h3>
                <Link href={learningHref} onClick={() => close(false)} className="text-xs font-medium text-primary hover:underline">{ui.learning}</Link>
              </div>
              {!catalog ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : others.length === 0 ? (
                <p className="text-sm text-muted-foreground">{ui.nothingYet}</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {others.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-medium">{m.name}</span>
                      <span className="flex shrink-0 gap-1">
                        {m.tours[0] && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { close(false); g.openTour(m.tours[0].id, m.tours[0].firstRoute); }}><Play className="h-3 w-3 rtl:rotate-180" /> {ui.tour}</Button>}
                        {m.doc && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary" onClick={() => setOpenKey(m.key)}><BookOpen className="h-3 w-3" /> {ui.openTutorial}</Button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
