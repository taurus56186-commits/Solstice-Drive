import type { HandlingPresetId } from '../types';
import type { ColliderBox } from './cityLayout';
import {
  groundHeightAt,
  resolveGroundContact,
  sampleVehicleSupportPlane,
  type GroundSurfaceMap,
} from './groundSurface';

export interface CarInput {
  throttle: boolean;
  brakeReverse: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
}

export interface FootInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface HandlingParams {
  maxForwardSpeed: number; // m/s
  maxReverseSpeed: number; // m/s
  engineAccel: number; // m/s^2
  brakeDecel: number; // m/s^2
  reverseAccel: number; // m/s^2
  rollingDrag: number; // 1/s
  aeroDrag: number; // 1/m
  maxSteerAngle: number; // radians
  steerResponse: number; // rad/s smoothing
  turnRate: number; // rad/s scaling
  lateralGrip: number; // normal cornering lateral damping
  driftLateralGrip: number; // handbrake lateral damping
  driftTurnBoost: number; // extra yaw authority during drift
}

export const HANDLING_PRESETS: Record<HandlingPresetId, HandlingParams> = {
  'grand-tourer': {
    maxForwardSpeed: 46, // ~165 km/h
    maxReverseSpeed: 13,
    engineAccel: 22.5,
    brakeDecel: 32,
    reverseAccel: 11.5,
    rollingDrag: 0.44,
    aeroDrag: 0.0085,
    maxSteerAngle: 0.56,
    steerResponse: 9.5,
    turnRate: 2.35,
    lateralGrip: 7.4,
    driftLateralGrip: 1.75,
    driftTurnBoost: 1.38,
  },
  'drift-spec': {
    maxForwardSpeed: 48,
    maxReverseSpeed: 13,
    engineAccel: 24.5,
    brakeDecel: 30,
    reverseAccel: 12,
    rollingDrag: 0.4,
    aeroDrag: 0.008,
    maxSteerAngle: 0.64,
    steerResponse: 11.0,
    turnRate: 2.65,
    lateralGrip: 4.8,
    driftLateralGrip: 1.15,
    driftTurnBoost: 1.55,
  },
  'track-grip': {
    maxForwardSpeed: 52, // ~187 km/h
    maxReverseSpeed: 14,
    engineAccel: 26.0,
    brakeDecel: 38,
    reverseAccel: 12.5,
    rollingDrag: 0.48,
    aeroDrag: 0.0075,
    maxSteerAngle: 0.5,
    steerResponse: 10.5,
    turnRate: 2.25,
    lateralGrip: 11.2,
    driftLateralGrip: 2.6,
    driftTurnBoost: 1.25,
  },
};

export interface CarState {
  x: number;
  y: number; // strictly >= groundHeightAt(x, z)
  vy: number;
  z: number;
  vx: number;
  vz: number;
  heading: number; // radians; 0 = facing -Z (North), + = CCW (left)
  steerAngle: number; // front wheel steering angle in radians
  wheelSpin: number; // accumulated wheel spin angle in radians
  pitch: number; // chassis squat/dive + ground slope in radians
  roll: number; // chassis body roll + ground slope in radians
  forwardSpeed: number; // signed speed along car forward vector (m/s)
  lateralSpeed: number; // signed sideways slip speed (m/s)
  speedKmh: number;
  isDrifting: boolean;
  braking: boolean;
  driftScore: number;
  topSpeedKmh: number;
  distanceMeters: number;
  lastImpactStrength: number; // 0..1 on frame of collision
  wheelGroundYs: [number, number, number, number]; // [FL, FR, RL, RR] ground height at each wheel contact point
}

export interface FootPlayerState {
  x: number;
  y: number; // strictly >= groundHeightAt(x, z)
  vy: number;
  z: number;
  heading: number;
  walkPhase: number;
  speedMs: number;
}

export interface CarStepResult {
  collided: boolean;
  impactStrength: number; // 0..1
}

export const CAR_COLLISION_RADIUS = 1.65;
export const FOOT_COLLISION_RADIUS = 0.45;
export const WHEEL_RADIUS = 0.36;

export function createInitialCarState(x: number, z: number, heading = 0, groundY = 0): CarState {
  return {
    x,
    y: Math.max(0, groundY),
    vy: 0,
    z,
    vx: 0,
    vz: 0,
    heading,
    steerAngle: 0,
    wheelSpin: 0,
    pitch: 0,
    roll: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    speedKmh: 0,
    isDrifting: false,
    braking: false,
    driftScore: 0,
    topSpeedKmh: 0,
    distanceMeters: 0,
    lastImpactStrength: 0,
    wheelGroundYs: [Math.max(0, groundY), Math.max(0, groundY), Math.max(0, groundY), Math.max(0, groundY)],
  };
}

