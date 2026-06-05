/**
 * ahp.ts
 * Pure AHP calculation engine — no React dependencies.
 *
 * Follows the 5-step methodology:
 *   Step 3 — Local Weight Estimation: eigenvector (normalized column average)
 *   Step 4 — Global Weight Consolidation: weighted sum across all criteria
 *
 * Two comparison modes:
 *   "importance"  — criteria/sub-criteria relative to a parent
 *   "preference"  — alternatives relative to a leaf criterion
 */

// ─── Saaty Random Index Table ─────────────────────────────────────────────────
const RI: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45,
  10: 1.49, 11: 1.51, 12: 1.54, 13: 1.56, 14: 1.57, 15: 1.59,
};

export const CR_THRESHOLD = 0.10;

// ─── Saaty Scale: Importance ──────────────────────────────────────────────────
export const IMPORTANCE_SCALE: { value: number; label: string; description: string }[] = [
  { value: 9, label: "9", description: "A is extremely more important than B" },
  { value: 8, label: "8", description: "A is between markedly and extremely more important than B" },
  { value: 7, label: "7", description: "A is markedly more important than B" },
  { value: 6, label: "6", description: "A is between more and markedly more important than B" },
  { value: 5, label: "5", description: "A is more important than B" },
  { value: 4, label: "4", description: "A is between slightly and more important than B" },
  { value: 3, label: "3", description: "A is slightly more important than B" },
  { value: 2, label: "2", description: "A is between equally and slightly more important than B" },
  { value: 1, label: "1", description: "A and B are equally important" },
];

// ─── Saaty Scale: Preference / Performance ────────────────────────────────────
export const PREFERENCE_SCALE: { value: number; label: string; description: string }[] = [
  { value: 9, label: "9", description: "A is extremely better than B" },
  { value: 8, label: "8", description: "A is between markedly and extremely better than B" },
  { value: 7, label: "7", description: "A is markedly better than B" },
  { value: 6, label: "6", description: "A is between better and markedly better than B" },
  { value: 5, label: "5", description: "A is better than B" },
  { value: 4, label: "4", description: "A is between slightly and better than B" },
  { value: 3, label: "3", description: "A is slightly better than B" },
  { value: 2, label: "2", description: "A is between equal and slightly better than B" },
  { value: 1, label: "1", description: "A and B are equal" },
];

// ─── Matrix Math ──────────────────────────────────────────────────────────────

export function buildMatrix(
  nodeIds: string[],
  values: Record<string, Record<string, number>>
): number[][] {
  return nodeIds.map((i) => nodeIds.map((j) => (i === j ? 1 : values[i]?.[j] ?? 1)));
}

export function priorityVector(matrix: number[][]): number[] {
  const n = matrix.length;
  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      colSums[j] += matrix[i][j];
  const norm = matrix.map((row) => row.map((v, j) => v / colSums[j]));
  return norm.map((row) => row.reduce((a, b) => a + b, 0) / n);
}

export function lambdaMax(matrix: number[][], weights: number[]): number {
  const n = matrix.length;
  let lmax = 0;
  for (let j = 0; j < n; j++) {
    let cs = 0;
    for (let i = 0; i < n; i++) cs += matrix[i][j];
    lmax += cs * weights[j];
  }
  return lmax;
}

export function consistencyIndex(lmax: number, n: number): number {
  if (n <= 1) return 0;
  return (lmax - n) / (n - 1);
}

export function consistencyRatio(ci: number, n: number): number {
  const ri = RI[n] ?? 1.59;
  if (ri === 0) return 0;
  return ci / ri;
}

export function analyzeMatrix(
  nodeIds: string[],
  values: Record<string, Record<string, number>>
): { weights: number[]; cr: number; ci: number; lmax: number } {
  const n = nodeIds.length;
  if (n === 1) return { weights: [1], cr: 0, ci: 0, lmax: 1 };
  const matrix = buildMatrix(nodeIds, values);
  const weights = priorityVector(matrix);
  const lmax = lambdaMax(matrix, weights);
  const ci = consistencyIndex(lmax, n);
  const cr = consistencyRatio(ci, n);
  return { weights, cr, ci, lmax };
}

