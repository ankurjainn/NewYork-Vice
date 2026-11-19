import {
  CITY_BUILDINGS,
  EAST_BOUND,
  ELEPHANTA_ISLAND,
  FLYOVERS,
  NORTH_BOUND,
  OCEAN_WEST_BOUND,
  ROAD_COORDS,
  SEA_NORTH_BOUND,
  SEA_SOUTH_BOUND,
  SOUTH_BOUND,
  WEST_BOUND,
  isPointInWater,
  sampleWorldElevation,
} from './cityLayout';
import type { BuildingCollider, NpcArchetype, VehicleType, WantedState } from './types';
export type { WantedState };
export const EVADE_CLEAR_SECONDS = 8;

export interface VehicleSpec {
  type: VehicleType;
  label: string;
  width: number;
  length: number;
  height: number;
  maxSpeed: number;
  reverseSpeed: number;
  accel: number;
  brake: number;
  turnRate: number;
  grip: number;
  driftGrip: number;
  mass: number;
  maxHp: number;
  isWatercraft?: boolean;
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  taxi: {
    type: 'taxi',
    label: 'NYC Yellow Cab',
    width: 1.9,
    length: 4.3,
    height: 1.55,
    maxSpeed: 28,
    reverseSpeed: 10,
    accel: 19,
    brake: 28,
    turnRate: 2.35,
    grip: 7.5,
    driftGrip: 2.1,
    mass: 1.3,
    maxHp: 120,
  },
  auto: {
    type: 'auto',
    label: 'NYC Pedicab Trike',
    width: 1.45,
    length: 2.9,
    height: 1.82,
    maxSpeed: 22,
    reverseSpeed: 8,
    accel: 17,
    brake: 26,
    turnRate: 3.1,
    grip: 8.5,
    driftGrip: 2.6,
    mass: 0.75,
    maxHp: 90,
  },
  bus: {
    type: 'bus',
    label: 'MTA City Bus',
    width: 2.55,
    length: 8.2,
    height: 3.1,
    maxSpeed: 21,
    reverseSpeed: 7,
    accel: 11,
    brake: 21,
    turnRate: 1.65,
    grip: 6.2,
    driftGrip: 2.8,
    mass: 4.2,
    maxHp: 260,
  },
  sports: {
    type: 'sports',
    label: 'Manhattan GT Coupe',
    width: 2.02,
    length: 4.55,
    height: 1.32,
    maxSpeed: 38,
    reverseSpeed: 12,
    accel: 27,
    brake: 35,
    turnRate: 2.6,
    grip: 8.6,
    driftGrip: 1.9,
    mass: 1.25,
    maxHp: 135,
  },
  police: {
    type: 'police',
    label: 'NYPD Interceptor SUV',
    width: 2.05,
    length: 4.65,
    height: 1.85,
    maxSpeed: 33,
    reverseSpeed: 11,
    accel: 23,
    brake: 30,
    turnRate: 2.5,
    grip: 8.2,
    driftGrip: 2.2,
    mass: 1.8,
    maxHp: 170,
  },
  syndicate_van: {
    type: 'syndicate_van',
    label: 'Syndicate Armored Van',
    width: 2.2,
    length: 5.3,
    height: 2.25,
    maxSpeed: 25,
    reverseSpeed: 9,
    accel: 15,
    brake: 24,
    turnRate: 1.9,
    grip: 7.0,
    driftGrip: 2.5,
    mass: 2.7,
    maxHp: 160,
  },
  ferry: {
    type: 'ferry',
    label: 'Staten Island Ferry',
    width: 4.6,
    length: 12.2,
    height: 3.8,
    maxSpeed: 23,
    reverseSpeed: 8,
    accel: 12,
    brake: 14,
    turnRate: 1.45,
    grip: 3.4,
    driftGrip: 1.6,
    mass: 6.5,
    maxHp: 340,
    isWatercraft: true,
  },
  speedboat: {
    type: 'speedboat',
    label: 'Hudson Coast Guard Boat',
    width: 2.6,
    length: 6.4,
    height: 1.8,
    maxSpeed: 35,
    reverseSpeed: 10,
    accel: 22,
    brake: 22,
    turnRate: 2.25,
    grip: 4.4,
    driftGrip: 1.8,
    mass: 1.9,
    maxHp: 185,
    isWatercraft: true,
  },
};

export interface VehiclePhysicsState {
  x: number;
  y?: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  steerAngle: number;
  isDrifting: boolean;
  isBoosting: boolean;
  hitWall: boolean;
  impactSpeed: number;
}

export interface VehicleInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
  boostAvailable: boolean;
  wetGripMultiplier?: number;
}

