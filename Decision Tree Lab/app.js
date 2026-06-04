const svg = document.getElementById("treeSvg");
const WORKSPACE_WIDTH = 2200;
const WORKSPACE_HEIGHT = 2600;
const WORKSPACE_TOP = 0;
const LABEL_TOP = 0;

const fields = {
  nodeName: document.getElementById("nodeName"),
  nodeType: document.getElementById("nodeType"),
  branchEditor: document.getElementById("branchEditor"),
};

const controls = {
  selectedTitle: document.getElementById("selectedTitle"),
  selectedBadge: document.getElementById("selectedBadge"),
  policyBanner: document.getElementById("policyBanner"),
  rollbackCard: document.getElementById("rollbackCard"),
  riskProfile: document.getElementById("riskProfile"),
  calcPayoffsBtn: document.getElementById("calcPayoffsBtn"),
  rollbackBtn: document.getElementById("rollbackBtn"),
  saveTreeBtn: document.getElementById("saveTreeBtn"),
  openTreeBtn: document.getElementById("openTreeBtn"),
  openTreeFile: document.getElementById("openTreeFile"),
  copyNodeBtn: document.getElementById("copyNodeBtn"),
  pasteNodeBtn: document.getElementById("pasteNodeBtn"),
};

const dialog = {
  el: document.getElementById("branchDialog"),
  form: document.getElementById("branchForm"),
  title: document.getElementById("dialogTitle"),
  nodeName: document.getElementById("dialogNodeName"),
  branchCount: document.getElementById("branchCount"),
  rows: document.getElementById("branchRows"),
};

let tree = makeRoot();
let selectedId = tree.id;
let pendingType = "decision";
let payoffMode = false;
let rollbackMode = false;
let rollbackSteps = [];
let rollbackStepIndex = -1;
let layoutNodes = [];
let layoutById = new Map();
let parentById = new Map();
let bestEdges = new Set();
let dragging = null;
let draggingLabel = null;
let resizingPanel = null;
let copiedNode = null;

function setPanelWidth(width) {
  const max = Math.max(620, window.innerWidth - 260);
  const next = Math.max(260, Math.min(max, width));
  document.documentElement.style.setProperty("--side-width", `${next}px`);
}

function makeRoot() {
  return {
    id: "root",
    name: "Start",
    type: "end",
    payoff: 0,
    branchLabel: "",
    branchCashFlow: 0,
    branchEntries: [],
    children: [],
    x: 160,
    y: 300,
  };
}

function makeId() {
  return `n-${Math.random().toString(36).slice(2, 9)}`;
}

function markDirty() {
  payoffMode = false;
  rollbackMode = false;
  rollbackSteps = [];
  rollbackStepIndex = -1;
  currentStepNodeId = null;
  bestEdges = new Set();
  traverse(tree, (node) => {
    delete node._terminalTotal;
    delete node._emv;
    delete node._bestChild;
  });
  controls.rollbackBtn.disabled = true;
  controls.rollbackBtn.querySelector("span:last-child").textContent = "Start Rollback";
  controls.policyBanner.classList.remove("complete");
  controls.policyBanner.textContent = "Tree changed. Calculate payoffs before rolling back.";
}

function findNode(id, node = tree, parent = null) {
  if (node.id === id) return { node, parent };
  for (const child of node.children || []) {
    const found = findNode(id, child, node);
    if (found) return found;
  }
  return null;
}

function traverse(node, visit, parent = null, depth = 0) {
  visit(node, parent, depth);
  (node.children || []).forEach((child) => traverse(child, visit, node, depth + 1));
}

function collectSubtree(node) {
  const nodes = [];
  traverse(node, (item) => nodes.push(item));
  return nodes;
}

function snapshotNodePosition(node) {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    labelX: node.labelX,
    labelY: node.labelY,
    probX: node.probX,
    probY: node.probY,
    nameX: node.nameX,
    nameY: node.nameY,
    emvX: node.emvX,
    emvY: node.emvY,
  };
}

function shiftDefined(value, delta, min, max) {
  return typeof value === "number" ? Math.max(min, Math.min(max, value + delta)) : value;
}

function truncateLabel(value) {
  return String(value || "").slice(0, 32);
}

function formatMoney(value) {
  const rounded = Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
  if (Object.is(rounded, -0)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(rounded);
}

function parseProbability(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.includes("/")) {
    const [numerator, denominator] = text.split("/").map((part) => Number(part.trim()));
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return Number.NaN;
  }
  return Number(text);
}

function formatProbabilityInput(value) {
  return value ?? "";
}