export function createFootPlayerState(x: number, z: number, heading = 0, groundY = 0): FootPlayerState {
  return {
    x,
    y: Math.max(0, groundY),
    vy: 0,
    z,
    heading,
    walkPhase: 0,
    speedMs: 0,
  };
}

export function computeGearAndRpm(forwardSpeedMs: number): { gear: string; rpmRatio: number } {
  const speedKmh = Math.abs(forwardSpeedMs) * 3.6;
  if (forwardSpeedMs < -0.4) {
    return { gear: 'R', rpmRatio: Math.min(1, 0.22 + speedKmh / 55) };
  }
  if (speedKmh < 1.2) {
    return { gear: 'N', rpmRatio: 0.14 };
  }
  const thresholds = [0, 32, 62, 95, 128, 160, 200];
  let gearIdx = 1;
  for (let i = 1; i < thresholds.length - 1; i++) {
    if (speedKmh >= thresholds[i]) gearIdx = i + 1;
  }
  const low = thresholds[gearIdx - 1];
  const high = thresholds[gearIdx];
  const ratio = (speedKmh - low) / Math.max(1, high - low);
  return {
    gear: String(gearIdx),
    rpmRatio: Math.max(0.24, Math.min(0.98, 0.26 + ratio * 0.72)),
  };
}

