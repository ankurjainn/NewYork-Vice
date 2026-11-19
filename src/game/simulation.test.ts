import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_AMBIENT_PROFILES, getAmbientProfile } from './ambientAudio';
import {
  BODY_BUILD_METRICS,
  NPC_CHARACTER_POOL,
  NYPD_OFFICER_SPEC,
  PLAYER_OUTFITS,
  cyclePlayerOutfitIndex,
  getWeatherClothingState,
} from './characterModels';
import {
  AREA_HOARDINGS,
  BUILDING_SHOPS,
  CITY_BUILDINGS,
  EAST_BOUND,
  FLYOVERS,
  LIBERTY_ISLAND,
  NORTH_BOUND,
  PIER_ZONES,
  PLAYER_SPAWN,
  RECREATION_ZONES,
  RESPAWN_POINTS,
  ROAD_COORDS,
  SOUTH_BOUND,
  STREET_GANTRIES,
  WEST_BOUND,
  findNearestDisembarkPoint,
  getDistrictAt,
  isPointInWater,
  sampleWorldElevation,
  selectRespawnPoint,
} from './cityLayout';
import { MISSIONS, createActiveMission, evaluateMissionTick } from './missions';
import { evaluateNpcReaction, getContextualTalkLine } from './npcDialogue';
import {
  PARK_SPORT_VENUES,
  buildParkSportHud,
  createInitialParkMatchState,
  evaluateTimingAction,
  exitPlayerParkMatch,
  startPlayerJoinMatch,
  startPlayerSpectateMatch,
  stepParkMatch,
  triggerPlayerSportAction,
} from './parkSports';
import {
  EVADE_CLEAR_SECONDS,
  HP_REGEN_DELAY_SEC,
  VEHICLE_SPECS,
  addWantedHeat,
  computeCrashDamage,
  computeNpcDesiredVelocity,
  evaluateTrafficBehavior,
  getIntersectionPhaseOffset,
  getNycLaneCoord,
  getTrafficSignalState,
  resolveCircleBuildingCollisions,
  resolveVehiclePairCollision,
  resolveWatercraftBounds,
  shouldPoliceDeployOfficer,
  stepCameraYaw,
  stepHealthRegen,
  stepSmoothSteer,
  stepVehiclePhysics,
  stepWantedSystem,
  type VehiclePhysicsState,
} from './simulation';
import {
  createStreetEvent,
  evaluateStreetEventTick,
} from './streetEvents';
import {
  SUBWAY_LOOP_LENGTH,
  SUBWAY_STATIONS,
  computeStationNextTrainEta,
  createInitialSubwayTrains,
  findNearestSubwayStation,
  sampleSubwayLoopPose,
  stepSubwayTrain,
} from './subwaySystem';
import type { BuildingArchVariant } from './types';
import {
  computeWeatherVisuals,
  createInitialWeatherState,
  cycleWeatherKind,
  setTargetWeather,
  stepWeatherSystem,
} from './weatherSystem';

test('player spawn is clear of buildings and sits in Washington Square corridor', () => {
  const col = resolveCircleBuildingCollisions(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0.7);
  assert.equal(col.hit, false, 'Player spawn must not intersect any building');
  assert.equal(getDistrictAt(0, -90), 'Washington Square');
  assert.equal(getDistrictAt(-72, 10), 'Battery Park');
  assert.equal(getDistrictAt(56, -28), 'Wall Street');
  assert.equal(getDistrictAt(56, 224), 'Midtown West');
});

test('building and Hudson seawall collision resolves cleanly without tunneling', () => {
  const b = CITY_BUILDINGS[0];
  const inside = resolveCircleBuildingCollisions(b.x, b.z, 1.0);
  assert.equal(inside.hit, true);

  // Pushing past Hudson seawall (away from piers) clamps cleanly to seawall boundary
  const seawall = resolveCircleBuildingCollisions(WEST_BOUND - 10, 60, 1.0);
  assert.equal(seawall.hit, true);
  assert.ok(seawall.x >= WEST_BOUND + 0.99);
});

test('varied NYC architecture uses all 9 distinct building archetypes with zero recreation-zone overlap', () => {
  const expectedVariants: BuildingArchVariant[] = [
    'artdeco_spire',
    'glass_supertall',
    'brownstone',
    'tenement_fireescape',
    'cast_iron_loft',
    'times_square_neon',
    'flatiron_wedge',
    'prewar_limestone',
    'dumbo_warehouse',
  ];
  const seenVariants = new Set(CITY_BUILDINGS.map((b) => b.archVariant));
  for (const v of expectedVariants) {
    assert.ok(seenVariants.has(v), `Expected NYC building archetype ${v} to appear in skyline`);
  }

  assert.equal(RECREATION_ZONES.length, 7);
  const kinds = new Set(RECREATION_ZONES.map((z) => z.kind));
  assert.ok(kinds.has('park') && kinds.has('playground') && kinds.has('courts') && kinds.has('stadium'));

  for (const zone of RECREATION_ZONES) {
    for (const b of CITY_BUILDINGS) {
      const overlapX = Math.abs(b.x - zone.cx) < (b.width + zone.width) * 0.5;
      const overlapZ = Math.abs(b.z - zone.cz) < (b.depth + zone.depth) * 0.5;
      assert.equal(
        overlapX && overlapZ,
        false,
        `Building ${b.id} must not overlap recreation zone ${zone.name}`,
      );
    }
  }
});