function formatProbabilityLabel(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function compactText(value, max = 54) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getBranchCashFlow(node) {
  if (Array.isArray(node.branchEntries) && node.branchEntries.length) {
    return node.branchEntries.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  }
  return Number(node.branchCashFlow || 0);
}

function formatEntries(entries = []) {
  return entries.map((entry) => `${entry.label || "Get/pay"}: ${Number(entry.value || 0)}`).join("\n");
}

function parseEntries(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":");
      const maybeValue = Number(parts.at(-1).trim());
      if (Number.isFinite(maybeValue) && parts.length > 1) {
        return { label: truncateLabel(parts.slice(0, -1).join(":").trim()) || "Get/pay", value: maybeValue };
      }
      const bareValue = Number(line);
      return Number.isFinite(bareValue) ? { label: "Get/pay", value: bareValue } : null;
    })
    .filter(Boolean);
}

function rebuildParents() {
  parentById = new Map();
  traverse(tree, (node, parent) => {
    if (parent) parentById.set(node.id, parent);
  });
}

function branchTotalTo(node, includeTerminalPayoff = true) {
  rebuildParents();
  let total = includeTerminalPayoff ? Number(node.payoff || 0) : 0;
  let current = node;
  while (current && current.id !== tree.id) {
    total += getBranchCashFlow(current);
    current = parentById.get(current.id);
  }
  return total;
}

function calculateTerminalPayoffs() {
  rebuildParents();
  traverse(tree, (node) => {
    if (node.type === "end" || !node.children?.length) {
      node.type = "end";
      node.children = [];
      node._terminalTotal = branchTotalTo(node, false);
      node.payoff = node._terminalTotal;
    }
  });
  payoffMode = true;
  rollbackMode = false;
  rollbackSteps = [];
  rollbackStepIndex = -1;
  controls.rollbackBtn.disabled = false;
  controls.rollbackBtn.querySelector("span:last-child").textContent = "Start Rollback";
  controls.policyBanner.textContent = "Payoffs are ready. Start rollback to evaluate nodes from right to left.";
  render();
}

function prepareRollbackSteps() {
  rebuildParents();
  const warnings = [];
  bestEdges = new Set();
  const steps = [];

  function walk(node) {
    if (node.type === "end" || !node.children?.length) {
      node._emv = Number(node.payoff || 0);
      return node._emv;
    }

    node.children.forEach(walk);

    if (node.type === "chance") {
      const probabilitySum = node.children.reduce((sum, child) => sum + Number(child.probability || 0), 0);
      if (Math.abs(probabilitySum - 1) > 0.001) {
        warnings.push(`${node.name}: probabilities add to ${probabilitySum.toFixed(2)}, not 1.00.`);
      }
      const terms = node.children.map((child) => {
        const payoff = Number(child._emv || 0);
        return `${formatProbabilityLabel(child.probability)} x ${formatMoney(payoff)}`;
      });
      node._emv = node.children.reduce((sum, child) => sum + Number(child.probability || 0) * Number(child._emv || 0), 0);
      steps.push({
        nodeId: node.id,
        type: "chance",
        title: node.name,
        formula: terms.join(" + "),
        result: node._emv,
      });
      return node._emv;
    }

    let bestChild = null;
    let bestValue = -Infinity;
    node.children.forEach((child) => {
      const value = Number(child._emv || 0);
      if (value > bestValue) {
        bestValue = value;
        bestChild = child;
      }
    });
    node._emv = bestValue === -Infinity ? 0 : bestValue;
    node._bestChild = bestChild?.id || null;
    steps.push({
      nodeId: node.id,
      type: "decision",
      title: node.name,
      formula: node.children.map((child) => `${child.branchLabel || child.name}: ${formatMoney(child._emv)}`).join("  |  "),
      result: node._emv,
      bestChildId: bestChild?.id || null,
    });
    return node._emv;
  }

  walk(tree);
  rollbackSteps = steps;
  return warnings;
}

function activeStepIds() {
  return new Set(rollbackSteps.slice(0, rollbackStepIndex + 1).map((step) => step.nodeId));
}

function updateBestEdgesForVisibleSteps() {
  bestEdges = new Set();
  const visible = activeStepIds();
  rollbackSteps.slice(0, rollbackStepIndex + 1).forEach((step) => {
    if (step.type === "decision" && step.bestChildId) {
      bestEdges.add(`${step.nodeId}->${step.bestChildId}`);
    }
  });
  if (rollbackStepIndex === rollbackSteps.length - 1) {
    traverse(tree, (node) => {
      if (node.type === "decision" && node._bestChild && visible.has(node.id)) {
        bestEdges.add(`${node.id}->${node._bestChild}`);
      }
    });
  }
}

