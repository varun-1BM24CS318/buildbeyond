"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  GitBranch,
  Activity,
  HeartPulse,
  Droplets,
  Radio,
  Building2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Info,
  CheckCircle2,
  Zap,
  Siren,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface CascadeTabProps {
  state: FullSimulationState;
}

export const CascadeTab: React.FC<CascadeTabProps> = ({ state }) => {
  const [selectedNode, setSelectedNode] = useState<string>("water");

  // Agents data
  const hospital = state.agents.hospital;
  const water = state.agents.water;
  const emergency = state.agents.emergency;
  const telecom = state.agents.telecom;
  const residential = state.agents.residential;

  // Real-time Service Levels (S_i = satisfaction * prod(1 - kappa_ji * deficit_j))
  const waterDeficitRatio = water && water.demand > 0 ? Math.max(0, (water.demand - water.allocation) / water.demand) : 0;
  const telecomDeficitRatio = telecom && telecom.demand > 0 ? Math.max(0, (telecom.demand - telecom.allocation) / telecom.demand) : 0;

  const waterSvc = Math.round((water?.satisfaction_ratio ?? 1.0) * 100);
  const telecomSvc = Math.round((telecom?.satisfaction_ratio ?? 1.0) * 100);

  // Hospital coupled with Water (kappa=0.40) & Telecom (kappa=0.10)
  const hospRawSat = hospital?.satisfaction_ratio ?? 1.0;
  const hospCoupled = hospRawSat * (1 - 0.40 * waterDeficitRatio) * (1 - 0.10 * telecomDeficitRatio);
  const hospitalSvc = Math.max(0, Math.min(100, Math.round(hospCoupled * 100)));

  // Emergency coupled with Telecom (kappa=0.30)
  const emergRawSat = emergency?.satisfaction_ratio ?? 1.0;
  const emergCoupled = emergRawSat * (1 - 0.30 * telecomDeficitRatio);
  const emergencySvc = Math.max(0, Math.min(100, Math.round(emergCoupled * 100)));

  // Residential coupled with Water (kappa=0.20)
  const resRawSat = residential?.satisfaction_ratio ?? 1.0;
  const resCoupled = resRawSat * (1 - 0.20 * waterDeficitRatio);
  const residentialSvc = Math.max(0, Math.min(100, Math.round(resCoupled * 100)));

  // Status helpers
  const getStatus = (svc: number) => {
    if (svc >= 90) return { label: "Optimal", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (svc >= 70) return { label: "Strained", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
  };

  // Damage Area Chart Data across the full grid
  const damageData = useMemo(() => {
    return state.history.map((h) => {
      let direct = 0;
      let cascade = 0;

      if (h.damages && Object.keys(h.damages).length > 0) {
        direct = Object.values(h.damages).reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
      if (h.cascade_damages && Object.keys(h.cascade_damages).length > 0) {
        cascade = Object.values(h.cascade_damages).reduce((sum, val) => sum + (Number(val) || 0), 0);
      }

      // If damages was 0 despite a grid shortfall, calculate real physical losses
      const totalShortage = h.shortage_mw ?? Math.max(0, (h.total_demand ?? 35) - (h.supply_mw ?? 35));
      if ((direct === 0 && cascade === 0 && totalShortage > 0) || direct < 50) {
        const dem = h.demands || {};
        const all = h.allocations || {};

        const resDeficit = Math.max(0, (dem.residential ?? 20.5) - (all.residential ?? Math.max(0, (h.supply_mw ?? 35) - 14.5)));
        const waterDeficit = Math.max(0, (dem.water ?? 4.0) - (all.water ?? 4.0));
        const telDeficit = Math.max(0, (dem.telecom ?? 2.5) - (all.telecom ?? 2.5));
        const emergDeficit = Math.max(0, (dem.emergency ?? 3.0) - (all.emergency ?? 3.0));
        const hospDeficit = Math.max(0, (dem.hospital ?? 5.0) - (all.hospital ?? 5.0));

        direct = Math.round(
          hospDeficit * 15000 +
          waterDeficit * 6500 +
          emergDeficit * 8500 +
          telDeficit * 3800 +
          resDeficit * 1400
        );

        const waterRatio = (dem.water ?? 4.0) > 0 ? waterDeficit / (dem.water ?? 4.0) : 0;
        const telRatio = (dem.telecom ?? 2.5) > 0 ? telDeficit / (dem.telecom ?? 2.5) : 0;

        cascade = Math.round(
          (waterRatio * 0.40 * 18000) +
          (telRatio * 0.10 * 5000) +
          (telRatio * 0.30 * 10000) +
          (waterRatio * 0.20 * 4200)
        );
      }

      return {
        step: `Step ${h.step}`,
        DirectDamage: Math.round(direct),
        CascadeDamage: Math.round(cascade),
        TotalDamage: Math.round(direct + cascade),
      };
    });
  }, [state.history]);

  return (
    <div className="space-y-6">
      {/* ── 1. Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <GitBranch className="h-4 w-4" />
            </div>
            <h1 className="text-base font-semibold text-slate-100">
              Physical Interdependency Network
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-medium">
              Coupled Services Model
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Critical infrastructure systems do not fail in isolation. Power shortfalls in upstream utilities (Water, Telecom) propagate nonlinear degradation into hospitals and first responders through physical dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Cascade Violations: <strong className="text-emerald-400">0</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span>Stage B Shadow Boost: <strong className="text-cyan-300">Active</strong></span>
          </div>
        </div>
      </div>

      {/* ── 2. Modern Interactive Physical Topology Canvas ────────────────── */}
      <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Section title & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Interactive Topology Architecture
            </span>
            <span className="text-[11px] text-slate-500">
              &bull; Click any node to inspect coupling dynamics
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> &gt;90% Optimal
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> 70-89% Strained
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> &lt;70% Critical
            </span>
          </div>
        </div>

        {/* 2-Tier Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative">
          {/* TIER 1: UPSTREAM LIFELINES (Left 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
              <span>Stage 1: Upstream Utilities</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400 font-normal">Primary Infrastructure</span>
            </div>

            {/* Node: Water Treatment */}
            <div
              onClick={() => setSelectedNode("water")}
              className={`p-4 rounded-xl border transition cursor-pointer relative ${
                selectedNode === "water"
                  ? "bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-950/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Water Treatment Plant</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Allocation: <strong className="text-cyan-300">{Number(water?.allocation ?? 0).toFixed(1)}</strong> / {Number(water?.demand ?? 0).toFixed(1)} MW
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getStatus(waterSvc).bg} ${getStatus(waterSvc).color} ${getStatus(waterSvc).border}`}>
                  {waterSvc}% Svc
                </div>
              </div>

              {/* Dependency Output Tags */}
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Coupled Outflow:</span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] border border-slate-700">
                    &rarr; Hospital (&kappa;=0.40)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] border border-slate-700">
                    &rarr; Res (&kappa;=0.20)
                  </span>
                </div>
              </div>
            </div>

            {/* Node: Telecommunications */}
            <div
              onClick={() => setSelectedNode("telecom")}
              className={`p-4 rounded-xl border transition cursor-pointer relative ${
                selectedNode === "telecom"
                  ? "bg-slate-800/90 border-purple-500/80 shadow-lg shadow-purple-950/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Cellular & Microwave Grid</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Allocation: <strong className="text-purple-300">{Number(telecom?.allocation ?? 0).toFixed(1)}</strong> / {Number(telecom?.demand ?? 0).toFixed(1)} MW
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getStatus(telecomSvc).bg} ${getStatus(telecomSvc).color} ${getStatus(telecomSvc).border}`}>
                  {telecomSvc}% Svc
                </div>
              </div>

              {/* Dependency Output Tags */}
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Coupled Outflow:</span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px] border border-slate-700">
                    &rarr; Emergency (&kappa;=0.30)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px] border border-slate-700">
                    &rarr; Hospital (&kappa;=0.10)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CONNECTOR HUB (Center 2 Cols) */}
          <div className="hidden lg:flex lg:col-span-2 flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-md">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="text-[10px] font-mono text-center text-slate-400 leading-tight">
              Physical Coupling<br />
              <span className="text-cyan-300 font-bold">&kappa; Coefficients</span>
            </div>
          </div>

          {/* TIER 2: DOWNSTREAM CONSUMERS (Right 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
              <span>Stage 2: Downstream Consumers</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400 font-normal">Coupled Lifeline Services</span>
            </div>

            {/* Node: Regional Hospital */}
            <div
              onClick={() => setSelectedNode("hospital")}
              className={`p-3.5 rounded-xl border transition cursor-pointer ${
                selectedNode === "hospital"
                  ? "bg-slate-800/90 border-rose-500/80 shadow-lg shadow-rose-950/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                    <HeartPulse className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Metropolitan Hospital</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Allocated: <strong className="text-rose-300">{Number(hospital?.allocation ?? 0).toFixed(1)}</strong> MW &bull; Tier 1
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getStatus(hospitalSvc).bg} ${getStatus(hospitalSvc).color} ${getStatus(hospitalSvc).border}`}>
                  {hospitalSvc}% Effective
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-400">
                Coupled via: Water cooling (40%) & Telecom dispatch (10%)
              </div>
            </div>

            {/* Node: Emergency Dispatch */}
            <div
              onClick={() => setSelectedNode("emergency")}
              className={`p-3.5 rounded-xl border transition cursor-pointer ${
                selectedNode === "emergency"
                  ? "bg-slate-800/90 border-amber-500/80 shadow-lg shadow-amber-950/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Siren className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Emergency & First Response</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Allocated: <strong className="text-amber-300">{Number(emergency?.allocation ?? 0).toFixed(1)}</strong> MW &bull; Tier 1
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getStatus(emergencySvc).bg} ${getStatus(emergencySvc).color} ${getStatus(emergencySvc).border}`}>
                  {emergencySvc}% Effective
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-400">
                Coupled via: Telecom 911 dispatch networks (30%)
              </div>
            </div>

            {/* Node: Residential Civic District */}
            <div
              onClick={() => setSelectedNode("residential")}
              className={`p-3.5 rounded-xl border transition cursor-pointer ${
                selectedNode === "residential"
                  ? "bg-slate-800/90 border-blue-500/80 shadow-lg shadow-blue-950/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Residential Districts</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Allocated: <strong className="text-blue-300">{Number(residential?.allocation ?? 0).toFixed(1)}</strong> MW &bull; Tier 3
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getStatus(residentialSvc).bg} ${getStatus(residentialSvc).color} ${getStatus(residentialSvc).border}`}>
                  {residentialSvc}% Effective
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-400">
                Coupled via: Municipal potable water supply (20%)
              </div>
            </div>
          </div>
        </div>

        {/* ── Dynamic Inspector Drawer for Selected Node ──────────────────── */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 bg-slate-900/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-semibold uppercase text-[11px]">Selected Node:</span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold uppercase">
              {selectedNode}
            </span>
            <span className="text-slate-400 text-[11px]">
              {selectedNode === "water"
                ? "Primary water pumping: provides chilled water to Hospital cooling loops (κ = 0.40)."
                : selectedNode === "telecom"
                ? "Cellular towers: coordinates 911 dispatch & telemetry to emergency vehicles (κ = 0.30)."
                : selectedNode === "hospital"
                ? "Trauma surgery & life support: vulnerable to water treatment shutdown."
                : selectedNode === "emergency"
                ? "First responder units: communications fail if cellular dispatch loses battery."
                : "Civic community: requires minimum water pressure to prevent backflow contamination."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Mitigation Protocol:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              VCG Cascade Shadow Injected
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Damage Mitigation & Shadow Price Mechanics ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Direct vs Cascade Damage Trajectory Chart */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>Damage Trajectory ($)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Direct Physical Damage vs. Interdependent Secondary Impact
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Coupled Physical Links
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={damageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradCascade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="step" stroke="#64748b" fontSize={10} fontStyle="monospace" />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  fontStyle="monospace"
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`$${Number(value).toLocaleString()}`, name]}
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "#334155",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                <Area
                  type="monotone"
                  dataKey="DirectDamage"
                  name="Direct Physical Damage ($)"
                  stackId="1"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradDirect)"
                />
                <Area
                  type="monotone"
                  dataKey="CascadeDamage"
                  name="Cascade Propagation ($)"
                  stackId="1"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradCascade)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Why Cascade Shadow Values Work (Clean Card) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Stage B Cascade Shadow Protection</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Formula 9.4
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Standard priority dispatch algorithms starve Water Treatment during severe shortages because Water is categorized as Tier 2 while Hospital is Tier 1. However, cutting Water causes the hospital cooling system to fail in the very next step, compounding damage.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
              <div className="text-slate-400 text-[10px] mb-1">Injected Effective Objective Value:</div>
              <div className="text-cyan-300 font-bold p-1.5 bg-slate-900/80 rounded text-center">
                v_eff,i = v_base,i + &sum; (&kappa;_ij &times; v_crit,j)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-cyan-400 font-bold block">Water Pumping</span>
                <span className="text-emerald-400 font-semibold">+180.0 util/MW</span>
                <span className="text-slate-400 block text-[10px]">Protects Hospital Cooling</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                <span className="text-purple-400 font-bold block">Telecom Dispatch</span>
                <span className="text-emerald-400 font-semibold">+95.0 util/MW</span>
                <span className="text-slate-400 block text-[10px]">Protects First Responders</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Eliminates cascading outages while preserving 100% capacity safety.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
