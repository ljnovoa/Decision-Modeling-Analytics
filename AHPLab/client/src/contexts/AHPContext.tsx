/**
 * AHPContext.tsx
 * Design: Precision Dashboard — teal/slate/amber, DM Sans + JetBrains Mono
 *
 * Follows the 5-step AHP methodology:
 *   Step 1 — Problem Structuring  (define objective, criteria, alternatives)
 *   Step 2 — Comparison Matrices  (build pairwise matrices)
 *   Step 3 — Local Weight Estimation  (eigenvector method per matrix)
 *   Step 4 — Global Weight Consolidation  (multiplicative propagation)
 *   Step 5 — Analysis of Results  (consistency + sensitivity)
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { nanoid } from "nanoid";

// ─── Data Model ───────────────────────────────────────────────────────────────

export interface AHPNode {
  id: string;
  name: string;
  description?: string;
  parentId: string | null; // null means child of objective
  type: "objective" | "criterion" | "alternative";
  level: number; // 0 = objective, 1 = top criteria, 2 = sub-criteria, …
}

export interface PairwiseMatrix {
  nodeIds: string[];
  parentId: string;
  /** "importance" for criteria comparisons, "preference" for alternatives */
  comparisonType: "importance" | "preference";
  values: Record<string, Record<string, number>>;
}

