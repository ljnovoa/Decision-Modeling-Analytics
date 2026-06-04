import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { computeStats, computeStacks } from '../hooks/useStats';

const W = 900;
const H = 340;
const BEAM_Y = 180;       // beam vertical center in SVG
const BEAM_LEN = 760;
const BEAM_LEFT = (W - BEAM_LEN) / 2;
const BEAM_RIGHT = BEAM_LEFT + BEAM_LEN;
const VAL_MIN = 1;
const VAL_MAX = 20;
const MASS_R = 20;
const FULCRUM_H = 50;

const COLOR = { mean: '#38bdf8', median: '#a78bfa', mode: '#fb923c' };
const GLOW = {
  mean:   '0 0 18px rgba(56,189,248,0.8)',
  median: '0 0 18px rgba(167,139,250,0.8)',
  mode:   '0 0 18px rgba(251,146,60,0.8)',
};

function valToX(v) {
  return BEAM_LEFT + ((v - VAL_MIN) / (VAL_MAX - VAL_MIN)) * BEAM_LEN;
}

function xToVal(x) {
  return Math.round(
    VAL_MIN + ((x - BEAM_LEFT) / BEAM_LEN) * (VAL_MAX - VAL_MIN)
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Grid lines behind beam ───────────────────────────────────────────────────
function Grid() {
  const ticks = Array.from({ length: VAL_MAX - VAL_MIN + 1 }, (_, i) => i + VAL_MIN);
  return (
    <g>
      {ticks.map(v => {
        const x = valToX(v);
        const major = v % 5 === 0;
        return (
          <g key={v}>
            <line
              x1={x} y1={BEAM_Y - 120} x2={x} y2={BEAM_Y + 70}
              stroke={major ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
              strokeWidth={major ? 1 : 0.5}
            />
            {major && (
              <text
                x={x} y={BEAM_Y + 90}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
              >
                {v}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── Fulcrum triangle ─────────────────────────────────────────────────────────
function Fulcrum({ cx, active, mode }) {
  const color = COLOR[mode];
  const h = FULCRUM_H;
  const w = 44;
  const pts = `${cx},${BEAM_Y + 8} ${cx - w / 2},${BEAM_Y + 8 + h} ${cx + w / 2},${BEAM_Y + 8 + h}`;
  return (
    <g>
      <defs>
        <filter id="fulcrum-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon
        points={pts}
        fill={color}
        opacity={active ? 1 : 0.6}
        filter="url(#fulcrum-glow)"
        style={{ transition: 'fill 0.4s' }}
      />
      {/* base plate */}
      <rect
        x={cx - 28} y={BEAM_Y + 8 + h}
        width={56} height={7} rx={3}
        fill={color} opacity={0.5}
      />
      {/* drag handle circle */}
      <circle
        cx={cx} cy={BEAM_Y + 8 + h + 20}
        r={5} fill={color} opacity={0.8}
      />
    </g>
  );
}

// ── Individual mass ──────────────────────────────────────────────────────────
function Mass({ value, x, y, highlight, dimmed, mode, stackIdx, onClick }) {
  const color = highlight ? COLOR[mode] : '#e2e8f0';
  const opacity = dimmed ? 0.25 : 1;
  const glowFilter = highlight ? `url(#glow-${mode})` : undefined;

  return (
    <g
      style={{ cursor: 'pointer', opacity, transition: 'opacity 0.3s' }}
      onClick={onClick}
    >
      <defs>
        <radialGradient id={`mass-grad-${value}-${stackIdx}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor={highlight ? color : '#c8d3e0'} />
          <stop offset="100%" stopColor={highlight ? `${color}55` : '#4b5563'} />
        </radialGradient>
      </defs>
      {/* shadow */}
      <ellipse cx={x} cy={y + MASS_R + 2} rx={MASS_R * 0.7} ry={5} fill="rgba(0,0,0,0.4)" />
      <circle
        cx={x} cy={y}
        r={MASS_R}
        fill={`url(#mass-grad-${value}-${stackIdx})`}
        filter={glowFilter}
        stroke={highlight ? color : 'rgba(255,255,255,0.15)'}
        strokeWidth={highlight ? 2 : 1}
        style={{ transition: 'all 0.4s' }}
      />
      <text
        x={x} y={y + 4.5}
        textAnchor="middle"
        fill={highlight ? '#fff' : '#e2e8f0'}
        fontSize={12}
        fontWeight={600}
        fontFamily="JetBrains Mono, monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {value}
      </text>
    </g>
  );
}

// ── Stat marker line on beam ─────────────────────────────────────────────────
function StatMarker({ xVal, label, color, yBeam }) {
  const x = valToX(xVal);
  return (
    <g>
      <line
        x1={x} y1={yBeam - 10}
        x2={x} y2={yBeam - 90}
        stroke={color} strokeWidth={1.5}
        strokeDasharray="4,3" opacity={0.7}
      />
      <circle cx={x} cy={yBeam - 10} r={4} fill={color} opacity={0.9} />
      <text
        x={x} y={yBeam - 97}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight={600}
        fontFamily="JetBrains Mono, monospace"
      >
        {label}
      </text>
    </g>
  );
}

export default function BeamScene({ values, activeMode, onClickMass }) {
  const svgRef = useRef(null);
  const [fulcrumVal, setFulcrumVal] = useState(null); // null = auto (at mean)
  const [draggingFulcrum, setDraggingFulcrum] = useState(false);

  const stats = computeStats(values);
  const stacks = computeStacks(values);

  // Reset fulcrum to mean when values change or mode changes
  useEffect(() => { setFulcrumVal(null); }, [values, activeMode]);

  // ── Tilt physics ────────────────────────────────────────────────────────────
  const pivot = fulcrumVal ?? stats.mean ?? (VAL_MIN + VAL_MAX) / 2;
  const torque = values.reduce((s, v) => s + (v - pivot), 0);
  const maxTorque = values.length * (VAL_MAX - VAL_MIN) / 2 || 1;
  const rawAngle = clamp((torque / maxTorque) * 35, -35, 35);

  const springAngle = useSpring(0, { stiffness: 80, damping: 18 });
  useEffect(() => { springAngle.set(rawAngle); }, [rawAngle]);

  // ── Fulcrum drag ────────────────────────────────────────────────────────────
  const getSVGX = useCallback(clientX => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const svgX = (clientX - rect.left) * (W / rect.width);
    return clamp(xToVal(svgX), VAL_MIN, VAL_MAX);
  }, []);

  const onFulcrumPointerDown = e => {
    e.stopPropagation();
    setDraggingFulcrum(true);
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    if (!draggingFulcrum) return;
    const v = getSVGX(e.clientX);
    if (v !== null) setFulcrumVal(v);
  };
  const onPointerUp = () => setDraggingFulcrum(false);

  // ── Beam click → add mass ───────────────────────────────────────────────────
  const onBeamClick = e => {
    if (draggingFulcrum) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = (e.clientX - rect.left) * (W / rect.width);
    const v = clamp(xToVal(svgX), VAL_MIN, VAL_MAX);
    if (onClickMass) onClickMass(v);
  };

  // ── Per-mass positions on beam ──────────────────────────────────────────────
  const massPositions = values.map((v, i) => {
    const bx = valToX(v);
    const stackIdx = stacks[i];

    if (activeMode === 'mode') {
      // stack vertically: tallest at top
      const yBase = BEAM_Y - MASS_R - 6;
      return { x: bx, y: yBase - stackIdx * (MASS_R * 2 + 4) };
    }
    if (activeMode === 'median') {
      // sort masses to show order; slight vertical spread for clarity
      return { x: bx, y: BEAM_Y - MASS_R - 6 };
    }
    return { x: bx, y: BEAM_Y - MASS_R - 6 };
  });

  // ── Highlight logic ─────────────────────────────────────────────────────────
  function isHighlighted(i) {
    const v = values[i];
    if (activeMode === 'mean') return false;
    if (activeMode === 'mode') return stats.modes.includes(v) && stats.maxFreq > 1;
    if (activeMode === 'median') {
      const si = stats.sortedIndices;
      const n = si.length;
      if (n % 2 === 1) return si[Math.floor(n / 2)] === i;
      return si[n / 2 - 1] === i || si[n / 2] === i;
    }
    return false;
  }

  function isDimmed(i) {
    if (activeMode === 'mode' && stats.maxFreq > 1) return !stats.modes.includes(values[i]);
    return false;
  }

  const color = COLOR[activeMode];
  const fulcrumX = valToX(pivot);

  return (
    <div style={{ width: '100%', maxWidth: W, margin: '0 auto', position: 'relative' }}>
      {/* subtle top glow gradient matching active mode */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '60%', height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        borderRadius: 2, opacity: 0.6,
      }} />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', cursor: draggingFulcrum ? 'grabbing' : 'crosshair', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onBeamClick}
      >
        <defs>
          {/* glow filters per stat color */}
          {['mean', 'median', 'mode'].map(m => (
            <filter key={m} id={`glow-${m}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          {/* beam metal gradient */}
          <linearGradient id="beam-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b7280" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="60%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          <linearGradient id="beam-sheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <Grid />

        {/* Fulcrum */}
        <Fulcrum cx={fulcrumX} active={fulcrumVal !== null} mode={activeMode} />

        {/* Rotated beam group */}
        <motion.g
          style={{
            transformOrigin: `${fulcrumX}px ${BEAM_Y}px`,
            rotate: springAngle,
          }}
        >
          {/* beam bar */}
          <rect
            x={BEAM_LEFT} y={BEAM_Y - 7}
            width={BEAM_LEN} height={14} rx={4}
            fill="url(#beam-grad)"
          />
          <rect
            x={BEAM_LEFT} y={BEAM_Y - 7}
            width={BEAM_LEN} height={14} rx={4}
            fill="url(#beam-sheen)"
          />
          {/* edge highlight */}
          <line
            x1={BEAM_LEFT + 6} y1={BEAM_Y - 5}
            x2={BEAM_RIGHT - 6} y2={BEAM_Y - 5}
            stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeLinecap="round"
          />

          {/* Stat marker on beam (median / mean value line) */}
          {activeMode === 'mean' && stats.mean !== null && (
            <StatMarker
              xVal={stats.mean}
              label={`μ = ${stats.mean.toFixed(2)}`}
              color={COLOR.mean}
              yBeam={BEAM_Y}
            />
          )}
          {activeMode === 'median' && stats.median !== null && (
            <StatMarker
              xVal={stats.median}
              label={`M = ${stats.median % 1 === 0 ? stats.median : stats.median.toFixed(1)}`}
              color={COLOR.median}
              yBeam={BEAM_Y}
            />
          )}

          {/* Masses */}
          {values.map((v, i) => (
            <Mass
              key={i}
              value={v}
              x={massPositions[i].x}
              y={massPositions[i].y}
              highlight={isHighlighted(i)}
              dimmed={isDimmed(i)}
              mode={activeMode}
              stackIdx={stacks[i]}
              onClick={e => { e.stopPropagation(); }}
            />
          ))}
        </motion.g>

        {/* Fulcrum drag target (invisible, wider hit area) */}
        <rect
          x={fulcrumX - 24}
          y={BEAM_Y + 5}
          width={48}
          height={FULCRUM_H + 30}
          fill="transparent"
          style={{ cursor: draggingFulcrum ? 'grabbing' : 'grab' }}
          onPointerDown={onFulcrumPointerDown}
          onClick={e => e.stopPropagation()}
        />

        {/* Hint text when empty */}
        {values.length === 0 && (
          <text
            x={W / 2} y={BEAM_Y - 50}
            textAnchor="middle"
            fill="rgba(255,255,255,0.2)"
            fontSize={14}
            fontFamily="Inter, sans-serif"
          >
            Click the beam or use controls below to add values
          </text>
        )}

        {/* Drag-fulcrum hint */}
        {activeMode === 'mean' && values.length > 0 && fulcrumVal === null && (
          <text
            x={fulcrumX} y={BEAM_Y + FULCRUM_H + 44}
            textAnchor="middle"
            fill={`${COLOR.mean}88`}
            fontSize={10}
            fontFamily="Inter, sans-serif"
          >
            drag to unbalance
          </text>
        )}
      </svg>
    </div>
  );
}
