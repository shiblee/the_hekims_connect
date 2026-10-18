import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const UA = { "User-Agent": "HekimsConnect/1.0 (care@hekims.connect) food-catalogue" };
const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** ?q= — freely-licensed food photos from Wikimedia Commons, with credit and licence. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ results: [] });
  try {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=16&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=480`, { headers: UA, signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const pages = Object.values(j?.query?.pages || {}).sort((a: any, b: any) => a.index - b.index) as any[];
    const results = pages.map((p) => {
      const ii = p.imageinfo?.[0];
      const lic = ii?.extmetadata?.LicenseShortName?.value || "";
      if (!ii || !/jpeg|png/.test(ii.mime) || ii.width < 300 || !/cc|public domain|pd/i.test(lic)) return null;
      const artist = ii.extmetadata?.Artist?.value ? strip(ii.extmetadata.Artist.value) : "Unknown author";
      return { title: p.title.replace(/^File:/, ""), url: ii.thumburl, credit: `Photo: ${artist.slice(0, 80)} · ${lic} · Wikimedia Commons`, source: ii.descriptionurl };
    }).filter(Boolean).slice(0, 12);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Photo search is unavailable right now" }, { status: 502 });
  }
}
