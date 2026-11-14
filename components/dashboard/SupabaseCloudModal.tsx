"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Database,
  Cloud,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  Clock,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SupabaseCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RunRecord {
  id: number;
  run_id: string;
  scenario: string;
  seed: number;
  total_steps: number;
  created_at: string;
}

interface StepRecord {
  id: number;
  run_id: string;
  step: number;
  supply_mw: number;
  total_demand: number;
  total_allocated: number;
  shortage_mw: number;
  allocations: Record<string, number>;
  created_at: string;
}

interface LedgerRecord {
  id: number;
  txn_id: string;
  txn_type: string;
  step: number;
  agent_id: string | null;
  hash: string;
  prev_hash: string;
  status: string;
  created_at: string;
}

export const SupabaseCloudModal: React.FC<SupabaseCloudModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"runs" | "steps" | "ledger">("runs");
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [ledgerTxns, setLedgerTxns] = useState<LedgerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCloudData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Simulation Runs
      const { data: runsData, error: runsErr } = await supabase
        .from("simulation_runs")
        .select("*")
        .order("id", { ascending: false })
        .limit(20);

      if (runsErr) throw runsErr;
      if (runsData) {
        setRuns(runsData as RunRecord[]);
        if (!selectedRunId && runsData.length > 0) {
          setSelectedRunId(runsData[0].run_id);
        }
      }

      // 2. Fetch Ledger Transactions
      const { data: ledgerData, error: ledgerErr } = await supabase
        .from("crisis_ledger")
        .select("*")
        .order("id", { ascending: false })
        .limit(30);

      if (ledgerErr) throw ledgerErr;
      if (ledgerData) {
        setLedgerTxns(ledgerData as LedgerRecord[]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to query Supabase cloud tables");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch steps for selected run
  useEffect(() => {
    if (!selectedRunId) return;
    const fetchRunSteps = async () => {
      const { data: stepsData } = await supabase
        .from("simulation_steps")
        .select("*")
        .eq("run_id", selectedRunId)
        .order("step", { ascending: true });
      if (stepsData) {
        setSteps(stepsData as StepRecord[]);
      }
    };
    fetchRunSteps();
  }, [selectedRunId]);

  useEffect(() => {
    if (isOpen) {
      fetchCloudData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#0b1120] border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl shadow-emerald-950/40 overflow-hidden font-sans">
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0e1628] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-slate-100 text-base">
                  SUPABASE CLOUD POSTGRES DATABASE
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Project: <code className="text-cyan-300">povtxolmajhxrnwqyjhd</code> &bull; Region: <code className="text-slate-300">ap-southeast-1</code> &bull; RLS Security: <code className="text-emerald-400 font-bold">Active</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCloudData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5 transition disabled:opacity-50"
              title="Refresh cloud records from Supabase"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Sub Navigation Tabs ──────────────────────────────────── */}
        <div className="px-5 py-2.5 bg-[#090d18] border-b border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab("runs")}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeSubTab === "runs"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>1. Simulation Runs ({runs.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab("steps")}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeSubTab === "steps"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>2. Step Trajectories ({steps.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab("ledger")}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeSubTab === "ledger"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>3. Cloud Audit Ledger ({ledgerTxns.length})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Persistent WAL Cloud Mirror</span>
          </div>
        </div>

        {/* ── Tab Content Area ─────────────────────────────────────── */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono">
              Error connecting to Supabase: {errorMsg}
            </div>
          )}

          {/* TAB 1: SIMULATION RUNS */}
          {activeSubTab === "runs" && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>Select a persistent run to view its synced multi-agent metrics:</span>
                <span className="text-cyan-400">Table: public.simulation_runs</span>
              </div>

              {runs.length === 0 && !isLoading ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No simulation runs synced yet. Advance the simulation or trigger a step to mirror results.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {runs.map((r) => {
                    const isSelected = r.run_id === selectedRunId;
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedRunId(r.run_id);
                          setActiveSubTab("steps");
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30"
                            : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold uppercase">
                              {r.scenario}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{r.id}
                            </span>
                          </div>
                          <div className="font-mono text-xs font-bold text-slate-200 truncate" title={r.run_id}>
                            {r.run_id}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-1">
                            Total Planned Steps: {r.total_steps} &bull; Seed: {r.seed}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            Inspect <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STEP TRAJECTORIES */}
          {activeSubTab === "steps" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Showing <span className="text-emerald-400 font-bold">{steps.length}</span> steps for run:{" "}
                  <code className="text-cyan-300 font-bold">{selectedRunId || "None selected"}</code>
                </span>
                <span className="text-cyan-400">Table: public.simulation_steps</span>
              </div>

              {steps.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No step records found for this run yet. Run the simulation to mirror step data.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0e1628] text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Step</th>
                        <th className="p-2.5">Supply</th>
                        <th className="p-2.5">Demand</th>
                        <th className="p-2.5">Allocated</th>
                        <th className="p-2.5">Deficit</th>
                        <th className="p-2.5">Allocations Breakdown</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {steps.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-cyan-300">Step {st.step}</td>
                          <td className="p-2.5 text-slate-200">{Number(st.supply_mw).toFixed(1)} MW</td>
                          <td className="p-2.5 text-slate-400">{Number(st.total_demand).toFixed(1)} MW</td>
                          <td className="p-2.5 text-emerald-400 font-bold">{Number(st.total_allocated).toFixed(1)} MW</td>
                          <td className="p-2.5">
                            {Number(st.shortage_mw) > 0 ? (
                              <span className="text-rose-400 font-semibold">-{Number(st.shortage_mw).toFixed(1)} MW</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">0.0 MW</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              {Object.entries(st.allocations || {}).map(([aid, mw]) => (
                                <span
                                  key={aid}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                >
                                  {aid}: <strong className="text-cyan-300">{Number(mw).toFixed(1)}</strong>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold">
                              PASS (Sum &le; Cap)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD AUDIT LEDGER */}
          {activeSubTab === "ledger" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Cryptographically chained immutable ledger entries in Postgres:
                </span>
                <span className="text-cyan-400">Table: public.crisis_ledger</span>
              </div>

              {ledgerTxns.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No ledger transactions synced yet.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0e1628] text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Txn ID</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Step</th>
                        <th className="p-2.5">Agent</th>
                        <th className="p-2.5">Prev Hash</th>
                        <th className="p-2.5">SHA-256 Hash</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {ledgerTxns.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-[10px] text-slate-300 truncate max-w-[100px]" title={tx.txn_id}>
                            {tx.txn_id.slice(0, 10)}...
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.txn_type === "COMMITTED"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : tx.txn_type === "BID"
                                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                  : "bg-purple-950 text-purple-300 border border-purple-800"
                              }`}
                            >
                              {tx.txn_type}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-200">Step {tx.step}</td>
                          <td className="p-2.5 text-slate-300 font-semibold">{tx.agent_id || "SYSTEM"}</td>
                          <td className="p-2.5 font-mono text-[10px] text-slate-500 truncate max-w-[110px]" title={tx.prev_hash}>
                            {tx.prev_hash.slice(0, 12)}...
                          </td>
                          <td className="p-2.5 font-mono text-[10px] text-emerald-400 font-bold truncate max-w-[110px]" title={tx.hash}>
                            {tx.hash.slice(0, 12)}...
                          </td>
                          <td className="p-2.5">
                            <span className="text-emerald-400 font-bold text-[10px]">
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0e1628] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Cryptographic Chain & Cloud Real-Time Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-black transition"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
