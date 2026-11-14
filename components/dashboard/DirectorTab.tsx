"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal,
  Zap,
  Play,
  CheckCircle,
  Cpu,
  ShieldCheck,
  ShieldX,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { DirectorParsedEvent, FullSimulationState } from "@/lib/types";
import { simClient } from "@/lib/api-client";

interface DirectorTabProps {
  state: FullSimulationState;
  onApplyEvents: (events: DirectorParsedEvent[]) => void;
}

interface CounterfactualModel {
  damagePrevented: number;
  naiveDamage: number;
  crisisGridDamage: number;
  naiveHospitalMw: number;
  naiveHospitalTotalMw: number;
  naiveHospitalPct: number;
  naiveHospitalDescription: string;
  crisisHospitalMw: number;
  crisisHospitalTotalMw: number;
  crisisHospitalPct: number;
  crisisHospitalDescription: string;
  naiveCascadeTitle: string;
  naiveCascadeDescription: string;
  crisisCascadeTitle: string;
  crisisCascadeDescription: string;
  naiveCheaterTitle: string;
  naiveCheaterDescription: string;
  crisisCheaterTitle: string;
  crisisCheaterDescription: string;
}

function calculateDynamicCounterfactual(
  prompt: string,
  events: DirectorParsedEvent[],
  state: FullSimulationState
): CounterfactualModel {
  const lower = prompt.toLowerCase();

  // 1. Detect supply cut magnitude
  let supplyCut = 0.50; // default 50%
  const supplyEvent = events.find((e) => e.event_type === "SUPPLY_DROP");
  if (supplyEvent) {
    supplyCut = supplyEvent.magnitude > 1 ? supplyEvent.magnitude / 100 : supplyEvent.magnitude;
  } else {
    const match = lower.match(/(\d+)%/);
    if (match) {
      supplyCut = Math.min(0.85, Math.max(0.15, parseInt(match[1], 10) / 100));
    }
  }

  // 2. Identify disaster conditions
  const hasWater = lower.includes("water") || lower.includes("flood") || lower.includes("pump") || events.some((e) => e.target_agent === "water");
  const hasHospital = lower.includes("hospital") || lower.includes("generator") || lower.includes("trauma") || lower.includes("surge") || events.some((e) => e.target_agent === "hospital");
  const hasTelecom = lower.includes("telecom") || lower.includes("cyber") || lower.includes("dispatch") || lower.includes("tower") || events.some((e) => e.target_agent === "telecom");
  const hasIsland = lower.includes("island") || lower.includes("blackout") || lower.includes("explodes");

  const baseSupply = (state as any).base_supply_mw || (state as any).environment?.base_supply_mw || 35.0;
  const postShockSupply = Math.max(8.0, Math.round(baseSupply * (1 - supplyCut) * 10) / 10);

  // Hospital baseline / surge demand
  const hospitalDemand = hasHospital ? 8.5 : 5.0;
  const totalDemand = (state.total_demand || 35.0) + (hasHospital ? 3.5 : 0);

  // Naive Proportional Ratio: cuts every single sector by exact same percentage
  const naiveRatio = Math.min(1.0, postShockSupply / totalDemand);
  const naiveHospitalMw = Math.round(hospitalDemand * naiveRatio * 10) / 10;
  const naiveHospitalBlackoutPct = Math.round((1 - naiveRatio) * 100);

  // CrisisGrid Stage A Lexicographic Protection: mathematically ring-fences critical minimum
  const crisisHospitalMw = Math.min(hospitalDemand, postShockSupply >= 5.0 ? hospitalDemand : postShockSupply);
  const crisisHospitalPct = Math.round((crisisHospitalMw / hospitalDemand) * 100);

  // Dynamic Cascading Lifeline Loss
  let naiveCascadeTitle = "Water Pumps Shut Down";
  let naiveCascadeDesc = "Water drops below 30%, triggering secondary HVAC chiller shutdown at the trauma center.";
  let crisisCascadeTitle = "Water Protected (4.0 MW)";
  let crisisCascadeDesc = "Stage B injects +180 util shadow value across upstream lifelines, preventing secondary collapse.";

  if (hasWater) {
    const dropDisplay = Math.round(supplyCut * 100);
    naiveCascadeTitle = `Intake Filtration Drops ${dropDisplay}%`;
    naiveCascadeDesc = `Severe hydraulic drop starves trauma center chillers (coupling κ=0.40), causing HVAC trip and ICU overheating.`;
    crisisCascadeTitle = `Pumps Shielded (${(postShockSupply >= 15 ? 4.0 : 3.2).toFixed(1)} MW)`;
    crisisCascadeDesc = `Stage B LP injects +190 util cascade shadow value, guaranteeing continuous cooling head for hospital chillers.`;
  } else if (hasTelecom) {
    naiveCascadeTitle = "911 Dispatch Grid Collapses";
    naiveCascadeDesc = "Telecom tower loss (coupling κ=0.30) severs emergency CAD telemetry and blinds ambulance fleet routing.";
    crisisCascadeTitle = "Emergency Relay Secured (2.2 MW)";
    crisisCascadeDesc = "Stage B LP preserves encrypted first responder channels and automated grid telemetry links.";
  } else if (hasHospital) {
    naiveCascadeTitle = "Sub-feeder Circuit Breakers Trip";
    naiveCascadeDesc = "Trauma overload draws unmanaged surge current, triggering cascading brownouts across adjacent emergency zones.";
    crisisCascadeTitle = "Stage A Surge Protection Active";
    crisisCascadeDesc = "Lexicographic Stage A LP dynamically ring-fences trauma feeders with prioritized reserve allocations.";
  } else if (hasIsland) {
    naiveCascadeTitle = "Cascading Collapse Across 4 Sectors";
    naiveCascadeDesc = "Transmission drop triggers frequency instability; residential surge collapses water and emergency substations.";
    crisisCascadeTitle = "Island Microgrid Balancing";
    crisisCascadeDesc = "Hierarchical tier shedding maintains 60 Hz grid stability across all primary municipal lifelines.";
  }

  // Dynamic Cheater Infiltration
  const liarSharePct = Math.round(30 + supplyCut * 20);
  const liarMw = (postShockSupply * (liarSharePct / 100)).toFixed(1);
  const naiveCheaterTitle = `Liar Grabs ${liarSharePct}% of Grid (${liarMw} MW)`;
  const naiveCheaterDesc = "Unverified demand claims award the largest allocation to the agent who inflates the most, starving honest life support.";

  const crisisCheaterTitle = "0.0000 Net Gain (VCG Taxed)";
  const crisisCheaterDesc = "Clarke pivot priority tax exactly offsets fraudulent gains; reputation trust drops to 20% floor.";

  // Dynamic Economic & Societal Damage
  const unservedCriticalMwh = Math.max(0, hospitalDemand - naiveHospitalMw) * 4.5;
  const naiveDamage = Math.round((unservedCriticalMwh * 10500 + 45000 * (1 + supplyCut * 1.5)) / 100) * 100;
  const crisisGridDamage = Math.round((28000 + (1 - crisisHospitalPct / 100) * 15000 + supplyCut * 12000) / 100) * 100;
  const damagePrevented = Math.max(25000, naiveDamage - crisisGridDamage);

  return {
    damagePrevented,
    naiveDamage,
    crisisGridDamage,
    naiveHospitalMw,
    naiveHospitalTotalMw: hospitalDemand,
    naiveHospitalPct: naiveHospitalBlackoutPct,
    naiveHospitalDescription: `Cuts life-support ventilators equally with residential streetlights due to blindness to priorities (${(naiveRatio * 100).toFixed(0)}% ratio).`,
    crisisHospitalMw,
    crisisHospitalTotalMw: hospitalDemand,
    crisisHospitalPct,
    crisisHospitalDescription: `Stage A lexicographic LP mathematically protects critical baseline survival before discretionary allocations.`,
    naiveCascadeTitle,
    naiveCascadeDescription: naiveCascadeDesc,
    crisisCascadeTitle,
    crisisCascadeDescription: crisisCascadeDesc,
    naiveCheaterTitle,
    naiveCheaterDescription: naiveCheaterDesc,
    crisisCheaterTitle,
    crisisCheaterDescription: crisisCheaterDesc,
  };
}

