"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Scale,
  ShieldAlert,
  Coins,
  FileText,
  AlertCircle,
  CheckCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Radio,
  MessageSquare,
  Sparkles,
  Repeat,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface NegotiationTabProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean) => void;
  speed?: number;
  onStep?: (steps?: number) => void;
}

// Dynamic Contextual Crisis Dialogue Generator across all 24 Hours and 5 Protocol Rounds
function getDynamicAgentSpeech(
  agent: any,
  round: number,
  step: number,
  state: FullSimulationState,
  liveDelib?: { speech: string; strategy?: string }
): { speech: string; strategy: string; isAi: boolean } {
  if (liveDelib?.speech) {
    return {
      speech: liveDelib.speech,
      strategy: liveDelib.strategy || (agent.is_cheater ? "Adversarial Inflation" : "Defending Baseline"),
      isAi: true,
    };
  }

  // Pre-recorded AI thought if populated
  if (agent.rounds?.[round]?.speech) {
    return {
      speech: agent.rounds[round].speech,
      strategy: agent.rounds[round].strategy || "Adaptive Protocol Bid",
      isAi: Boolean(agent.rounds[round].is_ai_generated),
    };
  }

  const aid = agent.id;
  const isCheater = agent.is_cheater;
  const alloc = agent.allocation.toFixed(1);
  const deficit = Math.max(0, Math.round((state.total_demand - state.supply_mw) * 10) / 10);
  const phase = step <= 3 ? "landfall" : step <= 8 ? "peak_crisis" : step <= 15 ? "stabilizing" : "restoration";

  // Adversarial cheater dialogue
  if (isCheater) {
    if (round === 0) {
      return {
        speech: `Hour ${step}: Inflating demand claim to ${(agent.demand * 1.6).toFixed(1)} MW. Rejecting initial baseline cuts.`,
        strategy: "⚠️ Adversarial Demand Inflation",
        isAi: false,
      };
    } else if (round === 1) {
      return {
        speech: `Hour ${step}: Conceding token 0.1 MW only. Insisting on priority entitlement.`,
        strategy: "⚠️ Deceptive Concession",
        isAi: false,
      };
    } else if (round === 2) {
      return {
        speech: `Hour ${step}: Fabricating secondary cascade failure threat to resist load shedding.`,
        strategy: "⚠️ False Cascade Claim",
        isAi: false,
      };
    } else if (round === 3) {
      return {
        speech: `Hour ${step}: Contesting final equilibrium allocation to extract surplus capacity.`,
        strategy: "⚠️ Strategic Feeder Hoarding",
        isAi: false,
      };
    } else {
      return {
        speech: `Hour ${step}: VCG Clarke pivot tax applied: Fraudulent gain taxed to $0.0000. Reputation penalised.`,
        strategy: "🛡️ VCG Clarke Pivot Neutralized",
        isAi: false,
      };
    }
  }

  // Hospital dialogue
  if (aid === "hospital") {
    if (round === 0) {
      const texts: Record<string, string> = {
        landfall: `Hour ${step}: Tropical storm landfall approaching. Ventilators and surgical suites drawing 5.0 MW baseline.`,
        peak_crisis: `Hour ${step}: Deep flood surge! Auxiliary generator fuel depleted; 5.0 MW is non-negotiable for ICU life support.`,
        stabilizing: `Hour ${step}: Trauma admissions high. Stage A LP protects 5.0 MW; tracking water line for chiller cooling.`,
        restoration: `Hour ${step}: Grid power recovering. Patient influx steady; maintaining 5.0 MW surgical readiness.`,
      };
      return { speech: texts[phase], strategy: "Tier 1 Life Support Lock", isAi: false };
    } else if (round === 1) {
      return {
        speech: `Hour ${step}: Zero concession. Tier 1 ICU ventilators are strictly protected under Stage A lexicographic LP.`,
        strategy: "Lexicographic Invariant Defense",
        isAi: false,
      };
    } else if (round === 2) {
      return {
        speech: `Hour ${step}: Holding at 5.0 MW. Monitoring Water pumping dependency (coupling κ=0.40) to prevent chiller trip.`,
        strategy: "Chiller Interdependency Tracking",
        isAi: false,
      };
    } else if (round === 3) {
      return {
        speech: `Hour ${step}: Equilibrium reached. 100% of critical hospital demand verified with zero shortfall.`,
        strategy: "Equilibrium Consensus Confirmed",
        isAi: false,
      };
    } else {
      return {
        speech: `Hour ${step}: Settled at ${alloc} MW (100% guarantee). Stage A LP life-support guarantee recorded into ledger.`,
        strategy: "Stage A Guaranteed Allocation",
        isAi: false,
      };
    }
  }

  // Water treatment dialogue
  if (aid === "water") {
    if (round === 0) {
      const texts: Record<string, string> = {
        landfall: `Hour ${step}: Pre-filling municipal storage tanks. Drawing 4.0 MW to build hydraulic head against flood.`,
        peak_crisis: `Hour ${step}: Severe floodwaters at primary intake! Pumps drawing 4.8 MW to keep trauma chillers fed.`,
        stabilizing: `Hour ${step}: Flood levels subsiding. Drawing 3.8 MW to protect downstream hospital cooling loops.`,
        restoration: `Hour ${step}: Intake stations clearing. Restoring standard 4.0 MW flow through water distribution grid.`,
      };
      return { speech: texts[phase], strategy: "Hydraulic Pressure Defense", isAi: false };
    } else if (round === 1) {
      return {
        speech: `Hour ${step}: Conceding 0.2 MW auxiliary pump telemetry. Primary intake pumping for hospital preserved.`,
        strategy: "Auxiliary Concession",
        isAi: false,
      };
    } else if (round === 2) {
      return {
        speech: `Hour ${step}: Holding at 3.8 MW. Cascade shadow injection (+160 util) protects hospital HVAC cooling.`,
        strategy: "Cascade Shadow Protection",
        isAi: false,
      };
    } else if (round === 3) {
      return {
        speech: `Hour ${step}: Equilibrium achieved. Pumping rate synchronized with hospital trauma center chillers.`,
        strategy: "Cascade Invariant Verified",
        isAi: false,
      };
    } else {
      return {
        speech: `Hour ${step}: Settled at ${alloc} MW. Stage B cascade shadow optimization prevents secondary chiller collapse.`,
        strategy: "Stage B Shadow Locked",
        isAi: false,
      };
    }
  }

  // Telecom dialogue
  if (aid === "telecom") {
    if (round === 0) {
      const texts: Record<string, string> = {
        landfall: `Hour ${step}: Cellular antennas and 911 dispatch trunks fully operational at 2.5 MW.`,
        peak_crisis: `Hour ${step}: Feeder damaged in zone 3! Microwave relay routing emergency dispatch traffic (2.5 MW).`,
        stabilizing: `Hour ${step}: First responder encrypted channels held at priority 1. Broadband throttled; holding 2.2 MW.`,
        restoration: `Hour ${step}: Repair crews splicing main fiber backhaul. Restoring commercial towers toward 2.5 MW.`,
      };
      return { speech: texts[phase], strategy: "Emergency Comms Relay", isAi: false };
    } else if (round === 1) {
      return {
        speech: `Hour ${step}: Conceding 0.3 MW from commercial cellular data. Dedicated 911 radio repeaters remain 100% active.`,
        strategy: "Commercial 5G Shed",
        isAi: false,
      };
    } else if (round === 2) {
      return {
        speech: `Hour ${step}: Holding at 2.2 MW. Maintaining telemetry links to Emergency Dispatch and automated grid substations.`,
        strategy: "Dispatch Backbone Continuity",
        isAi: false,
      };
    } else if (round === 3) {
      return {
        speech: `Hour ${step}: Radio coverage stable across all disaster sectors. Emergency dispatch latency nominal.`,
        strategy: "Protocol Consensus Reached",
        isAi: false,
      };
    } else {
      return {
        speech: `Hour ${step}: Settled at ${alloc} MW. 911 dispatch lines and crisis mesh communications verified active.`,
        strategy: "Backbone Allocation Finalized",
        isAi: false,
      };
    }
  }

  // Emergency services dialogue
  if (aid === "emergency") {
    if (round === 0) {
      const texts: Record<string, string> = {
        landfall: `Hour ${step}: Ambulance staging depots and crisis dispatch units activated at 3.0 MW baseline.`,
        peak_crisis: `Hour ${step}: Flood rescue operations at peak! Deploying amphibious teams; power demand surged to 4.5 MW.`,
        stabilizing: `Hour ${step}: Field triage centers operational. Recharging rescue equipment; requesting 3.2 MW.`,
        restoration: `Hour ${step}: Disaster recovery demobilizing. Returning to steady-state emergency readiness at 3.0 MW.`,
      };
      return { speech: texts[phase], strategy: "First Responder Surge", isAi: false };
    } else if (round === 1) {
      return {
        speech: `Hour ${step}: Conceding 0.2 MW depot floodlighting. Ambulance charging and triage bays protected.`,
        strategy: "Depot Lighting Shed",
        isAi: false,
      };
    } else if (round === 2) {
      return {
        speech: `Hour ${step}: Holding at 2.8 MW. Relying on Telecom relay for unit geolocation and dispatch routing.`,
        strategy: "Triage Interdependency Defense",
        isAi: false,
      };
    } else if (round === 3) {
      return {
        speech: `Hour ${step}: Agreement reached. Response fleet fully powered for ongoing community rescue missions.`,
        strategy: "Response Fleet Consensus",
        isAi: false,
      };
    } else {
      return {
        speech: `Hour ${step}: Settled at ${alloc} MW. Field hospitals and responder communications fully energized.`,
        strategy: "Field Response Allocation",
        isAi: false,
      };
    }
  }

  // Residential grid dialogue
  if (round === 0) {
    const texts: Record<string, string> = {
      landfall: `Hour ${step}: Civic zones consuming standard daytime peak demand of 20.5 MW across residential sectors.`,
      peak_crisis: `Hour ${step}: High grid deficit (-${deficit} MW). Offering immediate flexible load sheds to protect critical lifelines.`,
      stabilizing: `Hour ${step}: Rotational load shedding underway across civic wards. Managing residential buffer at 10.5 MW.`,
      restoration: `Hour ${step}: Feeder lines re-energized. Restoring residential sectors toward full 20.5 MW allocation.`,
    };
    return { speech: texts[phase], strategy: "Civic Buffer Management", isAi: false };
  } else if (round === 1) {
    return {
      speech: `Hour ${step}: Conceding 2.5 MW via municipal streetlighting and non-essential commercial HVAC shutdowns.`,
      strategy: "Non-Critical Load Shedding",
      isAi: false,
    };
  } else if (round === 2) {
    return {
      speech: `Hour ${step}: Conceding additional 4.0 MW via rotational residential load shedding to balance grid deficit.`,
      strategy: "Rotational Ward Load Shed",
      isAi: false,
    };
  } else if (round === 3) {
    return {
      speech: `Hour ${step}: Civic buffer fully absorbing remaining deficit. Critical lifelines insulated from brownout.`,
      strategy: "Deficit Absorption Consensus",
      isAi: false,
    };
  } else {
    return {
      speech: `Hour ${step}: Settled at ${alloc} MW. Tier 3 proportional distribution executed with zero capacity violations.`,
      strategy: "Tier 3 Proportional Settlement",
      isAi: false,
    };
  }
}

