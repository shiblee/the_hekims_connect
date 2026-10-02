"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  ShieldCheck,
  Activity,
  Pill,
  FileImage,
  MessageSquare,
  CalendarCheck,
  Leaf,
  ArrowRight,
  Star,
  Quote,
  Stethoscope,
  Heart,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { avatarGradient } from "@/lib/avatar";
import { ConnectorField } from "@/components/landing/connector-field";

const RTL_LOCALES = new Set(["ur", "ar", "fa"]);

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const features = [
  { icon: Activity, slug: "mizaj", accent: "teal" },
  { icon: ShieldCheck, slug: "otp", accent: "gold" },
  { icon: Pill, slug: "pharmacy", accent: "teal" },
  { icon: FileImage, slug: "records", accent: "gold" },
  { icon: MessageSquare, slug: "messaging", accent: "teal" },
  { icon: CalendarCheck, slug: "booking", accent: "gold" },
];

const akhlat = [
  { name: "Dam", slug: "dam", tint: "text-red-300", border: "hover:border-rose-400/70" },
  { name: "Safra", slug: "safra", tint: "text-amber-300", border: "hover:border-amber-400/70" },
  { name: "Balgham", slug: "balgham", tint: "text-sky-300", border: "hover:border-sky-400/70" },
  { name: "Sauda", slug: "sauda", tint: "text-violet-300", border: "hover:border-violet-400/70" },
];

const ilaj = [
  { name: "Ilaj-bil-Tadbeer", slug: "tadbeer", icon: Activity },
  { name: "Ilaj-bil-Ghadha", slug: "ghadha", icon: Leaf },
  { name: "Ilaj-bil-Dawa", slug: "dawa", icon: Pill },
  { name: "Ilaj-bil-Yad", slug: "yad", icon: Stethoscope },
];

const testimonials = [
  { name: "Dr. Aliam Colter", slug: "colter", color: "teal" },
  { name: "Mark Jaxon", slug: "jaxon", color: "amber" },
  { name: "Alexa Max", slug: "max", color: "rose" },
  { name: "Dr. Maira Khan", slug: "khan", color: "violet" },
  { name: "Brick Zon", slug: "zon", color: "cyan" },
  { name: "Dr. Aisha Rahman", slug: "rahman", color: "emerald" },
];

