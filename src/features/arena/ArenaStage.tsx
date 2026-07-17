import React, { useEffect, useRef } from 'react';
import { LiveSim, type BodySnapshot } from '../../engine/live-sim';
import { resolveEnvironment } from '../../engine/environments/index';
import type { EnvKind, PresetId } from '../../engine/environments/types';
import { render } from '../simulation/renderer';
import type { Competitor } from '../../stores/arena-store';

export interface Ranking {
  id: string;
  name: string;
  hue: number;
  distance: number;
  finished: boolean;
}

export function ArenaStage({
  competitors,
  env,
  running,
  speed,
  restartKey,
  onRankings,
  colorBlind,
  light,
}: {
  competitors: Competitor[];
  env: { kind: EnvKind; preset: PresetId };
  running: boolean;
  speed: number;
  restartKey: number;
  onRankings: (r: Ranking[]) => void;
  colorBlind: boolean;
  light: boolean;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simsRef = useRef<{ comp: Competitor; sim: LiveSim; startX: number }[]>([]);
  const cameraXRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const lastRankRef = useRef(0);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  runningRef.current = running;
  speedRef.current = speed;

  const resolved = resolveEnvironment(env.kind, env.preset);

  useEffect(() => {
    simsRef.current = competitors.map((comp) => {
      const sim = new LiveSim(comp.genome, resolved);
      return { comp, sim, startX: sim.centerOfMass().x };
    });
    cameraXRef.current = resolved.spawnX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors, env.kind, env.preset, restartKey]);

  useEffect(() => {
    const loop = (t: number): void => {
      const last = lastRef.current || t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastRef.current = t;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          let leaderX = -Infinity;
          const allBodies: BodySnapshot[] = [];
          for (const entry of simsRef.current) {
            if (runningRef.current) entry.sim.advance(dt, speedRef.current);
            const com = entry.sim.centerOfMass();
            leaderX = Math.max(leaderX, com.x);
            for (const b of entry.sim.snapshot()) {
              allBodies.push({ ...b, hue: entry.comp.hue });
            }
          }
          if (leaderX > -Infinity) cameraXRef.current += (leaderX - cameraXRef.current) * 0.1;
          render(ctx, canvas.width, canvas.height, {
            env: resolved,
            bodies: allBodies,
            camera: { x: cameraXRef.current, ppm: 48, groundScreenY: canvas.height * 0.72 },
            overlays: {
              com: false,
              velocity: false,
              contacts: false,
              joints: false,
              trail: false,
              skeleton: false,
              bodyIds: false,
              centerOfMass: { x: 0, y: 0 },
            },
            trail: [],
            colorBlind,
            finished: false,
            time: 0,
            light,
          });
        }
      }

      if (t - lastRankRef.current > 120) {
        lastRankRef.current = t;
        const rankings: Ranking[] = simsRef.current
          .map((e) => ({
            id: e.comp.id,
            name: e.comp.name,
            hue: e.comp.hue,
            distance: e.sim.centerOfMass().x - e.startX,
            finished: e.sim.finished,
          }))
          .sort((a, b) => b.distance - a.distance);
        onRankings(rankings);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, colorBlind, light]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = (): void => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, rect.width * dpr);
      canvas.height = Math.max(240, rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg bg-black/40">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Arena race viewport" />
    </div>
  );
}