test('NYC right-hand driving lanes and traffic signals operate accurately', () => {
  // Going +Z (South) keeps right -> West (-X)
  assert.ok(getNycLaneCoord('ns', 1, 0) < 0);
  // Going -Z (North) keeps right -> East (+X)
  assert.ok(getNycLaneCoord('ns', -1, 0) > 0);
  // Going +X (East) keeps right -> South (+Z)
  assert.ok(getNycLaneCoord('ew', 1, 0) > 0);
  // Going -X (West) keeps right -> North (-Z)
  assert.ok(getNycLaneCoord('ew', -1, 0) < 0);

  const s1 = getTrafficSignalState(2, 0);
  assert.equal(s1.ns, 'green');
  assert.equal(s1.ew, 'red');

  const s2 = getTrafficSignalState(8, 0);
  assert.equal(s2.ns, 'amber');
  assert.equal(s2.ew, 'red');

  const s3 = getTrafficSignalState(12, 0);
  assert.equal(s3.ns, 'red');
  assert.equal(s3.ew, 'green');

  // Traffic stops behind stop-line on red and accelerates on green
  const phase00 = getIntersectionPhaseOffset(0, 0);
  let redTime = 0;
  let greenTime = 0;
  for (let t = 0; t < 24; t += 0.5) {
    const st = getTrafficSignalState(t, phase00);
    if (st.ns === 'red') redTime = t;
    if (st.ns === 'green') greenTime = t;
  }

  const redStop = evaluateTrafficBehavior({
    x: getNycLaneCoord('ns', 1, 0),
    z: -10.5,
    axis: 'ns',
    dir: 1,
    roadCoord: 0,
    simTime: redTime,
    nearestAheadDist: 50,
    cruiseSpeed: 13,
  });
  assert.equal(redStop.stoppingForRed, true);
  assert.equal(redStop.targetSpeed, 0);

  const greenGo = evaluateTrafficBehavior({
    x: getNycLaneCoord('ns', 1, 0),
    z: -10.5,
    axis: 'ns',
    dir: 1,
    roadCoord: 0,
    simTime: greenTime,
    nearestAheadDist: 50,
    cruiseSpeed: 13,
  });
  assert.equal(greenGo.stoppingForRed, false);
  assert.equal(greenGo.targetSpeed, 13);

  const blocked = evaluateTrafficBehavior({
    x: getNycLaneCoord('ns', 1, 0),
    z: -30,
    axis: 'ns',
    dir: 1,
    roadCoord: 0,
    simTime: greenTime,
    nearestAheadDist: 4.5,
    cruiseSpeed: 13,
  });
  assert.equal(blocked.targetSpeed, 0);
  assert.equal(blocked.shouldHonk, true);
});

test('vehicle physics differentiates NYC Pedicab vs Manhattan GT Coupe speed and boost', () => {
  const start: VehiclePhysicsState = {
    x: 0,
    y: 0,
    z: -24,
    vx: 0,
    vz: 0,
    heading: 0,
    steerAngle: 0,
    speed: 0,
    isDrifting: false,
    isBoosting: false,
    hitWall: false,
    impactSpeed: 0,
  };

  let gt = { ...start };
  let pedicab = { ...start };
  for (let i = 0; i < 36; i++) {
    gt = stepVehiclePhysics(
      gt,
      VEHICLE_SPECS.sports,
      { throttle: 1, steer: 0, handbrake: false, boost: true, boostAvailable: true },
      0.05,
    );
    pedicab = stepVehiclePhysics(
      pedicab,
      VEHICLE_SPECS.auto,
      { throttle: 1, steer: 0, handbrake: false, boost: false, boostAvailable: false },
      0.05,
    );
  }
  assert.ok(gt.speed > VEHICLE_SPECS.sports.maxSpeed, 'Boosted Manhattan GT exceeds base maxSpeed');
  assert.ok(gt.speed > pedicab.speed * 1.45, 'Manhattan GT is substantially faster than NYC Pedicab');
});

