/**
 * Home.tsx
 * Design: Precision Dashboard — teal/slate/amber, DM Sans + JetBrains Mono
 *
 * Layout: sticky top nav with 5-step methodology progress indicator,
 * 50-50 split panel (workspace left, live hierarchy right).
 *
 * Step mapping to methodology:
 *   "structuring" → Step 1: Problem Structuring
 *   "matrices"    → Steps 2 & 3: Comparison Matrices + Local Weight Estimation
 *   "results"     → Steps 3, 4 & 5: Consolidation + Analysis
 *
 * Navigation guard rules:
 *   Structure  — always clickable
 *   Compare    — clickable if matrices have been initialised (matrices.length > 0)
 *   Results    — clickable only if all matrices are complete AND results exist
 */

import { useAHP } from "@/contexts/AHPContext";
import HierarchyStep from "@/components/steps/HierarchyStep";
import ComparisonStep from "@/components/steps/ComparisonStep";
import ResultsStep from "@/components/steps/ResultsStep";
import HierarchyTree from "@/components/HierarchyTree";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Network, CheckCircle2, Circle, RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ahpToast } from "@/lib/toast";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "structuring" as const,
    label: "Problem Structuring",
    short: "Structure",
    step: "1",
  },
  {
    id: "matrices" as const,
    label: "Matrices & Local Weights",
    short: "Compare",
    step: "2–3",
  },
  {
    id: "results" as const,
    label: "Consolidation & Analysis",
    short: "Results",
    step: "4–5",
  },
];

type StepId = (typeof STEPS)[number]["id"];

// ─── Step indicator (clickable with guards) ───────────────────────────────────

interface StepIndicatorProps {
  current: StepId;
  canGoTo: (id: StepId) => boolean;
  lockedReason: (id: StepId) => string | null;
  onNavigate: (id: StepId) => void;
}

