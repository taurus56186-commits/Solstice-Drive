import * as THREE from 'three';
import { createContactShadowTexture } from './textures';
import { WHEEL_RADIUS } from './carPhysics';

export interface CarModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group; // pitches & rolls with suspension
  frontWheelPivots: [THREE.Group, THREE.Group];
  wheelSpinGroups: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  brakeLightMaterial: THREE.MeshStandardMaterial;
  headlightGlowMaterial: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createSportsCar(): CarModelRig {
  const root = new THREE.Group();
  root.name = 'PlayerSportsCar';

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

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

  // 1. Metallic Sunset Vermilion / Pearl Copper GT paint (high clearcoat!)
  const paintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd94524,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.35,
    }),
  );

  // 2. Dark matte carbon aero splitter / diffuser / trim (roughness contrast >= 0.48)
  const carbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1d22,
      metalness: 0.18,
      roughness: 0.78,
    }),
  );

  // 3. Tinted glossy automotive glass canopy
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x162130,
      metalness: 0.35,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.6,
    }),
  );

  // 4. Brushed chrome & alloy rim material
  const alloyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9dde4,
      metalness: 0.9,
      roughness: 0.22,
    }),
  );

  // 5. Matte rubber tire
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18191d,
      metalness: 0.05,
      roughness: 0.9,
    }),
  );

  // 6. Performance brake caliper accent
  const caliperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff9234,
      metalness: 0.35,
      roughness: 0.35,
    }),
  );

  // 7. LED headlights & dynamic brake lightbar
  const headlightGlowMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8eb,
      emissive: 0xffe9c2,
      emissiveIntensity: 2.2,
      roughness: 0.12,
      metalness: 0.1,
    }),
  );

  const brakeLightMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff2822,
      emissive: 0xff1e16,
      emissiveIntensity: 1.5,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );

  // --- Sculpted Sports GT Fastback Silhouette (facing -Z forward!) ---
  // Main lower body profile extruded along X width (1.92m wide)
  const hullShape = new THREE.Shape();
  // 2D shape in (Z, Y) plane -> we rotate -PI/2 around Y so +X of shape becomes -Z (forward)
  // Front nose at +2.25, rear tail at -2.20
  hullShape.moveTo(-2.18, 0.34); // rear diffuser bottom
  hullShape.lineTo(2.15, 0.32);  // front splitter bottom
  hullShape.lineTo(2.28, 0.48);  // sharp front lip
  hullShape.lineTo(2.22, 0.74);  // front hood nose
  hullShape.lineTo(1.22, 0.88);  // long sculpted hood
  hullShape.lineTo(0.88, 0.93);  // cowl base
  hullShape.lineTo(-1.82, 0.95); // beltline to rear haunch
  hullShape.lineTo(-2.22, 0.86); // tail deck
  hullShape.lineTo(-2.26, 0.52); // rear bumper fascia
  hullShape.closePath();

  const hullGeo = trackGeo(
    new THREE.ExtrudeGeometry(hullShape, {
      depth: 1.82,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
    }),
  );
  hullGeo.center();
  // Rotate so shape's +X (front) points to -Z (forward)
  hullGeo.rotateY(Math.PI / 2);

  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.position.set(0, 0.64, 0);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // Sculpted fastback cabin greenhouse (extruded narrower & tapered)
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.55, 0.0);  // rear fastback base
  cabinShape.lineTo(0.95, 0.0);   // windshield base
  cabinShape.lineTo(0.32, 0.45);  // windshield header
  cabinShape.lineTo(-0.78, 0.44); // sleek roof arc
  cabinShape.lineTo(-1.52, 0.06); // sloped rear glass
  cabinShape.closePath();

  const cabinGeo = trackGeo(
    new THREE.ExtrudeGeometry(cabinShape, {
      depth: 1.42,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    }),
  );
  cabinGeo.center();
  cabinGeo.rotateY(Math.PI / 2);

  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, 1.12, 0.22);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  // Painted roof cap panel over glass greenhouse for crisp two-tone automotive read
  const roofCapGeo = trackGeo(new THREE.BoxGeometry(1.36, 0.06, 1.24));
  const roofCap = new THREE.Mesh(roofCapGeo, paintMat);
  roofCap.position.set(0, 1.35, 0.14);
  roofCap.castShadow = true;
  bodyGroup.add(roofCap);

  // Front aero splitter & lower grille intake
  const splitterGeo = trackGeo(new THREE.BoxGeometry(1.94, 0.08, 0.42));
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.27, -2.14);
  bodyGroup.add(splitter);

  const grilleGeo = trackGeo(new THREE.BoxGeometry(1.32, 0.22, 0.12));
  const grille = new THREE.Mesh(grilleGeo, carbonMat);
  grille.position.set(0, 0.48, -2.26);
  bodyGroup.add(grille);

  // Side aero rocker skirts
  const skirtGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.1, 2.38));
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, carbonMat);
    skirt.position.set(side * 0.94, 0.28, 0.02);
    bodyGroup.add(skirt);
  }

  // Rear diffuser + twin chrome exhaust tips
  const diffuserGeo = trackGeo(new THREE.BoxGeometry(1.84, 0.2, 0.26));
  const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuser.position.set(0, 0.34, 2.18);
  bodyGroup.add(diffuser);

  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 12));
  exhaustGeo.rotateX(Math.PI / 2);
  for (const xPos of [-0.56, -0.4, 0.4, 0.56]) {
    const tip = new THREE.Mesh(exhaustGeo, alloyMat);
    tip.position.set(xPos, 0.33, 2.28);
    bodyGroup.add(tip);
  }

  // Low-profile rear GT lip spoiler
  const spoilerGeo = trackGeo(new THREE.BoxGeometry(1.74, 0.05, 0.24));
  const spoiler = new THREE.Mesh(spoilerGeo, carbonMat);
  spoiler.position.set(0, 0.99, 2.08);
  spoiler.rotation.x = 0.12;
  spoiler.castShadow = true;
  bodyGroup.add(spoiler);

  // Sculpted side mirrors
  const mirrorGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.09, 0.16));
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorGeo, paintMat);
    mirror.position.set(side * 0.98, 0.98, -0.58);
    bodyGroup.add(mirror);
  }

  // Sleek LED headlights (front = -Z)
  const headlightGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.1, 0.12));
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(headlightGeo, headlightGlowMaterial);
    hl.position.set(side * 0.68, 0.67, -2.23);
    hl.rotation.y = side * 0.18;
    bodyGroup.add(hl);
  }

  // Recessed carbon taillight bezel housing + full-width crimson LED GT lightbar (rear = +Z)
  const tailHousingGeo = trackGeo(new THREE.BoxGeometry(1.86, 0.24, 0.08));
  const tailHousing = new THREE.Mesh(tailHousingGeo, carbonMat);
  tailHousing.position.set(0, 0.76, 2.24);
  bodyGroup.add(tailHousing);

  const tailbarGeo = trackGeo(new THREE.BoxGeometry(1.74, 0.07, 0.06));
  const tailbar = new THREE.Mesh(tailbarGeo, brakeLightMaterial);
  tailbar.position.set(0, 0.79, 2.275);
  bodyGroup.add(tailbar);

  const tailPodGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.06));
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(tailPodGeo, brakeLightMaterial);
    pod.position.set(side * 0.68, 0.74, 2.275);
    bodyGroup.add(pod);
  }

  // Rear license plate accent (subtle warm cream plaque)
  const plateGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.04));
  const plateMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf4e8d2, roughness: 0.45, metalness: 0.1 }),
  );
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.54, 2.27);
  bodyGroup.add(plate);

  // --- 4 Independent Wheel Assemblies (Front turn + all 4 spin) ---
  const tireGeo = trackGeo(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.27, 24));
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = trackGeo(new THREE.CylinderGeometry(WHEEL_RADIUS * 0.68, WHEEL_RADIUS * 0.68, 0.285, 16));
  rimGeo.rotateZ(Math.PI / 2);

  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.295, 0.05, WHEEL_RADIUS * 1.24));
  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.18, 0.14));

  const wheelPositions: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: -0.94, z: -1.36, isFront: true },  // Front Left
    { x: 0.94, z: -1.36, isFront: true },   // Front Right
    { x: -0.94, z: 1.34, isFront: false },  // Rear Left
    { x: 0.94, z: 1.34, isFront: false },   // Rear Right
  ];

  const frontPivots: THREE.Group[] = [];
  const spinGroups: THREE.Group[] = [];

  for (const wp of wheelPositions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wp.x, WHEEL_RADIUS, wp.z);
    root.add(steerPivot);

    // Non-spinning brake caliper mounted to hub
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(wp.x > 0 ? -0.05 : 0.05, 0.04, wp.isFront ? 0.14 : -0.14);
    steerPivot.add(caliper);

    const spinGroup = new THREE.Group();
    steerPivot.add(spinGroup);

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spinGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, alloyMat);
    spinGroup.add(rim);

    // 5-spoke star pattern so wheel rotation is super readable while driving!
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(spokeGeo, carbonMat);
      spoke.rotation.x = (s * Math.PI) / 3;
      spinGroup.add(spoke);
    }

    if (wp.isFront) frontPivots.push(steerPivot);
    spinGroups.push(spinGroup);
  }

  // Grounded radial contact shadow beneath chassis (prevents floating look on all GPUs/SwiftShader)
  const shadowTex = createContactShadowTexture();
  textures.push(shadowTex);
  const shadowPlaneGeo = trackGeo(new THREE.PlaneGeometry(3.2, 5.5));
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const shadowPlaneMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const contactShadow = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  contactShadow.position.y = 0.028;
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    frontWheelPivots: [frontPivots[0], frontPivots[1]],
    wheelSpinGroups: [spinGroups[0], spinGroups[1], spinGroups[2], spinGroups[3]],
    brakeLightMaterial,
    headlightGlowMaterial,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
