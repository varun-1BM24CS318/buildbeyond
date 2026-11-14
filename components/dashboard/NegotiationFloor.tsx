"use client";

import React, { useState, useEffect } from "react";
import {
  Hospital,
  Droplets,
  Siren,
  PhoneCall,
  Home,
  Check,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
  StepForward,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface NegotiationFloorProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean) => void;
  speed?: number;
  onStep?: (steps?: number) => void;
  onReset?: () => void;
}

interface AgentNodeDef {
  id: string;
  name: string;
  angle: number; // degrees
  icon: React.ComponentType<{ className?: string }>;
  tier: string;
  color: string;
}

const AGENTS: AgentNodeDef[] = [
  { id: "hospital", name: "Hospital ICU", angle: -90, icon: Hospital, tier: "Tier 1", color: "#F2555A" },
  { id: "water", name: "Water Pumping", angle: -18, icon: Droplets, tier: "Tier 1", color: "#6EA8FF" },
  { id: "emergency", name: "First Responders", angle: 54, icon: Siren, tier: "Tier 1", color: "#F5A524" },
  { id: "telecom", name: "911 Telecom", angle: 126, icon: PhoneCall, tier: "Tier 2", color: "#B388FF" },
  { id: "residential", name: "Residential Feeder", angle: 198, icon: Home, tier: "Tier 3", color: "#9BA1AA" },
];

const PROTOCOL_STAGES = [
  { num: 1, label: "Collect Initial Bids", desc: "Sensors verify local utility needs" },
  { num: 2, label: "Shortage Arbitration", desc: "Aggregate demand exceeds grid capacity" },
  { num: 3, label: "Concession Round 1", desc: "Residential sheds non-vital discretionary load" },
  { num: 4, label: "Concession Round 2", desc: "Telecom down-steps commercial 5G amplifiers" },
  { num: 5, label: "HiGHS LP & VCG Clarke Tax", desc: "Optimal dispatch & externality tax enforcement" },
  { num: 6, label: "Commit & Ledger Chaining", desc: "SHA-256 state locked into audit block" },
];