export function resolveCircleBuildingCollisions(
  x: number,
  z: number,
  radius: number,
  buildings: BuildingCollider[] = CITY_BUILDINGS,
  elevationY = 0,
): { x: number; z: number; hit: boolean; normalX: number; normalZ: number } {
  let rx = x;
  let rz = z;
  let hit = false;
  let nx = 0;
  let nz = 0;

  if (rx < WEST_BOUND + radius) {
    rx = WEST_BOUND + radius;
    hit = true;
    nx = 1;
  } else if (rx > EAST_BOUND - radius) {
    rx = EAST_BOUND - radius;
    hit = true;
    nx = -1;
  }
  if (rz < NORTH_BOUND + radius) {
    rz = NORTH_BOUND + radius;
    hit = true;
    nz = 1;
  } else if (rz > SOUTH_BOUND - radius) {
    rz = SOUTH_BOUND - radius;
    hit = true;
    nz = -1;
  }

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (elevationY > b.height + 0.5) continue;
    const halfW = b.width * 0.5;
    const halfD = b.depth * 0.5;
    const closestX = Math.max(b.x - halfW, Math.min(rx, b.x + halfW));
    const closestZ = Math.max(b.z - halfD, Math.min(rz, b.z + halfD));
    const dx = rx - closestX;
    const dz = rz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      hit = true;
      if (distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        const pnx = dx / dist;
        const pnz = dz / dist;
        rx += pnx * push;
        rz += pnz * push;
        nx = pnx;
        nz = pnz;
      } else {
        const penL = rx - (b.x - halfW);
        const penR = b.x + halfW - rx;
        const penT = rz - (b.z - halfD);
        const penB = b.z + halfD - rz;
        const minPen = Math.min(penL, penR, penT, penB);
        if (minPen === penL) {
          rx = b.x - halfW - radius;
          nx = -1;
        } else if (minPen === penR) {
          rx = b.x + halfW + radius;
          nx = 1;
        } else if (minPen === penT) {
          rz = b.z - halfD - radius;
          nz = -1;
        } else {
          rz = b.z + halfD + radius;
          nz = 1;
        }
      }
    }
  }

  return { x: rx, z: rz, hit, normalX: nx, normalZ: nz };
}

export function resolveWatercraftBounds(
  x: number,
  z: number,
  radius: number,
): { x: number; z: number; hit: boolean; normalX: number; normalZ: number } {
  let rx = x;
  let rz = z;
  let hit = false;
  let nx = 0;
  let nz = 0;

  if (rx < OCEAN_WEST_BOUND + radius) {
    rx = OCEAN_WEST_BOUND + radius;
    hit = true;
    nx = 1;
  } else if (rx > EAST_BOUND - radius) {
    rx = EAST_BOUND - radius;
    hit = true;
    nx = -1;
  }
  if (rz < SEA_NORTH_BOUND + radius) {
    rz = SEA_NORTH_BOUND + radius;
    hit = true;
    nz = 1;
  } else if (rz > SEA_SOUTH_BOUND - radius) {
    rz = SEA_SOUTH_BOUND - radius;
    hit = true;
    nz = -1;
  }

  const islDx = rx - ELEPHANTA_ISLAND.x;
  const islDz = rz - ELEPHANTA_ISLAND.z;
  const islDist = Math.hypot(islDx, islDz);
  const minIslDist = ELEPHANTA_ISLAND.radius + radius;
  if (islDist < minIslDist && islDist > 0.001) {
    nx = islDx / islDist;
    nz = islDz / islDist;
    rx = ELEPHANTA_ISLAND.x + nx * minIslDist;
    rz = ELEPHANTA_ISLAND.z + nz * minIslDist;
    hit = true;
  }

  const seaWallX = -67.5 - radius;
  const northWallZ = -110 - radius;
  if (rx > seaWallX && rz > northWallZ) {
    const penWest = rx - seaWallX;
    const penNorth = rz - northWallZ;
    if (penWest <= penNorth) {
      rx = seaWallX;
      nx = -1;
      nz = 0;
    } else {
      rz = northWallZ;
      nx = 0;
      nz = -1;
    }
    hit = true;
  }

  return { x: rx, z: rz, hit, normalX: nx, normalZ: nz };
}

