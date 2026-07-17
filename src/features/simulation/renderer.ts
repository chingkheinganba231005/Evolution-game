/** Canvas 2D renderer for creatures and environments. */

import type { BodySnapshot } from '../../engine/live-sim';
import type { ResolvedEnvironment } from '../../engine/environments/types';

export interface Camera {
  x: number;
  ppm: number; // pixels per metre
  groundScreenY: number;
}

export interface RenderOverlays {
  com: boolean;
  velocity: boolean;
  contacts: boolean;
  joints: boolean;
  trail: boolean;
  skeleton: boolean;
  bodyIds: boolean;
  centerOfMass: { x: number; y: number };
}

export interface RenderOpts {
  env: ResolvedEnvironment;
  bodies: BodySnapshot[];
  camera: Camera;
  overlays: RenderOverlays;
  trail: { x: number; y: number }[];
  ghost?: BodySnapshot[] | null;
  colorBlind: boolean;
  finished: boolean;
  time: number;
  light: boolean;
}

function wx(camera: Camera, W: number, x: number): number {
  return W / 2 + (x - camera.x) * camera.ppm;
}
function wy(camera: Camera, y: number): number {
  return camera.groundScreenY - y * camera.ppm;
}

export function render(ctx: CanvasRenderingContext2D, W: number, H: number, opts: RenderOpts): void {
  const { camera, env, bodies, overlays, light } = opts;
  ctx.clearRect(0, 0, W, H);

  // Background.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (light) {
    grad.addColorStop(0, '#eef2f7');
    grad.addColorStop(1, '#dfe6ee');
  } else {
    grad.addColorStop(0, '#0c0f16');
    grad.addColorStop(1, '#0a0c11');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, W, H, camera, light);

  // Water fill (behind creatures).
  if (env.water) {
    const surfaceY = wy(camera, env.water.level);
    ctx.fillStyle = light ? 'rgba(56,132,180,0.18)' : 'rgba(56,160,190,0.16)';
    ctx.fillRect(0, surfaceY, W, H - surfaceY);
    ctx.strokeStyle = 'rgba(94,234,212,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    ctx.lineTo(W, surfaceY);
    ctx.stroke();
  }

  drawTerrain(ctx, W, H, camera, env, light);
  drawMarkers(ctx, W, H, camera, env, light);

  if (opts.ghost) {
    for (const b of opts.ghost) drawBody(ctx, camera, W, b, 0.22, opts.colorBlind, overlays, light);
  }

  if (overlays.trail && opts.trail.length > 1) {
    ctx.strokeStyle = 'rgba(94,234,212,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    opts.trail.forEach((p, i) => {
      const sx = wx(camera, W, p.x);
      const sy = wy(camera, p.y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  }

  for (const b of bodies) drawBody(ctx, camera, W, b, 1, opts.colorBlind, overlays, light);

  // Overlays.
  if (overlays.velocity) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    for (const b of bodies) {
      const sx = wx(camera, W, b.x);
      const sy = wy(camera, b.y);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + b.vx * 6, sy - b.vy * 6);
      ctx.stroke();
    }
  }
  if (overlays.contacts) {
    ctx.fillStyle = '#fb7185';
    for (const b of bodies) {
      if (!b.contact) continue;
      const sx = wx(camera, W, b.x);
      const sy = wy(camera, b.y);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (overlays.com) {
    const c = overlays.centerOfMass;
    const sx = wx(camera, W, c.x);
    const sy = wy(camera, c.y);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.moveTo(sx - 8, sy);
    ctx.lineTo(sx + 8, sy);
    ctx.moveTo(sx, sy - 8);
    ctx.lineTo(sx, sy + 8);
    ctx.stroke();
  }

  if (opts.finished) {
    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 20px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('✓ Finish reached', W / 2, 40);
    ctx.textAlign = 'left';
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camera: Camera,
  light: boolean,
): void {
  ctx.strokeStyle = light ? 'rgba(30,41,59,0.06)' : 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  const startX = Math.floor(camera.x - W / 2 / camera.ppm) - 1;
  const endX = Math.ceil(camera.x + W / 2 / camera.ppm) + 1;
  for (let x = startX; x <= endX; x++) {
    const sx = wx(camera, W, x);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
    ctx.stroke();
  }
  for (let y = -2; y <= 8; y++) {
    const sy = wy(camera, y);
    if (sy < 0 || sy > H) continue;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(W, sy);
    ctx.stroke();
  }
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camera: Camera,
  env: ResolvedEnvironment,
  light: boolean,
): void {
  ctx.beginPath();
  const startX = camera.x - W / 2 / camera.ppm - 1;
  const endX = camera.x + W / 2 / camera.ppm + 1;
  const stepPx = 4;
  let first = true;
  for (let px = 0; px <= W; px += stepPx) {
    const worldX = startX + (px / W) * (endX - startX);
    const h = env.terrain.height(worldX);
    const sy = wy(camera, h);
    if (first) {
      ctx.moveTo(0, sy);
      first = false;
    } else {
      ctx.lineTo(px, sy);
    }
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = light ? '#c7d0da' : '#12161f';
  ctx.fill();
  ctx.strokeStyle = light ? '#8a97a6' : '#2a3341';
  ctx.lineWidth = 2;
  ctx.beginPath();
  first = true;
  for (let px = 0; px <= W; px += stepPx) {
    const worldX = startX + (px / W) * (endX - startX);
    const sy = wy(camera, env.terrain.height(worldX));
    if (first) {
      ctx.moveTo(px, sy);
      first = false;
    } else ctx.lineTo(px, sy);
  }
  ctx.stroke();
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camera: Camera,
  env: ResolvedEnvironment,
  light: boolean,
): void {
  const startX = Math.floor(camera.x - W / 2 / camera.ppm) - 1;
  const endX = Math.ceil(camera.x + W / 2 / camera.ppm) + 1;
  ctx.fillStyle = light ? 'rgba(30,41,59,0.5)' : 'rgba(148,163,184,0.5)';
  ctx.font = '10px ui-monospace, monospace';
  for (let x = startX; x <= endX; x++) {
    if (x % 2 !== 0) continue;
    const sx = wx(camera, W, x);
    const sy = wy(camera, env.terrain.height(x));
    ctx.fillText(`${x}m`, sx + 2, sy - 4);
  }
  // Start line.
  drawFlag(ctx, wx(camera, W, env.spawnX), 0, H, '#60a5fa', 'START');
  // Finish line.
  drawFlag(ctx, wx(camera, W, env.finishX), 0, H, '#5eead4', 'FINISH');
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  sx: number,
  top: number,
  H: number,
  color: string,
  label: string,
): void {
  if (sx < -20 || sx > 4000) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(sx, top);
  ctx.lineTo(sx, H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillText(label, sx + 3, 14);
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  W: number,
  b: BodySnapshot,
  alpha: number,
  colorBlind: boolean,
  overlays: RenderOverlays,
  light: boolean,
): void {
  const sx = wx(camera, W, b.x);
  const sy = wy(camera, b.y);
  const ppm = camera.ppm;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-b.angle);
  ctx.globalAlpha = alpha;

  const hue = colorBlind ? 200 : b.hue;
  const fill = `hsl(${hue}, ${colorBlind ? 45 : 55}%, ${light ? 55 : 52}%)`;
  const stroke = b.contact ? '#5eead4' : `hsl(${hue}, 60%, ${light ? 35 : 70}%)`;
  ctx.fillStyle = overlays.skeleton ? 'transparent' : fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = b.contact ? 2.5 : 1.5;

  if (b.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, b.halfH * ppm, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (b.shape === 'box') {
    roundRect(ctx, -b.halfW * ppm, -b.halfH * ppm, b.halfW * 2 * ppm, b.halfH * 2 * ppm, 3);
    ctx.fill();
    ctx.stroke();
  } else {
    // capsule
    roundRect(
      ctx,
      -b.halfW * ppm,
      -b.halfH * ppm,
      b.halfW * 2 * ppm,
      b.halfH * 2 * ppm,
      b.halfH * ppm,
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  if (overlays.bodyIds) {
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(b.id.slice(0, 4), sx + 4, sy - 4);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
