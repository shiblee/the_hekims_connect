"use client";

// Labels of the tour card and help panel, from the site's translation system (group "guidance",
// managed in Admin → Languages). Unpublished translations fall back to English automatically.
import { useTranslations } from "next-intl";

export interface GuideUi {
  stepOf: (n: number, total: number) => string;
  next: string; previous: string; finish: string; skip: string; close: string; closeHint: string;
  fullTutorial: string; notOnScreen: string; fallback: string;
  onOtherPage: (page: string) => string; openPage: (page: string) => string;
  helpTitle: string; tours: string; startTour: string; resumeTour: string; restartTour: string;
  noHelp: string; related: string; questions: string; updated: (d: string) => string; version: (v: number) => string;
  finished: string; skipped: string; inProgress: string; updatedTour: string; openTutorial: string;
  section: (key: string) => string;
}

export function useGuideUi(): GuideUi {
  const t = useTranslations("guidance");
  return {
    stepOf: (n, total) => t("step_of", { n, total }),
    next: t("next"), previous: t("previous"), finish: t("finish"), skip: t("skip"), close: t("close"), closeHint: t("close_hint"),
    fullTutorial: t("full_tutorial"), notOnScreen: t("not_on_screen"), fallback: t("fallback"),
    onOtherPage: (page) => t("on_other_page", { page }), openPage: (page) => t("open_page", { page }),
    helpTitle: t("help_title"), tours: t("tours"), startTour: t("start_tour"), resumeTour: t("resume"), restartTour: t("restart"),
    noHelp: t("no_help"), related: t("related"), questions: t("questions"),
    updated: (date) => t("updated", { date }), version: (version) => t("version", { version }),
    finished: t("finished"), skipped: t("skipped"), inProgress: t("in_progress"), updatedTour: t("updated_tour"), openTutorial: t("open_tutorial"),
    section: (key) => t(`sec_${key}` as "sec_overview"),
  };
}
