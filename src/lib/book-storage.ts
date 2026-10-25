import { promises as fs } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Where book PDFs live. Live: a private S3 bucket (BOOKS_S3_BUCKET + AWS_REGION),
// credentials from the EC2 instance role — no keys in env or code. Development
// (no bucket set): a local folder outside the web root. Files are only ever
// read back through the admin API, never from a public URL.

const bucket = () => process.env.BOOKS_S3_BUCKET || "";

let client: S3Client | null = null;
function s3() {
  if (!client) client = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-2" });
  return client;
}

/** Local fallback folder — beside the database (never inside .next, which every build replaces). */
function localDir() {
  if (process.env.BOOKS_STORAGE_DIR) return process.env.BOOKS_STORAGE_DIR;
  const url = process.env.DATABASE_URL || "";
  const file = url.startsWith("file:") ? url.slice(5) : "";
  const base = path.isAbsolute(file) ? path.dirname(file) : process.cwd();
  return path.join(base, "storage", "books");
}

export function bookStorageMode(): "s3" | "local" {
  return bucket() ? "s3" : "local";
}

/** Keys are generated server-side only ("books/<pdfId>/v<n>-<random>.pdf"), never from user input. */
function localPath(key: string) {
  const dir = localDir();
  const full = path.resolve(dir, key);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putBookFile(key: string, data: Buffer) {
  if (bookStorageMode() === "s3") {
    await s3().send(new PutObjectCommand({
      Bucket: bucket(), Key: key, Body: data, ContentType: "application/pdf", ServerSideEncryption: "AES256",
    }));
    return;
  }
  const full = localPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function getBookFile(key: string): Promise<Buffer> {
  if (bookStorageMode() === "s3") {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(localPath(key));
}

export async function deleteBookFile(key: string) {
  if (bookStorageMode() === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return;
  }
  await fs.rm(localPath(key), { force: true });
}
