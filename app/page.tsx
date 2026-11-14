"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { CommandCenterTab } from "@/components/dashboard/CommandCenterTab";
import { NegotiationTab } from "@/components/dashboard/NegotiationTab";
import { CascadeTab } from "@/components/dashboard/CascadeTab";
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";
import { DirectorTab } from "@/components/dashboard/DirectorTab";
import { AssistantDrawer } from "@/components/dashboard/AssistantDrawer";
import { SupabaseCloudModal } from "@/components/dashboard/SupabaseCloudModal";
import { LandingPage } from "@/components/landing/LandingPage";
import { FullSimulationState } from "@/lib/types";
import { simClient, INITIAL_SIM_STATE } from "@/lib/api-client";

export default function CrisisDashboard() {
  const [state, setState] = useState<FullSimulationState>(INITIAL_SIM_STATE);
  const [activeTab, setActiveTab] = useState<string>("landing"); // Landing is default first view
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState<boolean>(false);

  // Subscribe to real-time simulation updates
  useEffect(() => {
    const unsubscribe = simClient.subscribe((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(300, Math.round(1200 / speed));
      const timer = setInterval(() => {
        if (state.step >= state.total_steps) {
          setIsPlaying(false);
        } else {
          simClient.step(1);
        }
      }, intervalMs);
      return () => clearInterval(timer);
    }
  }, [isPlaying, speed, state.step, state.total_steps]);

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
    // Processed through client
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#EDEEF0] flex flex-col font-sans selection:bg-[#6EA8FF]/20 selection:text-[#6EA8FF]">
      {/* ── Landing Page (Default View) ─────────────────────────────────── */}
      {activeTab === "landing" ? (
        <LandingPage
          state={state}
          onEnterApp={() => setActiveTab("command")}
        />
      ) : (
        <>
          {/* ── App Shell Slim Header & Safety Strip ───────────────────────── */}
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
            onOpenAssistant={() => setIsAssistantOpen(true)}
            onGoToLanding={() => setActiveTab("landing")}
          />

          {/* ── Main Tabbed Content Area ───────────────────────────────────── */}
          <main className="flex-1 max-w-[1520px] w-full mx-auto px-4 py-5">
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
                onReset={handleReset}
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
                onSwitchToNegotiation={() => setActiveTab("negotiation")}
              />
            </div>
          </main>
        </>
      )}

      {/* ── Unified Assistant Drawer (Replaces scattered AI buttons) ───────── */}
      <AssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        state={state}
        onOpenSupabase={() => setIsSupabaseOpen(true)}
      />

      {/* ── Supabase Cloud Database Explorer Modal ────────────────────────── */}
      <SupabaseCloudModal
        isOpen={isSupabaseOpen}
        onClose={() => setIsSupabaseOpen(false)}
      />
    </div>
  );
}