test('interactive Park Sports venues support live NPC play, joining, sweet-spot timing, cash payouts, and spectating', () => {
  assert.equal(PARK_SPORT_VENUES.length, 4);
  const cricketVenue = PARK_SPORT_VENUES.find((v) => v.id === 'central_park_cricket')!;
  const hoopsVenue = PARK_SPORT_VENUES.find((v) => v.id === 'rucker_streetball')!;
  assert.ok(cricketVenue && hoopsVenue);

  // Sweet-spot timing awards SIX in cricket and 3-POINTER in streetball
  const six = evaluateTimingAction('cricket', 0.78, 1);
  assert.equal(six.runs, 6);
  assert.equal(six.wicket, false);

  const threePt = evaluateTimingAction('streetball', 0.78, 1);
  assert.equal(threePt.runs, 3);

  // Live NPC match runs continuously without player input
  let state = createInitialParkMatchState(cricketVenue);
  assert.equal(state.mode, 'npc_match');
  let sawNpcHit = false;
  for (let i = 0; i < 60; i++) {
    const step = stepParkMatch(cricketVenue, state, 0.1);
    state = step.next;
    if (step.hitEvent) sawNpcHit = true;
  }
  assert.equal(sawNpcHit, true, 'NPC pickup cricket match bowls and bats continuously');

  // Spectate mode switches cleanly and exits back to npc_match
  state = startPlayerSpectateMatch(cricketVenue, state);
  assert.equal(state.mode, 'spectating');
  state = exitPlayerParkMatch(cricketVenue, state);
  assert.equal(state.mode, 'npc_match');

  // Join mode lets player bat through a full 6-ball over and earn USD payout
  state = startPlayerJoinMatch(cricketVenue, state);
  assert.equal(state.mode, 'joined');
  assert.equal(state.scoreRuns, 0);

  let totalPayout = 0;
  for (let stepIdx = 0; stepIdx < 400; stepIdx++) {
    const res = stepParkMatch(cricketVenue, state, 0.1);
    state = res.next;
    if (res.completedReward > 0) {
      totalPayout = res.completedReward;
      break;
    }
    if (state.mode === 'joined' && state.phase === 'delivery' && !state.swingAttempted && state.timingValue >= 0.75) {
      const swung = triggerPlayerSportAction(cricketVenue, state);
      state = swung.next;
      assert.ok(swung.hitEvent && swung.hitEvent.runs >= 4);
    }
  }
  assert.ok(totalPayout >= cricketVenue.basePrize + 24 * cricketVenue.perPointBonus, `Expected strong USD cricket payout, got ${totalPayout}`);
  assert.equal(state.mode, 'npc_match', 'Over completes and returns cleanly to live NPC pickup mode');

  const hud = buildParkSportHud(cricketVenue, state);
  assert.equal(hud.venueId, cricketVenue.id);
});

test('all 22 NYC contracts have unique IDs, positive USD rewards, and state machine completes with payout', () => {
  assert.equal(MISSIONS.length, 22);
  const ids = new Set<string>();
  MISSIONS.forEach((m) => {
    assert.ok(!ids.has(m.id), `Duplicate mission id: ${m.id}`);
    ids.add(m.id);
    assert.ok(m.reward > 0);
    assert.ok(m.steps.length >= 2);
  });

  // Complete Mission 1 (Fifth Ave Yellow Cab Rush)
  const m1 = MISSIONS[0];
  let st = createActiveMission(m1.id, []);
  assert.ok(st);

  let res = evaluateMissionTick(st, {
    dt: 0.1,
    playerX: 0,
    playerZ: -20,
    vehicleType: 'taxi',
    wantedStars: 0,
    convoyDisabledCount: 0,
  });
  assert.equal(res.status, 'step_advanced');
  assert.equal(res.nextState?.stepIndex, 1);

  res = evaluateMissionTick(res.nextState!, {
    dt: 0.1,
    playerX: m1.steps[1].targetX!,
    playerZ: m1.steps[1].targetZ!,
    vehicleType: 'taxi',
    wantedStars: 0,
    convoyDisabledCount: 0,
  });
  assert.equal(res.status, 'step_advanced');
  assert.equal(res.nextState?.stepIndex, 2);

  res = evaluateMissionTick(res.nextState!, {
    dt: 0.1,
    playerX: m1.steps[2].targetX!,
    playerZ: m1.steps[2].targetZ!,
    vehicleType: 'taxi',
    wantedStars: 0,
    convoyDisabledCount: 0,
  });
  assert.equal(res.status, 'completed');
  assert.equal(res.reward, m1.reward);
  assert.ok(res.nextState?.completedIds.includes(m1.id));
});

