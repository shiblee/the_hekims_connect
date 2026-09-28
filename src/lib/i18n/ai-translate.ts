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
      "translated, unless a standard localized medical term exists: Hekim, Hakim, Mizaj, Unani, Akhlat, Dam, " +
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
