import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MAX = 15;
const VAL_MIN = 1;
const VAL_MAX = 20;

const PRESETS = [
  { label: 'Symmetric', values: [3, 5, 7, 10, 10, 13, 15, 17] },
  { label: 'Skewed R', values: [1, 2, 2, 3, 4, 5, 12, 18, 20] },
  { label: 'Bimodal', values: [3, 3, 4, 10, 11, 16, 17, 17] },
  { label: 'Uniform', values: [2, 5, 8, 11, 14, 17, 20] },
  { label: 'Outlier', values: [5, 6, 6, 7, 7, 7, 8, 19] },
];

export default function Controls({ values, onAdd, onRemoveLast, onSetValues, activeMode }) {
  const [input, setInput] = useState('');
  const color = { mean: '#38bdf8', median: '#a78bfa', mode: '#fb923c' }[activeMode];

  const submit = () => {
    const v = parseInt(input, 10);
    if (!isNaN(v) && v >= VAL_MIN && v <= VAL_MAX && values.length < MAX) {
      onAdd(v);
      setInput('');
    }
  };

  const onKey = e => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="number"
          min={VAL_MIN} max={VAL_MAX}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Value (${VAL_MIN}–${VAL_MAX})`}
          style={{
            width: 140, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${color}44`,
            color: '#e2e8f0', fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
          }}
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={submit}
          disabled={values.length >= MAX}
          style={{
            padding: '8px 18px', borderRadius: 8,
            background: values.length >= MAX ? 'rgba(255,255,255,0.05)' : `${color}22`,
            border: `1px solid ${values.length >= MAX ? 'rgba(255,255,255,0.1)' : color + '66'}`,
            color: values.length >= MAX ? '#4b5563' : color,
            cursor: values.length >= MAX ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          + Add
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onRemoveLast}
          disabled={values.length === 0}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: values.length === 0 ? '#374151' : '#9ca3af',
            cursor: values.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          ← Undo
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onSetValues([])}
          disabled={values.length === 0}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: values.length === 0 ? '#374151' : '#9ca3af',
            cursor: values.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          Clear
        </motion.button>
        <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
          {values.length}/{MAX}
        </span>
      </div>

      {/* Current values chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', minHeight: 30 }}>
        <AnimatePresence>
          {values.map((v, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                padding: '3px 10px', borderRadius: 20,
                background: `${color}18`,
                border: `1px solid ${color}44`,
                color, fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
              }}
            >
              {v}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#4b5563', alignSelf: 'center', marginRight: 4 }}>Presets:</span>
        {PRESETS.map(p => (
          <motion.button
            key={p.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSetValues(p.values)}
            style={{
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#9ca3af', fontSize: 11, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {p.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