test('11x11 NYC mega-map includes 121 intersections, 6 viaducts, 4 Hudson piers, Liberty Island & signage', () => {
  assert.equal(ROAD_COORDS.length, 11);
  assert.equal(ROAD_COORDS.length * ROAD_COORDS.length, 121);
  const mapArea = (EAST_BOUND - WEST_BOUND) * (SOUTH_BOUND - NORTH_BOUND);
  assert.ok(mapArea >= 380000, `Expected 11x11 NYC map area >= 380,000 m², got ${mapArea}`);
  assert.equal(FLYOVERS.length, 6);
  assert.equal(PIER_ZONES.length, 4);
  assert.ok(STREET_GANTRIES.length >= 8);
  assert.ok(AREA_HOARDINGS.length >= 8);

  // Climbing FDR Express Viaduct elevates cleanly while ground street stays y = 0
  const onDeck = sampleWorldElevation(56, 56, 6.2);
  assert.equal(onDeck.onFlyover, true);
  assert.equal(onDeck.groundY, 6.4);
  const underDeck = sampleWorldElevation(56, 56, 0);
  assert.equal(underDeck.onFlyover, false);
  assert.equal(underDeck.groundY, 0);

  // Hudson piers & Liberty Island are walkable while open Hudson Harbor is water
  assert.equal(isPointInWater(-96, -82), false, 'Battery Ferry Pier deck is walkable');
  assert.equal(isPointInWater(LIBERTY_ISLAND.x, LIBERTY_ISLAND.z), false, 'Liberty Island is walkable');
  assert.equal(isPointInWater(-160, -140), true, 'Open Hudson Harbor is water');

  // Watercraft stays outside landmass
  const boatHit = resolveWatercraftBounds(0, -80, 2.5);
  assert.equal(boatHit.hit, true);

  // Disembark works near piers and Liberty Island, blocked mid-harbor
  assert.ok(findNearestDisembarkPoint(-116, -95, 24), 'Can disembark at Battery Ferry Pier');
  assert.ok(
    findNearestDisembarkPoint(LIBERTY_ISLAND.dockX, LIBERTY_ISLAND.dockZ, 24),
    'Can disembark at Liberty Island dock',
  );
  assert.equal(findNearestDisembarkPoint(-260, 120, 24), null, 'Mid-harbor disembark blocked safely');
});

test('NYC wanted system, crash damage & health regeneration behave fairly', () => {
  let w = { heat: 0, stars: 0, evadeTimer: 0, bustedProgress: 0 };
  w = addWantedHeat(w, 90);
  assert.equal(w.stars, 2);

  let current = w;
  // 2 stars require 6.5 + 2*1.5 = 9.5s away (>32m) to drop 1 star
  for (let i = 0; i < (EVADE_CLEAR_SECONDS + 2) * 20; i++) {
    const res = stepWantedSystem(current, 0.05, 40, 12);
    current = res.next;
    assert.equal(res.busted, false);
  }
  assert.equal(current.stars, 1);

  // Continuing at 36m (>32m safe distance) clears final star cleanly
  for (let i = 0; i < 10 * 20; i++) {
    const res = stepWantedSystem(current, 0.05, 36, 10);
    current = res.next;
  }
  assert.equal(current.stars, 0, 'Calmer wanted system allows clean escape at 36m distance');

  let cornered = w;
  let gotBusted = false;
  for (let i = 0; i < 100; i++) {
    const res = stepWantedSystem(cornered, 0.05, 4, 0);
    cornered = res.next;
    if (res.busted) gotBusted = true;
  }
  assert.equal(gotBusted, true);

  const crash = computeCrashDamage(25, true);
  assert.ok(crash.playerDamage > 0 && crash.playerDamage <= 20);
  assert.ok(crash.vehicleDamage > 0 && crash.vehicleDamage <= 34);

  const waiting = stepHealthRegen(70, 100, HP_REGEN_DELAY_SEC - 1.0, 0.5);
  assert.equal(waiting.hp, 70);
  assert.equal(waiting.regenerating, false);

  const healing = stepHealthRegen(70, 100, HP_REGEN_DELAY_SEC + 0.5, 1.0);
  assert.ok(healing.hp > 75 && healing.hp <= 100);
  assert.equal(healing.regenerating, true);
});

test('camera yaw stays calm on keyboard arrows and never whips in reverse', () => {
  const startYaw = Math.PI;
  let yaw = startYaw;
  for (let i = 0; i < 10; i++) {
    yaw = stepCameraYaw({
      currentYaw: yaw,
      targetYaw: startYaw - Math.PI / 2,
      dt: 0.05,
      mode: 'foot',
      inputF: 0,
      inputR: 1,
      vehicleSpeed: 0,
    });
  }
  const deltaRight = Math.abs(yaw - startYaw);
  assert.ok(deltaRight > 0.2 && deltaRight < 0.6, `Expected calm gentle right pan, got ${deltaRight}`);

  const backYaw = stepCameraYaw({
    currentYaw: startYaw,
    targetYaw: 0,
    dt: 0.2,
    mode: 'foot',
    inputF: -1,
    inputR: 0,
    vehicleSpeed: 0,
  });
  assert.equal(backYaw, startYaw);

  const s1 = stepSmoothSteer(0, 1, 0.05);
  assert.ok(s1 > 0.1 && s1 < 0.5);
});

