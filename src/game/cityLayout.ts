import type { GroundSurfaceMap } from './groundSurface';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'building' | 'seawall' | 'house-wall' | 'pillar' | 'boundary';
}

export interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  style: 'glass-tower' | 'terracotta-modern' | 'coastal-hotel' | 'podium-office';
  accentColor: number;
  bodyColor: number;
  setbackRatio: number;
  hasRooftopCrown: boolean;
}

export interface EnterableHouseSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;  // X extent (e.g. 14m)
  depth: number;  // Z extent (e.g. 12m)
  wallHeight: number; // e.g. 4.4m
  doorFacing: 'west' | 'east' | 'north' | 'south';
  doorWidth: number;  // generous open doorway >= 3.2m
  doorHeight: number; // 3.0m
  wallColor: number;
  trimColor: number;
  roofColor: number;
  floorY: number;
  // Doorway world center & interior target for NPC visiting + HUD indicator
  doorWorldX: number;
  doorWorldZ: number;
  porchWorldX: number;
  porchWorldZ: number;
  interiorCenterX: number;
  interiorCenterZ: number;
}

export interface PedestrianRouteSpec {
  id: string;
  waypoints: Array<{ x: number; z: number; pauseSec?: number; insideHouseId?: string }>;
  speed: number;
  shirtColor: number;
  pantsColor: number;
  skinTone: number;
  hairColor: number;
  startIndex: number;
}

export interface PalmSpec {
  x: number;
  z: number;
  height: number;
  leanX: number;
  leanZ: number;
  rotY: number;
}

export interface StreetlightSpec {
  x: number;
  z: number;
  rotY: number;
  hasPointLight: boolean;
}

export interface RoadSegmentSpec {
  x: number;
  z: number;
  width: number;
  length: number;
  axis: 'ns' | 'ew';
}

export interface SidewalkBlockSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface CityLayout {
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number; heading: number };
  roads: RoadSegmentSpec[];
  intersections: Array<{ x: number; z: number; size: number }>;
  sidewalks: SidewalkBlockSpec[];
  buildings: BuildingSpec[];
  enterableHouses: EnterableHouseSpec[];
  pedestrians: PedestrianRouteSpec[];
  palms: PalmSpec[];
  streetlights: StreetlightSpec[];
  colliders: ColliderBox[];
  groundSurface: GroundSurfaceMap;
}

// Greatly expanded 320m x 360m multi-district coastal city!
export const WORLD_LIMITS = {
  minX: -84, // Oceanfront Promenade Esplanade
  maxX: 224, // East Bayview Hills Expressway
  minZ: -176,
  maxZ: 176,
};

function buildHouseWallColliders(h: EnterableHouseSpec): ColliderBox[] {
  const t = 0.42; // wall thickness
  const hw = h.width / 2;
  const hd = h.depth / 2;
  const halfDoor = h.doorWidth / 2;
  const boxes: ColliderBox[] = [];

  const minX = h.x - hw;
  const maxX = h.x + hw;
  const minZ = h.z - hd;
  const maxZ = h.z + hd;

  // North wall (z = minZ)
  if (h.doorFacing === 'north') {
    boxes.push(
      { id: `${h.id}-n-l`, minX, maxX: h.x - halfDoor, minZ, maxZ: minZ + t, kind: 'house-wall' },
      { id: `${h.id}-n-r`, minX: h.x + halfDoor, maxX, minZ, maxZ: minZ + t, kind: 'house-wall' },
    );
  } else {
    boxes.push({ id: `${h.id}-n`, minX, maxX, minZ, maxZ: minZ + t, kind: 'house-wall' });
  }

  // South wall (z = maxZ)
  if (h.doorFacing === 'south') {
    boxes.push(
      { id: `${h.id}-s-l`, minX, maxX: h.x - halfDoor, minZ: maxZ - t, maxZ, kind: 'house-wall' },
      { id: `${h.id}-s-r`, minX: h.x + halfDoor, maxX, minZ: maxZ - t, maxZ, kind: 'house-wall' },
    );
  } else {
    boxes.push({ id: `${h.id}-s`, minX, maxX, minZ: maxZ - t, maxZ, kind: 'house-wall' });
  }

  // West wall (x = minX)
  if (h.doorFacing === 'west') {
    boxes.push(
      { id: `${h.id}-w-l`, minX, maxX: minX + t, minZ, maxZ: h.z - halfDoor, kind: 'house-wall' },
      { id: `${h.id}-w-r`, minX, maxX: minX + t, minZ: h.z + halfDoor, maxZ, kind: 'house-wall' },
    );
  } else {
    boxes.push({ id: `${h.id}-w`, minX, maxX: minX + t, minZ, maxZ, kind: 'house-wall' });
  }

  // East wall (x = maxX)
  if (h.doorFacing === 'east') {
    boxes.push(
      { id: `${h.id}-e-l`, minX: maxX - t, maxX, minZ, maxZ: h.z - halfDoor, kind: 'house-wall' },
      { id: `${h.id}-e-r`, minX: maxX - t, maxX, minZ: h.z + halfDoor, maxZ, kind: 'house-wall' },
    );
  } else {
    boxes.push({ id: `${h.id}-e`, minX: maxX - t, maxX, minZ, maxZ, kind: 'house-wall' });
  }

  return boxes;
}