function buildLayout() {
  const leaves = [];
  function assign(node, depth = 0) {
    node._depth = depth;
    if (!node.children?.length) {
      node._leafIndex = leaves.length;
      leaves.push(node);
      return node._leafIndex;
    }
    const ys = node.children.map((child) => assign(child, depth + 1));
    node._leafIndex = ys.reduce((sum, y) => sum + y, 0) / ys.length;
    return node._leafIndex;
  }
  assign(tree);

  layoutNodes = [];
  layoutById = new Map();
  const depthGap = 230;
  const leafGap = 105;
  const top = 240;
  const left = 130;

  traverse(tree, (node) => {
    if (typeof node.x !== "number" || typeof node.y !== "number") {
      node.x = left + node._depth * depthGap;
      node.y = top + node._leafIndex * leafGap;
    }
    const item = { node, x: node.x, y: node.y };
    layoutNodes.push(item);
    layoutById.set(node.id, item);
  });

  svg.setAttribute("viewBox", `0 0 ${WORKSPACE_WIDTH} ${WORKSPACE_HEIGHT}`);
  svg.style.width = `${WORKSPACE_WIDTH}px`;
  svg.style.height = `${WORKSPACE_HEIGHT}px`;
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function addText(group, text, x, y, className, anchor = "start") {
  const el = svgEl("text", { x, y, class: className, "text-anchor": anchor });
  el.textContent = text;
  group.appendChild(el);
  return el;
}

function nodeEdgePoint(node, toward, side) {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  if (node.type === "decision") {
    return { x: node.x + Math.sign(dx || 1) * 11, y: node.y };
  }
  if (node.type === "chance") {
    return { x: node.x + Math.sign(dx || 1) * 12, y: node.y };
  }
  if (side === "in") return { x: node.x, y: node.y };
  const length = Math.hypot(dx, dy) || 1;
  return { x: node.x + (dx / length) * 12, y: node.y + (dy / length) * 12 };
}

function edgeGeometry(parent, child) {
  const from = layoutById.get(parent.id);
  const to = layoutById.get(child.id);
  const start = nodeEdgePoint(from.node, to, "out");
  const end = nodeEdgePoint(to.node, from, "in");
  const forkX = start.x + Math.max(70, (end.x - start.x) * 0.36);
  const d = Math.abs(start.y - end.y) < 4
    ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} L ${forkX} ${end.y} L ${end.x} ${end.y}`;
  return { start, end, midX: forkX, d };
}

function pathFor(parent, child) {
  return edgeGeometry(parent, child).d;
}

function labelPosition(child, geometry) {
  if (typeof child.labelX !== "number" || typeof child.labelY !== "number") {
    child.labelX = geometry.midX + 14;
    child.labelY = geometry.end.y - 18;
  }
  return { x: child.labelX, y: child.labelY };
}

function probabilityPosition(child, geometry) {
  if (typeof child.probX !== "number" || typeof child.probY !== "number") {
    child.probX = geometry.start.x + Math.max(28, (geometry.midX - geometry.start.x) * 0.48);
    child.probY = (geometry.start.y + geometry.end.y) / 2 + 5;
  }
  return { x: child.probX, y: child.probY };
}

function nodeNamePosition(node) {
  if (typeof node.nameX !== "number" || typeof node.nameY !== "number") {
    node.nameX = node.x - 6;
    node.nameY = node.y - 22;
  }
  return { x: node.nameX, y: node.nameY };
}

function emvPosition(node) {
  if (typeof node.emvX !== "number" || typeof node.emvY !== "number") {
    node.emvX = node.x + 18;
    node.emvY = node.y - 18;
  }
  return { x: node.emvX, y: node.emvY };
}

function render() {
  const warnings = rollbackMode ? prepareRollbackSteps() : [];
  if (!rollbackMode) {
    bestEdges = new Set();
  } else {
    updateBestEdgesForVisibleSteps();
  }
  buildLayout();
  svg.replaceChildren();

  const edges = svgEl("g");
  const labels = svgEl("g");
  const nodes = svgEl("g");
  svg.append(edges, labels, nodes);

  traverse(tree, (node) => {
    (node.children || []).forEach((child) => {
      const edgeKey = `${node.id}->${child.id}`;
      const best = rollbackMode && bestEdges.has(edgeKey);
      const dim = rollbackMode && rollbackStepIndex === rollbackSteps.length - 1 && node.type === "decision" && !best;
      edges.appendChild(svgEl("path", { d: pathFor(node, child), class: `branch-line${best ? " best" : ""}${dim ? " dimmed" : ""}` }));
      edges.appendChild(svgEl("path", { d: pathFor(node, child), class: "branch-hit", "data-select-id": child.id }));

      const from = layoutById.get(node.id);
      const to = layoutById.get(child.id);
      const geometry = edgeGeometry(node, child);
      const label = labelPosition(child, geometry);
      const labelGroup = svgEl("g", { class: "label-drag", "data-label-id": child.id, "data-label-kind": "branch" });
      labels.appendChild(labelGroup);
      addText(labelGroup, child.branchLabel || child.name, label.x, label.y, "label-main");
      if (node.type === "chance") {
        const probability = probabilityPosition(child, geometry);
        const probabilityText = addText(labels, formatProbabilityLabel(child.probability), probability.x, probability.y, "label-prob label-drag", "start");
        probabilityText.setAttribute("data-label-id", child.id);
        probabilityText.setAttribute("data-label-kind", "probability");
      }
      if (getBranchCashFlow(child)) {
        addText(labelGroup, formatMoney(getBranchCashFlow(child)), label.x, label.y + 24, "label-small");
      }
      if (payoffMode && child.type === "end") {
        addText(labels, formatMoney(child.payoff), to.x + 34, to.y + 5, `label-end${child.id === selectedId ? " selected-text" : ""}`);
      }
      if (rollbackMode && activeStepIds().has(child.id) && child.type !== "end") {
        addText(labelGroup, `EV ${formatMoney(child._emv)}`, label.x, label.y + 48, "label-emv");
      }
    });
  });

  layoutNodes.forEach(({ node, x, y }) => {
    const currentStep = rollbackMode && rollbackSteps[rollbackStepIndex]?.nodeId === node.id;
    const calculated = rollbackMode && activeStepIds().has(node.id);
    const group = svgEl("g", { class: "node-hit", "data-select-id": node.id });
    if (node.type === "decision") {
      group.appendChild(svgEl("rect", { x: x - 11, y: y - 11, width: 22, height: 22, class: `node-shape decision-shape${node.id === selectedId ? " selected" : ""}${currentStep ? " current-node" : ""}` }));
    } else if (node.type === "chance") {
      group.appendChild(svgEl("circle", { cx: x, cy: y, r: 12, class: `node-shape chance-shape${node.id === selectedId ? " selected" : ""}${currentStep ? " current-node" : ""}` }));
    } else {
      group.appendChild(svgEl("polygon", { points: `${x},${y} ${x + 25},${y - 11} ${x + 25},${y + 11}`, class: `node-shape end-shape${node.id === selectedId ? " selected" : ""}` }));
    }
    nodes.appendChild(group);
    if (node.type !== "end") {
      const namePos = nodeNamePosition(node);
      const nodeName = addText(labels, node.name || node.type, namePos.x, namePos.y, "node-name label-drag", "middle");
      nodeName.setAttribute("data-node-name-id", node.id);
    }
  });

  renderRollbackCard();

  updatePanel(warnings);
  renderEndpointReport();
}

function renderRollbackCard() {
  if (!rollbackMode) {
    controls.rollbackCard.hidden = true;
    controls.rollbackCard.innerHTML = "";
    return;
  }
  const step = rollbackSteps[rollbackStepIndex];
  if (!step) {
    controls.rollbackCard.hidden = true;
    return;
  }
  controls.rollbackCard.hidden = false;
  const heading = step.type === "chance"
    ? "Probabilistic node --> weighted average"
    : "Decision node --> choose best branch";
  controls.rollbackCard.innerHTML = `
    <div class="rollback-card-kicker">Step ${rollbackStepIndex + 1} of ${rollbackSteps.length}</div>
    <h3>${heading}</h3>
    <p>${escapeHtml(step.title)}</p>
    <div class="rollback-formula">${escapeHtml(compactText(step.formula, 95))}</div>
    <strong>= ${formatMoney(step.result)}</strong>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}


