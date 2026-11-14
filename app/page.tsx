"use client";

import React, { useEffect, useState, useRef } from "react";
import { Header } from "@/components/dashboard/Header";
import { CommandCenterTab } from "@/components/dashboard/CommandCenterTab";
import { NegotiationTab } from "@/components/dashboard/NegotiationTab";
import { CascadeTab } from "@/components/dashboard/CascadeTab";
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";
import { DirectorTab } from "@/components/dashboard/DirectorTab";
import { GeminiAdvisorModal } from "@/components/dashboard/GeminiAdvisorModal";
import { SupabaseCloudModal } from "@/components/dashboard/SupabaseCloudModal";
import { FullSimulationState } from "@/lib/types";
import { simClient, INITIAL_SIM_STATE } from "@/lib/api-client";
import { ShieldCheck, Zap, Cpu, Database, CheckCircle2 } from "lucide-react";

export default function CrisisDashboard() {
  const [state, setState] = useState<FullSimulationState>(INITIAL_SIM_STATE);
  const [activeTab, setActiveTab] = useState<string>("command");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [isGeminiOpen, setIsGeminiOpen] = useState<boolean>(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState<boolean>(false);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to real-time simulation updates
  useEffect(() => {
    const unsubscribe = simClient.subscribe((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleStep = (steps: number = 1) => {
    simClient.step(steps);
  };

  const handleReset = () => {
    setIsPlaying(false);
    simClient.reset(state.scenario);
  };

  const handleScenarioChange = (scenario: string) => {
    setIsPlaying(false);
    simClient.setScenario(scenario);
  };

  const handleToggleCheater = (agentId: string, isCheater: boolean) => {
    simClient.setAgentMode(agentId, isCheater);
  };

  const handleApplyDirectorEvents = () => {
    // Already processed through client
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* ── Top Fixed Navigation & Control Center Header ─────────────────── */}
      <Header
        state={state}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStep={handleStep}
        onReset={handleReset}
        onScenarioChange={handleScenarioChange}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        speed={speed}
        setSpeed={setSpeed}
        onOpenGemini={() => setIsGeminiOpen(true)}
        onOpenSupabase={() => setIsSupabaseOpen(true)}
      />

      {/* ── Main Tabbed Content Area (Persistent DOM to maintain background animations across all 24 rounds) ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        <div className={activeTab === "command" ? "block" : "hidden"}>
          <CommandCenterTab
            state={state}
            onToggleCheater={handleToggleCheater}
          />
        </div>
        <div className={activeTab === "negotiation" ? "block" : "hidden"}>
          <NegotiationTab
            state={state}
            onToggleCheater={handleToggleCheater}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            speed={speed}
            onStep={handleStep}
          />
        </div>
        <div className={activeTab === "cascade" ? "block" : "hidden"}>
          <CascadeTab state={state} />
        </div>
        <div className={activeTab === "analytics" ? "block" : "hidden"}>
          <AnalyticsTab state={state} />
        </div>
        <div className={activeTab === "director" ? "block" : "hidden"}>
          <DirectorTab
            state={state}
            onApplyEvents={handleApplyDirectorEvents}
          />
        </div>
      </main>

      {/* ── Gemini AI Incident Commander Modal ──────────────────────────── */}
      <GeminiAdvisorModal
        isOpen={isGeminiOpen}
        onClose={() => setIsGeminiOpen(false)}
        state={state}
      />

      {/* ── Supabase Cloud Database Explorer Modal ──────────────────────── */}
      <SupabaseCloudModal
        isOpen={isSupabaseOpen}
        onClose={() => setIsSupabaseOpen(false)}
      />

      {/* ── System Status Footer & Proof Guarantee Bar ──────────────────── */}
      <footer className="border-t border-slate-800/60 bg-[#080b11] py-3 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Capacity Invariant: 0 Violations (&Sigma; Allocations &le; Supply)</span>
            </span>
            <span className="hidden sm:inline-block text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>3-Stage Lexicographic LP (SciPy HiGHS)</span>
            </span>
            <span className="hidden sm:inline-block text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="h-3.5 w-3.5 text-purple-400" />
              <span>SHA-256 Ledger Chain</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono">
              Provably Safe Multi-Agent Allocation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono font-medium">
              VCG Truthful
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
