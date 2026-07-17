import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, Download, Trash2, X, Swords } from 'lucide-react';
import { useArenaStore } from '../../stores/arena-store';
import { useSettingsStore } from '../../stores/settings-store';
import { ArenaStage, type Ranking } from '../../features/arena/ArenaStage';
import { ENVIRONMENTS } from '../../engine/environments/index';
import { download } from '../../features/io';
import { EmptyState } from '../../components/ui';

const SPEEDS = [1, 2, 4];

export function ArenaPage(): React.ReactElement {
  const navigate = useNavigate();
  const { competitors, env, remove, clear, setEnv } = useArenaStore();
  const settings = useSettingsStore();
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [restartKey, setRestartKey] = useState(0);
  const [rankings, setRankings] = useState<Ranking[]>([]);

  const restart = (): void => {
    setRestartKey((k) => k + 1);
    setRunning(true);
  };

  const exportResults = (): void => {
    download('arena-result.json', {
      kind: 'arena-result',
      env,
      timestamp: Date.now(),
      rankings: rankings.map((r, i) => ({ place: i + 1, name: r.name, distance: r.distance, finished: r.finished })),
    });
  };

  if (competitors.length < 1) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="text-signal-violet" size={20} />
          <h1 className="text-lg font-semibold text-slate-100">Arena</h1>
        </div>
        <EmptyState title="Add creatures to race">
          Open the <button className="text-specimen underline" onClick={() => navigate('/gallery')}>Gallery</button> and use
          the crossed-swords button to add 2–8 saved creatures, then race them here on the same course and seed.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Swords className="text-signal-violet" size={18} />
        <h1 className="text-base font-semibold text-slate-100">Arena</h1>
        <select
          className="input w-auto"
          value={`${env.kind}:${env.preset}`}
          onChange={(e) => {
            const [k, p] = e.target.value.split(':');
            setEnv(k as never, p as never);
            restart();
          }}
        >
          {ENVIRONMENTS.flatMap((en) =>
            en.presets.map((p) => (
              <option key={`${en.kind}:${p.id}`} value={`${en.kind}:${p.id}`}>
                {en.name} · {p.label}
              </option>
            )),
          )}
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn-ghost" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause' : 'Play'}
          </button>
          <button className="btn-ghost" onClick={restart}>
            <RotateCcw size={14} /> Restart
          </button>
          <div className="flex rounded-lg bg-black/20 p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-0.5 text-xs ${speed === s ? 'bg-specimen/20 text-specimen' : 'text-slate-400'}`}
              >
                {s}×
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={exportResults}>
            <Download size={14} /> Results
          </button>
          <button className="btn-danger" onClick={clear}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="glass min-h-[300px] p-2">
          <ArenaStage
            competitors={competitors}
            env={env}
            running={running}
            speed={speed}
            restartKey={restartKey}
            onRankings={setRankings}
            colorBlind={settings.colorBlind}
            light={settings.theme === 'light'}
          />
        </div>
        <div className="glass flex flex-col gap-2 p-3">
          <h2 className="panel-title">Live rankings</h2>
          <ol className="space-y-1">
            {rankings.map((r, i) => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-sm">
                <span className="mono w-4 text-slate-500">{i + 1}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: `hsl(${r.hue},60%,55%)` }} />
                <span className="flex-1 truncate text-slate-200">{r.name}</span>
                <span className="mono text-[11px] text-specimen">{r.distance.toFixed(1)}m</span>
                {r.finished && <span className="text-[10px] text-signal-lime">✓</span>}
              </li>
            ))}
          </ol>
          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="panel-title mb-1">Roster</div>
            {competitors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${c.hue},60%,55%)` }} />
                <span className="flex-1 truncate text-slate-300">{c.name}</span>
                <button className="text-slate-500 hover:text-signal-rose" onClick={() => remove(c.id)} aria-label="Remove">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-auto text-[10px] text-slate-600">
            All competitors run the same environment and seed. Arena races don't change saved fitness.
          </p>
        </div>
      </div>
    </div>
  );
}