export function stepVehiclePhysics(
  state: VehiclePhysicsState,
  spec: VehicleSpec,
  input: VehicleInput,
  dt: number,
  buildings: BuildingCollider[] = CITY_BUILDINGS,
): VehiclePhysicsState {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const boosting = input.boost && input.boostAvailable && input.throttle > 0.1;
  const maxFwd = boosting ? spec.maxSpeed * 1.32 : spec.maxSpeed;
  const accelRate = boosting ? spec.accel * 1.48 : spec.accel;

  const fx = Math.sin(state.heading);
  const fz = Math.cos(state.heading);
  const rx = fz;
  const rz = -fx;

  let fwdSpeed = state.vx * fx + state.vz * fz;
  let latSpeed = state.vx * rx + state.vz * rz;

  if (input.throttle > 0.05) {
    fwdSpeed += input.throttle * accelRate * safeDt;
  } else if (input.throttle < -0.05) {
    if (fwdSpeed > 0.8) {
      fwdSpeed -= spec.brake * safeDt;
    } else {
      fwdSpeed += input.throttle * (accelRate * 0.7) * safeDt;
    }
  } else {
    const drag = Math.exp(-2.2 * safeDt);
    fwdSpeed *= drag;
  }

  if (input.handbrake) {
    fwdSpeed *= Math.exp(-3.4 * safeDt);
  }

  fwdSpeed = Math.max(-spec.reverseSpeed, Math.min(maxFwd, fwdSpeed));

  const speedFactor = Math.min(1, Math.abs(fwdSpeed) / 4.2);
  const reverseSign = fwdSpeed >= -0.2 ? 1 : -1;
  const turnPenalty = 1 - Math.min(0.35, Math.abs(fwdSpeed) / (spec.maxSpeed * 2.2));
  const driftBoostTurn = input.handbrake ? 1.28 : 1.0;
  const yawDelta =
    input.steer * spec.turnRate * speedFactor * turnPenalty * driftBoostTurn * reverseSign * safeDt;
  const nextHeading = state.heading + yawDelta;

  const nfx = Math.sin(nextHeading);
  const nfz = Math.cos(nextHeading);
  const nrx = nfz;
  const nrz = -nfx;

  const wetMult = input.wetGripMultiplier ?? 1.0;
  const activeGrip = (input.handbrake ? spec.driftGrip : spec.grip) * wetMult;
  latSpeed *= Math.exp(-activeGrip * safeDt);

  let vx = nfx * fwdSpeed + nrx * latSpeed;
  let vz = nfz * fwdSpeed + nrz * latSpeed;

  let nextX = state.x + vx * safeDt;
  let nextZ = state.z + vz * safeDt;
  const curY = state.y ?? 0;

  const radius = Math.max(spec.width, spec.length) * 0.36;
  let col: { x: number; z: number; hit: boolean; normalX: number; normalZ: number };
  let nextY = curY;

  if (spec.isWatercraft) {
    col = resolveWatercraftBounds(nextX, nextZ, radius);
    nextY = -0.35;
  } else {
    const elev = sampleWorldElevation(nextX, nextZ, curY);
    if (elev.onFlyover && elev.flyoverId) {
      const f = FLYOVERS.find((fl) => fl.id === elev.flyoverId);
      if (f) {
        const guardrail = f.halfWidth - spec.width * 0.55;
        if (f.axis === 'ew') {
          nextZ = Math.max(f.centerCoord - guardrail, Math.min(f.centerCoord + guardrail, nextZ));
        } else {
          nextX = Math.max(f.centerCoord - guardrail, Math.min(f.centerCoord + guardrail, nextX));
        }
      }
    }
    col = resolveCircleBuildingCollisions(nextX, nextZ, radius, buildings, elev.groundY);
    nextY = elev.groundY;
  }

  let impactSpeed = 0;
  if (col.hit) {
    const intoNormal = -(vx * col.normalX + vz * col.normalZ);
    if (intoNormal > 0) {
      impactSpeed = intoNormal;
      // Inelastic wall contact (no rubbery bounce-back; realistic scrape & forward slowdown)
      vx += col.normalX * intoNormal * 1.06;
      vz += col.normalZ * intoNormal * 1.06;
      const wallFric = Math.max(0.55, 0.84 - intoNormal * 0.015);
      vx *= wallFric;
      vz *= wallFric;
      // Strongly scrub sideways skid after wall hit so the car stays planted
      const postFwd = vx * nfx + vz * nfz;
      const postLat = (vx * nrx + vz * nrz) * 0.3;
      const clampedLat = Math.max(-3.4, Math.min(3.4, postLat));
      vx = nfx * postFwd + nrx * clampedLat;
      vz = nfz * postFwd + nrz * clampedLat;
    }
  }

  const finalSpeed = vx * nfx + vz * nfz;
  const isDrifting =
    !spec.isWatercraft &&
    (Math.abs(latSpeed) > 3.2 || (input.handbrake && Math.abs(finalSpeed) > 6.5));

  return {
    x: col.x,
    y: nextY,
    z: col.z,
    vx,
    vz,
    heading: nextHeading,
    speed: finalSpeed,
    steerAngle: input.steer * 0.55,
    isDrifting,
    isBoosting: boosting,
    hitWall: col.hit,
    impactSpeed,
  };
}

export interface VehiclePairCollisionResult {
  hit: boolean;
  impactSpeed: number;
  normalX: number;
  normalZ: number;
  contactX: number;
  contactZ: number;
  pitchImpulseA: number;
  rollImpulseA: number;
  pitchImpulseB: number;
  rollImpulseB: number;
}

/**
 * Realistic 2D Oriented Bounding Box (SAT) inelastic vehicle-to-vehicle collision resolver.
 * Uses true car dimensions & headings, mass-weighted separation, low-restitution metal-crunch
 * momentum exchange, and aggressive tire lateral-grip scrubbing so cars feel heavy and grounded
 * instead of drifting/skating wildly away after impact.
 */
