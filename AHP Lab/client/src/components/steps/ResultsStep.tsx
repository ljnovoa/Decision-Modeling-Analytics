/**
 * ResultsStep.tsx
 * Design: Precision Dashboard — teal/slate/amber
 *
 * AHP Steps 3, 4 & 5:
 *   Step 3 — Local Weight Estimation (shown per matrix)
 *   Step 4 — Global Weight Consolidation (alternatives ranking)
 *   Step 5 — Analysis: Consistency summary + Sensitivity analysis
 *
 * Fix: scroll to top on mount, correct step ordering, hierarchy view
 *      shows local weights for criteria and global weights for alternatives.
 */

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useAHP } from "@/contexts/AHPContext";
import { computeAHP, CR_THRESHOLD } from "@/lib/ahp";
import HierarchyTree from "@/components/HierarchyTree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, LineChart, Line,
  ReferenceLine, Legend,
} from "recharts";
import {
  ChevronLeft, Download, Trophy, AlertTriangle,
  CheckCircle2, RotateCcw, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { exportAHPtoPDF } from "@/lib/exportPDF";
import CalcTutorialModal from "@/components/CalcTutorialModal";

// ─── Color palette ────────────────────────────────────────────────────────────
const PALETTE = [
  "#0D9488", "#1D4ED8", "#059669", "#7C3AED",
  "#D97706", "#DC2626", "#0891B2", "#BE185D",
];

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, nameMap }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-700 mb-1">
          {typeof label === "number" ? `${(label * 100).toFixed(0)}%` : label}
        </p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-mono">
            {nameMap ? (nameMap[p.dataKey] ?? p.name) : p.name}: {(p.value * 100).toFixed(2)}%
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function makeSensitivityTooltip(altNames: Record<string, string>) {
  return function SensitivityTooltipInner({ active, payload, label }: any) {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
          <p className="font-semibold text-slate-700 mb-1">
            {typeof label === "number" ? `Weight: ${(label * 100).toFixed(0)}%` : label}
          </p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }} className="font-mono">
              {altNames[p.dataKey] ?? p.dataKey}: {(p.value * 100).toFixed(2)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
function WeightChart({
  title, subtitle, data, colorOffset = 0,
}: {
  title: string; subtitle?: string;
  data: { name: string; weight: number }[];
  colorOffset?: number;
}) {
  const sorted = [...data].sort((a, b) => b.weight - a.weight);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={Math.max(140, sorted.length * 46)}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "#94A3B8" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              type="category" dataKey="name" width={96}
              tick={{ fontSize: 11, fontFamily: "DM Sans, sans-serif", fill: "#475569", fontWeight: 600 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {sorted.map((_, i) => (
                <Cell key={i} fill={PALETTE[(i + colorOffset) % PALETTE.length]} />
              ))}
              <LabelList
                dataKey="weight"
                position="right"
                formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "#475569" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sensitivity Analysis ─────────────────────────────────────────────────────
function SensitivityAnalysis({
  nodes, matrices, criteriaIds, criteriaNames, altIds, altNames, baseCriteriaWeights,
}: {
  nodes: any[]; matrices: any[]; criteriaIds: string[]; criteriaNames: Record<string, string>;
  altIds: string[]; altNames: Record<string, string>; baseCriteriaWeights: Record<string, number>;
}) {
  const [selectedCrit, setSelectedCrit] = useState(criteriaIds[0] ?? "");

  const altColors: Record<string, string> = {};
  altIds.forEach((id, i) => { altColors[id] = PALETTE[i % PALETTE.length]; });

  const sensitivityData = useMemo(() => {
    if (!selectedCrit || criteriaIds.length === 0) return [];
    const steps = 21;
    const result: any[] = [];

    for (let s = 0; s <= steps; s++) {
      const newWeight = s / steps;
      const remaining = 1 - newWeight;
      const otherTotal = criteriaIds
        .filter((id) => id !== selectedCrit)
        .reduce((sum, id) => sum + (baseCriteriaWeights[id] ?? 0), 0);

      const adjustedWeights: Record<string, number> = {};
      for (const id of criteriaIds) {
        if (id === selectedCrit) {
          adjustedWeights[id] = newWeight;
        } else {
          const base = baseCriteriaWeights[id] ?? 0;
          adjustedWeights[id] = otherTotal > 0 ? (base / otherTotal) * remaining : remaining / (criteriaIds.length - 1);
        }
      }

      const point: any = { weight: newWeight };
      for (const altId of altIds) {
        let globalW = 0;
        for (const critId of criteriaIds) {
          const m = matrices.find((mx: any) => mx.parentId === critId && mx.comparisonType === "preference");
          if (!m) continue;
          const n = m.nodeIds.length;
          if (n === 0) continue;
          const colSums = Array(n).fill(0);
          for (let j = 0; j < n; j++)
            for (let ii = 0; ii < n; ii++)
              colSums[j] += m.values[m.nodeIds[ii]]?.[m.nodeIds[j]] ?? 1;
          const weights = m.nodeIds.map((_: any, ii: number) => {
            const row = m.nodeIds.map((_2: any, j: number) =>
              (m.values[m.nodeIds[ii]]?.[m.nodeIds[j]] ?? 1) / colSums[j]
            );
            return row.reduce((a: number, b: number) => a + b, 0) / n;
          });
          const idx = m.nodeIds.indexOf(altId);
          if (idx >= 0) globalW += adjustedWeights[critId] * weights[idx];
        }
        point[altId] = globalW;
      }
      result.push(point);
    }
    return result;
  }, [selectedCrit, criteriaIds, altIds, matrices, baseCriteriaWeights]);

  if (criteriaIds.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
        No leaf criteria available for sensitivity analysis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
        <Activity size={14} className="shrink-0 mt-0.5" />
        <span>
          <strong>One-at-a-time sensitivity:</strong> the selected criterion's weight is varied from 0% to 100%.
          All other criteria weights are redistributed proportionally so they always sum to 1.
          This shows how robust the ranking is to changes in that criterion's importance.
        </span>
      </div>

      {/* Criterion selector */}
      <div className="flex flex-wrap gap-2">
        {criteriaIds.map((id) => (
          <button
            key={id}
            onClick={() => setSelectedCrit(id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              selectedCrit === id
                ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
            )}
          >
            {criteriaNames[id] ?? id}
          </button>
        ))}
      </div>

      {/* Line chart */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">
            Sensitivity to <span className="text-teal-700">{criteriaNames[selectedCrit]}</span> weight
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Global weights of alternatives as the criterion weight varies
          </p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sensitivityData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="weight"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", fill: "#94A3B8" }}
                axisLine={false} tickLine={false}
                label={{ value: `${criteriaNames[selectedCrit]} weight (%)`, position: "insideBottomRight", offset: 0, dy: 36, fontSize: 10, fill: "#64748B" }}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 9, fontFamily: "JetBrains Mono, monospace", fill: "#94A3B8" }}
                axisLine={false} tickLine={false}
                domain={[0, 1]}
              />
              <Tooltip content={(() => { const T = makeSensitivityTooltip(altNames); return <T />; })()} />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans, sans-serif", paddingTop: 4 }}
                formatter={(value) => altNames[value] ?? value}
              />
              {altIds.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={id}
                  stroke={altColors[id]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
              <ReferenceLine
                x={baseCriteriaWeights[selectedCrit] ?? 0}
                stroke="#94A3B8"
                strokeDasharray="4 2"
                label={{ value: "Current", position: "top", fontSize: 9, fill: "#94A3B8" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Consistency Summary ──────────────────────────────────────────────────────
function ConsistencySummary({
  crs, nameMap, matrices,
}: {
  crs: Record<string, number>; nameMap: Record<string, string>; matrices: any[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Consistency Analysis</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Saaty recommends CR ≤ 10%. Values above this threshold suggest the judgments may need revision.
            </p>
          </div>
          <div className="shrink-0">
            <CalcTutorialModal />
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {Object.entries(crs).map(([parentId, cr]) => {
          const ok = cr <= CR_THRESHOLD;
          const m = matrices.find((mx: any) => mx.parentId === parentId);
          const label = nameMap[parentId] ?? parentId;
          const typeLabel = m?.comparisonType === "preference" ? "Preference matrix" : "Importance matrix";
          return (
            <div key={parentId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                {ok ? (
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-slate-700 text-sm">{label}</p>
                  <p className="text-xs text-slate-400">{typeLabel}</p>
                </div>
              </div>
              <Badge
                className={cn(
                  "font-mono text-xs",
                  ok
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                )}
              >
                CR = {(cr * 100).toFixed(2)}%
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultsStep() {
  const { state, dispatch } = useAHP();
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Scroll to top when results step mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const results = useMemo(() => {
    const ahpNodes = [
      { id: "objective", parentId: null, type: "objective" as const, level: 0 },
      ...state.nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        type: n.type,
        level: n.level,
      })),
    ];
    return computeAHP(ahpNodes, state.matrices);
  }, [state.nodes, state.matrices]);

  const handleExportPDF = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportAHPtoPDF(
        state.objective,
        state.nodes,
        state.matrices,
        results
      );
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [exporting, state.objective, state.nodes, state.matrices, results]);

  useEffect(() => {
    dispatch({
      type: "SET_RESULTS",
      localWeights: results.localWeights,
      globalWeights: results.globalWeights,
      consistencyRatios: results.consistencyRatios,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameMap: Record<string, string> = { objective: state.objective };
  for (const n of state.nodes) nameMap[n.id] = n.name;

  const alternatives = state.nodes.filter((n) => n.type === "alternative");
  const topCriteria = state.nodes.filter(
    (n) => n.type === "criterion" && n.parentId === null
  );
  const leafCriteria = state.nodes.filter(
    (n) =>
      n.type === "criterion" &&
      !state.nodes.some((c) => c.type === "criterion" && c.parentId === n.id)
  );

  const altData = alternatives
    .map((a) => ({ name: a.name, weight: results.globalWeights[a.id] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);

  const critData = topCriteria.map((c) => ({
    name: c.name,
    weight: results.localWeights[c.id] ?? 0,
  }));

  const winner = altData[0];
  const hasWarnings = Object.values(results.consistencyRatios).some((cr) => cr > CR_THRESHOLD);

  // For sensitivity: use leaf criteria global weights
  const leafCriteriaWeights: Record<string, number> = {};
  for (const lc of leafCriteria) {
    leafCriteriaWeights[lc.id] = results.globalWeights[lc.id] ?? 0;
  }

  // Collect all criteria sorted by level for ordered display
  const allCriteria = state.nodes.filter((n) => n.type === "criterion");

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Step header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
            Steps 3, 4 &amp; 5
          </span>
          <h2 className="font-bold text-slate-800 text-xl mt-0.5">
            Weight Estimation, Consolidation &amp; Analysis
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Local weights estimated via Saaty's eigenvector method. Global weights
            consolidated by weighted sum. Consistency and sensitivity analysis below.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            className="border-slate-200 text-slate-600"
            onClick={() => dispatch({ type: "GO_TO_STEP", step: "matrices" })}
          >
            <ChevronLeft size={14} className="mr-1" /> Back
          </Button>
          <Button
            size="sm" className="bg-teal-600 hover:bg-teal-700 min-w-[110px]"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating…</>
            ) : (
              <><Download size={14} className="mr-1.5" /> Export PDF</>
            )}
          </Button>
        </div>
      </div>

      {/* Consistency warnings banner */}
      {hasWarnings && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            One or more matrices have CR &gt; 10%. Results are displayed, but consider
            revisiting those judgments for greater reliability.
          </span>
        </div>
      )}

      {/* Winner banner */}
      {winner && (
        <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-5 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Trophy size={22} className="text-yellow-300" />
          </div>
          <div>
            <p className="text-teal-100 text-xs font-semibold uppercase tracking-wide">
              Recommended Alternative
            </p>
            <p className="font-bold text-2xl mt-0.5">{winner.name}</p>
            <p className="text-teal-200 text-sm font-mono mt-0.5">
              Global weight: {(winner.weight * 100).toFixed(2)}%
            </p>
          </div>
          <div className="ml-auto hidden sm:flex flex-col items-end gap-1">
            {altData.map((a, i) => (
              <div key={a.name} className="flex items-center gap-2 text-xs">
                <span className="text-teal-200">#{i + 1}</span>
                <span className={i === 0 ? "font-bold text-white" : "text-teal-200"}>
                  {a.name}
                </span>
                <span className="font-mono text-teal-100">
                  {(a.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Results / Sensitivity / Consistency / Hierarchy */}
      <Tabs defaultValue="results">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="results" className="text-xs font-semibold">
            Results &amp; Weights
          </TabsTrigger>
          <TabsTrigger value="sensitivity" className="text-xs font-semibold">
            Sensitivity Analysis
          </TabsTrigger>
          <TabsTrigger value="consistency" className="text-xs font-semibold">
            Consistency
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="text-xs font-semibold">
            Hierarchy View
          </TabsTrigger>
        </TabsList>

        {/* ── Results Tab ── */}
        <TabsContent value="results" className="space-y-5 mt-4">

          {/* Step 3a — Criteria weights (top level) */}
          {critData.length > 0 && (
            <WeightChart
              title="Step 3 — Criteria Weights (relative to Objective)"
              subtitle="Local weights estimated from the importance comparison matrix"
              data={critData}
              colorOffset={2}
            />
          )}

          {/* Step 3b — Sub-criteria weights at each level */}
          {allCriteria.map((c, i) => {
            const subs = state.nodes.filter(
              (n) => n.type === "criterion" && n.parentId === c.id
            );
            if (subs.length === 0) return null;
            return (
              <WeightChart
                key={c.id}
                title={`Step 3 — Sub-criteria of "${c.name}" (local weights)`}
                subtitle={`Local weights relative to "${c.name}"`}
                data={subs.map((s) => ({
                  name: s.name,
                  weight: results.localWeights[s.id] ?? 0,
                }))}
                colorOffset={4 + i * 2}
              />
            );
          })}

          {/* Step 3c — Local alternative weights per leaf criterion */}
          {leafCriteria.map((lc, i) => {
            const m = state.matrices.find(
              (mx) => mx.parentId === lc.id && mx.comparisonType === "preference"
            );
            if (!m) return null;
            return (
              <WeightChart
                key={lc.id}
                title={`Step 3 — Alternative Weights relative to "${lc.name}" (local)`}
                subtitle="Local preference weights for this criterion"
                data={alternatives.map((a) => ({
                  name: a.name,
                  weight: (() => {
                    const n = m.nodeIds.length;
                    if (n === 0) return 0;
                    const colSums = Array(n).fill(0);
                    for (let j = 0; j < n; j++)
                      for (let ii = 0; ii < n; ii++)
                        colSums[j] += m.values[m.nodeIds[ii]]?.[m.nodeIds[j]] ?? 1;
                    const weights = m.nodeIds.map((_: any, ii: number) => {
                      const row = m.nodeIds.map((_2: any, j: number) =>
                        (m.values[m.nodeIds[ii]]?.[m.nodeIds[j]] ?? 1) / colSums[j]
                      );
                      return row.reduce((a: number, b: number) => a + b, 0) / n;
                    });
                    const idx = m.nodeIds.indexOf(a.id);
                    return idx >= 0 ? weights[idx] : 0;
                  })(),
                }))}
                colorOffset={6 + i * 2}
              />
            );
          })}

          {/* Step 4 — Global alternative weights */}
          {altData.length > 0 && (
            <WeightChart
              title="Step 4 — Global Priority of Alternatives"
              subtitle="Consolidated global weights (weighted sum across all criteria)"
              data={altData}
              colorOffset={0}
            />
          )}

          {/* Detailed weight table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">
                Complete Weight Table
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Local weights are relative to the parent node; global weights are relative to the overall objective.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                      Node
                    </th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                      Type
                    </th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wide font-mono">
                      Local Weight
                    </th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold text-xs uppercase tracking-wide font-mono">
                      Global Weight
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {state.nodes.map((node) => (
                    <tr
                      key={node.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        <span style={{ paddingLeft: (node.level - 1) * 16 }}>
                          {node.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            node.type === "alternative"
                              ? "bg-emerald-100 text-emerald-700"
                              : node.level === 1
                              ? "bg-blue-100 text-blue-700"
                              : "bg-sky-100 text-sky-700"
                          )}
                        >
                          {node.type === "alternative"
                            ? "Alternative"
                            : node.level === 1
                            ? "Criterion"
                            : `Sub-criterion (L${node.level})`}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 text-xs">
                        {node.type !== "alternative" && results.localWeights[node.id] !== undefined
                          ? (results.localWeights[node.id] * 100).toFixed(3) + "%"
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-teal-700 font-semibold text-xs">
                        {results.globalWeights[node.id] !== undefined
                          ? (results.globalWeights[node.id] * 100).toFixed(3) + "%"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Sensitivity Tab ── */}
        <TabsContent value="sensitivity" className="mt-4">
          <SensitivityAnalysis
            nodes={state.nodes}
            matrices={state.matrices}
            criteriaIds={leafCriteria.map((c) => c.id)}
            criteriaNames={nameMap}
            altIds={alternatives.map((a) => a.id)}
            altNames={nameMap}
            baseCriteriaWeights={leafCriteriaWeights}
          />
        </TabsContent>

        {/* ── Consistency Tab ── */}
        <TabsContent value="consistency" className="mt-4">
          <ConsistencySummary
            crs={results.consistencyRatios}
            nameMap={nameMap}
            matrices={state.matrices}
          />
        </TabsContent>

        {/* ── Hierarchy Tab ── */}
        <TabsContent value="hierarchy" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">
                Hierarchy with Weights
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Criteria &amp; sub-criteria show <strong>local weights</strong> (relative to parent).
                Alternatives show <strong>global weights</strong> (relative to objective).
              </p>
            </div>
            <div className="p-2 min-h-64 overflow-auto">
              <HierarchyTree
                showWeights
                globalWeights={results.globalWeights}
                localWeights={results.localWeights}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Start over */}
      <div className="flex justify-center pt-2 border-t border-slate-100">
        <Button
          variant="outline"
          className="border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200"
          onClick={() => {
            if (
              confirm(
                "Start a new AHP analysis? All current data will be cleared."
              )
            ) {
              dispatch({ type: "RESET" });
            }
          }}
        >
          <RotateCcw size={14} className="mr-1.5" /> Start New Analysis
        </Button>
      </div>
    </div>
  );
}
