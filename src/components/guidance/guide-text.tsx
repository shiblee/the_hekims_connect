"use client";

import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatBlocks, type Inline } from "@/lib/guidance/content";

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => p.href
        ? <Link key={i} href={p.href} className="font-medium text-primary underline-offset-2 hover:underline">{p.text}</Link>
        : p.bold ? <strong key={i} className="font-semibold text-foreground">{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>)}
    </>
  );
}

/** Renders guidance text (paragraphs, bullets, numbered steps, **bold**, internal links) — never as HTML. */
export function GuideText({ text, className }: { text: string; className?: string }) {
  const blocks = formatBlocks(text);
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed [unicode-bidi:plaintext]", className)}>
      {blocks.map((b, i) => b.kind === "p"
        ? <p key={i}><Parts parts={b.parts} /></p>
        : b.kind === "ul"
          ? <ul key={i} className="list-disc space-y-1 ps-5">{b.items.map((it, j) => <li key={j}><Parts parts={it} /></li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 ps-5">{b.items.map((it, j) => <li key={j}><Parts parts={it} /></li>)}</ol>)}
    </div>
  );
}
