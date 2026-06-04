import { motion, AnimatePresence } from 'framer-motion';

const COLOR = { mean: '#38bdf8', median: '#a78bfa', mode: '#fb923c' };

function Pill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '12px 20px', borderRadius: 12,
      background: `${color}11`,
      border: `1px solid ${color}33`,
      minWidth: 90,
    }}>
      <span style={{ fontSize: 10, color: `${color}99`, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 22, fontWeight: 700, color,
            textShadow: `0 0 12px ${color}88`,
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function StatPanel({ stats, activeMode, values }) {
  const { mean, median, modes } = stats;

  const fmt = v => v === null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2);
  const modeStr = modes.length === 0 ? 'none' : modes.join(', ');

  const explain = {
    mean: mean === null ? 'Add values to see the balance point.'
      : `The mean (${fmt(mean)}) is where the fulcrum must sit to keep the beam perfectly level. Every value pulls the balance point toward it.`,
    median: median === null ? 'Add values to find the middle.'
      : values.length % 2 === 1
        ? `The median (${fmt(median)}) is the single middle value when all ${values.length} values are sorted from smallest to largest.`
        : `With an even count (${values.length}), the median is the average of the two middle values: ${fmt(median)}.`,
    mode: modes.length === 0
      ? 'No value repeats — there is no mode in this dataset.'
      : `The mode (${modeStr}) is the value that appears most often. Stacks show frequency — the tallest stack wins.`,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      padding: '16px 20px',
      background: 'rgba(13,17,23,0.7)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      minWidth: 260,
    }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Pill label="Mean" value={fmt(mean)} color={COLOR.mean} />
        <Pill label="Median" value={fmt(median)} color={COLOR.median} />
        <Pill label="Mode" value={modeStr} color={COLOR.mode} />
        <Pill label="n" value={values.length} color="#6b7280" />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={activeMode + String(mean) + String(median) + modeStr}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            fontSize: 12, color: '#94a3b8', lineHeight: 1.6,
            textAlign: 'center', padding: '0 4px',
            borderTop: `1px solid ${COLOR[activeMode]}22`,
            paddingTop: 10,
          }}
        >
          {explain[activeMode]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