function makeHouseSpec(
  id: string,
  name: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  doorFacing: EnterableHouseSpec['doorFacing'],
  wallColor: number,
  trimColor: number,
  roofColor: number,
): EnterableHouseSpec {
  const hw = width / 2;
  const hd = depth / 2;
  let doorWorldX = x;
  let doorWorldZ = z;
  let porchWorldX = x;
  let porchWorldZ = z;

  if (doorFacing === 'west') {
    doorWorldX = x - hw;
    porchWorldX = x - hw - 2.6;
  } else if (doorFacing === 'east') {
    doorWorldX = x + hw;
    porchWorldX = x + hw + 2.6;
  } else if (doorFacing === 'north') {
    doorWorldZ = z - hd;
    porchWorldZ = z - hd - 2.6;
  } else {
    doorWorldZ = z + hd;
    porchWorldZ = z + hd + 2.6;
  }

  return {
    id,
    name,
    x,
    z,
    width,
    depth,
    wallHeight: 4.4,
    doorFacing,
    doorWidth: 3.4,
    doorHeight: 3.1,
    wallColor,
    trimColor,
    roofColor,
    floorY: 0.27,
    doorWorldX,
    doorWorldZ,
    porchWorldX,
    porchWorldZ,
    interiorCenterX: x,
    interiorCenterZ: z,
  };
}

