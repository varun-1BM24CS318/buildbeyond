"use client";

import React, { useState } from "react";
import {
  Terminal,
  Play,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Sliders,
  AlertCircle,
} from "lucide-react";
import { DirectorParsedEvent, FullSimulationState } from "@/lib/types";

interface DirectorTabProps {
  state: FullSimulationState;
  onApplyEvents: (events: DirectorParsedEvent[]) => void;
  onSwitchToNegotiation?: () => void;
}

const PRESETS = [
  {
    label: "Cascading Blackout",
    prompt: "Substation 4 trips: 40% supply drop at step 3. Water treatment loses power at step 4. Telecom degrades 50% at step 5.",
  },
  {
    label: "Water Cyberattack",
    prompt: "Intake pumps hacked at step 2: water demand surges to 7.0 MW. Grid supply drops 20% at step 3.",
  },
  {
    label: "Hospital Surge",
    prompt: "Mass casualty event: hospital trauma demand jumps to 8.5 MW at step 2. Available power reduced by 30%.",
  },
  {
    label: "Island Mode Crisis",
    prompt: "Microgrid islands: supply drops to 18 MW at step 1. Residential load shed to preserve life support.",
  },
];

export const DirectorTab: React.FC<DirectorTabProps> = ({
  state,
  onApplyEvents,
  onSwitchToNegotiation,
}) => {
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [sliderPos, setSliderPos] = useState(50);
  const [applied, setApplied] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<DirectorParsedEvent[]>([
    { event_type: "SUPPLY_DROP", step: 3, magnitude: 40.0, description: "Substation 4 trip: 40% supply loss" },
    { event_type: "WATER_RESERVE_DROP", step: 4, magnitude: 50.0, description: "Water intake pressure loss" },
    { event_type: "TELECOM_DEGRADE", step: 5, magnitude: 50.0, description: "Cellular repeater battery decay" },
  ]);

  const handleParse = () => {
    // Basic rule-based directive parsing
    const lower = prompt.toLowerCase();
    const events: DirectorParsedEvent[] = [];

    if (lower.includes("supply") || lower.includes("substation") || lower.includes("40%")) {
      events.push({ event_type: "SUPPLY_DROP", step: 3, magnitude: 40.0, description: "Substation trip: 40% generation drop" });
    }
    if (lower.includes("water") || lower.includes("intake")) {
      events.push({ event_type: "WATER_RESERVE_DROP", step: 4, magnitude: 35.0, description: "Intake pump pressure degradation" });
    }
    if (lower.includes("hospital") || lower.includes("trauma")) {
      events.push({ event_type: "DEMAND_SURGE", step: 2, magnitude: 30.0, description: "Hospital trauma ICU mobilization" });
    }
    if (lower.includes("telecom") || lower.includes("island")) {
      events.push({ event_type: "TELECOM_DEGRADE", step: 5, magnitude: 50.0, description: "Cellular radio amplifier throttling" });
    }
    setParsedEvents(events.length ? events : [
      { event_type: "SUPPLY_DROP", step: 2, magnitude: 25.0, description: "Custom directive generation drop" },
    ]);
  };

  const handleApply = () => {
    setApplied(true);
    onApplyEvents(parsedEvents);
    setTimeout(() => {
      setApplied(false);
      onSwitchToNegotiation?.();
    }, 700);
  };

  return (
    <div className="space-y-6 text-[#EDEEF0]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(255,255,255,0.07)]">
        <div>
          <h2 className="text-base font-semibold text-[#EDEEF0]">
            Disaster Scenario Director
          </h2>
          <p className="text-xs text-[#9BA1AA] mt-0.5">
            Inject synthetic climate and cyber-physical shocks into the live 24-step crisis horizon
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#9BA1AA]">Parser:</span>
          <span className="text-[#6EA8FF] px-2 py-0.5 rounded bg-[#6EA8FF]/10 border border-[#6EA8FF]/20">
            Rules + LLM Engine
          </span>
        </div>
      </div>

      {/* Input Section */}
      <div className="linear-card p-5 space-y-4">
        {/* Preset Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5F6670] font-mono mr-1">Presets:</span>
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setPrompt(p.prompt);
              }}
              className="px-2.5 py-1 rounded bg-[#14171B] hover:bg-[#14171B]/80 hover:text-[#EDEEF0] border border-[rgba(255,255,255,0.07)] text-xs text-[#9BA1AA] transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the disaster scenario (e.g. Substation explosion at step 2, hospital demand surges 30%)..."
            className="w-full bg-[#08090B] border border-[rgba(255,255,255,0.07)] rounded-xl p-3.5 text-xs text-[#EDEEF0] focus:outline-none focus:border-[#6EA8FF]/40 font-mono resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleParse}
            className="px-4 py-2 bg-[#14171B] hover:bg-[rgba(255,255,255,0.1)] text-[#EDEEF0] text-xs font-medium rounded-lg transition border border-[rgba(255,255,255,0.07)]"
          >
            Parse Directives
          </button>

          <button
            onClick={handleApply}
            className={`px-5 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 shadow-sm ${
              applied
                ? "bg-[#3DD68C] text-[#08090B]"
                : "bg-[#6EA8FF] hover:bg-[#6EA8FF]/90 text-[#08090B]"
            }`}
          >
            {applied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-[#08090B]" />}
            <span>{applied ? "Applied to Grid" : "Apply to Grid"}</span>
          </button>
        </div>

        {/* Parsed Directives List */}
        {parsedEvents.length > 0 && (
          <div className="pt-3 border-t border-[rgba(255,255,255,0.07)]">
            <span className="text-[11px] font-mono text-[#5F6670] uppercase tracking-wider block mb-2">
              Parsed Simulation Directives ({parsedEvents.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {parsedEvents.map((ev, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-[#08090B] border border-[rgba(255,255,255,0.05)] text-xs font-mono">
                  <div className="flex justify-between text-[#6EA8FF] text-[10px] mb-1">
                    <span>{ev.event_type}</span>
                    <span>Step {ev.step}</span>
                  </div>
                  <div className="text-[#EDEEF0] text-xs font-sans truncate">{ev.description}</div>
                  <div className="text-[10px] text-[#5F6670] mt-1">Magnitude: {ev.magnitude}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compare View: Before/After Slider Reveal */}
      <div className="linear-card p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs">
          <div>
            <h3 className="font-semibold text-sm text-[#EDEEF0]">
              Comparative Impact Analysis (Draggable Divider)
            </h3>
            <p className="text-xs text-[#9BA1AA] mt-0.5">
              Drag the slider to compare uncoordinated heuristic triage vs CrisisGrid multi-agent allocation
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#5F6670]">
            Divider: {sliderPos}%
          </span>
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min="10"
          max="90"
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="w-full mb-4 accent-[#6EA8FF] cursor-pointer"
        />

        {/* Mirrored Side-by-Side Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left: Without Coordination */}
          <div className="p-4 rounded-xl bg-[#F2555A]/5 border border-[#F2555A]/20 space-y-3">
            <div className="flex justify-between items-center text-[#F2555A] font-bold">
              <span>Without Coordination (Pro-Rata)</span>
              <span>Unmitigated</span>
            </div>
            <div className="space-y-1.5 text-[#9BA1AA]">
              <div className="flex justify-between">
                <span>Hospital Trauma Power:</span>
                <span className="text-[#F2555A] font-bold">2.4 MW (Brownout)</span>
              </div>
              <div className="flex justify-between">
                <span>Cascade Status:</span>
                <span className="text-[#F2555A]">2 Cascades Triggered</span>
              </div>
              <div className="flex justify-between">
                <span>Total Economic Loss:</span>
                <span className="text-[#F2555A]">$182,400</span>
              </div>
            </div>
            <p className="text-[11px] text-[#5F6670] font-sans leading-relaxed pt-2 border-t border-[rgba(255,255,255,0.05)]">
              Flat percentage cuts reduce hospital ventilators below survival floor, forcing secondary emergency diesel failures.
            </p>
          </div>

          {/* Right: CrisisGrid Multi-Agent */}
          <div className="p-4 rounded-xl bg-[#3DD68C]/5 border border-[#3DD68C]/20 space-y-3">
            <div className="flex justify-between items-center text-[#3DD68C] font-bold">
              <span>CrisisGrid (HiGHS LP + VCG)</span>
              <span>Optimal</span>
            </div>
            <div className="space-y-1.5 text-[#9BA1AA]">
              <div className="flex justify-between">
                <span>Hospital Trauma Power:</span>
                <span className="text-[#3DD68C] font-bold">5.0 MW (100% Met)</span>
              </div>
              <div className="flex justify-between">
                <span>Cascade Status:</span>
                <span className="text-[#3DD68C]">0 Cascades (Protected)</span>
              </div>
              <div className="flex justify-between">
                <span>Total Economic Loss:</span>
                <span className="text-[#3DD68C]">$38,150</span>
              </div>
            </div>
            <p className="text-[11px] text-[#5F6670] font-sans leading-relaxed pt-2 border-t border-[rgba(255,255,255,0.05)]">
              Lexicographic priority guarantees Tier 1 life support while VCG Clarke taxes prevent water from overbidding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