function cloneNodeForPaste(node, offsetX = 40, offsetY = 40) {
  const copy = JSON.parse(JSON.stringify(stripComputed(node)));
  function renew(item) {
    item.id = makeId();
    item.x = Math.max(0, Math.min(WORKSPACE_WIDTH, Number(item.x || 0) + offsetX));
    item.y = Math.max(WORKSPACE_TOP, Math.min(WORKSPACE_HEIGHT, Number(item.y || 0) + offsetY));
    ["labelX", "probX", "nameX", "emvX"].forEach((key) => {
      if (typeof item[key] === "number") item[key] = Math.max(0, Math.min(WORKSPACE_WIDTH, item[key] + offsetX));
    });
    ["labelY", "probY", "nameY", "emvY"].forEach((key) => {
      if (typeof item[key] === "number") item[key] = Math.max(LABEL_TOP, Math.min(WORKSPACE_HEIGHT, item[key] + offsetY));
    });
    (item.children || []).forEach(renew);
  }
  renew(copy);
  return copy;
}

function copySelectedNode() {
  const found = findNode(selectedId);
  if (!found) return;
  copiedNode = JSON.parse(JSON.stringify(stripComputed(found.node)));
  controls.policyBanner.classList.remove("complete");
  controls.policyBanner.textContent = "Node copied. Select an end node, then paste.";
}

