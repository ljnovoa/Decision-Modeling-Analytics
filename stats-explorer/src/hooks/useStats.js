export function computeStats(values) {
  if (!values.length) return { mean: null, median: null, modes: [], sortedIndices: [] };

  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;

  const sortedIndices = [...values.keys()].sort((a, b) => values[a] - values[b]);
  const sorted = sortedIndices.map(i => values[i]);
  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  const freq = {};
  values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const modes = maxFreq > 1 ? Object.keys(freq).filter(k => freq[k] === maxFreq).map(Number) : [];

  return { mean, median, modes, sortedIndices, freq, maxFreq };
}

// For stacking in mode view: given values array, return stack index per value
export function computeStacks(values) {
  const counter = {};
  return values.map(v => {
    const idx = counter[v] || 0;
    counter[v] = idx + 1;
    return idx;
  });
}
