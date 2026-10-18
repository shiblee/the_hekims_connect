// Stage 4 answer hints: when something already recorded for this visit
// (complaints and what worsens/eases them, onset & rhythm, other symptoms,
// clinical notes) points at an Asbab-e-Sittah option, that option is marked
// "Suggested" with the finding behind it. Nothing is selected automatically —
// the doctor confirms with one tap. Questions and options are matched on their
// admin wording, so renamed items simply stop getting hints.

interface Rule {
  /** Matches the question's label. */
  question: RegExp;
  /** Matches the option's label. */
  option: RegExp;
  /** Matches a recorded finding. */
  evidence: RegExp;
}

const RULES: Rule[] = [
  // Hawa-e-Muheet
  { question: /season/i, option: /winter|shita/i, evidence: /winter|sarma|cold (exposure|weather|wind)|worse in cold/i },
  { question: /season/i, option: /summer|sayf/i, evidence: /summer|garma|heat|sun exposure/i },
  { question: /season/i, option: /autumn|kharif/i, evidence: /autumn|khareef|kharif/i },
  { question: /season/i, option: /spring|rabi/i, evidence: /spring|rabee/i },
  { question: /weather/i, option: /cold, damp/i, evidence: /cold|damp|humid|rain|winter|sarma/i },
  { question: /weather/i, option: /hot, sunny/i, evidence: /heat|\bsun\b|summer|garma/i },
  { question: /weather/i, option: /cold, dry wind/i, evidence: /dry air|cold wind|hawa-e-yabis/i },
  { question: /exposure/i, option: /dust/i, evidence: /dust/i },
  { question: /exposure/i, option: /smoke/i, evidence: /smoke|tobacco/i },
  // Makool-o-Mashroob
  { question: /digestion/i, option: /burning|acidity/i, evidence: /acidity|heartburn|burning.*(stomach|chest)|sozish|spicy/i },
  { question: /digestion/i, option: /heaviness|bloating/i, evidence: /heav(y|iness)|bloat|indigestion|post-prandial|after meals|su-e-hazm/i },
  { question: /digestion/i, option: /wind|colicky/i, evidence: /\bgas\b|flatul|colic|cramp|riyah|nafkh/i },
  { question: /thirst/i, option: /intense thirst/i, evidence: /intense thirst|excessive thirst|atash/i },
  { question: /thirst/i, option: /dry mouth/i, evidence: /dry (mouth|throat)/i },
  { question: /appetite/i, option: /low|sluggish/i, evidence: /loss of appetite|low appetite|zof-e-ishtiha/i },
  { question: /appetite/i, option: /sharp/i, evidence: /excessive hunger|joo-ul-baqar/i },
  // Harkat-o-Sukoon-e-Badani
  { question: /respond to exertion/i, option: /breathless/i, evidence: /breathless|zeeq/i },
  { question: /respond to exertion/i, option: /stiffness|cramps/i, evidence: /stiff|cramp|tashannuj/i },
  // Harkat-o-Sukoon-e-Nafsani
  { question: /emotional temperament/i, option: /anger|irritab/i, evidence: /anger|irritab|ghazab/i },
  { question: /emotional temperament/i, option: /worry|sadness/i, evidence: /anxi|worry|stress|sad|low mood|grief|fikr|gham|huzn/i },
  { question: /stress/i, option: /^high/i, evidence: /stress|anxi|worry|fikr/i },
  { question: /mental activity|focus/i, option: /anxious|fearful/i, evidence: /anxi|fear|worry|khauf/i },
  { question: /mental activity|focus/i, option: /slow|foggy|drowsy/i, evidence: /drows|forget|nisyan|oversleep|subat/i },
  { question: /emotional events/i, option: /grief/i, evidence: /grief|loss|huzn|gham/i },
  { question: /emotional events/i, option: /fear|shock/i, evidence: /fear|fright|shock|khauf/i },
  // Naum-o-Yaqza
  { question: /quality of sleep/i, option: /insomnia|difficulty falling/i, evidence: /insomnia|sleepless|poor sleep|sahar|wakes .*sleep|night waking/i },
  { question: /quality of sleep/i, option: /deep and excessive/i, evidence: /drowsiness|oversleep|subat|daytime sleep/i },
  { question: /sleep timing/i, option: /daytime sleep/i, evidence: /daytime sleep/i },
  // Ihtibas-o-Istifragh
  { question: /bowel/i, option: /constipat/i, evidence: /constipat|qabz/i },
  { question: /bowel/i, option: /loose/i, evidence: /loose (motion|stool)|diarr|ishal/i },
  { question: /bowel/i, option: /mucus/i, evidence: /mucus/i },
  { question: /urine/i, option: /scanty, deep yellow/i, evidence: /burning.*urin|dark yellow|high-coloured|hurqat/i },
  { question: /urine/i, option: /copious|pale/i, evidence: /frequent urination|pale.*urine|kasrat-ul-baul/i },
  { question: /perspiration/i, option: /profuse and warm/i, evidence: /excessive sweating|kasrat-e-araq/i },
  { question: /perspiration/i, option: /cold and clammy/i, evidence: /cold.*clammy|night sweats/i },
  { question: /perspiration/i, option: /scanty/i, evidence: /dry skin|suppressed sweating/i },
  { question: /evacuation changes/i, option: /phlegm/i, evidence: /phlegm|cough with/i },
  { question: /evacuation changes/i, option: /nasal/i, evidence: /runny nose|nazla|zukam/i },
  { question: /evacuation changes/i, option: /bleeding/i, evidence: /bleeding gums|piles|bawaseer|nose ?bleed/i },
  { question: /evacuation changes/i, option: /flatulence/i, evidence: /\bgas\b|bloat|flatul|riyah|nafkh/i },
];

/** option label → the recorded finding that suggests it, for one question. */
export function hintsFor(question: { label: string; options: { label: string }[] }, findings: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of RULES) {
    if (!r.question.test(question.label)) continue;
    const finding = findings.find((f) => r.evidence.test(f));
    if (!finding) continue;
    for (const o of question.options) if (r.option.test(o.label) && !out[o.label]) out[o.label] = finding;
  }
  return out;
}
