import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_COLLISION_RADIUS,
  computeGearAndRpm,
  createInitialCarState,
  stepCarPhysics,
  type CarInput,
} from './carPhysics';
import { createCityLayout, type ColliderBox } from './cityLayout';

const IDLE_INPUT: CarInput = {
  throttle: false,
  brakeReverse: false,
  steerLeft: false,
  steerRight: false,
  handbrake: false,
};

test('car accelerates smoothly, spins wheels, and updates top speed and odometer', () => {
  const layout = createCityLayout();
  const car = createInitialCarState(layout.spawn.x, layout.spawn.z, layout.spawn.heading);

  for (let i = 0; i < 90; i++) {
    stepCarPhysics(car, { ...IDLE_INPUT, throttle: true }, 1 / 60, layout.colliders, layout.worldBounds);
  }

  assert.ok(car.speedKmh > 60, `Expected car to exceed 60 km/h after 1.5s, got ${car.speedKmh.toFixed(1)}`);
  assert.ok(car.z < layout.spawn.z - 15, 'Car facing heading=0 (-Z) should travel north');
  assert.ok(car.wheelSpin > 20, 'Wheels should accumulate forward spin');
  assert.ok(car.distanceMeters > 15, 'Odometer should track distance');
});

test('steering turns front wheels and changes heading; braking reverses from stop', () => {
  const layout = createCityLayout();
  const car = createInitialCarState(layout.spawn.x, layout.spawn.z, layout.spawn.heading);

  // Accelerate + turn left
  for (let i = 0; i < 60; i++) {
    stepCarPhysics(
      car,
      { ...IDLE_INPUT, throttle: true, steerLeft: true },
      1 / 60,
      layout.colliders,
      layout.worldBounds,
    );
  }
  assert.ok(car.steerAngle > 0.25, 'Front wheels should turn left (+angle)');
  assert.ok(car.heading > 0.3, 'Car heading should rotate left');

  // Fresh car at rest should reverse when S/Down is held
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

  // Build speed first
  for (let i = 0; i < 90; i++) {
    stepCarPhysics(car, { ...IDLE_INPUT, throttle: true }, 1 / 60, [], layout.worldBounds, 'drift-spec');
  }
  // Initiate handbrake drift turn
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
