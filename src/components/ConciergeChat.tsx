"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { GuestProfile } from "@/lib/data/guests";
import type { ProactiveRecommendation } from "@/lib/engines/concierge";

interface ChatMessage {
  role: "guest" | "concierge";
  text: string;
  intent?: string;
  source?: "llm" | "rules";
}

export default function ConciergeChat() {
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [recommendations, setRecommendations] = useState<ProactiveRecommendation[]>([]);
  const [guestId, setGuestId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/concierge")
      .then((r) => r.json())
      .then((data) => {
        setGuests(data.guests);
        setRecommendations(data.proactiveRecommendations);
        if (data.guests[0]) setGuestId(data.guests[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "guest", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, guestId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [...m, { role: "concierge", text: data.reply, intent: data.intent, source: data.source }]);
      } else {
        setMessages((m) => [...m, { role: "concierge", text: "Sorry, something went wrong processing that request." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "concierge", text: "Sorry, I couldn't reach the concierge service." }]);
    } finally {
      setLoading(false);
    }
  }

  const activeRec = recommendations.find((r) => r.guestId === guestId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-ink-muted" htmlFor="guest-select">
          Guest
        </label>
        <select
          id="guest-select"
          value={guestId}
          onChange={(e) => {
            setGuestId(e.target.value);
            setMessages([]);
          }}
          className="rounded-md border border-border-strong bg-surface-raised px-2 py-1 text-sm"
        >
          {guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.loyaltyTier})
            </option>
          ))}
        </select>
      </div>

      {activeRec && (
        <div className="flex items-start gap-2 rounded-lg border border-border-strong bg-page px-3 py-2 text-xs text-ink-secondary">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-series-1" />
          <span>
            <span className="font-medium text-ink">Proactive suggestion:</span> {activeRec.recommendation}
          </span>
        </div>
      )}

      <div ref={scrollRef} className="h-64 overflow-y-auto rounded-lg border border-border-strong bg-page p-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted">Say hello, or ask about dining, spa, activities, transport, housekeeping, or anything else.</p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex max-w-[85%] flex-col gap-1 ${m.role === "guest" ? "self-end items-end" : "self-start items-start"}`}>
              <div className={`rounded-lg px-3 py-2 text-sm ${m.role === "guest" ? "bg-series-1 text-white" : "bg-surface-raised border border-border-strong text-ink"}`}>
                {m.text}
              </div>
              {m.role === "concierge" && m.source === "rules" && (
                <span className="px-1 text-[11px] text-ink-muted">Offline demo mode - rule-based reply</span>
              )}
            </div>
          ))}
          {loading && <div className="self-start rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-ink-muted">Thinking…</div>}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a guest request…"
          className="flex-1 rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm outline-none focus:border-series-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-series-1 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
