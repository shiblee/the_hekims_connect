import { getSetting } from "@/lib/settings";

/**
 * Whether a one-time code may be shown (and auto-filled) on screen.
 *  - Phone: shown — no SMS gateway yet, so the screen is the only way to get it.
 *  - Email, delivered: never shown — only whoever reads that inbox knows it.
 *  - Email, NOT delivered: shown while "Email codes by email only" (Settings → General → Verification)
 *    is off; once it is on, the person gets an error instead. Turn it on after Amazon SES leaves
 *    sandbox mode, or unverified addresses can't sign in.
 */
export async function screenCode(isEmail: boolean, delivered: boolean, code: string): Promise<{ devOtp?: string; error?: string }> {
  if (!isEmail) return { devOtp: code };
  if (delivered) return {};
  const strict = (await getSetting("verification", "email_code_only", "false")) === "true";
  return strict
    ? { error: "We couldn't send the code to this email address. Check it and try again, or contact support." }
    : { devOtp: code };
}
