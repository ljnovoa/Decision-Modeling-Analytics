import { motion } from 'framer-motion';

const MODES = [
  { id: 'mean',   label: 'Mean',   symbol: 'μ',  color: '#38bdf8', desc: 'Balance point of the data' },
  { id: 'median', label: 'Median', symbol: 'M',  color: '#a78bfa', desc: 'Middle value when sorted'  },
  { id: 'mode',   label: 'Mode',   symbol: 'Mo', color: '#fb923c', desc: 'Most frequent value'       },
];

export default function ModeSwitcher({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 10, justifyContent: 'center',
      padding: '0 16px',
    }}>
      {MODES.map(m => {
        const isActive = active === m.id;
        return (
          <motion.button
            key={m.id}
            onClick={() => onChange(m.id)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2,
              padding: '10px 24px',
              borderRadius: 12,
              border: `1.5px solid ${isActive ? m.color : 'rgba(255,255,255,0.1)'}`,
              background: isActive
                ? `linear-gradient(135deg, ${m.color}22, ${m.color}08)`
                : 'rgba(255,255,255,0.03)',
              color: isActive ? m.color : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: 120,
              boxShadow: isActive ? `0 0 20px ${m.color}33, inset 0 0 20px ${m.color}08` : 'none',
            }}
          >
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
              {m.symbol}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>{m.label}</span>
            <span style={{ fontSize: 10, opacity: 0.7, textAlign: 'center', lineHeight: 1.3 }}>{m.desc}</span>
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                style={{
                  position: 'absolute', bottom: -2, left: '20%', right: '20%',
                  height: 2, borderRadius: 1,
                  background: m.color,
                  boxShadow: `0 0 8px ${m.color}`,
                }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
