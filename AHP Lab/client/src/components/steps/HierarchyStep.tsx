/**
 * HierarchyStep.tsx
 * Design: Precision Dashboard — teal/slate/amber
 *
 * AHP Step 1: Problem Structuring
 * - Define the global goal (objective)
 * - Define criteria at each level (unlimited depth)
 * - Define alternatives
 *
 * Name inputs enforce a 15-character hard limit with a live counter.
 * The description field holds the full name shown as tooltip in matrices.
 *
 * Sub-criteria: the inline AddForm appears IMMEDIATELY BELOW the parent row
 * (not at the bottom of the list) so the hierarchy context is always clear.
 */

import { useState } from "react";
import { useAHP } from "@/contexts/AHPContext";
import type { AHPNode } from "@/contexts/AHPContext";
import { CLASS_EXAMPLE } from "@/lib/classExample";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Target,
  Layers,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  Pencil,
  BookOpen,
  FlaskConical,
} from "lucide-react";
import { ahpToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LABEL = 15;

// ─── Char Counter ─────────────────────────────────────────────────────────────

function CharCounter({ current, max }: { current: number; max: number }) {
  const remaining = max - current;
  return (
    <span
      className={cn(
        "text-[10px] font-mono tabular-nums select-none",
        remaining <= 3 ? "text-red-500 font-bold" : remaining <= 6 ? "text-amber-500" : "text-slate-400"
      )}
    >
      {current}/{max}
    </span>
  );
}

// ─── Inline Add Form ──────────────────────────────────────────────────────────

interface AddFormProps {
  nodeType: "criterion" | "alternative";
  parentLabel?: string;
  placeholder: string;
  onAdd: (name: string, description: string) => void;
  onCancel: () => void;
}

function AddForm({ nodeType, parentLabel, placeholder, onAdd, onCancel }: AddFormProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const isAlt = nodeType === "alternative";

  const submit = () => {
    if (!name.trim()) { ahpToast.error("Please enter a name"); return; }
    onAdd(name.trim().slice(0, MAX_LABEL), desc.trim());
  };

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 space-y-3 mb-3",
      isAlt ? "border-emerald-200 bg-emerald-50/40" : "border-blue-200 bg-blue-50/40"
    )}>
      {parentLabel && (
        <p className="text-xs text-slate-500">
          Adding sub-criterion under: <strong className="text-slate-700">{parentLabel}</strong>
        </p>
      )}

      {/* Name input with char counter */}
      <div className="space-y-1">
        <div className="relative">
          <Input
            autoFocus
            placeholder={placeholder}
            value={name}
            maxLength={MAX_LABEL}
            onChange={(e) => setName(e.target.value.slice(0, MAX_LABEL))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
            className="bg-white pr-12"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <CharCounter current={name.length} max={MAX_LABEL} />
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Short label (≤ {MAX_LABEL} chars) — used in matrix headers. Use the description below for the full name.
        </p>
      </div>

      <Textarea
        placeholder="Optional: full name or description (shown as tooltip in matrices)…"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="bg-white text-sm resize-none"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className={isAlt ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-700 hover:bg-blue-800"}
          onClick={submit}
        >
          <Plus size={13} className="mr-1" /> Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Alternatives List with Inline Rename ────────────────────────────────────

function AlternativesList({
  alternatives,
  onDelete,
}: {
  alternatives: AHPNode[];
  onDelete: (id: string) => void;
}) {
  const { dispatch } = useAHP();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const startEdit = (node: AHPNode) => {
    setEditingId(node.id);
    setEditName(node.name);
    setEditDesc(node.description ?? "");
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    dispatch({
      type: "RENAME_NODE",
      id,
      name: editName.trim().slice(0, MAX_LABEL),
      description: editDesc.trim() || undefined,
    });
    ahpToast.success("Alternative updated");
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="space-y-1.5">
      {alternatives.map((node) => (
        <div
          key={node.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border-l-4 border-l-emerald-500 bg-emerald-50/60"
        >
          {editingId === node.id ? (
            // ── Inline edit mode ──
            <>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="relative">
                  <Input
                    autoFocus
                    value={editName}
                    maxLength={MAX_LABEL}
                    onChange={(e) => setEditName(e.target.value.slice(0, MAX_LABEL))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(node.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="h-7 text-sm border-emerald-400 focus-visible:ring-emerald-400 pr-12"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <CharCounter current={editName.length} max={MAX_LABEL} />
                  </div>
                </div>
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                  placeholder="Full name / description (optional)"
                  className="h-7 text-xs border-emerald-200 focus-visible:ring-emerald-300 text-slate-600"
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-100 border border-emerald-300 shrink-0"
                onClick={() => saveEdit(node.id)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-slate-500 hover:bg-slate-100 shrink-0"
                onClick={cancelEdit}
              >
                Cancel
              </Button>
            </>
          ) : (
            // ── Display mode ──
            <>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800 text-sm">{node.name}</span>
                {node.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{node.description}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                onClick={() => startEdit(node)}
                title="Rename this alternative"
              >
                <Pencil size={11} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                onClick={() => onDelete(node.id)}
                title="Delete this alternative"
              >
                <Trash2 size={11} />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Node Row (recursive) ─────────────────────────────────────────────────────
// The add form for a sub-criterion appears INLINE immediately below the parent row.

interface NodeRowProps {
  node: AHPNode;
  depth: number;
  allNodes: AHPNode[];
  addingUnder: string | null;          // which node's sub-criterion form is open
  onDelete: (id: string) => void;
  onRequestAdd: (parentId: string) => void;
  onAddSubCriterion: (name: string, desc: string, parentId: string) => void;
  onCancelAdd: () => void;
}

function NodeRow({
  node,
  depth,
  allNodes,
  addingUnder,
  onDelete,
  onRequestAdd,
  onAddSubCriterion,
  onCancelAdd,
}: NodeRowProps) {
  const { dispatch } = useAHP();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const children = allNodes.filter((n) => n.parentId === node.id && n.type === "criterion");
  const hasChildren = children.length > 0;
  const isAddingHere = addingUnder === node.id;

  const startEdit = () => { setEditName(node.name); setEditDesc(node.description ?? ""); setEditing(true); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    dispatch({
      type: "RENAME_NODE",
      id: node.id,
      name: editName.trim().slice(0, MAX_LABEL),
      description: editDesc.trim() || undefined,
    });
    ahpToast.success("Criterion updated");
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const depthColors = [
    "border-l-blue-700 bg-blue-50/70",
    "border-l-blue-500 bg-blue-50/50",
    "border-l-sky-400 bg-sky-50/40",
    "border-l-sky-300 bg-sky-50/30",
    "border-l-slate-300 bg-slate-50/30",
  ];
  const colorClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div>
      {/* ── This criterion row ── */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border-l-4 mb-1 group transition-all hover:shadow-sm",
          colorClass
        )}
        style={{ marginLeft: depth * 22 }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "text-slate-400 hover:text-slate-600 transition-colors shrink-0",
            !hasChildren && "invisible"
          )}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {editing ? (
          // ── Inline edit mode ──
          <>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="relative">
                <Input
                  autoFocus
                  value={editName}
                  maxLength={MAX_LABEL}
                  onChange={(e) => setEditName(e.target.value.slice(0, MAX_LABEL))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-7 text-sm border-blue-400 focus-visible:ring-blue-400 pr-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <CharCounter current={editName.length} max={MAX_LABEL} />
                </div>
              </div>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                placeholder="Full name / description (optional)"
                className="h-7 text-xs border-blue-200 focus-visible:ring-blue-300 text-slate-600"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-100 border border-blue-300 shrink-0"
              onClick={saveEdit}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-slate-500 hover:bg-slate-100 shrink-0"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </>
        ) : (
          // ── Display mode ──
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-800 text-sm">{node.name}</span>
                {depth > 0 && (
                  <Badge className="text-xs bg-blue-100 text-blue-600 border-blue-200 py-0">
                    Level {depth + 1} criterion
                  </Badge>
                )}
              </div>
              {node.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{node.description}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-100 border border-blue-200"
                onClick={() => onRequestAdd(node.id)}
                title="Add sub-criterion under this criterion"
              >
                <Plus size={11} className="mr-1" /> Sub-criterion
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                onClick={startEdit}
                title="Rename this criterion"
              >
                <Pencil size={11} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                onClick={() => onDelete(node.id)}
                title="Delete this criterion (and all its sub-criteria)"
              >
                <Trash2 size={11} />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Inline add form for sub-criterion of THIS node ── */}
      {isAddingHere && (
        <div style={{ marginLeft: (depth + 1) * 22 }}>
          <AddForm
            nodeType="criterion"
            parentLabel={node.name}
            placeholder="Sub-criterion name…"
            onAdd={(name, desc) => onAddSubCriterion(name, desc, node.id)}
            onCancel={onCancelAdd}
          />
        </div>
      )}

      {/* ── Children (recursive) ── */}
      {expanded && children.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          allNodes={allNodes}
          addingUnder={addingUnder}
          onDelete={onDelete}
          onRequestAdd={onRequestAdd}
          onAddSubCriterion={onAddSubCriterion}
          onCancelAdd={onCancelAdd}
        />
      ))}
    </div>
  );
}

// ─── Validation row ───────────────────────────────────────────────────────────

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
      ) : (
        <AlertCircle size={14} className="text-slate-300 shrink-0" />
      )}
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HierarchyStep() {
  const { state, dispatch, getCriteria, getAlternatives } = useAHP();

  const [objName, setObjName] = useState(state.objective);
  const [objDesc, setObjDesc] = useState(state.objectiveDescription);
  const [objSaved, setObjSaved] = useState(!!state.objective);
  const [addingCriterion, setAddingCriterion] = useState<string | null>(null); // "root" | nodeId
  const [addingAlternative, setAddingAlternative] = useState(false);

  const criteria = getCriteria();
  const alternatives = getAlternatives();
  const topCriteria = criteria.filter((n) => n.parentId === null);

  const hasObjective = !!state.objective;
  const hasCriteria = criteria.length >= 1;
  const hasAlternatives = alternatives.length >= 2;
  const canProceed = hasObjective && hasCriteria && hasAlternatives;

  const saveObjective = () => {
    if (!objName.trim()) { ahpToast.error("Please enter the decision objective"); return; }
    dispatch({ type: "SET_OBJECTIVE", name: objName.trim(), description: objDesc.trim() });
    setObjSaved(true);
    ahpToast.success("Objective saved");
  };

  const handleAddNode = (name: string, description: string, parentId: string | null, nodeType: "criterion" | "alternative") => {
    dispatch({ type: "ADD_NODE", parentId, nodeType, name, description });
    setAddingCriterion(null);
    setAddingAlternative(false);
    ahpToast.success(`${nodeType === "criterion" ? "Criterion" : "Alternative"} added`);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: "DELETE_NODE", id });
    if (addingCriterion === id) setAddingCriterion(null);
    ahpToast.info("Deleted");
  };

  const loadExample = () => {
    dispatch({ type: "LOAD_EXAMPLE", example: CLASS_EXAMPLE });
    ahpToast.success("Class example loaded — Car selection model is ready!");
  };

  return (
    <div className="space-y-7">
      {/* Step label */}
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Step 1</span>
        <h2 className="font-bold text-slate-800 text-xl mt-0.5">Problem Structuring</h2>
        <p className="text-sm text-slate-500 mt-1">
          Precisely identify the global goal, the relevant criteria at each level, and the alternatives to evaluate.
        </p>
      </div>

      {/* ── Load class example ── */}
      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen size={15} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Load class example</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Pre-fills the <strong>car selection</strong> model from class (4 criteria, 3 alternatives, all matrices filled).
              You can explore the full results and then reset to start your own analysis.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white shrink-0 font-semibold"
            onClick={loadExample}
          >
            <FlaskConical size={13} className="mr-1.5" /> Load Example
          </Button>
        </div>
      </div>

      {/* ── Objective ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
            <Target size={14} className="text-white" />
          </div>
          <h3 className="font-bold text-slate-800">Global Goal (Objective)</h3>
          {objSaved && <CheckCircle2 size={15} className="text-teal-600" />}
        </div>

        {!objSaved ? (
          <div className="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4 space-y-3">
            <Input
              autoFocus
              placeholder="e.g., Select the best candidate for the position"
              value={objName}
              onChange={(e) => setObjName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveObjective()}
              className="bg-white text-base font-medium"
            />
            <Textarea
              placeholder="Optional: describe the decision context, stakeholders, constraints…"
              value={objDesc}
              onChange={(e) => setObjDesc(e.target.value)}
              className="bg-white text-sm resize-none"
              rows={2}
            />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={saveObjective}>
              <CheckCircle2 size={14} className="mr-1.5" /> Save Objective
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-teal-200 bg-teal-50/30 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{state.objective}</p>
              {state.objectiveDescription && (
                <p className="text-sm text-slate-500 mt-0.5">{state.objectiveDescription}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700 shrink-0" onClick={() => setObjSaved(false)}>
              <Pencil size={12} className="mr-1" /> Edit
            </Button>
          </div>
        )}
      </section>

      {/* ── Criteria ── */}
      {hasObjective && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
                <Layers size={14} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-800">Criteria &amp; Sub-criteria</h3>
              {hasCriteria && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                  {criteria.length} defined
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => setAddingCriterion("root")}
            >
              <Plus size={13} className="mr-1" /> Add Criterion
            </Button>
          </div>

          {/* Top-level criterion add form */}
          {addingCriterion === "root" && (
            <AddForm
              nodeType="criterion"
              placeholder="e.g., Cost, Quality, Experience…"
              onAdd={(name, desc) => handleAddNode(name, desc, null, "criterion")}
              onCancel={() => setAddingCriterion(null)}
            />
          )}

          {topCriteria.length > 0 ? (
            <div>
              {topCriteria.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  allNodes={state.nodes}
                  addingUnder={addingCriterion}
                  onDelete={handleDelete}
                  onRequestAdd={(parentId) => setAddingCriterion(parentId)}
                  onAddSubCriterion={(name, desc, parentId) => handleAddNode(name, desc, parentId, "criterion")}
                  onCancelAdd={() => setAddingCriterion(null)}
                />
              ))}
            </div>
          ) : (
            !addingCriterion && (
              <div className="rounded-lg border border-dashed border-blue-200 p-6 text-center text-slate-400 text-sm">
                No criteria yet — click <strong className="text-blue-600">Add Criterion</strong> to begin
              </div>
            )
          )}

          {/* Hint about sub-criteria */}
          {hasCriteria && (
            <p className="text-xs text-slate-400 mt-1">
              Use the <strong className="text-blue-600">+ Sub-criterion</strong> button on any criterion to add nested sub-criteria (unlimited depth).
            </p>
          )}
        </section>
      )}

      {/* ── Alternatives ── */}
      {hasCriteria && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                <ListChecks size={14} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-800">Alternatives</h3>
              {alternatives.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                  {alternatives.length} defined
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setAddingAlternative(true)}
            >
              <Plus size={13} className="mr-1" /> Add Alternative
            </Button>
          </div>

          {addingAlternative && (
            <AddForm
              nodeType="alternative"
              placeholder="e.g., Candidate A, Vendor X, Option 1…"
              onAdd={(name, desc) => handleAddNode(name, desc, null, "alternative")}
              onCancel={() => setAddingAlternative(false)}
            />
          )}

          {alternatives.length > 0 ? (
            <AlternativesList alternatives={alternatives} onDelete={handleDelete} />
          
          ) : (
            !addingAlternative && (
              <div className="rounded-lg border border-dashed border-emerald-200 p-6 text-center text-slate-400 text-sm">
                No alternatives yet — at least 2 are required
              </div>
            )
          )}
        </section>
      )}

      {/* ── Validation & Proceed ── */}
      {hasObjective && (
        <section className="pt-3 border-t border-slate-100 space-y-4">
          <div className="space-y-2">
            <ValidationRow ok={hasObjective} label="Global goal (objective) defined" />
            <ValidationRow ok={hasCriteria} label={`At least 1 criterion defined (${criteria.length} currently)`} />
            <ValidationRow ok={hasAlternatives} label={`At least 2 alternatives defined (${alternatives.length} currently)`} />
          </div>

          {canProceed ? (
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 font-semibold"
              size="lg"
              onClick={() => dispatch({ type: "INIT_MATRICES" })}
            >
              Proceed to Comparison Matrices <ChevronRight size={16} className="ml-1.5" />
            </Button>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>Complete all three requirements above to proceed to Step 2.</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