export interface AHPState {
  /** Which of the 5 methodology steps the user is on */
  step: "structuring" | "matrices" | "results";
  objective: string;
  objectiveDescription: string;
  nodes: AHPNode[];
  matrices: PairwiseMatrix[];
  // Computed (Steps 3 & 4)
  localWeights: Record<string, number>;
  globalWeights: Record<string, number>;
  consistencyRatios: Record<string, number>;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const STORAGE_KEY = "ahp-tool-state-v3";

function makeInitialState(): AHPState {
  return {
    step: "structuring",
    objective: "",
    objectiveDescription: "",
    nodes: [],
    matrices: [],
    localWeights: {},
    globalWeights: {},
    consistencyRatios: {},
  };
}

// Always start fresh — no session persistence between page loads.
function loadState(): AHPState {
  return makeInitialState();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type AHPAction =
  | { type: "SET_OBJECTIVE"; name: string; description: string }
  | {
      type: "ADD_NODE";
      parentId: string | null;
      nodeType: "criterion" | "alternative";
      name: string;
      description?: string;
    }
  | { type: "DELETE_NODE"; id: string }
  | { type: "RENAME_NODE"; id: string; name: string; description?: string }
  | { type: "GO_TO_STEP"; step: AHPState["step"] }
  | { type: "INIT_MATRICES" }
  | {
      type: "SET_MATRIX_VALUE";
      parentId: string;
      idA: string;
      idB: string;
      value: number;
    }
  | {
      type: "SET_RESULTS";
      localWeights: Record<string, number>;
      globalWeights: Record<string, number>;
      consistencyRatios: Record<string, number>;
    }
  | { type: "RESET" }
  | { type: "LOAD_EXAMPLE"; example: Omit<AHPState, "step"> & { step: AHPState["step"]; localWeights: Record<string, number>; globalWeights: Record<string, number>; consistencyRatios: Record<string, number> } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDescendants(nodes: AHPNode[], id: string): string[] {
  const result: string[] = [id];
  for (const child of nodes.filter((n) => n.parentId === id)) {
    result.push(...getDescendants(nodes, child.id));
  }
  return result;
}

function getLevel(nodes: AHPNode[], parentId: string | null): number {
  if (parentId === null) return 1;
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return 1;
  return parent.level + 1;
}

/**
 * Build pairwise matrices for every group of siblings.
 * Criteria matrices → "importance"; alternative matrices → "preference".
 */
function buildMatrices(nodes: AHPNode[]): PairwiseMatrix[] {
  const matrices: PairwiseMatrix[] = [];

  // Top-level criteria (children of the objective)
  const topCriteria = nodes.filter(
    (n) => n.type === "criterion" && n.parentId === null
  );
  if (topCriteria.length >= 2) {
    matrices.push(makeMatrix("objective", topCriteria, "importance"));
  }

  // Sub-criteria under each criterion
  for (const criterion of nodes.filter((n) => n.type === "criterion")) {
    const subs = nodes.filter(
      (n) => n.type === "criterion" && n.parentId === criterion.id
    );
    if (subs.length >= 2) {
      matrices.push(makeMatrix(criterion.id, subs, "importance"));
    }
  }

  // Alternatives under each leaf criterion (criteria with no sub-criteria children)
  const leafCriteria = nodes.filter(
    (n) =>
      n.type === "criterion" &&
      !nodes.some((c) => c.type === "criterion" && c.parentId === n.id)
  );
  const alternatives = nodes.filter((n) => n.type === "alternative");
  if (alternatives.length >= 2) {
    for (const leaf of leafCriteria) {
      matrices.push(makeMatrix(leaf.id, alternatives, "preference"));
    }
  }

  return matrices;
}

function makeMatrix(
  parentId: string,
  items: AHPNode[],
  comparisonType: "importance" | "preference"
): PairwiseMatrix {
  const nodeIds = items.map((n) => n.id);
  const values: Record<string, Record<string, number>> = {};
  for (const id of nodeIds) {
    values[id] = {};
    for (const id2 of nodeIds) {
      values[id][id2] = id === id2 ? 1 : 0;
    }
  }
  return { parentId, nodeIds, comparisonType, values };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AHPState, action: AHPAction): AHPState {
  switch (action.type) {
    case "SET_OBJECTIVE":
      return {
        ...state,
        objective: action.name,
        objectiveDescription: action.description,
      };

    case "ADD_NODE": {
      const level = getLevel(state.nodes, action.parentId);
      const newNode: AHPNode = {
        id: nanoid(8),
        name: action.name,
        description: action.description,
        parentId: action.parentId,
        type: action.nodeType,
        level,
      };
      return { ...state, nodes: [...state.nodes, newNode] };
    }

    case "DELETE_NODE": {
      const toRemove = new Set(getDescendants(state.nodes, action.id));
      return {
        ...state,
        nodes: state.nodes.filter((n) => !toRemove.has(n.id)),
        matrices: state.matrices.filter(
          (m) =>
            !toRemove.has(m.parentId) &&
            m.nodeIds.every((id) => !toRemove.has(id))
        ),
      };
    }

    case "RENAME_NODE":
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id
            ? {
                ...n,
                name: action.name,
                description: action.description ?? n.description,
              }
            : n
        ),
      };

    case "GO_TO_STEP":
      return { ...state, step: action.step };

    case "INIT_MATRICES":
      return {
        ...state,
        matrices: buildMatrices(state.nodes),
        step: "matrices",
      };

    case "SET_MATRIX_VALUE": {
      const newMatrices = state.matrices.map((m) => {
        if (m.parentId !== action.parentId) return m;
        const newValues = {
          ...m.values,
          [action.idA]: {
            ...m.values[action.idA],
            [action.idB]: action.value,
          },
          [action.idB]: {
            ...m.values[action.idB],
            [action.idA]: 1 / action.value,
          },
        };
        return { ...m, values: newValues };
      });
      return { ...state, matrices: newMatrices };
    }

    case "SET_RESULTS":
      return {
        ...state,
        localWeights: action.localWeights,
        globalWeights: action.globalWeights,
        consistencyRatios: action.consistencyRatios,
        step: "results",
      };

    case "RESET":
      return makeInitialState();

    case "LOAD_EXAMPLE":
      return {
        ...action.example,
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AHPContextValue {
  state: AHPState;
  dispatch: React.Dispatch<AHPAction>;
  getChildren: (parentId: string | null) => AHPNode[];
  getAlternatives: () => AHPNode[];
  getCriteria: () => AHPNode[];
  getLeafCriteria: () => AHPNode[];
  getMatrix: (parentId: string) => PairwiseMatrix | undefined;
  isMatrixComplete: (parentId: string) => boolean;
  allMatricesComplete: () => boolean;
}

const AHPContext = createContext<AHPContextValue | null>(null);

export function AHPProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // Session persistence intentionally disabled — tool always opens empty.

  const getChildren = (parentId: string | null) =>
    state.nodes.filter((n) => n.parentId === parentId);

  const getAlternatives = () =>
    state.nodes.filter((n) => n.type === "alternative");

  const getCriteria = () =>
    state.nodes.filter((n) => n.type === "criterion");

  const getLeafCriteria = () =>
    state.nodes.filter(
      (n) =>
        n.type === "criterion" &&
        !state.nodes.some(
          (c) => c.type === "criterion" && c.parentId === n.id
        )
    );

  const getMatrix = (parentId: string) =>
    state.matrices.find((m) => m.parentId === parentId);

  const isMatrixComplete = (parentId: string) => {
    const m = getMatrix(parentId);
    if (!m) return false;
    for (const idA of m.nodeIds) {
      for (const idB of m.nodeIds) {
        if (idA !== idB && (!m.values[idA]?.[idB] || m.values[idA][idB] === 0))
          return false;
      }
    }
    return true;
  };

  const allMatricesComplete = () => {
    if (state.matrices.length === 0) return false;
    return state.matrices.every((m) => isMatrixComplete(m.parentId));
  };

  return (
    <AHPContext.Provider
      value={{
        state,
        dispatch,
        getChildren,
        getAlternatives,
        getCriteria,
        getLeafCriteria,
        getMatrix,
        isMatrixComplete,
        allMatricesComplete,
      }}
    >
      {children}
    </AHPContext.Provider>
  );
}

export function useAHP() {
  const ctx = useContext(AHPContext);
  if (!ctx) throw new Error("useAHP must be used within AHPProvider");
  return ctx;
}