// ─── Full AHP Computation ─────────────────────────────────────────────────────

export interface AHPNodeInput {
  id: string;
  parentId: string | null;
  type: "objective" | "criterion" | "alternative";
  level: number;
}

export interface PairwiseMatrixInput {
  parentId: string;
  nodeIds: string[];
  comparisonType: "importance" | "preference";
  values: Record<string, Record<string, number>>;
}

export interface AHPResults {
  localWeights: Record<string, number>;
  globalWeights: Record<string, number>;
  consistencyRatios: Record<string, number>;
}

/**
 * Compute all local weights, global weights, and CRs.
 *
 * Strategy:
 * 1. Process importance matrices top-down → local weights for criteria
 * 2. Propagate global weights for criteria multiplicatively
 * 3. Process preference matrices → local weights for alternatives per criterion
 * 4. Consolidate alternative global weights as weighted sum:
 *    globalWeight(alt) = Σ_criterion [ localWeight(alt|criterion) × globalWeight(criterion) ]
 */
export function computeAHP(
  nodes: AHPNodeInput[],
  matrices: PairwiseMatrixInput[]
): AHPResults {
  const localWeights: Record<string, number> = {};
  const globalWeights: Record<string, number> = {};
  const consistencyRatios: Record<string, number> = {};

  // Objective anchor
  globalWeights["objective"] = 1;
  localWeights["objective"] = 1;

  // ── Step 3a: Importance matrices (criteria local + global weights) ──────────
  const importanceMatrices = matrices
    .filter((m) => m.comparisonType === "importance")
    .sort((a, b) => {
      const la = a.parentId === "objective" ? -1 : (nodes.find((n) => n.id === a.parentId)?.level ?? 99);
      const lb = b.parentId === "objective" ? -1 : (nodes.find((n) => n.id === b.parentId)?.level ?? 99);
      return la - lb;
    });

  for (const m of importanceMatrices) {
    const { weights, cr } = analyzeMatrix(m.nodeIds, m.values);
    consistencyRatios[m.parentId] = cr;
    const parentGlobal = globalWeights[m.parentId] ?? 1;
    m.nodeIds.forEach((id, idx) => {
      localWeights[id] = weights[idx];
      globalWeights[id] = weights[idx] * parentGlobal;
    });
  }

  // ── Step 3b: Preference matrices (alternatives local weights per criterion) ─
  // localAltWeights[criterionId][altId] = local priority of alt under that criterion
  const localAltWeights: Record<string, Record<string, number>> = {};

  const preferenceMatrices = matrices.filter((m) => m.comparisonType === "preference");
  for (const m of preferenceMatrices) {
    const { weights, cr } = analyzeMatrix(m.nodeIds, m.values);
    consistencyRatios[m.parentId] = cr;
    localAltWeights[m.parentId] = {};
    m.nodeIds.forEach((id, idx) => {
      localAltWeights[m.parentId][id] = weights[idx];
      // local weight of alt relative to this criterion
      localWeights[id] = localWeights[id] ?? weights[idx]; // first assignment; will be overwritten below
    });
  }

  // ── Step 4: Consolidate global weights for alternatives ────────────────────
  // Each alternative's global weight = Σ over leaf criteria of (localAlt × globalCriterion)
  const alternatives = nodes.filter((n) => n.type === "alternative");

  if (alternatives.length > 0 && preferenceMatrices.length > 0) {
    for (const alt of alternatives) {
      let globalSum = 0;
      for (const [criterionId, altMap] of Object.entries(localAltWeights)) {
        const altLocal = altMap[alt.id] ?? 0;
        const critGlobal = globalWeights[criterionId] ?? 0;
        globalSum += altLocal * critGlobal;
      }
      globalWeights[alt.id] = globalSum;
    }
  }

  return { localWeights, globalWeights, consistencyRatios };
}
