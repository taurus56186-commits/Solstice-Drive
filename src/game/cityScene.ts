import * as THREE from 'three';
import type { BuildingSpec, CityLayout } from './cityLayout';
import {
  createBuildingFacadeTextures,
  createIntersectionTexture,
  createLobbyFacadeTextures,
  createPalmBarkTexture,
  createRoadTextures,
  createSidewalkTextures,
  createSmokeTexture,
} from './textures';

export interface DriftSmokePool {
  emit: (x: number, y: number, z: number, vx: number, vz: number) => void;
  update: (dt: number, camera: THREE.Camera) => void;
}

export interface CitySceneAssets {
  root: THREE.Group;
  windowMaterials: THREE.MeshStandardMaterial[];
  roadMaterials: THREE.MeshStandardMaterial[];
  streetPointLights: THREE.PointLight[];
  updateAmbient: (elapsedSec: number, dt: number, sunDir: THREE.Vector3) => void;
  smokePool: DriftSmokePool;
  dispose: () => void;
}

export function buildCoastalCityScene(
  layout: CityLayout,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): CitySceneAssets {
  const root = new THREE.Group();
  root.name = 'CoastalSunsetCity';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // --- 1. Extended Ground Plane & Golden Sunset Pacific Ocean ---
  // Inland ground base beneath city (y = -0.06, well below road at y = 0.0)
  const inlandGroundGeo = trackGeo(new THREE.PlaneGeometry(520, 620));
  inlandGroundGeo.rotateX(-Math.PI / 2);
  const inlandGroundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b3533,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  const inlandGround = new THREE.Mesh(inlandGroundGeo, inlandGroundMat);
  inlandGround.position.set(204, -0.06, 0);
  inlandGround.receiveShadow = true;
  root.add(inlandGround);

  // Shimmering Pacific Ocean stretching from seawall (-56) out to the sunset horizon (-680)
  const oceanGeo = trackGeo(new THREE.PlaneGeometry(660, 900, 48, 48));
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.85, 0.14, -0.5).normalize() },
  };
  const oceanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a384f,
      roughness: 0.18,
      metalness: 0.62,
      envMapIntensity: 1.5,
    }),
  );
  // Subtle PBR wave vertex displacement & golden sunset specular glint via onBeforeCompile
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oceanUniforms.uTime;
    shader.uniforms.uSunDir = oceanUniforms.uSunDir;
    shader.vertexShader =
      `uniform float uTime;\nvarying vec3 vWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float wave1 = sin(position.x * 0.11 + uTime * 1.15) * 0.16;
         float wave2 = cos(position.z * 0.08 - uTime * 0.85) * 0.14;
         transformed.y += wave1 + wave2;`,
      ).replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader =
      `uniform vec3 uSunDir;\nvarying vec3 vWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `vec3 viewDirW = normalize(cameraPosition - vWorldPos);
         vec3 halfVec = normalize(normalize(uSunDir) + viewDirW);
         float sunGlint = pow(max(dot(vec3(0.0, 1.0, 0.0), halfVec), 0.0), 42.0);
         gl_FragColor.rgb += vec3(1.0, 0.62, 0.28) * sunGlint * 0.85;
         #include <dithering_fragment>`,
      );
  };
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(-384, -1.35, 0);
  root.add(oceanMesh);

  // Sandy coastal embankment sloping down from seawall to ocean
  const beachGeo = trackGeo(new THREE.BoxGeometry(10, 1.8, 220));
  const beachMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc29c76, roughness: 0.92, metalness: 0.02 }),
  );
  const beach = new THREE.Mesh(beachGeo, beachMat);
  beach.position.set(-59, -1.2, 0);
  beach.rotation.z = 0.22;
  root.add(beach);

  // --- 2. Asphalt Roads & Intersections (y = 0.0 and y = 0.022 disjoint to eliminate Z-fighting) ---
  const roadTexSet = createRoadTextures(maxAnisotropy);
  trackTex(roadTexSet.map);
  trackTex(roadTexSet.roughnessMap);
  trackTex(roadTexSet.bumpMap);

  const interTexSet = createIntersectionTexture(maxAnisotropy);
  trackTex(interTexSet.map);
  trackTex(interTexSet.roughnessMap);
  trackTex(interTexSet.bumpMap);

  const roadMaterials: THREE.MeshStandardMaterial[] = [];

  for (const seg of layout.roads) {
    const repeats = Math.max(1, Math.round(seg.length / 18));
    const mapClone = trackTex(roadTexSet.map.clone());
    mapClone.repeat.set(1, repeats);
    mapClone.needsUpdate = true;

    const roughClone = trackTex(roadTexSet.roughnessMap.clone());
    roughClone.repeat.set(1, repeats);
    roughClone.needsUpdate = true;

    const bumpClone = trackTex(roadTexSet.bumpMap.clone());
    bumpClone.repeat.set(1, repeats);
    bumpClone.needsUpdate = true;

    const segMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: mapClone,
        roughnessMap: roughClone,
        bumpMap: bumpClone,
        bumpScale: 0.035,
        roughness: 0.62,
        metalness: 0.08,
        envMapIntensity: 1.15,
      }),
    );
    roadMaterials.push(segMat);

    const geo = trackGeo(new THREE.PlaneGeometry(seg.width, seg.length));
    geo.rotateX(-Math.PI / 2);
    if (seg.axis === 'ew') {
      geo.rotateY(Math.PI / 2);
    }
    const mesh = new THREE.Mesh(geo, segMat);
    mesh.position.set(seg.x, 0.0, seg.z);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const interMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: interTexSet.map,
      roughnessMap: interTexSet.roughnessMap,
      bumpMap: interTexSet.bumpMap,
      bumpScale: 0.03,
      roughness: 0.58,
      metalness: 0.1,
      envMapIntensity: 1.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  roadMaterials.push(interMat);

  for (const inter of layout.intersections) {
    const geo = trackGeo(new THREE.PlaneGeometry(inter.size, inter.size));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, interMat);
    mesh.position.set(inter.x, 0.022, inter.z);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // --- 3. Raised Sandstone Sidewalks & Coastal Promenade Seawall ---
  const sidewalkTex = createSidewalkTextures(maxAnisotropy);
  trackTex(sidewalkTex.map);
  trackTex(sidewalkTex.bumpMap);

  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xafa191,
      roughness: 0.86,
      metalness: 0.02,
    }),
  );

  for (const sw of layout.sidewalks) {
    const swMap = trackTex(sidewalkTex.map.clone());
    swMap.repeat.set(Math.max(1, sw.width / 5), Math.max(1, sw.depth / 5));
    swMap.needsUpdate = true;

    const swBump = trackTex(sidewalkTex.bumpMap.clone());
    swBump.repeat.set(Math.max(1, sw.width / 5), Math.max(1, sw.depth / 5));
    swBump.needsUpdate = true;

    const topMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: swMap,
        bumpMap: swBump,
        bumpScale: 0.025,
        roughness: 0.84,
        metalness: 0.02,
      }),
    );

    const geo = trackGeo(new THREE.BoxGeometry(sw.width, 0.24, sw.depth));
    const mesh = new THREE.Mesh(geo, [curbMat, curbMat, topMat, curbMat, curbMat, curbMat]);
    mesh.position.set(sw.x, 0.12, sw.z);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Architectural Coastal Seawall Balustrade along west edge of boardwalk (x = -55.4)
  const seawallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd9cbb8, roughness: 0.82, metalness: 0.04 }),
  );
  const seawallBaseGeo = trackGeo(new THREE.BoxGeometry(0.9, 1.15, 160));
  const seawallBase = new THREE.Mesh(seawallBaseGeo, seawallMat);
  seawallBase.position.set(-55.6, 0.35, 0);
  seawallBase.castShadow = true;
  seawallBase.receiveShadow = true;
  root.add(seawallBase);

  // Railing posts & brushed metal handrail
  const railMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b444f, roughness: 0.34, metalness: 0.82 }),
  );
  const railBarGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.08, 160));
  const railBar = new THREE.Mesh(railBarGeo, railMetalMat);
  railBar.position.set(-55.6, 1.24, 0);
  root.add(railBar);

  // --- 4. Multi-Story Modern Coastal Buildings (Composite 3–8 Part Structures!) ---
  const facadeStyles = ['glass-tower', 'terracotta-modern', 'coastal-hotel', 'podium-office'] as const;
  const facadeCache = new Map<BuildingSpec['style'], ReturnType<typeof createBuildingFacadeTextures>>();
  for (const st of facadeStyles) {
    const texSet = createBuildingFacadeTextures(st, maxAnisotropy);
    trackTex(texSet.map);
    trackTex(texSet.emissiveMap);
    trackTex(texSet.roughnessMap);
    facadeCache.set(st, texSet);
  }

  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3c4048, roughness: 0.88, metalness: 0.08 }),
  );
  const lobbyTexSet = createLobbyFacadeTextures(maxAnisotropy);
  trackTex(lobbyTexSet.map);
  trackTex(lobbyTexSet.emissiveMap);
  trackTex(lobbyTexSet.roughnessMap);

  const lobbyGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: lobbyTexSet.map,
      emissive: 0xffc27d,
      emissiveMap: lobbyTexSet.emissiveMap,
      emissiveIntensity: 0.95,
      roughnessMap: lobbyTexSet.roughnessMap,
      roughness: 0.82,
      metalness: 0.28,
      envMapIntensity: 1.35,
    }),
  );
  windowMaterials.push(lobbyGlassMat);

  for (const b of layout.buildings) {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0.24, b.z); // sit flush on sidewalk surface!

    const baseTex = facadeCache.get(b.style)!;
    const repX = Math.max(1, Math.round(b.width / 8.5));
    const repY = Math.max(1, Math.round(b.height / 14));

    const fMap = trackTex(baseTex.map.clone());
    fMap.repeat.set(repX, repY);
    fMap.needsUpdate = true;
    const fEmissive = trackTex(baseTex.emissiveMap.clone());
    fEmissive.repeat.set(repX, repY);
    fEmissive.needsUpdate = true;
    const fRough = trackTex(baseTex.roughnessMap.clone());
    fRough.repeat.set(repX, repY);
    fRough.needsUpdate = true;

    const facadeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: fMap,
        emissive: 0xffc684,
        emissiveMap: fEmissive,
        emissiveIntensity: 1.15,
        roughnessMap: fRough,
        roughness: 0.82,
        metalness: b.style === 'glass-tower' ? 0.42 : 0.16,
        envMapIntensity: b.style === 'glass-tower' ? 1.55 : 0.95,
      }),
    );
    windowMaterials.push(facadeMat);

    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: b.bodyColor,
        roughness: 0.72,
        metalness: 0.18,
      }),
    );

    const accentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: b.accentColor,
        emissive: b.accentColor,
        emissiveIntensity: 0.65,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );

    // Part 1: Ground-floor architectural lobby podium (recessed warm-lit glass + canopy)
    const podiumH = 4.2;
    const podiumGeo = trackGeo(new THREE.BoxGeometry(b.width - 0.6, podiumH, b.depth - 0.6));
    const podium = new THREE.Mesh(podiumGeo, lobbyGlassMat);
    podium.position.y = podiumH / 2;
    podium.castShadow = true;
    podium.receiveShadow = true;
    bGroup.add(podium);

    // Part 2: Architectural canopy overhang above lobby
    const canopyGeo = trackGeo(new THREE.BoxGeometry(b.width + 0.7, 0.42, b.depth + 0.7));
    const canopy = new THREE.Mesh(canopyGeo, trimMat);
    canopy.position.y = podiumH + 0.15;
    canopy.castShadow = true;
    bGroup.add(canopy);

    // Part 3: Main tower shaft
    const lowerTowerH = b.setbackRatio > 0 ? (b.height - podiumH) * 0.68 : b.height - podiumH;
    const shaftGeo = trackGeo(new THREE.BoxGeometry(b.width, lowerTowerH, b.depth));
    const shaft = new THREE.Mesh(shaftGeo, [
      facadeMat,
      facadeMat,
      roofMat,
      roofMat,
      facadeMat,
      facadeMat,
    ]);
    shaft.position.y = podiumH + lowerTowerH / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    // Part 4: Parapet cornice band
    const corniceGeo = trackGeo(new THREE.BoxGeometry(b.width + 0.45, 0.55, b.depth + 0.45));
    const cornice = new THREE.Mesh(corniceGeo, trimMat);
    cornice.position.y = podiumH + lowerTowerH;
    bGroup.add(cornice);

    let topY = podiumH + lowerTowerH + 0.28;

    // Part 5: Stepped upper setback tower (architectural skyline silhouette!)
    if (b.setbackRatio > 0) {
      const upperH = (b.height - podiumH) * 0.32;
      const uw = b.width * b.setbackRatio;
      const ud = b.depth * b.setbackRatio;
      const upperGeo = trackGeo(new THREE.BoxGeometry(uw, upperH, ud));
      const upper = new THREE.Mesh(upperGeo, [
        facadeMat,
        facadeMat,
        roofMat,
        roofMat,
        facadeMat,
        facadeMat,
      ]);
      upper.position.y = topY + upperH / 2;
      upper.castShadow = true;
      upper.receiveShadow = true;
      bGroup.add(upper);
      topY += upperH;
    }

    // Part 6: Rooftop mechanical penthouse + illuminated coastal architectural crown band
    const pentW = b.width * 0.34;
    const pentD = b.depth * 0.34;
    const pentGeo = trackGeo(new THREE.BoxGeometry(pentW, 2.2, pentD));
    const pent = new THREE.Mesh(pentGeo, trimMat);
    pent.position.y = topY + 1.1;
    bGroup.add(pent);

    if (b.hasRooftopCrown) {
      const crownGeo = trackGeo(new THREE.BoxGeometry(b.width * (b.setbackRatio || 0.96) + 0.2, 0.38, b.depth * (b.setbackRatio || 0.96) + 0.2));
      const crown = new THREE.Mesh(crownGeo, accentMat);
      crown.position.y = topY - 0.2;
      bGroup.add(crown);
    }

    root.add(bGroup);
  }

  // --- 5. Distant Sunset Coastal Skyline Silhouettes (Textured flanking towers, open avenue vista!) ---
  const distantTex = facadeCache.get('glass-tower')!;
  const dMap = trackTex(distantTex.map.clone());
  dMap.repeat.set(2, 4);
  dMap.needsUpdate = true;
  const dEmissive = trackTex(distantTex.emissiveMap.clone());
  dEmissive.repeat.set(2, 4);
  dEmissive.needsUpdate = true;

  const distantMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb9a8ba,
      map: dMap,
      emissive: 0xffb670,
      emissiveMap: dEmissive,
      emissiveIntensity: 0.65,
      roughness: 0.72,
      metalness: 0.25,
    }),
  );
  windowMaterials.push(distantMat);

  const distantTowers: Array<[number, number, number, number, number]> = [
    [104, -72, 22, 58, 20],
    [112, -32, 24, 46, 22],
    [106, 14, 20, 64, 18],
    [112, 52, 24, 40, 24],
    [52, -112, 24, 52, 20],
    [22, -116, 18, 44, 18],
    [-26, -114, 18, 30, 18],
    [48, 108, 24, 42, 20],
    [-24, 110, 20, 32, 18],
  ];
  for (const [dx, dz, dw, dh, dd] of distantTowers) {
    const geo = trackGeo(new THREE.BoxGeometry(dw, dh, dd));
    const m = new THREE.Mesh(geo, [distantMat, distantMat, roofMat, roofMat, distantMat, distantMat]);
    m.position.set(dx, dh / 2, dz);
    root.add(m);
  }

  // --- 6. Composite Swaying Coastal Palm Trees (Curved Bark Trunk + Crown + Layered Arched Fronds) ---
  const barkTex = trackTex(createPalmBarkTexture(maxAnisotropy));
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: barkTex,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  const frondMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3f753a,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  const frondUnderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c572e,
      roughness: 0.72,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
  );
  const planterStoneMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xa69686, roughness: 0.85, metalness: 0.02 }),
  );
  const planterSoilMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x45352a, roughness: 0.95, metalness: 0 }),
  );

  // Shared curved frond blade geometry (arched tapered palm frond)
  const frondShape = new THREE.Shape();
  frondShape.moveTo(0, 0);
  frondShape.quadraticCurveTo(0.45, 1.3, 0.04, 3.1);
  frondShape.quadraticCurveTo(-0.45, 1.3, 0, 0);
  const frondGeo = trackGeo(new THREE.ShapeGeometry(frondShape, 6));
  // Curve vertices downward along the length for organic arch
  const fPos = frondGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const y = fPos.getY(i);
    const t = y / 3.1;
    // Rotate frond forward (+Z) and droop (-Y)
    const zOut = y;
    const yArch = Math.sin(t * Math.PI * 0.72) * 0.65 - t * t * 1.05;
    fPos.setXYZ(i, fPos.getX(i), yArch, zOut);
  }
  frondGeo.computeVertexNormals();

  const planterRimGeo = trackGeo(new THREE.CylinderGeometry(0.95, 1.05, 0.36, 12));
  const planterSoilGeo = trackGeo(new THREE.CylinderGeometry(0.82, 0.82, 0.39, 12));
  const crownHubGeo = trackGeo(new THREE.SphereGeometry(0.36, 8, 6));

  const palmCrowns: Array<{ group: THREE.Group; phase: number; baseRotZ: number }> = [];

  for (let i = 0; i < layout.palms.length; i++) {
    const p = layout.palms[i];
    const palmGroup = new THREE.Group();
    palmGroup.position.set(p.x, 0.24, p.z); // grounded on sidewalk!

    // Planter base
    const rim = new THREE.Mesh(planterRimGeo, planterStoneMat);
    rim.position.y = 0.18;
    palmGroup.add(rim);
    const soil = new THREE.Mesh(planterSoilGeo, planterSoilMat);
    soil.position.y = 0.19;
    palmGroup.add(soil);

    // Curved organic palm trunk via CatmullRomCurve3 + TubeGeometry
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(p.leanX * 0.35, p.height * 0.38, p.leanZ * 0.35),
      new THREE.Vector3(p.leanX * 0.85, p.height * 0.72, p.leanZ * 0.85),
      new THREE.Vector3(p.leanX, p.height, p.leanZ),
    ]);
    const trunkGeo = trackGeo(new THREE.TubeGeometry(curve, 10, 0.22, 7, false));
    // Taper trunk upward from thick base to slender neck
    const tPos = trunkGeo.attributes.position;
    for (let v = 0; v < tPos.count; v++) {
      const vy = tPos.getY(v);
      const frac = THREE.MathUtils.clamp(vy / p.height, 0, 1);
      const pt = curve.getPoint(frac);
      const taper = 1.25 - frac * 0.55;
      tPos.setX(v, pt.x + (tPos.getX(v) - pt.x) * taper);
      tPos.setZ(v, pt.z + (tPos.getZ(v) - pt.z) * taper);
    }
    trunkGeo.computeVertexNormals();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = !isSoftwareGl;
    palmGroup.add(trunk);

    // Swaying frond crown
    const crown = new THREE.Group();
    crown.position.set(p.leanX, p.height, p.leanZ);
    const hub = new THREE.Mesh(crownHubGeo, trunkMat);
    crown.add(hub);

    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
      const isUpper = f % 2 === 0;
      const frond = new THREE.Mesh(frondGeo, isUpper ? frondMat : frondUnderMat);
      frond.rotation.y = p.rotY + (f / frondCount) * Math.PI * 2;
      frond.rotation.x = isUpper ? -0.26 : 0.14;
      const scale = (isUpper ? 0.94 : 1.08) + ((i + f) % 3) * 0.08;
      frond.scale.setScalar(scale);
      frond.castShadow = !isSoftwareGl;
      crown.add(frond);
    }

    palmGroup.add(crown);
    palmCrowns.push({ group: crown, phase: i * 0.73, baseRotZ: 0 });
    root.add(palmGroup);
  }

  // --- 7. Architectural Streetlights & Main Intersection Traffic Signals ---
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2c323b, roughness: 0.36, metalness: 0.82 }),
  );
  const lampGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4b0,
      emissive: 0xffb156,
      emissiveIntensity: 3.0,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  const poleBaseGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.24, 0.8, 10));
  const poleShaftGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.13, 6.8, 10));
  const poleArmGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.1, 2.3));
  const lampHeadGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.14, 0.85));
  const lampLensGeo = trackGeo(new THREE.PlaneGeometry(0.36, 0.68));
  lampLensGeo.rotateX(Math.PI / 2);

  const streetPointLights: THREE.PointLight[] = [];

  for (const sl of layout.streetlights) {
    const slGroup = new THREE.Group();
    slGroup.position.set(sl.x, 0.24, sl.z);
    slGroup.rotation.y = sl.rotY;

    const base = new THREE.Mesh(poleBaseGeo, poleMat);
    base.position.y = 0.4;
    slGroup.add(base);

    const shaft = new THREE.Mesh(poleShaftGeo, poleMat);
    shaft.position.y = 3.8;
    shaft.castShadow = !isSoftwareGl;
    slGroup.add(shaft);

    const arm = new THREE.Mesh(poleArmGeo, poleMat);
    arm.position.set(0, 7.1, 1.05);
    slGroup.add(arm);

    const head = new THREE.Mesh(lampHeadGeo, poleMat);
    head.position.set(0, 7.05, 2.15);
    slGroup.add(head);

    const lens = new THREE.Mesh(lampLensGeo, lampGlowMat);
    lens.position.set(0, 6.97, 2.15);
    slGroup.add(lens);

    if (sl.hasPointLight) {
      // Warm amber sunset streetlight pool onto intersection asphalt
      const pl = new THREE.PointLight(0xffb463, 18, 28, 1.8);
      pl.position.set(0, 6.6, 2.15);
      slGroup.add(pl);
      streetPointLights.push(pl);
    }

    root.add(slGroup);
  }

  // Green/Amber glowing traffic signal heads suspended at the 4 central intersection corners
  const sigBoxGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.96, 0.28));
  const sigGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3bf596,
      emissive: 0x26e885,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    }),
  );
  const sigAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffa83b,
      emissive: 0xff9322,
      emissiveIntensity: 2.4,
      roughness: 0.2,
    }),
  );
  const sigLensGeo = trackGeo(new THREE.CircleGeometry(0.11, 12));

  const signalCorners: Array<[number, number, number, boolean]> = [
    [9.2, -9.2, 0, true],
    [-9.2, 9.2, Math.PI, true],
    [-9.2, -9.2, Math.PI / 2, false],
    [9.2, 9.2, -Math.PI / 2, false],
  ];
  for (const [sx, sz, rotY, isGreen] of signalCorners) {
    const sg = new THREE.Group();
    sg.position.set(sx, 5.2, sz);
    sg.rotation.y = rotY;
    const box = new THREE.Mesh(sigBoxGeo, poleMat);
    sg.add(box);
    const lens = new THREE.Mesh(sigLensGeo, isGreen ? sigGreenMat : sigAmberMat);
    lens.position.set(0, isGreen ? -0.24 : 0, 0.15);
    sg.add(lens);
    root.add(sg);
  }

  // --- 8. Zero-GC Pooled Tire Drift Smoke Ring Buffer ---
  const SMOKE_COUNT = 48;
  const smokeTex = trackTex(createSmokeTexture());
  const smokeGeo = trackGeo(new THREE.PlaneGeometry(1, 1));
  const smokeMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      color: 0xffdfc4,
    }),
  );

  interface SmokeParticle {
    mesh: THREE.Mesh;
    age: number;
    life: number;
    vx: number;
    vy: number;
    vz: number;
    active: boolean;
  }

  const smokeParticles: SmokeParticle[] = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const m = new THREE.Mesh(smokeGeo, smokeMat.clone());
    materials.push(m.material as THREE.Material);
    m.visible = false;
    root.add(m);
    smokeParticles.push({
      mesh: m,
      age: 0,
      life: 0.8,
      vx: 0,
      vy: 0,
      vz: 0,
      active: false,
    });
  }

  let smokeCursor = 0;
  const smokePool: DriftSmokePool = {
    emit: (x, y, z, vx, vz) => {
      const p = smokeParticles[smokeCursor];
      smokeCursor = (smokeCursor + 1) % SMOKE_COUNT;
      p.active = true;
      p.age = 0;
      p.life = 0.55 + Math.random() * 0.35;
      p.vx = vx + (Math.random() - 0.5) * 1.4;
      p.vy = 0.75 + Math.random() * 0.65;
      p.vz = vz + (Math.random() - 0.5) * 1.4;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(0.55);
      p.mesh.visible = true;
    },
    update: (dt, camera) => {
      for (let i = 0; i < SMOKE_COUNT; i++) {
        const p = smokeParticles[i];
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        const t = p.age / p.life;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vx *= 0.94;
        p.vz *= 0.94;
        const scale = 0.55 + t * 2.15;
        p.mesh.scale.setScalar(scale);
        p.mesh.quaternion.copy(camera.quaternion);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.44;
      }
    },
  };

  const updateAmbient = (elapsedSec: number, _dt: number, sunDir: THREE.Vector3) => {
    oceanUniforms.uTime.value = elapsedSec;
    oceanUniforms.uSunDir.value.copy(sunDir);

    // Gentle coastal sunset breeze swaying palm crowns
    for (let i = 0; i < palmCrowns.length; i++) {
      const pc = palmCrowns[i];
      pc.group.rotation.z = pc.baseRotZ + Math.sin(elapsedSec * 1.35 + pc.phase) * 0.045;
      pc.group.rotation.x = Math.cos(elapsedSec * 1.05 + pc.phase) * 0.03;
    }
  };

  return {
    root,
    windowMaterials,
    roadMaterials,
    streetPointLights,
    updateAmbient,
    smokePool,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
