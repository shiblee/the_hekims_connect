import { db } from "@/lib/db";

type Bundle = Record<string, unknown>;

const VERSION_TTL_MS = 5000;
let versionCache: { value: number; fetchedAt: number } | null = null;
const messageCache = new Map<string, { version: number; messages: Bundle }>();

async function getMessagesVersion(): Promise<number> {
  const now = Date.now();
  if (versionCache && now - versionCache.fetchedAt < VERSION_TTL_MS) return versionCache.value;
  const row = await db.portalSetting.findUnique({
    where: { category_key: { category: "i18n", key: "messages_version" } },
  });
  const value = row ? parseInt(row.value, 10) || 1 : 1;
  versionCache = { value, fetchedAt: now };
  return value;
}

/** Call after any publish/unpublish/language-toggle so live traffic picks up the change. */
export async function bumpMessagesVersion(updatedBy?: string) {
  const current = await getMessagesVersion();
  await db.portalSetting.upsert({
    where: { category_key: { category: "i18n", key: "messages_version" } },
    update: { value: String(current + 1), updatedBy },
    create: { category: "i18n", key: "messages_version", value: String(current + 1), updatedBy },
  });
  versionCache = { value: current + 1, fetchedAt: Date.now() };
}

function toNested(rows: { key: string; text: string }[]): Bundle {
  const out: Bundle = {};
  for (const { key, text } of rows) {
    const parts = key.split(".");
    let node = out as Record<string, any>;
    for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] ??= {});
    node[parts.at(-1)!] = text;
  }
  return out;
}

/** DB-backed, version-cached message bundle for a locale — never calls AI, only SELECTs. */
export async function getPublishedMessages(locale: string): Promise<Bundle> {
  const version = await getMessagesVersion();
  const cached = messageCache.get(locale);
  if (cached && cached.version === version) return cached.messages;

  const [allKeys, published] = await Promise.all([
    db.translationKey.findMany({ select: { key: true, sourceText: true } }),
    db.translationValue.findMany({
      where: { languageCode: locale, status: "published" },
      select: { text: true, key: { select: { key: true } } },
    }),
  ]);
  const byKey = new Map(published.map((r) => [r.key.key, r.text]));
  const merged = allKeys.map((k) => ({ key: k.key, text: byKey.get(k.key) ?? k.sourceText }));

  const messages = toNested(merged);
  messageCache.set(locale, { version, messages });
  return messages;
}