const AGENT_COLORS: Record<string, string> = {
  hospital: "#ef4444",
  water: "#06b6d4",
  telecom: "#a855f7",
  emergency: "#f97316",
  residential: "#3b82f6",
};

const ROUND_TITLES = [
  "Round 0: Initial Uncoordinated Bids",
  "Round 1: Initial Priority Concessions",
  "Round 2: Cascade-Aware Protection",
  "Round 3: Equilibrium Convergence",
  "Settlement: 3-Stage LP Allocation",
];

export const NegotiationTab: React.FC<NegotiationTabProps> = ({
  state,
  onToggleCheater,
  isPlaying = false,
  setIsPlaying,
  speed = 1,
  onStep,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("water");
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [isRenegotiating, setIsRenegotiating] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Live Gemini AI deliberation states
  const [aiDeliberations, setAiDeliberations] = useState<
    Record<
      number,
      Record<
        string,
        {
          bid_mw?: number;
          concession_mw?: number;
          speech: string;
          strategy?: string;
          urgency_level?: string;
        }
      >
    >
  >({});
  const [isDeliberating, setIsDeliberating] = useState<boolean>(false);
  const [lastDeliberatedAt, setLastDeliberatedAt] = useState<string | null>(null);
  const [agentAiThoughts, setAgentAiThoughts] = useState<Record<string, string>>({});
  const [loadingAgentThought, setLoadingAgentThought] = useState<Record<string, boolean>>({});

  const selectedAgent = state.agents[selectedAgentId] || Object.values(state.agents)[0];

  // Fetch live Gemini multi-agent deliberation for a round
  const handleFetchGeminiDeliberation = async (roundNum: number) => {
    setIsDeliberating(true);
    try {
      const cheaters = Object.values(state.agents)
        .filter((a) => a.is_cheater)
        .map((a) => a.id);

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gemini_multi_agent_deliberation",
          round: roundNum,
          scenario: state.scenario,
          supply_mw: state.supply_mw,
          shortage_mw: state.shortage_mw,
          cheaters,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.deliberations) {
          setAiDeliberations((prev) => ({
            ...prev,
            [roundNum]: data.deliberations,
          }));
          setLastDeliberatedAt(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.warn("Failed to fetch Gemini multi-agent deliberation:", err);
    } finally {
      setIsDeliberating(false);
    }
  };

  // Fetch single agent rationale from Gemini
  const handleFetchSingleAgentThought = async (agentId: string) => {
    setLoadingAgentThought((prev) => ({ ...prev, [agentId]: true }));
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent_deliberation",
          agentId,
          simulationState: {
            supply_mw: state.supply_mw,
            shortage_mw: state.shortage_mw,
            step: state.step,
            scenario: state.scenario,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.thought) {
          setAgentAiThoughts((prev) => ({ ...prev, [agentId]: data.thought }));
        }
      }
    } catch (err) {
      console.warn("Single agent thought fetch failed:", err);
    } finally {
      setLoadingAgentThought((prev) => ({ ...prev, [agentId]: false }));
    }
  };

  // Fetch live Gemini deliberations when switching rounds
  useEffect(() => {
    if (!aiDeliberations[selectedRound] && !isDeliberating) {
      handleFetchGeminiDeliberation(selectedRound);
    }
  }, [selectedRound]);

  // Robust step progression through all 24 hours and all 5 rounds
  useEffect(() => {
    if (!isPlaying) return;

    // Smooth speed-dependent timing: 1x -> ~950ms, 2x -> ~480ms, 5x -> ~190ms
    const roundDurationMs = Math.max(180, Math.round(950 / (speed || 1)));

    const timer = setTimeout(() => {
      setSelectedRound((r) => {
        if (r < 4) {
          return r + 1;
        } else {
          // Reached Final Settlement (Round 4) for this hour
          if (state.step < state.total_steps) {
            onStep?.(1);
            return 0; // Reset to Round 0 for next step!
          } else {
            // Reached Step 24 Final Settlement!
            if (isLooping) {
              onStep?.(1);
              return 0;
            } else {
              setIsPlaying?.(false);
              return 4;
            }
          }
        }
      });
    }, roundDurationMs);

    return () => clearTimeout(timer);
  }, [isPlaying, selectedRound, state.step, state.total_steps, speed, onStep, setIsPlaying, isLooping]);

  // Sync selectedRound to 0 when user steps manually while paused
  const prevStepRef = useRef<number>(state.step);
  useEffect(() => {
    if (prevStepRef.current !== state.step) {
      prevStepRef.current = state.step;
      if (!isPlaying) {
        setSelectedRound(0);
      }
    }
  }, [state.step, isPlaying]);

  const handleToggleAnimate = () => {
    if (isPlaying) {
      setIsPlaying?.(false);
    } else {
      if (state.step >= state.total_steps && selectedRound === 4) {
        setSelectedRound(0);
      }
      setIsPlaying?.(true);
    }
  };

  const handleTriggerRenegotiation = () => {
    setIsRenegotiating(true);
    setSelectedRound(0);
    handleFetchGeminiDeliberation(0);
    setIsPlaying?.(true);
  };

  // Get agent bid for currently selected round (combining live Gemini AI bids with protocol)
  const getRoundBid = (agent: any, round: number) => {
    if (round === 4) return agent.allocation;
    const aiBid = aiDeliberations[round]?.[agent.id]?.bid_mw;
    if (typeof aiBid === "number" && !isNaN(aiBid)) return Math.round(aiBid * 10) / 10;
    const rData = agent.rounds?.[round];
    if (rData && rData.bid_mw !== undefined) return rData.bid_mw;
    const initialBid = agent.demand * (agent.is_cheater ? 1.6 : 1.1);
    if (round === 0) return Math.round(initialBid * 10) / 10;
    if (round === 1) return Math.round((initialBid - (agent.id === "residential" ? 2.5 : 0.3)) * 10) / 10;
    if (round === 2) return Math.round((initialBid - (agent.id === "residential" ? 6.0 : 0.6)) * 10) / 10;
    if (round === 3) return Math.round((initialBid - (agent.id === "residential" ? 7.5 : 0.8)) * 10) / 10;
    return agent.allocation;
  };

  // Calculate sum of bids in selected round
  const totalBidsInRound = Object.values(state.agents).reduce(
    (sum, a) => sum + getRoundBid(a, selectedRound),
    0
  );
  const roundDeficit = Math.max(0, Math.round((totalBidsInRound - state.supply_mw) * 10) / 10);

  // Comparison bar chart data (Requested Initial Bid vs Final Allocated)
  const comparisonData = Object.values(state.agents).map((a) => {
    const initialBid = a.rounds && a.rounds.length > 0 ? a.rounds[0].bid_mw : a.demand;
    return {
      name: a.name.split(" ")[0],
      initialBid: initialBid,
      allocated: a.allocation,
      concession: Math.max(0, Math.round((initialBid - a.allocation) * 10) / 10),
    };
  });

  return (
    <div className="space-y-5">
      {/* ── 1. Immersive Negotiation Protocol & Interactive Scrubber ──────── */}
      <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Scale className="h-4 w-4 text-cyan-400" />
                <span>Multi-Agent Negotiation & Concession Protocol</span>
              </h2>
              {isRenegotiating && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-medium">
                  Renegotiating Live (Shock Restart 1/3)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Watch 5 autonomous agents voluntarily concede surplus load across 4 rounds to converge without starvation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAnimate}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Pause (Hour {state.step}/24 • R{selectedRound})</span>
                </>
              ) : state.step >= state.total_steps && selectedRound === 4 ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Replay 24 Hours</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Animate Protocol (All 24 Hours)</span>
                </>
              )}
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition border flex items-center gap-1 ${
                isLooping
                  ? "bg-cyan-950/70 text-cyan-300 border-cyan-700 shadow-sm"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Automatically loop rounds continuously for presentations"
            >
              <Repeat className="h-3 w-3" />
              <span>{isLooping ? "Loop: On" : "Loop: Off"}</span>
            </button>

            {/* Shock Trigger */}
            <button
              onClick={handleTriggerRenegotiation}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-cyan-300 transition flex items-center gap-1.5"
              title="Simulate sudden mid-crisis grid shock triggering renegotiation"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Simulate Shock & Renegotiate</span>
            </button>

            {/* Live Gemini LLM Deliberation Trigger */}
            <button
              onClick={() => handleFetchGeminiDeliberation(selectedRound)}
              disabled={isDeliberating}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-950/80 to-blue-950/80 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-xs font-semibold text-cyan-300 hover:text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Prompt Google Gemini LLM to generate fresh autonomous speeches and bids for this round"
            >
              <Sparkles className={`h-3.5 w-3.5 text-cyan-400 ${isDeliberating ? "animate-spin" : "animate-pulse"}`} />
              <span>{isDeliberating ? "Gemini Deliberating..." : "Ask Gemini AI Agents"}</span>
            </button>
          </div>
        </div>

        {/* Round Scrubber Timeline */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                Hour {state.step}/24 • {ROUND_TITLES[selectedRound]}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Stage {selectedRound + 1} of 5
              </span>
              {isPlaying && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 animate-pulse flex items-center gap-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Auto-Stepping 24h
                </span>
              )}
            </div>

            {/* Live Round Deficit Meter */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 font-sans">Grid Balance:</span>
              {roundDeficit > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/50 font-medium">
                  -{roundDeficit} MW Deficit
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-medium">
                  0.0 MW Deficit (Balanced)
                </span>
              )}
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 0, label: "R0: Initial Bids" },
              { id: 1, label: "R1: First Cuts" },
              { id: 2, label: "R2: Lifeline Shield" },
              { id: 3, label: "R3: Equilibrium" },
              { id: 4, label: "Settlement (LP)" },
            ].map((step) => {
              const isActive = selectedRound === step.id;
              const isCompleted = selectedRound > step.id || (selectedRound === 4 && !isPlaying);
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    setIsPlaying?.(false);
                    setSelectedRound(step.id);
                  }}
                  className={`p-2 rounded-lg text-left transition border ${
                    isActive
                      ? "bg-cyan-950/50 border-cyan-500/80 shadow-sm"
                      : isCompleted
                      ? "bg-slate-900 border-slate-800 text-slate-300"
                      : "bg-slate-950/40 border-slate-800/40 text-slate-600 hover:text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-semibold">
                      {step.id === 4 ? "FINAL" : `ROUND ${step.id}`}
                    </span>
                    {isCompleted && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                  </div>
                  <div className={`text-xs truncate ${isActive ? "text-cyan-300 font-semibold" : ""}`}>
                    {step.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Autonomous Gemini Multi-Agent Speech & Deliberation Stream ──── */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
              <span>Autonomous Agent Deliberation ({ROUND_TITLES[selectedRound].split(":")[0]})</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-cyan-400 animate-pulse" />
                <span>Gemini 3.8 Flash AI Stream</span>
              </span>
              {lastDeliberatedAt && (
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  Updated {lastDeliberatedAt}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {Object.values(state.agents).map((agent) => {
              const liveDelib = aiDeliberations[selectedRound]?.[agent.id];
              const { speech, strategy, isAi } = getDynamicAgentSpeech(
                agent,
                selectedRound,
                state.step,
                state,
                liveDelib
              );
              const bid = getRoundBid(agent, selectedRound);
              const concession = Math.max(0, Math.round((agent.demand - bid) * 10) / 10);

              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    selectedAgentId === agent.id
                      ? "bg-slate-900 border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-md shadow-cyan-950/50"
                      : isPlaying
                      ? "bg-slate-900/70 border-slate-700/80 hover:border-slate-600"
                      : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-slate-200 truncate font-sans">
                          {agent.name.split(" ")[0]}
                        </span>
                        {isPlaying && (
                          <Radio className="h-2.5 w-2.5 text-cyan-400 animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {agent.is_cheater && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-semibold animate-pulse">
                            CHEATER
                          </span>
                        )}
                        <span
                          className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded"
                          style={{
                            color: AGENT_COLORS[agent.id],
                            backgroundColor: `${AGENT_COLORS[agent.id]}15`,
                          }}
                        >
                          {bid.toFixed(1)} MW
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      &ldquo;{speech}&rdquo;
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50 truncate max-w-[130px]">
                        {strategy}
                      </span>
                      {isAi ? (
                        <span className="text-[9px] text-cyan-400 font-mono flex items-center gap-0.5">
                          <Sparkles className="h-2 w-2" />
                          <span>AI</span>
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-mono">
                          H{state.step}•R{selectedRound}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Concession:</span>
                    <span className={concession > 0 ? "text-emerald-400 font-medium" : "text-slate-500"}>
                      {concession > 0 ? `-${concession} MW` : "0.0 MW"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Concession Progress Matrix Table */}
        <div className="overflow-x-auto mt-4 pt-3 border-t border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-900/40">
                <th className="py-2 px-3 font-medium font-sans">Agent</th>
                <th className="py-2 px-3 font-medium">Priority Tier</th>
                <th className="py-2 px-3 font-medium">R0 Initial</th>
                <th className="py-2 px-3 font-medium">R1</th>
                <th className="py-2 px-3 font-medium">R2</th>
                <th className="py-2 px-3 font-medium">R3</th>
                <th className="py-2 px-3 font-medium">Final Allocation</th>
                <th className="py-2 px-3 font-medium">Concession</th>
                <th className="py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {Object.values(state.agents).map((a) => {
                const r0 = a.rounds?.[0]?.bid_mw ?? a.demand;
                const r1 = a.rounds?.[1]?.bid_mw ?? a.demand;
                const r2 = a.rounds?.[2]?.bid_mw ?? a.demand;
                const r3 = a.rounds?.[3]?.bid_mw ?? a.allocation;
                const concession = Math.max(0, Math.round((r0 - a.allocation) * 10) / 10);

                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedAgentId(a.id)}
                    className={`cursor-pointer transition ${
                      selectedAgentId === a.id
                        ? "bg-cyan-950/30 text-cyan-200"
                        : "hover:bg-slate-900/50 text-slate-300"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold flex items-center gap-1.5 font-sans">
                      <span>{a.name}</span>
                      {a.is_cheater && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-medium">
                          Cheater
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400">
                      {a.criticality.replace("_", " ")}
                    </td>
                    <td className={`py-2.5 px-3 ${selectedRound === 0 ? "text-cyan-300 font-bold bg-cyan-950/20" : ""}`}>
                      {r0} MW
                    </td>
                    <td className={`py-2.5 px-3 ${selectedRound === 1 ? "text-cyan-300 font-bold bg-cyan-950/20" : "text-slate-400"}`}>
                      {r1} MW
                    </td>
                    <td className={`py-2.5 px-3 ${selectedRound === 2 ? "text-cyan-300 font-bold bg-cyan-950/20" : "text-slate-400"}`}>
                      {r2} MW
                    </td>
                    <td className={`py-2.5 px-3 ${selectedRound === 3 ? "text-cyan-300 font-bold bg-cyan-950/20" : "text-slate-400"}`}>
                      {r3} MW
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${selectedRound === 4 ? "text-cyan-300 bg-cyan-950/30" : "text-slate-200"}`}>
                      {a.allocation} MW
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      {concession > 0 ? `-${concession} MW` : "0.0 MW"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          a.status === "Satisfied"
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                            : a.status === "Degraded"
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/60"
                            : "bg-rose-950/60 text-rose-300 border border-rose-800/60"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Mid Section: Concession Bids vs Final Allocations Chart ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Initial Demand vs Final Allocation (MW)</span>
            </h3>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#172033" />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                <YAxis stroke="#475569" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b101e",
                    borderColor: "#334155",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="initialBid" name="Initial Bid (MW)" fill="#475569" radius={[4, 4, 0, 0]} />
                <Bar dataKey="allocated" name="Allocated (MW)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Selected Agent AI & Solver Rationale Card */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" />
                <span>Agent Mind & Strategy: {selectedAgent.name}</span>
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                {selectedAgent.criticality.replace("_", " ")}
              </span>
            </div>

            {/* Live Gemini AI First-Person Agent Rationale */}
            <div className="mb-3 p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-cyan-400" />
                  <span>Gemini LLM Director Mindset:</span>
                </span>
                <button
                  onClick={() => handleFetchSingleAgentThought(selectedAgent.id)}
                  disabled={loadingAgentThought[selectedAgent.id]}
                  className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-700/60 text-cyan-200 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Sparkles className={`h-2.5 w-2.5 ${loadingAgentThought[selectedAgent.id] ? "animate-spin" : ""}`} />
                  <span>{loadingAgentThought[selectedAgent.id] ? "Prompting..." : "Ask Agent"}</span>
                </button>
              </div>
              <p className="text-slate-200 leading-relaxed text-xs italic">
                &ldquo;{agentAiThoughts[selectedAgent.id] || selectedAgent.ai_thought || aiDeliberations[selectedRound]?.[selectedAgent.id]?.speech || selectedAgent.explanation || "Holding life-support continuity circuits under emergency protocols."}&rdquo;
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="text-slate-400 text-[11px] mb-1 font-medium">Stage A-C LP Mathematical Guarantee:</div>
                <p className="text-slate-200 leading-relaxed text-xs">
                  {selectedAgent.explanation ||
                    `Agent received ${selectedAgent.allocation} MW out of requested ${selectedAgent.demand} MW (${Math.round(selectedAgent.satisfaction_ratio * 100)}%). Critical baseline guaranteed.`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Critical Guarantee</span>
                  <span className="text-slate-100 font-bold">{selectedAgent.minimum_mw} MW</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Deficit below Demand</span>
                  <span className="text-amber-400 font-bold">{selectedAgent.deficit.toFixed(2)} MW</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Strategic Truthfulness Test:</span>
            <button
              onClick={() => onToggleCheater(selectedAgent.id, !selectedAgent.is_cheater)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedAgent.is_cheater
                  ? "bg-rose-500/25 text-rose-200 border border-rose-500/60 hover:bg-rose-500/35 shadow-sm"
                  : "bg-slate-900 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-700"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>{selectedAgent.is_cheater ? "Cheater Mode: ON (Click to Deactivate)" : "Cheater Mode: OFF (Click to Activate 2x Overbid)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Section: VCG Clarke Pivot Mechanism & Auditor ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VCG Clarke Pivot Calculation Panel */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span>VCG Clarke Pivot Mechanism</span>
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-800/50">
              Strategy-Proof
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
            <div className="text-[11px] text-slate-400 font-medium">Clarke Pivot Tax Formula:</div>
            <div className="text-cyan-300 font-mono font-semibold bg-[#080b11] p-2 rounded-md border border-slate-800 text-center text-xs">
              P_i = W_(-i) - &sum;_(j &ne; i) v_j(x_j*)
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
              Each agent pays exactly the externality its consumption imposes on peers. Because the tax cancels out any marginal gain from false claiming, reporting true demand is a weakly dominant strategy.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-sans">Welfare With i</span>
              <span className="text-slate-200 font-bold">1,840.5</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-sans">Welfare Without i</span>
              <span className="text-slate-200 font-bold">1,785.0</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-sans">Pivot Tax</span>
              <span className="text-amber-400 font-bold">{selectedAgent.vcg_payment.toFixed(1)} cr</span>
            </div>
          </div>
        </div>

        {/* Reputation Auditor Log */}
        <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                <span>Ex-Post Reputation Auditor</span>
              </h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-800/50">
                Active Audit
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-400 text-xs leading-relaxed">
                Verifies claimed demand against physical consumption telemetry. Discrepancies decay trust exponentially:
              </p>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-sans">Selected Agent Trust:</span>
                  <span
                    className={`font-bold ${
                      selectedAgent.reputation_trust >= 0.8
                        ? "text-emerald-400"
                        : selectedAgent.reputation_trust >= 0.5
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {(selectedAgent.reputation_trust * 100).toFixed(0)}% (Floor 20%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedAgent.reputation_trust >= 0.8
                        ? "bg-emerald-500"
                        : selectedAgent.reputation_trust >= 0.5
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${selectedAgent.reputation_trust * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 font-sans">
                  <span>Recovery Rate:</span>
                  <span className="text-slate-300 font-mono">+5% per clean step</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
            {selectedAgent.is_cheater ? (
              <span className="text-rose-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Penalty Applied: Trust decaying -25%/step under audit.
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" /> Honest Baseline: Full credibility. No audit flags.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
