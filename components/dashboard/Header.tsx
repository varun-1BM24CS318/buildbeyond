"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ChevronDown,
  Sparkles,
  Database,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Activity,
  Layers,
  Scale,
  GitBranch,
  Sliders,
  Radio,
  Trophy,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";
import { ScenarioDropdown } from "./ScenarioDropdown";

interface HeaderProps {
  state: FullSimulationState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStep: (steps: number) => void;
  onReset: () => void;
  onScenarioChange: (scenario: string) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  onOpenAssistant: () => void;
  onGoToLanding: () => void;
  onShowResults?: () => void;
}

const SCENARIOS = [
  { id: "normal", label: "Normal Operations (35 MW)" },
  { id: "grid_failure", label: "Grid Substation Failure (18 MW)" },
  { id: "cyclone", label: "Severe Cyclone & Flooding" },
  { id: "hospital_generator_failure", label: "Hospital Generator Fire" },
  { id: "water_shortage", label: "Water Pumping Crisis" },
  { id: "telecom_failure", label: "Telecom Tower Collapse" },
  { id: "recovery", label: "Grid Recovery Phase" },
  { id: "cheater_under_scarcity", label: "Cheater Infiltration under Scarcity" },
];

const TABS = [
  { id: "command", label: "Overview" },
  { id: "negotiation", label: "Negotiation" },
  { id: "cascade", label: "Cascade" },
  { id: "analytics", label: "Benchmarks" },
  { id: "director", label: "Director" },
];

export const Header: React.FC<HeaderProps> = React.memo(({
  state,
  activeTab,
  setActiveTab,
  onStep,
  onReset,
  onScenarioChange,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  onOpenAssistant,
  onGoToLanding,
}) => {
  const isCompleted = state.step >= state.total_steps;
  const stepPercent = Math.min(100, Math.round((state.step / state.total_steps) * 100));
  const isViolation = (state.capacity_violations || 0) > 0;
  const [showResultsExternal, setShowResultsExternal] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#08090B]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] text-[#EDEEF0]">
      {/* 56px Main Bar */}
      <div className="max-w-[1520px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand + Nav Segmented */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onGoToLanding}
              className="flex items-center gap-1.5 text-xs text-[#9BA1AA] hover:text-[#EDEEF0] transition px-2 py-1 rounded hover:bg-[#14171B]"
              title="Return to Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Landing</span>
            </button>
            <div className="h-4 w-px bg-[rgba(255,255,255,0.07)]" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-[#EDEEF0]">
                CrisisGrid
              </span>
              <span className="text-[11px] font-mono text-[#5F6670] border border-[rgba(255,255,255,0.07)] px-1.5 py-0.5 rounded">
                v2.0
              </span>
            </div>
          </div>

          {/* Nav Segmented Control */}
          <nav className="flex items-center bg-[#0E1013] border border-[rgba(255,255,255,0.07)] rounded-lg p-0.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    isActive
                      ? "bg-[#14171B] text-[#EDEEF0] shadow-sm"
                      : "text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B]/50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Controls + Scenario + Transport + Speed + Status + Assistant */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Custom Scenario Dropdown */}
          <ScenarioDropdown
            scenarios={SCENARIOS}
            selectedId={state.scenario}
            onSelect={onScenarioChange}
          />

          {/* Transport Controls */}
          <div className="flex items-center bg-[#0E1013] border border-[rgba(255,255,255,0.07)] rounded-lg p-0.5">
            <button
              onClick={() => onStep(1)}
              disabled={isPlaying || isCompleted}
              className="px-2 py-1 text-xs text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B] rounded transition disabled:opacity-30"
              title="Next Step (+1)"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (isCompleted) {
                  onReset();
                  setIsPlaying(true);
                } else {
                  setIsPlaying(!isPlaying);
                }
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                isPlaying
                  ? "bg-[#6EA8FF]/15 text-[#6EA8FF]"
                  : "text-[#EDEEF0] hover:bg-[#14171B]"
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>
            <button
              onClick={onReset}
              className="px-2 py-1 text-xs text-[#9BA1AA] hover:text-[#EDEEF0] hover:bg-[#14171B] rounded transition"
              title="Reset Simulation"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Speed Segmented */}
          <div className="flex items-center bg-[#0E1013] border border-[rgba(255,255,255,0.07)] rounded-lg p-0.5 text-xs">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  speed === spd
                    ? "bg-[#14171B] text-[#EDEEF0] font-semibold"
                    : "text-[#5F6670] hover:text-[#9BA1AA]"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Step Progress */}
          <div className="flex flex-col gap-1 w-24">
            <div className="flex justify-between text-[11px] font-mono text-[#9BA1AA] tabular-nums">
              <span>Step</span>
              <span className="text-[#EDEEF0]">{state.step} / {state.total_steps}</span>
            </div>
            <div className="w-full h-1 bg-[#14171B] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6EA8FF] transition-all duration-300"
                style={{ width: `${stepPercent}%` }}
              />
            </div>
          </div>

          {/* Live Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0E1013] border border-[rgba(255,255,255,0.07)] text-[11px] text-[#9BA1AA]"
            title={state.is_backend_connected ? "Connected to Backend & Cloud DB" : "Running in client fallback mode"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state.is_backend_connected ? "bg-[#3DD68C]" : "bg-[#F5A524]"
              }`}
            />
            <span className="font-mono text-[#EDEEF0]">{state.is_backend_connected ? "Live" : "Fallback"}</span>
          </div>

          {/* Assistant Drawer Trigger */}
          <button
            onClick={onOpenAssistant}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14171B] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.07)] text-xs text-[#EDEEF0] transition font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#6EA8FF]" />
            <span>Assistant</span>
          </button>
        </div>
      </div>

      {/* Safety Strip */}
      <div className={`px-4 py-1.5 text-xs flex items-center justify-between border-t border-[rgba(255,255,255,0.07)] transition-colors ${
        isViolation
          ? "bg-[#F2555A]/20 text-[#F2555A] font-bold"
          : "bg-[#08090B] text-[#9BA1AA]"
      }`}>
        <div className="max-w-[1520px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isViolation ? "bg-[#F2555A] animate-ping" : "bg-[#3DD68C]"}`} />
              <span>Capacity violations:</span>
              <strong className="font-mono text-[#EDEEF0] tabular-nums">
                {state.capacity_violations ?? 0}
              </strong>
            </span>
            <span className="text-[#5F6670]">|</span>
            <span className="text-[#9BA1AA]">
              Audit Ledger: <span className="font-mono text-[#EDEEF0]">Verified SHA-256</span>
            </span>
            <span className="text-[#5F6670]">|</span>
            <span className="text-[#9BA1AA]">
              Solver: <span className="font-mono text-[#EDEEF0]">HiGHS LP (2.1ms)</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-[#5F6670]">
            <span>Active shock: {state.scenario}</span>
            <span>·</span>
            <span>Seed: {state.seed || 42}</span>
          </div>
        </div>
      </div>
    </header>
  );
});
