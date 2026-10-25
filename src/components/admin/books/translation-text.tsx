"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * English translation rendered from Markdown. react-markdown never renders
 * raw HTML, so text from the model (or a reviewer) can't inject markup.
 */
export function TranslationText({ text }: { text: string }) {
  return (
    <div className="text-[15px] leading-relaxed [&_mark]:bg-amber-200/60">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="font-serif text-xl font-semibold mt-5 mb-2 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="font-serif text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="font-semibold mt-3 mb-1.5 first:mt-0">{children}</h5>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc ps-6 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal ps-6 space-y-1">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="mb-3 border-s-2 border-primary/40 ps-3 italic text-muted-foreground">{children}</blockquote>,
          table: ({ children }) => <div className="mb-3 overflow-x-auto"><table className="w-full text-sm border border-border">{children}</table></div>,
          th: ({ children }) => <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
          a: ({ children }) => <span className="underline">{children}</span>,
          img: () => null,
        }}
      >
        {highlightMarkers(text)}
      </ReactMarkdown>
    </div>
  );
}

/** Makes [unreadable] / [uncertain: …] stand out as bold, so reviewers spot them. */
function highlightMarkers(text: string) {
  return text.replace(/\[(unreadable|uncertain\b[^\]]*)\]/gi, (m) => `**${m.replace(/\*/g, "")}**`);
}
