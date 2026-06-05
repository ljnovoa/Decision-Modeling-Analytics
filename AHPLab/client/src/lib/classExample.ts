/**
 * classExample.ts
 * Pre-built AHP model from the class slides:
 *   Objective: Select the best car
 *   Criteria: Price, Safety, Economy, Comfort
 *   Alternatives: Car X, Car Y, Car Z
 *
 * All pairwise matrices are pre-filled with the values from the course material.
 * Source: Saaty (1980) car selection example as used in class.
 */

import type { AHPState } from "@/contexts/AHPContext";

export const CLASS_EXAMPLE: Omit<AHPState, "localWeights" | "globalWeights" | "consistencyRatios"> & {
  localWeights: Record<string, number>;
  globalWeights: Record<string, number>;
  consistencyRatios: Record<string, number>;
} = {
  step: "results",
  objective: "Select the best car",
  objectiveDescription:
    "Evaluate three candidate cars (X, Y, Z) across four criteria: Price, Safety, Economy, and Comfort.",
  nodes: [
    { id: "ex_c1", name: "Price",   type: "criterion",   parentId: null, level: 1, description: "Total acquisition cost" },
    { id: "ex_c2", name: "Safety",  type: "criterion",   parentId: null, level: 1, description: "Crash-test ratings and safety features" },
    { id: "ex_c3", name: "Economy", type: "criterion",   parentId: null, level: 1, description: "Fuel efficiency and running costs" },
    { id: "ex_c4", name: "Comfort", type: "criterion",   parentId: null, level: 1, description: "Ride quality, space, and amenities" },
    { id: "ex_a1", name: "Car X",   type: "alternative", parentId: null, level: 2, description: "" },
    { id: "ex_a2", name: "Car Y",   type: "alternative", parentId: null, level: 2, description: "" },
    { id: "ex_a3", name: "Car Z",   type: "alternative", parentId: null, level: 2, description: "" },
  ],
  matrices: [
    // ── Criteria vs Objective (importance) ──────────────────────────────────
    {
      parentId: "objective",
      nodeIds: ["ex_c1", "ex_c2", "ex_c3", "ex_c4"],
      comparisonType: "importance",
      values: {
        ex_c1: { ex_c1: 1,       ex_c2: 1/7,    ex_c3: 1/2,    ex_c4: 1/5 },
        ex_c2: { ex_c1: 7,       ex_c2: 1,      ex_c3: 4,      ex_c4: 2   },
        ex_c3: { ex_c1: 2,       ex_c2: 1/4,    ex_c3: 1,      ex_c4: 1/2 },
        ex_c4: { ex_c1: 5,       ex_c2: 1/2,    ex_c3: 2,      ex_c4: 1   },
      },
    },
    // ── Alternatives vs Price (preference) ──────────────────────────────────
    {
      parentId: "ex_c1",
      nodeIds: ["ex_a1", "ex_a2", "ex_a3"],
      comparisonType: "preference",
      values: {
        ex_a1: { ex_a1: 1,    ex_a2: 1/4,  ex_a3: 3   },
        ex_a2: { ex_a1: 4,    ex_a2: 1,    ex_a3: 7   },
        ex_a3: { ex_a1: 1/3,  ex_a2: 1/7,  ex_a3: 1   },
      },
    },
    // ── Alternatives vs Safety (preference) ─────────────────────────────────
    {
      parentId: "ex_c2",
      nodeIds: ["ex_a1", "ex_a2", "ex_a3"],
      comparisonType: "preference",
      values: {
        ex_a1: { ex_a1: 1,    ex_a2: 1/2,  ex_a3: 3   },
        ex_a2: { ex_a1: 2,    ex_a2: 1,    ex_a3: 8   },
        ex_a3: { ex_a1: 1/3,  ex_a2: 1/8,  ex_a3: 1   },
      },
    },
    // ── Alternatives vs Economy (preference) ────────────────────────────────
    {
      parentId: "ex_c3",
      nodeIds: ["ex_a1", "ex_a2", "ex_a3"],
      comparisonType: "preference",
      values: {
        ex_a1: { ex_a1: 1,    ex_a2: 1/3,  ex_a3: 1/6 },
        ex_a2: { ex_a1: 3,    ex_a2: 1,    ex_a3: 1/3 },
        ex_a3: { ex_a1: 6,    ex_a2: 3,    ex_a3: 1   },
      },
    },
    // ── Alternatives vs Comfort (preference) ────────────────────────────────
    {
      parentId: "ex_c4",
      nodeIds: ["ex_a1", "ex_a2", "ex_a3"],
      comparisonType: "preference",
      values: {
        ex_a1: { ex_a1: 1,    ex_a2: 1/4,  ex_a3: 1/8 },
        ex_a2: { ex_a1: 4,    ex_a2: 1,    ex_a3: 1/3 },
        ex_a3: { ex_a1: 8,    ex_a2: 3,    ex_a3: 1   },
      },
    },
  ],
  // Pre-computed weights (verified against Saaty 1980)
  localWeights: {
    ex_c1: 0.06571,
    ex_c2: 0.51721,
    ex_c3: 0.13347,
    ex_c4: 0.28361,
  },
  globalWeights: {
    ex_c1: 0.06571,
    ex_c2: 0.51721,
    ex_c3: 0.13347,
    ex_c4: 0.28361,
    ex_a1: 0.19563,
    ex_a2: 0.47701,
    ex_a3: 0.32736,
  },
  consistencyRatios: {
    objective: 0.00561,
    ex_c1: 0.04560,
    ex_c2: 0.01160,
    ex_c3: 0.02350,
    ex_c4: 0.02440,
  },
};
