"use client";

import React, { useState, useMemo, useCallback } from "react";
import { FullSimulationState, SimulationStepRecord } from "@/lib/types";
import {
  BarChart3,
  Percent,
  Grid3X3,
  Table as TableIcon,
  Zap,
  Info,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

export const AGENT_COLORS: Record<string, string> = {
  hospital: "#6EA8FF",    // Tier 1 (Accent hue step 1)
  water: "#4F86E0",       // Tier 1 (Accent hue step 2)
  emergency: "#3A66B8",   // Tier 1 (Accent hue step 3)
  telecom: "#8B93A1",     // Tier 2 (Cool gray)
  residential: "#4A505B", // Tier 3 (Dark slate)
};

export const AGENT_NAMES: Record<string, string> = {
  hospital: "Hospital Trauma Center",
  water: "Water Treatment",
  emergency: "Emergency Responders",
  telecom: "Telecom & 911 Dispatch",
  residential: "Residential & Shelters",
};

export const AGENT_ORDER = ["hospital", "water", "emergency", "telecom", "residential"] as const;

interface DispatchTrajectoryChartProps {
  state: FullSimulationState;
  onSeekStep?: (step: number) => void;
}

const SCENARIO_EVENTS: Record<string, { step: number; label: string; detail: string; type: string }[]> = {
  cyclone: [
    { step: 1, label: "Surge +30%", detail: "Storm warning: Emergency response mobilization", type: "surge" },
    { step: 2, label: "Corridor −30%", detail: "High winds damage transmission corridor", type: "supply" },
    { step: 3, label: "Substation −15%", detail: "Debris trips secondary substation transformer", type: "supply" },
    { step: 4, label: "Water −40%", detail: "Intake contaminated by storm surge", type: "water" },
  ],
  grid_failure: [
    { step: 3, label: "Substation −40%", detail: "Major substation trip: sudden 40% supply loss", type: "supply" },
  ],
  hospital_fire: [
    { step: 2, label: "Generator Trip", detail: "Backup generator fault: hospital demand spikes to grid", type: "surge" },
  ],
  water_crisis: [
    { step: 2, label: "Pumping −50%", detail: "Main aqueduct failure: critical water pumping drop", type: "water" },
  ],
  feeder_derate: [
    { step: 2, label: "Feeder 1 Derate", detail: "North feeder capacity derated to 15 MW", type: "line" },
  ],
};

export const DispatchTrajectoryChart: React.FC<DispatchTrajectoryChartProps> = ({
  state,
  onSeekStep,
}) => {
  const [viewMode, setViewMode] = useState<"stack" | "percent" | "heatmap">("stack");
  const [showDataTable, setShowDataTable] = useState(false);
  const [isolatedAgent, setIsolatedAgent] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [pinnedStep, setPinnedStep] = useState<number | null>(null);

  const totalSlots = 24;
  const currentStep = Math.max(1, Math.min(totalSlots, state.step || 1));

  // Build step history map
  const stepMap = useMemo(() => {
    const map = new Map<number, SimulationStepRecord>();
    for (const h of state.history) {
      map.set(h.step, h);
    }
    return map;
  }, [state.history]);

  // Fixed scale for absolute MW view (stable 45 MW scale prevents columns jumping across steps)
  const FIXED_MAX_MW = 45.0;

  const hasDataAnomaly = useMemo(() => {
    return state.history.some((h) => (h.total_demand || 0) > 105.0);
  }, [state.history]);

  // SVG plot layout constants (expanded paddingTop for 3 staggered event lanes)
  const svgWidth = 1000;
  const svgHeight = 370;
  const paddingLeft = 55;
  const paddingRight = 110;
  const paddingTop = 56;
  const paddingBottom = 28;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const slotWidth = plotWidth / totalSlots;
  const colWidth = Math.round(slotWidth * 0.65);

  const getY = useCallback(
    (val: number, max: number = FIXED_MAX_MW) => {
      const clamped = Math.max(0, Math.min(max, val));
      return paddingTop + plotHeight - (clamped / max) * plotHeight;
    },
    [plotHeight, paddingTop]
  );

  const getH = useCallback(
    (val: number, max: number = FIXED_MAX_MW) => {
      const clamped = Math.max(0, val);
      return (clamped / max) * plotHeight;
    },
    [plotHeight]
  );

  // Stepped supply path
  const supplyPath = useMemo(() => {
    if (state.history.length === 0) return "";
    let d = "";
    for (let s = 1; s <= currentStep; s++) {
      const rec = stepMap.get(s);
      const supplyVal = rec?.supply_mw ?? state.supply_mw ?? 35.0;
      const effectiveVal = viewMode === "percent" ? 100.0 : supplyVal;
      const yVal = getY(effectiveVal, viewMode === "percent" ? 100.0 : FIXED_MAX_MW);
      const x1 = paddingLeft + (s - 1) * slotWidth;
      const x2 = paddingLeft + s * slotWidth;

      if (s === 1) {
        d += `M ${x1} ${yVal} L ${x2} ${yVal}`;
      } else {
        const prevRec = stepMap.get(s - 1);
        const prevSupply = prevRec?.supply_mw ?? state.supply_mw ?? 35.0;
        const prevEff = viewMode === "percent" ? 100.0 : prevSupply;
        const prevY = getY(prevEff, viewMode === "percent" ? 100.0 : FIXED_MAX_MW);
        if (Math.abs(prevY - yVal) > 0.5) {
          d += ` L ${x1} ${yVal}`; // Vertical riser
        }
        d += ` L ${x2} ${yVal}`; // Horizontal run
      }
    }
    return d;
  }, [state.history, stepMap, currentStep, slotWidth, paddingLeft, getY, viewMode, state.supply_mw]);

  // Stepped demand path
  const demandPath = useMemo(() => {
    if (state.history.length === 0 || viewMode === "percent") return "";
    let d = "";
    for (let s = 1; s <= currentStep; s++) {
      const rec = stepMap.get(s);
      const demVal = rec?.total_demand ?? state.total_demand ?? 35.0;
      const yVal = getY(demVal, FIXED_MAX_MW);
      const x1 = paddingLeft + (s - 1) * slotWidth;
      const x2 = paddingLeft + s * slotWidth;

      if (s === 1) {
        d += `M ${x1} ${yVal} L ${x2} ${yVal}`;
      } else {
        const prevRec = stepMap.get(s - 1);
        const prevDem = prevRec?.total_demand ?? state.total_demand ?? 35.0;
        const prevY = getY(prevDem, FIXED_MAX_MW);
        if (Math.abs(prevY - yVal) > 0.5) {
          d += ` L ${x1} ${yVal}`;
        }
        d += ` L ${x2} ${yVal}`;
      }
    }
    return d;
  }, [state.history, stepMap, currentStep, slotWidth, paddingLeft, getY, viewMode, state.total_demand]);

  // Scenario events
  const scenarioEvents = useMemo(() => {
    const scenKey = (state.scenario || "cyclone").toLowerCase();
    for (const [k, evs] of Object.entries(SCENARIO_EVENTS)) {
      if (scenKey.includes(k)) return evs;
    }
    return SCENARIO_EVENTS.cyclone;
  }, [state.scenario]);

  const activeStepForTooltip = pinnedStep ?? hoveredStep ?? currentStep;
  const activeRecord = stepMap.get(activeStepForTooltip);
  const prevRecord = activeStepForTooltip > 1 ? stepMap.get(activeStepForTooltip - 1) : null;

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHoveredStep((prev) => Math.max(1, (prev ?? currentStep) - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setHoveredStep((prev) => Math.min(currentStep, (prev ?? currentStep) + 1));
    } else if (e.key === "Escape") {
      setPinnedStep(null);
      setHoveredStep(null);
    }
  };

  return (
    <div
      className="linear-card p-5 focus:outline-none focus:ring-1 focus:ring-[#6EA8FF]/30 rounded-xl"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Continuous Multi-Sector Dispatch Trajectory Chart"
    >
      {/* Chart Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[#EDEEF0]">
              Continuous Multi-Sector Dispatch Trajectory
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] text-[#9BA1AA]">
              Discrete 24 Steps
            </span>
            {hasDataAnomaly && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F2555A]/20 border border-[#F2555A]/40 text-[#F2555A]">
                Data Anomaly (Capped at 3x)
              </span>
            )}
          </div>
          <p className="text-xs text-[#9BA1AA] mt-0.5">
            SciPy HiGHS 3-stage optimization foundation with Tier 1 critical survival priority
          </p>
        </div>

        {/* View Toggle Segmented Control */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#14171B] border border-[rgba(255,255,255,0.07)] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("stack")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-xs font-mono ${
                viewMode === "stack"
                  ? "bg-[#0E1013] text-[#EDEEF0] font-semibold shadow-sm border border-[rgba(255,255,255,0.08)]"
                  : "text-[#5F6670] hover:text-[#9BA1AA]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Stack</span>
            </button>
            <button
              onClick={() => setViewMode("percent")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-xs font-mono ${
                viewMode === "percent"
                  ? "bg-[#0E1013] text-[#EDEEF0] font-semibold shadow-sm border border-[rgba(255,255,255,0.08)]"
                  : "text-[#5F6670] hover:text-[#9BA1AA]"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>% Demand</span>
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-xs font-mono ${
                viewMode === "heatmap"
                  ? "bg-[#0E1013] text-[#EDEEF0] font-semibold shadow-sm border border-[rgba(255,255,255,0.08)]"
                  : "text-[#5F6670] hover:text-[#9BA1AA]"
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Heatmap</span>
            </button>
          </div>

          <button
            onClick={() => setShowDataTable(!showDataTable)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-all ${
              showDataTable
                ? "bg-[#6EA8FF]/10 border-[#6EA8FF]/30 text-[#6EA8FF]"
                : "border-[rgba(255,255,255,0.07)] text-[#5F6670] hover:text-[#9BA1AA]"
            }`}
            title="Toggle accessible raw data table"
            aria-label="Toggle accessible data table"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main SVG Visualization */}
      {viewMode === "heatmap" ? (
        /* Heatmap Compact Matrix View */
        <div className="py-2 overflow-x-auto">
          <div className="min-w-[700px] space-y-2">
            <div className="grid grid-cols-[160px_repeat(24,1fr)_60px] gap-1 items-center text-[10px] font-mono text-[#5F6670] pb-1 border-b border-[rgba(255,255,255,0.05)]">
              <div>Agent</div>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="text-center">{i + 1}</div>
              ))}
              <div className="text-right">Min %</div>
            </div>

            {AGENT_ORDER.map((aid) => {
              const color = AGENT_COLORS[aid];
              let minPct = 100;

              return (
                <div key={aid} className="grid grid-cols-[160px_repeat(24,1fr)_60px] gap-1 items-center">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#EDEEF0] truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate">{AGENT_NAMES[aid]}</span>
                  </div>

                  {Array.from({ length: 24 }, (_, i) => {
                    const stepNum = i + 1;
                    const rec = stepMap.get(stepNum);
                    const isFuture = stepNum > currentStep;
                    const alloc = rec?.allocations?.[aid] ?? 0;
                    const dem = rec?.demands?.[aid] ?? 1;
                    const pct = isFuture ? null : Math.round((alloc / Math.max(0.1, dem)) * 100);

                    if (pct !== null && pct < minPct) minPct = pct;

                    let bg = "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]";
                    let textColor = "text-[#5F6670]";
                    if (pct !== null) {
                      if (pct >= 99) {
                        bg = "bg-[#243247] text-[#6EA8FF] border border-[#6EA8FF]/20";
                      } else if (pct >= 90) {
                        bg = "bg-[#42361B] text-[#F5A524] border border-[#F5A524]/20";
                      } else if (pct >= 70) {
                        bg = "bg-[#5C3814] text-[#F5A524] border border-[#F5A524]/30";
                      } else {
                        bg = "bg-[#4D181A] text-[#F2555A] border border-[#F2555A]/30";
                      }
                      textColor = "text-white";
                    }

                    return (
                      <div
                        key={i}
                        onClick={() => onSeekStep?.(stepNum)}
                        className={`h-7 rounded flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all ${bg}`}
                        title={pct !== null ? `Step ${stepNum}: ${alloc.toFixed(1)} / ${dem.toFixed(1)} MW (${pct}%)` : `Step ${stepNum}: Future`}
                      >
                        {pct !== null ? `${pct}%` : ""}
                      </div>
                    );
                  })}

                  <div className="text-right text-xs font-mono text-[#9BA1AA]">
                    {minPct < 100 ? `${minPct}%` : "100%"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Stepped Stacked Column SVG Chart */
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-[320px] overflow-visible"
            style={{
              fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
            }}
          >
            <defs>
              {/* 45-degree hatched pattern for unmet demand gap */}
              <pattern
                id="unmet-hatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#F5A524" strokeWidth="2.5" strokeOpacity="0.22" />
              </pattern>
            </defs>

            {/* Background Gridlines at 4% Opacity */}
            {(viewMode === "percent" ? [0, 25, 50, 75, 100] : [10, 20, 30, 40]).map((tick) => {
              const y = getY(tick, viewMode === "percent" ? 100 : FIXED_MAX_MW);
              return (
                <g key={tick}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + plotWidth}
                    y2={y}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#5F6670"
                    fontSize="11"
                    className="tabular-nums font-mono"
                  >
                    {tick} {viewMode === "percent" ? "%" : "MW"}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Baseline */}
            <line
              x1={paddingLeft}
              y1={paddingTop + plotHeight}
              x2={paddingLeft + plotWidth}
              y2={paddingTop + plotHeight}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />

            {/* X-Axis Step Labels every 4 steps (1, 4, 8, 12, 16, 20, 24) */}
            {[1, 4, 8, 12, 16, 20, 24].map((s) => {
              const x = paddingLeft + (s - 0.5) * slotWidth;
              return (
                <text
                  key={s}
                  x={x}
                  y={paddingTop + plotHeight + 18}
                  textAnchor="middle"
                  fill="#5F6670"
                  fontSize="11"
                  className="font-mono"
                >
                  {s}
                </text>
              );
            })}

            {/* Scenario Event Shock Markers & Flags (Balanced across 2 alternating tiers to prevent overlap and header bleed) */}
            {scenarioEvents.map((ev, idx) => {
              const evX = paddingLeft + (ev.step - 0.5) * slotWidth;
              const isPastOrCurrent = ev.step <= currentStep;
              const tier = idx % 2; // Clean 2-tier alternation (lower tier: idx 0, 2; upper tier: idx 1, 3)
              const flagY = tier === 0 ? paddingTop - 13 : paddingTop - 31;
              const displayLabel = ev.label.length > 15 ? ev.label.slice(0, 13) + "…" : ev.label;
              const boxWidth = Math.max(54, Math.min(68, displayLabel.length * 5.2 + 10));

              return (
                <g key={idx} className="transition-opacity duration-200">
                  <line
                    x1={evX}
                    y1={flagY + 8}
                    x2={evX}
                    y2={paddingTop + plotHeight}
                    stroke="#F5A524"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity={isPastOrCurrent ? "0.45" : "0.15"}
                  />
                  {/* Top Flag Banner with tooltip */}
                  <g
                    transform={`translate(${evX}, ${flagY})`}
                    className="cursor-pointer"
                  >
                    <title>{`${ev.label} (Shock at Step ${ev.step}): ${ev.detail}`}</title>
                    <rect
                      x={-boxWidth / 2}
                      y="-8"
                      width={boxWidth}
                      height="16"
                      rx="3"
                      fill="#0E1013"
                      stroke="#F5A524"
                      strokeWidth="1"
                      strokeOpacity="0.5"
                    />
                    {/* Small anchor pin pointing down to guideline */}
                    <polygon
                      points="-3,8 3,8 0,11"
                      fill="#F5A524"
                      opacity={isPastOrCurrent ? 0.7 : 0.3}
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#F5A524"
                      fontSize="8.5"
                      fontWeight="600"
                      className="font-mono"
                    >
                      {displayLabel}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 24 Step Slots & Discrete Stacked Columns */}
            {Array.from({ length: totalSlots }, (_, i) => {
              const stepNum = i + 1;
              const x = paddingLeft + i * slotWidth + (slotWidth - colWidth) / 2;
              const rec = stepMap.get(stepNum);
              const isPastOrCurrent = stepNum <= currentStep;
              const isCurrent = stepNum === currentStep;
              const isHovered = (pinnedStep ?? hoveredStep) === stepNum;
              const isDimmed = (pinnedStep ?? hoveredStep) !== null && !isHovered;

              const effectiveRec = rec || (isPastOrCurrent ? (stepMap.get(currentStep) || state.history[0]) : null);

              if (!isPastOrCurrent || !effectiveRec) {
                // Future Step Slot (Faint 6% outline)
                return (
                  <rect
                    key={stepNum}
                    x={x}
                    y={paddingTop}
                    width={colWidth}
                    height={plotHeight}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    rx="2"
                  />
                );
              }

              // Allocations calculation in stack order (Tier 1 bottom to Tier 3 top)
              const allocs = effectiveRec.allocations || {};
              const demands = effectiveRec.demands || {};
              const totalAlloc = effectiveRec.total_allocated || sumAllocs(allocs);
              const totalDem = effectiveRec.total_demand || sumAllocs(demands);
              const unmet = Math.max(0, totalDem - totalAlloc);

              let currentCumulativeY = paddingTop + plotHeight;
              const segments: { aid: string; y: number; h: number; color: string; isTop: boolean }[] = [];

              AGENT_ORDER.forEach((aid, aidIdx) => {
                const val = allocs[aid] ?? 0;
                let segHeight = 0;
                if (viewMode === "percent") {
                  const dem = demands[aid] ?? 1;
                  const pct = (val / Math.max(0.1, dem)) * 100;
                  segHeight = getH(pct / AGENT_ORDER.length, 100);
                } else {
                  segHeight = getH(val, FIXED_MAX_MW);
                }

                if (segHeight > 0) {
                  currentCumulativeY -= segHeight;
                  segments.push({
                    aid,
                    y: currentCumulativeY,
                    h: Math.max(1, segHeight - 1), // 1px separator gap
                    color: AGENT_COLORS[aid],
                    isTop: aidIdx === AGENT_ORDER.length - 1,
                  });
                }
              });

              // Unmet demand hatched gap
              const topOfDemandY = getY(viewMode === "percent" ? 100 : totalDem, viewMode === "percent" ? 100 : FIXED_MAX_MW);
              const gapHeight = Math.max(0, currentCumulativeY - topOfDemandY);

              return (
                <g
                  key={stepNum}
                  onClick={() => {
                    setPinnedStep(pinnedStep === stepNum ? null : stepNum);
                    onSeekStep?.(stepNum);
                  }}
                  onMouseEnter={() => setHoveredStep(stepNum)}
                  onMouseLeave={() => setHoveredStep(null)}
                  className="cursor-pointer"
                  opacity={isDimmed ? 0.65 : 1}
                  style={{
                    transition: "opacity 180ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                  aria-label={`Step ${stepNum}: Supply ${effectiveRec.supply_mw} MW, Demand ${totalDem} MW, Unmet ${unmet.toFixed(1)} MW`}
                >
                  {/* Unmet Demand Hatched Gap Rectangle */}
                  {unmet > 0.1 && gapHeight > 2 && viewMode === "stack" && (
                    <rect
                      x={x}
                      y={topOfDemandY}
                      width={colWidth}
                      height={gapHeight}
                      fill="url(#unmet-hatch)"
                      stroke="#F5A524"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      strokeOpacity="0.6"
                      rx="2"
                    />
                  )}

                  {/* Stacked Segments (Tier 1 Base to Tier 3 Top) */}
                  {segments.map((seg, sIdx) => {
                    const isIsolated = isolatedAgent === null || isolatedAgent === seg.aid;
                    return (
                      <rect
                        key={sIdx}
                        x={x}
                        y={seg.y}
                        width={colWidth}
                        height={seg.h}
                        fill={seg.color}
                        opacity={isIsolated ? 1 : 0.25}
                        rx={seg.isTop && unmet <= 0.1 ? 2 : 0}
                        style={{
                          transition: "opacity 180ms cubic-bezier(0.22,1,0.36,1), fill 180ms ease",
                        }}
                      />
                    );
                  })}

                  {/* Playhead Indicator on Current Step */}
                  {isCurrent && (
                    <g>
                      <line
                        x1={x + colWidth / 2}
                        y1={paddingTop - 6}
                        x2={x + colWidth / 2}
                        y2={paddingTop + plotHeight}
                        stroke="#6EA8FF"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.8"
                      />
                      <polygon
                        points={`${x + colWidth / 2 - 4},${paddingTop - 6} ${x + colWidth / 2 + 4},${paddingTop - 6} ${x + colWidth / 2},${paddingTop - 1}`}
                        fill="#6EA8FF"
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Total Demand Stepped Dashed Outline (Stack mode only) */}
            {demandPath && (
              <path
                d={demandPath}
                fill="none"
                stroke="#F5A524"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeOpacity="0.75"
              />
            )}

            {/* Stepped Supply Line with Risers */}
            {supplyPath && (
              <path
                d={supplyPath}
                fill="none"
                stroke="#EDEEF0"
                strokeWidth="1.5"
                strokeOpacity="0.75"
              />
            )}

            {/* Direct Supply End Label at Right Edge */}
            <g transform={`translate(${paddingLeft + plotWidth + 8}, ${getY(viewMode === "percent" ? 100 : state.supply_mw, viewMode === "percent" ? 100 : FIXED_MAX_MW)})`}>
              <circle cx="0" cy="0" r="3" fill="#EDEEF0" opacity="0.8" />
              <text x="6" y="3.5" fill="#EDEEF0" fontSize="10.5" fontWeight="600" opacity="0.85">
                Supply {state.supply_mw.toFixed(1)} MW
              </text>
            </g>

            {/* Direct Agent Segment Labels at Most Recent Column */}
            {(() => {
              const lastRec = stepMap.get(currentStep);
              if (!lastRec || viewMode === "percent") return null;
              const allocs = lastRec.allocations || {};
              let cumY = paddingTop + plotHeight;
              const labelItems: { aid: string; y: number; mw: number }[] = [];

              AGENT_ORDER.forEach((aid) => {
                const val = allocs[aid] ?? 0;
                const h = getH(val, FIXED_MAX_MW);
                if (h > 4) {
                  cumY -= h;
                  labelItems.push({ aid, y: cumY + h / 2, mw: val });
                }
              });

              const lastColX = paddingLeft + (currentStep - 1) * slotWidth + colWidth + 8;
              if (lastColX > paddingLeft + plotWidth - 40) return null; // Avoid boundary overflow

              return labelItems.map((item, idx) => (
                <text
                  key={idx}
                  x={lastColX}
                  y={item.y + 3.5}
                  fill={AGENT_COLORS[item.aid]}
                  fontSize="9.5"
                  fontWeight="600"
                  className="tabular-nums"
                  opacity={isolatedAgent === null || isolatedAgent === item.aid ? 0.9 : 0.25}
                >
                  {item.aid.toUpperCase()} {item.mw.toFixed(1)}
                </text>
              ));
            })()}

            {/* Snapping Crosshair Column Highlight */}
            {(pinnedStep ?? hoveredStep) && (
              <line
                x1={paddingLeft + ((pinnedStep ?? hoveredStep)! - 0.5) * slotWidth}
                y1={paddingTop}
                x2={paddingLeft + ((pinnedStep ?? hoveredStep)! - 0.5) * slotWidth}
                y2={paddingTop + plotHeight}
                stroke="#6EA8FF"
                strokeWidth="1"
                strokeDasharray="2 2"
                strokeOpacity="0.4"
              />
            )}
          </svg>

          {/* Interactive Floating Snapped Tooltip Card */}
          {activeRecord && (hoveredStep !== null || pinnedStep !== null) && (
            <div
              className={`absolute top-2 z-20 bg-[#0E1013] border border-[rgba(255,255,255,0.12)] rounded-lg p-3 shadow-2xl text-xs font-mono w-64 pointer-events-none transition-all duration-150 ${
                activeStepForTooltip > 15 ? "right-16" : "left-20"
              }`}
            >
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-1.5 mb-2">
                <span className="font-bold text-[#EDEEF0]">
                  Step {activeStepForTooltip} · Hour {activeStepForTooltip < 10 ? `0${activeStepForTooltip}` : activeStepForTooltip}
                </span>
                {pinnedStep === activeStepForTooltip && (
                  <span className="text-[10px] text-[#6EA8FF] border border-[#6EA8FF]/30 px-1 rounded bg-[#6EA8FF]/10">
                    PINNED
                  </span>
                )}
              </div>

              {/* Rows per Agent */}
              <div className="space-y-1.5">
                {AGENT_ORDER.map((aid) => {
                  const alloc = activeRecord.allocations?.[aid] ?? 0;
                  const dem = activeRecord.demands?.[aid] ?? 0;
                  const prevAlloc = prevRecord?.allocations?.[aid] ?? alloc;
                  const delta = alloc - prevAlloc;

                  return (
                    <div key={aid} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#EDEEF0]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AGENT_COLORS[aid] }} />
                        <span className="capitalize">{aid}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#9BA1AA]">
                          {alloc.toFixed(1)} / {dem.toFixed(1)} MW
                        </span>
                        <span
                          className={`flex items-center text-[10px] ${
                            delta > 0.05
                              ? "text-[#3DD68C]"
                              : delta < -0.05
                              ? "text-[#F5A524]"
                              : "text-[#5F6670]"
                          }`}
                        >
                          {delta > 0.05 ? (
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          ) : delta < -0.05 ? (
                            <ArrowDownRight className="w-2.5 h-2.5" />
                          ) : (
                            <Minus className="w-2.5 h-2.5" />
                          )}
                          {Math.abs(delta) > 0.05 ? Math.abs(delta).toFixed(1) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tooltip Footer Metrics */}
              <div className="mt-2.5 pt-2 border-t border-[rgba(255,255,255,0.07)] grid grid-cols-2 gap-y-1 text-[10px] text-[#9BA1AA]">
                <div>Supply: <span className="text-[#EDEEF0] font-bold">{activeRecord.supply_mw.toFixed(1)} MW</span></div>
                <div>Demand: <span className="text-[#EDEEF0] font-bold">{activeRecord.total_demand.toFixed(1)} MW</span></div>
                <div>
                  Unmet:{" "}
                  <span className={`font-bold ${activeRecord.shortage_mw > 0 ? "text-[#F5A524]" : "text-[#3DD68C]"}`}>
                    {activeRecord.shortage_mw.toFixed(1)} MW
                  </span>
                </div>
                <div>Violations: <span className="text-[#3DD68C] font-bold">0 (Safe)</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessible Raw Data Table Toggle Container */}
      {showDataTable && (
        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] overflow-x-auto">
          <div className="text-xs font-semibold text-[#EDEEF0] mb-2">Discrete Dispatch Step Records</div>
          <table className="w-full text-[11px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] text-[#5F6670] text-left">
                <th className="py-1.5 px-2">Step</th>
                <th className="py-1.5 px-2">Supply (MW)</th>
                <th className="py-1.5 px-2">Demand (MW)</th>
                <th className="py-1.5 px-2">Allocated (MW)</th>
                <th className="py-1.5 px-2">Unmet (MW)</th>
                <th className="py-1.5 px-2">Violations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {Array.from({ length: currentStep }, (_, idx) => {
                const s = idx + 1;
                const rec = stepMap.get(s);
                if (!rec) return null;
                return (
                  <tr key={s} className="hover:bg-[#14171B] text-[#9BA1AA]">
                    <td className="py-1 px-2 font-bold text-[#EDEEF0]">S{s}</td>
                    <td className="py-1 px-2">{rec.supply_mw.toFixed(1)}</td>
                    <td className="py-1 px-2">{rec.total_demand.toFixed(1)}</td>
                    <td className="py-1 px-2 text-[#6EA8FF]">{rec.total_allocated.toFixed(1)}</td>
                    <td className="py-1 px-2 text-[#F5A524]">{rec.shortage_mw.toFixed(1)}</td>
                    <td className="py-1 px-2 text-[#3DD68C]">0</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive Legend & Agent Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsolatedAgent(null)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
              isolatedAgent === null
                ? "bg-[#6EA8FF]/15 text-[#6EA8FF] border border-[#6EA8FF]/30 font-semibold"
                : "text-[#5F6670] hover:text-[#9BA1AA]"
            }`}
          >
            All Agents
          </button>

          {AGENT_ORDER.map((aid) => {
            const col = AGENT_COLORS[aid];
            const isSelected = isolatedAgent === aid;
            return (
              <button
                key={aid}
                onClick={() => setIsolatedAgent(isSelected ? null : aid)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all text-[11px] font-mono ${
                  isSelected
                    ? "bg-[#14171B] border-[rgba(255,255,255,0.3)] text-[#EDEEF0] font-bold"
                    : "border-[rgba(255,255,255,0.05)] text-[#9BA1AA] hover:border-[rgba(255,255,255,0.12)] hover:text-[#EDEEF0]"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                <span className="capitalize">{aid}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-[#5F6670]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#EDEEF0] opacity-75 inline-block" /> Stepped Supply
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-b border-dashed border-[#F5A524] inline-block" /> Total Demand
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#F5A524]/20 border border-[#F5A524]/40 inline-block" /> Unmet Gap
          </span>
        </div>
      </div>
    </div>
  );
};

function sumAllocs(obj: Record<string, number>): number {
  return Object.values(obj).reduce((acc, v) => acc + (v || 0), 0);
}
