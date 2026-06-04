"use strict";

const base = {
  c: { xv: 4, xp: 3 },
  rhs: {
    valves: 1000,
    labor: 1600,
    fabric: 2688,
    mix: 200,
    demand: 100
  }
};

const constraintDefs = [
  { id: "valves", name: "Valves", a: [2, 0], sense: "<=", rhsKey: "valves", unit: "valves", color: "#1d4ed8" },
  { id: "labor", name: "Labor", a: [2.5, 1], sense: "<=", rhsKey: "labor", unit: "hours", color: "#be123c" },
  { id: "fabric", name: "Fabric", a: [2.7, 3], sense: "<=", rhsKey: "fabric", unit: "ft2", color: "#0891b2" },
  { id: "mix", name: "Difference", a: [-1, 1], sense: "<=", rhsKey: "mix", unit: "units", color: "#16a34a" },
  { id: "demand", name: "Commitment", a: [1, 1], sense: ">=", rhsKey: "demand", unit: "masks", color: "#ea580c" }
];

const parameterDefs = [
  { id: "c.xv", group: "objective", label: "OktoValve profit coefficient", min: 0, max: 10, step: 0.1, base: 4, color: "#64748b" },
  { id: "c.xp", group: "objective", label: "OktoPrint profit coefficient", min: 0, max: 10, step: 0.1, base: 3, color: "#94a3b8" },
  { id: "rhs.valves", group: "rhs", constraint: "valves", label: "Valves available", min: 250, max: 1600, step: 10, base: 1000 },
  { id: "rhs.labor", group: "rhs", constraint: "labor", label: "Labor available", min: 700, max: 2300, step: 10, base: 1600 },
  { id: "rhs.fabric", group: "rhs", constraint: "fabric", label: "Fabric available", min: 1200, max: 3800, step: 12, base: 2688 },
  { id: "rhs.mix", group: "rhs", constraint: "mix", label: "#OktoPrints may exceed #OktoValves by", min: 0, max: 600, step: 5, base: 200 },
  { id: "rhs.demand", group: "rhs", constraint: "demand", label: "Minimum total demand", min: 0, max: 700, step: 10, base: 100 }
];

const state = {
  params: structuredClone(base),
  activeParam: null,
  controlsReady: false,
  target: null,
  targetParams: cloneParams(base),
  display: null,
  displayParams: null,
  camera: { yaw: 0, pitch: 0.58, roll: 0, scale: 1 },
  dragging: false,
  dragStart: null
};

const els = {
  formula: document.getElementById("formula-block"),
  controls: document.getElementById("controls"),
  activeChange: document.getElementById("active-change"),
  rangeSummary: document.getElementById("range-summary"),
  baseSolution: document.getElementById("base-solution"),
  baseProfit: document.getElementById("base-profit"),
  xv: document.getElementById("xv-value"),
  xp: document.getElementById("xp-value"),
  obj: document.getElementById("objective-value"),
  delta: document.getElementById("profit-delta"),
  variableReport: document.getElementById("variable-report"),
  constraintReport: document.getElementById("constraint-report"),
  legend3d: document.getElementById("constraint-legend-3d"),
  legend2d: document.getElementById("constraint-legend-2d"),
  canvas: document.getElementById("scene"),
  plane: document.getElementById("plane"),
  reset: document.getElementById("reset-all"),
  home: document.getElementById("view-home")
};

const ctx = els.canvas.getContext("2d");
const planeCtx = els.plane.getContext("2d");
const EXCEL_INF = 1e30;
const baseSolution = solveLP(base);
const baseReport = reportRows(base, baseSolution);

function parameterColor(def) {
  if (def.color) return def.color;
  return constraintDefs.find((constraint) => constraint.id === def.constraint)?.color || "#2563eb";
}

function cloneParams(params) {
  return { c: { ...params.c }, rhs: { ...params.rhs } };
}

function getParamValue(params, id) {
  const [scope, key] = id.split(".");
  return params[scope][key];
}

function setParamValue(params, id, value) {
  const [scope, key] = id.split(".");
  params[scope][key] = value;
}

function blendParams(a, b, t) {
  return {
    c: {
      xv: a.c.xv + (b.c.xv - a.c.xv) * t,
      xp: a.c.xp + (b.c.xp - a.c.xp) * t
    },
    rhs: Object.fromEntries(Object.keys(a.rhs).map((key) => [key, a.rhs[key] + (b.rhs[key] - a.rhs[key]) * t]))
  };
}

function rhsFor(def, params) {
  return params.rhs[def.rhsKey];
}

function lhs(def, point) {
  return def.a[0] * point.x + def.a[1] * point.y;
}

function isFeasible(point, params) {
  if (point.x < -1e-6 || point.y < -1e-6) return false;
  return constraintDefs.every((def) => {
    const left = lhs(def, point);
    const right = rhsFor(def, params);
    return def.sense === "<=" ? left <= right + 1e-6 : left >= right - 1e-6;
  });
}

function boundaryLines(params) {
  const lines = constraintDefs.map((def) => ({ id: def.id, name: def.name, a: def.a, b: rhsFor(def, params), def }));
  lines.push({ id: "x0", name: "Xv = 0", a: [1, 0], b: 0 });
  lines.push({ id: "y0", name: "Xp = 0", a: [0, 1], b: 0 });
  return lines;
}

function intersect(l1, l2) {
  const [a1, b1] = l1.a;
  const [a2, b2] = l2.a;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return null;
  return {
    x: (l1.b * b2 - l2.b * b1) / det,
    y: (a1 * l2.b - a2 * l1.b) / det,
    lines: [l1.id, l2.id]
  };
}