test('NYC ambient audio, contextual dialogue, weather, shops, 10 pedestrian models & NYPD officers work cleanly', () => {
  // All 19 NYC districts have ambient audio profiles
  assert.equal(Object.keys(DISTRICT_AMBIENT_PROFILES).length, 19);
  assert.ok(getAmbientProfile('Midtown West').traffic > 0.9);
  assert.ok(getAmbientProfile('Hudson Harbor').sea >= 0.95);
  assert.ok(getAmbientProfile('Williamsburg').construction >= 0.7);

  // Contextual NYC dialogue
  const nearMiss = evaluateNpcReaction({
    npcName: 'Marco',
    district: 'Midtown West',
    distanceMeters: 6.0,
    playerInVehicle: true,
    playerVehicleType: 'sports',
    playerSpeedMps: 15,
    playerHonkedRecently: false,
    playerShovedRecently: false,
    wantedStars: 0,
    seed: 1,
  });
  assert.equal(nearMiss?.reason, 'near_miss');
  assert.ok(getContextualTalkLine('Washington Square', 0, 0).length > 10);

  // Multi-location NYC respawn points are clear of buildings and vary cleanly
  assert.ok(RESPAWN_POINTS.length >= 10);
  for (const rp of RESPAWN_POINTS) {
    assert.equal(resolveCircleBuildingCollisions(rp.x, rp.z, 0.7).hit, false, `Respawn ${rp.id} clear`);
  }
  const rp1 = selectRespawnPoint(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0);
  const rp2 = selectRespawnPoint(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 1);
  assert.notEqual(rp1.id, rp2.id);

  // Dynamic NYC weather system
  let wst = createInitialWeatherState('clear_sunset');
  assert.equal(cycleWeatherKind('clear_sunset'), 'light_drizzle');
  assert.equal(cycleWeatherKind('light_drizzle'), 'heavy_monsoon');
  assert.equal(cycleWeatherKind('heavy_monsoon'), 'clear_sunset');
  wst = setTargetWeather(wst, 'heavy_monsoon', false);
  for (let i = 0; i < 120; i++) wst = stepWeatherSystem(wst, 0.1).next;
  const storm = computeWeatherVisuals(wst);
  assert.ok(storm.rainIntensity > 0.9);
  assert.ok(storm.roadRoughness < 0.35);
  assert.ok(storm.cloudOpacity > 0.75);

  // All 16 NYC building shops have valid items and building-free shopkeeper spots
  assert.equal(BUILDING_SHOPS.length, 16);
  for (const shop of BUILDING_SHOPS) {
    const kx = shop.x + Math.sin(shop.facing) * 1.65;
    const kz = shop.z + Math.cos(shop.facing) * 1.65;
    assert.equal(
      resolveCircleBuildingCollisions(kx, kz, 0.45).hit,
      false,
      `Shopkeeper at ${shop.shopName} must be clear of buildings`,
    );
  }

  // 10 NYC character models + 6 Marcus outfits + NYPD officer
  assert.equal(NPC_CHARACTER_POOL.length, 10);
  for (const model of NPC_CHARACTER_POOL) {
    assert.ok(BODY_BUILD_METRICS[model.build]);
  }
  assert.equal(PLAYER_OUTFITS.length, 6);
  let oIdx = 0;
  for (let i = 0; i < PLAYER_OUTFITS.length; i++) oIdx = cyclePlayerOutfitIndex(oIdx);
  assert.equal(oIdx, 0);

  const umbrellaNpc = NPC_CHARACTER_POOL.find((m) => m.umbrellaHex)!;
  assert.equal(getWeatherClothingState('light_drizzle', 0.4, umbrellaNpc).showUmbrella, true);

  assert.equal(NYPD_OFFICER_SPEC.silhouette, 'police_uniform');
  const chasingCop = computeNpcDesiredVelocity({
    archetype: 'police_officer',
    x: 0,
    z: 0,
    playerX: 12,
    playerZ: 0,
    playerVx: 0,
    playerVz: 0,
    playerSpeed: 2,
    patrolHeading: 0,
    strafeSign: 1,
    windupTimer: 0,
    wantedStars: 2,
  });
  assert.ok(chasingCop.desiredVx > 5.0);
  assert.equal(
    shouldPoliceDeployOfficer({
      wantedStars: 2,
      distToPlayer: 12,
      playerSpeedMps: 3,
      playerInVehicle: false,
      alreadyDeployed: false,
      deployCooldown: 0,
    }),
    true,
  );
  // Officers do not leap out of cruisers while player is actively driving away
  assert.equal(
    shouldPoliceDeployOfficer({
      wantedStars: 2,
      distToPlayer: 10,
      playerSpeedMps: 7.5,
      playerInVehicle: true,
      alreadyDeployed: false,
      deployCooldown: 0,
    }),
    false,
  );
});

