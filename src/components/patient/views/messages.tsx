"use client";

import { ChatWidget } from "@/components/shared/chat-widget";
import { Card } from "@/components/ui/card";

export function PatientMessagesView() {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h2 className="font-serif text-xl font-bold">Messages</h2>
        <p className="text-sm text-muted-foreground">Secure conversations with your Hakims.</p>
      </div>
      <Card className="flex-1 min-h-[560px] border-border/50 bg-card/60 overflow-hidden">
        <ChatWidget />
      </Card>
    </div>
  );
}
