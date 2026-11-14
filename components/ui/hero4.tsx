"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
} from "motion/react";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Database,
  Radio,
  Activity,
  Sparkles,
  Scale,
  Menu,
  X,
  Hospital,
  Droplets,
  Siren,
  PhoneCall,
  Home,
} from "lucide-react";

export interface Hero4Props {
  onEnterDashboard?: () => void;
}

export default function Hero4({ onEnterDashboard }: Hero4Props = {}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true, margin: "-80px 0px" });

  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 120]);
  const y2 = useTransform(scrollY, [0, 500], [0, -100]);

  const dispatchBars = [35, 24.5, 22.0, 26.0, 28.0, 33.0];
  const steps = ["S1 (Cyclone)", "S2 (Trip)", "S3 (Trough)", "S4 (Diesel)", "S5 (Relief)", "S6 (Restored)"];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#architecture", label: "3-Stage LP Architecture" },
    { href: "#agents", label: "Autonomous Agents" },
    { href: "#vcg", label: "VCG Strategy-Proofness" },
    { href: "#proofs", label: "Mathematical Proofs" },
  ];

  const agentPills = [
    { name: "Hospital ICU", icon: Hospital, mw: "5.0 MW", tier: "Tier 1", color: "text-rose-400 bg-rose-950/60 border-rose-800/60" },
    { name: "Water Treatment", icon: Droplets, mw: "4.0 MW", tier: "Tier 1", color: "text-cyan-400 bg-cyan-950/60 border-cyan-800/60" },
    { name: "First Responders", icon: Siren, mw: "3.0 MW", tier: "Tier 1", color: "text-amber-400 bg-amber-950/60 border-amber-800/60" },
    { name: "911 Telecom", icon: PhoneCall, mw: "2.5 MW", tier: "Tier 2", color: "text-purple-400 bg-purple-950/60 border-purple-800/60" },
    { name: "Residential Feeder", icon: Home, mw: "10.0 MW", tier: "Tier 3", color: "text-blue-400 bg-blue-950/60 border-blue-800/60" },
  ];

  return (
    <div
      className="min-h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans selection:bg-cyan-500 selection:text-black"
      ref={heroRef}
    >
      {/* ── Standalone CrisisGrid Landing Navbar ───────────────────────── */}
      <motion.header
        className={[
          "relative z-50 transition-all duration-300 border-b",
          scrolled
            ? "bg-[#070b14]/95 backdrop-blur-md border-slate-800/80 shadow-lg shadow-black/40"
            : "bg-transparent border-transparent",
        ].join(" ")}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-20">
            <motion.div
              className="flex items-center gap-8"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/40">
                  <Zap className="w-5 h-5 fill-cyan-300/30 text-cyan-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-white tracking-tight font-sans">
                      CrisisGrid
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
                      v2.0 Safe
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Autonomous Multi-Agent Crisis Allocator
                  </p>
                </div>
              </div>

              <nav className="hidden lg:flex items-center gap-1 ml-4">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-slate-900/80 transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </motion.div>

            {/* Desktop Navbar CTA */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 border border-emerald-800/50 bg-emerald-950/40 rounded-lg px-2.5 py-1 text-[11px] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-medium">Provably Safe (0 Violations)</span>
              </div>

              <button
                onClick={onEnterDashboard}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Launch Mission Control</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="md:hidden border-b border-slate-800 bg-[#080d1a] px-5 py-4 space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block text-sm text-slate-300 hover:text-cyan-400 py-1"
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEnterDashboard?.();
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>Open Mission Control Dashboard</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── Main Hero Section ────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden">
        {/* Subtle Ambient Background Gradients */}
        <motion.div
          className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-900/15 blur-[120px]"
          style={{ y: y1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1 }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-48 -left-48 w-[700px] h-[700px] rounded-full bg-blue-900/15 blur-[140px]"
          style={{ y: y2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 1, delay: 0.2 }}
        />

        {/* Tech Grid Pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-14">
            {/* Left Column: Hero Copy & Value Proposition */}
            <div className="lg:w-1/2 mb-12 lg:mb-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="inline-flex items-center gap-2 mb-6"
              >
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-800/60 bg-cyan-950/40 text-cyan-300 text-xs font-medium tracking-tight shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Civil Defense & Critical Infrastructure Protocol
                </span>
              </motion.div>

              <motion.h1
                className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.12] tracking-tight text-white mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                Autonomous Multi-Agent{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                  Crisis Grid Allocation
                </span>
              </motion.h1>

              <motion.p
                className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-xl"
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                When extreme climate catastrophes crash municipal power, <strong>5 autonomous Gemini AI agents</strong> negotiate life-critical energy distributions using <strong>3-stage lexicographic linear programming</strong> and <strong>VCG Clarke pivot mechanism design</strong>.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-3.5 mb-10"
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                <button
                  onClick={onEnterDashboard}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-all shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Launch Live Mission Control</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#architecture"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>3-Stage LP Solver Specs</span>
                </a>
              </motion.div>

              {/* Verified Sector Pills */}
              <motion.div
                className="space-y-2.5"
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  5 Coordinated Autonomous Utility Sectors:
                </p>
                <div className="flex flex-wrap gap-2">
                  {agentPills.map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <div
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${a.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{a.name}</span>
                        <span className="font-mono font-bold text-[11px] opacity-90">({a.mw})</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {/* Right Column: Live Simulated Microgrid Telemetry Graphic */}
            <motion.div
              className="lg:w-1/2 relative"
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={heroInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.75, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Outer Decorative Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-75" />

              <div className="relative rounded-2xl border border-slate-800 bg-[#0c1222] shadow-2xl shadow-black/80 overflow-hidden">
                {/* Simulated Window Title Bar */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-[#090e1a] border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono font-medium text-slate-400 ml-2">
                      CrisisGrid Telemetry — Step 1 / 24 (Severe Cyclone)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                    HiGHS 2.1ms
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Key Operational KPI Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#0e162b] rounded-xl p-3 border border-slate-800/80">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                        Disaster Supply
                      </p>
                      <p className="text-xl font-bold text-white font-mono">
                        24.5 <span className="text-xs font-sans text-slate-400">MW</span>
                      </p>
                      <p className="text-[10px] text-amber-400 font-medium mt-0.5">
                        -30% Storm Trough
                      </p>
                    </div>

                    <div className="bg-[#0e162b] rounded-xl p-3 border border-slate-800/80">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                        Critical Survival
                      </p>
                      <p className="text-xl font-bold text-emerald-400 font-mono">
                        100%
                      </p>
                      <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                        Tier 1 Preserved
                      </p>
                    </div>

                    <div className="bg-[#0e162b] rounded-xl p-3 border border-slate-800/80">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                        Safety Invariant
                      </p>
                      <p className="text-xl font-bold text-cyan-400 font-mono">
                        0 Violations
                      </p>
                      <p className="text-[10px] text-cyan-400 font-medium mt-0.5">
                        ∑x_i ≤ Supply
                      </p>
                    </div>
                  </div>

                  {/* Real-Time Utility Allocation Stream */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-slate-200">
                        Lexicographic Optimal Utility Allocations
                      </p>
                      <span className="text-[11px] text-emerald-400 font-medium font-mono">
                        Stage A-C LP Solved
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: "General Hospital Trauma ICU", alloc: "5.0 MW", demand: "5.0 MW", status: "100% Guaranteed", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-800/40" },
                        { name: "Municipal Water Treatment (Pumps)", alloc: "4.0 MW", demand: "4.0 MW", status: "Cascade Safe", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-800/40" },
                        { name: "Emergency First Responders (911)", alloc: "3.0 MW", demand: "3.0 MW", status: "Priority 1 Active", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-800/40" },
                        { name: "Telecom Emergency Microwave Core", alloc: "2.5 MW", demand: "2.5 MW", status: "Voice Preserved", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-800/40" },
                        { name: "Residential Feeder (Rotational)", alloc: "10.0 MW", demand: "20.5 MW", status: "Shedding Active", color: "text-slate-400", bg: "bg-slate-800/30 border-slate-700/40" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${item.bg}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                            <span className="font-medium text-slate-200">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-300 font-semibold">{item.alloc}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${item.color}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hourly Microgrid Dispatch Trajectory Bar Chart */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-300">
                        Disaster Horizon Trajectory (MW Available)
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">24 Discrete Steps</span>
                    </div>

                    <div className="flex items-end gap-2 h-16 pt-2 border-t border-slate-800/80 px-1">
                      {dispatchBars.map((val, i) => {
                        const heightPct = Math.round((val / 35.0) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="w-full bg-slate-800/80 rounded-t h-full flex items-end overflow-hidden">
                              <motion.div
                                className={`w-full ${val < 25 ? 'bg-amber-400' : 'bg-cyan-400'} rounded-t`}
                                initial={{ height: 0 }}
                                animate={heroInView ? { height: `${heightPct}%` } : {}}
                                transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono group-hover:text-cyan-300 transition-colors">
                              {steps[i].split(" ")[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Footer / Direct Action */}
                <div className="p-3.5 bg-[#080d19] border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-cyan-400" />
                    <span>VCG Clarke Pivot Mechanism: Truth-Dominant</span>
                  </span>
                  <button
                    onClick={onEnterDashboard}
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Inspect Live Sim</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
