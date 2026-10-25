import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { BookTranslationError } from "@/lib/book-translation";
import { inspectPdf } from "@/lib/book-pdf";
import { putBookFile } from "@/lib/book-storage";
import { maxUploadBytes } from "@/lib/books";

// Shared plumbing for /api/admin/books/** — admin session check, activity
// log, error mapping and the PDF upload path used by Upload and Replace.

export type AdminSession = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;

export async function withAdmin(req: NextRequest, run: (session: AdminSession) => Promise<Response>) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    return await run(session);
  } catch (err) {
    if (err instanceof BookTranslationError || err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err instanceof UploadError ? err.status : 400 });
    }
    console.error("[books]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export function logBooks(req: NextRequest, session: AdminSession, action: string, description: string) {
  return logAdminActivity(session.admin.id, action, description, getClientIp(req));
}

export class UploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Reads, checks and stores one uploaded PDF; returns what a BookPdfFile row needs. */
export async function receivePdf(req: NextRequest) {
  const limit = await maxUploadBytes();
  const mb = Math.round(limit / 1024 / 1024);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > limit + 1024 * 1024) throw new UploadError(`The file is larger than the ${mb} MB limit.`, 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new UploadError("Choose a PDF file to upload.");
  if (file.size > limit) throw new UploadError(`The file is larger than the ${mb} MB limit.`, 413);
  if (!/\.pdf$/i.test(file.name)) throw new UploadError("Only PDF files can be uploaded.");

  const data = Buffer.from(await file.arrayBuffer());
  const check = await inspectPdf(data);
  if (!check.ok) throw new UploadError(check.error);

  const storageKey = `books/${randomUUID()}.pdf`;
  await putBookFile(storageKey, data);
  return {
    form,
    file: {
      originalFilename: file.name.replace(/[\\/]/g, "_").slice(0, 255),
      storageKey, mimeType: "application/pdf", fileSize: data.length,
      checksum: check.checksum, pageCount: check.pageCount,
    },
  };
}

export async function getPdfOr404(pdfId: string) {
  return db.bookPdf.findUnique({ where: { id: pdfId }, include: { book: { select: { id: true, title: true, bookCode: true } } } });
}
