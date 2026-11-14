"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Check,
  Zap,
  AlertTriangle,
  Wind,
  Hospital,
  Droplets,
  Radio,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

export interface ScenarioItem {
  id: string;
  label: string;
}

interface ScenarioMeta {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  subline: string;
  mw?: string;
}

const SCENARIO_METADATA: Record<string, ScenarioMeta> = {
  normal: { category: "Baseline", icon: Zap, subline: "Nominal operational state", mw: "35 MW" },
  grid_failure: { category: "Grid", icon: AlertTriangle, subline: "Substation trip (-40%)", mw: "18 MW" },
  cyclone: { category: "Grid", icon: Wind, subline: "Storm surges & feeder loss", mw: "24.5 MW" },
  hospital_generator_failure: { category: "Infrastructure", icon: Hospital, subline: "Trauma ICU surge", mw: "28 MW" },
  water_shortage: { category: "Infrastructure", icon: Droplets, subline: "Intake pump pressure drop", mw: "24 MW" },
  telecom_failure: { category: "Infrastructure", icon: Radio, subline: "Cellular repeater outage", mw: "26 MW" },
  recovery: { category: "Recovery", icon: RotateCcw, subline: "Auxiliary generator restoration", mw: "33 MW" },
  cheater_under_scarcity: { category: "Adversarial", icon: ShieldAlert, subline: "Strategic overbidding attack", mw: "22 MW" },
};

interface ScenarioDropdownProps {
  scenarios: ScenarioItem[];
  selectedId: string;
  onSelect: (scenarioId: string) => void;
  disabled?: boolean;
}

export const ScenarioDropdown: React.FC<ScenarioDropdownProps> = ({
  scenarios,
  selectedId,
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [flashBorder, setFlashBorder] = useState(false);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute trigger rect for portal positioning
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen]);

  const selectedScenario = scenarios.find((s) => s.id === selectedId) || scenarios[0];
  const selectedCleanName = selectedScenario?.label?.replace(/\s*\([^)]*\)/, "") || selectedScenario?.id;

  // Group scenarios by category
  const grouped = scenarios.reduce<Record<string, ScenarioItem[]>>((acc, sc) => {
    const meta = SCENARIO_METADATA[sc.id];
    const cat = meta ? meta.category : "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(sc);
    return acc;
  }, {});

  const flattenedScenarios = Object.values(grouped).flat();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (scId: string) => {
    if (scId === selectedId) {
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    setFlashBorder(true);
    onSelect(scId);
    setIsOpen(false);

    setTimeout(() => {
      setIsLoading(false);
    }, 450);

    setTimeout(() => {
      setFlashBorder(false);
    }, 400);

    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
        const idx = flattenedScenarios.findIndex((s) => s.id === selectedId);
        setActiveIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flattenedScenarios.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flattenedScenarios.length) % flattenedScenarios.length);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(flattenedScenarios.length - 1);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flattenedScenarios.length) {
        handleSelect(flattenedScenarios[activeIndex].id);
      }
      return;
    }

    // Type-ahead match
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const char = e.key.toLowerCase();
      const matchIdx = flattenedScenarios.findIndex((s) => s.label.toLowerCase().startsWith(char));
      if (matchIdx >= 0) {
        setActiveIndex(matchIdx);
      }
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* TRIGGER BUTTON (Closed State) */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `scenario-opt-${flattenedScenarios[activeIndex]?.id}` : undefined
        }
        disabled={disabled || isLoading}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            const idx = flattenedScenarios.findIndex((s) => s.id === selectedId);
            setActiveIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`h-9 px-3 rounded-lg bg-[#0E1013] border text-xs font-medium flex items-center gap-2 select-none cursor-pointer transition-all duration-200 outline-none relative overflow-hidden focus-visible:ring-2 focus-visible:ring-[#6EA8FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090B] ${
          flashBorder
            ? "border-[#6EA8FF] shadow-[0_0_12px_rgba(110,168,255,0.25)]"
            : isOpen
            ? "border-[rgba(255,255,255,0.18)] bg-[#14171B]"
            : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)]"
        } ${disabled || isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span className="text-[#5F6670] font-sans text-xs">Scenario</span>
        <span className="text-[#EDEEF0] font-medium max-w-[200px] truncate font-sans">
          {selectedCleanName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#9BA1AA] transition-transform duration-200 ml-0.5 shrink-0 ${
            isOpen ? "rotate-180 text-[#EDEEF0]" : ""
          }`}
        />

        {/* Loading Progress Line */}
        {isLoading && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6EA8FF] animate-pulse" />
        )}
      </button>

      {/* PORTAL PANEL (Open State) */}
      {mounted &&
        isOpen &&
        createPortal(
          <>
            {/* Dim Backdrop for Mobile < 640px */}
            <div
              className="fixed inset-0 z-50 sm:hidden bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              style={{
                top: `${coords.top}px`,
                right: `${coords.right}px`,
              }}
              className="fixed z-50 w-[340px] max-h-[360px] bg-[#14171B] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.55)] p-1.5 overflow-y-auto text-[#EDEEF0] outline-none animate-in fade-in zoom-in-95 duration-150 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-h-[75vh]"
            >
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[#5F6670]">
                    {category}
                  </div>

                  <div className="space-y-0.5">
                    {items.map((sc) => {
                      const isSelected = sc.id === selectedId;
                      const globalIdx = flattenedScenarios.findIndex((s) => s.id === sc.id);
                      const isKeyActive = activeIndex === globalIdx;
                      const meta = SCENARIO_METADATA[sc.id];
                      const Icon = meta ? meta.icon : Zap;
                      const cleanName = sc.label.replace(/\s*\([^)]*\)/, "");

                      return (
                        <div
                          key={sc.id}
                          id={`scenario-opt-${sc.id}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(sc.id)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={`h-10 px-2.5 rounded-lg flex items-center justify-between text-xs cursor-pointer select-none transition-all duration-120 relative ${
                            isSelected
                              ? "bg-[#6EA8FF]/10 text-[#EDEEF0]"
                              : isKeyActive
                              ? "bg-[rgba(255,255,255,0.05)] text-[#EDEEF0]"
                              : "text-[#9BA1AA] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#EDEEF0]"
                          } max-sm:h-12`}
                        >
                          {/* Accent Left Indicator Bar for Selected */}
                          {isSelected && (
                            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#6EA8FF] rounded-r" />
                          )}

                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isSelected ? "text-[#6EA8FF]" : isKeyActive ? "text-[#EDEEF0]" : "text-[#9BA1AA]"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-xs truncate leading-tight">
                                {cleanName}
                              </div>
                              {meta?.subline && (
                                <div className="text-[11px] text-[#5F6670] truncate leading-tight">
                                  {meta.subline}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {meta?.mw && (
                              <span className="font-mono text-[11px] text-[#5F6670]">
                                {meta.mw}
                              </span>
                            )}
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#6EA8FF] shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
