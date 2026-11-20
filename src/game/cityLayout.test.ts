import test from 'node:test';
import assert from 'node:assert/strict';
import { createCityLayout, overlapsAnyCollider } from './cityLayout';
import { CAR_COLLISION_RADIUS } from './carPhysics';

test('city layout spawns player on open lane with generous clearance', () => {
  const layout = createCityLayout();
  assert.equal(
    overlapsAnyCollider(layout.spawn.x, layout.spawn.z, CAR_COLLISION_RADIUS + 2.0, layout.colliders),
    false,
    'Player spawn must not overlap any building or seawall collider',
  );
  // Verify clear forward corridor from spawn all the way through the central intersection
  for (let z = layout.spawn.z; z >= -20; z -= 2) {
    assert.equal(
      overlapsAnyCollider(layout.spawn.x, z, CAR_COLLISION_RADIUS, layout.colliders),
      false,
      `Forward path at z=${z} should be unobstructed`,
    );
  }
});

test('city layout contains buildings, palms, streetlights, and seawall barrier', () => {
  const layout = createCityLayout();
  assert.ok(layout.buildings.length >= 8, 'Should have multi-story buildings framing the district');
  assert.ok(layout.palms.length >= 20, 'Should have palm trees along avenues and oceanfront');
  assert.ok(layout.streetlights.length >= 8, 'Should have streetlights');
  const activePointLights = layout.streetlights.filter((s) => s.hasPointLight);
  assert.ok(activePointLights.length <= 6, 'Active point lights should stay within performance budget');
  assert.ok(
    layout.colliders.some((c) => c.kind === 'seawall'),
    'Seawall barrier should protect the coastline',
  );
});
