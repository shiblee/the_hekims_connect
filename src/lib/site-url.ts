import { NextRequest } from "next/server";

/**
 * The public site origin to use in emails/links. Prefers SITE_URL (set explicitly
 * per environment) over req.nextUrl.origin, which can resolve to the app's internal
 * bind address rather than the public domain when running behind a reverse proxy.
 */
export function getSiteUrl(req: NextRequest): string {
  return process.env.SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}
