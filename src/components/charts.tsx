/** Recharts-based analytics for the evolution run. */

import React from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import type { GenerationSummary } from '../engine/evolution/types';

const AXIS = { stroke: '#64748b', fontSize: 10 };
const GRID = 'rgba(255,255,255,0.05)';

export function FitnessChart({ summaries }: { summaries: GenerationSummary[] }): React.ReactElement {
  const data = summaries.map((s) => ({
    gen: s.generation,
    best: round(s.best),
    mean: round(s.mean),
    median: round(s.median),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="gen" tick={AXIS} stroke={AXIS.stroke} />
        <YAxis tick={AXIS} stroke={AXIS.stroke} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Generation ${l}`} />
        <Line type="monotone" dataKey="best" stroke="#5eead4" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="mean" stroke="#60a5fa" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <Line type="monotone" dataKey="median" stroke="#a78bfa" dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DiversityChart({ summaries }: { summaries: GenerationSummary[] }): React.ReactElement {
  const data = summaries.map((s) => ({ gen: s.generation, diversity: round(s.diversity), species: s.speciesCount }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="gen" tick={AXIS} stroke={AXIS.stroke} />
        <YAxis tick={AXIS} stroke={AXIS.stroke} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Generation ${l}`} />
        <Line type="monotone" dataKey="diversity" stroke="#fbbf24" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="species" stroke="#fb7185" dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({ values }: { values: number[] }): React.ReactElement {
  const bins = histogram(values, 12);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bins} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} stroke={AXIS.stroke} />
        <YAxis tick={AXIS} stroke={AXIS.stroke} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill="#4fd1c5" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function histogram(values: number[], count: number): { label: string; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bins = new Array(count).fill(0);
  for (const v of values) {
    const idx = Math.min(count - 1, Math.floor(((v - min) / span) * count));
    bins[idx]++;
  }
  return bins.map((c, i) => ({ label: (min + (i / count) * span).toFixed(0), count: c }));
}

const tooltipStyle: React.CSSProperties = {
  background: '#161b26',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 11,
  color: '#e2e8f0',
};

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
