import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Copy,
  Save,
  Download,
  Upload,
  Crown,
  Trophy,
  Ghost as GhostIcon,
} from 'lucide-react';
import { useLabStore } from '../../stores/lab-store';
import { useSettingsStore } from '../../stores/settings-store';
import { Panel, Tabs, Stat } from '../../components/ui';
import { WidgetErrorBoundary } from '../../components/ErrorBoundary';
import { SimulationViewport } from '../../features/simulation/SimulationViewport';
import { BuilderPanel } from '../../features/builder/BuilderPanel';
import { EnvironmentPanel, ObjectivesPanel, MutationPanel, ConfigPanel } from '../../features/lab/panels';
import { FitnessChart, DiversityChart, DistributionChart } from '../../components/charts';
import { MapElitesHeatmap } from '../../features/evolution/MapElitesHeatmap';
import { diffGenomes } from '../../features/genome-diff';
import { exportCreature, exportExperiment, importExperiment, importCreature, readFileText } from '../../features/io';
import { addToHallOfFame } from '../../features/gallery/hof';

type LeftTab = 'build' | 'environment' | 'objectives' | 'mutation';
type RightTab = 'evolution' | 'population' | 'champion' | 'lineage';
type BottomTab = 'fitness' | 'diversity' | 'distribution' | 'archive' | 'diary';

