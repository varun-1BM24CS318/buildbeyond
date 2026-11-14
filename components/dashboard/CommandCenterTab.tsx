"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Zap,
  Activity,
  HeartPulse,
  Droplets,
  PhoneCall,
  Flame,
  Building2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";
import { DispatchTrajectoryChart, AGENT_COLORS } from "./DispatchTrajectoryChart";

interface CommandCenterTabProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
}

export const CommandCenterTab: React.FC<CommandCenterTabProps> = ({
  state,
  onToggleCheater,
}) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <div className="space-y-6 text-[#EDEEF0]">
      {/* Row 1: Four Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Supply vs Demand */}
        <div className="linear-card p-4">
          <div className="flex items-center justify-between text-xs text-[#9BA1AA] mb-1">
            <span className="flex items-center gap-1.5">
              <span>Supply vs Demand</span>
              {state.total_demand > 105 && (
                <span className="px-1.5 py-0.2 rounded bg-[#F2555A]/20 text-[#F2555A] text-[9px] font-mono">
                  Data Anomaly
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] text-[#5F6670]">MW</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-[#EDEEF0] tabular-nums">
              {Number(state.supply_mw || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-[#5F6670] font-mono">
              / {Number(state.total_demand || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} true demand
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-mono">
            <span className={state.shortage_mw > 0 ? "text-[#F5A524]" : "text-[#3DD68C]"}>
              {state.shortage_mw > 0
                ? `Deficit: ${Number(state.shortage_mw).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : "Balanced reserves"}
            </span>
            <span className="text-[#5F6670]">Step {state.step}</span>
          </div>
        </div>

        {/* Total Power Delivered */}
        <div className="linear-card p-4">
          <div className="flex items-center justify-between text-xs text-[#9BA1AA] mb-1">
            <span>Total Dispatched</span>
            <span className="font-mono text-[11px] text-[#5F6670]">MW</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-[#6EA8FF] tabular-nums">
              {state.total_allocated}
            </span>
            <span className="text-xs text-[#5F6670] font-mono">
              ({state.total_demand > 0 ? Math.round((state.total_allocated / state.total_demand) * 100) : 100}%)
            </span>
          </div>
          <div className="mt-3 w-full h-1 bg-[#14171B] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6EA8FF] transition-all"
              style={{
                width: `${state.total_demand > 0 ? Math.min(100, Math.round((state.total_allocated / state.total_demand) * 100)) : 100}%`,
              }}
            />
          </div>
        </div>

        {/* Critical Survival Rate */}
        <div className="linear-card p-4">
          <div className="flex items-center justify-between text-xs text-[#9BA1AA] mb-1">
            <span>Critical Survival Rate</span>
            <span className="font-mono text-[11px] text-[#3DD68C]">Tier 1</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-[#3DD68C] tabular-nums">
              {state.survival_rate || 100}%
            </span>
            <span className="text-xs text-[#5F6670] font-mono">ICU / Water</span>
          </div>
          <div className="mt-3 text-[11px] text-[#5F6670] font-mono">
            0 critical life-support drops
          </div>
        </div>

        {/* Capacity Violations */}
        <div className={`linear-card p-4 transition-colors ${
          (state.capacity_violations || 0) > 0 ? "border-[#F2555A] bg-[#F2555A]/10" : ""
        }`}>
          <div className="flex items-center justify-between text-xs text-[#9BA1AA] mb-1">
            <span>Capacity Violations</span>
            <span className="font-mono text-[11px] text-[#5F6670]">Dual Simplex</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-mono font-bold tabular-nums ${
              (state.capacity_violations || 0) > 0 ? "text-[#F2555A]" : "text-[#EDEEF0]"
            }`}>
              {state.capacity_violations ?? 0}
            </span>
            <span className="text-xs text-[#5F6670] font-mono">
              invariant violations
            </span>
          </div>
          <div className="mt-3 text-[11px] text-[#5F6670] font-mono">
            ∑ Allocations ≤ Supply
          </div>
        </div>
      </div>

      {/* Row 2: Dispatch Chart */}
      <DispatchTrajectoryChart state={state} />

      {/* Row 3: Agent Cards (5-column grid) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-[#9BA1AA]">
            Participating Infrastructure Agents
          </h3>
          <span className="text-[11px] font-mono text-[#5F6670]">
            5 Agents Registered
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(state.agents).map(([aid, agent]) => {
            const isExpanded = expandedAgent === aid;
            const satPct = Math.round((agent.satisfaction_ratio || 1) * 100);

            return (
              <div key={aid} className="linear-card p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#5F6670] border border-[rgba(255,255,255,0.07)] px-1.5 py-0.5 rounded">
                      {agent.criticality}
                    </span>
                    <span className="text-[11px] font-mono text-[#9BA1AA]">
                      Trust {Math.round((agent.reputation_trust || 1) * 100)}%
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-[#EDEEF0] truncate" title={agent.name}>
                    {agent.name}
                  </h4>

                  {/* Allocation vs Requested */}
                  <div className="mt-3 flex items-baseline justify-between font-mono text-xs">
                    <span className="text-base font-bold text-[#EDEEF0]">
                      {agent.allocation} <span className="text-[10px] text-[#5F6670]">MW</span>
                    </span>
                    <span className="text-[#5F6670]">
                      of {agent.demand} MW ({satPct}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 w-full h-1 bg-[#14171B] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        satPct >= 95 ? "bg-[#3DD68C]" : satPct >= 60 ? "bg-[#F5A524]" : "bg-[#F2555A]"
                      }`}
                      style={{ width: `${Math.min(100, satPct)}%` }}
                    />
                  </div>

                  {/* Credits & Trust */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#5F6670]">
                    <span>Tax: {agent.vcg_payment || 0} cr</span>
                    <span>Min: {agent.minimum_mw} MW</span>
                  </div>

                  {/* Expand rationale toggle */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)] text-xs text-[#9BA1AA] leading-relaxed">
                      {agent.explanation || "Truthful elicitation active under VCG mechanism."}
                    </div>
                  )}
                </div>

                {/* Footer Controls: Misreporting Toggle */}
                <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#9BA1AA] hover:text-[#EDEEF0]">
                    <input
                      type="checkbox"
                      checked={agent.is_cheater}
                      onChange={(e) => onToggleCheater(aid, e.target.checked)}
                      className="rounded bg-[#14171B] border-[rgba(255,255,255,0.2)] text-[#6EA8FF] focus:ring-0 cursor-pointer"
                    />
                    <span>Misreport</span>
                  </label>

                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : aid)}
                    className="text-[11px] text-[#5F6670] hover:text-[#EDEEF0] transition font-mono"
                  >
                    {isExpanded ? "Hide" : "Detail"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4: Event Ledger & Scenario State Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Event Ledger (8 cols) */}
        <div className="lg:col-span-8 linear-card p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
            <span className="font-semibold text-[#EDEEF0]">Cryptographic Event Ledger</span>
            <span className="font-mono text-[11px] text-[#5F6670]">Auto-scrolling SHA-256 chain</span>
          </div>

          <div className="h-40 overflow-y-auto space-y-2 font-mono text-xs">
            {state.alerts.length === 0 ? (
              <div className="text-[#5F6670] py-6 text-center">No security anomalies detected in this run.</div>
            ) : (
              state.alerts.map((al, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#08090B] border border-[rgba(255,255,255,0.05)] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[#5F6670] text-[10px]">{al.timestamp}</span>
                    <span className={`text-[11px] ${
                      al.type === "error" ? "text-[#F2555A]" : "text-[#9BA1AA]"
                    }`}>
                      {al.message}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#5F6670] shrink-0">
                    {al.id.slice(0, 10)}...
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scenario State (4 cols) */}
        <div className="lg:col-span-4 linear-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">Scenario State</span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">{state.scenario}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-[#9BA1AA]">Active Shock:</span>
                <span className="text-[#EDEEF0] font-semibold">{state.scenario}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#9BA1AA]">Step Horizon:</span>
                <span className="text-[#EDEEF0]">{state.step} of {state.total_steps}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#9BA1AA]">Severity Level:</span>
                <span className={`font-semibold ${
                  state.severity === "CRITICAL" ? "text-[#F2555A]" : state.severity === "MODERATE" ? "text-[#F5A524]" : "text-[#3DD68C]"
                }`}>
                  {state.severity}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#9BA1AA]">Binding Constraints:</span>
                <span className="text-[#EDEEF0]">{state.active_constraints}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] text-[11px] font-mono text-[#5F6670]">
            System status: Optimal solver convergence
          </div>
        </div>
      </div>
    </div>
  );
};