function pasteCopiedNode() {
  if (!copiedNode) {
    controls.policyBanner.classList.remove("complete");
    controls.policyBanner.textContent = "Copy a node before pasting.";
    return;
  }
  const found = findNode(selectedId);
  if (!found || found.node.type !== "end") {
    controls.policyBanner.classList.remove("complete");
    controls.policyBanner.textContent = "Paste is only available when an end node is selected.";
    return;
  }

  const target = found.node;
  const incoming = {
    id: target.id,
    branchLabel: target.branchLabel,
    branchCashFlow: target.branchCashFlow,
    branchEntries: target.branchEntries || [],
    probability: target.probability,
    x: target.x,
    y: target.y,
  };
    const offsetX = Number(target.x || 0) - Number(copiedNode.x || 0);
  const offsetY = Number(target.y || 0) - Number(copiedNode.y || 0);
  const pasted = cloneNodeForPaste(copiedNode, offsetX, offsetY);
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, pasted, incoming);
  selectedId = target.id;
  markDirty();
  controls.policyBanner.textContent = "Subtree pasted.";
  render();
}

function stripComputed(node) {
  const clean = {};
  Object.entries(node).forEach(([key, value]) => {
    if (!key.startsWith("_") && key !== "payoff") clean[key] = value;
  });
  clean.payoff = 0;
  clean.children = (node.children || []).map(stripComputed);
  return clean;
}

function resetEvaluationState() {
  payoffMode = false;
  rollbackMode = false;
  rollbackSteps = [];
  rollbackStepIndex = -1;
  bestEdges = new Set();
  controls.rollbackBtn.disabled = true;
  controls.rollbackBtn.querySelector("span:last-child").textContent = "Start Rollback";
}

function saveTreeFile() {
  const name = window.prompt("Name this tree:", tree.name && tree.name !== "Start" ? tree.name : "Decision Tree");
  if (name === null) return;
  const cleanName = String(name).trim() || "Decision Tree";
  const fileName = cleanName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  tree.name = cleanName;
  const payload = {
    version: 1,
    name: cleanName,
    savedAt: new Date().toISOString(),
    tree: stripComputed(tree),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/x-decision-tree" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName || "Decision Tree"}.dtree`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function openTreeFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      tree = parsed.tree || parsed;
      selectedId = tree.id || "root";
      resetEvaluationState();
      controls.policyBanner.textContent = "Tree opened. Calculate payoffs before rolling back.";
      render();
    } catch {
      controls.policyBanner.textContent = "That tree file could not be opened.";
    }
  };
  reader.readAsText(file);
}

function updatePanel(warnings) {
  const found = findNode(selectedId) || findNode(tree.id);
  const { node } = found;
  selectedId = node.id;
  controls.selectedTitle.textContent = node.type === "end" ? "End" : node.name || "Selected node";
  controls.selectedBadge.textContent = node.type;
  fields.nodeName.value = node.name || "";
  fields.nodeType.value = node.type;
  renderBranchEditor(node);

  if (warnings.length) controls.policyBanner.textContent = warnings.join(" ");
  updatePolicyBanner();
}

