"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  BarChart3,
  Table as TableIcon,
  Download,
} from "lucide-react";
import { FullSimulationState, SimulationStepRecord } from "@/lib/types";
import { AGENT_COLORS, AGENT_NAMES, AGENT_ORDER } from "./DispatchTrajectoryChart";

// ─── Tier labels ─────────────────────────────────────────────────────────────
const AGENT_TIER: Record<string, string> = {
  hospital: "Tier 1 · Critical",
  water: "Tier 1 · Critical",
  emergency: "Tier 1 · Critical",
  telecom: "Tier 2 · Continuity",
  residential: "Tier 3 · Quality of Life",
};

const AGENT_NOMINAL: Record<string, number> = {
  hospital: 5.0,
  water: 4.0,
  emergency: 3.0,
  telecom: 2.5,
  residential: 20.5,
};

// WHY text for Residential Feeder dominance
const RESIDENTIAL_EXPLANATION =
  "Residential Feeder requests 20.5 MW — by far the largest single bid. " +
  "It is Tier 3 (Quality of Life), so critical agents are protected first; " +
  "but when supply is sufficient (35 MW total), the HiGHS LP solver satisfies " +
  "everyone's full demand. The feeder's large population base (shelters, homes) " +
  "simply has a higher aggregate MW need than any single Tier 1 agent.";

interface Props {
  state: FullSimulationState;
  onClose: () => void;
}

