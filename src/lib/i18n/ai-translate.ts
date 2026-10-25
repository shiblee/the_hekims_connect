import Anthropic from "@anthropic-ai/sdk";

// Resolves ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login` profile.
const client = new Anthropic();

const TARGET_LABELS: Record<string, string> = {
  hi: "Hindi",
  ur: "Urdu",
  ar: "Arabic (Modern Standard)",
  fa: "Farsi/Persian",
};

/**
 * Translates a single UI string via Claude. Called only from the two admin
 * "generate" routes — never from request-time rendering paths.
 */
export async function translateString(opts: {
  sourceText: string;
  targetLanguageCode: string;
  keyName: string;
  description?: string | null;
}): Promise<string> {
  const targetLabel = TARGET_LABELS[opts.targetLanguageCode] ?? opts.targetLanguageCode;

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" },
    system:
      "You translate short user-interface strings for a Unani-medicine telehealth platform called " +
      "\"The Hekim's Connect\". Preserve tone (warm, professional, trustworthy). Keep any {{placeholder}} " +
      "or {curly} interpolation tokens unchanged, exactly as written. Keep domain terms transliterated, not " +
      "translated, unless a standard localized medical term exists: Hekim, Mizaj, Unani, Akhlat, Dam, " +
      "Safra, Balgham, Sauda, Ilaj-bil-Tadbeer, Ilaj-bil-Ghadha, Ilaj-bil-Dawa, Ilaj-bil-Yad. Match the " +
      "length and register of a UI label or heading — do not add sentences or explanations. Return ONLY the " +
      "translated string, no quotes, no commentary.",
    messages: [
      {
        role: "user",
        content:
          `Translate into ${targetLabel}.\nKey: ${opts.keyName}\n` +
          (opts.description ? `Context: ${opts.description}\n` : "") +
          `Source (English): ${opts.sourceText}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("AI returned an empty translation");
  return text;
}

/**
 * True for both failure modes of "no working credential": a rejected 401
 * from the API (Anthropic.AuthenticationError) and the SDK's client-side
 * "no credential source found at all" error, thrown before any request.
 */
export function isMissingAnthropicCredentials(err: unknown): boolean {
  if (err instanceof Anthropic.AuthenticationError) return true;
  return err instanceof Error && /could not resolve authentication method/i.test(err.message);
}

/**
 * Translates a guidance text (tour step or tutorial section) via Claude, keeping its formatting
 * marks — "- " bullets, "1. " steps, **bold**, [label](/path) links with the path unchanged —
 * and {placeholders}. Result is a DRAFT: the admin editor marks it "awaiting review".
 */
export async function translateGuideText(text: string, targetLanguageCode: string, context: string): Promise<string> {
  const targetLabel = TARGET_LABELS[targetLanguageCode] ?? targetLanguageCode;
  try {
    return await translateGuideWithClaude(text, targetLabel, context);
  } catch (e) {
    // No Anthropic credentials on this server → use the platform's Gemini connection instead.
    if (!isMissingAnthropicCredentials(e)) throw e;
    const { geminiText } = await import("@/lib/gemini");
    const out = await geminiText(`${GUIDE_SYSTEM}\n\nTranslate into ${targetLabel}.\nWhere it appears: ${context}\n\n${text}`, "ui_translation");
    if (!out) throw e;
    return out;
  }
}

async function translateGuideWithClaude(text: string, targetLabel: string, context: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: GUIDE_SYSTEM,
    messages: [{ role: "user", content: `Translate into ${targetLabel}.\nWhere it appears: ${context}\n\n${text}` }],
  });
  const out = response.content.find((b) => b.type === "text")?.text?.trim();
  if (!out) throw new Error("AI returned an empty translation");
  return out;
}

const GUIDE_SYSTEM =
      "You translate help text for clinic staff using \"The Hekim's Connect\", a Unani-medicine clinic platform. " +
      "Translate faithfully and clearly for non-technical staff; do not add or drop information. Keep the formatting " +
      "exactly: line breaks, blank lines, lines starting with \"- \" or \"1. \", **bold** markers, and links written as " +
      "[label](/path) — translate the label but never the /path. Keep {placeholders} unchanged. Keep these terms " +
      "transliterated: Hekim, Mizaj, Unani, Akhlat, Asbab-e-Sitta, Tashkhees, Usool-e-Ilaj, Ilaj-bil-Ghiza, Ilaj-bil-Dawa, " +
      "Ilaj-bil-Tadbeer, Hijama, HFR. Return ONLY the translated text.";
