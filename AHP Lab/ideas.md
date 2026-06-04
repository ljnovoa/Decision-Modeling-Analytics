# AHP Decision Tool — Design Brainstorm

## Approach 1 — Scientific Blueprint
<response>
<text>
**Design Movement:** Technical / Scientific Documentation meets Modern SaaS

**Core Principles:**
- Grid-based precision with ruled-line textures evoking engineering graph paper
- Deep navy + warm amber accent — authoritative yet approachable for students
- Every element has a clear functional role; decoration is earned, not assumed
- Information hierarchy mirrors the AHP hierarchy itself

**Color Philosophy:**
- Background: deep slate (#0F172A) — serious, academic
- Surface: slightly lighter slate (#1E293B)
- Primary accent: amber (#F59E0B) — highlights active nodes and CTA buttons
- Secondary: sky blue (#38BDF8) — used for computed weights and results
- Emotional intent: confidence, precision, analytical rigor

**Layout Paradigm:**
- Persistent left sidebar for step navigation (1. Define Hierarchy → 2. Compare → 3. Results)
- Main content area split: left 60% for interactive form/matrix, right 40% for live hierarchy tree
- Hierarchy tree panel is always visible as a "map" of where the user is

**Signature Elements:**
- Thin horizontal rule dividers with step numbers
- Monospace font for matrix cell values (Fira Code)
- Amber "active node" glow on the hierarchy tree

**Interaction Philosophy:**
- Wizard-style progression with clear back/forward
- Matrix cells animate in when a new comparison level is reached
- Consistency warnings appear as inline amber banners, not modal interruptions

**Animation:**
- Slide-in from right for new steps (200ms ease-out)
- Hierarchy tree nodes fade+scale in as they are added (150ms stagger)
- Bar chart bars grow from left to right on results reveal (400ms ease-out)

**Typography System:**
- Display: Space Grotesk Bold — headings and step labels
- Body: Inter Regular — form labels and descriptions
- Data: Fira Code — matrix values and numerical outputs
</text>
<probability>0.07</probability>
</response>

## Approach 2 — Warm Academic Parchment
<response>
<text>
**Design Movement:** Editorial / Academic Publishing — think a well-designed textbook or journal

**Core Principles:**
- Off-white parchment background with generous margins — reading-first
- Serif display font for headings, creating an authoritative academic feel
- Subtle warm tones; no harsh contrasts
- The hierarchy tree is rendered as a hand-drawn-style diagram

**Color Philosophy:**
- Background: warm cream (#FAFAF7)
- Surface: white (#FFFFFF) with soft drop shadow
- Primary: deep forest green (#1B4332)
- Accent: terracotta (#C1440E) for warnings and highlights
- Emotional intent: scholarly, trustworthy, calm

**Layout Paradigm:**
- Single-column centered layout with wide gutters
- Step indicator at the top as a horizontal timeline
- Hierarchy tree displayed below each step as a collapsible panel

**Signature Elements:**
- Thin serif rule lines between sections
- Numbered step badges in terracotta circles
- Subtle paper texture on background

**Interaction Philosophy:**
- Linear scroll-based progression
- Smooth accordion reveals for sub-criteria
- Gentle fade transitions between steps

**Animation:**
- Fade-in for new content blocks (250ms)
- Accordion expand/collapse with height animation (200ms)
- Results bar charts animate with a bounce ease

**Typography System:**
- Display: Playfair Display Bold
- Body: Source Serif 4 Regular
- Data: IBM Plex Mono
</text>
<probability>0.06</probability>
</response>

## Approach 3 — Precision Dashboard (CHOSEN)
<response>
<text>
**Design Movement:** Modern Decision Intelligence Platform — clean, data-forward, professional

**Core Principles:**
- Light background with strong typographic hierarchy — clarity above all
- Teal/emerald primary with slate grays — fresh, trustworthy, analytical
- Split-panel layout: interactive workspace left, live hierarchy right
- Numerical data is always prominent and readable

**Color Philosophy:**
- Background: near-white (#F8FAFC)
- Surface: white with subtle border and shadow
- Primary: deep teal (#0D9488) — active states, buttons, progress
- Secondary: slate (#475569) — labels, secondary text
- Accent: amber (#D97706) — warnings (consistency ratio), highlights
- Success: emerald (#059669) — acceptable consistency, confirmed steps
- Emotional intent: analytical confidence, clarity, professional competence

**Layout Paradigm:**
- Top navigation bar with project title and step progress indicator
- Main area: left panel (65%) for the active step's UI, right panel (35%) for the live hierarchy tree
- Right panel collapses on mobile; hierarchy shown as a modal instead
- Steps: Define Hierarchy → Pairwise Comparisons → Results

**Signature Elements:**
- Teal left-border accent on active form sections
- Hierarchy tree with colored level bands (objective = teal, criteria = slate, sub-criteria = sky, alternatives = emerald)
- Matrix cells with subtle hover highlight and a Saaty scale tooltip on focus

**Interaction Philosophy:**
- Step-locked progression: user cannot advance until current step is valid
- Inline validation with color-coded feedback (green = consistent, amber = warning, red = error)
- Hierarchy tree is always live — nodes appear as user types names

**Animation:**
- Panel slide transitions: 220ms cubic-bezier(0.23, 1, 0.32, 1)
- Tree node entrance: scale(0.95)+opacity:0 → 1, 160ms stagger 40ms
- Matrix entrance: rows stagger in from top, 30ms per row
- Bar chart: bars grow from baseline, 500ms ease-out, stagger 60ms per bar

**Typography System:**
- Display: DM Sans Bold (700) — page titles, step headings
- Body: DM Sans Regular (400) — labels, descriptions, body text
- Data: JetBrains Mono — matrix values, weight percentages, CR values
</text>
<probability>0.09</probability>
</response>

## Selected Approach: **Precision Dashboard** (Approach 3)

Clean teal/slate/amber palette with DM Sans + JetBrains Mono typography, split-panel layout with live hierarchy tree, step-locked wizard progression, and data-forward design language.