function renderBranchEditor(node) {
  fields.branchEditor.replaceChildren();
  if (node.type === "end") {
    fields.nodeName.value = "";
    fields.nodeType.value = "end";
    fields.branchEditor.innerHTML = "";
    return;
  }
  if (!node.children?.length) {
    const found = findNode(node.id);
    if (found?.parent) {
      fields.branchEditor.innerHTML = `
        <div class="branch-editor-title">Parent branch</div>
        <div class="branch-edit-row" data-child-id="${node.id}">
          <label>Label<input data-branch-field="label" type="text" maxlength="32" value="${escapeAttr(node.branchLabel || "")}"></label>
          ${found.parent.type === "chance" ? `<label>Branch probability<input data-branch-field="probability" type="text" value="${formatProbabilityInput(node.probability)}"></label>` : ""}
          <label>Payoff<input data-branch-field="cash" type="number" step="0.01" value="${getBranchCashFlow(node)}"></label>
        </div>
      `;
      return;
    }
    fields.branchEditor.innerHTML = "<div class=\"branch-empty\">Add a decision node or probabilistic node to define branches.</div>";
    return;
  }

  const typeLabel = node.type === "chance" ? "Probabilistic branches" : "Decision branches";
  fields.branchEditor.innerHTML = `
    <div class="branch-editor-title">${typeLabel}</div>
    ${node.children.map((child, index) => `
      <div class="branch-edit-row" data-child-id="${child.id}">
        <span class="branch-index">${index + 1}</span>
        <label>Label<input data-branch-field="label" type="text" maxlength="32" value="${escapeAttr(child.branchLabel || "")}"></label>
        ${node.type === "chance" ? `<label>Branch probability<input data-branch-field="probability" type="text" value="${formatProbabilityInput(child.probability)}"></label>` : ""}
        <label>Payoff<input data-branch-field="cash" type="number" step="0.01" value="${getBranchCashFlow(child)}"></label>
      </div>
    `).join("")}
  `;
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

function updatePolicyBanner() {
  controls.policyBanner.classList.remove("complete");
  if (controls.policyBanner.textContent.includes("probabilities add to")) return;
  if (!payoffMode) {
    controls.policyBanner.textContent = "";
    return;
  }
  if (!rollbackMode) {
    controls.policyBanner.textContent = "Payoffs are ready. Start rollback to reveal the policy step by step.";
    return;
  }
  if (rollbackStepIndex < rollbackSteps.length - 1) {
    controls.policyBanner.textContent = `Rollback step ${rollbackStepIndex + 1} of ${rollbackSteps.length}: evaluating from right to left.`;
    return;
  }
  controls.policyBanner.classList.add("complete");
  controls.policyBanner.textContent = "Optimal Policy Highlighted";
}

function renderEndpointReport() {
  const fullyRolledBack = payoffMode && rollbackMode && rollbackSteps.length && rollbackStepIndex === rollbackSteps.length - 1;
  if (!fullyRolledBack) {
    controls.riskProfile.innerHTML = "<div class=\"risk-empty\">Complete the rollback to reveal the optimal-policy risk profile.</div>";
    return;
  }

  const endpoints = [];
  function walk(node, path = [], probability = 1) {
    if (node.type === "end" || !node.children?.length) {
      endpoints.push({ path: path.filter(Boolean).join(" / ") || node.name, probability, total: Number(node.payoff || 0) });
      return;
    }
    const children = node.type === "decision" && node._bestChild
      ? node.children.filter((child) => child.id === node._bestChild)
      : node.children;
    children.forEach((child) => {
      const nextProbability = node.type === "chance" ? probability * Number(child.probability || 0) : probability;
      walk(child, [...path, child.branchLabel || child.name], nextProbability);
    });
  }
  walk(tree);

  const combined = new Map();
  endpoints.forEach((endpoint) => {
    const key = String(endpoint.total);
    const existing = combined.get(key) || { total: endpoint.total, probability: 0, path: endpoint.path };
    existing.probability += endpoint.probability;
    combined.set(key, existing);
  });
  const sorted = [...combined.values()].sort((a, b) => a.total - b.total);
  const maxProbability = Math.max(...sorted.map((endpoint) => endpoint.probability), 0.01);

  controls.riskProfile.innerHTML = `
    <div class="risk-chart">
      <div class="risk-axis-y">Probability</div>
      <div class="risk-plot">
        <div class="risk-grid"></div>
        <div class="histogram">
          ${sorted.map((endpoint) => `
            <div class="histogram-bar-wrap ${endpoint.total < 0 ? "loss" : "gain"}" title="${escapeAttr(endpoint.path)}">
              <strong>${(endpoint.probability * 100).toFixed(1)}%</strong>
              <div class="histogram-bar" style="height:${Math.max(18, (endpoint.probability / maxProbability) * 154)}px"></div>
              <span>${formatMoney(endpoint.total)}</span>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="risk-axis-x">Payoff</div>
    </div>
    <div class="risk-caption">Only outcomes reachable under the highlighted optimal policy are shown.</div>
  `;
}

function updateSelectedFromFields() {
  const found = findNode(selectedId);
  if (!found) return;
  const { node } = found;
  node.name = truncateLabel(fields.nodeName.value);
  markDirty();
  render();
}

function updateBranchFromEditor(event) {
  const input = event.target.closest("[data-branch-field]");
  if (!input) return;
  const row = input.closest("[data-child-id]");
  const child = findNode(row.getAttribute("data-child-id"))?.node;
  if (!child) return;
  const field = input.getAttribute("data-branch-field");
  if (field === "label") {
    child.branchLabel = truncateLabel(input.value);
    child.name = child.branchLabel;
  } else if (field === "probability") {
    child.probability = parseProbability(input.value);
  } else if (field === "cash") {
    child.branchEntries = [];
    child.branchCashFlow = Number(input.value || 0);
  }
  markDirty();
  if (event.type === "change") render();
}

function renderBranchRows() {
  const count = Math.max(2, Math.min(6, Number(dialog.branchCount.value || 2)));
  dialog.rows.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const row = document.createElement("div");
    row.className = "branch-row";
    row.innerHTML = `
      <label>
        Branch text
        <input name="label" type="text" maxlength="32" value="Branch ${index + 1}" required>
      </label>
      ${pendingType === "chance" ? `
      <label>
        Branch probability
        <input name="probability" type="text" value="${(1 / count).toFixed(2)}" required>
      </label>` : ""}
      <label>
        Payoff on branch
        <input name="cash" type="number" step="0.01" value="0">
      </label>
    `;
    dialog.rows.appendChild(row);
  }
}

function openNodeDialog(type) {
  const found = findNode(selectedId);
  if (!found) return;
  pendingType = type;
  dialog.title.textContent = type === "chance" ? "Define probabilistic node" : "Define decision node";
  dialog.nodeName.value = type === "chance" ? "Probabilistic node" : "Decision node";
  dialog.branchCount.value = 2;
  renderBranchRows();
  dialog.el.showModal();
}

function createNodeFromDialog() {
  const found = findNode(selectedId);
  if (!found) return;
  const { node } = found;
  const baseX = node.x || 150;
  const baseY = node.y || 260;
  const rows = [...dialog.rows.querySelectorAll(".branch-row")];
  const spacing = Math.max(80, 118 - rows.length * 5);
  const startY = baseY - ((rows.length - 1) * spacing) / 2;

  node.name = truncateLabel(dialog.nodeName.value);
  node.type = pendingType;
  node.payoff = 0;
  node.children = rows.map((row, index) => {
    const label = truncateLabel(row.querySelector('[name="label"]').value);
    const cash = Number(row.querySelector('[name="cash"]').value || 0);
    const probabilityInput = row.querySelector('[name="probability"]');
    return {
      id: makeId(),
      name: label,
      type: "end",
      branchLabel: label,
      probability: probabilityInput ? parseProbability(probabilityInput.value) : null,
      branchCashFlow: cash,
      branchEntries: [],
      payoff: 0,
      children: [],
      x: baseX + 230,
      y: startY + index * spacing,
    };
  });
  selectedId = node.id;
  markDirty();
  render();
}

function svgPoint(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

svg.addEventListener("pointerdown", (event) => {
  const labelTarget = event.target.closest("[data-label-id]");
  if (labelTarget) {
    const child = findNode(labelTarget.getAttribute("data-label-id"))?.node;
    if (!child) return;
    selectedId = child.id;
    const point = svgPoint(event);
    const kind = labelTarget.getAttribute("data-label-kind");
    const originX = kind === "probability" ? child.probX : child.labelX;
    const originY = kind === "probability" ? child.probY : child.labelY;
    draggingLabel = { id: child.id, kind, dx: point.x - originX, dy: point.y - originY };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    render();
    return;
  }

  const nodeNameTarget = event.target.closest("[data-node-name-id]");
  if (nodeNameTarget) {
    const node = findNode(nodeNameTarget.getAttribute("data-node-name-id"))?.node;
    if (!node) return;
    selectedId = node.id;
    const point = svgPoint(event);
    const pos = nodeNamePosition(node);
    draggingLabel = { id: node.id, kind: "nodeName", dx: point.x - pos.x, dy: point.y - pos.y };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    render();
    return;
  }

  const emvTarget = event.target.closest("[data-emv-id]");
  if (emvTarget) {
    const node = findNode(emvTarget.getAttribute("data-emv-id"))?.node;
    if (!node) return;
    selectedId = node.id;
    const point = svgPoint(event);
    const pos = emvPosition(node);
    draggingLabel = { id: node.id, kind: "emv", dx: point.x - pos.x, dy: point.y - pos.y };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
    render();
    return;
  }

  const target = event.target.closest("[data-select-id]");
  if (!target) return;
  selectedId = target.getAttribute("data-select-id");
  const found = findNode(selectedId);
  if (!found) return;
  const point = svgPoint(event);
  dragging = {
    id: selectedId,
    startPointerX: point.x,
    startPointerY: point.y,
    moved: false,
    nodes: collectSubtree(found.node).map(snapshotNodePosition),
  };
  svg.setPointerCapture(event.pointerId);
  render();
});

svg.addEventListener("pointermove", (event) => {
  if (draggingLabel) {
    const found = findNode(draggingLabel.id);
    if (!found) return;
    const point = svgPoint(event);
    if (draggingLabel.kind === "emv") {
      found.node.emvX = Math.max(0, Math.min(WORKSPACE_WIDTH, point.x - draggingLabel.dx));
      found.node.emvY = Math.max(LABEL_TOP, Math.min(WORKSPACE_HEIGHT, point.y - draggingLabel.dy));
    } else if (draggingLabel.kind === "nodeName") {
      found.node.nameX = Math.max(0, Math.min(WORKSPACE_WIDTH, point.x - draggingLabel.dx));
      found.node.nameY = Math.max(LABEL_TOP, Math.min(WORKSPACE_HEIGHT, point.y - draggingLabel.dy));
    } else if (draggingLabel.kind === "probability") {
      found.node.probX = Math.max(0, Math.min(WORKSPACE_WIDTH, point.x - draggingLabel.dx));
      found.node.probY = Math.max(LABEL_TOP, Math.min(WORKSPACE_HEIGHT, point.y - draggingLabel.dy));
    } else {
      found.node.labelX = Math.max(0, Math.min(WORKSPACE_WIDTH, point.x - draggingLabel.dx));
      found.node.labelY = Math.max(LABEL_TOP, Math.min(WORKSPACE_HEIGHT, point.y - draggingLabel.dy));
    }
    render();
    return;
  }

  if (!dragging) return;
  const point = svgPoint(event);
  const dx = point.x - dragging.startPointerX;
  const dy = point.y - dragging.startPointerY;
  dragging.nodes.forEach((snapshot) => {
    const node = findNode(snapshot.id)?.node;
    if (!node) return;
    node.x = Math.max(0, Math.min(WORKSPACE_WIDTH, snapshot.x + dx));
    node.y = Math.max(WORKSPACE_TOP, Math.min(WORKSPACE_HEIGHT, snapshot.y + dy));
    node.labelX = shiftDefined(snapshot.labelX, dx, 0, WORKSPACE_WIDTH);
    node.labelY = shiftDefined(snapshot.labelY, dy, LABEL_TOP, WORKSPACE_HEIGHT);
    node.probX = shiftDefined(snapshot.probX, dx, 0, WORKSPACE_WIDTH);
    node.probY = shiftDefined(snapshot.probY, dy, LABEL_TOP, WORKSPACE_HEIGHT);
    node.nameX = shiftDefined(snapshot.nameX, dx, 0, WORKSPACE_WIDTH);
    node.nameY = shiftDefined(snapshot.nameY, dy, LABEL_TOP, WORKSPACE_HEIGHT);
    node.emvX = shiftDefined(snapshot.emvX, dx, 0, WORKSPACE_WIDTH);
    node.emvY = shiftDefined(snapshot.emvY, dy, LABEL_TOP, WORKSPACE_HEIGHT);
  });
  dragging.moved = true;
  render();
});

svg.addEventListener("pointerup", (event) => {
  if (dragging || draggingLabel) svg.releasePointerCapture(event.pointerId);
  dragging = null;
  draggingLabel = null;
});

const sidePanel = document.querySelector(".side-panel");
sidePanel.addEventListener("pointerdown", (event) => {
  if (event.offsetX > 10) return;
  resizingPanel = { startX: event.clientX, startWidth: sidePanel.getBoundingClientRect().width };
  sidePanel.setPointerCapture(event.pointerId);
});

sidePanel.addEventListener("pointermove", (event) => {
  if (!resizingPanel) return;
  const delta = resizingPanel.startX - event.clientX;
  setPanelWidth(resizingPanel.startWidth + delta);
});

sidePanel.addEventListener("pointerup", (event) => {
  if (resizingPanel) sidePanel.releasePointerCapture(event.pointerId);
  resizingPanel = null;
});

fields.nodeName.addEventListener("input", updateSelectedFromFields);
fields.nodeName.addEventListener("change", updateSelectedFromFields);
fields.branchEditor.addEventListener("input", updateBranchFromEditor);
fields.branchEditor.addEventListener("change", updateBranchFromEditor);

dialog.branchCount.addEventListener("input", renderBranchRows);
dialog.form.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  createNodeFromDialog();
  dialog.el.close();
});

document.getElementById("newBtn").addEventListener("click", () => {
  tree = makeRoot();
  selectedId = tree.id;
  resetEvaluationState();
  controls.policyBanner.textContent = "";
  render();
});

document.getElementById("addDecisionBtn").addEventListener("click", () => openNodeDialog("decision"));
document.getElementById("addChanceBtn").addEventListener("click", () => openNodeDialog("chance"));
document.getElementById("calcPayoffsBtn").addEventListener("click", calculateTerminalPayoffs);
controls.copyNodeBtn.addEventListener("click", copySelectedNode);
controls.pasteNodeBtn.addEventListener("click", pasteCopiedNode);
controls.saveTreeBtn.addEventListener("click", saveTreeFile);
controls.openTreeBtn.addEventListener("click", () => controls.openTreeFile.click());
controls.openTreeFile.addEventListener("change", () => {
  const file = controls.openTreeFile.files?.[0];
  if (file) openTreeFile(file);
  controls.openTreeFile.value = "";
});
document.getElementById("rollbackBtn").addEventListener("click", () => {
  if (!rollbackMode) {
    rollbackMode = true;
    rollbackStepIndex = -1;
    prepareRollbackSteps();
  }
  if (rollbackStepIndex < rollbackSteps.length - 1) {
    rollbackStepIndex += 1;
  }
  controls.rollbackBtn.querySelector("span:last-child").textContent =
    rollbackStepIndex >= rollbackSteps.length - 1 ? "Policy Complete" : "Next Step";
  controls.rollbackBtn.disabled = rollbackStepIndex >= rollbackSteps.length - 1;
  render();
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  const found = findNode(selectedId);
  if (!found?.parent) return;
  found.parent.children = found.parent.children.filter((child) => child.id !== selectedId);
  selectedId = found.parent.id;
  markDirty();
  render();
});

controls.policyBanner.textContent = "";
render();






