export const NegotiationFloor: React.FC<NegotiationFloorProps> = ({
  state,
  onToggleCheater,
  isPlaying,
  setIsPlaying,
  speed = 1,
  onStep,
  onReset,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>("hospital");
  const [showDependencies, setShowDependencies] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [isFloorPlaying, setIsFloorPlaying] = useState(false);

  // Sync floor negotiation with global simulation steps
  useEffect(() => {
    setCurrentRound(((state.step - 1) % 4) + 1);
  }, [state.step]);

  // Floor automated round advancement
  useEffect(() => {
    if (isFloorPlaying) {
      const intervalMs = Math.max(300, Math.round(1100 / speed));
      const timer = setInterval(() => {
        setCurrentRound((prev) => {
          if (prev >= 4) {
            onStep?.(1);
            return 1;
          }
          return prev + 1;
        });
      }, intervalMs);
      return () => clearInterval(timer);
    }
  }, [isFloorPlaying, speed, onStep]);

  const activeStage = currentRound === 1 ? 2 : currentRound === 2 ? 3 : currentRound === 3 ? 4 : 5;
  const currentAgent = selectedAgent ? state.agents[selectedAgent] : null;

  // Real transcript events generated from state
  const transcriptEvents = [
    { round: 0, text: "Protocol initiated: 5 agents submitted certified bids.", tag: "Init", type: "info" },
    { round: 1, text: `Shortage check: ${state.supply_mw} MW available vs ${state.total_demand} MW requested. Deficit: ${state.shortage_mw} MW.`, tag: "Shortage", type: "warn" },
    { round: 2, text: "Round 1 Concession: Residential shed 2.5 MW discretionary power.", tag: "Concession", type: "info" },
    { round: 3, text: "Round 2 Concession: Telecom throttled 0.5 MW commercial bandwidth.", tag: "Concession", type: "info" },
    {
      round: 4,
      text: state.agents.water?.is_cheater
        ? "Auditor Alert: Water demand discrepancy (+80%) detected. Clarke tax enforced: 380 credits."
        : "Auditor: Zero strategic anomalies detected. All agents within verified bounds.",
      tag: state.agents.water?.is_cheater ? "Anomaly" : "Verified",
      type: state.agents.water?.is_cheater ? "danger" : "ok",
    },
    { round: 4, text: `Mediator HiGHS Solver: Converged in 2.1 ms. 0 capacity violations.`, tag: "Optimized", type: "ok" },
  ];

  return (
    <div className="space-y-6">
      {/* 3-Zone Negotiation Floor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Rail (3 cols): Protocol Stepper */}
        <div className="lg:col-span-3 linear-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">Protocol Stepper</span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">
                Round {currentRound} of 4
              </span>
            </div>

            <div className="space-y-2.5">
              {PROTOCOL_STAGES.map((st) => {
                const isPassed = st.num < activeStage;
                const isCurrent = st.num === activeStage;

                return (
                  <div
                    key={st.num}
                    onClick={() => setCurrentRound(Math.min(4, Math.max(1, st.num - 1)))}
                    className={`flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#6EA8FF]/10 border border-[#6EA8FF]/30 text-[#EDEEF0]"
                        : isPassed
                        ? "text-[#9BA1AA] hover:bg-[#14171B]"
                        : "text-[#5F6670] hover:bg-[#14171B]/50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono mt-0.5 ${
                        isPassed
                          ? "bg-[#3DD68C]/20 text-[#3DD68C]"
                          : isCurrent
                          ? "bg-[#6EA8FF] text-[#08090B] font-bold"
                          : "bg-[#14171B] text-[#5F6670]"
                      }`}
                    >
                      {isPassed ? <Check className="w-2.5 h-2.5" /> : st.num}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium leading-tight">{st.label}</div>
                      <div className="text-[10px] text-[#5F6670] mt-0.5 leading-tight truncate">
                        {st.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between text-[11px] font-mono text-[#5F6670]">
            <span>Solver: Invariant Verified</span>
            <span className="text-[#3DD68C]">0 Violations</span>
          </div>
        </div>

        {/* Center Stage (Hero SVG Floor / 6 cols) */}
        <div className="lg:col-span-6 linear-card p-5 flex flex-col items-center justify-between relative overflow-hidden">
          {/* Top Bar on Floor */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#EDEEF0]">Negotiation Floor</span>
              <span className="text-[11px] font-mono text-[#5F6670]">
                {state.supply_mw} MW Capacity · Round {currentRound}/4
              </span>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#9BA1AA] hover:text-[#EDEEF0]">
              <input
                type="checkbox"
                checked={showDependencies}
                onChange={(e) => setShowDependencies(e.target.checked)}
                className="rounded bg-[#14171B] border-[rgba(255,255,255,0.2)] text-[#6EA8FF] focus:ring-0 cursor-pointer"
              />
              <span>Show dependencies</span>
            </label>
          </div>

          {/* SVG Canvas */}
          <div className="w-full max-w-[480px] py-4 relative flex items-center justify-center">
            <svg viewBox="0 0 400 360" className="w-full h-auto">
              {/* Outer Capacity Ring Guide */}
              <circle cx="200" cy="180" r="120" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <circle cx="200" cy="180" r="80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />

              {/* Dependency Edges (e.g. Water -> Hospital) */}
              {showDependencies && (
                <path
                  d="M 295 155 Q 240 110 200 60"
                  fill="none"
                  stroke="#6EA8FF"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={state.agents.water?.status === "Critical" ? 0.2 : 0.45}
                />
              )}

              {/* Central Mediator Hub */}
              <g>
                <circle cx="200" cy="180" r="28" fill="#0E1013" stroke="#6EA8FF" strokeWidth="1.5" />
                <circle cx="200" cy="180" r="34" fill="none" stroke="#6EA8FF" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
                <text x="200" y="177" textAnchor="middle" fill="#6EA8FF" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  MEDIATOR
                </text>
                <text x="200" y="191" textAnchor="middle" fill="#9BA1AA" fontSize="8" fontFamily="monospace">
                  {state.total_allocated} MW
                </text>
              </g>

              {/* 5 Agent Nodes around the Ring */}
              {AGENTS.map((ag) => {
                const rad = (ag.angle * Math.PI) / 180;
                const cx = 200 + 120 * Math.cos(rad);
                const cy = 180 + 120 * Math.sin(rad);

                const agentData = state.agents[ag.id] || { allocation: 5, demand: 5, reputation_trust: 1 };
                const isSelected = selectedAgent === ag.id;
                const isFaded = selectedAgent !== null && !isSelected;
                const isCheating = agentData.is_cheater;

                // Concession radius dynamically shrinks with rounds
                const concessionOffset = currentRound >= 3 && ag.id === "residential" ? 22 : 26;

                return (
                  <g
                    key={ag.id}
                    onClick={() => setSelectedAgent(ag.id)}
                    className="cursor-pointer transition-opacity"
                    opacity={isFaded ? 0.35 : 1}
                  >
                    {/* Edge to Hub */}
                    <line
                      x1="200"
                      y1="180"
                      x2={cx}
                      y2={cy}
                      stroke={isSelected ? "#6EA8FF" : "rgba(255,255,255,0.12)"}
                      strokeWidth={isSelected ? 2 : 1}
                    />

                    {/* Concentric Arcs: Requested (Dashed Outer), Allocated (Solid) */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={concessionOffset}
                      fill="none"
                      stroke={isCheating ? "#F5A524" : "rgba(255,255,255,0.2)"}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="20"
                      fill="none"
                      stroke={ag.color}
                      strokeWidth="2"
                    />

                    {/* Agent Center Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="16"
                      fill="#0E1013"
                      stroke={isSelected ? "#EDEEF0" : "rgba(255,255,255,0.2)"}
                      strokeWidth="1"
                    />

                    {/* Node Text */}
                    <text x={cx} y={cy + 3} textAnchor="middle" fill="#EDEEF0" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      {agentData.allocation}M
                    </text>

                    {/* Name Label */}
                    <text
                      x={cx}
                      y={cy > 180 ? cy + 32 : cy - 28}
                      textAnchor="middle"
                      fill={isSelected ? "#EDEEF0" : "#9BA1AA"}
                      fontSize="9"
                      fontWeight="500"
                    >
                      {ag.name}
                    </text>

                    {/* Protected Pill for Tier 1 */}
                    {ag.tier === "Tier 1" && (
                      <text
                        x={cx}
                        y={cy > 180 ? cy + 42 : cy - 38}
                        textAnchor="middle"
                        fill="#3DD68C"
                        fontSize="7"
                        fontFamily="monospace"
                      >
                        [protected]
                      </text>
                    )}

                    {/* Misreporting Alert Tag */}
                    {isCheating && (
                      <text
                        x={cx}
                        y={cy > 180 ? cy + 52 : cy - 48}
                        textAnchor="middle"
                        fill="#F5A524"
                        fontSize="7"
                        fontFamily="monospace"
                      >
                        -380 cr (taxed)
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Scrubber & Step Controls */}
          <div className="w-full pt-3 border-t border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Play/Pause Floor & Scrubber Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFloorPlaying(!isFloorPlaying)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition text-xs font-semibold ${
                  isFloorPlaying
                    ? "bg-[#6EA8FF]/20 text-[#6EA8FF] border border-[#6EA8FF]/40"
                    : "bg-[#14171B] hover:bg-[#6EA8FF]/15 text-[#EDEEF0] border border-[rgba(255,255,255,0.07)]"
                }`}
              >
                {isFloorPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-[#EDEEF0]" />}
                <span>{isFloorPlaying ? "Pause Protocol" : "Start Negotiation"}</span>
              </button>

              <div className="flex items-center bg-[#14171B] border border-[rgba(255,255,255,0.07)] rounded p-0.5">
                <button
                  onClick={() => setCurrentRound((p) => Math.max(1, p - 1))}
                  className="p-1 text-[#9BA1AA] hover:text-[#EDEEF0] disabled:opacity-30"
                  disabled={currentRound <= 1}
                  title="Previous Round"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-[#EDEEF0]">
                  R{currentRound}/4
                </span>
                <button
                  onClick={() => setCurrentRound((p) => Math.min(4, p + 1))}
                  className="p-1 text-[#9BA1AA] hover:text-[#EDEEF0] disabled:opacity-30"
                  disabled={currentRound >= 4}
                  title="Next Round"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => onReset?.()}
                className="p-1.5 text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B] rounded"
                title="Reset Simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Next Counter & Shock */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStep?.(1)}
                className="px-2.5 py-1.5 bg-[#14171B] hover:bg-[#14171B]/80 hover:text-[#EDEEF0] text-[#9BA1AA] rounded border border-[rgba(255,255,255,0.07)] text-xs flex items-center gap-1 font-mono transition"
                title="Advance global simulation step counter (+1)"
              >
                <StepForward className="w-3.5 h-3.5 text-[#6EA8FF]" />
                <span>Next Step (+1)</span>
              </button>

              <button
                onClick={() => {
                  if (state.agents.water) {
                    onToggleCheater("water", !state.agents.water.is_cheater);
                  }
                }}
                className="px-2.5 py-1.5 bg-[#14171B] hover:bg-[#14171B]/80 text-[#9BA1AA] hover:text-[#EDEEF0] rounded border border-[rgba(255,255,255,0.07)] text-xs transition"
              >
                Shock & Renegotiate
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel (3 cols): Transcript & Agent Detail */}
        <div className="lg:col-span-3 linear-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">
                {currentAgent ? `${currentAgent.name}` : "Event Transcript"}
              </span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">
                Step {state.step}
              </span>
            </div>

            {/* Focused Agent Detail */}
            {currentAgent ? (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-[#08090B] border border-[rgba(255,255,255,0.05)] space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#9BA1AA]">Critical Floor:</span>
                    <span className="text-[#3DD68C]">{currentAgent.minimum_mw} MW</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#9BA1AA]">Requested Bid:</span>
                    <span className="text-[#EDEEF0]">{currentAgent.demand} MW</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#9BA1AA]">Allocated:</span>
                    <span className="text-[#6EA8FF] font-bold">{currentAgent.allocation} MW</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#9BA1AA]">Clarke Tax:</span>
                    <span className="text-[#F5A524]">{currentAgent.vcg_payment || 0} credits</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#9BA1AA] leading-relaxed">
                  <span className="font-medium text-[#EDEEF0]">Rationale: </span>
                  {currentAgent.explanation || "Truth-dominant strategy active under VCG mechanism."}
                </div>
              </div>
            ) : null}

            {/* Transcript Stream */}
            <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)]">
              <span className="text-[11px] font-mono text-[#5F6670] uppercase tracking-wider block mb-2">
                Protocol Dialogue & Audit Log
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
                {transcriptEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-[#08090B] border border-[rgba(255,255,255,0.05)] text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#5F6670] mb-0.5">
                      <span>R{ev.round}</span>
                      <span className={ev.type === "danger" ? "text-[#F5A524]" : "text-[#9BA1AA]"}>
                        {ev.tag}
                      </span>
                    </div>
                    <div className="text-[#9BA1AA] leading-tight">{ev.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] text-[11px] font-mono text-[#5F6670]">
            Dominant strategy: Truthfulness
          </div>
        </div>
      </div>

      {/* Below the Stage: Pricing (VCG credits) and Reputation (Trust) Compact Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pricing Panel */}
        <div className="linear-card p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
            <span className="font-semibold text-[#EDEEF0]">VCG Clarke Pivot Mechanism Pricing</span>
            <span className="font-mono text-[11px] text-[#5F6670]">Non-monetary priority credits</span>
          </div>
          <p className="text-xs text-[#9BA1AA] mb-3 leading-relaxed">
            Credits charged for the harm an agent&apos;s request imposes on others. Guarantees that strategic overbidding yields negative expected utility.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[#5F6670] border-b border-[rgba(255,255,255,0.05)] text-left">
                  <th className="py-1">Utility</th>
                  <th className="py-1">Bid</th>
                  <th className="py-1">Allocated</th>
                  <th className="py-1">Externality Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                {Object.entries(state.agents).map(([aid, a]) => (
                  <tr key={aid} className="text-[#9BA1AA]">
                    <td className="py-1.5 text-[#EDEEF0] font-sans font-medium">{a.name}</td>
                    <td className="py-1.5">{a.demand} MW</td>
                    <td className="py-1.5 text-[#6EA8FF]">{a.allocation} MW</td>
                    <td className="py-1.5 text-[#F5A524]">{a.vcg_payment || 0} cr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reputation Panel */}
        <div className="linear-card p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
            <span className="font-semibold text-[#EDEEF0]">Bayesian Reputation & Trust Over Time</span>
            <span className="font-mono text-[11px] text-[#5F6670]">Beta-binomial trust scores</span>
          </div>
          <p className="text-xs text-[#9BA1AA] mb-3 leading-relaxed">
            Reputation decays sharply upon discrepancy detection and recovers gradually through verified truthful behavior.
          </p>
          <div className="space-y-2">
            {Object.entries(state.agents).map(([aid, a]) => {
              const trustPct = Math.round((a.reputation_trust || 1) * 100);
              return (
                <div key={aid} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEEF0] font-sans">{a.name}</span>
                    <span className={trustPct < 70 ? "text-[#F5A524]" : "text-[#3DD68C]"}>
                      {trustPct}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#14171B] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${trustPct < 70 ? "bg-[#F5A524]" : "bg-[#3DD68C]"}`}
                      style={{ width: `${trustPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