export function stepCarPhysics(
  state: CarState,
  input: CarInput,
  rawDt: number,
  colliders: ColliderBox[],
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  handlingPreset: HandlingPresetId = 'grand-tourer',
  groundSurface?: GroundSurfaceMap,
): CarStepResult {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const params = HANDLING_PRESETS[handlingPreset];
  if (dt <= 0) {
    state.lastImpactStrength = 0;
    return { collided: false, impactStrength: 0 };
  }

  // Forward & right unit vectors for current heading (heading = 0 -> forward = (0, -1), right = (1, 0))
  const fwdX = -Math.sin(state.heading);
  const fwdZ = -Math.cos(state.heading);
  const rightX = Math.cos(state.heading);
  const rightZ = -Math.sin(state.heading);

  // Decompose world velocity into car local forward & lateral components
  let vFwd = state.vx * fwdX + state.vz * fwdZ;
  let vLat = state.vx * rightX + state.vz * rightZ;

  // Steering input smoothing (left = +1, right = -1)
  const steerTarget = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
  const speedRatio = Math.min(1, Math.abs(vFwd) / params.maxForwardSpeed);
  const effectiveMaxSteer = params.maxSteerAngle * (1 - 0.34 * speedRatio);
  const desiredSteer = steerTarget * effectiveMaxSteer;
  const steerAlpha = 1 - Math.exp(-params.steerResponse * dt);
  state.steerAngle += (desiredSteer - state.steerAngle) * steerAlpha;

  // Longitudinal forces: throttle, braking, reverse, handbrake
  let longAccel = 0;
  let braking = false;

  if (input.throttle) {
    if (vFwd < -0.5) {
      longAccel += params.brakeDecel;
      braking = true;
    } else {
      const torqueScale = Math.max(0.18, 1 - Math.pow(Math.max(0, vFwd) / params.maxForwardSpeed, 1.8));
      longAccel += params.engineAccel * torqueScale;
    }
  }

  if (input.brakeReverse) {
    if (vFwd > 0.65) {
      longAccel -= params.brakeDecel;
      braking = true;
    } else {
      const revScale = Math.max(0.2, 1 - Math.abs(Math.min(0, vFwd)) / params.maxReverseSpeed);
      longAccel -= params.reverseAccel * revScale;
      braking = true;
    }
  }

  if (input.handbrake) {
    braking = true;
    if (Math.abs(vFwd) > 0.2) {
      longAccel -= Math.sign(vFwd) * 9.5;
    }
  }

  // Rolling resistance & aerodynamic drag
  const dragAccel = -vFwd * params.rollingDrag - vFwd * Math.abs(vFwd) * params.aeroDrag;
  vFwd += (longAccel + dragAccel) * dt;

  if (!input.throttle && !input.brakeReverse && Math.abs(vFwd) < 0.14) {
    vFwd = 0;
  }

  vFwd = Math.max(-params.maxReverseSpeed, Math.min(params.maxForwardSpeed, vFwd));

  const absFwd = Math.abs(vFwd);
  const speedFactor = Math.min(1, absFwd / 5.5);
  const reverseSign = vFwd >= -0.05 ? 1 : -1;
  const driftFactor = input.handbrake && absFwd > 5.5 ? params.driftTurnBoost : 1.0;
  const yawRate = state.steerAngle * params.turnRate * speedFactor * reverseSign * driftFactor;

  if (absFwd > 0.08) {
    state.heading += yawRate * dt;
    if (state.heading > Math.PI) state.heading -= Math.PI * 2;
    if (state.heading < -Math.PI) state.heading += Math.PI * 2;
  }

  if (input.handbrake && absFwd > 6.5 && Math.abs(state.steerAngle) > 0.06) {
    vLat -= Math.sign(state.steerAngle) * Math.min(14, absFwd * 0.42) * dt * 2.2;
  } else if (absFwd > 14 && Math.abs(state.steerAngle) > 0.12) {
    vLat -= Math.sign(state.steerAngle) * absFwd * 0.06 * dt;
  }

  const activeGrip = input.handbrake ? params.driftLateralGrip : params.lateralGrip;
  vLat *= Math.exp(-activeGrip * dt);

  const newFwdX = -Math.sin(state.heading);
  const newFwdZ = -Math.cos(state.heading);
  const newRightX = Math.cos(state.heading);
  const newRightZ = -Math.sin(state.heading);

  state.vx = newFwdX * vFwd + newRightX * vLat;
  state.vz = newFwdZ * vFwd + newRightZ * vLat;

  const prevX = state.x;
  const prevZ = state.z;
  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // Resolve static AABB collisions (buildings, house walls, seawall)
  let collided = false;
  let impactStrength = 0;

  for (const box of colliders) {
    const closestX = Math.max(box.minX, Math.min(state.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(state.z, box.maxZ));
    const dx = state.x - closestX;
    const dz = state.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < CAR_COLLISION_RADIUS * CAR_COLLISION_RADIUS) {
      collided = true;
      let dist = Math.sqrt(distSq);
      let nx = 0;
      let nz = 0;
      if (dist < 1e-5) {
        const dLeft = Math.abs(state.x - box.minX);
        const dRight = Math.abs(box.maxX - state.x);
        const dTop = Math.abs(state.z - box.minZ);
        const dBot = Math.abs(box.maxZ - state.z);
        const minEdge = Math.min(dLeft, dRight, dTop, dBot);
        if (minEdge === dLeft) {
          nx = -1;
          dist = 0;
        } else if (minEdge === dRight) {
          nx = 1;
          dist = 0;
        } else if (minEdge === dTop) {
          nz = -1;
          dist = 0;
        } else {
          nz = 1;
          dist = 0;
        }
      } else {
        nx = dx / dist;
        nz = dz / dist;
      }

      const penetration = CAR_COLLISION_RADIUS - dist;
      state.x += nx * (penetration + 0.01);
      state.z += nz * (penetration + 0.01);

      const vn = state.vx * nx + state.vz * nz;
      if (vn < 0) {
        impactStrength = Math.max(impactStrength, Math.min(1, Math.abs(vn) / 18));
        const restitution = 0.22;
        state.vx -= (1 + restitution) * vn * nx;
        state.vz -= (1 + restitution) * vn * nz;
        state.vx *= 0.84;
        state.vz *= 0.84;
      }
    }
  }

  // Outer world boundary containment
  const margin = CAR_COLLISION_RADIUS + 0.5;
  if (state.x < worldBounds.minX + margin) {
    state.x = worldBounds.minX + margin;
    if (state.vx < 0) {
      impactStrength = Math.max(impactStrength, Math.min(1, Math.abs(state.vx) / 18));
      state.vx = -state.vx * 0.25;
      collided = true;
    }
  } else if (state.x > worldBounds.maxX - margin) {
    state.x = worldBounds.maxX - margin;
    if (state.vx > 0) {
      impactStrength = Math.max(impactStrength, Math.min(1, Math.abs(state.vx) / 18));
      state.vx = -state.vx * 0.25;
      collided = true;
    }
  }
  if (state.z < worldBounds.minZ + margin) {
    state.z = worldBounds.minZ + margin;
    if (state.vz < 0) {
      impactStrength = Math.max(impactStrength, Math.min(1, Math.abs(state.vz) / 18));
      state.vz = -state.vz * 0.25;
      collided = true;
    }
  } else if (state.z > worldBounds.maxZ - margin) {
    state.z = worldBounds.maxZ - margin;
    if (state.vz > 0) {
      impactStrength = Math.max(impactStrength, Math.min(1, Math.abs(state.vz) / 18));
      state.vz = -state.vz * 0.25;
      collided = true;
    }
  }

  // --- Point-of-Intersection Ground Elevation & Strict Non-Sinking Constraint (y >= groundY) ---
  let slopePitch = 0;
  let slopeRoll = 0;
  const support = groundSurface
    ? sampleVehicleSupportPlane(state.x, state.z, state.heading, groundSurface)
    : {
        supportY: 0,
        slopePitch: 0,
        slopeRoll: 0,
        wheelGroundYs: [0, 0, 0, 0] as [number, number, number, number],
      };
  slopePitch = support.slopePitch;
  slopeRoll = support.slopeRoll;
  state.wheelGroundYs = support.wheelGroundYs;

  const contact = resolveGroundContact(state.y, state.vy, support.supportY, dt);
  state.y = contact.y;
  state.vy = contact.vy;

  // Post-collision telemetry
  const finalFwd = state.vx * newFwdX + state.vz * newFwdZ;
  const finalLat = state.vx * newRightX + state.vz * newRightZ;
  const totalSpeed = Math.hypot(state.vx, state.vz);
  const speedKmh = totalSpeed * 3.6;

  state.forwardSpeed = finalFwd;
  state.lateralSpeed = finalLat;
  state.speedKmh = speedKmh;
  state.braking = braking;
  state.lastImpactStrength = impactStrength;

  state.wheelSpin += (finalFwd * dt) / WHEEL_RADIUS;

  const stepDist = Math.hypot(state.x - prevX, state.z - prevZ);
  state.distanceMeters += stepDist;
  if (speedKmh > state.topSpeedKmh) {
    state.topSpeedKmh = speedKmh;
  }

  const isDrifting =
    totalSpeed > 6.5 && (Math.abs(finalLat) > 2.2 || (input.handbrake && Math.abs(state.steerAngle) > 0.14));
  state.isDrifting = isDrifting;
  if (isDrifting) {
    state.driftScore += Math.round((Math.abs(finalLat) * 14 + speedKmh * 0.45) * dt);
  }

  // Suspension pitch/roll combined with exact ground slope
  const targetPitch = Math.max(-0.045, Math.min(0.045, (longAccel / 32) * 0.036)) + slopePitch;
  const targetRoll = Math.max(-0.065, Math.min(0.065, -(yawRate * Math.min(1, totalSpeed / 18)) * 0.045)) + slopeRoll;
  const suspAlpha = 1 - Math.exp(-10 * dt);
  state.pitch += (targetPitch - state.pitch) * suspAlpha;
  state.roll += (targetRoll - state.roll) * suspAlpha;

  return { collided, impactStrength };
}