export function resolveVehiclePairCollision(
  a: VehiclePhysicsState,
  specA: VehicleSpec,
  b: VehiclePhysicsState,
  specB: VehicleSpec,
): VehiclePairCollisionResult {
  const noHit: VehiclePairCollisionResult = {
    hit: false,
    impactSpeed: 0,
    normalX: 0,
    normalZ: 0,
    contactX: 0,
    contactZ: 0,
    pitchImpulseA: 0,
    rollImpulseA: 0,
    pitchImpulseB: 0,
    rollImpulseB: 0,
  };

  // Fast broadphase circle reject
  const maxR = (specA.length + specB.length) * 0.56;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (dx * dx + dz * dz > maxR * maxR) return noHit;

  const faX = Math.sin(a.heading);
  const faZ = Math.cos(a.heading);
  const raX = faZ;
  const raZ = -faX;
  const haW = specA.width * 0.47;
  const haL = specA.length * 0.48;

  const fbX = Math.sin(b.heading);
  const fbZ = Math.cos(b.heading);
  const rbX = fbZ;
  const rbZ = -fbX;
  const hbW = specB.width * 0.47;
  const hbL = specB.length * 0.48;

  const axes: Array<[number, number]> = [
    [faX, faZ],
    [raX, raZ],
    [fbX, fbZ],
    [rbX, rbZ],
  ];

  let minOverlap = Infinity;
  let bestNx = 1;
  let bestNz = 0;

  for (let i = 0; i < 4; i++) {
    const [ax, az] = axes[i];
    const projA = Math.abs(faX * ax + faZ * az) * haL + Math.abs(raX * ax + raZ * az) * haW;
    const projB = Math.abs(fbX * ax + fbZ * az) * hbL + Math.abs(rbX * ax + rbZ * az) * hbW;
    const centerProj = dx * ax + dz * az;
    const overlap = projA + projB - Math.abs(centerProj);
    if (overlap <= 0) return noHit;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerProj >= 0 ? 1 : -1;
      bestNx = ax * sign;
      bestNz = az * sign;
    }
  }

  // Mass-weighted positional separation (heavier buses/trucks stay solidly planted!)
  const invMassA = 1 / Math.max(0.4, specA.mass);
  const invMassB = 1 / Math.max(0.4, specB.mass);
  const invMassSum = invMassA + invMassB;
  const sep = minOverlap + 0.025;
  a.x -= bestNx * sep * (invMassA / invMassSum);
  a.z -= bestNz * sep * (invMassA / invMassSum);
  b.x += bestNx * sep * (invMassB / invMassSum);
  b.z += bestNz * sep * (invMassB / invMassSum);

  // Relative velocity along contact normal (bestN points from A -> B)
  const rvx = b.vx - a.vx;
  const rvz = b.vz - a.vz;
  const relNormal = rvx * bestNx + rvz * bestNz;

  const contactX = a.x + bestNx * Math.min(haL, Math.hypot(dx, dz) * 0.5);
  const contactZ = a.z + bestNz * Math.min(haL, Math.hypot(dx, dz) * 0.5);

  if (relNormal >= -0.15) {
    // Low-speed grazing/resting push — just scrub mutual slide cleanly
    a.vx *= 0.9;
    a.vz *= 0.9;
    b.vx *= 0.9;
    b.vz *= 0.9;
    a.speed = a.vx * faX + a.vz * faZ;
    b.speed = b.vx * fbX + b.vz * fbZ;
    return {
      hit: true,
      impactSpeed: Math.max(0, -relNormal),
      normalX: bestNx,
      normalZ: bestNz,
      contactX,
      contactZ,
      pitchImpulseA: 0,
      rollImpulseA: 0,
      pitchImpulseB: 0,
      rollImpulseB: 0,
    };
  }

  const impactSpeed = -relNormal;
  // Inelastic metal-crunch restitution (0.14 = solid thud, NOT bouncy air-hockey!)
  const restitution = 0.14;
  const impulseMag = ((1 + restitution) * impactSpeed) / invMassSum;

  // Correctly signed momentum exchange: A is pushed along -N, B is pushed along +N
  a.vx -= bestNx * impulseMag * invMassA;
  a.vz -= bestNz * impulseMag * invMassA;
  b.vx += bestNx * impulseMag * invMassB;
  b.vz += bestNz * impulseMag * invMassB;

  // Tangential friction during metal-on-metal scrape
  const tx = -bestNz;
  const tz = bestNx;
  const relTan = rvx * tx + rvz * tz;
  const tanImpulse = Math.max(-impulseMag * 0.32, Math.min(impulseMag * 0.32, -relTan / invMassSum));
  a.vx -= tx * tanImpulse * invMassA;
  a.vz -= tz * tanImpulse * invMassA;
  b.vx += tx * tanImpulse * invMassB;
  b.vz += tz * tanImpulse * invMassB;

  // Grounded tire-grip lateral scrub & crumple energy damping so neither car skates sideways!
  const stabilizeCar = (car: VehiclePhysicsState, fx: number, fz: number, rx: number, rz: number, massShare: number) => {
    const crumpleDamp = 1 - Math.min(0.42, impactSpeed * 0.022 * massShare);
    let fwd = (car.vx * fx + car.vz * fz) * crumpleDamp;
    let lat = (car.vx * rx + car.vz * rz) * 0.24;
    lat = Math.max(-3.2, Math.min(3.2, lat));
    // Prevent unrealistically fast reverse slingshots from head-on hits
    if (Math.abs(fwd) > 22) fwd = Math.sign(fwd) * 22;
    car.vx = fx * fwd + rx * lat;
    car.vz = fz * fwd + rz * lat;
    car.speed = fwd;
  };

  stabilizeCar(a, faX, faZ, raX, raZ, invMassA / invMassSum);
  stabilizeCar(b, fbX, fbZ, rbX, rbZ, invMassB / invMassSum);

  // Subtle realistic chassis suspension crunch (pitch nose-dive + lateral roll recoil)
  const crunchStrength = Math.min(0.14, impactSpeed * 0.0085);
  const aForwardHit = bestNx * faX + bestNz * faZ;
  const aSideHit = bestNx * raX + bestNz * raZ;
  const bForwardHit = -(bestNx * fbX + bestNz * fbZ);
  const bSideHit = -(bestNx * rbX + bestNz * rbZ);

  // Small realistic glancing yaw nudge only on off-center side hits (strictly bounded)
  const yawNudgeA = Math.max(-0.08, Math.min(0.08, aSideHit * aForwardHit * impactSpeed * 0.004 * (invMassA / invMassSum)));
  const yawNudgeB = Math.max(-0.08, Math.min(0.08, bSideHit * bForwardHit * impactSpeed * 0.004 * (invMassB / invMassSum)));
  a.heading += yawNudgeA;
  b.heading += yawNudgeB;

  return {
    hit: true,
    impactSpeed,
    normalX: bestNx,
    normalZ: bestNz,
    contactX,
    contactZ,
    pitchImpulseA: -aForwardHit * crunchStrength * (invMassA / invMassSum) * 1.4,
    rollImpulseA: aSideHit * crunchStrength * (invMassA / invMassSum) * 1.4,
    pitchImpulseB: -bForwardHit * crunchStrength * (invMassB / invMassSum) * 1.4,
    rollImpulseB: bSideHit * crunchStrength * (invMassB / invMassSum) * 1.4,
  };
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const COLLISION_GRACE_SEC = 1.15;
export const HP_REGEN_DELAY_SEC = 4.2;
export const HP_REGEN_PER_SEC = 9.5;
export const MAX_SINGLE_CRASH_PLAYER_DAMAGE = 20;

