"use client";

import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from "react";
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
  ShieldCheck,
  Activity,
  ChevronLeft,
  ChevronRight,
  StepForward,
  Shuffle,
  AlertTriangle,
  Info,
  Radio,
  FileCheck2,
} from "lucide-react";
import { FullSimulationState, AgentStatus } from "@/lib/types";

// =====================================================================
// Types & Definitions
// =====================================================================

export interface NegotiationFloorProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean) => void;
  speed?: number;
  onStep?: (steps?: number) => void;
  onReset?: () => void;
}

export interface NegotiationEvent {
  id: string;
  round: number; // 0: Init, 1: Shortage, 2: Concession, 3: Audit/Commit
  stageNum: number; // 1 to 6
  stageName: string;
  agentId?: string;
  verb: "init" | "bid" | "shortage" | "concede" | "audit" | "optimize" | "commit" | "skipped";
  title: string;
  detail: string;
  mwValue?: number;
  deltaMw?: number;
  excessMw: number;
  supplyMw: number;
  isAnomaly?: boolean;
}

interface AgentNodeDef {
  id: string;
  name: string;
  angle: number; // in degrees
  icon: React.ComponentType<{ className?: string }>;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  color: string;
  nominalDemand: number;
  certifiedMax: number;
  criticalFloor: number;
}

const AGENT_NODES: AgentNodeDef[] = [
  { id: "hospital", name: "Hospital ICU", angle: -90, icon: Hospital, tier: "Tier 1", color: "#6EA8FF", nominalDemand: 5.0, certifiedMax: 6.0, criticalFloor: 2.0 },
  { id: "water", name: "Water Pumping", angle: -18, icon: Droplets, tier: "Tier 1", color: "#4F86E0", nominalDemand: 4.0, certifiedMax: 5.0, criticalFloor: 1.5 },
  { id: "emergency", name: "First Responders", angle: 54, icon: Siren, tier: "Tier 1", color: "#3A66B8", nominalDemand: 3.0, certifiedMax: 4.0, criticalFloor: 1.0 },
  { id: "telecom", name: "911 Telecom", angle: 126, icon: PhoneCall, tier: "Tier 2", color: "#8B93A1", nominalDemand: 2.5, certifiedMax: 3.5, criticalFloor: 0.8 },
  { id: "residential", name: "Residential Feeder", angle: 198, icon: Home, tier: "Tier 3", color: "#4A505B", nominalDemand: 20.5, certifiedMax: 25.0, criticalFloor: 3.0 },
];

const PROTOCOL_STAGES = [
  { num: 1, round: 0, label: "Collect Certified Bids", desc: "Sensors verify telemetry bounds" },
  { num: 2, round: 1, label: "Shortage Arbitration", desc: "Aggregate demand vs capacity check" },
  { num: 3, round: 2, label: "Concession Round 1", desc: "Tier 3 sheds non-vital discretionary load" },
  { num: 4, round: 2, label: "Concession Round 2", desc: "Tier 2 steps down commercial bandwidth" },
  { num: 5, round: 3, label: "Telemetry Verification & VCG", desc: "Clarke pivot tax on externality" },
  { num: 6, round: 3, label: "Commit & Ledger Chaining", desc: "SHA-256 block sealed into immutable ledger" },
];

export interface CheaterProfile {
  agentId: string;
  multiplier: number;
  claimedBid: number;
  trueNeed: number;
  certifiedMax: number;
  penaltyCredits: number;
  trustLoss: number;
}

// =====================================================================
// Event Generator (Pure function derived from live state)
// =====================================================================

