import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, FlaskConical, Trash2, PlayCircle, BookOpen } from 'lucide-react';
import { useLabStore } from '../../stores/lab-store';
import { listExperiments, deleteExperiment } from '../../db/index';
import type { StoredExperiment } from '../../db/types';
import { Panel } from '../../components/ui';

const STEPS = [
  { n: 1, title: 'Meet your ancestor', text: 'Start from a generated creature or design your own body and joints.' },
  { n: 2, title: 'Choose what survival means', text: 'Pick an environment and shape the fitness objective.' },
  { n: 3, title: 'Create the first population', text: 'Mutations spawn a diverse population from your ancestor.' },
  { n: 4, title: 'Start evolution', text: 'Real physics evaluates every creature in parallel workers.' },
  { n: 5, title: 'Watch mutations compete', text: 'Selection, crossover and mutation improve each generation.' },
  { n: 6, title: 'Inspect your champion', text: 'Replay it, compare it with the ancestor, and save it.' },
];

export function LandingPage(): React.ReactElement {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<StoredExperiment[]>([]);
  const loadFromStored = useLabStore((s) => s.loadFromStored);

  useEffect(() => {
    void listExperiments().then(setExperiments);
  }, []);

  const quickStart = (): void => {
    useLabStore.getState().newExperiment();
    useLabStore.getState().setName('Quick Start');
    void useLabStore.getState().start(20);
    navigate('/lab');
  };

  const openExperiment = (exp: StoredExperiment): void => {
    loadFromStored(exp);
    navigate('/lab');
  };

  const remove = async (id: string): Promise<void> => {
    await deleteExperiment(id);
    setExperiments(await listExperiments());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <section className="glass relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-grid-fine [background-size:32px_32px] opacity-40" />
        <div className="relative max-w-2xl space-y-4">
          <span className="chip text-specimen">Neuroevolution laboratory</span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            Design the ancestor. Define the challenge.
            <br />
            Watch evolution discover a creature you'd never design yourself.
          </h1>
          <p className="text-sm text-slate-400">
            A real deterministic physics simulation with inherited genomes, mutation, selection,
            measurable fitness, lineage tracking, replays and saved experiments — all running locally
            in your browser.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={quickStart}>
              <Rocket size={16} /> Quick Start
            </button>
            <button className="btn-ghost" onClick={() => navigate('/lab')}>
              <FlaskConical size={16} /> Open the Lab
            </button>
            <button className="btn-ghost" onClick={() => navigate('/learn')}>
              <BookOpen size={16} /> Learn how it works
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="panel-title mb-3">How it works</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="glass p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-specimen/15 text-xs font-semibold text-specimen">
                  {s.n}
                </span>
                <h3 className="text-sm font-semibold text-slate-200">{s.title}</h3>
              </div>
              <p className="text-xs text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="panel-title mb-3">Your experiments</h2>
        {experiments.length === 0 ? (
          <Panel>
            <div className="p-4 text-center text-sm text-slate-500">
              No saved experiments yet. Hit <span className="text-specimen">Quick Start</span> to create one — it
              autosaves as it evolves.
            </div>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {experiments.map((exp) => (
              <div key={exp.id} className="glass flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{exp.name}</div>
                    <div className="mono text-[10px] text-slate-500">
                      {exp.env.kind} · gen {exp.generation} · seed {exp.seed}
                    </div>
                  </div>
                  <button
                    className="text-slate-500 hover:text-signal-rose"
                    onClick={() => remove(exp.id)}
                    aria-label="Delete experiment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mono text-[11px] text-specimen">
                  best {exp.championFitness > -Infinity ? exp.championFitness.toFixed(1) : '—'}
                </div>
                <button className="btn-ghost mt-auto justify-center" onClick={() => openExperiment(exp)}>
                  <PlayCircle size={14} /> Open
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