export function computeCrashDamage(
  impactSpeed: number,
  inVehicle: boolean,
): { playerDamage: number; vehicleDamage: number } {
  const threshold = inVehicle ? 5.2 : 4.2;
  if (impactSpeed <= threshold) {
    return { playerDamage: 0, vehicleDamage: 0 };
  }
  const over = impactSpeed - threshold;
  const rawPlayer = inVehicle ? 4 + over * 0.85 : 7 + over * 1.2;
  const playerDamage = Math.min(MAX_SINGLE_CRASH_PLAYER_DAMAGE, Math.round(rawPlayer));
  const vehicleDamage = inVehicle ? Math.min(34, Math.round(7 + over * 1.35)) : 0;
  return { playerDamage, vehicleDamage };
}

export function stepHealthRegen(
  hp: number,
  maxHp: number,
  timeSinceDamage: number,
  dt: number,
): { hp: number; regenerating: boolean } {
  if (hp <= 0 || hp >= maxHp) {
    return { hp: Math.max(0, Math.min(maxHp, hp)), regenerating: false };
  }
  if (timeSinceDamage < HP_REGEN_DELAY_SEC) {
    return { hp, regenerating: false };
  }
  const nextHp = Math.min(maxHp, hp + HP_REGEN_PER_SEC * Math.max(0, dt));
  return { hp: nextHp, regenerating: nextHp > hp };
}

export function stepSmoothSteer(current: number, rawTarget: number, dt: number): number {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const rate = rawTarget === 0 ? 10.5 : 7.5;
  const k = 1 - Math.exp(-rate * safeDt);
  const next = current + (rawTarget - current) * k;
  return Math.abs(next) < 0.002 && rawTarget === 0 ? 0 : next;
}

export function stepCameraYaw(params: {
  currentYaw: number;
  targetYaw: number;
  dt: number;
  mode: 'foot' | 'drive';
  inputF: number;
  inputR: number;
  vehicleSpeed: number;
}): number {
  const safeDt = Math.min(Math.max(params.dt, 0), 0.05);
  const { currentYaw, targetYaw, mode, inputF, inputR, vehicleSpeed } = params;

  if (mode === 'foot') {
    if (inputF < 0) {
      return currentYaw;
    }
    const baseRate = inputF > 0 ? 1.55 : inputR !== 0 ? 0.85 : 0;
    if (baseRate <= 0) return currentYaw;
    const diff = normalizeAngle(targetYaw - currentYaw);
    const maxStep = 1.15 * safeDt;
    const step = diff * (1 - Math.exp(-baseRate * safeDt));
    return currentYaw + Math.max(-maxStep, Math.min(maxStep, step));
  }

  if (vehicleSpeed < -0.6) {
    return currentYaw;
  }
  const speedWeight = Math.min(1, Math.abs(vehicleSpeed) / 9);
  const rate = 2.0 + speedWeight * 2.2;
  const diff = normalizeAngle(targetYaw - currentYaw);
  const maxStep = 2.4 * safeDt;
  const step = diff * (1 - Math.exp(-rate * safeDt));
  return currentYaw + Math.max(-maxStep, Math.min(maxStep, step));
}

