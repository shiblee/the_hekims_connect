// Fixed labels of the tour / help interface, per language (content itself comes from the admin editor).
export interface GuideUi {
  stepOf: (n: number, total: number) => string;
  next: string; previous: string; finish: string; skip: string; close: string; closeHint: string;
  fullTutorial: string; notOnScreen: string; fallback: string;
  onOtherPage: (page: string) => string; openPage: (page: string) => string;
  help: string; helpTitle: string; tours: string; startTour: string; resumeTour: string; restartTour: string;
  noHelp: string; related: string; questions: string; updated: (d: string) => string; version: (v: number) => string;
  finished: string; skipped: string; inProgress: string; updatedTour: string; openTutorial: string;
  /** Tutorial section headings (keys of DOC_SECTIONS). */
  sections: Record<string, string>;
}

const en: GuideUi = {
  stepOf: (n, t) => `Step ${n} of ${t}`,
  next: "Next", previous: "Previous", finish: "Finish", skip: "Skip tour", close: "Close",
  closeHint: "Close — you can resume this tour later",
  fullTutorial: "Full tutorial",
  notOnScreen: "The part this step describes isn't on screen right now — the explanation still applies.",
  fallback: "Shown in English — a translation in your language isn't ready yet.",
  onOtherPage: (p) => `This step is on the ${p} page.`,
  openPage: (p) => `Open ${p}`,
  help: "Help", helpTitle: "Help & tutorial", tours: "Guided tours", startTour: "Start tour", resumeTour: "Resume", restartTour: "Restart",
  noHelp: "There's no tutorial for this page yet.",
  related: "Related", questions: "Questions", updated: (d) => `Updated ${d}`, version: (v) => `Version ${v}`,
  finished: "Finished", skipped: "Skipped", inProgress: "In progress", updatedTour: "Updated since you saw it", openTutorial: "Tutorial",
  sections: {
    overview: "Overview", purpose: "Purpose", access: "Who can use it", permissions: "Permissions needed", controls: "Sections & controls",
    workflow: "Step-by-step", fields: "Fields and what they mean", tasks: "Common tasks", behaviour: "What happens next",
    validation: "Rules & common errors", troubleshooting: "Troubleshooting", security: "Privacy & security", next: "Next steps",
  },
};

const UI: Record<string, GuideUi> = { en };

export const guideUi = (lang: string): GuideUi => UI[lang] ?? en;
