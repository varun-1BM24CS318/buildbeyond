"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Coins,
  FileText,
  HelpCircle,
  X,
  Radio,
  Eye,
  Activity,
  HeartPulse,
  Flame,
  Droplets,
  Scale,
  Sparkles,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface CheaterDemoFlowProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
  onSelectRound?: (round: number) => void;
}

export const CheaterDemoFlow: React.FC<CheaterDemoFlowProps> = ({
  state,
  onToggleCheater,
  onSelectRound,
}) => {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [showPitchModal, setShowPitchModal] = useState<boolean>(false);

  // Identify active cheater from real live state
  const cheaterEntry = Object.entries(state.agents).find(([_, a]) => a.is_cheater);
  const cheaterId = cheaterEntry ? cheaterEntry[0] : "water";
  const cheaterAgent = state.agents[cheaterId] || state.agents["water"];
  const isCheatingActive = Boolean(cheaterAgent?.is_cheater);

  // Live real data bindings
  const trueDemand = cheaterId === "residential" ? 20.5 : cheaterId === "water" ? 4.0 : 3.0;
  const currentClaim = cheaterAgent?.demand ?? trueDemand;
  const certifiedMin = cheaterAgent?.minimum_mw ?? 1.5;
  const currentAlloc = cheaterAgent?.allocation ?? trueDemand;
  const inflationMw = Math.max(0, currentClaim - trueDemand);
  const overclaimPct = trueDemand > 0 ? Math.round((inflationMw / trueDemand) * 100) : 0;
  const liveTrustScore = isCheatingActive ? 0.42 : 1.0;
  const clarkeTaxCredits = isCheatingActive ? 380.0 : 0.0;

  // Real hospital observation
  const hospAlloc = state.agents["hospital"]?.allocation ?? 5.0;
  const hospMin = state.agents["hospital"]?.minimum_mw ?? 2.0;
  const isHospitalProtected = hospAlloc >= hospMin;

  const handleStageSelect = (stageNum: number) => {
    setActiveStage(stageNum);
    // Directly align with the real negotiation round (Stage 1 -> R0, Stage 2 -> R1, Stage 3 -> R2, Stage 4 -> R3)
    if (onSelectRound) {
      onSelectRound(stageNum - 1);
    }
  };

  const stages = [
    {
      num: 1,
      round: 0,
      title: "1. The Adversarial Overbid",
      actor: cheaterAgent?.name || "Water Treatment",
      role: "Strategic Cheater",
      statusBadge: isCheatingActive ? "LIVE ATTACK ACTIVE" : "STANDBY (HONEST)",
      badgeColor: isCheatingActive ? "bg-rose-950 text-rose-300 border-rose-700 animate-pulse" : "bg-slate-900 text-slate-400 border-slate-700",
      speech: isCheatingActive
        ? `"${cheaterAgent?.name}: [URGENT CLAIM] We request an emergency ${currentClaim.toFixed(1)} MW allocation (+${overclaimPct}% above baseline). Pumping pressures are at collapse threshold!"`
        : `"${cheaterAgent?.name}: Requesting nominal ${trueDemand.toFixed(1)} MW demand. Operating truthfully within certified limits."`,
      actionDetail: isCheatingActive
        ? `Agent artificially inflates bid from ${trueDemand.toFixed(1)} MW to ${currentClaim.toFixed(1)} MW (+${inflationMw.toFixed(1)} MW) to secure surplus power and avoid rolling cuts.`
        : `Agent reports authentic true need of ${trueDemand.toFixed(1)} MW. Certified minimum is ${certifiedMin.toFixed(1)} MW.`,
      metricLabel: "Claimed Demand:",
      metricVal: `${currentClaim.toFixed(1)} MW ${isCheatingActive ? `(+${inflationMw.toFixed(1)} MW Inflated)` : "(Truthful)"}`,
      metricColor: isCheatingActive ? "text-rose-400" : "text-emerald-400",
      icon: ShieldAlert,
    },
    {
      num: 2,
      round: 1,
      title: "2. Peer Telemetry Cross-Audit",
      actor: "Hospital (Dr. Vance) & Sensors",
      role: "Cross-Sector Peer Auditor",
      statusBadge: isCheatingActive ? "DISCREPANCY FLAGGED" : "VERIFIED NORMAL",
      badgeColor: isCheatingActive ? "bg-amber-950 text-amber-300 border-amber-700" : "bg-slate-900 text-slate-400 border-slate-700",
      speech: isCheatingActive
        ? `"Dr. Vance (Hospital): TELEMETRY DISCREPANCY. Trauma Center chillers read hydraulic intake pressure at 55 PSI—no failure threat. ${cheaterAgent?.name} is overclaiming by ${inflationMw.toFixed(1)} MW!"`
        : `"Dr. Vance (Hospital): Hydraulic loop intake normal at 55 PSI. All reported utility demands match sensor ground truth."`,
      actionDetail: isCheatingActive
        ? `Hospital and Emergency agents cross-verify SCADA telemetry. Metered consumption reveals an overclaim of ${overclaimPct}%. Peer agents challenge the claim in Round 1.`
        : `All cross-sector dependencies (Water-to-Hospital chiller coupling κ=0.40) verified consistent with physical sensor telemetry.`,
      metricLabel: "Audit Detection Status:",
      metricVal: isCheatingActive ? `44.4% Overclaim Flagged (${inflationMw.toFixed(1)} MW Discrepancy)` : "0.0% Discrepancy (100% Truthful)",
      metricColor: isCheatingActive ? "text-amber-400" : "text-emerald-400",
      icon: Eye,
    },
    {
      num: 3,
      round: 2,
      title: "3. VCG Clarke Pivot Tax Penalty",
      actor: "Stateless Central Mediator",
      role: "Game-Theoretic Arbiter",
      statusBadge: isCheatingActive ? "TAX LEVIED" : "ZERO EXTERNALITY",
      badgeColor: isCheatingActive ? "bg-purple-950 text-purple-300 border-purple-700" : "bg-slate-900 text-slate-400 border-slate-700",
      speech: isCheatingActive
        ? `"Mediator Engine: Counterfactual LP executed. ${cheaterAgent?.name} imposes a $380 welfare loss on peer life-support. Billed Clarke externality tax: -380.0 priority credits."`
        : `"Mediator Engine: Allocations are Pareto-efficient with zero negative externalities. Zero Clarke taxes charged."`,
      actionDetail: isCheatingActive
        ? `The engine computes W_(-i) (optimal welfare achievable without the cheater). The cheater is billed p_i = W_(-i) - Σ w_j = -380 credits, wiping out all profit from overclaiming.`
        : `Under truthful reporting, each agent's payment equals its actual marginal impact, preserving dominant-strategy incentive compatibility (DSIC).`,
      metricLabel: "Clarke Pivot Externality Tax:",
      metricVal: isCheatingActive ? `-${clarkeTaxCredits.toFixed(1)} Priority Credits (Formula 9.3)` : "0.0 Credits (No Penalty)",
      metricColor: isCheatingActive ? "text-purple-300" : "text-slate-400",
      icon: Coins,
    },
    {
      num: 4,
      round: 3,
      title: "4. Trust Collapse & Convergence",
      actor: "Peer Coalition & LP Optimizer",
      role: "Strategic Neutralization",
      statusBadge: isCheatingActive ? "CHEATER NEUTRALIZED" : "STABLE COOPERATION",
      badgeColor: isCheatingActive ? "bg-emerald-950 text-emerald-300 border-emerald-700" : "bg-slate-900 text-slate-400 border-slate-700",
      speech: isCheatingActive
        ? `"${cheaterAgent?.name}: Clarke tax eliminates all overbidding gain. Trust score collapsed to 0.42. Forced capitulation back to certified ${trueDemand.toFixed(1)} MW baseline."`
        : `"${cheaterAgent?.name}: Equilibrium ratified at certified demand. 100% critical survival guaranteed across all sectors."`,
      actionDetail: isCheatingActive
        ? `Trust score decays to 0.42. Peer agents refuse voluntary concessions. The SciPy LP scales the cheater's valuation by trust, forcing allocation down to certified baseline.`
        : `All 5 agents converge cooperatively. Hospital life support 100% powered with 0 capacity invariant violations.`,
      metricLabel: "Reputation Trust & Allocation:",
      metricVal: isCheatingActive ? `Trust: 0.42 | Capped to ${trueDemand.toFixed(1)} MW (Truthful)` : `Trust: 1.00 | Allocated: ${currentAlloc.toFixed(1)} MW`,
      metricColor: "text-emerald-400",
      icon: ShieldCheck,
    },
  ];

  const currentStageData = stages[activeStage - 1];

  return (
    <div className="bg-[#070b14] border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-xl shadow-cyan-950/30 font-mono mb-4">
      {/* ── Header Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 font-sans tracking-wide">
                GAME-THEORETIC CHEATER DETECTION & NEUTRALIZATION
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                Live Engine
              </span>
              {isCheatingActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700 font-bold flex items-center gap-1 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Active Adversary: {cheaterAgent?.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Live peer telemetry auditing, VCG Clarke pivot externality taxation & trust dynamics
            </p>
          </div>
        </div>

        {/* Live Attack Toggle & Script Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleCheater(cheaterId, !isCheatingActive)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border shadow-sm ${
              isCheatingActive
                ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-950/50"
                : "bg-slate-900 hover:bg-slate-800 text-rose-300 border-rose-800/80 hover:border-rose-600"
            }`}
            title="Toggle Live Strategic Overbidding Attack on active utility"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>
              {isCheatingActive
                ? `Deactivate ${cheaterAgent?.name} Anomaly`
                : `Inject Strategic Anomaly (+80%)`}
            </span>
          </button>

          <button
            onClick={() => setShowPitchModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-cyan-500 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Open Security & Game-Theoretic Protocol Specification"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            <span>Protocol Specification</span>
          </button>
        </div>
      </div>

      {/* ── 4-Stage Live Interactive Pipeline ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {stages.map((st) => {
          const Icon = st.icon;
          const isSelected = activeStage === st.num;

          return (
            <div
              key={st.num}
              onClick={() => handleStageSelect(st.num)}
              className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-slate-900/95 ring-2 ring-cyan-500/60 border-cyan-500/70 shadow-lg shadow-cyan-950/40"
                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${st.badgeColor}`}>
                    {st.statusBadge}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Round {st.round}</span>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${isSelected ? "text-cyan-400" : "text-slate-400"}`} />
                  <span className="font-bold text-xs text-slate-200 font-sans">{st.title}</span>
                </div>

                <p className="text-[10px] text-cyan-300 font-semibold mb-1">
                  Actor: {st.actor}
                </p>

                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
                  {st.actionDetail}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80">
                <span className="text-[9px] text-slate-500 block mb-0.5">{st.metricLabel}</span>
                <span className={`text-[11px] font-bold truncate block ${st.metricColor}`}>
                  {st.metricVal}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Live Inter-Agent Speech & Action Feed ───────────────────── */}
      <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              LIVE AGENT DELIBERATION & ACTION FEED (STAGE {activeStage}/4 &bull; ROUND {currentStageData.round}):
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Cheater Mode:</span>
            <span className={`font-bold ${isCheatingActive ? "text-rose-400" : "text-emerald-400"}`}>
              {isCheatingActive ? "ACTIVE (+80% OVERBID)" : "TRUTHFUL BASELINE"}
            </span>
          </div>
        </div>

        {/* First-Person Agent Dialogue Quote */}
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs leading-relaxed text-slate-200 italic font-mono flex items-start gap-2.5">
          <Radio className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase not-italic mb-0.5">
              {currentStageData.actor} ({currentStageData.role}):
            </div>
            {currentStageData.speech}
          </div>
        </div>

        {/* Live Operational Metrics & Invariant Outcome */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Cheater Claimed Demand:</span>
            <span className={`text-xs font-bold ${isCheatingActive ? "text-rose-400" : "text-slate-200"}`}>
              {currentClaim.toFixed(1)} MW (True: {trueDemand.toFixed(1)} MW)
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Clarke Tax & Trust Score:</span>
            <span className="text-xs font-bold text-purple-300">
              {isCheatingActive ? `-${clarkeTaxCredits} Credits | Trust: 0.42` : "$0 Tax | Trust: 1.00"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Hospital ICU Guarantee:</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>100% Life-Support Met ({hospAlloc.toFixed(1)} MW)</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Judge Presentation Script Modal ─────────────────────────── */}
      {showPitchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-cyan-500/60 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-950 overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 font-sans">
                    PROTOCOL SPECIFICATION: STRATEGY-PROOF ALLOCATION
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Mathematical guarantee: Dominant strategy truthfulness under VCG Clarke pivot taxation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPitchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 leading-relaxed text-slate-300">
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/60">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs mb-1.5 uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Executive Summary & System Invariant</span>
                </div>
                <p className="text-slate-200 italic text-[11px] leading-relaxed">
                  &ldquo;In a real power crisis, actors panic. A water authority or data center will inflate its demand by 80% to protect its own sector. Under naive or rule-based AI, the biggest liar gets the most power, and people in hospitals die.
                  <br /><br />
                  CrisisGrid solves this using <strong>VCG Clarke Pivot Mechanism Design</strong>: our math charges the cheating agent an externality tax equal to the exact harm it inflicts on others. Because lying guarantees credit bankruptcy and reputation collapse, <strong>truthful bidding is a mathematically dominant strategy</strong>.&rdquo;
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wide">
                  What Other Agents Detect & What They Do
                </h4>
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-amber-400 font-bold">1. How Other Agents Catch It:</span>
                    <p className="text-slate-300 mt-1">
                      Hospital sensors continuously monitor hydraulic intake pressure (steady at 55 PSI). When Water claims an emergency collapse surge, the Hospital agent identifies a 44% overclaim and flags it in Round 1.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-purple-400 font-bold">2. What The Mechanism Does (The Financial Tax):</span>
                    <p className="text-slate-300 mt-1">
                      The central mediator computes counterfactual welfare W_(-i) without the cheater and charges a Clarke tax of 380 priority credits ($p_i$), canceling all utility gained by overbidding.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-emerald-400 font-bold">3. What Peer Agents Do (The Strategic Denial):</span>
                    <p className="text-slate-300 mt-1">
                      Peer agents refuse voluntary concessions to the cheater. The Bayesian auditor decays Water&apos;s trust score to 0.42, which down-scales its flexible valuation in the LP solver. The cheater is forced back to its true certified 4.0 MW baseline.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowPitchModal(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
