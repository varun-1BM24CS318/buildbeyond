"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  GitBranch,
  ShieldCheck,
  Radio,
  Droplets,
  HeartPulse,
  Siren,
  Home,
  Info,
} from "lucide-react";
import { FullSimulationState } from "@/lib/types";

interface CascadeTabProps {
  state: FullSimulationState;
}

const NODES = [
  { id: "water", name: "Water Treatment", type: "upstream", kappa: "0.85 to Hospital", x: 100, y: 100, icon: Droplets },
  { id: "telecom", name: "Telecom Network", type: "upstream", kappa: "0.70 to Emergency", x: 100, y: 220, icon: Radio },
  { id: "hospital", name: "Hospital Trauma ICU", type: "dependent", kappa: "Sensitive to Water", x: 320, y: 80, icon: HeartPulse },
  { id: "emergency", name: "First Responders", type: "dependent", kappa: "Sensitive to Telecom", x: 320, y: 160, icon: Siren },
  { id: "residential", name: "Residential Feeder", type: "dependent", kappa: "Rotational Shed", x: 320, y: 240, icon: Home },
];

export const CascadeTab: React.FC<CascadeTabProps> = ({ state }) => {
  const [selectedNode, setSelectedNode] = useState<string>("water");

  const activeAgent = state.agents[selectedNode] || state.agents.water;
  const waterSvc = Math.round((state.agents.water?.satisfaction_ratio ?? 1) * 100);
  const telecomSvc = Math.round((state.agents.telecom?.satisfaction_ratio ?? 1) * 100);

  const damageData = state.history.map((h) => ({
    step: `S${h.step}`,
    direct: Math.round(Object.values(h.damages || {}).reduce((a, b) => a + b, 0)),
    cascade: Math.round(Object.values(h.cascade_damages || {}).reduce((a, b) => a + b, 0)),
  }));

  return (
    <div className="space-y-6 text-[#EDEEF0]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(255,255,255,0.07)]">
        <div>
          <h2 className="text-base font-semibold text-[#EDEEF0]">
            Inter-Sector Cascade Failure Topology
          </h2>
          <p className="text-xs text-[#9BA1AA] mt-0.5">
            Directed acyclic dependency graph: models physical couplings and secondary collapse propagation
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#9BA1AA]">Cascade Status:</span>
          <span className="text-[#3DD68C] px-2 py-0.5 rounded bg-[#3DD68C]/10 border border-[#3DD68C]/20">
            Stage B Mitigated
          </span>
        </div>
      </div>

      {/* Main Grid: DAG (8 cols) + Detail Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SVG Directed Graph */}
        <div className="lg:col-span-8 linear-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-[#9BA1AA] mb-2">
            <span>Upstream Infrastructure (Left)</span>
            <span>Coupled Dependents (Right)</span>
          </div>

          <div className="w-full flex items-center justify-center py-4">
            <svg viewBox="0 0 440 320" className="w-full max-w-[480px]">
              {/* Edges from Upstream to Dependents */}
              <line x1="130" y1="100" x2="290" y2="80" stroke="#6EA8FF" strokeWidth="1.5" strokeDasharray="3 3" opacity={waterSvc < 80 ? 0.2 : 0.6} />
              <line x1="130" y1="220" x2="290" y2="160" stroke="#B388FF" strokeWidth="1.5" strokeDasharray="3 3" opacity={telecomSvc < 80 ? 0.2 : 0.6} />
              <line x1="130" y1="100" x2="290" y2="160" stroke="#6EA8FF" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />

              {/* Render Nodes */}
              {NODES.map((node) => {
                const ag = state.agents[node.id] || { allocation: 5, demand: 5, satisfaction_ratio: 1 };
                const pct = Math.round((ag.satisfaction_ratio || 1) * 100);
                const isSelected = selectedNode === node.id;
                const statusColor = pct >= 90 ? "#3DD68C" : pct >= 60 ? "#F5A524" : "#F2555A";

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node.id)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="22"
                      fill="#0E1013"
                      stroke={isSelected ? "#EDEEF0" : statusColor}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="26"
                      fill="none"
                      stroke={statusColor}
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      opacity="0.8"
                    />
                    <text x={node.x} y={node.y + 3} textAnchor="middle" fill="#EDEEF0" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      {pct}%
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 38}
                      textAnchor="middle"
                      fill={isSelected ? "#EDEEF0" : "#9BA1AA"}
                      fontSize="9"
                      fontWeight="500"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#5F6670] pt-3 border-t border-[rgba(255,255,255,0.07)]">
            <span>Water to Hospital Chiller Coupling: κ = 0.85</span>
            <span>Telecom to Dispatch Coupling: κ = 0.70</span>
          </div>
        </div>

        {/* Selected Node Detail Panel */}
        <div className="lg:col-span-4 linear-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs">
              <span className="font-semibold text-[#EDEEF0]">{activeAgent.name}</span>
              <span className="font-mono text-[11px] text-[#6EA8FF]">{activeAgent.criticality}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#08090B] border border-[rgba(255,255,255,0.05)] space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-[#9BA1AA]">Current Allocation:</span>
                  <span className="text-[#EDEEF0] font-bold">{activeAgent.allocation} MW</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[#9BA1AA]">True Need:</span>
                  <span className="text-[#EDEEF0]">{activeAgent.demand} MW</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[#9BA1AA]">Survival Threshold:</span>
                  <span className="text-[#3DD68C]">{activeAgent.minimum_mw} MW</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[#9BA1AA]">Deficit:</span>
                  <span className={activeAgent.deficit > 0 ? "text-[#F5A524]" : "text-[#5F6670]"}>
                    {activeAgent.deficit} MW
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#5F6670] block mb-1">
                  Cascade Consequence Analysis:
                </span>
                <p className="text-xs text-[#9BA1AA] leading-relaxed">
                  {selectedNode === "water"
                    ? "If Water Treatment falls below 1.5 MW, hydraulic pressure collapses across the sector, tripping hospital HVAC steam loops within 1 crisis step."
                    : selectedNode === "telecom"
                    ? "If Telecom drops below 0.8 MW, first responder vehicle telemetry is blinded, degrading search-and-rescue response efficacy by 70%."
                    : selectedNode === "hospital"
                    ? "Tier 1 anchor. Protected by Stage A LP hard constraints. Minimum 2.0 MW survival threshold is non-negotiable."
                    : "Secondary utility circuit. Absorbs flexible shedding to insulate Tier 1 life support nodes."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.07)] text-[11px] font-mono text-[#5F6670]">
            Sensitivity parameter: κ = 0.85
          </div>
        </div>
      </div>

      {/* Bottom: Damage Trajectory Chart */}
      <div className="linear-card p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[rgba(255,255,255,0.07)] text-xs">
          <div>
            <h3 className="font-semibold text-sm text-[#EDEEF0]">
              Damage Trajectory (Direct vs Cascade Damage)
            </h3>
            <p className="text-xs text-[#9BA1AA] mt-0.5">
              Comparison of raw unserved energy damage vs secondary structural cascade losses
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#3DD68C]">
            Cascade Loss Prevented: 94.2%
          </span>
        </div>

        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <AreaChart data={damageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tick={{ fill: "#5F6670", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5F6670", fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#0E1013] border border-[rgba(255,255,255,0.1)] rounded-lg p-2.5 shadow-xl text-xs font-mono">
                        <div className="text-[#9BA1AA] mb-1">{label}</div>
                        <div className="text-[#6EA8FF]">Direct Damage: {payload[0]?.value}</div>
                        <div className="text-[#F5A524]">Cascade Loss: {payload[1]?.value}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="direct" name="Direct Damage" stroke="#6EA8FF" strokeWidth={1.5} fill="#6EA8FF" fillOpacity={0.06} />
              <Area type="monotone" dataKey="cascade" name="Cascade Loss" stroke="#F5A524" strokeWidth={1.5} fill="#F5A524" fillOpacity={0.06} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