test('realistic OBB vehicle collisions separate cleanly, apply correct recoil signs, respect mass, and scrub wild lateral drift', () => {
  const makeCar = (x: number, z: number, vx: number, vz: number, heading = 0): VehiclePhysicsState => ({
    x,
    y: 0,
    z,
    vx,
    vz,
    heading,
    steerAngle: 0,
    speed: vx * Math.sin(heading) + vz * Math.cos(heading),
    isDrifting: false,
    isBoosting: false,
    hitWall: false,
    impactSpeed: 0,
  });

  // 1. Head-on collision along +Z: car A going +14 m/s hits stationary car B ahead
  const carA = makeCar(0, 0, 0, 14, 0);
  const carB = makeCar(0, 4.0, 0, 0, 0);
  const headOn = resolveVehiclePairCollision(carA, VEHICLE_SPECS.taxi, carB, VEHICLE_SPECS.taxi);
  assert.equal(headOn.hit, true);
  assert.ok(carA.z < 0, 'Car A must separate backward (-Z)');
  assert.ok(carB.z > 4.0, 'Car B must separate forward (+Z)');
  assert.ok(carA.vz < 10, 'Car A loses forward momentum on rear-end crunch');
  assert.ok(carB.vz > 4, 'Car B gets pushed forward (+Z), never pulled backward');
  assert.ok(headOn.pitchImpulseA < 0, 'Rear-end crunch triggers nose-dive suspension impulse');

  // 2. Oblique side-swipe scrubs sideways drift tightly (no skating across the map)
  const swA = makeCar(0, 0, 5, 18, 0);
  const swB = makeCar(1.75, 1.0, -4, 10, 0);
  const sideswipe = resolveVehiclePairCollision(swA, VEHICLE_SPECS.sports, swB, VEHICLE_SPECS.taxi);
  assert.equal(sideswipe.hit, true);
  assert.ok(Math.abs(swA.vx) <= 3.3, `Lateral velocity must stay tightly damped, got ${swA.vx}`);
  assert.ok(Math.abs(swB.vx) <= 3.3, `Struck car lateral drift damped, got ${swB.vx}`);
  assert.ok(Math.abs(swA.heading) < 0.25, 'Glancing yaw deflection remains controlled');

  // 3. Heavy MTA Bus vs light NYC Pedicab mass dominance
  const pedicab = makeCar(0, 0, 0, 12, 0);
  const mtaBus = makeCar(0, 4.5, 0, 0, 0);
  const busVsPedicab = resolveVehiclePairCollision(pedicab, VEHICLE_SPECS.auto, mtaBus, VEHICLE_SPECS.bus);
  assert.equal(busVsPedicab.hit, true);
  assert.ok(Math.abs(mtaBus.vz) < 3.0, 'Heavy MTA bus barely budges when hit by pedicab');
  assert.ok(pedicab.vz < 2.0, 'Light pedicab stops/bounces slightly off heavy bus');

  // 4. Side-by-side vehicles in adjacent lanes do NOT falsely collide (true OBB vs old wide circle)
  const laneA = makeCar(-1.7, 0, 0, 12, 0);
  const laneB = makeCar(1.7, 0, 0, 12, 0);
  const adjacent = resolveVehiclePairCollision(laneA, VEHICLE_SPECS.taxi, laneB, VEHICLE_SPECS.sports);
  assert.equal(adjacent.hit, false, 'Vehicles in adjacent lanes must not trigger phantom collisions');
});

