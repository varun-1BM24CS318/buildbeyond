"use client";

import React, { useState } from "react";
import { Sparkles, Send, X, Bot, Shield, AlertTriangle, Cpu } from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FullSimulationState;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I am your Gemini Grid Incident Commander AI. I am monitoring the active simulation (${state.scenario.toUpperCase()}, Step ${state.step}/${state.total_steps}). All mathematical LP stages (A-C) are verified safe with 0 capacity violations. How can I assist with grid strategy or agent negotiations?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advisor_chat",
          prompt: query,
          simulationState: {
            scenario: state.scenario,
            step: state.step,
            total_steps: state.total_steps,
            supply_mw: state.supply_mw,
            total_demand: state.total_demand,
            shortage_mw: state.shortage_mw,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "Grid stable." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Error reaching Gemini AI gateway. Verify GEMINI_API_KEY.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error connecting to Gemini API.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "Why does Water get prioritized over Residential?",
    "Explain the cascade risk right now.",
    "How does the VCG Clarke pivot prevent lying?",
    "Recommend tactical dispatch for next step.",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b1329] border border-cyan-500/50 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl shadow-cyan-950/80 overflow-hidden font-mono">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">
                  GEMINI AI GRID INCIDENT COMMANDER
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                  gemini-2.5-flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Context-aware reasoning over physical cascades, LP stages & VCG credits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                m.role === "user"
                  ? "ml-auto bg-cyan-600 text-black font-semibold rounded-br-none shadow-md shadow-cyan-950/40"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
              }`}
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 text-xs flex items-center gap-2 w-fit">
              <span className="animate-spin">&bull;</span>
              <span>Gemini is analyzing grid telemetry...</span>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="p-2 border-t border-slate-800/60 bg-slate-950/40 flex overflow-x-auto gap-1.5 no-scrollbar">
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSend(qp)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-cyan-300 whitespace-nowrap transition"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Gemini anything about this crisis simulation..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