function solveLP(params) {
  const lines = boundaryLines(params);
  const vertices = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const point = intersect(lines[i], lines[j]);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (isFeasible(point, params)) {
        const duplicate = vertices.find((v) => Math.hypot(v.x - point.x, v.y - point.y) < 1e-5);
        if (!duplicate) vertices.push(point);
      }
    }
  }

  vertices.sort((a, b) => {
    const cx = vertices.reduce((sum, p) => sum + p.x, 0) / Math.max(vertices.length, 1);
    const cy = vertices.reduce((sum, p) => sum + p.y, 0) / Math.max(vertices.length, 1);
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  let optimum = null;
  for (const v of vertices) {
    const z = params.c.xv * v.x + params.c.xp * v.y;
    if (!optimum || z > optimum.z + 1e-7) optimum = { ...v, z };
  }

  return { vertices, optimum, lines };
}

function activeConstraints(point, params) {
  if (!point) return [];
  const active = [];
  constraintDefs.forEach((def, index) => {
    const diff = lhs(def, point) - rhsFor(def, params);
    if (Math.abs(diff) < 1e-5) active.push(def.id);
  });
  if (Math.abs(point.x) < 1e-5) active.push("xv");
  if (Math.abs(point.y) < 1e-5) active.push("xp");
  return active;
}

function sameOptimum(current, trial, params) {
  if (!current || !trial.optimum) return false;
  const currentValueAtTrial = params.c.xv * current.x + params.c.xp * current.y;
  return Math.abs(trial.optimum.z - currentValueAtTrial) <= 1e-4 && Math.hypot(trial.optimum.x - current.x, trial.optimum.y - current.y) <= 1e-3;
}

function activeSignature(point, params) {
  return activeConstraints(point, params)
    .filter((id) => !["xv", "xp"].includes(id))
    .sort()
    .join("|");
}

function sameBasis(current, currentParams, trial, trialParams) {
  if (!current || !trial.optimum) return false;
  return activeSignature(current, currentParams) === activeSignature(trial.optimum, trialParams);
}

function findRange(params, paramId, min, max, baseValue, currentOpt, mode = "point") {
  const test = (value) => {
    const trialParams = cloneParams(params);
    setParamValue(trialParams, paramId, value);
    const trial = solveLP(trialParams);
    return mode === "basis" ? sameBasis(currentOpt, params, trial, trialParams) : sameOptimum(currentOpt, trial, trialParams);
  };

  let low = baseValue;
  let high = baseValue;
  if (test(min)) {
    low = min;
  } else {
    let lo = min;
    let hi = baseValue;
    for (let k = 0; k < 34; k += 1) {
      const mid = (lo + hi) / 2;
      if (test(mid)) hi = mid;
      else lo = mid;
    }
    low = hi;
  }

  if (test(max)) {
    high = max;
  } else {
    let lo = baseValue;
    let hi = max;
    for (let k = 0; k < 34; k += 1) {
      const mid = (lo + hi) / 2;
      if (test(mid)) lo = mid;
      else hi = mid;
    }
    high = lo;
  }
  return { low, high, inc: high - baseValue, dec: baseValue - low };
}

function solverRange(params, paramId, baseValue, currentOpt, mode) {
  return findRange(params, paramId, -1000000, 1000000, baseValue, currentOpt, mode);
}

function derivative(params, id, step) {
  const baseSolve = solveLP(params);
  const p1 = cloneParams(params);
  const p2 = cloneParams(params);
  const v = getParamValue(params, id);
  setParamValue(p1, id, v + step);
  setParamValue(p2, id, Math.max(0, v - step));
  const s1 = solveLP(p1);
  const s2 = solveLP(p2);
  if (!baseSolve.optimum || !s1.optimum || !s2.optimum) return 0;
  const denom = getParamValue(p1, id) - getParamValue(p2, id);
  return denom === 0 ? 0 : (s1.optimum.z - s2.optimum.z) / denom;
}

function shadowPriceFor(def, params, opt) {
  if (!opt) return 0;
  const active = activeConstraints(opt, params)
    .map((id) => constraintDefs.find((constraint) => constraint.id === id))
    .filter(Boolean);
  if (active.length !== 2 || !active.some((constraint) => constraint.id === def.id)) {
    return derivative(params, `rhs.${def.id}`, Math.max(0.1, Math.abs(rhsFor(def, params)) * 0.0005));
  }
  const [r1, r2] = active;
  const det = r1.a[0] * r2.a[1] - r2.a[0] * r1.a[1];
  if (Math.abs(det) < 1e-9) return 0;
  const inv = [
    [r2.a[1] / det, -r1.a[1] / det],
    [-r2.a[0] / det, r1.a[0] / det]
  ];
  const col = active.findIndex((constraint) => constraint.id === def.id);
  const dx = inv[0][col];
  const dy = inv[1][col];
  return params.c.xv * dx + params.c.xp * dy;
}

function fmt(value, digits = 2) {
  if (Math.abs(value) >= EXCEL_INF * 0.5) return "1E+30";
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.abs(value) < 1e-8 ? 0 : value;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtFlex(value) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 100) return fmt(value, 1);
  return fmt(value, 2);
}

