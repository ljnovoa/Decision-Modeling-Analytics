/**
 * AHP Decision Tool — PDF Export Utility
 * Builds the report programmatically using jsPDF (no html2canvas / DOM capture).
 * Produces a clean, multi-page A4 PDF with:
 *   - Cover page (objective, date)
 *   - Hierarchy summary table
 *   - Criteria & sub-criteria local weights (bar charts drawn with rects)
 *   - Alternative local weights per criterion
 *   - Global alternative weights (bar chart)
 *   - Consistency summary table
 */

import type { AHPNode, PairwiseMatrix } from "@/contexts/AHPContext";
import type { AHPResults } from "@/lib/ahp";

// ── Colour palette ────────────────────────────────────────────────────────────
const TEAL   = [13, 148, 136]  as [number, number, number];
const NAVY   = [30,  58, 138]  as [number, number, number];
const SLATE  = [71,  85, 105]  as [number, number, number];
const LIGHT  = [241, 245, 249] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];
const AMBER  = [217, 119,   6] as [number, number, number];
const EMERALD= [5,  150, 105]  as [number, number, number];
const DARK   = [15,  23,  42]  as [number, number, number];

// ── Page geometry ─────────────────────────────────────────────────────────────
const PW = 210; // A4 width  mm
const PH = 297; // A4 height mm
const ML = 18;  // left margin
const MR = 18;  // right margin
const MT = 18;  // top margin
const CW = PW - ML - MR; // content width

// ── Helpers ───────────────────────────────────────────────────────────────────
type PDF = InstanceType<typeof import("jspdf")["jsPDF"]>;

