// Which left-menu tab each Settings category belongs to, and the order the
// tabs appear in — shared by the Settings page and the Settings shell layout.

// One "General" tab holds these sections (each keeps its own heading).
export const GENERAL_GROUP = ["general", "report", "registration", "verification", "subscription", "patient_defaults", "vitals", "guidance"];
// Engine settings saved by other Admin tabs — summarised read-only under General.
export const SYSTEM_CATEGORIES = ["dalail", "tashkhees_engine", "cds", "i18n"];

export const tabOf = (c: string) => (GENERAL_GROUP.includes(c) || SYSTEM_CATEGORIES.includes(c) ? "general" : c);

// Explicit order for the sidebar (the settings themselves load alphabetically
// by category) so Vitals Validation sits right after General rather than
// wherever its name happens to sort.
export const CATEGORY_ORDER = ["general", "gemini_usage", "report", "vitals_validation", "registration", "verification", "subscription", "patient_defaults", "vitals", "chief_complaint_assistant", "allergy_assistant", "supplement_assistant", "medication_assistant"];

// Tabs that aren't made of plain setting rows, so they show even before any row exists.
export const ALWAYS_TABS = ["gemini_usage"];

export const SETTINGS_TAB_LABELS: Record<string, string> = {
  general: "General",
  gemini_usage: "Gemini Usage",
  vitals_validation: "Vitals Validation",
  chief_complaint_assistant: "Unani Complaint Assistant",
  allergy_assistant: "Unani Allergy Assistant",
  supplement_assistant: "Unani Medicine Assistant",
  medication_assistant: "Allopathic Medicine Assistant",
};

export function sortSettingsTabs(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Left-menu tabs for a set of setting rows (General first, then the rest in CATEGORY_ORDER). */
export function settingsTabsFrom(rows: { category: string }[]): string[] {
  return sortSettingsTabs(Array.from(new Set([...rows.map((r) => tabOf(r.category)), ...(rows.length ? ALWAYS_TABS : [])])));
}
