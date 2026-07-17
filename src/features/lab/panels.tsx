import React, { useMemo } from 'react';
import { useLabStore } from '../../stores/lab-store';
import { resolveEnvironment, ENVIRONMENTS } from '../../engine/environments/index';
import type { EnvKind } from '../../engine/environments/types';
import { evaluate } from '../../engine/simulate';
import { Labeled, Slider, Stat } from '../../components/ui';

export function EnvironmentPanel(): React.ReactElement {
  const env = useLabStore((s) => s.env);
  const setEnvironment = useLabStore((s) => s.setEnvironment);
  const status = useLabStore((s) => s.status);
  const disabled = status !== 'idle';
  const resolved = resolveEnvironment(env.kind, env.preset);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-1.5">
        {ENVIRONMENTS.map((e) => (
          <button
            key={e.kind}
            disabled={disabled}
            onClick={() => setEnvironment(e.kind as EnvKind, env.preset)}
            className={`rounded-lg border p-2 text-left text-xs transition-colors disabled:opacity-40 ${
              env.kind === e.kind
                ? 'border-specimen bg-specimen/10'
                : 'border-white/10 bg-white/5 hover:border-specimen/40'
            }`}
          >
            <div className="font-medium text-slate-200">{e.name}</div>
            <div className="text-[11px] text-slate-500">{e.description}</div>
          </button>
        ))}
      </div>
      <div>
        <div className="panel-title mb-1.5">Difficulty preset</div>
        <div className="flex gap-1">
          {ENVIRONMENTS.find((e) => e.kind === env.kind)!.presets.map((p) => (
            <button
              key={p.id}
              disabled={disabled}
              onClick={() => setEnvironment(env.kind, p.id)}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-40 ${
                env.preset === p.id ? 'border-specimen bg-specimen/15 text-specimen' : 'border-white/10 bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="Finish line" value={resolved.finishX} unit="m" />
        <Stat label="Trial length" value={resolved.duration} unit="s" />
      </div>
    </div>
  );
}

export function ObjectivesPanel(): React.ReactElement {
  const env = useLabStore((s) => s.env);
  const weights = useLabStore((s) => s.weights);
  const setWeight = useLabStore((s) => s.setWeight);
  const resetWeights = useLabStore((s) => s.resetWeights);
  const champion = useLabStore((s) => s.champion);
  const seed = useLabStore((s) => s.seed);
  const duration = useLabStore((s) => s.config.duration);
  const resolved = resolveEnvironment(env.kind, env.preset);

  const breakdown = useMemo(() => {
    if (!champion) return null;
    const r = evaluate({ genome: champion.genome, env: resolved, weights, seed, duration });
    return r.breakdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion?.genome.id, weights, env.kind, env.preset]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        Fitness is a weighted sum of these components. Balance them to avoid reward exploits (e.g.
        pair raw speed with stability).
      </p>
      {resolved.components.map((c) => (
        <Labeled key={c.id} label={`${c.label} (${c.unit})`} hint={c.description}>
          <Slider
            min={c.penalty ? -30 : 0}
            max={c.penalty ? 0 : 40}
            step={0.5}
            value={weights[c.id] ?? c.defaultWeight}
            onChange={(v) => setWeight(c.id, v)}
            format={(v) => v.toFixed(1)}
          />
        </Labeled>
      ))}
      <button className="btn-ghost w-full" onClick={resetWeights}>
        Reset to recommended
      </button>
      {breakdown && (
        <div className="rounded-lg bg-black/20 p-2 text-[11px]">
          <div className="panel-title mb-1">Champion breakdown</div>
          {resolved.components.map((c) => (
            <div key={c.id} className="flex justify-between">
              <span className="text-slate-400">{c.label}</span>
              <span className={`mono ${(breakdown.components[c.id] ?? 0) < 0 ? 'text-signal-rose' : 'text-specimen'}`}>
                {(breakdown.components[c.id] ?? 0) >= 0 ? '+' : ''}
                {(breakdown.components[c.id] ?? 0).toFixed(1)}
              </span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-white/10 pt-1 font-semibold">
            <span>Total</span>
            <span className="mono">{breakdown.total.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MutationPanel(): React.ReactElement {
  const mutation = useLabStore((s) => s.config.mutation);
  const setRate = useLabStore((s) => s.setMutationRate);
  const rows: { key: keyof typeof mutation; label: string; max: number; hint: string }[] = [
    { key: 'controllerRate', label: 'Controller mutation', max: 1, hint: 'Probability of perturbing the controller.' },
    { key: 'morphologyRate', label: 'Morphology mutation', max: 1, hint: 'Probability of a body-parameter change.' },
    { key: 'weightScale', label: 'Weight scale', max: 1, hint: 'Std-dev of neural weight perturbations.' },
    { key: 'addSegmentRate', label: 'Add segment', max: 0.3, hint: 'Chance of growing a new segment.' },
    { key: 'removeSegmentRate', label: 'Remove segment', max: 0.3, hint: 'Chance of dropping a leaf segment.' },
    { key: 'duplicateBranchRate', label: 'Duplicate branch', max: 0.3, hint: 'Chance of duplicating a limb.' },
    { key: 'dimensionScale', label: 'Dimension scale', max: 0.5, hint: 'Relative size-change magnitude.' },
    { key: 'phaseScale', label: 'Phase scale', max: 1, hint: 'CPG phase perturbation magnitude.' },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <Labeled key={r.key} label={r.label} hint={r.hint}>
          <Slider min={0} max={r.max} value={mutation[r.key]} onChange={(v) => setRate(r.key, v)} />
        </Labeled>
      ))}
    </div>
  );
}

export function ConfigPanel(): React.ReactElement {
  const config = useLabStore((s) => s.config);
  const setPopulationSize = useLabStore((s) => s.setPopulationSize);
  const setDuration = useLabStore((s) => s.setDuration);
  const status = useLabStore((s) => s.status);
  const disabled = status === 'running';
  return (
    <div className="space-y-2.5">
      <Labeled label={`Population size: ${config.populationSize}`} hint="Individuals evaluated each generation.">
        <input
          type="range"
          min={6}
          max={120}
          step={2}
          value={config.populationSize}
          disabled={disabled}
          onChange={(e) => setPopulationSize(parseInt(e.target.value))}
        />
      </Labeled>
      <Labeled label={`Trial length: ${config.duration}s`} hint="Simulated seconds per evaluation.">
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={config.duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
        />
      </Labeled>
    </div>
  );
}
