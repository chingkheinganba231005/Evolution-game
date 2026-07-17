import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
} from 'lucide-react';
import { LiveSim, type BodySnapshot } from '../../engine/live-sim';
import { resolveEnvironment } from '../../engine/environments/index';
import type { EnvKind, PresetId } from '../../engine/environments/types';
import type { CreatureGenome } from '../../engine/genome/types';
import { render, type RenderOverlays } from './renderer';

const SPEEDS = [1, 2, 4, 8, 16];

export interface ViewportProps {
  genome: CreatureGenome | null;
  env: { kind: EnvKind; preset: PresetId };
  ghostGenome?: CreatureGenome | null;
  colorBlind?: boolean;
  light?: boolean;
  autoPlay?: boolean;
  compact?: boolean;
  showPerf?: boolean;
}

const DEFAULT_OVERLAYS: Omit<RenderOverlays, 'centerOfMass'> = {
  com: false,
  velocity: false,
  contacts: true,
  joints: false,
  trail: true,
  skeleton: false,
  bodyIds: false,
};

export function SimulationViewport({
  genome,
  env,
  ghostGenome = null,
  colorBlind = false,
  light = false,
  autoPlay = true,
  compact = false,
  showPerf = false,
}: ViewportProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<LiveSim | null>(null);
  const ghostRef = useRef<LiveSim | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const cameraXRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({ frames: 0, last: 0 });

  const resolved = useMemo(() => resolveEnvironment(env.kind, env.preset), [env.kind, env.preset]);

  // (Re)build the simulation when the genome or environment changes.
  useEffect(() => {
    if (!genome) {
      simRef.current = null;
      ghostRef.current = null;
      return;
    }
    simRef.current = new LiveSim(genome, resolved);
    ghostRef.current = ghostGenome ? new LiveSim(ghostGenome, resolved) : null;
    trailRef.current = [];
    cameraXRef.current = simRef.current.centerOfMass().x;
    setSimTime(0);
  }, [genome, ghostGenome, resolved]);

  const restart = (): void => {
    if (!genome) return;
    simRef.current = new LiveSim(genome, resolved);
    ghostRef.current = ghostGenome ? new LiveSim(ghostGenome, resolved) : null;
    trailRef.current = [];
    cameraXRef.current = simRef.current.centerOfMass().x;
    setSimTime(0);
  };

  const stepOnce = (): void => {
    simRef.current?.stepOnce();
    ghostRef.current?.stepOnce();
    draw();
    if (simRef.current) setSimTime(simRef.current.time);
  };

  const draw = (): void => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const bodies: BodySnapshot[] = sim ? sim.snapshot() : [];
    const com = sim ? sim.centerOfMass() : { x: 0, y: 0 };

    // Smooth camera follow.
    cameraXRef.current += (com.x - cameraXRef.current) * 0.12;
    const ppm = 64 * zoom * (compact ? 0.8 : 1);

    render(ctx, W, H, {
      env: resolved,
      bodies,
      ghost: ghostRef.current ? ghostRef.current.snapshot() : null,
      camera: { x: cameraXRef.current, ppm, groundScreenY: H * 0.72 },
      overlays: { ...overlays, centerOfMass: com },
      trail: trailRef.current,
      colorBlind,
      finished: sim?.finished ?? false,
      time: sim?.time ?? 0,
      light,
    });
  };

  // Animation loop.
  useEffect(() => {
    const loop = (t: number): void => {
      const last = lastTimeRef.current || t;
      const realDt = Math.min(0.05, (t - last) / 1000);
      lastTimeRef.current = t;
      const sim = simRef.current;
      if (playing && sim) {
        sim.advance(realDt, speed);
        ghostRef.current?.advance(realDt, speed);
        const com = sim.centerOfMass();
        const trail = trailRef.current;
        if (trail.length === 0 || Math.hypot(com.x - trail[trail.length - 1].x, com.y - trail[trail.length - 1].y) > 0.05) {
          trail.push({ x: com.x, y: com.y });
          if (trail.length > 200) trail.shift();
        }
      }
      draw();
      if (playing && sim) setSimTime(sim.time);
      // FPS counter.
      const f = fpsRef.current;
      f.frames++;
      if (t - f.last > 500) {
        setFps((f.frames * 1000) / (t - f.last));
        f.frames = 0;
        f.last = t;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, zoom, overlays, colorBlind, light, resolved]);

  // Resize canvas to container.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = (): void => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, rect.width * dpr);
      canvas.height = Math.max(200, rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterFullscreen = (): void => {
    void containerRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const toggleOverlay = (key: keyof typeof overlays): void =>
    setOverlays((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="flex h-full flex-col">
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black/40">
        <canvas ref={canvasRef} className="block h-full w-full" aria-label="Creature simulation viewport" />
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
          <span className="chip mono pointer-events-auto">t = {simTime.toFixed(2)}s</span>
          {simRef.current?.world.exploded && (
            <span className="chip pointer-events-auto text-signal-rose">unstable — restart</span>
          )}
        </div>
        {showPerf && (
          <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-right font-mono text-[10px] text-specimen">
            <div>{fps.toFixed(0)} fps</div>
            <div>{simRef.current?.world.bodies.length ?? 0} bodies</div>
            <div>120 steps/s</div>
          </div>
        )}
        {genome === null && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
            No creature loaded
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button className="btn-ghost !px-2" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button className="btn-ghost !px-2" onClick={restart} aria-label="Restart">
          <RotateCcw size={15} />
        </button>
        <button
          className="btn-ghost !px-2"
          onClick={() => {
            setPlaying(false);
            stepOnce();
          }}
          aria-label="Step one frame"
        >
          <StepForward size={15} />
        </button>
        <div className="flex items-center rounded-lg bg-black/20 p-0.5" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-1.5 py-0.5 text-xs ${speed === s ? 'bg-specimen/20 text-specimen' : 'text-slate-400'}`}
            >
              {s}×
            </button>
          ))}
        </div>
        <button className="btn-ghost !px-2" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">
          <ZoomIn size={15} />
        </button>
        <button className="btn-ghost !px-2" onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))} aria-label="Zoom out">
          <ZoomOut size={15} />
        </button>
        <div className="relative">
          <button className="btn-ghost !px-2" onClick={() => setShowOverlayMenu((v) => !v)} aria-label="Debug overlays">
            <Eye size={15} />
          </button>
          {showOverlayMenu && (
            <div className="absolute bottom-9 left-0 z-30 w-44 space-y-1 rounded-lg border border-white/10 bg-graphite-800 p-2 text-xs shadow-xl">
              {(
                [
                  ['contacts', 'Contact points'],
                  ['com', 'Centre of mass'],
                  ['velocity', 'Velocity vectors'],
                  ['trail', 'Trajectory trail'],
                  ['skeleton', 'Skeleton mode'],
                  ['bodyIds', 'Body identifiers'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={overlays[key]} onChange={() => toggleOverlay(key)} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="btn-ghost !px-2" onClick={enterFullscreen} aria-label="Fullscreen">
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