export function LabPage(): React.ReactElement {
  const store = useLabStore();
  const settings = useSettingsStore();
  const [leftTab, setLeftTab] = useState<LeftTab>('build');
  const [rightTab, setRightTab] = useState<RightTab>('evolution');
  const [bottomTab, setBottomTab] = useState<BottomTab>('fitness');
  const [generations, setGenerations] = useState(20);
  const [showGhost, setShowGhost] = useState(false);
  const [watchChampion, setWatchChampion] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importKindRef = useRef<'creature' | 'experiment'>('creature');

  const displayGenome = watchChampion && store.champion ? store.champion.genome : store.ancestor;
  const ghost = showGhost ? store.ancestor : null;

  const flash = (msg: string): void => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleStart = (): void => {
    void store.start(generations);
  };
  const handleResume = (): void => {
    void store.resume(generations);
  };
  const handleStep = (): void => {
    void store.stepGeneration();
  };

  const copySeed = (): void => {
    void navigator.clipboard?.writeText(String(store.seed)).then(() => flash('Seed copied'));
  };

  const save = async (): Promise<void> => {
    await store.saveNow();
    flash('Experiment saved locally');
  };

  const exportExp = (): void => {
    exportExperiment(
      {
        kind: 'evolution',
        version: 1,
        name: store.name,
        seed: store.seed,
        env: store.env,
        weights: store.weights,
        ancestor: store.ancestor,
        summaries: store.summaries,
        champion: store.champion?.genome ?? null,
        championReplay: store.champion?.replay ?? null,
      },
      true,
    );
  };

  const onImportFile = async (file: File): Promise<void> => {
    try {
      const text = await readFileText(file);
      if (importKindRef.current === 'experiment') {
        const exp = importExperiment(text);
        store.setName(exp.name);
        store.setSeed(exp.seed);
        store.setEnvironment(exp.env.kind, exp.env.preset);
        store.setAncestor(exp.ancestor);
        flash('Experiment imported');
      } else {
        const genome = importCreature(text);
        genome.metadata.origin = 'imported';
        store.setAncestor(genome);
        flash('Creature imported as ancestor');
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const addChampionToHof = async (): Promise<void> => {
    if (!store.champion) return;
    store.regenerateChampionReplay();
    await addToHallOfFame({
      genome: store.champion.genome,
      fitness: store.champion.fitness,
      distance: store.champion.distance,
      env: store.env,
      category: 'highest',
      replay: store.champion.replay,
    });
    flash('Champion added to Hall of Fame');
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* Toolbar */}
      <div className="glass flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          className="input max-w-[220px] flex-shrink"
          value={store.name}
          onChange={(e) => store.setName(e.target.value)}
          aria-label="Experiment name"
        />
        <span className="chip mono">
          seed {store.seed}
          <button onClick={copySeed} aria-label="Copy seed" className="ml-1 hover:text-specimen">
            <Copy size={11} />
          </button>
        </span>
        <input
          type="number"
          className="input w-24"
          value={store.seed}
          onChange={(e) => store.setSeed(parseInt(e.target.value) || 0)}
          disabled={store.status !== 'idle'}
          aria-label="Seed"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn-ghost" onClick={save}>
            <Save size={14} /> Save
          </button>
          <button className="btn-ghost" onClick={exportExp}>
            <Download size={14} /> Export
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              importKindRef.current = 'experiment';
              fileRef.current?.click();
            }}
          >
            <Upload size={14} /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Left panel */}
        <div className="flex min-h-0 flex-col gap-2 overflow-auto">
          <Tabs
            tabs={[
              { id: 'build', label: 'Build' },
              { id: 'environment', label: 'Env' },
              { id: 'objectives', label: 'Fitness' },
              { id: 'mutation', label: 'Mutate' },
            ]}
            active={leftTab}
            onChange={setLeftTab}
          />
          <Panel className="min-h-0 flex-1 overflow-auto">
            <WidgetErrorBoundary label="Design panel">
              {leftTab === 'build' && <BuilderPanel />}
              {leftTab === 'environment' && <EnvironmentPanel />}
              {leftTab === 'objectives' && <ObjectivesPanel />}
              {leftTab === 'mutation' && (
                <div className="space-y-4">
                  <ConfigPanel />
                  <div className="border-t border-white/10 pt-3">
                    <MutationPanel />
                  </div>
                </div>
              )}
            </WidgetErrorBoundary>
          </Panel>
        </div>

        {/* Center viewport */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-black/20 p-0.5 text-xs">
              <button
                className={`rounded px-2 py-1 ${watchChampion ? 'bg-specimen/20 text-specimen' : 'text-slate-400'}`}
                onClick={() => setWatchChampion(true)}
                disabled={!store.champion}
              >
                <Crown size={12} className="mr-1 inline" />
                Champion
              </button>
              <button
                className={`rounded px-2 py-1 ${!watchChampion ? 'bg-specimen/20 text-specimen' : 'text-slate-400'}`}
                onClick={() => setWatchChampion(false)}
              >
                Ancestor
              </button>
            </div>
            <button
              className={`chip ${showGhost ? 'text-specimen' : ''}`}
              onClick={() => setShowGhost((g) => !g)}
              aria-pressed={showGhost}
            >
              <GhostIcon size={12} /> Ghost ancestor
            </button>
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <span className="mono">gen {store.generation}</span>
              {store.champion && <span className="mono text-specimen">best {store.champion.fitness.toFixed(1)}</span>}
            </div>
          </div>
          <div className="glass min-h-0 flex-1 p-2">
            <WidgetErrorBoundary label="Viewport">
              <SimulationViewport
                genome={displayGenome}
                env={store.env}
                ghostGenome={ghost}
                colorBlind={settings.colorBlind}
                light={settings.theme === 'light'}
                showPerf={settings.showPerfOverlay}
              />
            </WidgetErrorBoundary>
          </div>
          {/* Bottom analytics drawer */}
          <div className="glass p-2">
            <Tabs
              tabs={[
                { id: 'fitness', label: 'Fitness' },
                { id: 'diversity', label: 'Diversity' },
                { id: 'distribution', label: 'Distribution' },
                { id: 'archive', label: 'Archive' },
                { id: 'diary', label: 'Diary' },
              ]}
              active={bottomTab}
              onChange={setBottomTab}
            />
            <div className="mt-2 h-40">
              <WidgetErrorBoundary label="Analytics">
                {bottomTab === 'fitness' &&
                  (store.summaries.length ? (
                    <FitnessChart summaries={store.summaries} />
                  ) : (
                    <ChartEmpty text="Run evolution to chart best / mean / median fitness." />
                  ))}
                {bottomTab === 'diversity' &&
                  (store.summaries.length ? (
                    <DiversityChart summaries={store.summaries} />
                  ) : (
                    <ChartEmpty text="Diversity and species counts appear here." />
                  ))}
                {bottomTab === 'distribution' &&
                  (store.lastFitnessDistribution.length ? (
                    <DistributionChart values={store.lastFitnessDistribution} />
                  ) : (
                    <ChartEmpty text="Population fitness distribution appears here." />
                  ))}
                {bottomTab === 'archive' && (
                  <div className="h-full overflow-auto">
                    <MapElitesHeatmap version={store.archiveVersion} onSelect={(g) => store.setAncestor(g)} />
                  </div>
                )}
                {bottomTab === 'diary' && (
                  <div className="h-full space-y-1 overflow-auto text-[11px] text-slate-300">
                    {store.diary.length === 0 && <ChartEmpty text="The evolution diary narrates each generation." />}
                    {store.diary
                      .slice()
                      .reverse()
                      .map((d, i) => (
                        <p key={i} className="rounded bg-black/20 p-1.5">
                          {d}
                        </p>
                      ))}
                  </div>
                )}
              </WidgetErrorBoundary>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex min-h-0 flex-col gap-2 overflow-auto">
          <Tabs
            tabs={[
              { id: 'evolution', label: 'Evolve' },
              { id: 'population', label: 'Species' },
              { id: 'champion', label: 'Champion' },
              { id: 'lineage', label: 'Compare' },
            ]}
            active={rightTab}
            onChange={setRightTab}
          />
          <Panel className="min-h-0 flex-1 overflow-auto">
            <WidgetErrorBoundary label="Evolution panel">
              {rightTab === 'evolution' && (
                <EvolvePanel
                  generations={generations}
                  setGenerations={setGenerations}
                  onStart={handleStart}
                  onResume={handleResume}
                  onStep={handleStep}
                />
              )}
              {rightTab === 'population' && <SpeciesPanel />}
              {rightTab === 'champion' && (
                <ChampionPanel onAddToHof={addChampionToHof} onExport={() => store.champion && exportCreature(store.champion.genome)} />
              )}
              {rightTab === 'lineage' && <ComparePanel />}
            </WidgetErrorBoundary>
          </Panel>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-specimen/30 bg-graphite-800 px-4 py-2 text-sm text-specimen shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function EvolvePanel({
  generations,
  setGenerations,
  onStart,
  onResume,
  onStep,
}: {
  generations: number;
  setGenerations: (n: number) => void;
  onStart: () => void;
  onResume: () => void;
  onStep: () => void;
}): React.ReactElement {
  const status = useLabStore((s) => s.status);
  const progress = useLabStore((s) => s.progress);
  const pause = useLabStore((s) => s.pause);
  const reset = useLabStore((s) => s.reset);
  const summaries = useLabStore((s) => s.summaries);
  const last = summaries[summaries.length - 1];
  const pct = progress.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-400">
        Generations to run
        <input
          type="number"
          min={1}
          max={500}
          value={generations}
          onChange={(e) => setGenerations(parseInt(e.target.value) || 1)}
          className="input mt-1"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {status === 'running' ? (
          <button className="btn-danger flex-1" onClick={pause}>
            <Pause size={14} /> Pause
          </button>
        ) : status === 'paused' ? (
          <button className="btn-primary flex-1" onClick={onResume}>
            <Play size={14} /> Resume
          </button>
        ) : (
          <button className="btn-primary flex-1" onClick={onStart}>
            <Play size={14} /> Start evolution
          </button>
        )}
        <button className="btn-ghost" onClick={onStep} disabled={status === 'running'} title="Run one generation">
          <SkipForward size={14} />
        </button>
        <button className="btn-ghost" onClick={reset} title="Reset run">
          <Square size={14} />
        </button>
      </div>

      {status !== 'idle' && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-specimen transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>
              {progress.completed}/{progress.total} evaluated
            </span>
            <span>{progress.evalsPerSecond.toFixed(0)} eval/s</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="Best" value={last ? last.best.toFixed(1) : '—'} accent="#5eead4" />
        <Stat label="Mean" value={last ? last.mean.toFixed(1) : '—'} accent="#60a5fa" />
        <Stat label="Species" value={last ? last.speciesCount : '—'} />
        <Stat label="Diversity" value={last ? last.diversity.toFixed(2) : '—'} />
      </div>

      <div className="rounded-lg bg-black/20 p-2 text-[10px] text-slate-500">
        {progress.usingWorkers
          ? `${progress.workerCount} worker${progress.workerCount === 1 ? '' : 's'} evaluating in parallel`
          : status === 'idle'
            ? 'Evaluation runs in Web Workers (single-thread fallback if unavailable).'
            : 'Single-thread fallback active.'}
      </div>
    </div>
  );
}

function SpeciesPanel(): React.ReactElement {
  const species = useLabStore((s) => s.species);
  const toggleArchive = useLabStore((s) => s.toggleArchive);
  const archiveEnabled = useLabStore((s) => s.archiveEnabled);
  if (species.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Run evolution to discover distinct species.</p>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={archiveEnabled} onChange={(e) => toggleArchive(e.target.checked)} />
          Enable Diversity Lab (MAP-Elites archive)
        </label>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={archiveEnabled} onChange={(e) => toggleArchive(e.target.checked)} />
        Diversity Lab (MAP-Elites)
      </label>
      {species
        .slice()
        .sort((a, b) => b.representative.fitness - a.representative.fitness)
        .map((sp) => (
          <div key={sp.id} className="rounded-lg bg-black/20 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">{sp.label}</span>
              <span className="mono text-[10px] text-slate-500">{sp.members.length}×</span>
            </div>
            <div className="mono text-[10px] text-specimen">best {sp.representative.fitness.toFixed(1)}</div>
          </div>
        ))}
    </div>
  );
}

function ChampionPanel({
  onAddToHof,
  onExport,
}: {
  onAddToHof: () => void;
  onExport: () => void;
}): React.ReactElement {
  const champion = useLabStore((s) => s.champion);
  if (!champion) {
    return <p className="text-xs text-slate-500">No champion yet. Start evolution to breed one.</p>;
  }
  const g = champion.genome;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="Fitness" value={champion.fitness.toFixed(1)} accent="#5eead4" />
        <Stat label="Distance" value={champion.distance.toFixed(1)} unit="m" />
        <Stat label="Segments" value={g.segments.length} />
        <Stat label="Generation" value={g.generation} />
      </div>
      <div className="rounded-lg bg-black/20 p-2 text-[11px] text-slate-400">
        <div className="panel-title mb-1">Traits</div>
        Controller: <span className="text-slate-200">{g.controller.type.toUpperCase()}</span> · Joints:{' '}
        <span className="text-slate-200">{g.joints.length}</span> · Freq:{' '}
        <span className="text-slate-200">{g.controller.frequency.toFixed(2)}Hz</span>
      </div>
      <div className="flex gap-1.5">
        <button className="btn-primary flex-1" onClick={onAddToHof}>
          <Trophy size={14} /> Hall of Fame
        </button>
        <button className="btn-ghost" onClick={onExport}>
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function ComparePanel(): React.ReactElement {
  const ancestor = useLabStore((s) => s.ancestor);
  const champion = useLabStore((s) => s.champion);
  if (!champion) {
    return <p className="text-xs text-slate-500">Evolve a champion to compare it with the ancestor.</p>;
  }
  const diff = diffGenomes(ancestor, champion.genome);
  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="panel-title mb-1">Morphology changes</div>
        <ul className="space-y-0.5">
          {diff.morphology.map((l, i) => (
            <li key={i} className="text-slate-300">
              • {l.text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="panel-title mb-1">Controller changes</div>
        <ul className="space-y-0.5">
          {diff.controller.map((l, i) => (
            <li key={i} className="text-slate-300">
              • {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }): React.ReactElement {
  return <div className="grid h-full place-items-center text-center text-[11px] text-slate-600">{text}</div>;
}