function StepIndicator({ current, canGoTo, lockedReason, onNavigate }: StepIndicatorProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const accessible = canGoTo(step.id);
        const reason = lockedReason(step.id);

        const pill = (
          <button
            onClick={() => {
              if (!accessible) {
                if (reason) ahpToast.warning(reason);
                return;
              }
              if (step.id !== current) onNavigate(step.id);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
              active && "bg-teal-600 text-white shadow-sm",
              done && accessible && !active && "text-teal-700 hover:bg-teal-50 cursor-pointer",
              done && !accessible && !active && "text-teal-700 opacity-60 cursor-not-allowed",
              !active && !done && accessible && "text-slate-500 hover:bg-slate-100 cursor-pointer",
              !active && !done && !accessible && "text-slate-300 cursor-not-allowed"
            )}
            title={reason ?? undefined}
            aria-disabled={!accessible}
          >
            {done ? (
              <CheckCircle2 size={13} className="text-teal-600 shrink-0" />
            ) : !accessible ? (
              <Lock size={12} className="shrink-0 opacity-60" />
            ) : (
              <Circle
                size={13}
                className={active ? "text-white shrink-0" : "text-slate-300 shrink-0"}
              />
            )}
            <span className="hidden md:inline">{step.label}</span>
            <span className="md:hidden">{step.short}</span>
            <span
              className={cn(
                "text-[10px] font-mono hidden sm:inline",
                active ? "text-teal-200" : done ? "text-teal-500" : "text-slate-300"
              )}
            >
              ({step.step})
            </span>
          </button>
        );

        return (
          <div key={step.id} className="flex items-center">
            {reason && !accessible ? (
              <Tooltip>
                <TooltipTrigger asChild>{pill}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-56 text-xs">
                  {reason}
                </TooltipContent>
              </Tooltip>
            ) : (
              pill
            )}
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-6 h-px mx-0.5",
                  idx < currentIdx ? "bg-teal-400" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export default function Home() {
  const { state, dispatch, allMatricesComplete } = useAHP();
  const [resetOpen, setResetOpen] = useState(false);
  const showSplit = state.step !== "results";

  // ── Navigation guard logic ──────────────────────────────────────────────────
  // Structure: always accessible
  // Compare:   accessible if matrices have been initialised (user proceeded past Step 1)
  // Results:   accessible only if all matrices are complete AND results have been computed

  const hasMatrices = state.matrices.length > 0;
  const hasResults = state.step === "results" || Object.keys(state.globalWeights).length > 0;
  const matricesComplete = allMatricesComplete();

  function canGoTo(id: StepId): boolean {
    if (id === "structuring") return true;
    if (id === "matrices") return hasMatrices;
    if (id === "results") return matricesComplete && hasResults;
    return false;
  }

  function lockedReason(id: StepId): string | null {
    if (id === "structuring") return null;
    if (id === "matrices") {
      if (!hasMatrices)
        return "Complete Step 1 (Problem Structuring) first to unlock the comparison matrices.";
      return null;
    }
    if (id === "results") {
      if (!hasMatrices)
        return "Complete Step 1 first, then fill in all comparison matrices.";
      if (!matricesComplete)
        return "All comparison matrices must be fully filled before viewing results.";
      if (!hasResults)
        return "Run the calculation from the Matrices step to generate results.";
      return null;
    }
    return null;
  }

  function handleNavigate(id: StepId) {
    dispatch({ type: "GO_TO_STEP", step: id });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top Navigation ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-md">
              <Network size={24} className="text-white" />
            </div>
            <div className="leading-none hidden sm:block">
              <span
                className="block font-extrabold text-3xl tracking-tight"
                style={{
                  fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
                  background: "linear-gradient(90deg, #0f766e 0%, #0d9488 50%, #1d4ed8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                AHP Decision Tool
              </span>
              <span
                className="block text-sm font-semibold text-slate-500 mt-0.5"
                style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif" }}
              >
                Analytic Hierarchy Process
              </span>
              <span
                className="block text-xs text-slate-400 mt-0.5"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Designed by Luis Novoa &amp; built using Manus · for educational purposes
              </span>
            </div>
          </div>

          {/* Step indicator */}
          <StepIndicator
            current={state.step}
            canGoTo={canGoTo}
            lockedReason={lockedReason}
            onNavigate={handleNavigate}
          />

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
            onClick={() => setResetOpen(true)}
            title="Start over"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline ml-1.5 text-xs">Reset</span>
          </Button>

          {/* Reset confirmation dialog */}
          <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                  AHP Tool — Designed by Luis Novoa &amp; built using Manus
                </div>
                <AlertDialogTitle className="text-slate-800">
                  Start a new analysis?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500">
                  This will clear all current data — objective, criteria, alternatives, and all comparison matrices. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-slate-600">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    dispatch({ type: "RESET" });
                    setResetOpen(false);
                  }}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6">
        {showSplit ? (
          /* 50-50 split layout for structuring and matrices steps */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* ── Left: Active Step Workspace ── */}
            <div className="min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                {state.step === "structuring" && <HierarchyStep />}
                {state.step === "matrices" && <ComparisonStep />}
              </div>
            </div>

            {/* ── Right: Live Hierarchy Tree (always visible, 50%) ── */}
            <div className="min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-20">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-700 text-sm">
                    Live Hierarchy
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Updates as you define your model
                  </p>
                </div>
                <div
                  className="overflow-auto"
                  style={{ minHeight: "400px", maxHeight: "calc(100vh - 14rem)" }}
                >
                  <HierarchyTree />
                </div>

                {/* Legend */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Legend
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { color: "bg-teal-600", label: "Objective" },
                      { color: "bg-blue-700", label: "Criterion" },
                      { color: "bg-blue-400", label: "Sub-criterion" },
                      { color: "bg-emerald-600", label: "Alternative" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-2.5 h-2.5 rounded-sm shrink-0",
                            item.color
                          )}
                        />
                        <span className="text-xs text-slate-500">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full-width layout for results */
          <ResultsStep />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-3">
        <p className="text-center text-xs text-slate-400">
          AHP Decision Tool · Based on Saaty (1980) · For educational use ·
          Consistency threshold: CR ≤ 10%
        </p>
      </footer>
    </div>
  );
}
