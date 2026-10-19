"use client";

import { useTranslations } from "next-intl";
import { ChatWidget } from "@/components/shared/chat-widget";
import { Card } from "@/components/ui/card";

export function MessagesView() {
  const t = useTranslations("clinic.messages");
  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h2 className="font-serif text-xl font-bold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card className="flex-1 min-h-[560px] border-border/50 bg-card/60 overflow-hidden">
        <ChatWidget />
      </Card>
    </div>
  );
}