test('interactive task-based NYC missions have clear coordinates and progress through NPC talks, outfits, tasks, scavenging, confrontations, shops & park sports', () => {
  const interactiveMissions = MISSIONS.filter((m) => m.isInteractive);
  assert.equal(interactiveMissions.length, 4, 'Expected 4 interactive task-based NYC missions');

  // Verify every interactive target coordinate and collectible point is clear of buildings
  for (const m of interactiveMissions) {
    for (const step of m.steps) {
      if (step.targetX !== undefined && step.targetZ !== undefined) {
        const col = resolveCircleBuildingCollisions(step.targetX, step.targetZ, 0.7);
        assert.equal(
          col.hit,
          false,
          `Mission ${m.id} step "${step.label}" (${step.targetX}, ${step.targetZ}) must not sit inside a building`,
        );
      }
      if (step.collectPoints) {
        for (const pt of step.collectPoints) {
          const col = resolveCircleBuildingCollisions(pt.x, pt.z, 0.7);
          assert.equal(
            col.hit,
            false,
            `Mission ${m.id} collectible "${pt.label}" (${pt.x}, ${pt.z}) must not sit inside a building`,
          );
        }
      }
    }
  }

  // Walk through m19_soho_undercover_handshake (talk_npc -> change_outfit -> perform_task -> talk_npc)
  const m19 = MISSIONS.find((m) => m.id === 'm19_soho_undercover_handshake')!;
  let st = createActiveMission(m19.id, [])!;
  let tick = evaluateMissionTick(st, {
    dt: 0.1,
    playerX: m19.steps[0].targetX!,
    playerZ: m19.steps[0].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    talkedToMissionNpc: true,
  });
  assert.equal(tick.status, 'step_advanced');
  st = tick.nextState!;

  tick = evaluateMissionTick(st, {
    dt: 0.1,
    playerX: 0,
    playerZ: 0,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    changedOutfit: true,
  });
  assert.equal(tick.status, 'step_advanced');
  st = tick.nextState!;

  tick = evaluateMissionTick(st, {
    dt: 0.1,
    playerX: m19.steps[2].targetX!,
    playerZ: m19.steps[2].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    performedTask: true,
  });
  assert.equal(tick.status, 'step_advanced');
  st = tick.nextState!;

  tick = evaluateMissionTick(st, {
    dt: 0.1,
    playerX: m19.steps[3].targetX!,
    playerZ: m19.steps[3].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    talkedToMissionNpc: true,
  });
  assert.equal(tick.status, 'completed');
  assert.equal(tick.reward, m19.reward);

  // Walk through m20_manhattan_blackout_fix (talk_npc -> collect_items x3 -> perform_task -> shop_buy)
  const m20 = MISSIONS.find((m) => m.id === 'm20_manhattan_blackout_fix')!;
  let st20 = createActiveMission(m20.id, [])!;
  st20 = evaluateMissionTick(st20, {
    dt: 0.1,
    playerX: m20.steps[0].targetX!,
    playerZ: m20.steps[0].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    talkedToMissionNpc: true,
  }).nextState!;

  const pts = m20.steps[1].collectPoints!;
  for (let i = 0; i < pts.length; i++) {
    const t = evaluateMissionTick(st20, {
      dt: 0.1,
      playerX: pts[i].x,
      playerZ: pts[i].z,
      vehicleType: null,
      wantedStars: 0,
      convoyDisabledCount: 0,
    });
    assert.equal(t.itemCollectedIndex, i);
    st20 = t.nextState!;
    if (i < pts.length - 1) assert.equal(t.status, 'active');
    else assert.equal(t.status, 'step_advanced');
  }

  st20 = evaluateMissionTick(st20, {
    dt: 0.1,
    playerX: m20.steps[2].targetX!,
    playerZ: m20.steps[2].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    performedTask: true,
  }).nextState!;

  const done20 = evaluateMissionTick(st20, {
    dt: 0.1,
    playerX: 0,
    playerZ: 0,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    boughtFromShop: true,
  });
  assert.equal(done20.status, 'completed');

  // Walk through m21_central_park_hustle (talk_npc -> confront_target -> park_sport_score)
  const m21 = MISSIONS.find((m) => m.id === 'm21_central_park_hustle')!;
  let st21 = createActiveMission(m21.id, [])!;
  st21 = evaluateMissionTick(st21, {
    dt: 0.1,
    playerX: m21.steps[0].targetX!,
    playerZ: m21.steps[0].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    talkedToMissionNpc: true,
  }).nextState!;

  st21 = evaluateMissionTick(st21, {
    dt: 0.1,
    playerX: m21.steps[1].targetX!,
    playerZ: m21.steps[1].targetZ!,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    confrontedTarget: true,
  }).nextState!;

  const done21 = evaluateMissionTick(st21, {
    dt: 0.1,
    playerX: 0,
    playerZ: 0,
    vehicleType: null,
    wantedStars: 0,
    convoyDisabledCount: 0,
    parkRunsEarnedDelta: 6,
    activeParkVenueId: 'central_park_cricket',
  });
  assert.equal(done21.status, 'completed');
});

