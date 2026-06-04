/**
 * ComparisonStep.tsx
 * Design: Precision Dashboard — teal/slate/amber
 *
 * AHP Step 2: Construction of Comparison Matrices
 * AHP Step 3: Estimation of Local Weights (shown live as CR feedback)
 *
 * Adapts scale reference and cell language based on comparison type:
 *   "importance"  — criteria relative to parent criterion/objective
 *   "preference"  — alternatives relative to a criterion
 *
 * Matrix cell input: horizontal chip row (1/9 … 1 … 9) instead of dropdown.
 * Matrix headers: short label (≤15 chars) with full description as tooltip.
 */

import { useState, useMemo } from "react";
import { useAHP } from "@/contexts/AHPContext";
import {
  analyzeMatrix,
  IMPORTANCE_SCALE,
  PREFERENCE_SCALE,
  CR_THRESHOLD,
} from "@/lib/ahp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Scale,
  Star,
} from "lucide-react";
import { ahpToast } from "@/lib/toast";
import CalcTutorialModal from "@/components/CalcTutorialModal";
import { cn } from "@/lib/utils";

// ─── Saaty Scale Reference Panel ─────────────────────────────────────────────

function SaatyReference({
  comparisonType,
}: {
  comparisonType: "importance" | "preference";
}) {
  const [open, setOpen] = useState(true);
  const scale =
    comparisonType === "importance" ? IMPORTANCE_SCALE : PREFERENCE_SCALE;
  const isImportance = comparisonType === "importance";

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-700"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {isImportance ? (
            <Scale size={14} className="text-blue-600" />
          ) : (
            <Star size={14} className="text-emerald-600" />
          )}
          <span>
            {isImportance
              ? "Importance Scale (Criteria)"
              : "Preference / Performance Scale (Alternatives)"}
          </span>
        </div>
        <span className="text-slate-400 text-xs">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="p-3 space-y-0.5">
          {/* A / B legend */}
          <div className="mb-3 pb-2.5 border-b border-slate-100 text-xs text-slate-500 space-y-0.5">
            <p>
              <span className="font-bold text-slate-700">A</span>
              {" = "}
              {isImportance ? "criterion in the row" : "alternative in the row"}
            </p>
            <p>
              <span className="font-bold text-slate-700">B</span>
              {" = "}
              {isImportance ? "criterion in the column" : "alternative in the column"}
            </p>
          </div>
          {/* Positive direction */}
          {scale.map((s) => (
            <div
              key={s.value}
              className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0"
            >
              <span className="font-mono font-bold text-teal-700 w-6 text-right text-sm shrink-0">
                {s.value}
              </span>
              <span className="text-slate-600 text-xs pl-1">{s.description}</span>
            </div>
          ))}
          {/* Reciprocals */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            {[...scale].reverse().slice(1).map((s) => (
              <div
                key={`r-${s.value}`}
                className="flex items-center gap-3 py-1 border-b border-slate-50 last:border-0"
              >
                <span className="font-mono font-bold text-slate-400 w-6 text-right text-sm shrink-0">
                  1/{s.value}
                </span>
                <span className="text-slate-400 text-xs pl-1">
                  {s.description.replace("A is", "B is").replace("than B", "than A")}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 pt-1 border-t border-slate-100">
            Intermediate values (2, 4, 6, 8) represent judgments between the
            main levels.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Chip Row Cell Input ───────────────────────────────────────────────────────
// Shows the current value in the cell; clicking opens a Popover with a
// horizontal scrollable chip row for all 17 Saaty values.

interface CellInputProps {
  value: number;
  rowName: string;
  colName: string;
  rowFullName?: string;
  colFullName?: string;
  comparisonType: "importance" | "preference";
  onChange: (v: number) => void;
}

function CellInput({
  value,
  rowName,
  colName,
  rowFullName,
  colFullName,
  comparisonType,
  onChange,
}: CellInputProps) {
  const [open, setOpen] = useState(false);
  const scale =
    comparisonType === "importance" ? IMPORTANCE_SCALE : PREFERENCE_SCALE;

  // Always use the short name for scale descriptions
  const rowLabel = rowName;
  const colLabel = colName;

  // Build full option list: 1/9, 1/8, …, 1/2, 1, 2, …, 8, 9
  // Replace generic A/B with the actual row/column names
  const options: { value: number; label: string; desc: string }[] = [];
  for (const s of scale.filter((s) => s.value !== 1)) {
    options.push({
      value: 1 / s.value,
      label: `1/${s.value}`,
      desc: s.description
        .replace(/\bA\b/g, colLabel)
        .replace(/\bB\b/g, rowLabel),
    });
  }
  options.push({
    value: 1,
    label: "1",
    desc: scale.find((s) => s.value === 1)!.description
      .replace(/\bA\b/g, rowLabel)
      .replace(/\bB\b/g, colLabel),
  });
  for (const s of [...scale].reverse().filter((s) => s.value !== 1)) {
    options.push({
      value: s.value,
      label: `${s.value}`,
      desc: s.description
        .replace(/\bA\b/g, rowLabel)
        .replace(/\bB\b/g, colLabel),
    });
  }

  const displayVal =
    value === 0
      ? "—"
      : value < 1
      ? `1/${Math.round(1 / value)}`
      : `${value}`;

  const selectedDesc =
    value === 0
      ? "Select a value"
      : options.find((o) => Math.abs(o.value - value) < 0.001)?.desc ?? "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-16 h-9 rounded border text-xs font-mono font-semibold text-center cursor-pointer transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
            "active:scale-95",
            value === 0
              ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
          )}
          title={`${rowFullName ?? rowName} vs ${colFullName ?? colName}`}
        >
          {displayVal}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={6}
        className="p-2 w-auto max-w-[min(480px,90vw)]"
      >
        {/* Header */}
        <p className="text-[10px] text-slate-500 mb-2 px-0.5">
          <span className="font-semibold text-slate-700">{rowFullName ?? rowName}</span>
          {" vs "}
          <span className="font-semibold text-slate-700">{colFullName ?? colName}</span>
        </p>
        {/* Chip row */}
        <ScrollArea type="scroll" className="w-full">
          <div className="flex gap-1 pb-1">
            {options.map((opt) => {
              const selected = value !== 0 && Math.abs(opt.value - value) < 0.001;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    "shrink-0 h-8 w-9 rounded text-[11px] font-mono font-semibold transition-all select-none",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                    "active:scale-95",
                    selected
                      ? "bg-teal-600 text-white shadow-sm ring-1 ring-teal-700"
                      : "bg-slate-100 text-slate-700 hover:bg-teal-100 hover:text-teal-800 border border-slate-200"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {/* Description of selected value */}
        {value !== 0 && (
          <p className="text-[10px] text-slate-500 mt-2 px-0.5 italic">{selectedDesc}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Pairwise Matrix Panel ────────────────────────────────────────────────────

interface MatrixPanelProps {
  parentId: string;
  parentName: string;
  nodeIds: string[];
  nodeNames: Record<string, string>;
  nodeFullNames: Record<string, string>;
  comparisonType: "importance" | "preference";
  matrixIndex: number;
  totalMatrices: number;
}

function PairwiseMatrixPanel({
  parentId,
  parentName,
  nodeIds,
  nodeNames,
  nodeFullNames,
  comparisonType,
  matrixIndex,
  totalMatrices,
}: MatrixPanelProps) {
  const { state, dispatch, isMatrixComplete } = useAHP();
  const matrix = state.matrices.find((m) => m.parentId === parentId);
  if (!matrix) return null;

  const complete = isMatrixComplete(parentId);
  const { cr, ci, lmax } = useMemo(() => {
    if (!complete) return { cr: null, ci: null, lmax: null };
    return analyzeMatrix(matrix.nodeIds, matrix.values);
  }, [matrix, complete]);

  const crBad = cr !== null && cr > CR_THRESHOLD;
  const n = nodeIds.length;
  const isImportance = comparisonType === "importance";

  return (
    <div
      className={cn(
        "rounded-xl border-2 overflow-hidden",
        crBad
          ? "border-amber-300"
          : complete
          ? "border-emerald-200"
          : "border-slate-200"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 flex items-start justify-between gap-3",
          crBad ? "bg-amber-50" : complete ? "bg-emerald-50" : "bg-slate-50"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn(
                "text-xs shrink-0",
                isImportance
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
              )}
            >
              {isImportance ? (
                <Scale size={10} className="mr-1" />
              ) : (
                <Star size={10} className="mr-1" />
              )}
              {isImportance ? "Importance" : "Preference"}
            </Badge>
            <span className="text-xs text-slate-400">
              Matrix {matrixIndex + 1} of {totalMatrices}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isImportance ? (
              <>
                Comparing{" "}
                <strong className="text-slate-700">
                  {n} {n === 1 ? "criterion" : "criteria"}
                </strong>{" "}
                with respect to{" "}
                <strong className="text-slate-700">{parentName}</strong>
              </>
            ) : (
              <>
                Comparing{" "}
                <strong className="text-slate-700">
                  {n} alternatives
                </strong>{" "}
                with respect to criterion{" "}
                <strong className="text-slate-700">{parentName}</strong>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0">
          {complete && cr !== null ? (
            <Badge
              className={cn(
                "font-mono text-xs",
                crBad
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
              )}
            >
              {crBad ? (
                <AlertTriangle size={11} className="mr-1" />
              ) : (
                <CheckCircle2 size={11} className="mr-1" />
              )}
              CR = {(cr * 100).toFixed(1)}%
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
              Incomplete
            </Badge>
          )}
        </div>
      </div>

      {/* Matrix table — horizontally scrollable */}
      <div className="p-4 overflow-x-auto bg-white">
        <table className="border-collapse text-xs table-fixed">
          <colgroup>
            {/* Row-label column */}
            <col style={{ width: "7rem" }} />
            {/* Data columns — all identical width */}
            {nodeIds.map((id) => (
              <col key={id} style={{ width: "4.5rem" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {/* Row-label column header (empty) */}
              <th className="pb-2 pr-3" />
              {nodeIds.map((id) => (
                <th key={id} className="pb-2 px-1 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="block text-slate-600 font-semibold truncate text-center text-xs cursor-default"
                      >
                        {nodeNames[id]}
                      </span>
                    </TooltipTrigger>
                    {nodeFullNames[id] && (
                      <TooltipContent side="top" className="text-xs max-w-48">
                        {nodeFullNames[id]}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodeIds.map((rowId, i) => (
              <tr key={rowId} className="border-t border-slate-100">
                {/* Row label */}
                <td className="text-right pr-3 py-2 text-slate-700 font-semibold">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate cursor-default">
                        {nodeNames[rowId]}
                      </span>
                    </TooltipTrigger>
                    {nodeFullNames[rowId] && (
                      <TooltipContent side="left" className="text-xs max-w-48">
                        {nodeFullNames[rowId]}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </td>
                {nodeIds.map((colId, j) => {
                  const val = matrix.values[rowId]?.[colId] ?? 0;
                  const isDiag = i === j;
                  const isLower = i > j;

                  return (
                    <td key={colId} className="py-2 px-1 text-center">
                      {isDiag ? (
                        // Diagonal — always 1
                        <div className="h-9 flex items-center justify-center bg-slate-200 rounded text-slate-500 font-mono text-xs font-bold border border-slate-300">
                          1
                        </div>
                      ) : isLower ? (
                        // Lower triangle — auto-filled reciprocal
                        <div className="h-9 flex items-center justify-center bg-slate-50 rounded text-slate-400 text-xs font-mono border border-slate-100">
                          {val > 0
                            ? val < 1
                              ? `1/${Math.round(1 / val)}`
                              : val
                            : "—"}
                        </div>
                      ) : (
                        // Upper triangle — chip row
                        <CellInput
                          value={val}
                          rowName={nodeNames[rowId]}
                          colName={nodeNames[colId]}
                          rowFullName={nodeFullNames[rowId]}
                          colFullName={nodeFullNames[colId]}
                          comparisonType={comparisonType}
                          onChange={(v) =>
                            dispatch({
                              type: "SET_MATRIX_VALUE",
                              parentId,
                              idA: rowId,
                              idB: colId,
                              value: v,
                            })
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CR feedback */}
      {complete && cr !== null && (
        <div
          className={cn(
            "px-4 py-2.5 border-t text-xs flex items-start gap-2",
            crBad
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          )}
        >
          {crBad ? (
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
          )}
          <span>
            {crBad
              ? `Consistency Ratio CR = ${(cr * 100).toFixed(1)}% exceeds the 10% threshold recommended by Saaty. Consider revising your judgments to improve consistency.`
              : `Consistency is acceptable — CR = ${(cr * 100).toFixed(1)}% ≤ 10%. (λ_max = ${lmax?.toFixed(4)}, CI = ${ci?.toFixed(4)}, n = ${n})`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComparisonStep() {
  const { state, dispatch, allMatricesComplete } = useAHP();

  // Short labels for matrix headers
  const nameMap: Record<string, string> = { objective: state.objective };
  // Full names (descriptions) for tooltips
  const fullNameMap: Record<string, string> = {};

  for (const n of state.nodes) {
    nameMap[n.id] = n.name;
    if (n.description) fullNameMap[n.id] = n.description;
  }

  // Sort: importance matrices first (top-down), then preference matrices
  const orderedMatrices = useMemo(() => {
    const importance = state.matrices
      .filter((m) => m.comparisonType === "importance")
      .sort((a, b) => {
        const la =
          a.parentId === "objective"
            ? -1
            : (state.nodes.find((n) => n.id === a.parentId)?.level ?? 99);
        const lb =
          b.parentId === "objective"
            ? -1
            : (state.nodes.find((n) => n.id === b.parentId)?.level ?? 99);
        return la - lb;
      });
    const preference = state.matrices.filter(
      (m) => m.comparisonType === "preference"
    );
    return [...importance, ...preference];
  }, [state.matrices, state.nodes]);

  const complete = allMatricesComplete();
  const completedCount = orderedMatrices.filter((m) => {
    for (const a of m.nodeIds)
      for (const b of m.nodeIds)
        if (a !== b && (!m.values[a]?.[b] || m.values[a][b] === 0))
          return false;
    return true;
  }).length;

  const importanceMatrices = orderedMatrices.filter(
    (m) => m.comparisonType === "importance"
  );
  const preferenceMatrices = orderedMatrices.filter(
    (m) => m.comparisonType === "preference"
  );

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
            Steps 2 &amp; 3
          </span>
        </div>
        <h2 className="font-bold text-slate-800 text-xl">
          Comparison Matrices &amp; Local Weight Estimation
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Click a value in the chip row for each upper-triangle cell. The lower
          triangle is filled automatically as the reciprocal. Hover any header
          to see the full name. Consistency Ratio (CR) updates live.
        </p>
        <div className="mt-3">
          <CalcTutorialModal />
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{
              width: `${orderedMatrices.length > 0 ? (completedCount / orderedMatrices.length) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="text-xs font-mono text-slate-500 shrink-0">
          {completedCount}/{orderedMatrices.length} matrices complete
        </span>
      </div>

      {/* Importance matrices section */}
      {importanceMatrices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 text-sm">
              Importance Comparisons — Criteria
            </h3>
          </div>
          <SaatyReference comparisonType="importance" />
          {importanceMatrices.map((m, idx) => (
            <PairwiseMatrixPanel
              key={m.parentId}
              parentId={m.parentId}
              parentName={nameMap[m.parentId] ?? m.parentId}
              nodeIds={m.nodeIds}
              nodeNames={nameMap}
              nodeFullNames={fullNameMap}
              comparisonType="importance"
              matrixIndex={idx}
              totalMatrices={importanceMatrices.length}
            />
          ))}
        </div>
      )}

      {/* Preference matrices section */}
      {preferenceMatrices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-700 text-sm">
              Preference / Performance Comparisons — Alternatives
            </h3>
          </div>
          <SaatyReference comparisonType="preference" />
          {preferenceMatrices.map((m, idx) => (
            <PairwiseMatrixPanel
              key={m.parentId}
              parentId={m.parentId}
              parentName={nameMap[m.parentId] ?? m.parentId}
              nodeIds={m.nodeIds}
              nodeNames={nameMap}
              nodeFullNames={fullNameMap}
              comparisonType="preference"
              matrixIndex={idx}
              totalMatrices={preferenceMatrices.length}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <Button
          variant="outline"
          onClick={() => dispatch({ type: "GO_TO_STEP", step: "structuring" })}
          className="border-slate-200 text-slate-600"
        >
          <ChevronLeft size={15} className="mr-1" /> Back to Problem Structuring
        </Button>

        <Button
          className={cn(
            "font-semibold",
            complete
              ? "bg-teal-600 hover:bg-teal-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
          disabled={!complete}
          onClick={() => {
            if (!complete) {
              ahpToast.error("Please complete all pairwise matrices first");
              return;
            }
            dispatch({ type: "GO_TO_STEP", step: "results" });
          }}
        >
          <BarChart3 size={15} className="mr-1.5" />
          Calculate &amp; View Results{" "}
          <ChevronRight size={15} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
