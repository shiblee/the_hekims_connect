"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";

/**
 * A small mic button that dictates into any text field via the Web Speech
 * API. `continuous: true` + `interimResults: true` keeps the mic open across
 * pauses (so a full note can be dictated in one go) and only reports a
 * segment through `onResult` once the browser has finalized it — the caller
 * appends each finalized chunk rather than receiving one big replace, so
 * dictation composes cleanly with whatever the user already typed.
 *
 * Renders nothing when the browser has no SpeechRecognition support (Safari,
 * Firefox) rather than showing a broken button.
 */
export function VoiceInputButton({
  onResult, className, size = "sm",
}: {
  onResult: (text: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const [supported] = useState(() => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // A short note under the mic when dictation fails — no pop-up.
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 6000);
    return () => clearTimeout(t);
  }, [hint]);

  // Stop any in-progress recognition on unmount — a pure side-effect cleanup,
  // no setState in the effect body itself.
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setHint("Voice input isn't available in this browser — type instead.");
      return;
    }
    setHint(null);
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const text = ev.results[i][0].transcript.trim();
          if (text) onResult(text);
        }
      }
    };
    recognition.onerror = (ev: any) => {
      setListening(false);
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setHint(ev.error === "not-allowed" ? "Microphone is blocked — allow it for this site, then try again." : "Didn't catch that — tap the mic and speak again.");
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  if (!supported) return null;

  return (
    <span className="relative inline-flex shrink-0">
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      title={listening ? "Listening… click to stop" : "Dictate"}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-colors shrink-0",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        listening ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className
      )}
    >
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
          <span className="absolute inset-0 rounded-full bg-destructive/25 animate-ping [animation-delay:300ms]" />
        </>
      )}
      <Mic className={cn("relative z-10", size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
    </button>
    {hint && (
      <span role="status" className="absolute end-0 top-full mt-1 z-30 w-56 rounded-md border border-amber-500/40 bg-card px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400 shadow-md">
        {hint}
      </span>
    )}
    </span>
  );
}
