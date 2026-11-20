import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_COLLISION_RADIUS,
  computeGearAndRpm,
  createFootPlayerState,
  createInitialCarState,
  stepCarPhysics,
  stepFootPlayerPhysics,
  type CarInput,
} from './carPhysics';
import { createCityLayout, findHouseContainingPoint, type ColliderBox } from './cityLayout';
import { groundHeightAt } from './groundSurface';

const IDLE_INPUT: CarInput = {
  throttle: false,
  brakeReverse: false,
  steerLeft: false,
  steerRight: false,
  handbrake: false,
};

test('car accelerates smoothly, spins wheels, and never sinks below groundHeightAt', () => {
  const layout = createCityLayout();
  const car = createInitialCarState(layout.spawn.x, layout.spawn.z, layout.spawn.heading, 0);

  for (let i = 0; i < 90; i++) {
    stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
      'grand-tourer',
      layout.groundSurface,
    );
    const gY = groundHeightAt(car.x, car.z, layout.groundSurface);
    assert.ok(car.y >= gY - 0.001, `Car sank below ground at step ${i}: y=${car.y}, groundY=${gY}`);
  }

  assert.ok(car.speedKmh > 60, `Expected car to exceed 60 km/h after 1.5s, got ${car.speedKmh.toFixed(1)}`);
  assert.ok(car.z < layout.spawn.z - 15, 'Car facing heading=0 (-Z) should travel north');
  assert.ok(car.wheelSpin > 20, 'Wheels should accumulate forward spin');
});

test('steering turns front wheels and changes heading; braking reverses from stop', () => {
  const layout = createCityLayout();
  const car = createInitialCarState(layout.spawn.x, layout.spawn.z, layout.spawn.heading);

  for (let i = 0; i < 60; i++) {
    stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true, steerLeft: true },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
      'grand-tourer',
      layout.groundSurface,
    );
  }
  assert.ok(car.steerAngle > 0.25, 'Front wheels should turn left (+angle)');
  assert.ok(car.heading > 0.3, 'Car heading should rotate left');

  const revCar = createInitialCarState(0, 0, 0);
  for (let i = 0; i < 45; i++) {
    stepCarPhysics(revCar, { ...IDLE_INPUT, brakeReverse: true }, 1 / 60, [], layout.worldBounds);
  }
  assert.ok(revCar.forwardSpeed < -3, 'Holding brake/reverse from rest should reverse');
  assert.equal(computeGearAndRpm(revCar.forwardSpeed).gear, 'R');
});

test('handbrake drift creates lateral slip and accrues drift score', () => {
  const layout = createCityLayout();
  const car = createInitialCarState(0, 20, 0);

  for (let i = 0; i < 90; i++) {
    stepCarPhysics(car, { ...IDLE_INPUT, throttle: true }, 1 / 60, [], layout.worldBounds, 'drift-spec');
  }
  let sawDrift = false;
  for (let i = 0; i < 45; i++) {
    stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true, steerRight: true, handbrake: true },
      1 / 60,
      [],
      layout.worldBounds,
      'drift-spec',
    );
    if (car.isDrifting) sawDrift = true;
  }

  assert.equal(sawDrift, true, 'Car should enter drift state under handbrake + steering at speed');
  assert.ok(car.driftScore > 0, 'Drift score should increment while drifting');
});

test('on-foot player can walk into an enterable house through its doorway and walk back out without sinking', () => {
  const layout = createCityLayout();
  const villa = layout.enterableHouses[0]; // Sunset Terrace Villa, door faces west (-X)
  // Start right outside the porch facing east (+X -> heading = -PI/2)
  const startY = groundHeightAt(villa.porchWorldX, villa.porchWorldZ, layout.groundSurface);
  const foot = createFootPlayerState(villa.porchWorldX, villa.porchWorldZ, -Math.PI / 2, startY);

  // Walk inside through open west doorway
  for (let i = 0; i < 120; i++) {
    stepFootPlayerPhysics(
      foot,
      { forward: true, backward: false, left: false, right: false, sprint: false },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
      layout.groundSurface,
    );
    const gY = groundHeightAt(foot.x, foot.z, layout.groundSurface);
    assert.ok(foot.y >= gY - 0.001, 'On-foot player must never sink below ground/house floor');
  }

  const inside = findHouseContainingPoint(foot.x, foot.z, layout.enterableHouses);
  assert.equal(inside?.id, villa.id, 'Player walking through doorway should arrive inside Sunset Terrace Villa');

  // Now walk backward right back outside onto the porch/sidewalk!
  for (let i = 0; i < 150; i++) {
    stepFootPlayerPhysics(
      foot,
      { forward: false, backward: true, left: false, right: false, sprint: false },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
      layout.groundSurface,
    );
  }
  const afterExit = findHouseContainingPoint(foot.x, foot.z, layout.enterableHouses);
  assert.equal(afterExit, null, 'Player should be able to walk cleanly back outside the house');
});

