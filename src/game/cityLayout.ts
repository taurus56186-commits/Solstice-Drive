export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'building' | 'seawall' | 'planter' | 'boundary';
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
  setbackRatio: number; // 0 = flat roof, >0 = upper stepped tower
  hasRooftopCrown: boolean;
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
  rotY: number; // arm direction
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
  spawn: { x: number; z: number; heading: number }; // heading 0 = facing -Z (North)
  roads: RoadSegmentSpec[];
  intersections: Array<{ x: number; z: number; size: number }>;
  sidewalks: SidewalkBlockSpec[];
  buildings: BuildingSpec[];
  palms: PalmSpec[];
  streetlights: StreetlightSpec[];
  colliders: ColliderBox[];
}

export const WORLD_LIMITS = {
  minX: -48, // Seawall promenade edge along Oceanfront Esplanade
  maxX: 74,
  minZ: -74,
  maxZ: 74,
};

export function createCityLayout(): CityLayout {
  const roads: RoadSegmentSpec[] = [
    // Primary Pacific Blvd (North-South through central intersection)
    { x: 0, z: 0, width: 16, length: 146, axis: 'ns' },
    // Primary Solstice Ave (East-West through central intersection)
    { x: 14, z: 0, width: 16, length: 120, axis: 'ew' },
    // Oceanfront Esplanade (North-South coastal road)
    { x: -38, z: 0, width: 14, length: 146, axis: 'ns' },
    // East Bayview Ave (North-South)
    { x: 62, z: 0, width: 14, length: 146, axis: 'ns' },
    // North Marina St (East-West)
    { x: 12, z: -62, width: 14, length: 114, axis: 'ew' },
    // South Harbor St (East-West)
    { x: 12, z: 62, width: 14, length: 114, axis: 'ew' },
  ];

  const intersections = [
    { x: 0, z: 0, size: 16.4 },
    { x: -38, z: 0, size: 16.4 },
    { x: 62, z: 0, size: 16.4 },
    { x: 0, z: -62, size: 16.4 },
    { x: 0, z: 62, size: 16.4 },
    { x: -38, z: -62, size: 15.2 },
    { x: -38, z: 62, size: 15.2 },
    { x: 62, z: -62, size: 15.2 },
    { x: 62, z: 62, size: 15.2 },
  ];

  // Four main city blocks framing the central (0,0) intersection
  // West blocks: x in [-31, -8] => center x = -19.5, width = 23
  // East blocks: x in [8, 55] => center x = 31.5, width = 47
  // North blocks: z in [-55, -8] => center z = -31.5, depth = 47
  // South blocks: z in [8, 55] => center z = 31.5, depth = 47
  const sidewalks: SidewalkBlockSpec[] = [
    { x: -19.5, z: -31.5, width: 22.8, depth: 46.8 }, // NW Coastal Plaza block
    { x: -19.5, z: 31.5, width: 22.8, depth: 46.8 },  // SW Coastal Hotel block
    { x: 31.5, z: -31.5, width: 46.8, depth: 46.8 },  // NE Downtown Towers block
    { x: 31.5, z: 31.5, width: 46.8, depth: 46.8 },   // SE Contemporary Midrise block
    // Oceanfront boardwalk promenade west of Oceanfront Esplanade (x = -45 to -55)
    { x: -50.5, z: 0, width: 11.0, depth: 156 },
    // Outer north/south/east sidewalk fringes
    { x: 12, z: -73.5, width: 128, depth: 9 },
    { x: 12, z: 73.5, width: 128, depth: 9 },
    { x: 74, z: 0, width: 10, depth: 156 },
  ];

  const buildings: BuildingSpec[] = [
    // --- NE BLOCK (Hero skyline visible straight ahead from spawn!) ---
    {
      id: 'ne-solstice-spire',
      x: 20,
      z: -21,
      width: 17,
      depth: 17,
      height: 44,
      style: 'glass-tower',
      bodyColor: 0x3b485c,
      accentColor: 0xffb36b,
      setbackRatio: 0.68,
      hasRooftopCrown: true,
    },
    {
      id: 'ne-amber-residences',
      x: 42,
      z: -20,
      width: 17,
      depth: 16,
      height: 30,
      style: 'terracotta-modern',
      bodyColor: 0x8e5c4a,
      accentColor: 0xffe0b2,
      setbackRatio: 0.72,
      hasRooftopCrown: false,
    },
    {
      id: 'ne-marina-office',
      x: 22,
      z: -43,
      width: 19,
      depth: 16,
      height: 36,
      style: 'podium-office',
      bodyColor: 0x515d6e,
      accentColor: 0x87c5d8,
      setbackRatio: 0.75,
      hasRooftopCrown: true,
    },
    {
      id: 'ne-horizon-lofts',
      x: 43,
      z: -42,
      width: 16,
      depth: 17,
      height: 24,
      style: 'coastal-hotel',
      bodyColor: 0xc9b59e,
      accentColor: 0xff9a52,
      setbackRatio: 0,
      hasRooftopCrown: false,
    },

    // --- NW BLOCK (Coastal boutique midrises — lower toward ocean so sunset pours in!) ---
    {
      id: 'nw-pacific-hotel',
      x: -19.5,
      z: -21,
      width: 15,
      depth: 17,
      height: 22,
      style: 'coastal-hotel',
      bodyColor: 0xd8c3aa,
      accentColor: 0xff9e66,
      setbackRatio: 0.78,
      hasRooftopCrown: false,
    },
    {
      id: 'nw-wave-pavilion',
      x: -19.5,
      z: -42,
      width: 15,
      depth: 16,
      height: 18,
      style: 'glass-tower',
      bodyColor: 0x45586d,
      accentColor: 0xffc47d,
      setbackRatio: 0,
      hasRooftopCrown: true,
    },

    // --- SE BLOCK ---
    {
      id: 'se-sunset-plaza',
      x: 20,
      z: 21,
      width: 17,
      depth: 17,
      height: 32,
      style: 'podium-office',
      bodyColor: 0x4a5568,
      accentColor: 0xffad66,
      setbackRatio: 0.7,
      hasRooftopCrown: true,
    },
    {
      id: 'se-coral-condos',
      x: 42,
      z: 22,
      width: 17,
      depth: 17,
      height: 26,
      style: 'terracotta-modern',
      bodyColor: 0x9b6856,
      accentColor: 0xffd7a8,
      setbackRatio: 0.74,
      hasRooftopCrown: false,
    },
    {
      id: 'se-bayview-center',
      x: 31,
      z: 43,
      width: 34,
      depth: 15,
      height: 21,
      style: 'coastal-hotel',
      bodyColor: 0xc2b09b,
      accentColor: 0x6ec5cf,
      setbackRatio: 0.62,
      hasRooftopCrown: false,
    },

    // --- SW BLOCK ---
    {
      id: 'sw-palms-boutique',
      x: -19.5,
      z: 21,
      width: 15,
      depth: 16,
      height: 19,
      style: 'terracotta-modern',
      bodyColor: 0xb67b62,
      accentColor: 0xffe2ba,
      setbackRatio: 0.8,
      hasRooftopCrown: false,
    },
    {
      id: 'sw-harbor-house',
      x: -19.5,
      z: 42,
      width: 15,
      depth: 16,
      height: 25,
      style: 'glass-tower',
      bodyColor: 0x3f4e63,
      accentColor: 0xffb36b,
      setbackRatio: 0.7,
      hasRooftopCrown: true,
    },
  ];

  // Deterministic palm tree placement along sidewalks & oceanfront boardwalk
  const palms: PalmSpec[] = [];
  const addPalm = (x: number, z: number, seed: number) => {
    const h = 7.4 + ((seed * 17) % 10) * 0.28;
    const angle = (seed * 1.618) % (Math.PI * 2);
    palms.push({
      x,
      z,
      height: h,
      leanX: Math.cos(angle) * 0.55,
      leanZ: Math.sin(angle) * 0.55,
      rotY: angle,
    });
  };

  let palmSeed = 1;
  // Oceanfront boardwalk palm promenade (iconic golden-hour coastal silhouette)
  for (let z = -66; z <= 66; z += 13) {
    addPalm(-47.5, z, palmSeed++);
  }
  // Along Pacific Blvd sidewalks (flanking the central intersection)
  for (const z of [-48, -32, -14, 14, 32, 48]) {
    addPalm(-10.2, z, palmSeed++);
    addPalm(10.2, z, palmSeed++);
  }
  // Along Solstice Ave east-west sidewalks
  for (const x of [-25, 22, 38, 51]) {
    addPalm(x, -10.2, palmSeed++);
    addPalm(x, 10.2, palmSeed++);
  }

  // Architectural streetlights around the main intersection & avenues
  // Cap active unshadowed PointLights to 4 at the central intersection corners!
  const streetlights: StreetlightSpec[] = [
    // Central 4-way intersection corners (4 warm amber point lights)
    { x: -9.4, z: -9.4, rotY: Math.PI * 0.25, hasPointLight: true },
    { x: 9.4, z: -9.4, rotY: -Math.PI * 0.25, hasPointLight: true },
    { x: -9.4, z: 9.4, rotY: Math.PI * 0.75, hasPointLight: true },
    { x: 9.4, z: 9.4, rotY: -Math.PI * 0.75, hasPointLight: true },
    // Pacific Blvd mid-block poles (emissive glow fixtures, zero extra point light cost)
    { x: -9.4, z: -36, rotY: Math.PI * 0.5, hasPointLight: false },
    { x: 9.4, z: -36, rotY: -Math.PI * 0.5, hasPointLight: false },
    { x: -9.4, z: 36, rotY: Math.PI * 0.5, hasPointLight: false },
    { x: 9.4, z: 36, rotY: -Math.PI * 0.5, hasPointLight: false },
    // Solstice Ave poles
    { x: 32, z: -9.4, rotY: 0, hasPointLight: false },
    { x: 32, z: 9.4, rotY: Math.PI, hasPointLight: false },
    // Oceanfront Esplanade poles
    { x: -46.2, z: -26, rotY: Math.PI * 0.5, hasPointLight: false },
    { x: -46.2, z: 0, rotY: Math.PI * 0.5, hasPointLight: false },
    { x: -46.2, z: 26, rotY: Math.PI * 0.5, hasPointLight: false },
  ];

  // Build collision boxes from buildings + oceanfront seawall + outer city perimeter
  const colliders: ColliderBox[] = buildings.map((b) => ({
    id: b.id,
    minX: b.x - b.width / 2 - 0.35,
    maxX: b.x + b.width / 2 + 0.35,
    minZ: b.z - b.depth / 2 - 0.35,
    maxZ: b.z + b.depth / 2 + 0.35,
    kind: 'building',
  }));

  // Seawall barrier along the ocean boardwalk edge so car stays off the water
  colliders.push({
    id: 'ocean-seawall',
    minX: -62,
    maxX: -46.5,
    minZ: -84,
    maxZ: 84,
    kind: 'seawall',
  });

  return {
    worldBounds: WORLD_LIMITS,
    // Spawn on Pacific Blvd northbound right lane facing straight into the sunset intersection & towers
    spawn: { x: 3.6, z: 27, heading: 0 },
    roads,
    intersections,
    sidewalks,
    buildings,
    palms,
    streetlights,
    colliders,
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