test('Elevated NYC Subway connects Manhattan, Brooklyn, and Queens with clear station entrances, live trains, dwell stops & ETAs', () => {
  assert.equal(SUBWAY_STATIONS.length, 6);
  const boroughs = new Set(SUBWAY_STATIONS.map((s) => s.borough));
  assert.ok(boroughs.has('Manhattan') && boroughs.has('Brooklyn') && boroughs.has('Queens'));

  // Every elevated station street kiosk entrance must sit completely clear of buildings
  for (const st of SUBWAY_STATIONS) {
    const col = resolveCircleBuildingCollisions(st.entranceX, st.entranceZ, 0.7);
    assert.equal(
      col.hit,
      false,
      `Subway station ${st.name} entrance (${st.entranceX}, ${st.entranceZ}) must not collide with buildings`,
    );
  }

  // Loop spline wraps seamlessly and stays elevated above road flyovers
  const p0 = sampleSubwayLoopPose(0, 1);
  const pWrap = sampleSubwayLoopPose(SUBWAY_LOOP_LENGTH, 1);
  assert.ok(Math.hypot(p0.x - pWrap.x, p0.z - pWrap.z) < 0.01);
  assert.ok(p0.y > 10.5, 'Elevated subway track clears 6.8m highway flyovers');

  // Train approaches Washington Sq station, docks cleanly with dwell timer, and resumes
  let trains = createInitialSubwayTrains();
  let dockedAtWashSq = false;
  for (let i = 0; i < 60; i++) {
    const res = stepSubwayTrain(trains[0], 0.1);
    trains[0] = res.next;
    if (res.arrivedStation?.id === 'st_wash_sq') dockedAtWashSq = true;
  }
  assert.equal(dockedAtWashSq, true, 'Express train must smoothly brake and dock at Washington Sq station');
  const etaNow = computeStationNextTrainEta(SUBWAY_STATIONS[0], trains);
  assert.ok(etaNow.etaSec >= 0);

  // Nearest station lookup finds Washington Sq near entrance
  const washSq = SUBWAY_STATIONS[0];
  assert.equal(findNearestSubwayStation(washSq.entranceX + 1.5, washSq.entranceZ, 8)?.id, 'st_wash_sq');
});

test('Smarter Random Street Events support Purse Snatcher, Red-Light Street Race, and Armored Cash Van flows', () => {
  // 1. Purse Snatcher chase & shove reward
  let snatcher = createStreetEvent({
    playerX: 0,
    playerZ: 0,
    playerHeading: 0,
    playerInVehicle: false,
    district: 'Washington Square',
    seed: 1,
    forcedKind: 'purse_snatcher',
  });
  assert.equal(snatcher.kind, 'purse_snatcher');
  const caught = evaluateStreetEventTick(snatcher, {
    dt: 0.1,
    playerX: snatcher.targetX,
    playerZ: snatcher.targetZ,
    playerInVehicle: false,
    thiefStopped: true,
    actorX: snatcher.targetX,
    actorZ: snatcher.targetZ,
  });
  assert.equal(caught.status, 'won');
  assert.equal(caught.reward, 550);

  // 2. Red-Light Street Race: accept while in vehicle, then cross finish arch ahead of rival
  let race = createStreetEvent({
    playerX: 0,
    playerZ: 40,
    playerHeading: 0,
    playerInVehicle: true,
    district: 'Midtown West',
    seed: 2,
    forcedKind: 'street_race',
  });
  assert.equal(race.phase, 'available');
  const started = evaluateStreetEventTick(race, {
    dt: 0.1,
    playerX: race.targetX,
    playerZ: race.targetZ,
    playerInVehicle: true,
    acceptedChallenge: true,
    actorX: race.targetX,
    actorZ: race.targetZ,
  });
  assert.equal(started.status, 'started');
  assert.equal(started.next?.phase, 'active');

  const wonRace = evaluateStreetEventTick(started.next!, {
    dt: 0.1,
    playerX: started.next!.finishX!,
    playerZ: started.next!.finishZ!,
    playerInVehicle: true,
    actorX: race.targetX,
    actorZ: race.targetZ,
  });
  assert.equal(wonRace.status, 'won');
  assert.equal(wonRace.reward, 850);

  // 3. Armored Cash Van: 3 solid ram hits crack the vault for $1,100 + 1 fair NYPD star
  let van = createStreetEvent({
    playerX: 56,
    playerZ: 80,
    playerHeading: 0,
    playerInVehicle: true,
    district: 'SoHo Lofts',
    seed: 3,
    forcedKind: 'armored_van',
  });
  const hit1 = evaluateStreetEventTick(van, {
    dt: 0.1,
    playerX: van.targetX,
    playerZ: van.targetZ,
    playerInVehicle: true,
    actorX: van.targetX,
    actorZ: van.targetZ,
    vanHitsDelta: 2,
  });
  assert.equal(hit1.status, 'ongoing');
  assert.equal(hit1.next?.progress, 2);

  const hit3 = evaluateStreetEventTick(hit1.next!, {
    dt: 0.1,
    playerX: van.targetX,
    playerZ: van.targetZ,
    playerInVehicle: true,
    actorX: van.targetX,
    actorZ: van.targetZ,
    vanHitsDelta: 1,
  });
  assert.equal(hit3.status, 'won');
  assert.equal(hit3.reward, 1100);
  assert.equal(hit3.wantedHeatDelta, 40);
});