export function addWantedHeat(state: WantedState, deltaHeat: number): WantedState {
  const heat = Math.max(0, Math.min(250, state.heat + deltaHeat));
  const stars = computeStarsFromHeat(heat);
  return {
    heat,
    stars,
    evadeTimer: 0,
    bustedProgress: state.bustedProgress,
  };
}

export function computeStarsFromHeat(heat: number): number {
  if (heat >= 210) return 5;
  if (heat >= 160) return 4;
  if (heat >= 110) return 3;
  if (heat >= 60) return 2;
  if (heat >= 22) return 1;
  return 0;
}

export function stepWantedSystem(
  state: WantedState,
  dt: number,
  nearestPoliceDist: number,
  playerSpeed: number,
): { next: WantedState; busted: boolean; cooldownRatio: number } {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const next: WantedState = { ...state };
  if (next.stars === 0) {
    next.evadeTimer = 0;
    next.bustedProgress = 0;
    next.heat = Math.max(0, next.heat - 8 * safeDt);
    return { next, busted: false, cooldownRatio: 0 };
  }

  if (nearestPoliceDist < 6.0 && playerSpeed < 2.2) {
    next.bustedProgress += safeDt / 4.4;
    if (next.bustedProgress >= 1) {
      return { next, busted: true, cooldownRatio: 0 };
    }
  } else {
    next.bustedProgress = Math.max(0, next.bustedProgress - safeDt * 0.9);
  }

  const evadeRequired = 6.5 + next.stars * 1.5;
  if (nearestPoliceDist > 32) {
    next.evadeTimer += safeDt;
    if (next.evadeTimer >= evadeRequired) {
      next.stars = Math.max(0, next.stars - 1);
      next.heat = next.stars === 0 ? 0 : next.stars * 45;
      next.evadeTimer = 0;
    }
  } else {
    next.evadeTimer = Math.max(0, next.evadeTimer - safeDt * 0.65);
  }

  return {
    next,
    busted: false,
    cooldownRatio: Math.min(1, next.evadeTimer / evadeRequired),
  };
}

export interface TrafficAgentState {
  x: number;
  z: number;
  axis: 'ns' | 'ew';
  dir: 1 | -1;
  roadCoord: number;
  speed: number;
  targetSpeed: number;
}

export interface TrafficLightPhase {
  ns: 'green' | 'amber' | 'red';
  ew: 'green' | 'amber' | 'red';
}

export const TRAFFIC_CYCLE_SEC = 18;
export const TRAFFIC_GREEN_SEC = 7.0;
export const TRAFFIC_AMBER_SEC = 2.0;

export function getTrafficSignalState(simTime: number, phaseOffset = 0): TrafficLightPhase {
  const halfCycle = TRAFFIC_CYCLE_SEC * 0.5;
  const t = (((simTime + phaseOffset) % TRAFFIC_CYCLE_SEC) + TRAFFIC_CYCLE_SEC) % TRAFFIC_CYCLE_SEC;
  if (t < TRAFFIC_GREEN_SEC) {
    return { ns: 'green', ew: 'red' };
  }
  if (t < halfCycle) {
    return { ns: 'amber', ew: 'red' };
  }
  if (t < halfCycle + TRAFFIC_GREEN_SEC) {
    return { ns: 'red', ew: 'green' };
  }
  return { ns: 'red', ew: 'amber' };
}

export function getIntersectionPhaseOffset(roadX: number, roadZ: number): number {
  const ix = Math.round((roadX + 56) / 56);
  const iz = Math.round((roadZ + 56) / 56);
  return ((ix + iz) % 2) * (TRAFFIC_CYCLE_SEC * 0.5);
}

export function shouldStopForTrafficLight(
  axis: 'ns' | 'ew',
  dir: 1 | -1,
  x: number,
  z: number,
  roadCoord: number,
  simTime: number,
): boolean {
  const pos = axis === 'ns' ? z : x;
  for (let i = 0; i < ROAD_COORDS.length; i++) {
    const cross = ROAD_COORDS[i];
    const distAhead = (cross - pos) * dir;
    if (distAhead >= 6.8 && distAhead <= 16.5) {
      const ix = axis === 'ns' ? roadCoord : cross;
      const iz = axis === 'ns' ? cross : roadCoord;
      const signal = getTrafficSignalState(simTime, getIntersectionPhaseOffset(ix, iz));
      const myLight = axis === 'ns' ? signal.ns : signal.ew;
      return myLight === 'red' || myLight === 'amber';
    }
  }
  return false;
}

export type TrafficAxis = 'ns' | 'ew';

export interface TrafficBehaviorDecision {
  targetSpeed: number;
  stoppingForRed: boolean;
  shouldHonk: boolean;
}

