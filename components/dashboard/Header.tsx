"use client";

import React from "react";
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Zap,
  Activity,
  ShieldCheck,
  Radio,
  Sliders,
  Database,
  Sparkles,
  ChevronDown,
  Scale,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

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
  onOpenGemini: () => void;
  onOpenSupabase?: () => void;
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

export const Header: React.FC<HeaderProps> = ({
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
  onOpenGemini,
  onOpenSupabase,
}) => {
  const isCompleted = state.step >= state.total_steps;

  return (
    <header className="border-b border-slate-800/80 bg-[#080b11]/90 backdrop-blur-md sticky top-0 z-50 transition-colors">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/10">
            <Zap className="h-4 w-4 fill-cyan-400/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 tracking-tight text-base font-sans">
                CrisisGrid
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-medium">
                v2.0 Safe
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Autonomous Multi-Agent Crisis Allocator
            </p>
          </div>
        </div>

        {/* Playback Controls & Status Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Scenario Selector */}
          <div className="relative flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 font-medium mr-1.5">Scenario:</span>
            <select
              value={state.scenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
            >
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-slate-900 text-slate-200">
                  {sc.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-slate-500 absolute right-2 pointer-events-none" />
          </div>

          {/* Stepper & Play/Pause */}
          <div className="flex items-center gap-0.5 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onStep(1)}
              disabled={isPlaying || isCompleted}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium flex items-center gap-1 transition disabled:opacity-40"
              title={isCompleted ? "Simulation complete. Reset to step again." : "Execute Next Step (+1)"}
            >
              <StepForward className="h-3.5 w-3.5 text-slate-400" />
              <span>Step</span>
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
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                isPlaying
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                  : isCompleted
                  ? "bg-slate-800 text-cyan-300 border border-slate-700 hover:bg-slate-700"
                  : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3 w-3 fill-current" />
                  <span>Pause</span>
                </>
              ) : isCompleted ? (
                <>
                  <RotateCcw className="h-3 w-3" />
                  <span>Replay</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>
            <button
              onClick={onReset}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition"
              title="Reset Simulation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="hidden sm:flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 text-xs">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
                  speed === spd
                    ? "bg-slate-800 text-cyan-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Step Counter Badge */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 text-[11px]">Step</span>
            <span className="text-slate-200 font-mono font-medium">
              {state.step} <span className="text-slate-500 font-normal">/ {state.total_steps}</span>
            </span>
          </div>

          {/* WS / API Live Indicator */}
          <div
            className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 text-[11px] ${
              state.is_backend_connected
                ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-400"
                : "bg-amber-950/30 border-amber-800/40 text-amber-400"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  state.is_backend_connected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  state.is_backend_connected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            <span className="font-medium">
              {state.is_backend_connected ? "API Live" : "Fallback"}
            </span>
          </div>

          {/* Supabase Cloud Postgres Badge & Viewer Trigger */}
          <button
            onClick={onOpenSupabase}
            className="hidden lg:flex items-center gap-1.5 border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 hover:border-emerald-700/60 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 hover:text-emerald-300 transition shadow-sm cursor-pointer"
            title="Connected to Supabase Project: povtxolmajhxrnwqyjhd (Click to view Cloud Database Explorer)"
          >
            <Database className="h-3 w-3 text-emerald-400" />
            <span className="font-medium">Cloud DB</span>
          </button>

          {/* Gemini AI Multi-Agent Engine Badge */}
          <div
            className="hidden md:flex items-center gap-1.5 border border-cyan-800/50 bg-cyan-950/40 rounded-lg px-2.5 py-1 text-[11px] text-cyan-300 shadow-sm"
            title="Google Gemini 3.8 Flash AI actively powers all 5 crisis agents"
          >
            <Sparkles className="h-3 w-3 text-cyan-400 animate-pulse" />
            <span className="font-medium">Gemini AI Active</span>
          </div>

          {/* Gemini AI Incident Commander Button */}
          <button
            onClick={onOpenGemini}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20 hover:from-cyan-600/30 hover:to-purple-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-medium shadow-sm transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ask Gemini</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto no-scrollbar gap-2 py-1.5 border-t border-slate-800/60">
        {[
          { id: "command", label: "Overview", icon: Activity },
          { id: "negotiation", label: "Negotiation Protocol", icon: Scale },
          { id: "cascade", label: "Cascade Topology", icon: Radio },
          { id: "analytics", label: "Benchmarks & Proofs", icon: Sliders },
          { id: "director", label: "Scenario Director", icon: Zap },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1.5 border ${
                isActive
                  ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/50 font-semibold shadow-sm"
                  : "bg-transparent text-slate-300 border-transparent hover:text-white hover:bg-slate-800/50 hover:border-slate-800"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
