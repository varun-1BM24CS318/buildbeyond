/**
 * Types & Data Models for Crisis Resource Allocation System
 */

export type CriticalityTier = "L1_SURVIVAL" | "L2_CONTINUITY" | "L3_QUALITY_OF_LIFE";

export interface AgentStatus {
  id: string;
  name: string;
  type: string;
  criticality: CriticalityTier;
  allocation: number;
  demand: number;
  minimum_mw: number;
  satisfaction_ratio: number;
  health_pct: number;
  deficit: number;
  cascade_degradation: number;
  effective_service: number;
  vcg_payment: number;
  reputation_trust: number;
  is_cheater: boolean;
  status: "Satisfied" | "Degraded" | "Critical" | "Failed";
  explanation?: string;
  ai_thought?: string;
  ai_strategy?: string;
  rounds?: {
    round: number;
    bid_mw: number;
    concession_mw: number;
    speech?: string;
    strategy?: string;
    is_ai_generated?: boolean;
  }[];
}

export interface SimulationStepRecord {
  step: number;
  supply_mw: number;
  total_demand: number;
  total_allocated: number;
  shortage_mw: number;
  allocations: Record<string, number>;
  demands: Record<string, number>;
  minimums: Record<string, number>;
  damages: Record<string, number>;
  cascade_damages: Record<string, number>;
  service_levels: Record<string, number>;
  solve_time_ms: number;
  violations: number;
}

export interface EnvironmentState {
  step: number;
  env_version: number;
  supply_mw: number;
  base_supply_mw: number;
  temperature_c: number;
  wind_speed_kmh: number;
  flood_level_m: number;
  is_scarcity: boolean;
  active_events: {
    event_type: string;
    magnitude: number;
    target_agent?: string;
    description: string;
    duration: number;
  }[];
}

export interface FullSimulationState {
  step: number;
  total_steps: number;
  scenario: string;
  seed: number;
  supply_mw: number;
  total_demand: number;
  total_allocated: number;
  shortage_mw: number;
  capacity_violations: number;
  survival_rate: number;
  health_score: number;
  severity: "NORMAL" | "MODERATE" | "HIGH" | "CRITICAL";
  active_constraints: number;
  binding_constraints: string[];
  agents: Record<string, AgentStatus>;
  history: SimulationStepRecord[];
  alerts: {
    id: string;
    timestamp: string;
    type: "info" | "warning" | "error" | "success";
    message: string;
  }[];
  is_running: boolean;
  tick_interval: number;
  is_backend_connected: boolean;
}

export interface BenchmarkComparison {
  metrics: {
    metric: string;
    proportional: string | number;
    strict_priority: string | number;
    proposed: string | number;
    oracle: string | number;
    unit: string;
  }[];
  optimality_gap_pct: number;
  jains_fairness: {
    proportional: number;
    strict_priority: number;
    proposed: number;
    oracle: number;
  };
  cumulative_damage: {
    step: number;
    proportional: number;
    strict_priority: number;
    proposed: number;
    oracle: number;
  }[];
}

export interface StrategyProofnessReport {
  is_strategy_proof: boolean;
  total_lies_tested: number;
  best_gain: number;
  best_lying_agent: string;
  summary: string;
  sample_deviations: {
    agent: string;
    demand_multiplier: number;
    value_multiplier: number;
    allocation: number;
    payment: number;
    true_utility: number;
    net_utility: number;
    honest_utility: number;
    net_gain: number;
  }[];
}

export interface DirectorParsedEvent {
  event_type: string;
  step: number;
  magnitude: number;
  target_agent?: string;
  description: string;
  duration?: number;
}