export function evaluateTrafficBehavior(params: {
  x: number;
  z: number;
  axis: TrafficAxis;
  dir: 1 | -1;
  roadCoord: number;
  simTime: number;
  nearestAheadDist: number;
  cruiseSpeed: number;
}): TrafficBehaviorDecision {
  const { x, z, axis, dir, roadCoord, simTime, nearestAheadDist, cruiseSpeed } = params;
  const redLight = shouldStopForTrafficLight(axis, dir, x, z, roadCoord, simTime);
  if (redLight) {
    return { targetSpeed: 0, stoppingForRed: true, shouldHonk: false };
  }
  if (nearestAheadDist < 7.5) {
    return {
      targetSpeed: 0,
      stoppingForRed: false,
      shouldHonk: nearestAheadDist < 6.2,
    };
  }
  if (nearestAheadDist < 15.5) {
    const ratio = (nearestAheadDist - 7.5) / 8.0;
    return {
      targetSpeed: cruiseSpeed * Math.max(0.18, ratio),
      stoppingForRed: false,
      shouldHonk: false,
    };
  }
  return {
    targetSpeed: cruiseSpeed,
    stoppingForRed: false,
    shouldHonk: false,
  };
}

/**
 * Right-hand driving lane offset (USA / New York City standard).
 * Going +Z (South): keep right -> West (-X).
 * Going -Z (North): keep right -> East (+X).
 * Going +X (East): keep right -> South (+Z).
 * Going -X (West): keep right -> North (-Z).
 */
export function getNycLaneCoord(axis: 'ns' | 'ew', dir: 1 | -1, roadCoord: number): number {
  const offset = 3.1;
  if (axis === 'ns') {
    return dir === 1 ? roadCoord - offset : roadCoord + offset;
  }
  return dir === 1 ? roadCoord + offset : roadCoord - offset;
}

/** Alias preserved for any external reference */
export const getIndianLaneCoord = getNycLaneCoord;

export function stepTrafficAgent(
  agent: TrafficAgentState,
  dt: number,
  blockedAhead: boolean,
  turnSeed: number,
  simTime = 0,
): { next: TrafficAgentState; heading: number; stoppedAtRedLight: boolean } {
  const safeDt = Math.min(Math.max(dt, 0), 0.05);
  const next: TrafficAgentState = { ...agent };

  const redLightAhead = shouldStopForTrafficLight(
    next.axis,
    next.dir,
    next.x,
    next.z,
    next.roadCoord,
    simTime,
  );

  const desired = blockedAhead || redLightAhead ? 0 : next.targetSpeed;
  const accel = blockedAhead || redLightAhead ? 16 : 6.5;
  if (next.speed < desired) {
    next.speed = Math.min(desired, next.speed + accel * safeDt);
  } else {
    next.speed = Math.max(desired, next.speed - accel * safeDt);
  }

  if (next.axis === 'ns') {
    next.z += next.dir * next.speed * safeDt;
    const laneX = getNycLaneCoord('ns', next.dir, next.roadCoord);
    next.x += (laneX - next.x) * Math.min(1, safeDt * 6);

    if (next.z > SOUTH_BOUND - 10) next.dir = -1;
    if (next.z < NORTH_BOUND + 26) next.dir = 1;

    for (let i = 0; i < ROAD_COORDS.length; i++) {
      const rz = ROAD_COORDS[i];
      if (Math.abs(next.z - rz) < 0.7 && turnSeed > 0.72) {
        next.axis = 'ew';
        next.roadCoord = rz;
        next.dir = turnSeed > 0.86 ? 1 : -1;
        break;
      }
    }
  } else {
    next.x += next.dir * next.speed * safeDt;
    const laneZ = getNycLaneCoord('ew', next.dir, next.roadCoord);
    next.z += (laneZ - next.z) * Math.min(1, safeDt * 6);

    if (next.x > EAST_BOUND - 10) next.dir = -1;
    if (next.x < WEST_BOUND + 12) next.dir = 1;

    for (let i = 0; i < ROAD_COORDS.length; i++) {
      const rx = ROAD_COORDS[i];
      if (Math.abs(next.x - rx) < 0.7 && turnSeed > 0.72) {
        next.axis = 'ns';
        next.roadCoord = rx;
        next.dir = turnSeed > 0.86 ? 1 : -1;
        break;
      }
    }
  }

  const heading =
    next.axis === 'ns'
      ? next.dir === 1
        ? 0
        : Math.PI
      : next.dir === 1
        ? Math.PI * 0.5
        : -Math.PI * 0.5;

  return { next, heading, stoppedAtRedLight: redLightAhead };
}

export function shouldPoliceDeployOfficer(params: {
  wantedStars: number;
  distToPlayer: number;
  playerSpeedMps: number;
  playerInVehicle: boolean;
  alreadyDeployed: boolean;
  deployCooldown: number;
}): boolean {
  if (params.wantedStars <= 0 || params.alreadyDeployed || params.deployCooldown > 0) {
    return false;
  }
  const maxDist = params.playerInVehicle ? 11.5 : 16.5;
  const maxSpeed = params.playerInVehicle ? 3.5 : 8.5;
  return params.distToPlayer <= maxDist && params.playerSpeedMps <= maxSpeed;
}