export function createCityLayout(): CityLayout {
  // 5 North-South Avenues x 5 East-West Boulevards
  const nsCenters = [-72, 0, 72, 144, 212];
  const ewCenters = [-144, -72, 0, 72, 144];

  const roads: RoadSegmentSpec[] = [];
  const intersections: Array<{ x: number; z: number; size: number }> = [];

  for (const x of nsCenters) {
    roads.push({
      x,
      z: 0,
      width: x === 0 ? 16 : 14,
      length: 332,
      axis: 'ns',
    });
  }

  for (const z of ewCenters) {
    roads.push({
      x: 70,
      z,
      width: z === 0 ? 16 : 14,
      length: 300,
      axis: 'ew',
    });
  }

  for (const x of nsCenters) {
    for (const z of ewCenters) {
      const w = x === 0 || z === 0 ? 16.4 : 14.4;
      intersections.push({ x, z, size: w });
    }
  }

  // Generate 16 full city blocks between the 5x5 avenue grid
  const sidewalks: SidewalkBlockSpec[] = [];
  const xSpans: Array<[number, number]> = [
    [-65, -8],
    [8, 65],
    [79, 137],
    [151, 205],
  ];
  const zSpans: Array<[number, number]> = [
    [-137, -79],
    [-65, -8],
    [8, 65],
    [79, 137],
  ];

  for (const [x1, x2] of xSpans) {
    for (const [z1, z2] of zSpans) {
      sidewalks.push({
        x: (x1 + x2) / 2,
        z: (z1 + z2) / 2,
        width: x2 - x1 - 0.3,
        depth: z2 - z1 - 0.3,
      });
    }
  }

  // Wide Oceanfront Sunset Boardwalk west of Oceanfront Esplanade (x = -79 to -94)
  sidewalks.push({ x: -86.5, z: 0, width: 15, depth: 344 });
  // Outer north, south, east perimeter sidewalks
  sidewalks.push({ x: 70, z: -158, width: 308, depth: 12 });
  sidewalks.push({ x: 70, z: 158, width: 308, depth: 12 });
  sidewalks.push({ x: 226, z: 0, width: 12, depth: 344 });

  // --- 4 Proper Enterable Coastal Houses / Villas (open doorways facing avenues!) ---
  // Positioned right along Pacific Blvd & Solstice Ave so player & NPCs can immediately see & walk inside!
  const enterableHouses: EnterableHouseSpec[] = [
    makeHouseSpec(
      'house-sunset-villa',
      'Sunset Terrace Villa',
      18.5,
      25.0,
      15,
      13,
      'west', // Door faces Pacific Blvd directly beside spawn!
      0xead8c3,
      0x8c543e,
      0x5e3428,
    ),
    makeHouseSpec(
      'house-pacific-bungalow',
      'Pacific Breeze House',
      -18.5,
      25.0,
      15,
      13,
      'east', // Door faces Pacific Blvd across from Sunset Villa!
      0xf0e4d4,
      0x4e6c7a,
      0x3a4d5c,
    ),
    makeHouseSpec(
      'house-solstice-cafe',
      'Solstice Corner Cafe',
      -18.5,
      -19.5,
      15,
      13,
      'south', // Door faces Solstice Ave at the main intersection!
      0xe5cbb2,
      0x9e533c,
      0x4a2f2a,
    ),
    makeHouseSpec(
      'house-palm-residence',
      'Palm Grove Residence',
      89.5,
      22.0,
      15,
      13,
      'west', // Door faces Mid-Town Palm Ave in the expanded East district!
      0xdfd3c3,
      0x5d6e58,
      0x414d3d,
    ),
  ];

  // --- 32+ Multi-Story Modern Towers & Coastal Apartments across the 16 blocks ---
  const buildings: BuildingSpec[] = [];
  const styles: BuildingSpec['style'][] = [
    'glass-tower',
    'terracotta-modern',
    'coastal-hotel',
    'podium-office',
  ];
  const palettes: Record<BuildingSpec['style'], { body: number; accent: number }> = {
    'glass-tower': { body: 0x3b495e, accent: 0xffb36b },
    'terracotta-modern': { body: 0x915d4a, accent: 0xffe0b2 },
    'coastal-hotel': { body: 0xcab69e, accent: 0xff9a52 },
    'podium-office': { body: 0x4f5c6e, accent: 0x86c5d8 },
  };

  let bIdx = 0;
  for (let bx = 0; bx < xSpans.length; bx++) {
    const [x1, x2] = xSpans[bx];
    const bwSpan = x2 - x1;
    for (let bz = 0; bz < zSpans.length; bz++) {
      const [z1, z2] = zSpans[bz];
      const bdSpan = z2 - z1;

      // Two architectural buildings per city block (skipping footprints occupied by enterable houses!)
      const subCenters: Array<[number, number, number, number]> = [
        [x1 + bwSpan * 0.28, z1 + bdSpan * 0.28, 17, 17],
        [x1 + bwSpan * 0.72, z1 + bdSpan * 0.28, 17, 17],
        [x1 + bwSpan * 0.28, z1 + bdSpan * 0.72, 17, 17],
        [x1 + bwSpan * 0.72, z1 + bdSpan * 0.72, 17, 17],
      ];

      // Pick 2-3 sub-plots per block so city feels lush, airy, and varied (not cramped solid walls)
      for (let s = 0; s < subCenters.length; s++) {
        // Leave inner courtyard/garden pocket on one corner per block
        if ((bx + bz + s) % 4 === 3) continue;

        const [cx, cz, w, d] = subCenters[s];

        // Ensure zero overlap with any enterable house + its front porch clearance
        let overlapsHouse = false;
        for (const h of enterableHouses) {
          if (
            Math.abs(cx - h.x) < (w + h.width) / 2 + 5.5 &&
            Math.abs(cz - h.z) < (d + h.depth) / 2 + 5.5
          ) {
            overlapsHouse = true;
            break;
          }
        }
        if (overlapsHouse) continue;

        const style = styles[(bIdx * 3 + bx + bz) % styles.length];
        const pal = palettes[style];
        // Coastal stepping: lower coastal boutique hotels near the ocean (bx === 0), taller modern skyscrapers inland!
        const baseH = bx === 0 ? 18 : bx === 1 ? 28 : bx === 2 ? 36 : 30;
        const height = baseH + ((bIdx * 7) % 18);

        buildings.push({
          id: `bldg-${bx}-${bz}-${s}`,
          x: cx,
          z: cz,
          width: w,
          depth: d,
          height,
          style,
          bodyColor: pal.body,
          accentColor: pal.accent,
          setbackRatio: height > 26 ? 0.68 : 0,
          hasRooftopCrown: height > 30,
        });
        bIdx++;
      }
    }
  }

  // --- Palm Trees across the entire expanded coastal district ---
  const palms: PalmSpec[] = [];
  let pSeed = 1;
  const addPalm = (x: number, z: number) => {
    // Never place a palm inside a house porch or doorway
    for (const h of enterableHouses) {
      if (Math.hypot(x - h.doorWorldX, z - h.doorWorldZ) < 6.5) return;
      if (Math.abs(x - h.x) < h.width / 2 + 2 && Math.abs(z - h.z) < h.depth / 2 + 2) return;
    }
    const hgt = 7.4 + ((pSeed * 13) % 10) * 0.28;
    const ang = (pSeed * 1.618) % (Math.PI * 2);
    palms.push({
      x,
      z,
      height: hgt,
      leanX: Math.cos(ang) * 0.55,
      leanZ: Math.sin(ang) * 0.55,
      rotY: ang,
    });
    pSeed++;
  };

  // Iconic Oceanfront Promenade Palm Row (x = -82)
  for (let z = -150; z <= 150; z += 18) {
    addPalm(-82.5, z);
  }
  // Along Pacific Blvd & Mid-Town Palm Ave
  for (const roadX of [0, 72]) {
    const offset = roadX === 0 ? 10.2 : 9.2;
    for (let z = -126; z <= 126; z += 24) {
      if (Math.abs(z % 72) < 12) continue;
      addPalm(roadX - offset, z);
      addPalm(roadX + offset, z);
    }
  }
  // Along Solstice Ave
  for (let x = -56; x <= 194; x += 26) {
    if (Math.abs(x % 72) < 12) continue;
    addPalm(x, -10.2);
    addPalm(x, 10.2);
  }

  // --- Streetlights (strictly cap active PointLights at 4 around main intersection) ---
  const streetlights: StreetlightSpec[] = [
    // Central (0,0) intersection corners — active warm amber point lights
    { x: -9.5, z: -9.5, rotY: Math.PI * 0.25, hasPointLight: true },
    { x: 9.5, z: -9.5, rotY: -Math.PI * 0.25, hasPointLight: true },
    { x: -9.5, z: 9.5, rotY: Math.PI * 0.75, hasPointLight: true },
    { x: 9.5, z: 9.5, rotY: -Math.PI * 0.75, hasPointLight: true },
  ];

  // Additional emissive streetlights along avenues (zero extra point light cost!)
  for (const z of [-108, -42, 42, 108]) {
    streetlights.push({ x: -9.5, z, rotY: Math.PI * 0.5, hasPointLight: false });
    streetlights.push({ x: 9.5, z, rotY: -Math.PI * 0.5, hasPointLight: false });
    streetlights.push({ x: 63.5, z, rotY: Math.PI * 0.5, hasPointLight: false });
    streetlights.push({ x: 80.5, z, rotY: -Math.PI * 0.5, hasPointLight: false });
  }
  for (const x of [-42, 42, 108, 174]) {
    streetlights.push({ x, z: -9.5, rotY: 0, hasPointLight: false });
    streetlights.push({ x, z: 9.5, rotY: Math.PI, hasPointLight: false });
  }
  for (const z of [-120, -60, 0, 60, 120]) {
    streetlights.push({ x: -80.5, z, rotY: Math.PI * 0.5, hasPointLight: false });
  }

  // --- Lively Walking Pedestrians (Sidewalk loops, Crosswalk crossings, AND Entering/Exiting Houses!) ---
  const shirtPalette = [0xe8613c, 0x3b8ea5, 0xf2b84b, 0x5c946e, 0xd46a8c, 0xf2ede4, 0x6f58c9, 0xd98348];
  const pantsPalette = [0x2a3242, 0x3b3532, 0x1e2430, 0x594a3c, 0x2f4152];
  const skinPalette = [0xf2c6a0, 0xd99e73, 0xb87c54, 0x8a583b, 0xe8b58f];
  const hairPalette = [0x1f1918, 0x4a3122, 0x7a5436, 0x292423, 0x997349];

  const pedestrians: PedestrianRouteSpec[] = [];
  let pedIdx = 0;
  const pushPed = (
    waypoints: PedestrianRouteSpec['waypoints'],
    speed: number,
    startIndex = 0,
  ) => {
    pedestrians.push({
      id: `ped-${pedIdx}`,
      waypoints,
      speed,
      shirtColor: shirtPalette[pedIdx % shirtPalette.length],
      pantsColor: pantsPalette[pedIdx % pantsPalette.length],
      skinTone: skinPalette[pedIdx % skinPalette.length],
      hairColor: hairPalette[pedIdx % hairPalette.length],
      startIndex: startIndex % waypoints.length,
    });
    pedIdx++;
  };

  // 1) House-entering & house-exiting residents/visitors (2 per enterable house = 8 lively home visitors!)
  for (const h of enterableHouses) {
    // Determine sidewalk approach point outside the porch
    let streetX = h.porchWorldX;
    let streetZ = h.porchWorldZ;
    let strollX = streetX;
    let strollZ = streetZ;
    if (h.doorFacing === 'west') {
      streetX = h.x - h.width / 2 - 2.2;
      strollX = streetX;
      strollZ = h.z + 18;
    } else if (h.doorFacing === 'east') {
      streetX = h.x + h.width / 2 + 2.2;
      strollX = streetX;
      strollZ = h.z - 18;
    } else if (h.doorFacing === 'south') {
      streetZ = h.z + h.depth / 2 + 2.2;
      strollX = h.x - 18;
      strollZ = streetZ;
    } else {
      streetZ = h.z - h.depth / 2 - 2.2;
      strollX = h.x + 18;
      strollZ = streetZ;
    }

    // Resident A: walks along sidewalk -> approaches porch -> enters doorway -> pauses inside -> exits back outside!
    pushPed(
      [
        { x: strollX, z: strollZ, pauseSec: 1.0 },
        { x: streetX, z: streetZ },
        { x: h.doorWorldX, z: h.doorWorldZ },
        { x: h.interiorCenterX, z: h.interiorCenterZ, pauseSec: 3.5, insideHouseId: h.id },
        { x: h.doorWorldX, z: h.doorWorldZ },
        { x: streetX, z: streetZ },
      ],
      1.65,
      0,
    );

    // Resident B: starts inside the house -> exits onto street -> strolls -> returns inside!
    pushPed(
      [
        { x: h.interiorCenterX + (h.doorFacing === 'west' ? 1.5 : -1.5), z: h.interiorCenterZ + 1.2, pauseSec: 2.2, insideHouseId: h.id },
        { x: h.doorWorldX, z: h.doorWorldZ },
        { x: streetX, z: streetZ },
        { x: strollX, z: strollZ, pauseSec: 1.5 },
        { x: streetX, z: streetZ },
        { x: h.doorWorldX, z: h.doorWorldZ },
      ],
      1.55,
      0,
    );
  }

  // 2) Main Central Intersection Crosswalk & Sidewalk Hustle (14 pedestrians around Pacific Blvd & Solstice Ave)
  const centralLoops: Array<Array<{ x: number; z: number; pauseSec?: number }>> = [
    // Crossing North-South & East-West crosswalks around (0, 0)
    [
      { x: 10.5, z: 10.5 },
      { x: 10.5, z: -10.5 },
      { x: -10.5, z: -10.5 },
      { x: -10.5, z: 10.5 },
    ],
    // Pacific Blvd East sidewalk stroll
    [
      { x: 9.8, z: 54 },
      { x: 9.8, z: 11 },
      { x: 9.8, z: -11 },
      { x: 9.8, z: -54 },
      { x: 11.4, z: -54 },
      { x: 11.4, z: 54 },
    ],
    // Pacific Blvd West sidewalk stroll
    [
      { x: -9.8, z: -54 },
      { x: -9.8, z: -11 },
      { x: -9.8, z: 11 },
      { x: -9.8, z: 54 },
      { x: -11.4, z: 54 },
      { x: -11.4, z: -54 },
    ],
    // Solstice Ave North & South sidewalk bustle
    [
      { x: -56, z: -10.4 },
      { x: 56, z: -10.4 },
      { x: 56, z: 10.4 },
      { x: -56, z: 10.4 },
    ],
    // Oceanfront Sunset Boardwalk walkers
    [
      { x: -84, z: -90 },
      { x: -84, z: 90 },
      { x: -87.5, z: 90 },
      { x: -87.5, z: -90 },
    ],
    // Expanded East District Mid-Town Palm Ave loop
    [
      { x: 63, z: -56 },
      { x: 63, z: 56 },
      { x: 81, z: 56 },
      { x: 81, z: -56 },
    ],
    // Expanded East-South Neighborhood loop
    [
      { x: 82, z: 10.4 },
      { x: 134, z: 10.4 },
      { x: 134, z: 62 },
      { x: 82, z: 62 },
    ],
  ];

  for (const loop of centralLoops) {
    // Place 3 pedestrians spaced along each loop so sidewalks feel genuinely lively!
    for (let k = 0; k < 3; k++) {
      pushPed(loop, 1.45 + ((k + pedIdx) % 4) * 0.18, k);
    }
  }

  // --- Build Colliders (Towers + Per-Wall House Colliders with OPEN Doorways + Ocean Seawall) ---
  const colliders: ColliderBox[] = buildings.map((b) => ({
    id: b.id,
    minX: b.x - b.width / 2 - 0.3,
    maxX: b.x + b.width / 2 + 0.3,
    minZ: b.z - b.depth / 2 - 0.3,
    maxZ: b.z + b.depth / 2 + 0.3,
    kind: 'building',
  }));

  for (const h of enterableHouses) {
    colliders.push(...buildHouseWallColliders(h));
    // Add solid colliders for the 2 porch columns flanking each house entrance (doorway center stays wide open!)
    const colOffset = h.doorWidth / 2 + 1.25;
    const porchDist = 1.15;
    const colR = 0.22;
    const porchCols: Array<[number, number]> =
      h.doorFacing === 'west'
        ? [
            [h.x - h.width / 2 - porchDist, h.z - colOffset],
            [h.x - h.width / 2 - porchDist, h.z + colOffset],
          ]
        : h.doorFacing === 'east'
          ? [
              [h.x + h.width / 2 + porchDist, h.z - colOffset],
              [h.x + h.width / 2 + porchDist, h.z + colOffset],
            ]
          : h.doorFacing === 'south'
            ? [
                [h.x - colOffset, h.z + h.depth / 2 + porchDist],
                [h.x + colOffset, h.z + h.depth / 2 + porchDist],
              ]
            : [
                [h.x - colOffset, h.z - h.depth / 2 - porchDist],
                [h.x + colOffset, h.z - h.depth / 2 - porchDist],
              ];
    porchCols.forEach(([cx, cz], idx) => {
      colliders.push({
        id: `${h.id}-porch-pillar-${idx}`,
        minX: cx - colR,
        maxX: cx + colR,
        minZ: cz - colR,
        maxZ: cz + colR,
        kind: 'pillar',
      });
    });
  }

  // Solid pillar colliders for every streetlight pole so the car never bypasses streetlight pillars
  streetlights.forEach((sl, idx) => {
    const r = 0.34;
    colliders.push({
      id: `streetlight-pillar-${idx}`,
      minX: sl.x - r,
      maxX: sl.x + r,
      minZ: sl.z - r,
      maxZ: sl.z + r,
      kind: 'pillar',
    });
  });

  // Solid colliders for every palm planter base & trunk so the car collides cleanly with palms
  palms.forEach((p, idx) => {
    const r = 0.92;
    colliders.push({
      id: `palm-pillar-${idx}`,
      minX: p.x - r,
      maxX: p.x + r,
      minZ: p.z - r,
      maxZ: p.z + r,
      kind: 'pillar',
    });
  });

  // Seawall barrier protecting ocean dropoff along boardwalk edge
  colliders.push({
    id: 'ocean-seawall',
    minX: -115,
    maxX: -92.5,
    minZ: -190,
    maxZ: 190,
    kind: 'seawall',
  });

  // --- Build Analytical Ground Surface Map for Strict Non-Sinking y >= groundY Math ---
  const groundSurface: GroundSurfaceMap = {
    baseRoadHeight: 0.0,
    intersections: intersections.map((inter) => ({
      minX: inter.x - inter.size / 2,
      maxX: inter.x + inter.size / 2,
      minZ: inter.z - inter.size / 2,
      maxZ: inter.z + inter.size / 2,
      height: 0.022,
    })),
    sidewalks: sidewalks.map((sw) => ({
      minX: sw.x - sw.width / 2,
      maxX: sw.x + sw.width / 2,
      minZ: sw.z - sw.depth / 2,
      maxZ: sw.z + sw.depth / 2,
      height: 0.24,
      rampMargin: 0.45, // smooth curb climb so car wheels roll up onto sidewalks cleanly!
    })),
    houseFloors: enterableHouses.map((h) => ({
      minX: h.x - h.width / 2,
      maxX: h.x + h.width / 2,
      minZ: h.z - h.depth / 2,
      maxZ: h.z + h.depth / 2,
      height: h.floorY,
      rampMargin: 0.35,
    })),
  };

  return {
    worldBounds: WORLD_LIMITS,
    // Spawn on Pacific Blvd northbound lane, right beside Sunset Terrace Villa & facing the bustling central intersection!
    spawn: { x: 3.6, z: 27, heading: 0 },
    roads,
    intersections,
    sidewalks,
    buildings,
    enterableHouses,
    pedestrians,
    palms,
    streetlights,
    colliders,
    groundSurface,
  };
}

/** Checks if a circle (x, z, radius) overlaps any static collider */
export function overlapsAnyCollider(
  x: number,
  z: number,
  radius: number,
  colliders: ColliderBox[],
): boolean {
  for (const box of colliders) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }
  return false;
}

/** Returns the EnterableHouseSpec if world point (x, z) is inside its interior footprint, else null */
export function findHouseContainingPoint(
  x: number,
  z: number,
  houses: EnterableHouseSpec[],
): EnterableHouseSpec | null {
  for (const h of houses) {
    const pad = 0.25;
    if (
      x > h.x - h.width / 2 + pad &&
      x < h.x + h.width / 2 - pad &&
      z > h.z - h.depth / 2 + pad &&
      z < h.z + h.depth / 2 - pad
    ) {
      return h;
    }
  }
  return null;
}
