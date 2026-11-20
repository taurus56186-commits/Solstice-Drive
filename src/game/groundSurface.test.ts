import test from 'node:test';
import assert from 'node:assert/strict';
import { createCityLayout } from './cityLayout';
import {
  groundHeightAt,
  resolveGroundContact,
  sampleVehicleSupportPlane,
} from './groundSurface';

test('groundHeightAt returns road, crosswalk, sidewalk, and house interior elevations cleanly', () => {
  const layout = createCityLayout();
  const s = layout.groundSurface;

  // Open Pacific Blvd asphalt lane
  const roadH = groundHeightAt(3.6, 27, s);
  assert.equal(roadH, 0.0);

  // Central crosswalk intersection (0, 0)
  const interH = groundHeightAt(0, 0, s);
  assert.ok(interH >= 0.02, `Crosswalk intersection should sit slightly above road, got ${interH}`);

  // Raised sidewalk block
  const sidewalkH = groundHeightAt(12, 35, s);
  assert.equal(sidewalkH, 0.24);

  // Inside Sunset Terrace Villa enterable house floor
  const villa = layout.enterableHouses[0];
  const houseH = groundHeightAt(villa.interiorCenterX, villa.interiorCenterZ, s);
  assert.ok(houseH >= villa.floorY - 0.001, `House interior floor should be >= ${villa.floorY}, got ${houseH}`);
});

test('resolveGroundContact strictly enforces y >= groundY inequality and never sinks', () => {
  // Drop from y = 0.0 with heavy downward velocity vy = -15 onto sidewalk at y = 0.24
  const contact = resolveGroundContact(0.0, -15, 0.24, 1 / 60);
  assert.ok(contact.y >= 0.24, `Entity must never sink below groundY=0.24, got ${contact.y}`);
  assert.equal(contact.vy, 0, 'Downward velocity should arrest at point of intersection');
  assert.equal(contact.grounded, true);

  // Verify sustained simulation frames never drift negative
  let y = 0.1;
  let vy = -8;
  for (let i = 0; i < 60; i++) {
    const res = resolveGroundContact(y, vy, 0.0, 1 / 60);
    y = res.y;
    vy = res.vy;
    assert.ok(y >= 0.0, `Frame ${i}: y=${y} sank below 0`);
  }
});

test('sampleVehicleSupportPlane lifts vehicle cleanly onto raised sidewalk without sinking', () => {
  const layout = createCityLayout();
  const roadSupport = sampleVehicleSupportPlane(3.6, 27, 0, layout.groundSurface);
  assert.ok(roadSupport.supportY >= 0);

  const sidewalkSupport = sampleVehicleSupportPlane(11.5, 35, 0, layout.groundSurface);
  assert.ok(
    sidewalkSupport.supportY >= 0.2,
    `Expected vehicle support plane on sidewalk >= 0.20, got ${sidewalkSupport.supportY}`,
  );
});
