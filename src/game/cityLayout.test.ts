import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCityLayout,
  findHouseContainingPoint,
  overlapsAnyCollider,
} from './cityLayout';
import { CAR_COLLISION_RADIUS, FOOT_COLLISION_RADIUS } from './carPhysics';

test('expanded city layout spans > 300m and spawns player on open lane with clear sightline', () => {
  const layout = createCityLayout();
  const widthX = layout.worldBounds.maxX - layout.worldBounds.minX;
  const depthZ = layout.worldBounds.maxZ - layout.worldBounds.minZ;
  assert.ok(widthX >= 300, `Expected expanded city width >= 300m, got ${widthX}`);
  assert.ok(depthZ >= 340, `Expected expanded city depth >= 340m, got ${depthZ}`);

  assert.equal(
    overlapsAnyCollider(layout.spawn.x, layout.spawn.z, CAR_COLLISION_RADIUS + 2.0, layout.colliders),
    false,
    'Player spawn must not overlap any building or seawall collider',
  );

  for (let z = layout.spawn.z; z >= -20; z -= 2) {
    assert.equal(
      overlapsAnyCollider(layout.spawn.x, z, CAR_COLLISION_RADIUS, layout.colliders),
      false,
      `Forward path at z=${z} should be unobstructed`,
    );
  }
});

test('enterable houses have open passable doorways and enclosed interior spaces', () => {
  const layout = createCityLayout();
  assert.ok(layout.enterableHouses.length >= 4, 'Should have at least 4 enterable houses');

  for (const h of layout.enterableHouses) {
    // Center of doorway MUST be unobstructed for walking in & out!
    assert.equal(
      overlapsAnyCollider(h.doorWorldX, h.doorWorldZ, FOOT_COLLISION_RADIUS, layout.colliders),
      false,
      `House ${h.id} doorway (${h.doorWorldX}, ${h.doorWorldZ}) must be passable`,
    );
    // Interior center MUST be unobstructed AND recognized as inside the house!
    assert.equal(
      overlapsAnyCollider(h.interiorCenterX, h.interiorCenterZ, FOOT_COLLISION_RADIUS, layout.colliders),
      false,
      `House ${h.id} interior center must be unobstructed`,
    );
    const detected = findHouseContainingPoint(
      h.interiorCenterX,
      h.interiorCenterZ,
      layout.enterableHouses,
    );
    assert.equal(detected?.id, h.id, `Point inside ${h.id} should be detected as inside`);
  }
});

test('city has lively pedestrians including house visitors and stays within active light budget', () => {
  const layout = createCityLayout();
  assert.ok(layout.buildings.length >= 25, `Expected >= 25 buildings in expanded city, got ${layout.buildings.length}`);
  assert.ok(layout.pedestrians.length >= 25, `Expected >= 25 lively pedestrians, got ${layout.pedestrians.length}`);
  assert.ok(
    layout.pedestrians.some((p) => p.waypoints.some((w) => Boolean(w.insideHouseId))),
    'Some pedestrians must enter and exit enterable houses',
  );
  const activePointLights = layout.streetlights.filter((s) => s.hasPointLight);
  assert.ok(activePointLights.length <= 6, 'Active point lights should stay within performance budget');
});
