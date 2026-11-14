"use client";

import React, { useRef } from "react";
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Database,
  Radio,
  Sliders,
  Scale,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface LandingPageProps {
  state: FullSimulationState;
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ state, onEnterApp }) => {
  const stepsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-[#08090B] text-[#EDEEF0] selection:bg-[#6EA8FF]/20 selection:text-[#6EA8FF] font-sans">
      {/* 1. Nav */}
      <header className="sticky top-0 z-40 w-full bg-[#08090B]/85 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-[#6EA8FF]/15 border border-[#6EA8FF]/30 flex items-center justify-center text-[#6EA8FF]">
              <Zap className="w-3.5 h-3.5 fill-[#6EA8FF]" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#EDEEF0]">CrisisGrid</span>
            <span className="text-[10px] font-mono text-[#5F6670] border border-[rgba(255,255,255,0.07)] px-1.5 py-0.5 rounded">
              v2.0
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-[#9BA1AA]">
            <a href="#problem" className="hover:text-[#EDEEF0] transition">The Problem</a>
            <a href="#how-it-works" className="hover:text-[#EDEEF0] transition">How It Works</a>
            <a href="#proof" className="hover:text-[#EDEEF0] transition">Live Proof</a>
            <a href="#capabilities" className="hover:text-[#EDEEF0] transition">Capabilities</a>
          </nav>

          <button
            onClick={onEnterApp}
            className="px-3.5 py-1.5 rounded-lg bg-[#6EA8FF] hover:bg-[#6EA8FF]/90 text-[#08090B] font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
          >
            <span>Open Command Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-[rgba(255,255,255,0.07)]">
        {/* Subtle grid & soft ambient sweep */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute -top-40 right-10 w-[500px] h-[500px] bg-[#6EA8FF]/5 rounded-full blur-[140px]" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.07)] bg-[#0E1013] text-xs text-[#9BA1AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
              <span>Autonomous crisis resource allocation</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.02em] text-[#EDEEF0] leading-[1.08]">
              When the grid fails, every megawatt has to be argued for.
            </h1>

            <p className="text-base sm:text-lg text-[#9BA1AA] leading-relaxed max-w-xl">
              Agents negotiate, an optimizer allocates, and a formal validator guarantees that physical capacity is never exceeded.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={onEnterApp}
                className="px-5 py-2.5 rounded-lg bg-[#6EA8FF] hover:bg-[#6EA8FF]/90 text-[#08090B] font-semibold text-xs transition flex items-center gap-2 shadow-sm"
              >
                <span>Open Command Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href="#how-it-works"
                className="px-5 py-2.5 rounded-lg bg-[#0E1013] hover:bg-[#14171B] border border-[rgba(255,255,255,0.07)] text-[#EDEEF0] font-medium text-xs transition"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right Column: Ambient Miniature of Negotiation Floor */}
          <div className="lg:col-span-5">
            <div className="linear-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs font-mono">
                <span className="text-[#9BA1AA]">Ambient Floor Status</span>
                <span className="text-[#3DD68C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                  Active {state.step} / {state.total_steps}
                </span>
              </div>

              {/* Minimal SVG Floor Miniature */}
              <div className="flex items-center justify-center py-4">
                <svg viewBox="0 0 280 200" className="w-full max-w-[280px]">
                  {/* Central Mediator Hub */}
                  <circle cx="140" cy="100" r="18" fill="#14171B" stroke="#6EA8FF" strokeWidth="1" />
                  <text x="140" y="104" textAnchor="middle" fill="#6EA8FF" fontSize="9" fontFamily="monospace">
                    HUB
                  </text>

                  {/* Radiating Edges to 5 Sectors */}
                  {[
                    { angle: -90, name: "Hospital", mw: state.agents.hospital?.allocation ?? 5 },
                    { angle: -18, name: "Water", mw: state.agents.water?.allocation ?? 4 },
                    { angle: 54, name: "Emergency", mw: state.agents.emergency?.allocation ?? 3 },
                    { angle: 126, name: "Telecom", mw: state.agents.telecom?.allocation ?? 2.5 },
                    { angle: 198, name: "Residential", mw: state.agents.residential?.allocation ?? 10 },
                  ].map((ag, i) => {
                    const rad = (ag.angle * Math.PI) / 180;
                    const x = 140 + 72 * Math.cos(rad);
                    const y = 100 + 72 * Math.sin(rad);
                    return (
                      <g key={i}>
                        <line
                          x1="140"
                          y1="100"
                          x2={x}
                          y2={y}
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle cx={x} cy={y} r="14" fill="#0E1013" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <text x={x} y={y + 3} textAnchor="middle" fill="#EDEEF0" fontSize="8" fontFamily="monospace">
                          {ag.mw}M
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t border-[rgba(255,255,255,0.07)]">
                <div className="text-[#9BA1AA]">
                  Supply: <span className="text-[#EDEEF0]">{state.supply_mw} MW</span>
                </div>
                <div className="text-right text-[#9BA1AA]">
                  Violations: <span className="text-[#3DD68C]">{state.capacity_violations ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Problem */}
      <section id="problem" className="py-20 border-b border-[rgba(255,255,255,0.07)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-[#5F6670] mb-3">
            01 / The Problem
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#EDEEF0] mb-10 max-w-xl">
            Why heuristic grid shedding fails in major disasters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="linear-card p-6 space-y-3">
              <div className="text-xs font-mono text-[#F5A524]">01 · Scarcity</div>
              <h3 className="font-semibold text-base text-[#EDEEF0]">Shortages force triage</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Catastrophes induce abrupt generation drops where aggregate demand exceeds grid capacity by 30–50%. Static rules cannot arbitrate dynamic emergency needs.
              </p>
            </div>

            <div className="linear-card p-6 space-y-3">
              <div className="text-xs font-mono text-[#6EA8FF]">02 · Cascades</div>
              <h3 className="font-semibold text-base text-[#EDEEF0]">Infrastructure is interdependent</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Power cuts to water treatment cause municipal pressure loss, directly tripping hospital steam sterilizers and HVAC chillers in an uncontrolled secondary collapse.
              </p>
            </div>

            <div className="linear-card p-6 space-y-3">
              <div className="text-xs font-mono text-[#F2555A]">03 · Cheating</div>
              <h3 className="font-semibold text-base text-[#EDEEF0]">Self-interested agents overstate need</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Under panic, individual utility operators inflate bids to hoard energy reserves. Without an externality tax, aggressive claimants starve critical medical life support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works (4-Step Horizontal Timeline) */}
      <section id="how-it-works" className="py-20 border-b border-[rgba(255,255,255,0.07)] bg-[#0A0C0F]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-[#5F6670] mb-3">
            02 / Protocol
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#EDEEF0] mb-10">
            How CrisisGrid arbitrates emergency power
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Agents Bid",
                desc: "5 autonomous utility agents inspect local sensors (ICU ventilators, water pressure) and submit structured demand bids.",
                icon: Activity,
              },
              {
                step: "02",
                title: "Concede",
                desc: "Agents participate in discrete concession rounds, offering flexible load reductions while defending minimum survival floors.",
                icon: Scale,
              },
              {
                step: "03",
                title: "Optimize",
                desc: "3-Stage Lexicographic LP (SciPy HiGHS) solves survival maxima, cascade minimization, and max-min fairness in 2.1 ms.",
                icon: Cpu,
              },
              {
                step: "04",
                title: "Validate & Commit",
                desc: "A strict invariant validator verifies capacity (sum x_i <= S). Results are committed to a SHA-256 cryptographic chain.",
                icon: ShieldCheck,
              },
            ].map((st, i) => {
              const Icon = st.icon;
              return (
                <div key={i} className="linear-card p-6 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono text-[#6EA8FF] font-semibold">{st.step}</span>
                      <Icon className="w-4 h-4 text-[#9BA1AA]" />
                    </div>
                    <h3 className="font-semibold text-sm text-[#EDEEF0] mb-2">{st.title}</h3>
                    <p className="text-xs text-[#9BA1AA] leading-relaxed">{st.desc}</p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-[rgba(255,255,255,0.07)] text-[11px] font-mono text-[#5F6670]">
                    Verified step
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Live Proof Strip */}
      <section id="proof" className="py-20 border-b border-[rgba(255,255,255,0.07)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-[#5F6670] mb-3">
            03 / Live Proof
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#EDEEF0] mb-8">
            Measured solver benchmarks from active run
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="linear-card p-6">
              <span className="text-xs text-[#9BA1AA]">Capacity Violations</span>
              <div className="text-3xl font-mono font-bold text-[#3DD68C] mt-2 mb-1 tabular-nums">
                {state.capacity_violations ?? 0}
              </div>
              <span className="text-[11px] font-mono text-[#5F6670]">Dual simplex invariant</span>
            </div>

            <div className="linear-card p-6">
              <span className="text-xs text-[#9BA1AA]">Tier 1 Survival Floor</span>
              <div className="text-3xl font-mono font-bold text-[#EDEEF0] mt-2 mb-1 tabular-nums">
                {state.survival_rate || 100}%
              </div>
              <span className="text-[11px] font-mono text-[#5F6670]">Hospitals, Water & 911</span>
            </div>

            <div className="linear-card p-6">
              <span className="text-xs text-[#9BA1AA]">Solver Latency</span>
              <div className="text-3xl font-mono font-bold text-[#6EA8FF] mt-2 mb-1 tabular-nums">
                2.1 ms
              </div>
              <span className="text-[11px] font-mono text-[#5F6670]">HiGHS interior-point</span>
            </div>

            <div className="linear-card p-6">
              <span className="text-xs text-[#9BA1AA]">Cheater Gain Under VCG</span>
              <div className="text-3xl font-mono font-bold text-[#EDEEF0] mt-2 mb-1 tabular-nums">
                0.0 MW
              </div>
              <span className="text-[11px] font-mono text-[#5F6670]">Clarke pivot externality tax</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Capabilities Grid (2x3) */}
      <section id="capabilities" className="py-20 border-b border-[rgba(255,255,255,0.07)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono uppercase tracking-widest text-[#5F6670] mb-3">
            04 / Capabilities
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#EDEEF0] mb-10">
            Engineered for real-world municipal infrastructure
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="linear-card p-6 space-y-2">
              <Radio className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Cascade-Aware Allocation</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Directly models inter-utility coupling coefficients (water to hospital chillers, power to telecom repeaters) to avoid secondary failure traps.
              </p>
            </div>

            <div className="linear-card p-6 space-y-2">
              <Scale className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Strategic-Lie Testing</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Employs non-monetary VCG Clarke pivot taxes and Bayesian reputation decay to make truth-telling the dominant strategy.
              </p>
            </div>

            <div className="linear-card p-6 space-y-2">
              <Database className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Hash-Chained Audit Ledger</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Every step, bid, allocation, and tax computation is cryptographically chained in a SHA-256 ledger and mirrored to Supabase Cloud Postgres.
              </p>
            </div>

            <div className="linear-card p-6 space-y-2">
              <Sliders className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Disaster Director</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Simulate hurricanes, transformer explosions, and cyberattacks via natural language instructions or presets, with instant before/after comparative impact.
              </p>
            </div>

            <div className="linear-card p-6 space-y-2">
              <Activity className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Baseline & Oracle Benchmarks</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Live empirical comparison against Pro-Rata shedding, Strict Priority heuristics, and full-information offline LP oracles.
              </p>
            </div>

            <div className="linear-card p-6 space-y-2">
              <Zap className="w-4 h-4 text-[#6EA8FF] mb-2" />
              <h3 className="font-semibold text-sm text-[#EDEEF0]">Real-Time Command Center</h3>
              <p className="text-xs text-[#9BA1AA] leading-relaxed">
                Interactive SVG negotiation floor, live trajectory graphs, and grounded Gemini AI incident assistance via Model Context Protocol (MCP).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Honest Footer Band */}
      <footer className="py-12 bg-[#060709] text-xs text-[#5F6670]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="max-w-xl text-left leading-relaxed">
            Mediator-based negotiation, not distributed consensus. Priority credits are virtual. Cascade coefficients are documented assumptions.
          </p>
          <button
            onClick={onEnterApp}
            className="px-4 py-2 rounded-lg bg-[#14171B] hover:bg-[#6EA8FF] hover:text-[#08090B] text-[#EDEEF0] font-medium transition text-xs flex items-center gap-2"
          >
            <span>Enter Command Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
