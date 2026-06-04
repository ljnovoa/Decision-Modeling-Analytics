import { useState } from 'react';
import { motion } from 'framer-motion';
import BeamScene from './components/BeamScene';
import ModeSwitcher from './components/ModeSwitcher';
import StatPanel from './components/StatPanel';
import Controls from './components/Controls';
import { computeStats } from './hooks/useStats';

const BG_DOTS = `radial-gradient(circle at 20% 20%, rgba(56,189,248,0.04) 0%, transparent 50%),
  radial-gradient(circle at 80% 80%, rgba(167,139,250,0.04) 0%, transparent 50%),
  radial-gradient(circle at 50% 50%, rgba(251,146,60,0.02) 0%, transparent 60%)`;

export default function App() {
  const [values, setValues] = useState([3, 7, 7, 10, 13]);
  const [activeMode, setActiveMode] = useState('mean');

  const stats = computeStats(values);

  const addValue = v => setValues(prev => prev.length < 15 ? [...prev, v] : prev);
  const removeLast = () => setValues(prev => prev.slice(0, -1));

  return (
    <div style={{
      width: '100%', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: `${BG_DOTS}, #060a12`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        padding: '14px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(13,17,23,0.8)', backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{
            fontSize: 18, fontWeight: 700, letterSpacing: -0.5,
            background: 'linear-gradient(90deg, #38bdf8, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            StatBalance
          </span>
          <span style={{ fontSize: 12, color: '#4b5563' }}>mean · median · mode explorer</span>
        </div>
        <div style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
          click beam to add · drag fulcrum to feel torque
        </div>
      </header>

      {/* Main canvas area */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        gap: 8, padding: '8px 16px 4px',
        overflow: 'hidden',
      }}>
        <ModeSwitcher active={activeMode} onChange={setActiveMode} />

        <div style={{
          width: '100%', maxWidth: 940,
          background: 'rgba(13,17,23,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '12px 0 4px',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}>
          <BeamScene
            values={values}
            activeMode={activeMode}
            onClickMass={addValue}
          />
        </div>

        <div style={{ width: '100%', maxWidth: 940, flexShrink: 0 }}>
          <StatPanel stats={stats} activeMode={activeMode} values={values} />
        </div>

        <div style={{
          width: '100%', maxWidth: 940,
          background: 'rgba(13,17,23,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: '12px 16px',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}>
          <Controls
            values={values}
            onAdd={addValue}
            onRemoveLast={removeLast}
            onSetValues={setValues}
            activeMode={activeMode}
          />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '6px 32px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', justifyContent: 'center', gap: 32,
        flexShrink: 0,
      }}>
        {[
          { mode: 'mean',   hint: 'The mean is the torque-balance point — equal weighted sum of distances left and right.' },
          { mode: 'median', hint: 'The median splits the sorted list in half — resistant to extreme outliers.' },
          { mode: 'mode',   hint: 'The mode is the peak of the frequency distribution — only defined when a value repeats.' },
        ].map(({ mode, hint }) => (
          <motion.p
            key={mode}
            animate={{ opacity: activeMode === mode ? 1 : 0.2 }}
            style={{ fontSize: 10, color: '#6b7280', maxWidth: 260, textAlign: 'center', lineHeight: 1.5 }}
          >
            {hint}
          </motion.p>
        ))}
      </footer>
    </div>
  );
}
