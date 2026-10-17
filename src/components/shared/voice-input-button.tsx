"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
      toast.error("Voice input isn't supported in this browser");
      return;
    }
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
        toast.error("Could not capture voice input");
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  if (!supported) return null;

  return (
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
  );
}