function setColor(doc: PDF, rgb: [number,number,number], fill = true) {
  if (fill) doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: PDF, rgb: [number,number,number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** Draw a horizontal rule */
function hRule(doc: PDF, y: number, color = LIGHT) {
  setColor(doc, color, false);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
}

/** Draw a filled rectangle */
function fillRect(doc: PDF, x: number, y: number, w: number, h: number, color: [number,number,number]) {
  setColor(doc, color, true);
  doc.rect(x, y, w, h, "F");
}

/** Truncate a string to fit within maxWidth at current font size */
function truncate(doc: PDF, text: string, maxWidth: number): string {
  while (doc.getTextWidth(text) > maxWidth && text.length > 3) {
    text = text.slice(0, -1);
  }
  return text;
}

/** Draw a simple horizontal bar chart */
function drawBarChart(
  doc: PDF,
  items: { label: string; value: number }[],
  x: number,
  y: number,
  chartW: number,
  barH: number,
  gap: number,
  colors: [number,number,number][]
): number {
  const maxVal = Math.max(...items.map(i => i.value), 0.001);
  const labelW = 48;
  const barAreaW = chartW - labelW - 20;

  items.forEach((item, idx) => {
    const barY = y + idx * (barH + gap);
    const color = colors[idx % colors.length];

    // Label
    doc.setFontSize(8);
    setTextColor(doc, SLATE);
    const lbl = truncate(doc, item.label, labelW - 2);
    doc.text(lbl, x, barY + barH * 0.7);

    // Background track
    fillRect(doc, x + labelW, barY, barAreaW, barH, LIGHT);

    // Bar
    const bw = Math.max((item.value / maxVal) * barAreaW, 0.5);
    fillRect(doc, x + labelW, barY, bw, barH, color);

    // Value label
    doc.setFontSize(7.5);
    setTextColor(doc, DARK);
    doc.text(`${(item.value * 100).toFixed(1)}%`, x + labelW + barAreaW + 2, barY + barH * 0.75);
  });

  return y + items.length * (barH + gap);
}

/** Check if we need a new page; if so, add one and return new y */
function checkPage(doc: PDF, y: number, needed: number): number {
  if (y + needed > PH - 20) {
    doc.addPage();
    return MT;
  }
  return y;
}

/** Section heading */
function sectionHeading(doc: PDF, text: string, y: number): number {
  y = checkPage(doc, y, 14);
  fillRect(doc, ML, y, CW, 8, TEAL);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, WHITE);
  doc.text(text, ML + 3, y + 5.5);
  doc.setFont("helvetica", "normal");
  return y + 11;
}

/** Sub-section heading */
function subHeading(doc: PDF, text: string, y: number): number {
  y = checkPage(doc, y, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, NAVY);
  doc.text(text, ML, y);
  doc.setFont("helvetica", "normal");
  return y + 6;
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportAHPtoPDF(
  objective: string,
  nodes: AHPNode[],
  matrices: PairwiseMatrix[],
  results: AHPResults
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const nameMap: Record<string, string> = { objective };
  for (const n of nodes) nameMap[n.id] = n.name;

  const alternatives = nodes.filter(n => n.type === "alternative");
  const criteria     = nodes.filter(n => n.type === "criterion");
  const topCriteria  = criteria.filter(n => n.parentId === null);
  const leafCriteria = criteria.filter(
    n => !nodes.some(c => c.type === "criterion" && c.parentId === n.id)
  );

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  // Header band
  fillRect(doc, 0, 0, PW, 55, TEAL);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, WHITE);
  doc.text("AHP Decision Tool", ML, 22);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  setTextColor(doc, [180, 230, 225]);
  doc.text("Analytic Hierarchy Process — Results Report", ML, 32);
  doc.setFontSize(9);
  setTextColor(doc, [200, 240, 235]);
  doc.text("Designed by Luis Novoa · Built using Manus · For educational purposes", ML, 42);
  doc.text(`Generated: ${new Date().toLocaleString()}`, ML, 49);

  let y = 68;

  // Objective box
  fillRect(doc, ML, y, CW, 22, LIGHT);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, SLATE);
  doc.text("GLOBAL OBJECTIVE", ML + 4, y + 7);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setTextColor(doc, DARK);
  const objLines = doc.splitTextToSize(objective, CW - 8) as string[];
  doc.text(objLines[0] ?? objective, ML + 4, y + 15);
  y += 28;

  // Summary stats
  const stats = [
    { label: "Criteria",    value: topCriteria.length.toString() },
    { label: "Sub-criteria",value: criteria.filter(n => n.parentId !== null).length.toString() },
    { label: "Alternatives",value: alternatives.length.toString() },
    { label: "Matrices",    value: matrices.length.toString() },
  ];
  const statW = CW / stats.length;
  stats.forEach((s, i) => {
    fillRect(doc, ML + i * statW, y, statW - 2, 18, NAVY);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, WHITE);
    doc.text(s.value, ML + i * statW + statW / 2 - 2, y + 11, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    setTextColor(doc, [180, 200, 230]);
    doc.text(s.label, ML + i * statW + statW / 2 - 2, y + 16.5, { align: "center" });
  });
  y += 24;

  // Winner banner
  const winner = alternatives
    .map(a => ({ name: a.name, w: results.globalWeights[a.id] ?? 0 }))
    .sort((a, b) => b.w - a.w)[0];

  if (winner) {
    fillRect(doc, ML, y, CW, 18, EMERALD);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, [200, 255, 230]);
    doc.text("RECOMMENDED ALTERNATIVE", ML + 4, y + 6);
    doc.setFontSize(13);
    setTextColor(doc, WHITE);
    doc.text(winner.name, ML + 4, y + 14);
    doc.setFontSize(10);
    setTextColor(doc, [200, 255, 230]);
    doc.text(`Global weight: ${(winner.w * 100).toFixed(2)}%`, ML + CW - 4, y + 14, { align: "right" });
    y += 24;
  }

  // ── SECTION 1: HIERARCHY STRUCTURE ────────────────────────────────────────
  doc.addPage();
  y = MT;
  y = sectionHeading(doc, "1. Hierarchy Structure", y);

  // Table header
  const cols = [60, 35, 35, CW - 130];
  const colX = [ML, ML + cols[0], ML + cols[0] + cols[1], ML + cols[0] + cols[1] + cols[2]];
  const rowH = 7;

  fillRect(doc, ML, y, CW, rowH, NAVY);
  ["Node", "Type", "Level", "Parent"].forEach((h, i) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, WHITE);
    doc.text(h, colX[i] + 2, y + 5);
  });
  y += rowH;

  const allNodes = [
    { name: objective, type: "Objective", level: 0, parent: "—" },
    ...nodes.map(n => ({
      name: n.name,
      type: n.type === "criterion" ? (n.level === 1 ? "Criterion" : `Sub-criterion (L${n.level})`) : "Alternative",
      level: n.level,
      parent: n.parentId ? (nameMap[n.parentId] ?? n.parentId) : "Objective",
    })),
  ];

  allNodes.forEach((row, idx) => {
    y = checkPage(doc, y, rowH + 1);
    if (idx % 2 === 0) fillRect(doc, ML, y, CW, rowH, LIGHT);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setTextColor(doc, DARK);
    const vals = [row.name, row.type, `Level ${row.level}`, row.parent];
    vals.forEach((v, i) => {
      doc.text(truncate(doc, v, cols[i] - 4), colX[i] + 2, y + 5);
    });
    y += rowH;
  });
  y += 6;

  // ── SECTION 2: CRITERIA WEIGHTS ───────────────────────────────────────────
  y = checkPage(doc, y, 20);
  y = sectionHeading(doc, "2. Step 3 — Criteria & Sub-criteria Local Weights", y);

  // Top-level criteria
  if (topCriteria.length > 0) {
    y = subHeading(doc, "Criteria relative to Objective (local weights)", y);
    const items = topCriteria.map(c => ({
      label: c.name,
      value: results.localWeights[c.id] ?? 0,
    }));
    const barColors: [number,number,number][] = [TEAL, NAVY, [5,150,105], [124,58,237], [217,119,6]];
    y = drawBarChart(doc, items, ML, y, CW, 6, 2, barColors);
    y += 6;
  }

  // Sub-criteria per criterion
  for (const c of criteria) {
    const subs = nodes.filter(n => n.type === "criterion" && n.parentId === c.id);
    if (subs.length === 0) continue;
    y = checkPage(doc, y, 14 + subs.length * 9);
    y = subHeading(doc, `Sub-criteria of "${c.name}" (local weights)`, y);
    const items = subs.map(s => ({ label: s.name, value: results.localWeights[s.id] ?? 0 }));
    const barColors: [number,number,number][] = [NAVY, TEAL, [5,150,105], [124,58,237]];
    y = drawBarChart(doc, items, ML, y, CW, 6, 2, barColors);
    y += 6;
  }

  // ── SECTION 3: ALTERNATIVE WEIGHTS PER CRITERION ─────────────────────────
  y = checkPage(doc, y, 20);
  y = sectionHeading(doc, "3. Step 3 — Alternative Local Weights per Criterion", y);

  for (const lc of leafCriteria) {
    const m = matrices.find((mx: PairwiseMatrix) => mx.parentId === lc.id && mx.comparisonType === "preference");
    if (!m || alternatives.length === 0) continue;

    y = checkPage(doc, y, 14 + alternatives.length * 9);
    y = subHeading(doc, `Alternatives relative to "${lc.name}"`, y);

    // Compute local weights from the matrix
    const n = m.nodeIds.length;
    const colSums = Array(n).fill(0);
    for (let j = 0; j < n; j++)
      for (let i2 = 0; i2 < n; i2++)
        colSums[j] += m.values[m.nodeIds[i2]]?.[m.nodeIds[j]] ?? 1;

    const localW = m.nodeIds.map((_: string, i2: number) => {
      const row = m.nodeIds.map((_2: string, j: number) =>
        (m.values[m.nodeIds[i2]]?.[m.nodeIds[j]] ?? 1) / colSums[j]
      );
      return row.reduce((a: number, b: number) => a + b, 0) / n;
    });

    const items = alternatives.map(a => {
      const idx = m.nodeIds.indexOf(a.id);
      return { label: a.name, value: idx >= 0 ? localW[idx] : 0 };
    });
    const barColors: [number,number,number][] = [TEAL, NAVY, [5,150,105], [124,58,237], [217,119,6]];
    y = drawBarChart(doc, items, ML, y, CW, 6, 2, barColors);
    y += 6;
  }

  // ── SECTION 4: GLOBAL ALTERNATIVE WEIGHTS ────────────────────────────────
  y = checkPage(doc, y, 20);
  y = sectionHeading(doc, "4. Step 4 — Global Alternative Weights (Consolidated)", y);

  const altData = alternatives
    .map(a => ({ label: a.name, value: results.globalWeights[a.id] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const altColors: [number,number,number][] = altData.map((_, i) =>
    i === 0 ? EMERALD : i === 1 ? TEAL : SLATE
  );
  y = drawBarChart(doc, altData, ML, y, CW, 8, 3, altColors);
  y += 8;

  // Ranking table
  y = checkPage(doc, y, 10 + altData.length * 8);
  const rankColW = [12, CW - 12 - 40 - 40, 40, 40];
  const rankColX = [ML, ML + rankColW[0], ML + rankColW[0] + rankColW[1], ML + rankColW[0] + rankColW[1] + rankColW[2]];

  fillRect(doc, ML, y, CW, 7, NAVY);
  ["#", "Alternative", "Global Weight", "% of Total"].forEach((h, i) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, WHITE);
    doc.text(h, rankColX[i] + 2, y + 5);
  });
  y += 7;

  altData.forEach((a, idx) => {
    y = checkPage(doc, y, 8);
    if (idx % 2 === 0) fillRect(doc, ML, y, CW, 7, LIGHT);
    if (idx === 0) fillRect(doc, ML, y, CW, 7, [209, 250, 229]);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
    setTextColor(doc, DARK);
    doc.text(`${idx + 1}`, rankColX[0] + 2, y + 5);
    doc.text(truncate(doc, a.label, rankColW[1] - 4), rankColX[1] + 2, y + 5);
    doc.text(`${(a.value * 100).toFixed(2)}%`, rankColX[2] + 2, y + 5);
    const total = altData.reduce((s, x) => s + x.value, 0);
    doc.text(`${total > 0 ? ((a.value / total) * 100).toFixed(1) : "—"}%`, rankColX[3] + 2, y + 5);
    y += 7;
  });
  y += 8;

  // ── SECTION 5: CONSISTENCY ANALYSIS ──────────────────────────────────────
  y = checkPage(doc, y, 20);
  y = sectionHeading(doc, "5. Step 5 — Consistency Analysis (CR ≤ 10% threshold)", y);

  const crColW = [CW - 30, 30];
  const crColX = [ML, ML + crColW[0]];

  fillRect(doc, ML, y, CW, 7, NAVY);
  ["Comparison Matrix", "CR"].forEach((h, i) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, WHITE);
    doc.text(h, crColX[i] + 2, y + 5);
  });
  y += 7;

  Object.entries(results.consistencyRatios).forEach(([matrixId, cr], idx) => {
    y = checkPage(doc, y, 8);
    if (idx % 2 === 0) fillRect(doc, ML, y, CW, 7, LIGHT);
    const ok = cr <= 0.1;
    const m = matrices.find((mx: PairwiseMatrix) => mx.parentId === matrixId);
    let label = "Unknown matrix";
    if (m) {
      const parentName = m.parentId === "objective" ? objective : (nameMap[m.parentId] ?? m.parentId);
      label = m.comparisonType === "importance"
        ? `Criteria relative to "${parentName}"`
        : `Alternatives relative to "${parentName}"`;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setTextColor(doc, DARK);
    doc.text(truncate(doc, label, crColW[0] - 4), crColX[0] + 2, y + 5);
    setTextColor(doc, ok ? EMERALD : AMBER);
    doc.setFont("helvetica", "bold");
    doc.text(`${(cr * 100).toFixed(2)}%`, crColX[1] + 2, y + 5);
    y += 7;
  });
  y += 6;

  // Note
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  setTextColor(doc, SLATE);
  doc.text(
    "CR > 10% indicates inconsistent judgments. Consider revising those pairwise comparisons.",
    ML, y
  );
  y += 10;

  // ── FOOTER on every page ──────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    hRule(doc, PH - 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    setTextColor(doc, SLATE);
    doc.text("AHP Decision Tool · Based on Saaty (1980) · For educational use", ML, PH - 7);
    doc.text(`Page ${p} of ${totalPages}`, PW - MR, PH - 7, { align: "right" });
  }

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const filename = `AHP_${objective.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.pdf`;
  doc.save(filename);
}
