/**
 * HierarchyTree.tsx
 * Design: Precision Dashboard — live SVG hierarchy tree
 *
 * Layout rules:
 *   - Objective at the top (level 0)
 *   - Criteria and sub-criteria in the middle levels (levels 1..N)
 *   - Alternatives always at the BOTTOM row, connected to ALL leaf criteria
 *   - Supports unlimited sub-criteria depth
 *
 * Weight display (showWeights mode):
 *   - Alternatives: global weight
 *   - Criteria / sub-criteria: local weight (relative to parent)
 *
 * IMPORTANT: All SVG text coordinates are RELATIVE to the <g> group transform.
 * The group is translated to (x - NODE_W/2, y), so text x=NODE_W/2 is the
 * horizontal centre of the box, and text y values must be 0..NODE_H.
 */

import { useMemo } from "react";
import { useAHP } from "@/contexts/AHPContext";
import type { AHPNode } from "@/contexts/AHPContext";

// ─── Color scheme ─────────────────────────────────────────────────────────────

const OBJECTIVE_COLOR = { bg: "#0D9488", border: "#0F766E", text: "#FFFFFF" };
const ALTERNATIVE_COLOR = { bg: "#059669", border: "#047857", text: "#FFFFFF" };
const CRITERION_BLUES = [
  { bg: "#1E3A8A", border: "#1E40AF", text: "#FFFFFF" }, // level 1
  { bg: "#1D4ED8", border: "#2563EB", text: "#FFFFFF" }, // level 2
  { bg: "#2563EB", border: "#3B82F6", text: "#FFFFFF" }, // level 3
  { bg: "#3B82F6", border: "#60A5FA", text: "#FFFFFF" }, // level 4
  { bg: "#60A5FA", border: "#93C5FD", text: "#1E293B" }, // level 5+
];

function getCriterionColor(level: number) {
  return CRITERION_BLUES[Math.min(level - 1, CRITERION_BLUES.length - 1)];
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 120;
const NODE_H = 40;
const H_GAP = 16;
const V_GAP = 60;
const PADDING = 28;

// ─── Tree node type ───────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  name: string;
  type: "objective" | "criterion" | "alternative";
  level: number;
  /** Centre-x of the node box */
  cx: number;
  /** Top-y of the node box */
  ty: number;
  width: number;
  children: LayoutNode[];
}

// ─── Build criteria-only tree (no alternatives) ───────────────────────────────

function buildCriteriaTree(
  id: string,
  nodes: AHPNode[],
  objective: string,
  level: number
): LayoutNode {
  const isRoot = id === "objective";
  const node = isRoot
    ? { id: "objective", name: objective || "Objective", type: "objective" as const, level: 0, parentId: null }
    : nodes.find((n) => n.id === id)!;

  const childIds = isRoot
    ? nodes.filter((n) => n.type === "criterion" && (n.parentId === null || n.parentId === "objective")).map((n) => n.id)
    : nodes.filter((n) => n.type === "criterion" && n.parentId === id).map((n) => n.id);

  const children = childIds.map((cid) => buildCriteriaTree(cid, nodes, objective, level + 1));

  return {
    id: node.id,
    name: node.name,
    type: node.type as "objective" | "criterion" | "alternative",
    level,
    cx: 0,
    ty: level * (NODE_H + V_GAP),
    width: 0,
    children,
  };
}

function assignWidths(tree: LayoutNode): number {
  if (tree.children.length === 0) {
    tree.width = NODE_W;
    return NODE_W;
  }
  let total = 0;
  for (const child of tree.children) {
    total += assignWidths(child);
    total += H_GAP;
  }
  total -= H_GAP;
  tree.width = Math.max(NODE_W, total);
  return tree.width;
}

function assignX(tree: LayoutNode, startX: number) {
  tree.cx = startX + tree.width / 2;
  let cx = startX;
  for (const child of tree.children) {
    assignX(child, cx);
    cx += child.width + H_GAP;
  }
}

function collectLayoutNodes(tree: LayoutNode): LayoutNode[] {
  return [tree, ...tree.children.flatMap(collectLayoutNodes)];
}

function collectCriteriaEdges(tree: LayoutNode): { x1: number; y1: number; x2: number; y2: number }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const child of tree.children) {
    // Edge from bottom-centre of parent to top-centre of child
    edges.push({ x1: tree.cx, y1: tree.ty + NODE_H, x2: child.cx, y2: child.ty });
    edges.push(...collectCriteriaEdges(child));
  }
  return edges;
}

// ─── Truncate text to fit node width ─────────────────────────────────────────