export interface NpcMotionDecision {
  desiredVx: number;
  desiredVz: number;
  fleeing: boolean;
  telegraphAttack: boolean;
}

export function computeNpcDesiredVelocity(params: {
  archetype: NpcArchetype;
  x: number;
  z: number;
  playerX: number;
  playerZ: number;
  playerVx: number;
  playerVz: number;
  playerSpeed: number;
  patrolHeading: number;
  strafeSign: number;
  windupTimer: number;
  wantedStars?: number;
}): NpcMotionDecision {
  const {
    archetype,
    x,
    z,
    playerX,
    playerZ,
    playerVx,
    playerVz,
    playerSpeed,
    patrolHeading,
    strafeSign,
    windupTimer,
    wantedStars = 0,
  } = params;

  const dx = playerX - x;
  const dz = playerZ - z;
  const dist = Math.hypot(dx, dz) || 0.001;

  if (
    archetype === 'vendor' ||
    archetype === 'informant' ||
    archetype === 'shopkeeper' ||
    archetype === 'cricketer' ||
    archetype === 'baller' ||
    archetype === 'mission_contact'
  ) {
    return { desiredVx: 0, desiredVz: 0, fleeing: false, telegraphAttack: false };
  }

  if (archetype === 'purse_snatcher') {
    // Sprints rapidly away from the player along the avenue, catchable with Shift sprint
    const runSpeed = 5.5;
    const awayX = -dx / dist;
    const awayZ = -dz / dist;
    const zig = Math.sin(patrolHeading * 2.5) * 0.22;
    const vx = awayX - awayZ * zig;
    const vz = awayZ + awayX * zig;
    const mag = Math.hypot(vx, vz) || 1;
    return {
      desiredVx: (vx / mag) * runSpeed,
      desiredVz: (vz / mag) * runSpeed,
      fleeing: true,
      telegraphAttack: false,
    };
  }

  if (archetype === 'police_officer') {
    if (wantedStars > 0 && dist < 48) {
      const chaseSpeed = 4.5 + Math.min(1.4, wantedStars * 0.28);
      const leadT = Math.min(0.32, dist / 20);
      const tx = playerX + playerVx * leadT - x;
      const tz = playerZ + playerVz * leadT - z;
      const td = Math.hypot(tx, tz) || 0.001;
      return {
        desiredVx: (tx / td) * chaseSpeed,
        desiredVz: (tz / td) * chaseSpeed,
        fleeing: false,
        telegraphAttack: dist < 2.2,
      };
    }
    return {
      desiredVx: Math.sin(patrolHeading) * 1.85,
      desiredVz: Math.cos(patrolHeading) * 1.85,
      fleeing: false,
      telegraphAttack: false,
    };
  }

  if (archetype === 'commuter') {
    if (dist < 11 && playerSpeed > 5.5) {
      const fleeSpeed = 4.6;
      return {
        desiredVx: (-dx / dist) * fleeSpeed,
        desiredVz: (-dz / dist) * fleeSpeed,
        fleeing: true,
        telegraphAttack: false,
      };
    }
    return {
      desiredVx: Math.sin(patrolHeading) * 1.65,
      desiredVz: Math.cos(patrolHeading) * 1.65,
      fleeing: false,
      telegraphAttack: false,
    };
  }

  if (windupTimer > 0) {
    return { desiredVx: 0, desiredVz: 0, fleeing: false, telegraphAttack: true };
  }

  if (archetype === 'rival_rusher') {
    if (dist < 2.8) {
      return { desiredVx: 0, desiredVz: 0, fleeing: false, telegraphAttack: true };
    }
    const leadT = Math.min(0.5, dist / 14);
    const tx = playerX + playerVx * leadT - x;
    const tz = playerZ + playerVz * leadT - z;
    const td = Math.hypot(tx, tz) || 0.001;
    const speed = 5.4;
    return {
      desiredVx: (tx / td) * speed,
      desiredVz: (tz / td) * speed,
      fleeing: false,
      telegraphAttack: false,
    };
  }

  if (dist < 3.4) {
    return { desiredVx: 0, desiredVz: 0, fleeing: false, telegraphAttack: true };
  }
  const nx = dx / dist;
  const nz = dz / dist;
  const px = -nz * strafeSign;
  const pz = nx * strafeSign;
  const speed = 4.7;
  const mixF = dist > 9 ? 0.85 : 0.4;
  const mixS = dist > 9 ? 0.35 : 0.85;
  const mvx = nx * mixF + px * mixS;
  const mvz = nz * mixF + pz * mixS;
  const m = Math.hypot(mvx, mvz) || 1;
  return {
    desiredVx: (mvx / m) * speed,
    desiredVz: (mvz / m) * speed,
    fleeing: false,
    telegraphAttack: false,
  };
}

export { isPointInWater };
