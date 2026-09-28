"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Search, MessageSquare, Loader2, Phone, Video, MoreVertical } from "lucide-react";
import { toast } from "sonner";

interface Conversation {
  partnerId: string;
  partnerType: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  partner: any;
}

interface Message {
  id: string;
  senderId: string;
  senderType: string;
  receiverId: string;
  receiverType: string;
  content: string;
  createdAt: string;
}

interface ChatWidgetProps {
  /** Restrict to a single partner (e.g. right-panel mini chat). If provided, hides the conversation list. */
  partnerId?: string;
  partnerType?: string;
  partnerName?: string;
  compact?: boolean;
}

export function ChatWidget({ partnerId, partnerType, partnerName, compact }: ChatWidgetProps) {
  const hakim = useAppStore((s) => s.hakim);
  const patient = useAppStore((s) => s.patient);
  const me = hakim ? { id: hakim.id, type: "hakim" as const } : patient ? { id: patient.id, type: "patient" as const } : null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<{ id: string; type: string; name: string } | null>(
    partnerId && partnerType && partnerName ? { id: partnerId, type: partnerType, name: partnerName } : null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = async () => {
    if (partnerId) return; // single-partner mode
    try {
      const res = await api.get<{ conversations: Conversation[] }>("/api/messages/conversations");
      setConversations(res.conversations || []);
    } catch {
      /* ignore */
    }
  };

  // Load messages for active partner
  const loadMessages = async () => {
    if (!activePartner || !me) return;
    try {
      const res = await api.get<{ messages: Message[] }>(
        `/api/messages?partnerId=${activePartner.id}&partnerType=${activePartner.type}`
      );
      setMessages(res.messages || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!me) return;
    if (partnerId) {
      setActivePartner({ id: partnerId, type: partnerType!, name: partnerName! });
      return;
    }
    setLoadingConv(true);
    loadConversations().finally(() => setLoadingConv(false));
    const t = setInterval(loadConversations, 5000);
    return () => clearInterval(t);
  }, [me?.id, partnerId]);

  useEffect(() => {
    if (!activePartner) return;
    setLoadingMsgs(true);
    loadMessages().finally(() => setLoadingMsgs(false));
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, [activePartner?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !activePartner || !me) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    // optimistic
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      senderId: me.id,
      senderType: me.type,
      receiverId: activePartner.id,
      receiverType: activePartner.type,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      await api.post("/api/messages", {
        receiverId: activePartner.id,
        receiverType: activePartner.type,
        content,
      });
      loadMessages();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  if (!me) return null;

  const filteredConversations = conversations.filter((c) =>
    c.partner?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Single-partner compact mode (right panel mini chat)
  if (partnerId && activePartner) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(activePartner.name === "Dr. Aliam Colter" ? "teal" : "amber"))}>
              {initials(activePartner.name)}
            </div>
            <div>
              <p className="text-sm font-medium leading-none">{activePartner.name}</p>
              <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active now
              </p>
            </div>
          </div>
          <div className="flex gap-1 text-muted-foreground">
            <button className="p-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" /></button>
            <button className="p-1.5 hover:text-foreground"><Video className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
          {messages.map((m) => {
            const mine = m.senderId === me.id && m.senderType === me.type;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-3 py-1.5 text-xs leading-relaxed",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  {m.content}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hello 👋</p>
          )}
        </div>
        <div className="flex gap-1.5 p-2 border-t border-border">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Type your message…"
            className="h-8 text-xs bg-background/60"
          />
          <Button size="icon" onClick={send} disabled={sending || !draft.trim()} className="h-8 w-8 rounded-full bg-primary shrink-0">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  // Full chat (messages view)
  return (
    <div className={cn("grid gap-0 h-full", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[300px_1fr]")}>
      {/* Conversation list */}
      {!compact && (
        <div className="border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="pl-8 h-9 text-sm bg-background/60"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingConv ? (
              <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading…</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
                No conversations yet.
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {filteredConversations.map((c) => (
                  <button
                    key={`${c.partnerType}|${c.partnerId}`}
                    onClick={() => setActivePartner({ id: c.partnerId, type: c.partnerType, name: c.partner?.name || "User" })}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg transition-colors flex gap-2.5 items-center",
                      activePartner?.id === c.partnerId ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(c.partner?.avatarColor))}>
                      {initials(c.partner?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{c.partner?.name}</p>
                        {c.unread > 0 && <Badge className="h-4 px-1.5 text-[10px] bg-primary text-primary-foreground">{c.unread}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Thread */}
      <div className="flex flex-col min-h-0">
        {activePartner ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(activePartner.name?.includes("Dr") ? "teal" : "amber"))}>
                  {initials(activePartner.name)}
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">{activePartner.name}</p>
                  <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active now
                  </p>
                </div>
              </div>
              <div className="flex gap-1 text-muted-foreground">
                <button className="p-2 hover:text-foreground rounded-md hover:bg-muted"><Phone className="h-4 w-4" /></button>
                <button className="p-2 hover:text-foreground rounded-md hover:bg-muted"><Video className="h-4 w-4" /></button>
                <button className="p-2 hover:text-foreground rounded-md hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loadingMsgs && messages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading messages…</div>
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === me.id && m.senderType === me.type;
                  const prev = messages[i - 1];
                  const showAvatar = !mine && (!prev || prev.senderId !== m.senderId);
                  return (
                    <div key={m.id} className={cn("flex gap-2 items-end", mine ? "justify-end" : "justify-start")}>
                      {!mine && (
                        <div className={cn("h-6 w-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-semibold text-white shrink-0", avatarGradient("amber"), !showAvatar && "opacity-0")}>
                          {initials(activePartner.name)}
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                      )}>
                        {m.content}
                        <div className={cn("text-[10px] mt-0.5", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {messages.length === 0 && !loadingMsgs && (
                <div className="text-center text-sm text-muted-foreground py-12">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No messages yet. Start the conversation.
                </div>
              )}
            </div>
            <div className="flex gap-2 p-3 border-t border-border">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type your message…"
                className="bg-background/60"
              />
              <Button onClick={send} disabled={sending || !draft.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs">Choose a person from the list to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