function truncate(text: string, maxChars = 14): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  showWeights?: boolean;
  /** Global weights (for alternatives) */
  globalWeights?: Record<string, number>;
  /** Local weights (for criteria/sub-criteria) */
  localWeights?: Record<string, number>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HierarchyTree({
  showWeights = false,
  globalWeights = {},
  localWeights = {},
}: Props) {
  const { state } = useAHP();
  const { nodes, objective } = state;

  const layout = useMemo(() => {
    if (!objective && nodes.length === 0) return null;

    const alternatives = nodes.filter((n) => n.type === "alternative");
    const leafCriteria = nodes.filter(
      (n) =>
        n.type === "criterion" &&
        !nodes.some((c) => c.type === "criterion" && c.parentId === n.id)
    );

    // Build criteria tree
    const tree = buildCriteriaTree("objective", nodes, objective, 0);
    assignWidths(tree);
    assignX(tree, 0);

    const criteriaNodes = collectLayoutNodes(tree);
    const criteriaEdges = collectCriteriaEdges(tree);

    // Determine the deepest criteria level for positioning alternatives
    const maxCriteriaLevel = criteriaNodes.reduce((m, n) => Math.max(m, n.level), 0);
    const altTY = (maxCriteriaLevel + 1) * (NODE_H + V_GAP);

    // Position alternatives evenly across the full criteria tree width
    const treeWidth = tree.width;
    const altCount = alternatives.length;
    let altNodes: LayoutNode[] = [];

    if (altCount > 0) {
      const totalAltWidth = altCount * NODE_W + (altCount - 1) * H_GAP;
      const altStartX = Math.max(0, (treeWidth - totalAltWidth) / 2);

      altNodes = alternatives.map((alt, i) => ({
        id: alt.id,
        name: alt.name,
        type: "alternative" as const,
        level: maxCriteriaLevel + 1,
        cx: altStartX + i * (NODE_W + H_GAP) + NODE_W / 2,
        ty: altTY,
        width: NODE_W,
        children: [],
      }));
    }

    // Edges from each leaf criterion to each alternative
    const altEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    if (altCount > 0 && leafCriteria.length > 0) {
      for (const leaf of leafCriteria) {
        const leafNode = criteriaNodes.find((n) => n.id === leaf.id);
        if (!leafNode) continue;
        for (const altNode of altNodes) {
          altEdges.push({
            x1: leafNode.cx,
            y1: leafNode.ty + NODE_H,
            x2: altNode.cx,
            y2: altNode.ty,
          });
        }
      }
    }

    const allNodes = [...criteriaNodes, ...altNodes];
    const allEdges = [...criteriaEdges, ...altEdges];

    const maxX = Math.max(...allNodes.map((n) => n.cx + NODE_W / 2), treeWidth);
    const maxY = altCount > 0 ? altTY + NODE_H : maxCriteriaLevel * (NODE_H + V_GAP) + NODE_H;

    return {
      allNodes,
      allEdges,
      svgWidth: maxX + PADDING,
      svgHeight: maxY + PADDING,
    };
  }, [nodes, objective]);

  if (!objective) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-8">
        <svg width="120" height="80" viewBox="0 0 120 80" className="opacity-20">
          <rect x="40" y="4" width="40" height="22" rx="4" fill="#0D9488" />
          <line x1="60" y1="26" x2="20" y2="48" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 2" />
          <line x1="60" y1="26" x2="60" y2="48" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 2" />
          <line x1="60" y1="26" x2="100" y2="48" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 2" />
          <rect x="0" y="48" width="40" height="22" rx="4" fill="#1E40AF" />
          <rect x="40" y="48" width="40" height="22" rx="4" fill="#1E40AF" />
          <rect x="80" y="48" width="40" height="22" rx="4" fill="#1E40AF" />
        </svg>
        <p className="text-sm text-center font-medium">Your hierarchy will appear here as you build it</p>
      </div>
    );
  }

  if (!layout) return null;

  const { allNodes, allEdges, svgWidth, svgHeight } = layout;

  return (
    <div className="overflow-auto w-full h-full p-4">
      <svg
        width={svgWidth + PADDING}
        height={svgHeight + PADDING}
        viewBox={`-${PADDING / 2} -${PADDING / 2} ${svgWidth + PADDING} ${svgHeight + PADDING}`}
        className="mx-auto"
      >
        {/* Edges */}
        {allEdges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="#CBD5E1"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        ))}

        {/* Nodes */}
        {allNodes.map(({ id, name, type, level, cx, ty }) => {
          let colors;
          if (type === "objective") colors = OBJECTIVE_COLOR;
          else if (type === "alternative") colors = ALTERNATIVE_COLOR;
          else colors = getCriterionColor(level);

          const label = truncate(name, 14);

          // Weight display: global for alternatives, local for criteria
          let weightLabel: string | null = null;
          if (showWeights) {
            if (type === "alternative" && globalWeights[id] !== undefined) {
              weightLabel = `${(globalWeights[id] * 100).toFixed(1)}%`;
            } else if (type !== "alternative" && type !== "objective" && localWeights[id] !== undefined) {
              weightLabel = `${(localWeights[id] * 100).toFixed(1)}%`;
            }
          }

          // The <g> is translated to (cx - NODE_W/2, ty).
          // All child coordinates are therefore RELATIVE: x in [0, NODE_W], y in [0, NODE_H].
          const nameY = weightLabel ? NODE_H * 0.38 : NODE_H / 2;
          const wgtY = NODE_H * 0.72;

          return (
            <g key={id} transform={`translate(${cx - NODE_W / 2}, ${ty})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={1.5}
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.15))" }}
              />
              {/* Name label */}
              <text
                x={NODE_W / 2}
                y={nameY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={11}
                fontFamily="DM Sans, sans-serif"
                fontWeight={600}
              >
                {label}
              </text>
              {/* Weight label (below name, smaller) */}
              {weightLabel && (
                <text
                  x={NODE_W / 2}
                  y={wgtY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={9.5}
                  fontFamily="JetBrains Mono, monospace"
                  opacity={0.9}
                >
                  {weightLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