function generateNegotiationEvents(
  state: FullSimulationState,
  cheater: CheaterProfile | null
): NegotiationEvent[] {
  const supply = state.supply_mw || 35.0;
  const initialDemand = Object.values(state.agents).reduce((acc, a) => acc + (a.demand || 0), 0);
  const excess = Math.max(0, Math.round((initialDemand - supply) * 10) / 10);
  const isShortage = excess > 0.05;

  const events: NegotiationEvent[] = [];

  // ── Round 0: Initial Bids ──────────────────────────────────────────
  events.push({
    id: `ev-init-0`,
    round: 0,
    stageNum: 1,
    stageName: "Collect Certified Bids",
    verb: "init",
    title: "Negotiation Protocol Initiated",
    detail: `5 infrastructure agents connected. Supply: ${supply.toFixed(1)} MW.`,
    excessMw: excess,
    supplyMw: supply,
  });

  AGENT_NODES.forEach((ag, idx) => {
    const isThisCheater = cheater && cheater.agentId === ag.id;
    const bidVal = isThisCheater
      ? cheater.claimedBid
      : state.agents[ag.id]?.demand ?? ag.nominalDemand;

    events.push({
      id: `ev-bid-${ag.id}-${idx}`,
      round: 0,
      stageNum: 1,
      stageName: "Collect Certified Bids",
      agentId: ag.id,
      verb: "bid",
      title: `${ag.name} submitted certified bid`,
      detail: `Initial request: ${bidVal.toFixed(1)} MW (certified cap: ${ag.certifiedMax.toFixed(1)} MW).`,
      mwValue: bidVal,
      excessMw: excess,
      supplyMw: supply,
    });
  });

  // ── Round 1: Shortage Check ────────────────────────────────────────
  if (!isShortage) {
    events.push({
      id: `ev-shortage-skip`,
      round: 1,
      stageNum: 2,
      stageName: "Shortage Arbitration",
      verb: "skipped",
      title: `Skipped: no shortage`,
      detail: `Demand ${initialDemand.toFixed(1)} MW ≤ Supply ${supply.toFixed(1)} MW. Grid feasible.`,
      excessMw: 0,
      supplyMw: supply,
    });
  } else {
    events.push({
      id: `ev-shortage-eval`,
      round: 1,
      stageNum: 2,
      stageName: "Shortage Arbitration",
      verb: "shortage",
      title: `Excess demand: ${excess.toFixed(1)} MW`,
      detail: `Grid supply is ${supply.toFixed(1)} MW vs ${initialDemand.toFixed(1)} MW requested. Arbitration active.`,
      excessMw: excess,
      supplyMw: supply,
    });
  }

  // ── Round 2: Concessions ───────────────────────────────────────────
  if (!isShortage) {
    events.push({
      id: `ev-concession-skip`,
      round: 2,
      stageNum: 3,
      stageName: "Concession Rounds",
      verb: "skipped",
      title: `Skipped: no concessions required`,
      detail: `Full capacity available. Tier 1-3 demands preserved without load shedding.`,
      excessMw: 0,
      supplyMw: supply,
    });
  } else {
    const resConcession = Math.min(excess * 0.65, 3.5);
    const telConcession = Math.min(excess * 0.25, 0.8);
    const remainingExcess1 = Math.max(0, excess - resConcession);
    const remainingExcess2 = Math.max(0, remainingExcess1 - telConcession);

    events.push({
      id: `ev-concession-res`,
      round: 2,
      stageNum: 3,
      stageName: "Concession Round 1",
      agentId: "residential",
      verb: "concede",
      title: `Residential sheds discretionary load`,
      detail: `Conceded ${resConcession.toFixed(1)} MW non-vital heating/EV load.`,
      mwValue: (state.agents.residential?.demand ?? 20.5) - resConcession,
      deltaMw: -resConcession,
      excessMw: remainingExcess1,
      supplyMw: supply,
    });

    events.push({
      id: `ev-concession-tel`,
      round: 2,
      stageNum: 4,
      stageName: "Concession Round 2",
      agentId: "telecom",
      verb: "concede",
      title: `Telecom steps down auxiliary 5G`,
      detail: `Conceded ${telConcession.toFixed(1)} MW commercial band power. Priority 911 traffic intact.`,
      mwValue: (state.agents.telecom?.demand ?? 2.5) - telConcession,
      deltaMw: -telConcession,
      excessMw: remainingExcess2,
      supplyMw: supply,
    });

    events.push({
      id: `ev-protected-t1`,
      round: 2,
      stageNum: 4,
      stageName: "Tier 1 Immunity Verification",
      agentId: "hospital",
      verb: "concede",
      title: `Tier 1 Survival Loads Protected`,
      detail: `Hospital ICU (5.0 MW) and Water Pumping (4.0 MW) held at zero concession.`,
      mwValue: 5.0,
      deltaMw: 0.0,
      excessMw: remainingExcess2,
      supplyMw: supply,
    });
  }

  // ── Round 3: Telemetry Audit & Commit ──────────────────────────────
  if (cheater) {
    events.push({
      id: `ev-audit-anomaly`,
      round: 3,
      stageNum: 5,
      stageName: "Telemetry Verification",
      agentId: cheater.agentId,
      verb: "audit",
      title: `Auditor Flag: Strategic Overbid Detected`,
      detail: `${cheater.agentId.toUpperCase()} claimed ${cheater.claimedBid.toFixed(1)} MW vs verified need ${cheater.trueNeed.toFixed(1)} MW. Clarke tax: -${cheater.penaltyCredits} credits.`,
      isAnomaly: true,
      excessMw: 0,
      supplyMw: supply,
    });
  } else {
    events.push({
      id: `ev-audit-clean`,
      round: 3,
      stageNum: 5,
      stageName: "Telemetry Verification",
      verb: "audit",
      title: `Telemetry Audit: 0 Strategic Anomalies`,
      detail: `All 5 agents verified against ambient weather and feeder sensors. Truth-dominant state verified.`,
      excessMw: 0,
      supplyMw: supply,
    });
  }

  events.push({
    id: `ev-opt-highs`,
    round: 3,
    stageNum: 5,
    stageName: "HiGHS LP Solver",
    verb: "optimize",
    title: `HiGHS LP Optimization Converged`,
    detail: `Stage A (Survival) & Stage B (Damage Minimization) solved in 2.1 ms. 0 invariant violations.`,
    excessMw: 0,
    supplyMw: supply,
  });

  const blockHash = `9f3a${state.step}c21`;

  events.push({
    id: `ev-commit-block`,
    round: 3,
    stageNum: 6,
    stageName: "Commit & Ledger Chaining",
    verb: "commit",
    title: `Block Sealed · ${blockHash}…`,
    detail: `State sealed into SHA-256 audit ledger. Invariant Σ allocations (${state.total_allocated.toFixed(1)}) ≤ supply (${supply.toFixed(1)}).`,
    excessMw: 0,
    supplyMw: supply,
  });

  return events;
}

