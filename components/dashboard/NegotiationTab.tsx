"use client";

import React from "react";
import { FullSimulationState } from "@/lib/types";
import { NegotiationFloor } from "./NegotiationFloor";

interface NegotiationTabProps {
  state: FullSimulationState;
  onToggleCheater: (agentId: string, isCheater: boolean) => void;
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean) => void;
  speed?: number;
  onStep?: (steps?: number) => void;
  onReset?: () => void;
}

export const NegotiationTab: React.FC<NegotiationTabProps> = (props) => {
  return <NegotiationFloor {...props} />;
};