export function LandingPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const isRtl = RTL_LOCALES.has(locale);
  const heroMx = useMotionValue(0.5);
  const heroMy = useMotionValue(0.5);
  const heroSmx = useSpring(heroMx, { stiffness: 60, damping: 20, mass: 0.4 });
  const heroSmy = useSpring(heroMy, { stiffness: 60, damping: 20, mass: 0.4 });

  function handleHeroMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    heroMx.set((e.clientX - rect.left) / rect.width);
    heroMy.set((e.clientY - rect.top) / rect.height);
  }
  function handleHeroLeave() {
    heroMx.set(0.5);
    heroMy.set(0.5);
  }

  const [howTab, setHowTab] = useState<"facility" | "patient">("facility");
  const [testimonialApi, setTestimonialApi] = useState<CarouselApi>();
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [testimonialPaused, setTestimonialPaused] = useState(false);

  useEffect(() => {
    if (!testimonialApi) return;
    const onSelect = () => setTestimonialIndex(testimonialApi.selectedScrollSnap());
    onSelect();
    testimonialApi.on("select", onSelect);
    return () => {
      testimonialApi.off("select", onSelect);
    };
  }, [testimonialApi]);

  useEffect(() => {
    if (!testimonialApi || testimonialPaused) return;
    const id = setInterval(() => {
      if (testimonialApi.canScrollNext()) {
        testimonialApi.scrollNext();
      } else {
        testimonialApi.scrollTo(0);
      }
    }, 4500);
    return () => clearInterval(id);
  }, [testimonialApi, testimonialPaused]);

  const facilitySteps = [
    { slug: "register", icon: ShieldCheck, a: () => router.push("/register/facility") },
    { slug: "profile", icon: Stethoscope, a: () => router.push("/login/facility") },
    { slug: "queue", icon: CalendarCheck, a: () => router.push("/login/facility") },
    { slug: "mizaj", icon: Activity, a: () => router.push("/login/facility") },
    { slug: "consult", icon: MessageSquare, a: () => router.push("/login/facility") },
  ];
  const patientSteps = [
    { slug: "profile", icon: Heart, a: () => router.push("/register/patient") },
    { slug: "records", icon: FileImage, a: () => router.push("/register/patient") },
    { slug: "find", icon: Stethoscope, a: () => router.push("/login/patient") },
    { slug: "book", icon: CalendarCheck, a: () => router.push("/login/patient") },
    { slug: "chat", icon: MessageSquare, a: () => router.push("/login/patient") },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section
        className="relative overflow-hidden min-h-[58vh] lg:min-h-[64vh] flex items-center"
        onMouseMove={handleHeroMove}
        onMouseLeave={handleHeroLeave}
      >
        <ConnectorField className="absolute inset-0 h-full w-full opacity-90" mx={heroSmx} my={heroSmy} />
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-12 lg:py-16 w-full">
          <motion.div {...fadeUp} className="max-w-3xl mx-auto text-center">
            <h1 className="font-serif font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              {t("landing.hero.title_line1")}
              <br />
              <span className="text-gradient-primary">{t("landing.hero.title_line2")}</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="group h-14 px-8 text-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_36px_oklch(0.72_0.13_175/0.4)] active:scale-[0.97]"
                onClick={() => router.push("/register/facility")}
              >
                <Stethoscope className="h-6 w-6 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" /> {t("landing.hero.facility_cta")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="group h-14 px-8 text-lg gap-1.5 bg-transparent border-accent/50 text-accent dark:bg-transparent dark:border-accent/50 dark:text-accent hover:bg-accent/10 hover:border-accent hover:text-accent dark:hover:bg-accent/10 dark:hover:border-accent dark:hover:text-accent transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]"
                onClick={() => router.push("/register/patient")}
              >
                <Heart className="h-6 w-6 transition-transform duration-300 group-hover:scale-125" /> {t("landing.hero.patient_cta")}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-8 lg:py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "500+", key: "facilities_label", i: Stethoscope },
              { n: "8,400+", key: "mizaj_label", i: Activity },
              { n: "1,200+", key: "pharmacy_label", i: Pill },
              { n: "96k+", key: "messages_label", i: MessageSquare },
            ].map((s, i) => (
              <motion.div key={s.key} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }}>
                <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 sm:p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
                  <div className="h-14 w-14 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <s.i className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-gradient-primary leading-none">{s.n}</div>
                    <div className="text-base text-muted-foreground mt-1.5">{t(`landing.stats.${s.key}`)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative overflow-hidden py-20 scroll-mt-20 border-t border-border">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight whitespace-nowrap">
              {t("landing.features.heading")}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.slug}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={cn(
                    "group relative h-full p-7 overflow-hidden border-border/50 bg-card/60 transition-all duration-300 cursor-pointer",
                    f.accent === "teal"
                      ? "hover:border-primary/60 hover:shadow-[0_12px_40px_-8px_oklch(0.72_0.13_175/0.35)]"
                      : "hover:border-accent/60 hover:shadow-[0_12px_40px_-8px_oklch(0.78_0.14_80/0.35)]"
                  )}
                >
                  {/* soft glow that sweeps in on hover */}
                  <div
                    className={cn(
                      "pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                      f.accent === "teal" ? "bg-primary/25" : "bg-accent/25"
                    )}
                  />
                  <div className={cn(
                    "relative h-14 w-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6",
                    f.accent === "teal" ? "bg-primary/15 text-primary group-hover:bg-primary/25" : "bg-accent/15 text-accent group-hover:bg-accent/25"
                  )}>
                    <f.icon className="h-7 w-7" />
                  </div>
                  <h3 className="relative font-serif text-2xl font-semibold mb-2 transition-colors duration-300 group-hover:text-foreground">{t(`landing.features.${f.slug}.title`)}</h3>
                  <p className="relative text-lg text-muted-foreground leading-relaxed">{t(`landing.features.${f.slug}.desc`)}</p>
                  <div className={cn(
                    "relative mt-5 flex items-center gap-1.5 text-base font-medium opacity-0 -translate-x-2 rtl:translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0",
                    f.accent === "teal" ? "text-primary" : "text-accent"
                  )}>
                    {t("landing.features.learn_more")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section id="philosophy" className="py-20 scroll-mt-20 relative overflow-hidden border-t border-border bg-card/20">
        <div className="absolute inset-0 pattern-unani opacity-50" />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
              {t("landing.philosophy.heading")}
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {akhlat.map((a, i) => (
              <motion.div
                key={a.slug}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className={cn("relative rounded-3xl border border-border bg-card/40 p-7 overflow-hidden transition-colors duration-300 cursor-pointer", a.border)}
              >
                <p className={cn("text-base font-semibold uppercase tracking-wider mb-2", a.tint)}>{a.name}</p>
                <h3 className="font-serif text-2xl font-semibold">{t(`landing.philosophy.${a.slug}.en`)}</h3>
                <div className="mt-3 flex flex-wrap gap-2 mb-4">
                  {["quality", "element", "organ"].map((field) => (
                    <span key={field} className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground/70">
                      {t(`landing.philosophy.${a.slug}.${field}`)}
                    </span>
                  ))}
                </div>
                <p className="relative text-lg text-muted-foreground leading-relaxed">{t(`landing.philosophy.${a.slug}.meaning`)}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp}>
            <p className="text-center font-serif text-4xl sm:text-5xl font-bold tracking-tight mb-10">{t("landing.philosophy.ilaj_heading")}</p>
            <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4">
              {ilaj.map((m, i) => (
                <motion.div
                  key={m.slug}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative"
                >
                  <div className="group relative flex flex-col items-center text-center rounded-2xl border border-border bg-card/40 p-6 sm:p-7 h-full cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-card/70 hover:shadow-[0_16px_36px_-14px_oklch(0.72_0.13_175/0.35)]">
                    <div className="relative z-10 mb-3 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/25 group-hover:scale-110 group-hover:-rotate-6">
                      <m.icon className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-serif text-2xl font-semibold">{m.name}</p>
                    <p className="text-base text-muted-foreground">{t(`landing.philosophy.${m.slug}.en`)}</p>
                    <p className="mt-2 text-lg text-muted-foreground leading-relaxed">{t(`landing.philosophy.${m.slug}.desc`)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative overflow-hidden py-20 scroll-mt-20 border-t border-border">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-serif text-xl sm:text-4xl lg:text-5xl font-bold tracking-tight whitespace-nowrap">{t("landing.how_it_works.heading")}</h2>
          </motion.div>
          <Tabs value={howTab} onValueChange={(v) => setHowTab(v as "facility" | "patient")}>
            <TabsList className="relative grid w-full max-w-2xl mx-auto grid-cols-2 gap-3 mb-10 bg-transparent p-0 h-auto">
              <TabsTrigger value="facility" className="relative overflow-hidden rounded-full h-14 text-lg border border-border bg-card shadow-sm transition-colors duration-300 data-[state=active]:border-transparent data-[state=active]:text-primary-foreground hover:text-foreground">
                {howTab === "facility" && (
                  <motion.span
                    layoutId="how-tab-pill"
                    className="absolute inset-0 rounded-full bg-primary glow-teal"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center"><Stethoscope className="me-2 h-5 w-5" /> {t("landing.how_it_works.tab_facility")}</span>
              </TabsTrigger>
              <TabsTrigger value="patient" className="relative overflow-hidden rounded-full h-14 text-lg border border-border bg-card shadow-sm transition-colors duration-300 data-[state=active]:border-transparent data-[state=active]:text-accent-foreground hover:text-foreground">
                {howTab === "patient" && (
                  <motion.span
                    layoutId="how-tab-pill"
                    className="absolute inset-0 rounded-full bg-accent glow-gold"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center"><Heart className="me-2 h-5 w-5" /> {t("landing.how_it_works.tab_patient")}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="facility">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {facilitySteps.map((s, i) => (
                  <motion.div key={s.slug} whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      onClick={s.a}
                      className="group relative h-full p-7 overflow-hidden border-border/50 bg-card/60 cursor-pointer transition-all duration-300 hover:border-primary/60 hover:shadow-[0_16px_44px_-10px_oklch(0.72_0.13_175/0.4)]"
                    >
                      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative flex items-center justify-between mb-4">
                        <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{i + 1}</div>
                        <s.icon className="h-6 w-6 text-primary/50" />
                      </div>
                      <h3 className="relative font-serif text-2xl font-semibold mb-2">{t(`landing.how_it_works.facility.${s.slug}.title`)}</h3>
                      <p className="relative text-lg text-muted-foreground leading-relaxed">{t(`landing.how_it_works.facility.${s.slug}.desc`)}</p>
                      <Button variant="link" className="relative px-0 mt-4 text-base text-primary" onClick={s.a}>
                        {t("landing.how_it_works.get_started")} <ArrowRight className="ms-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="patient">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {patientSteps.map((s, i) => (
                  <motion.div key={s.slug} whileHover={{ y: -6, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card
                      onClick={s.a}
                      className="group relative h-full p-7 overflow-hidden border-border/50 bg-card/60 cursor-pointer transition-all duration-300 hover:border-accent/60 hover:shadow-[0_16px_44px_-10px_oklch(0.78_0.14_80/0.4)]"
                    >
                      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-accent/20 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative flex items-center justify-between mb-4">
                        <div className="h-11 w-11 rounded-full bg-accent text-accent-foreground font-bold text-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{i + 1}</div>
                        <s.icon className="h-6 w-6 text-accent/50" />
                      </div>
                      <h3 className="relative font-serif text-2xl font-semibold mb-2">{t(`landing.how_it_works.patient.${s.slug}.title`)}</h3>
                      <p className="relative text-lg text-muted-foreground leading-relaxed">{t(`landing.how_it_works.patient.${s.slug}.desc`)}</p>
                      <Button variant="link" className="relative px-0 mt-4 text-base text-accent" onClick={s.a}>
                        {t("landing.how_it_works.get_started")} <ArrowRight className="ms-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="voices" className="relative overflow-hidden py-20 scroll-mt-20 bg-card/30 border-y border-border">
        <div className="absolute inset-0 pattern-unani opacity-40" />
        <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">{t("landing.testimonials.heading")}</h2>
          </motion.div>
          <motion.div
            {...fadeUp}
            onMouseEnter={() => setTestimonialPaused(true)}
            onMouseLeave={() => setTestimonialPaused(false)}
          >
            <Carousel
              setApi={setTestimonialApi}
              opts={{ align: "start", loop: false, containScroll: "trimSnaps", direction: isRtl ? "rtl" : "ltr" }}
            >
              <CarouselContent className="-ms-6">
                {testimonials.map((tm) => (
                  <CarouselItem key={tm.slug} className="ps-6 md:basis-1/2 lg:basis-1/3">
                    <motion.div
                      className="relative h-full"
                      whileHover={{ y: -6, zIndex: 10 }}
                      whileTap={{ y: -3 }}
                    >
                      <Card className="group relative h-full p-7 overflow-hidden border-border bg-card/60 cursor-default transition-all duration-300 hover:border-accent/60 hover:shadow-[0_16px_44px_-10px_oklch(0.78_0.14_80/0.35)]">
                        <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-accent/20 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        <Quote className="relative h-8 w-8 text-primary/40 mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/70" />
                        <p className="relative text-lg text-foreground/90 leading-relaxed mb-5">{t(`landing.testimonials.${tm.slug}.quote`)}</p>
                        <div className="relative flex items-center gap-3">
                          <div className={cn("h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white text-lg transition-transform duration-300 group-hover:scale-110", avatarGradient(tm.color))}>
                            {tm.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{tm.name}</p>
                            <p className="text-base text-muted-foreground">{t(`landing.testimonials.${tm.slug}.role`)}</p>
                          </div>
                        </div>
                        <div className="relative flex gap-1 mt-4">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              className="h-4 w-4 fill-accent text-accent transition-transform duration-300"
                              style={{ transitionDelay: `${j * 40}ms` }}
                            />
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex start-0 lg:-start-4 border-border bg-card shadow-sm hover:bg-primary/15 hover:text-primary hover:border-primary/50" />
              <CarouselNext className="hidden sm:flex end-0 lg:-end-4 border-border bg-card shadow-sm hover:bg-primary/15 hover:text-primary hover:border-primary/50" />
            </Carousel>

            {/* Dot indicators */}
            <div className="mt-8 flex items-center justify-center gap-2">
              {testimonials.map((tm, i) => (
                <button
                  key={`${tm.slug}-dot`}
                  aria-label={t("landing.testimonials.go_to", { n: i + 1 })}
                  onClick={() => testimonialApi?.scrollTo(i)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === testimonialIndex ? "w-6 bg-accent" : "w-2 bg-border hover:bg-accent/50"
                  )}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden py-20 border-t border-border">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp}>
            <Card className="relative overflow-hidden p-10 lg:p-14 text-center border-primary/30 bg-gradient-to-br from-card via-card to-primary/5">
              <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-accent/15 blur-3xl" />
              <div className="relative">
                <Leaf className="mx-auto h-12 w-12 text-primary mb-5 animate-pulse-slow" />
                <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
                  {t("landing.cta.heading")}
                </h2>
                <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  {t("landing.cta.subtitle")}
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="group h-14 px-8 text-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 glow-teal transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_36px_oklch(0.72_0.13_175/0.4)] active:scale-[0.97]"
                    onClick={() => router.push("/register/facility")}
                  >
                    <Stethoscope className="h-6 w-6 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" /> {t("landing.cta.facility_portal")}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group h-14 px-8 text-lg gap-1.5 bg-transparent border-accent/50 text-accent dark:bg-transparent dark:border-accent/50 dark:text-accent hover:bg-accent/10 hover:border-accent hover:text-accent dark:hover:bg-accent/10 dark:hover:border-accent dark:hover:text-accent transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]"
                    onClick={() => router.push("/register/patient")}
                  >
                    <Heart className="h-6 w-6 transition-transform duration-300 group-hover:scale-125" /> {t("landing.cta.patient_portal")}
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {["badge_otp", "badge_mizaj", "badge_privacy"].map((key) => (
                    <span key={key} className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-base font-medium text-foreground/70">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> {t(`landing.cta.${key}`)}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