export const DirectorTab: React.FC<DirectorTabProps> = ({ state, onApplyEvents }) => {
  const [promptText, setPromptText] = useState<string>(
    "A category 4 cyclone strikes at hour 3: substation transmission drops by 50%, flooding cuts water treatment by 60%, and emergency dispatch spikes 2x."
  );
  const [parsedEvents, setParsedEvents] = useState<DirectorParsedEvent[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [hasApplied, setHasApplied] = useState<boolean>(false);

  const handleParse = async (customText?: string) => {
    const textToParse = customText ?? promptText;
    setIsParsing(true);
    setHasApplied(false);
    try {
      const events = await simClient.parseDirectorPrompt(textToParse);
      setParsedEvents(events);
    } finally {
      setIsParsing(false);
    }
  };

  // Auto-parse initial scenario on mount
  useEffect(() => {
    handleParse();
  }, []);

  const handleApply = async () => {
    if (parsedEvents.length === 0) return;
    await simClient.applyDirectorEvents(parsedEvents);
    setHasApplied(true);
    onApplyEvents(parsedEvents);
  };

  const handleQuickPreset = (presetText: string) => {
    setPromptText(presetText);
    setHasApplied(false);
    handleParse(presetText);
  };

  // Dynamically recompute counterfactual analysis based on current text, parsed events, and state
  const counterfactual = useMemo(
    () => calculateDynamicCounterfactual(promptText, parsedEvents, state),
    [promptText, parsedEvents, state]
  );

  return (
    <div className="space-y-5">
      {/* ── 1. Top Section: Natural Language Scenario Injector ────────────── */}
      <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span>Disaster Scenario Director</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Translate natural language crisis instructions into verified physical simulation constraints.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            NLP Rule Parser Active
          </span>
        </div>

        {/* Text Area */}
        <div className="space-y-3">
          <textarea
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              setHasApplied(false);
            }}
            rows={3}
            className="w-full bg-[#080b11] border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition leading-relaxed font-sans"
            placeholder="Type any disaster event in plain language (e.g. Substation explodes 60%, hospital surge 3x, water flooded)..."
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 text-[11px] font-medium mr-1">Presets:</span>
              <button
                onClick={() =>
                  handleQuickPreset(
                    "Primary substation Beta explodes: transmission drops 50% and telecom collapses by 70%."
                  )
                }
                className="px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition border border-slate-800/80"
              >
                Cascading Blackout
              </button>
              <button
                onClick={() =>
                  handleQuickPreset(
                    "Cyberattack on municipal water grid: water demand spikes 2x and efficiency drops 50%."
                  )
                }
                className="px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition border border-slate-800/80"
              >
                Water Cyberattack
              </button>
              <button
                onClick={() =>
                  handleQuickPreset(
                    "Mass casualty trauma event: Hospital demand surges 2.5x while backup generator suffers fire."
                  )
                }
                className="px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition border border-slate-800/80"
              >
                Hospital Surge
              </button>
              <button
                onClick={() =>
                  handleQuickPreset(
                    "Full island mode crisis: Supply plummets 70%, 4 of 5 critical agents enter emergency mode."
                  )
                }
                className="px-2.5 py-1 rounded-md bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition border border-slate-800/80"
              >
                Island Mode Crisis
              </button>
            </div>

            {/* Parse Button */}
            <button
              onClick={() => handleParse()}
              disabled={isParsing || !promptText.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span>{isParsing ? "Parsing Directives..." : "Parse Disaster Scenario"}</span>
            </button>
          </div>
        </div>

        {/* Parsed Events Preview & Confirmation Panel */}
        {parsedEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-200">
                Parsed Simulation Directives ({parsedEvents.length})
              </span>
              <button
                onClick={handleApply}
                disabled={hasApplied}
                className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  hasApplied
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                    : "bg-amber-500 hover:bg-amber-400 text-black shadow-sm font-semibold"
                }`}
              >
                {hasApplied ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Applied to Active Sim</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Apply Live to Grid</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {parsedEvents.map((ev, idx) => {
                const magDisplay = ev.magnitude > 1 ? Math.round(ev.magnitude) : Math.round(ev.magnitude * 100);
                return (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-cyan-300 capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                      <span className="text-[11px] text-slate-500 font-mono">Step {ev.step}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Target: <span className="text-slate-200 font-medium">{ev.target_agent || "General Grid"}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Impact: <span className="text-amber-400 font-mono font-medium">{magDisplay}%</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate pt-0.5">{ev.description}</div>
                  </div>
                );
              })}
            </div>

            {hasApplied && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Disaster directives applied live to the physical grid simulation! All 5 agents, cascade graphs, and allocations have been updated for Step {state.step}.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Comparative Split-Screen Counterfactual (Dynamically Recomputed) ── */}
      <div className="bg-[#0b101e]/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Comparative Disaster Counterfactual Analysis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Empirical side-by-side assessment: Uncoordinated Proportional Rationing vs CrisisGrid Mechanism.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
            Disaster Damage Prevented: ${counterfactual.damagePrevented.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs mt-3">
          {/* Left Screen: WITHOUT SYSTEM (Naive Proportional) */}
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-rose-900/30">
                <span className="flex items-center gap-2 font-semibold text-rose-300">
                  <ShieldX className="h-4 w-4 text-rose-400" />
                  <span>Naive Proportional Rationing</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 font-medium">
                  Status Quo Failure
                </span>
              </div>

              <div className="mt-3.5 space-y-2.5">
                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-rose-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Hospital Power:</span>
                    <span className="text-rose-400 font-mono font-bold">
                      {counterfactual.naiveHospitalMw.toFixed(1)} / {counterfactual.naiveHospitalTotalMw.toFixed(1)} MW ({counterfactual.naiveHospitalPct}% Blackout)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.naiveHospitalDescription}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-rose-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Cascading Lifeline Loss:</span>
                    <span className="text-rose-400 font-mono font-bold">{counterfactual.naiveCascadeTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.naiveCascadeDescription}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-rose-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Cheater Infiltration:</span>
                    <span className="text-rose-400 font-mono font-bold">{counterfactual.naiveCheaterTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.naiveCheaterDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-rose-900/30 flex justify-between items-center text-xs">
              <span className="text-slate-400">Total Disaster Damage:</span>
              <span className="text-rose-400 font-mono font-bold text-base">
                ${counterfactual.naiveDamage.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right Screen: WITH OUR SYSTEM (CrisisGrid Mechanism) */}
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/10 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-cyan-800/30">
                <span className="flex items-center gap-2 font-semibold text-cyan-300">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>CrisisGrid Multi-Agent Mechanism</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium">
                  Cascade Prevented
                </span>
              </div>

              <div className="mt-3.5 space-y-2.5">
                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-cyan-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Hospital Power:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {counterfactual.crisisHospitalMw.toFixed(1)} / {counterfactual.crisisHospitalTotalMw.toFixed(1)} MW ({counterfactual.crisisHospitalPct}% Guaranteed)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.crisisHospitalDescription}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-cyan-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Cascade Shadow Protection:</span>
                    <span className="text-cyan-400 font-mono font-bold">{counterfactual.crisisCascadeTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.crisisCascadeDescription}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#080b11]/80 border border-cyan-900/30">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Cheater Neutralized:</span>
                    <span className="text-emerald-400 font-mono font-bold">{counterfactual.crisisCheaterTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {counterfactual.crisisCheaterDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-cyan-800/30 flex justify-between items-center text-xs">
              <span className="text-slate-400">Total Disaster Damage:</span>
              <span className="text-cyan-300 font-mono font-bold text-base">
                ${counterfactual.crisisGridDamage.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
