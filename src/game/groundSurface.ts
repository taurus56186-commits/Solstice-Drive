/**
 * Analytical Ground Surface & Point-of-Intersection Anti-Sinking Math
 *
 * Guarantees strict non-penetration inequality:
 *   y(t) >= groundHeightAt(x, z)
 * at every point of intersection (road, crosswalk, raised sidewalk, driveway ramp,
 * and enterable house interior floors).
 */

export interface GroundRegion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  rampMargin?: number; // smooth bevel transition at curb edge
}

export interface GroundSurfaceMap {
  baseRoadHeight: number;
  intersections: GroundRegion[];
  sidewalks: GroundRegion[];
  houseFloors: GroundRegion[];
}

export interface VerticalContactState {
  y: number;
  vy: number;
  grounded: boolean;
  groundY: number;
}

/**
 * Evaluates smooth elevation contribution of a rectangular elevated pad
 * with an optional curb ramp along its perimeter so vehicles climb smoothly
 * without clipping or sinking into sidewalks.
 */
function sampleRegionHeight(x: number, z: number, region: GroundRegion): number {
  const margin = region.rampMargin ?? 0;
  if (
    x < region.minX - margin ||
    x > region.maxX + margin ||
    z < region.minZ - margin ||
    z > region.maxZ + margin
  ) {
    return 0;
  }
  if (margin <= 0) {
    return region.height;
  }
  const dx = Math.max(0, region.minX - x, x - region.maxX);
  const dz = Math.max(0, region.minZ - z, z - region.maxZ);
  const edgeDist = Math.hypot(dx, dz);
  if (edgeDist <= 0) return region.height;
  if (edgeDist >= margin) return 0;
  const t = 1 - edgeDist / margin;
  return region.height * t;
}

/**
 * Computes exact surface height at world point (x, z) by taking the upper envelope
 * (point of intersection) of all ground layers: road, crosswalks, sidewalks, and house floors.
 */
export function groundHeightAt(x: number, z: number, surface: GroundSurfaceMap): number {
  let maxY = surface.baseRoadHeight;

  for (let i = 0; i < surface.intersections.length; i++) {
    const r = surface.intersections[i];
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      if (r.height > maxY) maxY = r.height;
    }
  }

  for (let i = 0; i < surface.sidewalks.length; i++) {
    const h = sampleRegionHeight(x, z, surface.sidewalks[i]);
    if (h > maxY) maxY = h;
  }

  for (let i = 0; i < surface.houseFloors.length; i++) {
    const h = sampleRegionHeight(x, z, surface.houseFloors[i]);
    if (h > maxY) maxY = h;
  }

  return maxY;
}

/**
 * Samples the 4 wheel contact points + chassis center to find the exact support plane
 * height and natural pitch/roll slope across curbs and ramps.
 */
export function sampleVehicleSupportPlane(
  x: number,
  z: number,
  heading: number,
  surface: GroundSurfaceMap,
): { supportY: number; slopePitch: number; slopeRoll: number; wheelGroundYs: [number, number, number, number] } {
  const fwdX = -Math.sin(heading);
  const fwdZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);

  const halfWheelbase = 1.36;
  const halfTrack = 0.96;

  const yFL = groundHeightAt(x + fwdX * halfWheelbase - rightX * halfTrack, z + fwdZ * halfWheelbase - rightZ * halfTrack, surface);
  const yFR = groundHeightAt(x + fwdX * halfWheelbase + rightX * halfTrack, z + fwdZ * halfWheelbase + rightZ * halfTrack, surface);
  const yRL = groundHeightAt(x - fwdX * halfWheelbase - rightX * halfTrack, z - fwdZ * halfWheelbase - rightZ * halfTrack, surface);
  const yRR = groundHeightAt(x - fwdX * halfWheelbase + rightX * halfTrack, z - fwdZ * halfWheelbase + rightZ * halfTrack, surface);
  const yC = groundHeightAt(x, z, surface);

  // Strict non-overlap equation at every point of intersection:
  // chassis & wheel plane y >= max(center, FL, FR, RL, RR) so NO wheel ever intersects or sinks into the footpath!
  const supportY = Math.max(yC, yFL, yFR, yRL, yRR);

  const frontAvg = (yFL + yFR) * 0.5;
  const rearAvg = (yRL + yRR) * 0.5;
  const leftAvg = (yFL + yRL) * 0.5;
  const rightAvg = (yFR + yRR) * 0.5;

  const slopePitch = Math.atan2(frontAvg - rearAvg, halfWheelbase * 2);
  const slopeRoll = Math.atan2(leftAvg - rightAvg, halfTrack * 2);

  return { supportY, slopePitch, slopeRoll, wheelGroundYs: [yFL, yFR, yRL, yRR] };
}

/**
 * Strict inequality ground contact solver (y >= groundY at point of intersection).
 * Prevents any entity (car, player, pedestrian) from ever sinking below the ground plane.
 */
export function resolveGroundContact(
  currentY: number,
  currentVy: number,
  groundY: number,
  dt: number,
  gravity = 24,
): VerticalContactState {
  // Predict vertical step under gravity
  let nextVy = currentVy - gravity * dt;
  let nextY = currentY + nextVy * dt;

  // Enforce strict point-of-intersection inequality: y >= groundY
  if (nextY <= groundY) {
    nextY = groundY;
    if (nextVy < 0) {
      nextVy = 0;
    }
    return {
      y: nextY,
      vy: nextVy,
      grounded: true,
      groundY,
    };
  }

  return {
    y: nextY,
    vy: nextVy,
    grounded: false,
    groundY,
  };
}