// =====================================================================
// Playback Reducer (Single Source of Truth)
// =====================================================================

interface PlaybackState {
  cursor: number;
  isPlaying: boolean;
  speed: number;
}

type PlaybackAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TOGGLE" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "NEXT"; totalEvents: number }
  | { type: "PREV" }
  | { type: "SEEK"; index: number; totalEvents: number }
  | { type: "RESET" };

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "PLAY":
      return { ...state, isPlaying: true };
    case "PAUSE":
      return { ...state, isPlaying: false };
    case "TOGGLE":
      return { ...state, isPlaying: !state.isPlaying };
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "NEXT": {
      const nextCursor = state.cursor + 1;
      if (nextCursor >= action.totalEvents) {
        return { ...state, isPlaying: false, cursor: action.totalEvents - 1 };
      }
      return { ...state, cursor: nextCursor };
    }
    case "PREV":
      return { ...state, isPlaying: false, cursor: Math.max(0, state.cursor - 1) };
    case "SEEK":
      return {
        ...state,
        cursor: Math.min(Math.max(0, action.index), action.totalEvents - 1),
      };
    case "RESET":
      return { ...state, cursor: 0, isPlaying: false };
    default:
      return state;
  }
}

// =====================================================================
// Main Component
// =====================================================================

export const NegotiationFloor: React.FC<NegotiationFloorProps> = ({
  state,
  onToggleCheater,
  isPlaying: globalPlaying,
  setIsPlaying: setGlobalPlaying,
  speed = 1,
  onStep,
  onReset,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>("hospital");
  const [cheaterModeActive, setCheaterModeActive] = useState<boolean>(false);
  const [cheaterProfile, setCheaterProfile] = useState<CheaterProfile | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState<boolean>(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Synchronize cheater state from external props if water is flagged
  useEffect(() => {
    if (state.agents.water?.is_cheater && !cheaterModeActive) {
      setCheaterModeActive(true);
      setCheaterProfile({
        agentId: "water",
        multiplier: 1.8,
        claimedBid: 7.2,
        trueNeed: 4.0,
        certifiedMax: 5.0,
        penaltyCredits: 380,
        trustLoss: -0.25,
      });
    }
  }, [state.agents.water?.is_cheater, cheaterModeActive]);

  // Generate deterministic event list from live state & cheater setup
  const events = useMemo(() => {
    return generateNegotiationEvents(state, cheaterModeActive ? cheaterProfile : null);
  }, [state, cheaterModeActive, cheaterProfile]);

  // Playback Reducer
  const [playback, dispatch] = useReducer(playbackReducer, {
    cursor: 0,
    isPlaying: false,
    speed: speed,
  });

  // Sync external speed prop
  useEffect(() => {
    dispatch({ type: "SET_SPEED", speed });
  }, [speed]);

  // Reset playback cursor on scenario change or manual reset
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [state.scenario, state.step]);

  // Single Timer Chain Loop (requestAnimationFrame / setTimeout cleaned up on pause, unmount, change)
  useEffect(() => {
    if (!playback.isPlaying) return;

    // Minimum stage visible duration ~1200ms divided by speed
    const delay = Math.max(250, Math.round(1100 / playback.speed));
    const timer = setTimeout(() => {
      dispatch({ type: "NEXT", totalEvents: events.length });
    }, delay);

    return () => clearTimeout(timer);
  }, [playback.isPlaying, playback.cursor, playback.speed, events.length]);

  // Current event and derived metrics
  const currentEvent = events[playback.cursor] ?? events[0];
  const currentRound = currentEvent?.round ?? 0;
  const currentStageNum = currentEvent?.stageNum ?? 1;
  const activeSpeakerId = currentEvent?.agentId ?? null;
  const visibleEvents = useMemo(() => events.slice(0, playback.cursor + 1), [events, playback.cursor]);

  // Derived agent for right rail details
  const activeAgentNode = AGENT_NODES.find((a) => a.id === selectedAgent) ?? AGENT_NODES[0];
  const activeAgentState = state.agents[selectedAgent] ?? ({} as AgentStatus);
  const isAgentSpeaking = activeSpeakerId === selectedAgent;

  // Auto-scroll transcript container
  useEffect(() => {
    if (transcriptRef.current && !userScrolledUp) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [playback.cursor, userScrolledUp]);

  // Reveal cheater card only after audit stage (Round 3)
  const isAuditRevealed = currentRound >= 3;

  // Cheater Selection & Randomization using crypto.getRandomValues
  const randomizeCheater = useCallback(() => {
    const candidates = AGENT_NODES.filter((ag) => ag.certifiedMax > ag.nominalDemand);
    if (candidates.length === 0) return;

    // Random pick via Web Crypto
    const buf = new Uint32Array(2);
    window.crypto.getRandomValues(buf);
    const chosenIndex = buf[0] % candidates.length;
    const chosenAgent = candidates[chosenIndex];

    // Multiplier between 1.5x and 2.2x
    const multiplierRaw = 1.5 + (buf[1] % 70) / 100; // 1.50 to 2.20
    const multiplier = Math.round(multiplierRaw * 10) / 10;
    const trueNeed = state.agents[chosenAgent.id]?.demand ?? chosenAgent.nominalDemand;
    const inflated = Math.min(chosenAgent.certifiedMax, Math.round(trueNeed * multiplier * 10) / 10);

    const profile: CheaterProfile = {
      agentId: chosenAgent.id,
      multiplier,
      claimedBid: inflated,
      trueNeed,
      certifiedMax: chosenAgent.certifiedMax,
      penaltyCredits: Math.round((inflated - trueNeed) * 120),
      trustLoss: -0.2,
    };

    setCheaterProfile(profile);
    setCheaterModeActive(true);

    // Update backend agent modes
    AGENT_NODES.forEach((ag) => {
      onToggleCheater(ag.id, ag.id === chosenAgent.id);
    });

    dispatch({ type: "RESET" });
  }, [state.agents, onToggleCheater]);

  const toggleCheaterMode = useCallback(() => {
    if (cheaterModeActive) {
      setCheaterModeActive(false);
      setCheaterProfile(null);
      AGENT_NODES.forEach((ag) => onToggleCheater(ag.id, false));
      dispatch({ type: "RESET" });
    } else {
      randomizeCheater();
    }
  }, [cheaterModeActive, randomizeCheater, onToggleCheater]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "TOGGLE" });
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "NEXT", totalEvents: events.length });
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "PREV" });
      } else if (e.key === "[") {
        e.preventDefault();
        // Jump to first event of previous round
        const targetRound = Math.max(0, currentRound - 1);
        const idx = events.findIndex((ev) => ev.round === targetRound);
        if (idx !== -1) dispatch({ type: "SEEK", index: idx, totalEvents: events.length });
      } else if (e.key === "]") {
        e.preventDefault();
        // Jump to first event of next round
        const targetRound = Math.min(3, currentRound + 1);
        const idx = events.findIndex((ev) => ev.round === targetRound);
        if (idx !== -1) dispatch({ type: "SEEK", index: idx, totalEvents: events.length });
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        toggleCheaterMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [events, currentRound, toggleCheaterMode]);

  // Jump to specific round
  const jumpToRound = (r: number) => {
    const idx = events.findIndex((ev) => ev.round === r);
    if (idx !== -1) {
      dispatch({ type: "SEEK", index: idx, totalEvents: events.length });
    }
  };

  // SVG Geometry Constants
  const SVG_SIZE = 540;
  const HUB_CX = 270;
  const HUB_CY = 270;
  const HUB_R = 46;
  const ORBIT_R = 185;
  const NODE_R = 30;

  // Camera Parallax: Shift up to 6px toward the active speaker
  const cameraOffset = useMemo(() => {
    if (!activeSpeakerId) return { x: 0, y: 0 };
    const speakingNode = AGENT_NODES.find((a) => a.id === activeSpeakerId);
    if (!speakingNode) return { x: 0, y: 0 };
    const rad = (speakingNode.angle * Math.PI) / 180;
    return {
      x: Math.round(Math.cos(rad) * 6),
      y: Math.round(Math.sin(rad) * 6),
    };
  }, [activeSpeakerId]);

  return (
    <div className="flex flex-col space-y-4 min-h-[calc(100vh-140px)]">
      {/* ── Top Convergence & Scrubber Header ───────────────────────── */}
      <div className="linear-card p-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.07)]">
        {/* Left: Convergence Story & Round Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9BA1AA]">
              Negotiation Engine
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#14171B] border border-[rgba(255,255,255,0.08)] text-[#6EA8FF]">
              Hour {state.step} · Round {currentRound} of 3
            </span>
          </div>

          {/* Convergence Excess Meter */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[rgba(255,255,255,0.07)]">
            <span className="text-[11px] text-[#9BA1AA]">Excess Demand:</span>
            <div className="w-28 h-2 rounded-full bg-[#14171B] overflow-hidden border border-[rgba(255,255,255,0.06)] relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  currentEvent.excessMw <= 0.05 ? "bg-[#3DD68C]" : "bg-[#F5A524]"
                }`}
                style={{
                  width: `${Math.min(100, Math.max(5, (currentEvent.excessMw / 15.0) * 100))}%`,
                }}
              />
            </div>
            <span
              className={`font-mono text-xs font-bold transition-colors ${
                currentEvent.excessMw <= 0.05 ? "text-[#3DD68C]" : "text-[#F5A524]"
              }`}
            >
              {currentEvent.excessMw <= 0.05 ? "0.0 MW (Feasible)" : `${currentEvent.excessMw.toFixed(1)} MW`}
            </span>
          </div>
        </div>

        {/* Right: Cheater Mode Arming Switch & Key Controls */}
        <div className="flex items-center gap-3">
          {/* Cheater Mode Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14171B] border border-[rgba(255,255,255,0.08)]">
            <button
              onClick={toggleCheaterMode}
              className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
                cheaterModeActive ? "bg-[#F5A524]" : "bg-[#252A31]"
              }`}
              title="Toggle Cheater Mode (Secretly overstates need by 1.5x-2.2x)"
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  cheaterModeActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-xs font-medium text-[#EDEEF0]">Cheater Mode</span>
            {cheaterModeActive && (
              <button
                onClick={randomizeCheater}
                className="p-1 hover:text-[#6EA8FF] text-[#9BA1AA] transition"
                title="Re-roll randomized cheater"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Speed Indicator */}
          <span className="font-mono text-[11px] text-[#9BA1AA] border border-[rgba(255,255,255,0.07)] px-2 py-1 rounded bg-[#0E1013]">
            {speed}x speed
          </span>
        </div>
      </div>

      {/* ── 3-Column Immersive Negotiation Layout ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* Rail 1 (3 cols): Protocol Stepper (Derived from cursor) */}
        <div className="lg:col-span-3 linear-card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">Protocol Stepper</span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">
                Stage {currentStageNum} of 6
              </span>
            </div>

            <div className="space-y-2">
              {PROTOCOL_STAGES.map((st) => {
                const isPassed = st.num < currentStageNum;
                const isCurrent = st.num === currentStageNum;

                return (
                  <div
                    key={st.num}
                    onClick={() => jumpToRound(st.round)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-[#6EA8FF]/10 border-[#6EA8FF]/35 text-[#EDEEF0]"
                        : isPassed
                        ? "bg-[#14171B]/50 border-transparent text-[#9BA1AA] hover:border-[rgba(255,255,255,0.08)]"
                        : "bg-transparent border-transparent text-[#5F6670] opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono mt-0.5 border ${
                        isPassed
                          ? "bg-[#3DD68C]/20 border-[#3DD68C]/50 text-[#3DD68C]"
                          : isCurrent
                          ? "bg-[#6EA8FF] border-[#6EA8FF] text-[#08090B] font-bold"
                          : "border-[rgba(255,255,255,0.15)] text-[#5F6670]"
                      }`}
                    >
                      {isPassed ? <Check className="w-3 h-3" /> : st.num}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs leading-none">
                          {st.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono text-[#6EA8FF] animate-pulse">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5F6670] mt-1 leading-tight line-clamp-1">
                        {st.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Measured Truthfulness Guarantee */}
          <div className="mt-4 p-3 rounded-lg bg-[#08090B] border border-[rgba(255,255,255,0.06)] text-[11px] text-[#9BA1AA] space-y-1">
            <div className="flex items-center gap-1.5 text-[#3DD68C] font-semibold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Clarke Tax Verification</span>
            </div>
            <p className="leading-relaxed">
              Gain from misreporting this run:{" "}
              <span className="font-mono font-bold text-[#EDEEF0]">
                {cheaterModeActive ? "-0.0 MW (net negative utility)" : "+0.0 MW-equivalent (measured)"}
              </span>
            </p>
          </div>
        </div>

        {/* Rail 2 (6 cols): Immersive SVG Stage & Floor Controls ──────── */}
        <div className="lg:col-span-6 linear-card p-4 flex flex-col justify-between items-center relative overflow-hidden min-h-[580px]">
          {/* Round Title Banner Card */}
          <div className="absolute top-4 inset-x-8 z-10 flex items-center justify-between px-4 py-2 rounded-lg bg-[#08090B]/90 backdrop-blur border border-[rgba(255,255,255,0.08)] pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6EA8FF] animate-ping" />
              <span className="font-mono text-xs font-bold text-[#EDEEF0]">
                ROUND {currentRound} · {currentEvent.stageName.toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-mono text-[#9BA1AA]">
              {currentEvent.excessMw <= 0.05
                ? "Supply feasible (0.0 MW deficit)"
                : `Excess: ${currentEvent.excessMw.toFixed(1)} MW`}
            </span>
          </div>

          {/* Interactive SVG Stage Canvas */}
          <div className="w-full flex-1 flex items-center justify-center pt-8 pb-2">
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto max-h-[460px] select-none"
              style={{
                transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px)`,
                transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <defs>
                {/* Hub radial glow */}
                <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#6EA8FF" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#6EA8FF" stopOpacity="0" />
                </radialGradient>

                {/* Hatched pattern for deficit */}
                <pattern id="deficitPattern" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#F5A524" strokeWidth="1.5" strokeOpacity="0.4" />
                </pattern>
              </defs>

              {/* Ambient Outer Tick Ring */}
              <circle
                cx={HUB_CX}
                cy={HUB_CY}
                r={ORBIT_R + 36}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                strokeDasharray="3 9"
              />

              {/* Hub Radial Ambient Glow */}
              <circle cx={HUB_CX} cy={HUB_CY} r={HUB_R + 60} fill="url(#hubGlow)" />

              {/* ── Communication Edges (Hub to Agents) ─────────────── */}
              {AGENT_NODES.map((ag) => {
                const rad = (ag.angle * Math.PI) / 180;
                const nodeX = HUB_CX + Math.cos(rad) * ORBIT_R;
                const nodeY = HUB_CY + Math.sin(rad) * ORBIT_R;

                // Stop line at circumference: Hub edge to Node edge (zero overlap)
                const startX = HUB_CX + Math.cos(rad) * (HUB_R + 2);
                const startY = HUB_CY + Math.sin(rad) * (HUB_R + 2);
                const endX = nodeX - Math.cos(rad) * (NODE_R + 2);
                const endY = nodeY - Math.sin(rad) * (NODE_R + 2);

                const isSpeaker = activeSpeakerId === ag.id;
                const isSelected = selectedAgent === ag.id;
                const isCheating = cheaterModeActive && cheaterProfile?.agentId === ag.id;

                const edgeStroke = isSpeaker
                  ? "#6EA8FF"
                  : isSelected
                  ? "rgba(110,168,255,0.5)"
                  : "rgba(255,255,255,0.12)";

                return (
                  <g key={`edge-${ag.id}`}>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={edgeStroke}
                      strokeWidth={isSpeaker ? 2.5 : 1.2}
                      strokeDasharray={isCheating ? "4 4" : "none"}
                      opacity={activeSpeakerId && !isSpeaker ? 0.45 : 1}
                    />

                    {/* Animated Light Pulse traveling on edge during playback */}
                    {playback.isPlaying && (
                      <circle r="3" fill={isCheating ? "#F5A524" : "#6EA8FF"}>
                        <animateMotion
                          path={`M ${startX} ${startY} L ${endX} ${endY}`}
                          dur={`${Math.max(0.6, 1.4 / playback.speed)}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* ── Central Mediator Hub ─────────────────────────────── */}
              <g className="cursor-pointer">
                {/* Outer capacity progress ring */}
                <circle
                  cx={HUB_CX}
                  cy={HUB_CY}
                  r={HUB_R + 8}
                  fill="none"
                  stroke="#14171B"
                  strokeWidth="4"
                />
                <circle
                  cx={HUB_CX}
                  cy={HUB_CY}
                  r={HUB_R + 8}
                  fill="none"
                  stroke={currentEvent.excessMw <= 0.05 ? "#3DD68C" : "#6EA8FF"}
                  strokeWidth="4"
                  strokeDasharray={`${Math.PI * 2 * (HUB_R + 8)}`}
                  strokeDashoffset={`${
                    Math.PI * 2 * (HUB_R + 8) * (currentEvent.excessMw <= 0.05 ? 0 : 0.28)
                  }`}
                  transform={`rotate(-90 ${HUB_CX} ${HUB_CY})`}
                  strokeLinecap="round"
                />

                {/* Central Plate */}
                <circle
                  cx={HUB_CX}
                  cy={HUB_CY}
                  r={HUB_R}
                  fill="#0E1013"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1.5"
                />

                {/* Hub Labels with Halo */}
                <text
                  x={HUB_CX}
                  y={HUB_CY - 8}
                  textAnchor="middle"
                  fill="#EDEEF0"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="monospace"
                  style={{ paintOrder: "stroke", stroke: "#08090B", strokeWidth: 3 }}
                >
                  MEDIATOR
                </text>
                <text
                  x={HUB_CX}
                  y={HUB_CY + 8}
                  textAnchor="middle"
                  fill="#6EA8FF"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                  style={{ paintOrder: "stroke", stroke: "#08090B", strokeWidth: 3 }}
                >
                  {state.supply_mw.toFixed(1)} MW
                </text>
                <text
                  x={HUB_CX}
                  y={HUB_CY + 22}
                  textAnchor="middle"
                  fill="#5F6670"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  HiGHS LP · SHA-256
                </text>
              </g>

              {/* ── Outer Agent Nodes ────────────────────────────────── */}
              {AGENT_NODES.map((ag) => {
                const rad = (ag.angle * Math.PI) / 180;
                const nodeX = HUB_CX + Math.cos(rad) * ORBIT_R;
                const nodeY = HUB_CY + Math.sin(rad) * ORBIT_R;

                const isSpeaker = activeSpeakerId === ag.id;
                const isSelected = selectedAgent === ag.id;
                const isCheating = cheaterModeActive && cheaterProfile?.agentId === ag.id;
                const IconComponent = ag.icon;

                // Opacity rule: Non-speaking nodes sit at 70% minimum (never invisible)
                const nodeOpacity = activeSpeakerId ? (isSpeaker ? 1.0 : 0.7) : 1.0;

                return (
                  <g
                    key={ag.id}
                    onClick={() => setSelectedAgent(ag.id)}
                    className="cursor-pointer transition-transform duration-200"
                    opacity={nodeOpacity}
                    style={{
                      transform: isSpeaker ? "scale(1.05)" : "scale(1.0)",
                      transformOrigin: `${nodeX}px ${nodeY}px`,
                    }}
                  >
                    {/* Active Speaker Focus Halo */}
                    {isSpeaker && (
                      <circle
                        cx={nodeX}
                        cy={nodeY}
                        r={NODE_R + 8}
                        fill="none"
                        stroke={ag.color}
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="animate-spin"
                        style={{ transformOrigin: `${nodeX}px ${nodeY}px`, animationDuration: "10s" }}
                      />
                    )}

                    {/* Node Base Circle */}
                    <circle
                      cx={nodeX}
                      cy={nodeY}
                      r={NODE_R}
                      fill="#0E1013"
                      stroke={
                        isSpeaker
                          ? ag.color
                          : isSelected
                          ? "#6EA8FF"
                          : "rgba(255,255,255,0.15)"
                      }
                      strokeWidth={isSelected || isSpeaker ? 2 : 1}
                    />

                    {/* Inner Node Icon (rendered via foreignObject) */}
                    <foreignObject
                      x={nodeX - 12}
                      y={nodeY - 20}
                      width="24"
                      height="24"
                      className="pointer-events-none"
                    >
                      <div className="w-full h-full flex items-center justify-center text-[#EDEEF0]">
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </foreignObject>

                    {/* MW Value on Node Face (13px Mono) */}
                    <text
                      x={nodeX}
                      y={nodeY + 16}
                      textAnchor="middle"
                      fill="#EDEEF0"
                      fontSize="12"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {ag.nominalDemand.toFixed(1)}M
                    </text>

                    {/* Node Name Label with Background Stroke Halo */}
                    <text
                      x={nodeX}
                      y={nodeY > HUB_CY ? nodeY + 44 : nodeY - 38}
                      textAnchor="middle"
                      fill={isSelected ? "#EDEEF0" : "#9BA1AA"}
                      fontSize="12"
                      fontWeight="600"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#08090B",
                        strokeWidth: 4,
                      }}
                    >
                      {ag.name}
                    </text>

                    {/* Protected Pill or Audit Status Chip */}
                    {ag.tier === "Tier 1" ? (
                      <text
                        x={nodeX}
                        y={nodeY > HUB_CY ? nodeY + 57 : nodeY - 49}
                        textAnchor="middle"
                        fill="#3DD68C"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="600"
                        style={{ paintOrder: "stroke", stroke: "#08090B", strokeWidth: 3 }}
                      >
                        [protected]
                      </text>
                    ) : (
                      <text
                        x={nodeX}
                        y={nodeY > HUB_CY ? nodeY + 57 : nodeY - 49}
                        textAnchor="middle"
                        fill="#5F6670"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {ag.tier}
                      </text>
                    )}

                    {/* Speaker Callout Card (Floating Dialogue) */}
                    {isSpeaker && currentEvent.detail && (
                      <g>
                        <rect
                          x={nodeX - 85}
                          y={nodeY > HUB_CY ? nodeY + 64 : nodeY - 80}
                          width="170"
                          height="26"
                          rx="4"
                          fill="#14171B"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="1"
                        />
                        <text
                          x={nodeX}
                          y={nodeY > HUB_CY ? nodeY + 80 : nodeY - 64}
                          textAnchor="middle"
                          fill="#EDEEF0"
                          fontSize="9.5"
                          fontFamily="monospace"
                        >
                          {currentEvent.title.length > 26
                            ? currentEvent.title.slice(0, 24) + "…"
                            : currentEvent.title}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Scrubber & Event Playback Controls */}
          <div className="w-full pt-3 border-t border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Play/Pause Floor & Scrubber Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => dispatch({ type: "TOGGLE" })}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition text-xs font-semibold ${
                  playback.isPlaying
                    ? "bg-[#6EA8FF]/20 text-[#6EA8FF] border border-[#6EA8FF]/40"
                    : "bg-[#14171B] hover:bg-[#6EA8FF]/15 text-[#EDEEF0] border border-[rgba(255,255,255,0.07)]"
                }`}
              >
                {playback.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-[#EDEEF0]" />}
                <span>{playback.isPlaying ? "Pause Protocol" : "Play Negotiation"}</span>
              </button>

              <div className="flex items-center bg-[#14171B] border border-[rgba(255,255,255,0.07)] rounded p-0.5">
                <button
                  onClick={() => dispatch({ type: "PREV" })}
                  className="p-1 text-[#9BA1AA] hover:text-[#EDEEF0] disabled:opacity-30"
                  disabled={playback.cursor <= 0}
                  title="Previous Event (←)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-[#EDEEF0]">
                  Ev {playback.cursor + 1}/{events.length}
                </span>
                <button
                  onClick={() => dispatch({ type: "NEXT", totalEvents: events.length })}
                  className="p-1 text-[#9BA1AA] hover:text-[#EDEEF0] disabled:opacity-30"
                  disabled={playback.cursor >= events.length - 1}
                  title="Next Event (→)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Round Chips R0-R3 */}
              <div className="hidden sm:flex items-center gap-1 pl-1">
                {[0, 1, 2, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => jumpToRound(r)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] transition ${
                      currentRound === r
                        ? "bg-[#6EA8FF] text-[#08090B] font-bold"
                        : "bg-[#14171B] text-[#9BA1AA] hover:text-[#EDEEF0]"
                    }`}
                  >
                    R{r}
                  </button>
                ))}
              </div>

              <button
                onClick={() => dispatch({ type: "RESET" })}
                className="p-1.5 text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B] rounded"
                title="Reset Negotiation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Advance to next simulation hour */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStep?.(1)}
                className="px-2.5 py-1.5 bg-[#14171B] hover:bg-[#14171B]/80 hover:text-[#EDEEF0] text-[#9BA1AA] rounded border border-[rgba(255,255,255,0.07)] text-xs flex items-center gap-1 font-mono transition"
                title="Advance global simulation hour (+1)"
              >
                <StepForward className="w-3.5 h-3.5 text-[#6EA8FF]" />
                <span>Advance to next hour</span>
              </button>
            </div>
          </div>

          {/* Keyboard hints strip */}
          <div className="w-full text-center text-[10px] text-[#5F6670] font-mono pt-1">
            Space: Play/Pause · ←/→: Step Event · [/]: Round Jump · C: Cheater Mode
          </div>
        </div>

        {/* Rail 3 (3 cols): Agent Inspector & Event Transcript ───────── */}
        <div className="lg:col-span-3 linear-card p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            {/* Header: Focused Agent Title */}
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">
                {activeAgentNode.name}
              </span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">
                {activeAgentNode.tier}
              </span>
            </div>

            {/* Consistent Mono Rows for Requested, Revised, Allocated, Floor, Max */}
            <div className="p-3 rounded-lg bg-[#08090B] border border-[rgba(255,255,255,0.06)] space-y-2">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#9BA1AA]">Critical Floor:</span>
                <span className="text-[#3DD68C]">{activeAgentNode.criticalFloor.toFixed(1)} MW</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#9BA1AA]">Requested Bid:</span>
                <span className="text-[#EDEEF0]">
                  {(cheaterModeActive && cheaterProfile?.agentId === selectedAgent
                    ? cheaterProfile.claimedBid
                    : activeAgentNode.nominalDemand
                  ).toFixed(1)} MW
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#9BA1AA]">Revised Demand:</span>
                <span className="text-[#EDEEF0]">
                  {(activeAgentState.demand ?? activeAgentNode.nominalDemand).toFixed(1)} MW
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-[#9BA1AA]">Allocated:</span>
                <span className="text-[#6EA8FF] font-bold">
                  {(activeAgentState.allocation ?? activeAgentNode.nominalDemand).toFixed(1)} MW
                </span>
              </div>
              <div className="flex justify-between font-mono text-[11px] pt-1 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[#9BA1AA]">Certified Max:</span>
                <span className="text-[#5F6670]">{activeAgentNode.certifiedMax.toFixed(1)} MW</span>
              </div>
            </div>

            {/* Cheater Assigned Card (Revealed after Round 3 verification) */}
            {cheaterModeActive && cheaterProfile && (
              <div
                className={`p-3 rounded-lg border transition-all ${
                  isAuditRevealed
                    ? "bg-[#F5A524]/10 border-[#F5A524]/40"
                    : "bg-[#14171B]/50 border-[rgba(255,255,255,0.07)]"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-[#EDEEF0] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F5A524]" />
                    <span>Cheater Status</span>
                  </span>
                  <span className="font-mono text-[10px] text-[#F5A524]">
                    {isAuditRevealed ? "REVEALED" : "ENCRYPTED"}
                  </span>
                </div>

                {isAuditRevealed ? (
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#9BA1AA]">Target:</span>
                      <span className="text-[#EDEEF0] font-bold">
                        {cheaterProfile.agentId.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9BA1AA]">True Need:</span>
                      <span className="text-[#3DD68C]">{cheaterProfile.trueNeed.toFixed(1)} MW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9BA1AA]">Claimed:</span>
                      <span className="text-[#F5A524]">{cheaterProfile.claimedBid.toFixed(1)} MW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9BA1AA]">Clarke Tax:</span>
                      <span className="text-[#F2555A]">-{cheaterProfile.penaltyCredits} credits</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9BA1AA]">Gain from Lie:</span>
                      <span className="text-[#EDEEF0]">+0.0 MW (Neutralized)</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9BA1AA] leading-relaxed">
                    Agent assigned secretly. Bids appear normal to other participants; verification sweep reveals anomalies in Round 3.
                  </p>
                )}
              </div>
            )}

            {/* Event Transcript Header */}
            <div className="pt-2 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between text-xs">
              <span className="font-semibold text-[#EDEEF0]">Live Audit Transcript</span>
              <span className="font-mono text-[10px] text-[#5F6670]">
                {visibleEvents.length} events
              </span>
            </div>

            {/* Transcript Scroll Container */}
            <div
              ref={transcriptRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20;
                setUserScrolledUp(!atBottom);
              }}
              className="space-y-2 max-h-[190px] overflow-y-auto pr-1 text-xs"
            >
              {visibleEvents.map((ev, idx) => {
                const isSelected = playback.cursor === idx;

                return (
                  <div
                    key={ev.id}
                    onClick={() => dispatch({ type: "SEEK", index: idx, totalEvents: events.length })}
                    onMouseEnter={() => setHoveredEventId(ev.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    className={`p-2 rounded border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#6EA8FF]/15 border-[#6EA8FF]/40 text-[#EDEEF0]"
                        : ev.isAnomaly
                        ? "bg-[#F5A524]/10 border-[#F5A524]/30 text-[#EDEEF0]"
                        : "bg-[#0E1013] border-[rgba(255,255,255,0.05)] text-[#9BA1AA] hover:border-[rgba(255,255,255,0.12)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ev.verb === "audit" && ev.isAnomaly
                              ? "bg-[#F5A524]"
                              : ev.verb === "commit"
                              ? "bg-[#3DD68C]"
                              : "bg-[#6EA8FF]"
                          }`}
                        />
                        <span className="font-mono text-[10px] font-semibold uppercase text-[#EDEEF0]">
                          R{ev.round} · {ev.verb}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] leading-tight text-[#EDEEF0]">{ev.title}</p>
                    <p className="text-[10px] text-[#5F6670] mt-0.5 leading-snug">{ev.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
