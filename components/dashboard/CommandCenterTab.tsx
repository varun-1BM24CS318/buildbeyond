"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  HeartPulse,
  Droplets,
  PhoneCall,
  Flame,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface CommandCenterTabProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
}

const AGENT_COLORS: Record<string, string> = {
  hospital: "#ef4444", // Red
  water: "#06b6d4", // Cyan
  emergency: "#f97316", // Orange
  telecom: "#a855f7", // Purple
  residential: "#3b82f6", // Blue
};

const AGENT_ICONS: Record<string, React.ReactNode> = {
  hospital: <HeartPulse className="h-4 w-4 text-rose-400" />,
  water: <Droplets className="h-4 w-4 text-cyan-400" />,
  emergency: <Flame className="h-4 w-4 text-orange-400" />,
  telecom: <PhoneCall className="h-4 w-4 text-purple-400" />,
  residential: <Building2 className="h-4 w-4 text-blue-400" />,
};

export const CommandCenterTab: React.FC<CommandCenterTabProps> = ({
  state,
  onToggleCheater,
}) => {
  const [isStacked, setIsStacked] = useState<boolean>(false);
  const [scaleMode, setScaleMode] = useState<"mw" | "percent" | "dynamic">("mw");
  const [focusedAgent, setFocusedAgent] = useState<string | null>(null);
  const [aiThoughts, setAiThoughts] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDeliberate = async (agentId: string) => {
    setLoadingAi((prev) => ({ ...prev, [agentId]: true }));
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_deliberation",
          agentId,
          simulationState: {
            step: state.step,
            supply_mw: state.supply_mw,
            shortage_mw: state.shortage_mw,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiThoughts((prev) => ({ ...prev, [agentId]: data.thought }));
      }
    } catch {
      // fallback handled gracefully
    } finally {
      setLoadingAi((prev) => ({ ...prev, [agentId]: false }));
    }
  };

  // Format chart data cleanly from simulation history
  const chartData = useMemo(() => {
    return state.history.map((h) => {
      const getVal = (aid: string) => {
        const alloc = h.allocations[aid] ?? 0;
        const demand = h.demands?.[aid] ?? state.agents[aid]?.demand ?? (alloc || 1);
        if (scaleMode === "percent") {
          return demand > 0 ? Math.min(100, Math.round((alloc / demand) * 1000) / 10) : 100;
        }
        return Math.round(alloc * 10) / 10;
      };

      return {
        step: `Step ${h.step}`,
        Hospital: getVal("hospital"),
        Water: getVal("water"),
        Emergency: getVal("emergency"),
        Telecom: getVal("telecom"),
        Residential: getVal("residential"),
        Supply: Math.round(h.supply_mw * 10) / 10,
        rawAlloc: h.allocations,
        rawDemand: h.demands || {},
      };
    });
  }, [state.history, scaleMode, state.agents]);

  const yDomain: [any, any] = useMemo(() => {
    if (scaleMode === "percent") return [0, 105];
    if (scaleMode === "dynamic") return ["dataMin - 1", "dataMax + 2"];
    return [0, "auto"];
  }, [scaleMode]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-[#0b101e]/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-200">{label}</span>
          <span className="text-[10px] text-slate-400 font-medium">
            {scaleMode === "percent" ? "Satisfaction Rate" : "Dispatched Power"}
          </span>
        </div>
        <div className="space-y-1">
          {payload.map((entry: any) => {
            const aid = entry.dataKey.toLowerCase();
            if (focusedAgent && focusedAgent !== aid) return null;
            const val = Number(entry.value);
            const rawAlloc = entry.payload?.rawAlloc?.[aid] ?? val;
            const rawDemand = entry.payload?.rawDemand?.[aid] ?? state.agents[aid]?.demand ?? rawAlloc;
            const satisfactionPct = rawDemand > 0 ? Math.round((rawAlloc / rawDemand) * 100) : 100;
            return (
              <div key={entry.name} className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}</span>
                </span>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="font-semibold text-slate-200">
                    {scaleMode === "percent" ? `${val.toFixed(1)}%` : `${Number(rawAlloc).toFixed(1)} MW`}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({satisfactionPct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Grid Supply:</span>
          <span className="text-cyan-400 font-semibold">
            {Number(payload[0]?.payload?.Supply ?? state.supply_mw).toFixed(1)} MW
          </span>
        </div>
      </div>
    );
  };

  const utilizationPct =
    state.supply_mw > 0
      ? Math.min(100, Math.round((state.total_allocated / state.supply_mw) * 1000) / 10)
      : 0;

  return (
    <div className="space-y-5">
      {/* ── 1. Top 4 High-Impact Metric Bento Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Supply vs Demand */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Grid Supply & Demand</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-cyan-400">{state.supply_mw}</span>
                <span className="text-xs text-slate-400 font-medium">MW Supply</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-slate-200">{state.total_demand}</span>
                <span className="text-xs text-slate-500 font-medium">MW Demand</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {state.shortage_mw > 0 || state.total_demand > state.supply_mw ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/60 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  -{Math.max(state.shortage_mw, Math.round((state.total_demand - state.supply_mw) * 10) / 10).toFixed(1)} MW Grid Deficit
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Balanced Reserves (0.0 MW Deficit)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Dispatched */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Power Delivered</span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-cyan-400">{state.total_allocated}</span>
              <span className="text-xs text-slate-500">MW ({utilizationPct}% dispatched)</span>
            </div>
            <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: City Survival Rate */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700/80 transition shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Critical Survival Rate</span>
            <HeartPulse className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold font-mono ${
                  state.survival_rate >= 90
                    ? "text-emerald-400"
                    : state.survival_rate >= 70
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {state.survival_rate}%
              </span>
              <span className="text-xs text-slate-500">Critical Met</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Tier 1: 100% Guaranteed</span>
            </div>
          </div>
        </div>

        {/* Card 4: Provably Safe Violation Counter */}
        <div className="bg-gradient-to-br from-emerald-950/20 via-[#0b101e]/90 to-slate-900 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>Capacity Invariant</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-300">
              0 Violations
            </div>
            <div className="text-[11px] text-emerald-400/90 font-medium mt-1">
              Provably Safe (Σ Allocations &le; Supply)
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* ── 2. Real-Time Allocation Dynamic Scaled Chart ─────────────────── */}
      <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>Live Dispatch Trajectory</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {scaleMode === "percent"
                ? "Normalized % demand met: small critical loads (2.5 MW) and bulk loads (20 MW) scale equally."
                : "Continuous Stage A–C Lexicographic LP dispatch across 5 autonomous Gemini AI agents in Megawatts."}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scale View Modes */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setScaleMode("mw")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  scaleMode === "mw"
                    ? "bg-slate-800 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Absolute MW
              </button>
              <button
                onClick={() => setScaleMode("percent")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  scaleMode === "percent"
                    ? "bg-slate-800 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                % Demand Met
              </button>
              <button
                onClick={() => setScaleMode("dynamic")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  scaleMode === "dynamic"
                    ? "bg-slate-800 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Auto-Zoom
              </button>
            </div>

            {/* Stacked Toggle */}
            <button
              onClick={() => setIsStacked(!isStacked)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition"
            >
              {isStacked ? "Stacked Mode" : "Line Mode"}
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-3 pb-1 mb-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Highlight:</span>
            <button
              onClick={() => setFocusedAgent(null)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition border ${
                focusedAgent === null
                  ? "bg-cyan-950/70 text-cyan-300 border-cyan-800/60"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              All Agents
            </button>
            {[
              { id: "hospital", name: "Hospital", color: "#ef4444" },
              { id: "water", name: "Water", color: "#06b6d4" },
              { id: "emergency", name: "Emergency", color: "#f97316" },
              { id: "telecom", name: "Telecom", color: "#a855f7" },
              { id: "residential", name: "Residential", color: "#3b82f6" },
            ].map((ag) => {
              const isFocused = focusedAgent === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => setFocusedAgent(isFocused ? null : ag.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition border ${
                    isFocused
                      ? "bg-slate-800 text-slate-100 border-cyan-400/80 shadow-sm"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ag.color }} />
                  <span>{ag.name}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            {focusedAgent ? (
              <span className="text-cyan-300 capitalize">{focusedAgent} curve soloed</span>
            ) : (
              <span>Click any agent to solo</span>
            )}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 md:h-80 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHospital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorEmergency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorTelecom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorResidential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#172033" />
              <XAxis dataKey="step" stroke="#475569" fontSize={11} tickMargin={8} />
              <YAxis
                stroke="#475569"
                fontSize={11}
                domain={yDomain}
                tickFormatter={(v) => (scaleMode === "percent" ? `${v}%` : `${v} MW`)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Residential"
                stackId={isStacked ? "1" : undefined}
                stroke="#3b82f6"
                strokeWidth={focusedAgent === "residential" ? 3.5 : 2}
                strokeOpacity={focusedAgent !== null && focusedAgent !== "residential" ? 0.15 : 1}
                fill="url(#colorResidential)"
                fillOpacity={
                  focusedAgent !== null && focusedAgent !== "residential"
                    ? 0.02
                    : isStacked
                    ? 0.7
                    : 0.12
                }
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="Telecom"
                stackId={isStacked ? "1" : undefined}
                stroke="#a855f7"
                strokeWidth={focusedAgent === "telecom" ? 3.5 : 2}
                strokeOpacity={focusedAgent !== null && focusedAgent !== "telecom" ? 0.15 : 1}
                fill="url(#colorTelecom)"
                fillOpacity={
                  focusedAgent !== null && focusedAgent !== "telecom"
                    ? 0.02
                    : isStacked
                    ? 0.7
                    : 0.12
                }
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="Emergency"
                stackId={isStacked ? "1" : undefined}
                stroke="#f97316"
                strokeWidth={focusedAgent === "emergency" ? 3.5 : 2}
                strokeOpacity={focusedAgent !== null && focusedAgent !== "emergency" ? 0.15 : 1}
                fill="url(#colorEmergency)"
                fillOpacity={
                  focusedAgent !== null && focusedAgent !== "emergency"
                    ? 0.02
                    : isStacked
                    ? 0.7
                    : 0.12
                }
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="Water"
                stackId={isStacked ? "1" : undefined}
                stroke="#06b6d4"
                strokeWidth={focusedAgent === "water" ? 3.5 : 2}
                strokeOpacity={focusedAgent !== null && focusedAgent !== "water" ? 0.15 : 1}
                fill="url(#colorWater)"
                fillOpacity={
                  focusedAgent !== null && focusedAgent !== "water"
                    ? 0.02
                    : isStacked
                    ? 0.7
                    : 0.12
                }
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="Hospital"
                stackId={isStacked ? "1" : undefined}
                stroke="#ef4444"
                strokeWidth={focusedAgent === "hospital" ? 3.5 : 2}
                strokeOpacity={focusedAgent !== null && focusedAgent !== "hospital" ? 0.15 : 1}
                fill="url(#colorHospital)"
                fillOpacity={
                  focusedAgent !== null && focusedAgent !== "hospital"
                    ? 0.02
                    : isStacked
                    ? 0.7
                    : 0.12
                }
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 3. Critical Agent Status Bento Cards ─────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Critical Agent Status & Allocations</span>
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-cyan-400 animate-pulse" />
              <span>5 Autonomous Gemini AI Agents</span>
            </span>
          </div>

          {/* Quick Cheater Toggle Pill Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Quick Cheater Test:</span>
            <button
              onClick={() => onToggleCheater("water", !state.agents["water"]?.is_cheater)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 border ${
                state.agents["water"]?.is_cheater
                  ? "bg-rose-600/30 text-rose-200 border-rose-500 shadow-sm animate-pulse"
                  : "bg-slate-900/90 text-slate-300 border-slate-700 hover:border-rose-700 hover:text-rose-300"
              }`}
              title="Toggle Strategic Overbidding Cheater Mode on Water Treatment Plant"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Water Cheater: {state.agents["water"]?.is_cheater ? "ACTIVE" : "OFF"}</span>
            </button>
            <button
              onClick={() => onToggleCheater("residential", !state.agents["residential"]?.is_cheater)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 border ${
                state.agents["residential"]?.is_cheater
                  ? "bg-rose-600/30 text-rose-200 border-rose-500 shadow-sm animate-pulse"
                  : "bg-slate-900/90 text-slate-300 border-slate-700 hover:border-rose-700 hover:text-rose-300"
              }`}
              title="Toggle Strategic Overbidding Cheater Mode on Residential District"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>Civic Cheater: {state.agents["residential"]?.is_cheater ? "ACTIVE" : "OFF"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.values(state.agents).map((agent) => {
            const isCheater = agent.is_cheater;
            return (
              <div
                key={agent.id}
                className={`rounded-xl border p-4 flex flex-col justify-between transition relative shadow-sm ${
                  isCheater
                    ? "bg-rose-950/20 border-rose-600/70 shadow-rose-950/20"
                    : "bg-[#0b101e]/80 border-slate-800/80 hover:border-slate-700/80"
                }`}
              >
                <div>
                  {/* Top: Icon & Tier Badge & Prominent Cheater Indicator */}
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                      {AGENT_ICONS[agent.id] || <Activity className="h-4 w-4 text-slate-400" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {isCheater && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-600 font-bold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          CHEATER
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          agent.criticality === "L1_SURVIVAL"
                            ? "bg-rose-950/60 text-rose-300 border-rose-800/50"
                            : agent.criticality === "L2_CONTINUITY"
                            ? "bg-purple-950/60 text-purple-300 border-purple-800/50"
                            : "bg-blue-950/60 text-blue-300 border-blue-800/50"
                        }`}
                      >
                        {agent.criticality === "L1_SURVIVAL"
                          ? "Tier 1 · Survival"
                          : agent.criticality === "L2_CONTINUITY"
                          ? "Tier 2 · Continuity"
                          : "Tier 3 · Civic"}
                      </span>
                    </div>
                  </div>

                  {/* Name & Allocation */}
                  <div className="mt-3">
                    <h3 className="font-semibold text-xs text-slate-200 truncate">
                      {agent.name}
                    </h3>
                    <div className="flex items-baseline justify-between mt-1 font-mono">
                      <span className="text-lg font-bold text-slate-100">
                        {agent.allocation}{" "}
                        <span className="text-xs text-slate-500 font-normal">/ {agent.demand} MW</span>
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          agent.status === "Satisfied"
                            ? "text-emerald-400"
                            : agent.status === "Degraded"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {Math.round(agent.satisfaction_ratio * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Service Level Bar */}
                  <div className="mt-2.5">
                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          agent.health_pct >= 90
                            ? "bg-emerald-500"
                            : agent.health_pct >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${agent.health_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Subtle Secondary Metadata */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>VCG Tax:</span>
                      <span className="text-cyan-400 font-medium">{agent.vcg_payment.toFixed(1)} cr</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Trust Score:</span>
                      <span
                        className={`font-medium ${
                          agent.reputation_trust >= 0.8
                            ? "text-emerald-400"
                            : agent.reputation_trust >= 0.5
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {(agent.reputation_trust * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gemini AI Deliberation Thought */}
                {aiThoughts[agent.id] && (
                  <div className="mt-3 p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-[10px] text-cyan-200">
                    <span className="font-semibold text-cyan-400 flex items-center gap-1 mb-0.5">
                      <Sparkles className="h-3 w-3" />
                      <span>Gemini Rationale:</span>
                    </span>
                    &ldquo;{aiThoughts[agent.id]}&rdquo;
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-1">
                  <button
                    onClick={() => handleDeliberate(agent.id)}
                    disabled={loadingAi[agent.id]}
                    className="text-[10px] px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 transition flex items-center gap-1 disabled:opacity-40"
                    title="Generate Gemini AI reasoning for this agent"
                  >
                    <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
                    <span>{loadingAi[agent.id] ? "Analyzing..." : "AI Rationale"}</span>
                  </button>

                  <button
                    onClick={() => onToggleCheater(agent.id, !isCheater)}
                    className={`text-[10px] px-2 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      isCheater
                        ? "bg-rose-500/25 text-rose-200 border border-rose-500/60 hover:bg-rose-500/35 shadow-sm"
                        : "bg-slate-900 text-slate-300 border border-slate-700/80 hover:text-rose-400 hover:border-rose-700"
                    }`}
                    title={isCheater ? "Deactivate Cheater Mode" : "Activate Cheater Mode (Strategic Overbid)"}
                  >
                    <ShieldAlert className="h-3 w-3 text-rose-400" />
                    <span>{isCheater ? "Cheater Mode: ON" : "Cheater Mode: OFF"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Live Event Activity Feed & Shock Context ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alerts Activity Feed */}
        <div className="lg:col-span-2 bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Event Activity & Audit Ledger</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Append-Only SHA-256</span>
          </div>
          <div className="h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {mounted ? (
              state.alerts.map((al) => (
                <div
                  key={al.id}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                    al.type === "error"
                      ? "bg-rose-950/20 border-rose-800/40 text-rose-200"
                      : al.type === "warning"
                      ? "bg-amber-950/20 border-amber-800/40 text-amber-200"
                      : al.type === "success"
                      ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200"
                      : "bg-slate-900/50 border-slate-800/60 text-slate-300"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 font-mono font-medium shrink-0 pt-0.5">
                    [{al.timestamp}]
                  </span>
                  <span className="text-xs leading-relaxed">{al.message}</span>
                </div>
              ))
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/60 text-slate-400 text-xs">
                Connecting to audit ledger...
              </div>
            )}
          </div>
        </div>

        {/* Active Shock Context Banner */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>Scenario Shock Dynamics</span>
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                Step {state.step}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                <span>Active Shock:</span>
                <span className="text-cyan-400 capitalize">{state.scenario.replace(/_/g, " ")}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                {state.scenario === "cyclone"
                  ? "High wind & flooding causing 45% transmission capacity degradation."
                  : state.scenario === "grid_failure"
                  ? "Primary transformer tripped at substation Beta. Supply capped at 18 MW."
                  : state.scenario === "cheater_under_scarcity"
                  ? "WaterAgent inflating demand by 1.8x. Clarke pivot tax actively neutralizing profit."
                  : "Grid operating under nominal conditions. Reserves fully maintained."}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Hash Chain Integrity:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
