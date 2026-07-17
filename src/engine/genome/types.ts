/** Versioned, serialisable creature genome format. */

export const GENOME_VERSION = 2 as const;

export type ShapeKind = 'box' | 'circle' | 'capsule';

export interface BodySegmentGene {
  id: string;
  /** Parent segment this one attaches to (null for the root segment). */
  parentId: string | null;
  shape: ShapeKind;
  /** Half-width (box) / half-length of straight part (capsule). Metres. */
  halfW: number;
  /** Half-height (box) / radius (capsule, circle). Metres. */
  halfH: number;
  /** Local position of this segment's centre relative to its parent's anchor. */
  local: { x: number; y: number };
  /** Local rotation relative to parent (radians). */
  localRotation: number;
  density: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  /** Inherited visual hue in [0, 360). */
  hue: number;
  /** Whether this segment reports a ground-contact sensor to the controller. */
  groundSensor: boolean;
}

export interface JointGene {
  id: string;
  /** Segment ids the joint connects (bodyB is the child segment). */
  bodyA: string;
  bodyB: string;
  type: 'revolute';
  /** Anchor as a fraction along the parent/child relationship, computed at build. */
  lowerAngle: number;
  upperAngle: number;
  motorStrength: number;
  motorSpeedLimit: number;
  damping: number;
  stiffness: number;
  /** Index into the controller output vector that drives this joint. */
  controllerOutput: number;
  /** Phase offset used by the CPG controller (radians). */
  phaseOffset: number;
}

export type ControllerType = 'cpg' | 'mlp';

export interface ControllerGenome {
  type: ControllerType;
  inputCount: number;
  outputCount: number;
  /** MLP hidden layer sizes. */
  hidden: number[];
  /** Recurrent hidden-state size (0 = feed-forward). */
  recurrentSize: number;
  /** Flat weight vector (row-major per layer). */
  weights: number[];
  /** Flat bias vector. */
  biases: number[];
  /** CPG global frequency (Hz). */
  frequency: number;
  /** CPG per-output amplitudes. */
  amplitudes: number[];
  /** Output scaling applied after activation. */
  outputScale: number;
}

export type MutationType =
  | 'segment-dimensions'
  | 'segment-density'
  | 'segment-friction'
  | 'segment-damping'
  | 'attachment-point'
  | 'joint-limits'
  | 'motor-strength'
  | 'add-segment'
  | 'remove-segment'
  | 'duplicate-branch'
  | 'mirror-branch'
  | 'shape-change'
  | 'controller-weights'
  | 'controller-bias'
  | 'controller-frequency'
  | 'controller-amplitude'
  | 'controller-phase';

export interface MutationRecord {
  generation: number;
  type: MutationType;
  target: string;
  summary: string;
  severity: number;
  parentGenomeId: string;
}

export interface BehaviourDescriptors {
  segmentCount: number;
  averageSpeed: number;
  energyEfficiency: number;
  stability: number;
  bodyLength: number;
  maxHeight: number;
  dutyCycle: number;
  periodicity: number;
  symmetry: number;
}

export interface CreatureGenome {
  version: number;
  id: string;
  name: string;
  generation: number;
  parentIds: string[];
  randomSeed: number;
  segments: BodySegmentGene[];
  joints: JointGene[];
  controller: ControllerGenome;
  mutationHistory: MutationRecord[];
  descriptors?: BehaviourDescriptors;
  metadata: Record<string, string | number | boolean>;
  createdAt: number;
}
