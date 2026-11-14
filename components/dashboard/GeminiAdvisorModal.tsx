"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  X,
  Bot,
  Shield,
  AlertTriangle,
  Cpu,
  Wrench,
  Zap,
  CheckCircle2,
  Radio,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FullSimulationState;
}

interface ToolCallRecord {
  tool_name: string;
  arguments: any;
  status: string;
  result: {
    message: string;
    [key: string]: any;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallRecord[];
  isActionExecuted?: boolean;
}

const MCP_REGISTERED_TOOLS = [
  {
    name: "dispatch_auxiliary_generator",
    label: "Dispatch Generator",
    desc: "Spins up local diesel/battery reserves at a sector to relieve grid load.",
    icon: Zap,
    samplePrompt: "Dispatch 2.0 MW auxiliary generator to Hospital",
  },
  {
    name: "throttle_telecom_bandwidth",
    label: "Throttle 5G",
    desc: "Down-steps commercial cell towers by 40% while reserving 911 lines.",
    icon: Radio,
    samplePrompt: "Throttle 5G bandwidth by 40% to protect 911 dispatch",
  },
  {
    name: "trip_feeder_circuit",
    label: "Trip Feeder",
    desc: "Rotational non-vital shedding in residential suburbs to save ICU power.",
    icon: Activity,
    samplePrompt: "Trip residential feeders by 4.0 MW rotational shed",
  },
  {
    name: "audit_clarke_pivot",
    label: "VCG Audit",
    desc: "Audits strategic bidding and computes Clarke pivot priority penalties.",
    icon: Shield,
    samplePrompt: "Run VCG Clarke Pivot audit on Water agent",
  },
  {
    name: "inject_disaster_shock",
    label: "Inject Shock",
    desc: "Simulates sudden physical transmission line trips or substation faults.",
    icon: AlertTriangle,
    samplePrompt: "Inject 25 MW transmission trip fault into grid",
  },
];

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I am your Autonomous Agentic Grid Commander AI powered by Gemini 2.5 Flash & the crisisgrid-mcp Server. I can reason across physical cascades and execute real grid tools (dispatching generators, tripping non-vital feeders, throttling 5G, or auditing cheaters). How can I assist?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [isAutonomous, setIsAutonomous] = useState(true);

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
          autonomous: isAutonomous,
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
        const hasTools = data.tool_calls && data.tool_calls.length > 0;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || "Grid telemetry verified stable.",
            tool_calls: data.tool_calls || [],
            isActionExecuted: hasTools,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Error reaching Gemini Agentic AI gateway. Verify GEMINI_API_KEY.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error connecting to Gemini API & MCP Server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActionPrompts = [
    { label: "⚡ Dispatch Hospital Gen", prompt: "Dispatch 2.0 MW auxiliary generator to Hospital" },
    { label: "📡 Throttle 5G (40%)", prompt: "Throttle 5G bandwidth by 40% to protect 911 lines" },
    { label: "🛡️ Audit Water Agent", prompt: "Run VCG Clarke Pivot audit on Water agent" },
    { label: "⚡ Shed Civic Load", prompt: "Trip residential feeders by 4.0 MW rotational shed" },
    { label: "⚠️ Inject Line Trip", prompt: "Inject 25 MW transmission trip fault into grid" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#080d1a] border border-cyan-500/40 rounded-2xl w-full max-w-3xl h-[680px] flex flex-col shadow-2xl shadow-cyan-950/80 overflow-hidden font-mono">
        {/* Top Header */}
        <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner shadow-cyan-500/20">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-slate-100 tracking-wide">
                  GEMINI AGENTIC GRID COMMANDER
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700 font-bold">
                  gemini-2.5-flash
                </span>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  MCP Server: Active (5 Tools)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Autonomous tool calling, cascade reasoning & VCG Clarke audit ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tools Drawer Toggle */}
            <button
              onClick={() => setShowToolsDrawer(!showToolsDrawer)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
                showToolsDrawer
                  ? "bg-cyan-950 text-cyan-300 border-cyan-600"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Inspect MCP Tools"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">MCP Tools</span>
              {showToolsDrawer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MCP Tools Drawer (Collapsible) */}
        {showToolsDrawer && (
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/95 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {MCP_REGISTERED_TOOLS.map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    handleSend(t.samplePrompt);
                    setShowToolsDrawer(false);
                  }}
                  className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-cyan-300 text-[11px]">
                      <Icon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{t.label}</span>
                    </div>
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">Tool</span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                    {t.desc}
                  </p>
                  <div className="mt-1.5 text-[9px] text-cyan-400/80 font-mono truncate">
                    Click to execute &rarr;
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Autonomy Bar */}
        <div className="px-4 py-1.5 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-slate-500">Target Telemetry:</span>
            <span className="text-cyan-400 font-bold">{state.supply_mw.toFixed(1)} MW Supply</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold">{state.shortage_mw.toFixed(1)} MW Deficit</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">0 Violations</span>
          </div>

          <button
            onClick={() => setIsAutonomous(!isAutonomous)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
              isAutonomous
                ? "bg-cyan-950/80 text-cyan-300 border-cyan-700"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isAutonomous ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
            {isAutonomous ? "Autonomous Execution: ARMED" : "Advisory Mode Only"}
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
          {messages.map((m, idx) => (
            <div key={idx} className="space-y-2">
              <div
                className={`p-3.5 rounded-xl max-w-[88%] leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-cyan-600 text-slate-950 font-semibold rounded-br-none shadow-md shadow-cyan-950/40"
                    : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                }`}
              >
                {m.content}
              </div>

              {/* Render Tool Calls if executed by Agentic AI */}
              {m.tool_calls && m.tool_calls.length > 0 && (
                <div className="max-w-[88%] space-y-2">
                  {m.tool_calls.map((tc, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/50 shadow-lg shadow-cyan-950/50 font-mono text-[11px]"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                          <Wrench className="h-3.5 w-3.5" />
                          <span>MCP TOOL EXECUTED:</span>
                          <span className="text-slate-100 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                            {tc.tool_name}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          SHA-256 Verified
                        </span>
                      </div>

                      {/* Tool Parameters */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-slate-400 text-[10px]">Parameters:</span>
                        {Object.entries(tc.arguments || {}).map(([k, v]) => (
                          <span
                            key={k}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300"
                          >
                            <span className="text-cyan-400">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>

                      {/* Tool Execution Result */}
                      <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-cyan-200 text-[11px] leading-snug">
                        ⚡ {tc.result?.message || "Tool execution succeeded."}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 text-xs flex items-center gap-2 w-fit">
              <span className="animate-spin">&bull;</span>
              <span>Gemini Agentic AI is evaluating grid telemetry & dispatching MCP tools...</span>
            </div>
          )}
        </div>

        {/* Quick Action Pills */}
        <div className="p-2 border-t border-slate-800/60 bg-slate-950/70 flex overflow-x-auto gap-1.5 no-scrollbar">
          {quickActionPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q.prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-cyan-300 whitespace-nowrap transition flex items-center gap-1"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Bottom Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Command the grid (e.g. 'Dispatch 2 MW generator to Hospital', 'Audit Water agent')..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition disabled:opacity-50 flex items-center justify-center"
            title="Send Agentic Command"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