/**
 * On-Foot Player Physics: allows walking out of the car, along sidewalks,
 * straight through open house doorways into interiors, and back outside.
 * Strictly enforces y >= groundHeightAt(x, z) so the character never sinks!
 */
export function stepFootPlayerPhysics(
  player: FootPlayerState,
  input: FootInput,
  rawDt: number,
  colliders: ColliderBox[],
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  groundSurface: GroundSurfaceMap,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  // Turn with A/D (Left/Right), move forward/back along heading with W/S (Up/Down)
  const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (turnInput !== 0) {
    player.heading += turnInput * 2.55 * dt;
    if (player.heading > Math.PI) player.heading -= Math.PI * 2;
    if (player.heading < -Math.PI) player.heading += Math.PI * 2;
  }

  const moveInput = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const maxSpeed = input.sprint ? 7.2 : 4.2;
  const targetSpeed = moveInput * maxSpeed;

  const fwdX = -Math.sin(player.heading);
  const fwdZ = -Math.cos(player.heading);

  const nextX = player.x + fwdX * targetSpeed * dt;
  const nextZ = player.z + fwdZ * targetSpeed * dt;

  player.x = Math.max(worldBounds.minX + 1.0, Math.min(worldBounds.maxX - 1.0, nextX));
  player.z = Math.max(worldBounds.minZ + 1.0, Math.min(worldBounds.maxZ - 1.0, nextZ));

  // Resolve against building & per-wall house colliders (open doorways stay completely passable!)
  for (const box of colliders) {
    const closestX = Math.max(box.minX, Math.min(player.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(player.z, box.maxZ));
    const dx = player.x - closestX;
    const dz = player.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < FOOT_COLLISION_RADIUS * FOOT_COLLISION_RADIUS) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-5) {
        const push = FOOT_COLLISION_RADIUS - dist + 0.005;
        player.x += (dx / dist) * push;
        player.z += (dz / dist) * push;
      } else {
        player.z += FOOT_COLLISION_RADIUS;
      }
    }
  }

  // Strict point-of-intersection ground clamp: y >= groundHeightAt(x, z)
  const groundY = groundHeightAt(player.x, player.z, groundSurface);
  const contact = resolveGroundContact(player.y, player.vy, groundY, dt);
  player.y = contact.y;
  player.vy = contact.vy;

  player.speedMs = Math.abs(targetSpeed);
  if (player.speedMs > 0.1) {
    player.walkPhase += player.speedMs * dt * 2.2;
  }
}