export const SimulationResultsPanel: React.FC<Props> = ({ state, onClose }) => {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const history = state.history;
  const totalSteps = state.total_steps;

  // Per-agent stats across all steps
  const agentStats = useMemo(() => {
    return AGENT_ORDER.map((aid) => {
      let totalAlloc = 0;
      let totalDemand = 0;
      let minAlloc = Infinity;
      let maxAlloc = -Infinity;
      let zeroSteps = 0;

      history.forEach((rec) => {
        const a = rec.allocations?.[aid] ?? 0;
        const d = rec.demands?.[aid] ?? AGENT_NOMINAL[aid];
        totalAlloc += a;
        totalDemand += d;
        if (a < minAlloc) minAlloc = a;
        if (a > maxAlloc) maxAlloc = a;
        if (a < 0.05) zeroSteps++;
      });

      const steps = history.length || 1;
      return {
        aid,
        name: AGENT_NAMES[aid] || aid,
        tier: AGENT_TIER[aid] || "",
        color: AGENT_COLORS[aid],
        totalAlloc: Math.round(totalAlloc * 10) / 10,
        totalDemand: Math.round(totalDemand * 10) / 10,
        avgAlloc: Math.round((totalAlloc / steps) * 10) / 10,
        fulfillment: totalDemand > 0 ? Math.round((totalAlloc / totalDemand) * 1000) / 10 : 100,
        minAlloc: minAlloc === Infinity ? 0 : Math.round(minAlloc * 10) / 10,
        maxAlloc: maxAlloc === -Infinity ? 0 : Math.round(maxAlloc * 10) / 10,
        zeroSteps,
      };
    });
  }, [history]);

  // Per-step totals
  const totalAllocAll = agentStats.reduce((s, a) => s + a.totalAlloc, 0);

  // Spark-bar chart: 24 steps × agents
  const svgW = 720;
  const svgH = 220;
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const slotW = plotW / totalSteps;
  const colW = Math.round(slotW * 0.72);
  const maxMW = 45;

  const getBarH = (mw: number) => (Math.min(mw, maxMW) / maxMW) * plotH;

  // Build stacked bar data per step
  const stackedBars = useMemo(() => {
    const bars: { step: number; x: number; segments: { aid: string; y: number; h: number }[] }[] = [];
    for (let s = 1; s <= totalSteps; s++) {
      const rec: SimulationStepRecord | undefined = history.find((r) => r.step === s);
      const x = padL + (s - 1) * slotW + (slotW - colW) / 2;
      let cumY = padT + plotH;
      const segments: { aid: string; y: number; h: number }[] = [];
      AGENT_ORDER.forEach((aid) => {
        const val = rec?.allocations?.[aid] ?? 0;
        const h = getBarH(val);
        if (h > 0) {
          cumY -= h;
          segments.push({ aid, y: cumY, h: Math.max(1, h - 0.5) });
        }
      });
      bars.push({ step: s, x, segments });
    }
    return bars;
  }, [history, totalSteps, slotW, colW, plotH]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="w-full max-w-6xl bg-[#0E1013] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-2xl text-[#EDEEF0]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#6EA8FF]/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#6EA8FF]" />
            </div>
            <div>
              <h2 className="text-base font-semibold">24-Hour Simulation Results</h2>
              <p className="text-xs text-[#9BA1AA] font-mono">
                Scenario: {state.scenario} · Seed: {state.seed} · {history.length}/{totalSteps} hours recorded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-[#14171B] border border-[rgba(255,255,255,0.07)] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode("chart")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition ${
                  viewMode === "chart"
                    ? "bg-[#0E1013] text-[#EDEEF0] shadow-sm border border-[rgba(255,255,255,0.08)]"
                    : "text-[#5F6670] hover:text-[#9BA1AA]"
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                Chart
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition ${
                  viewMode === "table"
                    ? "bg-[#0E1013] text-[#EDEEF0] shadow-sm border border-[rgba(255,255,255,0.08)]"
                    : "text-[#5F6670] hover:text-[#9BA1AA]"
                }`}
              >
                <TableIcon className="w-3 h-3" />
                Table
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#14171B] text-[#9BA1AA] hover:text-[#EDEEF0] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Why Residential gets the most ─────────────────────── */}
          <div className="flex gap-3 p-3.5 rounded-xl bg-[#14171B] border border-[rgba(255,255,255,0.07)]">
            <Info className="w-4 h-4 text-[#6EA8FF] mt-0.5 shrink-0" />
            <div className="text-xs text-[#9BA1AA] leading-relaxed">
              <span className="text-[#EDEEF0] font-semibold">Why does Residential Feeder receive the most power?</span>{" "}
              {RESIDENTIAL_EXPLANATION}
            </div>
          </div>

          {/* ── Summary Stat Cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {agentStats.map((ag) => {
              const pct = ag.fulfillment;
              const isOk = pct >= 99;
              const isWarn = pct >= 80 && pct < 99;
              return (
                <button
                  key={ag.aid}
                  onClick={() => setSelectedAgent(selectedAgent === ag.aid ? null : ag.aid)}
                  className={`linear-card p-3 text-left transition-all rounded-xl border ${
                    selectedAgent === ag.aid
                      ? "border-[#6EA8FF]/50 bg-[#6EA8FF]/5"
                      : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)]"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full mb-2"
                    style={{ backgroundColor: ag.color }}
                  />
                  <div className="text-[11px] text-[#9BA1AA] font-mono leading-tight truncate">{ag.name}</div>
                  <div className="text-[10px] text-[#5F6670]">{ag.tier}</div>
                  <div className="mt-2 text-lg font-mono font-bold tabular-nums" style={{ color: ag.color }}>
                    {ag.totalAlloc.toFixed(1)}
                    <span className="text-[11px] text-[#5F6670] ml-0.5">MWh</span>
                  </div>
                  <div className="text-[10px] text-[#9BA1AA] mt-0.5">avg {ag.avgAlloc.toFixed(1)} MW/hr</div>
                  <div
                    className={`text-[10px] font-mono mt-1 ${
                      isOk ? "text-[#3DD68C]" : isWarn ? "text-[#F5A524]" : "text-[#F2555A]"
                    }`}
                  >
                    {pct.toFixed(1)}% fulfilled
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Main Chart or Table ─────────────────────────────────── */}
          {viewMode === "chart" ? (
            <div className="linear-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#EDEEF0]">Allocation per Hour (Stacked MW)</h3>
                <div className="flex items-center gap-3">
                  {AGENT_ORDER.map((aid) => (
                    <button
                      key={aid}
                      onClick={() => setSelectedAgent(selectedAgent === aid ? null : aid)}
                      className={`flex items-center gap-1 text-[10px] font-mono transition ${
                        selectedAgent && selectedAgent !== aid ? "opacity-30" : "opacity-100"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AGENT_COLORS[aid] }} />
                      {aid}
                    </button>
                  ))}
                </div>
              </div>

              {/* Y-axis labels outside svg */}
              <div className="relative">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-auto"
                  style={{ fontFamily: "ui-monospace, monospace" }}
                >
                  {/* Grid lines */}
                  {[10, 20, 30, 40].map((tick) => {
                    const y = padT + plotH - (tick / maxMW) * plotH;
                    return (
                      <g key={tick}>
                        <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                        <text x={padL - 2} y={y + 3} textAnchor="end" fill="#5F6670" fontSize="8" className="tabular-nums">
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {/* Stacked bars */}
                  {stackedBars.map(({ step, x, segments }) => (
                    <g key={step}>
                      {segments.map(({ aid, y, h }) => (
                        <rect
                          key={aid}
                          x={x}
                          y={y}
                          width={colW}
                          height={h}
                          fill={AGENT_COLORS[aid]}
                          opacity={selectedAgent && selectedAgent !== aid ? 0.12 : 0.9}
                          rx={1}
                        />
                      ))}
                      {/* X-axis step label every 4 steps */}
                      {(step === 1 || step % 4 === 0) && (
                        <text
                          x={x + colW / 2}
                          y={padT + plotH + 14}
                          textAnchor="middle"
                          fill="#5F6670"
                          fontSize="8"
                        >
                          {step}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* X-axis baseline */}
                  <line
                    x1={padL}
                    y1={padT + plotH}
                    x2={padL + plotW}
                    y2={padT + plotH}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                  />
                </svg>
                <div className="text-[10px] text-[#5F6670] font-mono mt-1 text-center">Hour (1–{totalSteps})</div>
              </div>
            </div>
          ) : (
            /* ── Table View ───────────────────────────────────────── */
            <div className="linear-card p-0 overflow-hidden rounded-xl">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="sticky top-0 bg-[#14171B] z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[#9BA1AA] font-medium border-b border-[rgba(255,255,255,0.07)]">
                        Hour
                      </th>
                      <th className="px-2 py-2.5 text-right text-[#9BA1AA] font-medium border-b border-[rgba(255,255,255,0.07)]">
                        Supply MW
                      </th>
                      {AGENT_ORDER.map((aid) => (
                        <th
                          key={aid}
                          className="px-2 py-2.5 text-right font-medium border-b border-[rgba(255,255,255,0.07)]"
                          style={{ color: AGENT_COLORS[aid] }}
                        >
                          {aid.slice(0, 5)}
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-right text-[#9BA1AA] font-medium border-b border-[rgba(255,255,255,0.07)]">
                        Total
                      </th>
                      <th className="px-2 py-2.5 text-right text-[#F5A524] font-medium border-b border-[rgba(255,255,255,0.07)]">
                        Unmet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
                      const rec = history.find((r) => r.step === step);
                      const isFuture = !rec;
                      const totalAlloc = rec ? (rec.total_allocated ?? AGENT_ORDER.reduce((s, a) => s + (rec.allocations?.[a] ?? 0), 0)) : null;
                      const totalDem = rec?.total_demand ?? null;
                      const unmet = totalAlloc !== null && totalDem !== null ? Math.max(0, totalDem - totalAlloc) : null;
                      return (
                        <tr
                          key={step}
                          className={`border-b border-[rgba(255,255,255,0.04)] transition ${
                            isFuture ? "opacity-30" : "hover:bg-[rgba(255,255,255,0.03)]"
                          }`}
                        >
                          <td className="px-3 py-1.5 text-[#9BA1AA] tabular-nums">{step}</td>
                          <td className="px-2 py-1.5 text-right text-[#EDEEF0] tabular-nums">
                            {rec ? rec.supply_mw.toFixed(1) : "—"}
                          </td>
                          {AGENT_ORDER.map((aid) => {
                            const val = rec?.allocations?.[aid];
                            const dem = rec?.demands?.[aid] ?? AGENT_NOMINAL[aid];
                            const shortfall = val !== undefined && val < dem - 0.05;
                            return (
                              <td
                                key={aid}
                                className={`px-2 py-1.5 text-right tabular-nums ${
                                  shortfall ? "text-[#F5A524]" : ""
                                }`}
                                style={!shortfall ? { color: AGENT_COLORS[aid] } : {}}
                              >
                                {val !== undefined ? val.toFixed(1) : "—"}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right text-[#EDEEF0] tabular-nums font-semibold">
                            {totalAlloc !== null ? totalAlloc.toFixed(1) : "—"}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right tabular-nums ${
                              unmet && unmet > 0.05 ? "text-[#F5A524]" : "text-[#5F6670]"
                            }`}
                          >
                            {unmet !== null ? (unmet > 0.05 ? unmet.toFixed(1) : "0.0") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  {history.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-[#14171B]">
                      <tr className="border-t border-[rgba(255,255,255,0.1)]">
                        <td className="px-3 py-2 text-[#EDEEF0] font-semibold">TOTAL MWh</td>
                        <td className="px-2 py-2 text-right text-[#9BA1AA]">—</td>
                        {agentStats.map((ag) => (
                          <td
                            key={ag.aid}
                            className="px-2 py-2 text-right font-bold tabular-nums"
                            style={{ color: ag.color }}
                          >
                            {ag.totalAlloc.toFixed(1)}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-[#EDEEF0] font-bold tabular-nums">
                          {totalAllocAll.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right text-[#9BA1AA]">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Per-agent detail on click ──────────────────────────── */}
          {selectedAgent && (() => {
            const ag = agentStats.find((a) => a.aid === selectedAgent)!;
            const perStep = history.map((rec) => ({
              step: rec.step,
              alloc: rec.allocations?.[selectedAgent] ?? 0,
              demand: rec.demands?.[selectedAgent] ?? AGENT_NOMINAL[selectedAgent],
            }));
            return (
              <div className="linear-card p-4 border border-[rgba(255,255,255,0.1)] rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ag.color }} />
                    <span className="text-sm font-semibold">{ag.name}</span>
                    <span className="text-[10px] text-[#5F6670] font-mono">{ag.tier}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-[#9BA1AA]">Total: <span className="text-[#EDEEF0] font-bold">{ag.totalAlloc.toFixed(1)} MWh</span></span>
                    <span className="text-[#9BA1AA]">Fulfilled: <span style={{ color: ag.fulfillment >= 99 ? "#3DD68C" : "#F5A524" }}>{ag.fulfillment.toFixed(1)}%</span></span>
                    <span className="text-[#9BA1AA]">Range: <span className="text-[#EDEEF0]">{ag.minAlloc}–{ag.maxAlloc} MW</span></span>
                  </div>
                </div>
                {/* Mini trend bars */}
                <div className="flex items-end gap-0.5 h-14">
                  {perStep.map(({ step, alloc, demand }) => {
                    const hA = (alloc / maxMW) * 56;
                    const hD = Math.min((demand / maxMW) * 56, 56);
                    const shortfall = alloc < demand - 0.05;
                    return (
                      <div key={step} className="flex flex-col items-center flex-1 relative group" title={`Hr ${step}: ${alloc.toFixed(1)} MW allocated / ${demand.toFixed(1)} MW needed`}>
                        {/* Demand marker line */}
                        <div
                          className="absolute w-full border-t border-dashed"
                          style={{
                            bottom: `${hD}px`,
                            borderColor: "rgba(245,165,36,0.4)",
                          }}
                        />
                        <div
                          className="w-full rounded-sm mt-auto"
                          style={{
                            height: `${Math.max(2, hA)}px`,
                            backgroundColor: shortfall ? "#F5A524" : ag.color,
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-[#5F6670] font-mono">
                  <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-[#F5A524]/60" /> demand line</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: ag.color, opacity: 0.85 }} /> allocated</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2 rounded-sm bg-[#F5A524] opacity-85" /> shortfall hour</span>
                </div>
              </div>
            );
          })()}

          {/* ── Fulfillment summary footer ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="linear-card p-3 rounded-xl">
              <div className="text-[10px] text-[#9BA1AA] font-mono mb-1">Total Energy Dispatched</div>
              <div className="text-xl font-mono font-bold text-[#6EA8FF] tabular-nums">
                {totalAllocAll.toFixed(1)} <span className="text-sm text-[#5F6670]">MWh</span>
              </div>
              <div className="text-[10px] text-[#5F6670] mt-0.5">across {history.length} simulation hours</div>
            </div>
            <div className="linear-card p-3 rounded-xl">
              <div className="text-[10px] text-[#9BA1AA] font-mono mb-1">Best Served Agent</div>
              {(() => {
                const best = agentStats.reduce((a, b) => (a.fulfillment > b.fulfillment ? a : b));
                return (
                  <>
                    <div className="text-base font-semibold" style={{ color: best.color }}>{best.name}</div>
                    <div className="text-[10px] text-[#3DD68C] font-mono">{best.fulfillment.toFixed(1)}% fulfilled · {best.totalAlloc.toFixed(1)} MWh</div>
                  </>
                );
              })()}
            </div>
            <div className="linear-card p-3 rounded-xl">
              <div className="text-[10px] text-[#9BA1AA] font-mono mb-1">Most Constrained Agent</div>
              {(() => {
                const worst = agentStats.reduce((a, b) => (a.fulfillment < b.fulfillment ? a : b));
                return (
                  <>
                    <div className="text-base font-semibold" style={{ color: worst.color }}>{worst.name}</div>
                    <div className={`text-[10px] font-mono ${worst.fulfillment < 99 ? "text-[#F5A524]" : "text-[#3DD68C]"}`}>
                      {worst.fulfillment.toFixed(1)}% fulfilled · {worst.zeroSteps} zero-MW hours
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