function activeRange() {
  if (!state.activeParam) return null;
  const variable = baseReport.vars.find((row) => row.id === state.activeParam);
  if (variable) {
    return {
      kind: "objective",
      base: variable.coeff,
      low: variable.dec >= EXCEL_INF * 0.5 ? -EXCEL_INF : variable.coeff - variable.dec,
      high: variable.inc >= EXCEL_INF * 0.5 ? EXCEL_INF : variable.coeff + variable.inc,
      label: variable.name
    };
  }
  const constraint = baseReport.constraints.find((row) => row.id === state.activeParam);
  if (constraint) {
    return {
      kind: "rhs",
      base: constraint.rhs,
      low: constraint.dec >= EXCEL_INF * 0.5 ? -EXCEL_INF : constraint.rhs - constraint.dec,
      high: constraint.inc >= EXCEL_INF * 0.5 ? EXCEL_INF : constraint.rhs + constraint.inc,
      label: constraint.name
    };
  }
  return null;
}

function rangeStatus(range, current) {
  if (!range) return { inside: true, text: "Base case" };
  const inside = current >= range.low - 1e-7 && current <= range.high + 1e-7;
  const low = range.low <= -EXCEL_INF * 0.5 ? "-infinity" : fmt(range.low);
  const high = range.high >= EXCEL_INF * 0.5 ? "infinity" : fmt(range.high);
  return {
    inside,
    text: `${range.label}: allowable ${low} to ${high}. Current ${fmt(current)} is ${inside ? "inside" : "outside"} the range.`
  };
}

function buildFormula() {
  const lines = [
    { id: "c", eq: `maximize <b>${fmtFlex(state.params.c.xv)}</b>Xv + <b>${fmtFlex(state.params.c.xp)}</b>Xp`, name: "" },
    ...constraintDefs.map((def) => ({
      id: def.id,
      eq: `${def.a[0]}Xv ${def.a[1] < 0 ? "-" : "+"} ${Math.abs(def.a[1])}Xp ${def.sense} <b>${fmtFlex(rhsFor(def, state.params))}</b>`,
      name: def.name
    })),
    { id: "nonneg", eq: "Xv >= 0, Xp >= 0", name: "" }
  ];
  els.formula.innerHTML = lines.map((line) => {
    const active = (state.activeParam?.startsWith("c.") && line.id === "c") || state.activeParam === `rhs.${line.id}`;
    return `<div class="formula-line ${active ? "active" : ""}"><span>${line.eq}</span><span class="constraint-name">${line.name}</span></div>`;
  }).join("");
}

function buildLegends() {
  const html = constraintDefs.map((def) => `<span class="legend-item" style="--legend-color: ${def.color}">${def.name}</span>`).join("");
  els.legend3d.innerHTML = html;
  els.legend2d.innerHTML = html;
}

