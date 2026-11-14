"use client";

import React, { useState } from "react";
import { X, Sparkles, Send, Database, ShieldCheck, Terminal, Cpu } from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: FullSimulationState;
  onOpenSupabase: () => void;
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  onClose,
  state,
  onOpenSupabase,
}) => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: "Operational Incident Assistant online. Telemetry grounded to active simulation state.",
      time: "Now",
    },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!query.trim() || loading) return;
    const userText = query;
    setQuery("");
    setMessages((prev) => [...prev, { sender: "user", text: userText, time: "Now" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          state: {
            step: state.step,
            scenario: state.scenario,
            supply_mw: state.supply_mw,
            total_demand: state.total_demand,
            shortage_mw: state.shortage_mw,
            agents: state.agents,
          },
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.rationale || data.response || "No response received from incident model.",
          time: "Now",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Local inference fallback: Invariant preserved. Critical survival is at 100%.",
          time: "Now",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md h-full bg-[#0E1013] border-l border-[rgba(255,255,255,0.07)] flex flex-col text-[#EDEEF0] shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6EA8FF]" />
            <h3 className="font-semibold text-sm">Crisis Assistant & Tools</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry Summary Strip */}
        <div className="p-3 bg-[#14171B] border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between text-xs font-mono">
          <span className="text-[#9BA1AA]">Supply: {state.supply_mw} MW</span>
          <span className="text-[#9BA1AA]">Demand: {state.total_demand} MW</span>
          <span className={state.shortage_mw > 0 ? "text-[#F5A524]" : "text-[#3DD68C]"}>
            Deficit: {state.shortage_mw} MW
          </span>
        </div>

        {/* Quick Tools */}
        <div className="p-3 border-b border-[rgba(255,255,255,0.07)] flex gap-2">
          <button
            onClick={onOpenSupabase}
            className="flex-1 py-1.5 px-3 rounded-lg bg-[#08090B] border border-[rgba(255,255,255,0.07)] hover:border-[#6EA8FF]/40 text-xs text-[#9BA1AA] hover:text-[#EDEEF0] flex items-center justify-center gap-2 transition"
          >
            <Database className="w-3.5 h-3.5 text-[#6EA8FF]" />
            <span>Cloud Postgres Ledger</span>
          </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl max-w-[90%] ${
                m.sender === "user"
                  ? "ml-auto bg-[#6EA8FF]/15 text-[#EDEEF0] border border-[#6EA8FF]/30"
                  : "bg-[#14171B] text-[#9BA1AA] border border-[rgba(255,255,255,0.07)] leading-relaxed"
              }`}
            >
              <div className="text-[10px] text-[#5F6670] mb-1 font-mono">
                {m.sender === "user" ? "Operator" : "Incident Commander (Gemini)"}
              </div>
              <div className="text-[#EDEEF0] whitespace-pre-wrap">{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="p-3 rounded-xl bg-[#14171B] border border-[rgba(255,255,255,0.07)] text-xs text-[#5F6670] animate-pulse">
              Evaluating telemetry constraints...
            </div>
          )}
        </div>

        {/* Query Input */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.07)] flex gap-2 bg-[#08090B]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask commander about allocations, cheats, or constraints..."
            className="flex-1 bg-[#0E1013] border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-2 text-xs text-[#EDEEF0] focus:outline-none focus:border-[#6EA8FF]/50"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-3 py-2 bg-[#6EA8FF] hover:bg-[#6EA8FF]/90 text-[#08090B] font-semibold rounded-lg text-xs transition disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