test('collision with building box prevents tunneling and reports impact strength', () => {
  const wall: ColliderBox = {
    id: 'test-building',
    minX: -10,
    maxX: 10,
    minZ: -10,
    maxZ: 0,
    kind: 'building',
  };
  const car = createInitialCarState(0, 12, 0);

  let hit = false;
  let maxImpact = 0;
  for (let i = 0; i < 150; i++) {
    const res = stepCarPhysics(car, { ...IDLE_INPUT, throttle: true }, 1 / 60, [wall], {
      minX: -100,
      maxX: 100,
      minZ: -100,
      maxZ: 100,
    });
    if (res.collided) {
      hit = true;
      maxImpact = Math.max(maxImpact, res.impactStrength);
    }
  }

  assert.equal(hit, true, 'Car should collide with building box');
  assert.ok(maxImpact > 0.3, `Expected strong impact feedback, got ${maxImpact}`);
  assert.ok(
    car.z >= wall.maxZ + CAR_COLLISION_RADIUS - 0.05,
    `Car must not tunnel into building (z=${car.z})`,
  );
});

test('driving onto footpath raises chassis so NO car wheel overlaps the 0.24m sidewalk', () => {
  const layout = createCityLayout();
  // Start on Pacific Blvd (x = 6.2, z = 28) facing right/east (-PI/2) toward the sidewalk edge at x = 8.15
  const car = createInitialCarState(6.2, 28, -Math.PI / 2, 0);

  for (let i = 0; i < 60; i++) {
    stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
      'grand-tourer',
      layout.groundSurface,
    );
    // Strict non-overlap check: car.y must always be >= EVERY wheel's underlying ground height!
    for (let w = 0; w < 4; w++) {
      assert.ok(
        car.y >= car.wheelGroundYs[w] - 0.001,
        `Wheel ${w} overlapped footpath at step ${i}: car.y=${car.y}, wheelGroundY=${car.wheelGroundYs[w]}`,
      );
    }
  }
  assert.ok(car.y >= 0.239, `Expected car to climb onto 0.24m footpath cleanly, got y=${car.y}`);
});

test('car cannot bypass streetlight or palm pillar colliders', () => {
  const layout = createCityLayout();
  const pillar = layout.colliders.find((c) => c.kind === 'pillar' && c.id.startsWith('streetlight-pillar-'));
  assert.ok(pillar, 'Layout must include streetlight pillar colliders');
  const cx = (pillar.minX + pillar.maxX) / 2;
  const cz = (pillar.minZ + pillar.maxZ) / 2;

  // Place car 6m south of the pillar and drive straight north (-Z) into it
  const car = createInitialCarState(cx, cz + 6, 0, groundHeightAt(cx, cz + 6, layout.groundSurface));
  let hitPillar = false;
  for (let i = 0; i < 120; i++) {
    const res = stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true },
      1 / 60,
      [pillar],
      layout.worldBounds,
      'grand-tourer',
      layout.groundSurface,
    );
    if (res.collided) hitPillar = true;
    // Car must never pass through the pillar to the north side!
    assert.ok(
      car.z >= pillar.maxZ + CAR_COLLISION_RADIUS - 0.08,
      `Car bypassed pillar at step ${i}: car.z=${car.z}, pillar.maxZ=${pillar.maxZ}`,
    );
  }
  assert.equal(hitPillar, true, 'Driving directly toward streetlight pillar must register a collision');
});
