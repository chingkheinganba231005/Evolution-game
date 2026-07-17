/** Hard constraints for valid genomes. */

export const CONSTRAINTS = {
  maxSegments: 12,
  minSegments: 1,
  minHalf: 0.06,
  maxHalf: 0.9,
  minDensity: 0.4,
  maxDensity: 4.0,
  minFriction: 0.1,
  maxFriction: 1.5,
  minRestitution: 0,
  maxRestitution: 0.4,
  minDamping: 0,
  maxDamping: 2.0,
  minMotorStrength: 0.5,
  maxMotorStrength: 60,
  minMotorSpeed: 0.5,
  maxMotorSpeed: 12,
  minAngle: -Math.PI * 0.95,
  maxAngle: Math.PI * 0.95,
  /** Minimum span between joint lower/upper angle. */
  minAngleSpan: 0.1,
  maxMass: 40,
  /** Allowed initial overlap tolerance between neighbouring segments (metres). */
  overlapTolerance: 0.04,
} as const;