function buildControls() {
  els.controls.innerHTML = parameterDefs.map((def) => {
    const value = getParamValue(state.params, def.id);
    return `
      <div class="control-item ${state.activeParam === def.id ? "active" : ""}" data-param="${def.id}" style="--param-color: ${parameterColor(def)}">
        <div class="control-main">
          <label for="${def.id}">${def.label}</label>
          <input aria-label="${def.label}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}" data-range="${def.id}">
          <input id="${def.id}" type="number" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}">
        </div>
        <div class="sensitivity-meter" data-meter="${def.id}">
          <div class="meter-track">
            <span class="allowable-band"></span>
            <span class="current-marker"></span>
          </div>
          <div class="meter-labels">
            <span class="meter-low"></span>
            <span class="range-status"></span>
            <span class="meter-high"></span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  parameterDefs.forEach((def) => {
    const number = document.getElementById(def.id);
    const range = document.querySelector(`[data-range="${def.id}"]`);
    const handler = (raw) => {
      const value = Math.max(def.min, Math.min(def.max, Number(raw)));
      state.params = cloneParams(base);
      state.activeParam = def.id;
      setParamValue(state.params, def.id, value);
      updateAll();
    };
    number.addEventListener("input", (event) => handler(event.target.value));
    range.addEventListener("input", (event) => handler(event.target.value));
  });
  state.controlsReady = true;
}

function syncControls() {
  parameterDefs.forEach((def) => {
    const value = getParamValue(state.params, def.id);
    const number = document.getElementById(def.id);
    const range = document.querySelector(`[data-range="${def.id}"]`);
    const wrapper = document.querySelector(`[data-param="${def.id}"]`);
    const meter = document.querySelector(`[data-meter="${def.id}"]`);
    if (number && document.activeElement !== number) number.value = value;
    if (range && document.activeElement !== range) range.value = value;
    if (wrapper) wrapper.classList.toggle("active", state.activeParam === def.id);
    if (meter) syncMeter(meter, def, value);
  });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function syncMeter(meter, def, value) {
  const range = state.activeParam === def.id ? activeRange() : null;
  if (!range) return;
  const low = Math.max(def.min, range.low <= -EXCEL_INF * 0.5 ? def.min : range.low);
  const high = Math.min(def.max, range.high >= EXCEL_INF * 0.5 ? def.max : range.high);
  const span = def.max - def.min || 1;
  const left = clampPercent(((low - def.min) / span) * 100);
  const right = clampPercent(((high - def.min) / span) * 100);
  const current = clampPercent(((value - def.min) / span) * 100);
  meter.style.setProperty("--allow-left", `${left}%`);
  meter.style.setProperty("--allow-width", `${Math.max(0, right - left)}%`);
  meter.style.setProperty("--current-left", `${current}%`);
  meter.querySelector(".meter-low").textContent = range.low <= -EXCEL_INF * 0.5 ? "-infinity" : fmt(range.low);
  meter.querySelector(".meter-high").textContent = range.high >= EXCEL_INF * 0.5 ? "infinity" : fmt(range.high);
  const status = rangeStatus(range, value);
  const statusEl = meter.querySelector(".range-status");
  statusEl.textContent = status.inside ? "Inside Solver allowable range" : "Outside Solver allowable range";
  statusEl.classList.toggle("outside", !status.inside);
}

function reportRows(params, solution) {
  const opt = solution.optimum;
  const vars = [
    { id: "c.xv", cell: "$B$2", name: "Xv OktoValve", final: opt?.x ?? 0, coeff: params.c.xv },
    { id: "c.xp", cell: "$C$2", name: "Xp OktoPrint", final: opt?.y ?? 0, coeff: params.c.xp }
  ].map((row) => {
    const range = opt ? solverRange(params, row.id, row.coeff, opt, "point") : { inc: 0, dec: 0 };
    return {
      ...row,
      reduced: row.final > 1e-5 ? 0 : derivative(params, row.id, 0.01),
      inc: range.high >= 999999 ? EXCEL_INF : range.inc,
      dec: range.low <= -999999 ? EXCEL_INF : range.dec
    };
  });

  const constraints = constraintDefs.map((def, index) => {
    const right = rhsFor(def, params);
    const finalValue = opt ? lhs(def, opt) : 0;
    const slack = def.sense === "<=" ? right - finalValue : finalValue - right;
    const binding = Math.abs(slack) < 1e-4;
    const range = opt ? solverRange(params, `rhs.${def.id}`, right, opt, "basis") : { inc: 0, dec: 0 };
    let inc = range.high >= 999999 ? EXCEL_INF : range.inc;
    let dec = range.low <= -999999 ? EXCEL_INF : range.dec;
    if (!binding && def.sense === "<=") {
      inc = EXCEL_INF;
      dec = Math.max(0, slack);
    }
    if (!binding && def.sense === ">=") {
      inc = Math.max(0, slack);
      dec = EXCEL_INF;
    }
    return {
      id: `rhs.${def.id}`,
      cell: `$${String.fromCharCode(66 + index)}$6`,
      name: def.name,
      final: finalValue,
      shadow: binding ? shadowPriceFor(def, params, opt) : 0,
      rhs: right,
      inc,
      dec,
      binding
    };
  });
  return { vars, constraints };
}

function renderReports(params, solution) {
  const rows = reportRows(params, solution);
  els.variableReport.innerHTML = rows.vars.map((row) => `
    <tr class="${state.activeParam === row.id ? "active" : ""}">
      <td>${row.name}</td>
      <td>${fmt(row.final)}</td>
      <td>${fmt(row.reduced)}</td>
      <td>${fmt(row.coeff)}</td>
      <td>${fmt(row.inc)}</td>
      <td>${fmt(row.dec)}</td>
    </tr>
  `).join("");

  els.constraintReport.innerHTML = rows.constraints.map((row) => `
    <tr class="${state.activeParam === row.id ? "active" : ""} ${row.binding ? "binding" : ""}">
      <td class="constraint-report-name" style="color: ${constraintDefs.find((def) => `rhs.${def.id}` === row.id)?.color || "#111827"}">${row.name}</td>
      <td>${fmt(row.final)}</td>
      <td>${fmt(row.shadow)}</td>
      <td>${fmt(row.rhs)}</td>
      <td>${fmt(row.inc)}</td>
      <td>${fmt(row.dec)}</td>
    </tr>
  `).join("");
}

function updateRangeSummary() {
  const def = parameterDefs.find((p) => p.id === state.activeParam);
  if (!def) {
    els.rangeSummary.textContent = "";
    return;
  }
  const value = getParamValue(state.params, def.id);
  const status = rangeStatus(activeRange(), value);
  els.rangeSummary.textContent = status.text;
  els.rangeSummary.classList.toggle("outside", !status.inside);
}

function updateAll() {
  const solution = solveLP(state.params);
  state.target = solution;
  state.targetParams = cloneParams(state.params);
  if (!state.display) state.display = solution;
  if (!state.displayParams) state.displayParams = cloneParams(state.params);
  buildFormula();
  if (!state.controlsReady) buildControls();
  syncControls();
  renderReports(base, baseSolution);
  updateRangeSummary();
  const activeDef = parameterDefs.find((p) => p.id === state.activeParam);
  els.activeChange.textContent = activeDef ? activeDef.label : "Base case";
  if (baseSolution.optimum) {
    els.baseSolution.innerHTML = `<span>Xv = ${fmt(baseSolution.optimum.x, 0)}</span><span>Xp = ${fmt(baseSolution.optimum.y, 0)}</span>`;
    els.baseProfit.textContent = `$${fmt(baseSolution.optimum.z)}`;
  }
  if (solution.optimum) {
    els.xv.textContent = fmt(solution.optimum.x);
    els.xp.textContent = fmt(solution.optimum.y);
    els.obj.textContent = `$${fmt(solution.optimum.z)}`;
    const delta = solution.optimum.z - (baseSolution.optimum?.z || 0);
    els.delta.textContent = `${delta >= 0 ? "+" : "-"}$${fmt(Math.abs(delta))}`;
  } else {
    els.xv.textContent = "-";
    els.xp.textContent = "-";
    els.obj.textContent = "Infeasible";
    els.delta.textContent = "-";
  }
}

function interpolateSolution() {
  if (!state.target) return;
  if (!state.display || !state.display.optimum || !state.target.optimum) {
    state.display = state.target;
    state.displayParams = cloneParams(state.targetParams);
    return;
  }
  const blendPoint = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t });
  const t = 0.16;
  const vertices = state.target.vertices.map((targetVertex) => {
    const current = nearestVertex(state.display.vertices, targetVertex) || targetVertex;
    return blendPoint(current, targetVertex, t);
  });
  state.display = {
    ...state.target,
    vertices,
    optimum: blendPoint(state.display.optimum, state.target.optimum, t)
  };
  state.displayParams = blendParams(state.displayParams || state.targetParams, state.targetParams, t);
}

function nearestVertex(vertices, target) {
  if (!vertices.length) return null;
  return vertices.reduce((best, point) => {
    const dist = Math.hypot(point.x - target.x, point.y - target.y);
    return !best || dist < best.dist ? { point, dist } : best;
  }, null).point;
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const planeRect = els.plane.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(700, Math.floor(rect.width * dpr));
  els.canvas.height = Math.max(460, Math.floor(rect.height * dpr));
  els.plane.width = Math.max(700, Math.floor(planeRect.width * dpr));
  els.plane.height = Math.max(300, Math.floor(planeRect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  planeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function worldScale(solution, params = state.params) {
  const maxX = Math.max(700, ...solution.vertices.map((v) => v.x), solution.optimum?.x || 0);
  const maxY = Math.max(700, ...solution.vertices.map((v) => v.y), solution.optimum?.y || 0);
  const maxZ = Math.max(3600, ...solution.vertices.map((v) => params.c.xv * v.x + params.c.xp * v.y));
  return { maxX, maxY, maxZ };
}

function project(point, dims, scaleInfo) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(els.canvas.clientWidth, els.canvas.width / dpr, 700);
  const h = Math.max(els.canvas.clientHeight, els.canvas.height / dpr, 460);
  const nx = point.x / scaleInfo.maxX - 0.5;
  const ny = point.y / scaleInfo.maxY - 0.5;
  const nz = point.z / scaleInfo.maxZ;
  const yaw = state.camera.yaw;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const rx = nx * cy - ny * sy;
  const ry = nx * sy + ny * cy;
  const s = Math.min(w, h) * 0.92 * state.camera.scale;
  const slant = 0.44 + state.camera.pitch * 0.18;
  const depth = 0.22 + state.camera.pitch * 0.25;
  const px = (rx + ry * slant) * s;
  const py = (-ry * depth - nz * 0.96) * s;
  const cr = Math.cos(state.camera.roll);
  const sr = Math.sin(state.camera.roll);
  return {
    x: w * 0.5 + px * cr - py * sr,
    y: h * 0.76 + px * sr + py * cr,
    depth: ry + nz
  };
}

function drawPolygon(points, fill, stroke, width = 1) {
  const cleanPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (cleanPoints.length < 2) return;
  ctx.beginPath();
  cleanPoints.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawCircle(point, radius, fill, stroke = "#ffffff", width = 1.5) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawLine(a, b, stroke, width = 1) {
  if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawDashedLine(a, b, stroke, width = 1, dash = [4, 5]) {
  ctx.save();
  ctx.setLineDash(dash);
  drawLine(a, b, stroke, width);
  ctx.restore();
}

function drawArrow(a, b, stroke, width = 2) {
  if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;
  drawLine(a, b, stroke, width);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 11;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - size * Math.cos(angle - 0.42), b.y - size * Math.sin(angle - 0.42));
  ctx.lineTo(b.x - size * Math.cos(angle + 0.42), b.y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fillStyle = stroke;
  ctx.fill();
}

function drawLabel(text, p, color = "#344054", dx = 6, dy = -6) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillText(text, p.x + dx, p.y + dy);
  ctx.restore();
}

function boundarySegment(def, params, maxX, maxY) {
  const candidates = [];
  const b = rhsFor(def, params);
  const [a, c] = def.a;
  if (Math.abs(c) > 1e-9) {
    candidates.push({ x: 0, y: b / c });
    candidates.push({ x: maxX, y: (b - a * maxX) / c });
  }
  if (Math.abs(a) > 1e-9) {
    candidates.push({ x: b / a, y: 0 });
    candidates.push({ x: (b - c * maxY) / a, y: maxY });
  }
  const valid = candidates.filter((p) => p.x >= -1e-6 && p.y >= -1e-6 && p.x <= maxX + 1e-6 && p.y <= maxY + 1e-6);
  if (valid.length < 2) return null;
  return [valid[0], valid.find((p) => Math.hypot(p.x - valid[0].x, p.y - valid[0].y) > 1e-4) || valid[1]];
}

function draw2D(solution, params) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(els.plane.clientWidth, els.plane.width / dpr, 700);
  const h = Math.max(els.plane.clientHeight, els.plane.height / dpr, 300);
  planeCtx.clearRect(0, 0, w, h);
  const bg = planeCtx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#f8fafc");
  planeCtx.fillStyle = bg;
  planeCtx.fillRect(0, 0, w, h);
  if (!solution.optimum) {
    planeCtx.fillStyle = "#7c2d12";
    planeCtx.font = "800 16px Inter, sans-serif";
    planeCtx.fillText("No feasible region for this setting", 24, 38);
    return;
  }

  const scaleInfo = worldScale(solution, params);
  const pad = { left: 64, right: 38, top: 32, bottom: 58 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const scale = Math.min(plotW / scaleInfo.maxX, plotH / scaleInfo.maxY);
  const usedW = scaleInfo.maxX * scale;
  const usedH = scaleInfo.maxY * scale;
  const xOffset = pad.left + (plotW - usedW) / 2;
  const yOffset = pad.top + (plotH - usedH) / 2;
  const to2D = (point) => ({
    x: xOffset + point.x * scale,
    y: yOffset + usedH - point.y * scale
  });

  planeCtx.strokeStyle = "#e5e7eb";
  planeCtx.lineWidth = 1;
  planeCtx.fillStyle = "#667085";
  planeCtx.font = "700 11px Inter, sans-serif";
  for (let i = 0; i <= 5; i += 1) {
    const xValue = (scaleInfo.maxX / 5) * i;
    const yValue = (scaleInfo.maxY / 5) * i;
    const gx = to2D({ x: xValue, y: 0 }).x;
    const gy = to2D({ x: 0, y: yValue }).y;
    planeCtx.beginPath();
    planeCtx.moveTo(gx, yOffset);
    planeCtx.lineTo(gx, yOffset + usedH);
    planeCtx.moveTo(xOffset, gy);
    planeCtx.lineTo(xOffset + usedW, gy);
    planeCtx.stroke();
    if (i > 0) {
      planeCtx.fillText(fmt(xValue, 0), gx - 10, yOffset + usedH + 18);
      planeCtx.fillText(fmt(yValue, 0), xOffset - 40, gy + 4);
    }
  }

  draw2DArrow(planeCtx, { x: xOffset, y: yOffset + usedH }, { x: xOffset + usedW + 14, y: yOffset + usedH }, "#111827", 2);
  draw2DArrow(planeCtx, { x: xOffset, y: yOffset + usedH }, { x: xOffset, y: yOffset - 14 }, "#111827", 2);

  const polygon = solution.vertices.map(to2D);
  if (polygon.length) {
    planeCtx.beginPath();
    polygon.forEach((point, index) => index ? planeCtx.lineTo(point.x, point.y) : planeCtx.moveTo(point.x, point.y));
    planeCtx.closePath();
    const fill = planeCtx.createLinearGradient(xOffset, yOffset, xOffset + usedW, yOffset + usedH);
    fill.addColorStop(0, "rgba(14, 165, 233, 0.22)");
    fill.addColorStop(1, "rgba(37, 99, 235, 0.12)");
    planeCtx.fillStyle = fill;
    planeCtx.fill();
    planeCtx.strokeStyle = "#2563eb";
    planeCtx.lineWidth = 2.5;
    planeCtx.stroke();
  }

  const placedLabels = [];
  constraintDefs.forEach((def) => {
    const seg = boundarySegment(def, params, scaleInfo.maxX, scaleInfo.maxY);
    if (!seg) return;
    const a = to2D(seg[0]);
    const b = to2D(seg[1]);
    planeCtx.strokeStyle = def.color;
    planeCtx.lineWidth = state.activeParam === `rhs.${def.id}` ? 3.2 : 2;
    planeCtx.beginPath();
    planeCtx.moveTo(a.x, a.y);
    planeCtx.lineTo(b.x, b.y);
    planeCtx.stroke();
    planeCtx.fillStyle = def.color;
    planeCtx.font = "750 11px Inter, sans-serif";
    if (def.id === "valves") {
      const intercept = to2D({ x: rhsFor(def, params) / def.a[0], y: 0 });
      draw2DLabelOnLine(planeCtx, def.name, intercept.x + 8, intercept.y - 10, def.color);
    } else if (def.id === "fabric") {
      const lowerRight = a.x + a.y > b.x + b.y ? a : b;
      const other = lowerRight === a ? b : a;
      const anchor = {
        x: lowerRight.x * 0.78 + other.x * 0.22,
        y: lowerRight.y * 0.78 + other.y * 0.22
      };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      draw2DLabelOnLine(planeCtx, def.name, anchor.x + nx * 3, anchor.y + ny * 3, def.color);
    } else {
      place2DLabel(planeCtx, placedLabels, def.name, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, def.color, constraintLabelPreference(def.id));
    }
  });

  const opt = to2D(solution.optimum);
  planeCtx.beginPath();
  planeCtx.arc(opt.x, opt.y, 6, 0, Math.PI * 2);
  planeCtx.fillStyle = "#f97316";
  planeCtx.fill();
  planeCtx.strokeStyle = "#fff";
  planeCtx.lineWidth = 2;
  planeCtx.stroke();
  planeCtx.fillStyle = "#111827";
  planeCtx.font = "800 12px Inter, sans-serif";
  planeCtx.fillText(`Optimum (${fmt(solution.optimum.x, 0)}, ${fmt(solution.optimum.y, 0)})`, opt.x + 9, opt.y - 9);
  planeCtx.fillStyle = "#1f2933";
  const active = state.activeParam ? rangeStatus(activeRange(), getParamValue(state.params, state.activeParam)) : null;
  if (active) {
    planeCtx.fillStyle = active.inside ? "#15803d" : "#b42318";
    planeCtx.font = "900 13px Inter, sans-serif";
    const statusText = active.inside ? "Inside allowable range" : "Outside allowable range";
    const statusWidth = planeCtx.measureText(statusText).width;
    planeCtx.fillText(statusText, xOffset + usedW - statusWidth, yOffset - 7);
  }
  planeCtx.fillStyle = "#1f2933";
  planeCtx.font = "800 12px Inter, sans-serif";
  planeCtx.fillText("Xv", xOffset + usedW + 20, yOffset + usedH + 6);
  planeCtx.fillText("Xp", xOffset + 8, yOffset + 18);
}

function draw2DArrow(context, a, b, stroke, width = 2) {
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = stroke;
  context.lineWidth = width;
  context.stroke();
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 9;
  context.beginPath();
  context.moveTo(b.x, b.y);
  context.lineTo(b.x - size * Math.cos(angle - 0.45), b.y - size * Math.sin(angle - 0.45));
  context.lineTo(b.x - size * Math.cos(angle + 0.45), b.y - size * Math.sin(angle + 0.45));
  context.closePath();
  context.fillStyle = stroke;
  context.fill();
}

function constraintLabelPreference(id) {
  return {
    valves: [{ dx: 10, dy: 16 }, { dx: 10, dy: -10 }, { dx: -78, dy: 16 }],
    labor: [{ dx: 16, dy: 38 }, { dx: -88, dy: 38 }, { dx: 16, dy: -54 }],
    fabric: [{ dx: 12, dy: -10 }, { dx: 12, dy: 24 }],
    mix: [{ dx: 12, dy: -20 }, { dx: 12, dy: 28 }],
    demand: [{ dx: 12, dy: 20 }, { dx: -92, dy: 20 }]
  }[id] || [];
}

function place2DLabel(context, labels, text, anchor, color, preferred = []) {
  const metrics = context.measureText(text);
  const width = metrics.width + 10;
  const height = 15;
  const candidates = [...preferred,
    { dx: 7, dy: -7 },
    { dx: 7, dy: 16 },
    { dx: -width - 7, dy: -7 },
    { dx: -width - 7, dy: 16 },
    { dx: 14, dy: -24 },
    { dx: 14, dy: 31 },
    { dx: -width - 14, dy: -24 },
    { dx: -width - 14, dy: 31 }
  ];
  let chosen = candidates[0];
  for (const candidate of candidates) {
    const box = { x: anchor.x + candidate.dx, y: anchor.y + candidate.dy - height + 4, w: width, h: height };
    const overlaps = labels.some((label) => !(box.x + box.w < label.x || label.x + label.w < box.x || box.y + box.h < label.y || label.y + label.h < box.y));
    if (!overlaps) {
      chosen = candidate;
      labels.push(box);
      break;
    }
  }
  context.fillStyle = color;
  context.fillText(text, anchor.x + chosen.dx, anchor.y + chosen.dy);
}

function draw2DLabelOnLine(context, text, x, y, color) {
  const width = context.measureText(text).width + 6;
  context.fillStyle = "rgba(255, 255, 255, 0.84)";
  context.fillRect(x - 3, y - 12, width, 15);
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function place3DLabel(labels, text, anchor, color, preferred = []) {
  const width = ctx.measureText(text).width + 10;
  const height = 15;
  const candidates = [...preferred,
    { dx: 8, dy: -8 },
    { dx: 8, dy: 18 },
    { dx: -width - 8, dy: -8 },
    { dx: -width - 8, dy: 18 },
    { dx: 16, dy: -30 },
    { dx: 16, dy: 38 },
    { dx: -width - 16, dy: -30 },
    { dx: -width - 16, dy: 38 }
  ];
  let chosen = candidates[0];
  for (const candidate of candidates) {
    const box = { x: anchor.x + candidate.dx, y: anchor.y + candidate.dy - height + 4, w: width, h: height };
    const overlaps = labels.some((label) => !(box.x + box.w < label.x || label.x + label.w < box.x || box.y + box.h < label.y || label.y + label.h < box.y));
    if (!overlaps) {
      chosen = candidate;
      labels.push(box);
      break;
    }
  }
  drawLabel(text, anchor, color, chosen.dx, chosen.dy);
}

function renderScene() {
  interpolateSolution();
  const solution = state.display || solveLP(state.params);
  const drawParams = state.displayParams || state.params;
  try {
    render3D(solution, drawParams);
  } catch (error) {
    draw3DFallback(error);
  }
  try {
    draw2D(solution, drawParams);
  } catch (error) {
    console.error(error);
  }
  requestAnimationFrame(renderScene);
}

function render3D(solution, drawParams) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(els.canvas.clientWidth, els.canvas.width / dpr, 700);
  const h = Math.max(els.canvas.clientHeight, els.canvas.height / dpr, 460);
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#f8fafc");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (!solution.optimum) {
    ctx.fillStyle = "#7c2d12";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText("No feasible region for this setting", 34, 48);
    return;
  }

  const scaleInfo = worldScale(solution, drawParams);
  const p = (x, y, z = 0) => project({ x, y, z }, null, scaleInfo);
  const floorCorners = [p(0, 0), p(scaleInfo.maxX, 0), p(scaleInfo.maxX, scaleInfo.maxY), p(0, scaleInfo.maxY)];
  drawPolygon(floorCorners, "rgba(241, 245, 249, 0.95)", "#d1d5db", 1);

  const gridCount = 5;
  for (let i = 1; i <= gridCount; i += 1) {
    const x = (scaleInfo.maxX / gridCount) * i;
    const y = (scaleInfo.maxY / gridCount) * i;
    drawLine(p(x, 0), p(x, scaleInfo.maxY), "rgba(148, 163, 184, 0.28)");
    drawLine(p(0, y), p(scaleInfo.maxX, y), "rgba(148, 163, 184, 0.28)");
  }

  const planeCorners = [
    { x: 0, y: 0 },
    { x: scaleInfo.maxX, y: 0 },
    { x: scaleInfo.maxX, y: scaleInfo.maxY },
    { x: 0, y: scaleInfo.maxY }
  ];
  const planeGradient = ctx.createLinearGradient(0, h * 0.15, w, h * 0.85);
  planeGradient.addColorStop(0, "rgba(226, 232, 36, 0.58)");
  planeGradient.addColorStop(0.55, "rgba(34, 197, 94, 0.38)");
  planeGradient.addColorStop(1, "rgba(20, 184, 166, 0.28)");
  const objectivePlane = planeCorners.map((v) => p(v.x, v.y, drawParams.c.xv * v.x + drawParams.c.xp * v.y));
  drawPolygon(objectivePlane, planeGradient, "#65a30d", 2.5);

  const feasibleFloor = solution.vertices.map((v) => p(v.x, v.y, 0));
  drawPolygon(feasibleFloor, "rgba(14, 165, 233, 0.34)", "#2563eb", 3);
  const objectiveVertices = solution.vertices.map((v) => p(v.x, v.y, drawParams.c.xv * v.x + drawParams.c.xp * v.y));
  objectiveVertices.forEach((point) => drawCircle(point, 5.5, "#ffffff", "#6b7280", 1));

  const placed3DLabels = [];
  constraintDefs.forEach((def) => {
    const seg = boundarySegment(def, drawParams, scaleInfo.maxX, scaleInfo.maxY);
    if (!seg) return;
    const a = p(seg[0].x, seg[0].y, 0);
    const b = p(seg[1].x, seg[1].y, 0);
    drawLine(a, b, def.color, state.activeParam === `rhs.${def.id}` ? 3.6 : 2.4);
    if (def.id === "valves") {
      const intercept = p(rhsFor(def, drawParams) / def.a[0], 0, 0);
      drawLabel(def.name, intercept, def.color, 8, -10);
    } else if (def.id === "fabric") {
      const lowerRight = a.x + a.y > b.x + b.y ? a : b;
      const other = lowerRight === a ? b : a;
      const anchor = {
        x: lowerRight.x * 0.78 + other.x * 0.22,
        y: lowerRight.y * 0.78 + other.y * 0.22
      };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      drawLabel(def.name, anchor, def.color, nx * 3, ny * 3);
    } else {
      const mid = p((seg[0].x + seg[1].x) / 2, (seg[0].y + seg[1].y) / 2, 0);
      place3DLabel(placed3DLabels, def.name, mid, def.color, constraintLabelPreference(def.id));
    }
  });

  drawArrow(p(0, 0, 0), p(scaleInfo.maxX, 0, 0), "#111827", 3);
  drawArrow(p(0, 0, 0), p(0, scaleInfo.maxY, 0), "#6b7280", 2.4);
  drawLine(p(0, 0, 0), p(0, 0, scaleInfo.maxZ), "#8b5cf6", 2);
  drawLabel("Xv (OktoValve masks)", p(scaleInfo.maxX, 0, 0), "#111827");
  drawLabel("Xp (OktoPrint masks)", p(0, scaleInfo.maxY, 0), "#4b5563");
  drawLabel("Profit", p(0, 0, scaleInfo.maxZ));

  const opt = solution.optimum;
  const optFloor = p(opt.x, opt.y, 0);
  const optTop = p(opt.x, opt.y, drawParams.c.xv * opt.x + drawParams.c.xp * opt.y);
  drawDashedLine(optFloor, optTop, "#f97316", 2, [3, 5]);
  drawCircle(optFloor, 5, "#2563eb", "#ffffff", 2);
  drawCircle(optTop, 7, "#f97316", "#ffffff", 2);
  drawLabel(`(${fmt(opt.x, 0)}, ${fmt(opt.y, 0)}, $${fmt(opt.z, 0)})`, optTop, "#111827");
}

function draw3DFallback(error) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(els.canvas.clientWidth, els.canvas.width / dpr, 700);
  const h = Math.max(els.canvas.clientHeight, els.canvas.height / dpr, 460);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fbfcff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#991b1b";
  ctx.font = "800 14px Inter, sans-serif";
  ctx.fillText("3D view could not render. Use Home or adjust a parameter to retry.", 24, 34);
  console.error(error);
}

els.reset.addEventListener("click", () => {
  state.params = cloneParams(base);
  state.activeParam = null;
  updateAll();
});

els.home.addEventListener("click", () => {
  state.camera.yaw = 0;
  state.camera.pitch = 0.58;
  state.camera.roll = 0;
  state.camera.scale = 1;
});

els.canvas.addEventListener("pointerdown", (event) => {
  state.dragging = true;
  state.dragStart = { x: event.clientX, y: event.clientY, yaw: state.camera.yaw, pitch: state.camera.pitch, roll: state.camera.roll, shift: event.shiftKey };
  els.canvas.setPointerCapture(event.pointerId);
});

function handle3DDrag(event) {
  if (!state.dragging) return;
  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  if (state.dragStart.shift || event.shiftKey) {
    state.camera.roll = state.dragStart.roll + dx * 0.008;
  } else {
    state.camera.yaw = state.dragStart.yaw + dx * 0.008;
    state.camera.pitch = Math.max(0.16, Math.min(1.15, state.dragStart.pitch + dy * 0.005));
  }
}

els.canvas.addEventListener("pointermove", handle3DDrag);
window.addEventListener("pointermove", handle3DDrag);

els.canvas.addEventListener("pointerup", () => {
  state.dragging = false;
});

window.addEventListener("pointerup", () => {
  state.dragging = false;
});

els.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  state.camera.scale = Math.max(0.72, Math.min(1.35, state.camera.scale - event.deltaY * 0.0008));
}, { passive: false });

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
buildLegends();
updateAll();
requestAnimationFrame(renderScene);
