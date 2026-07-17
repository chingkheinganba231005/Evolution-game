import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Copy, FlipHorizontal2, Undo2, Redo2, Wand2, Check, X } from 'lucide-react';
import { useLabStore } from '../../stores/lab-store';
import { STARTERS, createStarter, type StarterId } from '../../engine/builder/starters';
import { validateGenome, repairGenome } from '../../engine/genome/validate';
import { cloneGenome } from '../../engine/genome/serialize';
import type { BodySegmentGene, CreatureGenome } from '../../engine/genome/types';
import { CONSTRAINTS } from '../../engine/genome/constraints';
import { Labeled, Slider, Toggle } from '../../components/ui';

export function BuilderPanel(): React.ReactElement {
  const ancestor = useLabStore((s) => s.ancestor);
  const setAncestor = useLabStore((s) => s.setAncestor);
  const status = useLabStore((s) => s.status);
  const seed = useLabStore((s) => s.seed);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<CreatureGenome[]>([]);
  const [future, setFuture] = useState<CreatureGenome[]>([]);

  const disabled = status !== 'idle';
  const validation = useMemo(() => validateGenome(ancestor), [ancestor]);
  const selected = ancestor.segments.find((s) => s.id === selectedId) ?? ancestor.segments[0];
  const selectedJoint = ancestor.joints.find((j) => j.bodyB === selected?.id) ?? null;

  const commit = (next: CreatureGenome): void => {
    const repaired = repairGenome(next, seed);
    if (!repaired) return;
    setPast((p) => [...p.slice(-30), cloneGenome(ancestor)]);
    setFuture([]);
    setAncestor(repaired);
  };

  const editGenome = (mutator: (g: CreatureGenome) => void): void => {
    const draft = cloneGenome(ancestor);
    mutator(draft);
    commit(draft);
  };

  const undo = (): void => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [cloneGenome(ancestor), ...f]);
    setAncestor(prev);
  };
  const redo = (): void => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, cloneGenome(ancestor)]);
    setAncestor(next);
  };

  const pickStarter = (id: StarterId): void => {
    const g = createStarter(id, id === 'random' ? Date.now() % 100000 : seed);
    setPast((p) => [...p, cloneGenome(ancestor)]);
    setFuture([]);
    setAncestor(g);
    setSelectedId(null);
  };

  const addChild = (): void => {
    if (!selected) return;
    if (ancestor.segments.length >= CONSTRAINTS.maxSegments) return;
    editGenome((g) => {
      const id = `s${Math.floor(Math.random() * 1e6).toString(36)}`;
      const child: BodySegmentGene = {
        id,
        parentId: selected.id,
        shape: 'capsule',
        halfW: 0.15,
        halfH: 0.07,
        local: { x: 0.3, y: -0.05 },
        localRotation: -0.6,
        density: 1,
        friction: 0.9,
        restitution: 0.05,
        linearDamping: 0.05,
        angularDamping: 0.05,
        hue: selected.hue,
        groundSensor: true,
      };
      g.segments.push(child);
      g.joints.push({
        id: `j_${id}`,
        bodyA: selected.id,
        bodyB: id,
        type: 'revolute',
        lowerAngle: -1,
        upperAngle: 1,
        motorStrength: 20,
        motorSpeedLimit: 6,
        damping: 0.1,
        stiffness: 0.5,
        controllerOutput: 0,
        phaseOffset: 0,
      });
    });
  };

  const deleteSegment = (): void => {
    if (!selected || selected.parentId === null) return;
    const hasChildren = ancestor.segments.some((s) => s.parentId === selected.id);
    if (hasChildren) return;
    editGenome((g) => {
      g.segments = g.segments.filter((s) => s.id !== selected.id);
      g.joints = g.joints.filter((j) => j.bodyB !== selected.id);
    });
    setSelectedId(null);
  };

  const duplicateSegment = (mirror: boolean): void => {
    if (!selected || selected.parentId === null) return;
    if (ancestor.segments.length >= CONSTRAINTS.maxSegments) return;
    editGenome((g) => {
      const src = g.segments.find((s) => s.id === selected.id)!;
      const id = `s${Math.floor(Math.random() * 1e6).toString(36)}`;
      const clone: BodySegmentGene = {
        ...cloneSeg(src),
        id,
        local: { x: mirror ? -src.local.x : src.local.x + 0.05, y: src.local.y },
        localRotation: mirror ? -src.localRotation : src.localRotation,
      };
      g.segments.push(clone);
      const srcJoint = g.joints.find((j) => j.bodyB === src.id);
      g.joints.push({
        id: `j_${id}`,
        bodyA: src.parentId!,
        bodyB: id,
        type: 'revolute',
        lowerAngle: srcJoint?.lowerAngle ?? -1,
        upperAngle: srcJoint?.upperAngle ?? 1,
        motorStrength: srcJoint?.motorStrength ?? 20,
        motorSpeedLimit: srcJoint?.motorSpeedLimit ?? 6,
        damping: 0.1,
        stiffness: 0.5,
        controllerOutput: 0,
        phaseOffset: srcJoint?.phaseOffset ?? 0,
      });
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="panel-title mb-1.5">Starter ancestors</div>
        <div className="grid grid-cols-2 gap-1.5">
          {STARTERS.map((st) => (
            <button
              key={st.id}
              disabled={disabled}
              onClick={() => pickStarter(st.id)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-xs hover:border-specimen/40 hover:bg-specimen/5 disabled:opacity-40"
              title={st.description}
            >
              <div className="flex items-center gap-1 font-medium text-slate-200">
                {st.id === 'random' && <Wand2 size={12} />}
                {st.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="btn-ghost !px-2 !py-1" onClick={undo} disabled={disabled || past.length === 0} aria-label="Undo">
            <Undo2 size={14} />
          </button>
          <button className="btn-ghost !px-2 !py-1" onClick={redo} disabled={disabled || future.length === 0} aria-label="Redo">
            <Redo2 size={14} />
          </button>
        </div>
        <ValidationBadge valid={validation.valid} count={ancestor.segments.length} />
      </div>

      <div>
        <div className="panel-title mb-1.5">Segments ({ancestor.segments.length})</div>
        <div className="flex flex-wrap gap-1">
          {ancestor.segments.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                selected?.id === s.id
                  ? 'border-specimen bg-specimen/15 text-specimen'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
              style={{ borderLeftColor: `hsl(${s.hue},60%,55%)`, borderLeftWidth: 3 }}
            >
              {s.parentId === null ? '● root' : s.id.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-2 rounded-lg bg-black/20 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              {selected.parentId === null ? 'Root segment' : `Segment ${selected.id.slice(0, 6)}`}
            </span>
            <div className="flex gap-1">
              <button className="btn-ghost !px-1.5 !py-1" onClick={addChild} disabled={disabled} aria-label="Add child segment" title="Add child">
                <Plus size={13} />
              </button>
              <button className="btn-ghost !px-1.5 !py-1" onClick={() => duplicateSegment(false)} disabled={disabled || selected.parentId === null} aria-label="Duplicate" title="Duplicate">
                <Copy size={13} />
              </button>
              <button className="btn-ghost !px-1.5 !py-1" onClick={() => duplicateSegment(true)} disabled={disabled || selected.parentId === null} aria-label="Mirror" title="Mirror">
                <FlipHorizontal2 size={13} />
              </button>
              <button className="btn-danger !px-1.5 !py-1" onClick={deleteSegment} disabled={disabled || selected.parentId === null} aria-label="Delete" title="Delete leaf">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <Labeled label="Length / width" hint="Half-width of the segment (metres).">
            <Slider
              min={CONSTRAINTS.minHalf}
              max={CONSTRAINTS.maxHalf}
              value={selected.halfW}
              onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'halfW', v))}
              format={(v) => `${(v * 2).toFixed(2)}m`}
            />
          </Labeled>
          <Labeled label="Thickness / radius">
            <Slider
              min={CONSTRAINTS.minHalf}
              max={CONSTRAINTS.maxHalf}
              value={selected.halfH}
              onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'halfH', v))}
              format={(v) => `${(v * 2).toFixed(2)}m`}
            />
          </Labeled>
          <Labeled label="Density" hint="Higher density means heavier segments.">
            <Slider
              min={CONSTRAINTS.minDensity}
              max={CONSTRAINTS.maxDensity}
              value={selected.density}
              onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'density', v))}
            />
          </Labeled>
          <Labeled label="Friction">
            <Slider
              min={CONSTRAINTS.minFriction}
              max={CONSTRAINTS.maxFriction}
              value={selected.friction}
              onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'friction', v))}
            />
          </Labeled>
          <Labeled label="Colour (visual gene)">
            <Slider min={0} max={359} step={1} value={selected.hue} onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'hue', v))} format={(v) => `${v.toFixed(0)}°`} />
          </Labeled>
          <Toggle
            label="Ground-contact sensor"
            checked={selected.groundSensor}
            onChange={(v) => editGenome((g) => setSegField(g, selected.id, 'groundSensor', v))}
          />

          {selectedJoint && (
            <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
              <div className="panel-title">Joint to parent</div>
              <Labeled label="Angle range">
                <div className="flex items-center gap-2">
                  <Slider
                    min={CONSTRAINTS.minAngle}
                    max={0}
                    value={selectedJoint.lowerAngle}
                    onChange={(v) => editGenome((g) => setJointField(g, selectedJoint.id, 'lowerAngle', v))}
                    format={(v) => `${v.toFixed(2)}`}
                  />
                  <Slider
                    min={0}
                    max={CONSTRAINTS.maxAngle}
                    value={selectedJoint.upperAngle}
                    onChange={(v) => editGenome((g) => setJointField(g, selectedJoint.id, 'upperAngle', v))}
                    format={(v) => `${v.toFixed(2)}`}
                  />
                </div>
              </Labeled>
              <Labeled label="Motor strength">
                <Slider
                  min={CONSTRAINTS.minMotorStrength}
                  max={CONSTRAINTS.maxMotorStrength}
                  value={selectedJoint.motorStrength}
                  onChange={(v) => editGenome((g) => setJointField(g, selectedJoint.id, 'motorStrength', v))}
                />
              </Labeled>
              <Labeled label="Motor speed limit">
                <Slider
                  min={CONSTRAINTS.minMotorSpeed}
                  max={CONSTRAINTS.maxMotorSpeed}
                  value={selectedJoint.motorSpeedLimit}
                  onChange={(v) => editGenome((g) => setJointField(g, selectedJoint.id, 'motorSpeedLimit', v))}
                />
              </Labeled>
            </div>
          )}
        </div>
      )}

      {!validation.valid && (
        <div className="rounded-lg border border-signal-rose/30 bg-signal-rose/10 p-2 text-[11px] text-signal-rose">
          {validation.issues.filter((i) => i.fatal).map((i) => i.message).join(' ')}
        </div>
      )}
    </div>
  );
}

function ValidationBadge({ valid, count }: { valid: boolean; count: number }): React.ReactElement {
  return (
    <span className={`chip ${valid ? 'text-specimen' : 'text-signal-rose'}`}>
      {valid ? <Check size={11} /> : <X size={11} />}
      {valid ? `Valid · ${count} segs` : 'Invalid'}
    </span>
  );
}

function cloneSeg(s: BodySegmentGene): BodySegmentGene {
  return { ...s, local: { ...s.local } };
}

function setSegField<K extends keyof BodySegmentGene>(
  g: CreatureGenome,
  id: string,
  key: K,
  value: BodySegmentGene[K],
): void {
  const seg = g.segments.find((s) => s.id === id);
  if (seg) seg[key] = value;
}

function setJointField(
  g: CreatureGenome,
  id: string,
  key: 'lowerAngle' | 'upperAngle' | 'motorStrength' | 'motorSpeedLimit',
  value: number,
): void {
  const j = g.joints.find((jt) => jt.id === id);
  if (j) j[key] = value;
}
