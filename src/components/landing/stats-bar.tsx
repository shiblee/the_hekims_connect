"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Activity, Pill, MessageSquare } from "lucide-react";

const STATS = [
  { label: "Verified Facilities", value: "500+", icon: ShieldCheck },
  { label: "Mizaj Assessments", value: "8.4k", icon: Activity },
  { label: "Pharmacy Items", value: "1.2k", icon: Pill },
  { label: "Secure Messages", value: "94k", icon: MessageSquare },
];

export function StatsBar() {
  return (
    <section className="relative border-y border-border/60 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/40 p-5 text-center transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <s.icon className="size-5" />
              </div>
              <div className="font-serif text-3xl font-bold text-gradient-primary sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
                {s.label}
              </div>
              {/* subtle bottom gradient line */}
              <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-accent transition-transform duration-500 group-hover:scale-x-100" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
