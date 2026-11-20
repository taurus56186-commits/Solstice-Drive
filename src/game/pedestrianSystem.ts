import * as THREE from 'three';
import type { PedestrianRouteSpec } from './cityLayout';
import { groundHeightAt, type GroundSurfaceMap } from './groundSurface';
import { createContactShadowTexture } from './textures';

export interface ArticulatedHumanRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torsoGroup: THREE.Group;
}

interface SharedHumanGeos {
  headGeo: THREE.SphereGeometry;
  hairGeo: THREE.SphereGeometry;
  torsoGeo: THREE.BoxGeometry;
  pelvisGeo: THREE.BoxGeometry;
  armGeo: THREE.BoxGeometry;
  legGeo: THREE.BoxGeometry;
  shoeGeo: THREE.BoxGeometry;
  shadowGeo: THREE.PlaneGeometry;
  shadowMat: THREE.MeshBasicMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  shadowTex: THREE.CanvasTexture;
}

function createSharedHumanGeos(): SharedHumanGeos {
  const headGeo = new THREE.SphereGeometry(0.175, 10, 8);
  const hairGeo = new THREE.SphereGeometry(0.188, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const torsoGeo = new THREE.BoxGeometry(0.42, 0.54, 0.24);
  const pelvisGeo = new THREE.BoxGeometry(0.38, 0.16, 0.22);
  const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.13);
  const legGeo = new THREE.BoxGeometry(0.15, 0.62, 0.16);
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.25);

  const shadowTex = createContactShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x201e22,
    roughness: 0.78,
    metalness: 0.08,
  });

  return {
    headGeo,
    hairGeo,
    torsoGeo,
    pelvisGeo,
    armGeo,
    legGeo,
    shoeGeo,
    shadowGeo,
    shadowMat,
    shoeMat,
    shadowTex,
  };
}

function assembleHuman(
  geos: SharedHumanGeos,
  shirtColor: number,
  pantsColor: number,
  skinTone: number,
  hairColor: number,
  trackedMaterials: THREE.Material[],
  isSoftwareGl: boolean,
): ArticulatedHumanRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.72, metalness: 0.02 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78, metalness: 0.04 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.88, metalness: 0.05 });
  trackedMaterials.push(skinMat, shirtMat, pantsMat, hairMat);

  // Contact shadow disc strictly at y = 0.025 (bottom-center pivot = y = 0)
  const shadow = new THREE.Mesh(geos.shadowGeo, geos.shadowMat);
  shadow.position.y = 0.025;
  root.add(shadow);

  // Legs pivoted at hip (y = 0.72) -> bottom of shoe sits at exactly y = 0.0!
  const makeLeg = (xOff: number): THREE.Group => {
    const hip = new THREE.Group();
    hip.position.set(xOff, 0.72, 0);
    const leg = new THREE.Mesh(geos.legGeo, pantsMat);
    leg.position.y = -0.31;
    leg.castShadow = !isSoftwareGl;
    hip.add(leg);
    const shoe = new THREE.Mesh(geos.shoeGeo, geos.shoeMat);
    shoe.position.set(0, -0.67, -0.04); // toes face -Z (forward)
    hip.add(shoe);
    root.add(hip);
    return hip;
  };

  const leftLeg = makeLeg(-0.11);
  const rightLeg = makeLeg(0.11);

  // Upper body group (subtle walking bob)
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  const pelvis = new THREE.Mesh(geos.pelvisGeo, pantsMat);
  pelvis.position.y = 0.76;
  torsoGroup.add(pelvis);

  const torso = new THREE.Mesh(geos.torsoGeo, shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = !isSoftwareGl;
  torsoGroup.add(torso);

  const head = new THREE.Mesh(geos.headGeo, skinMat);
  head.position.y = 1.56;
  head.castShadow = !isSoftwareGl;
  torsoGroup.add(head);

  const hair = new THREE.Mesh(geos.hairGeo, hairMat);
  hair.position.y = 1.585;
  torsoGroup.add(hair);

  // Arms pivoted at shoulders (y = 1.32)
  const makeArm = (xOff: number): THREE.Group => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOff, 1.32, 0);
    const arm = new THREE.Mesh(geos.armGeo, shirtMat);
    arm.position.y = -0.22;
    shoulder.add(arm);
    torsoGroup.add(shoulder);
    return shoulder;
  };

  const leftArm = makeArm(-0.28);
  const rightArm = makeArm(0.28);

  return { root, leftArm, rightArm, leftLeg, rightLeg, torsoGroup };
}

export function animateHumanWalk(rig: ArticulatedHumanRig, phase: number, moveBlend: number): void {
  const swing = Math.sin(phase) * 0.62 * moveBlend;
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.75;
  rig.rightArm.rotation.x = swing * 0.75;
  rig.torsoGroup.position.y = Math.abs(Math.cos(phase)) * 0.045 * moveBlend;
}

interface ActivePedestrian {
  spec: PedestrianRouteSpec;
  rig: ArticulatedHumanRig;
  x: number;
  z: number;
  heading: number;
  waypointIdx: number;
  pauseTimer: number;
  walkPhase: number;
}

export interface PedestrianSystem {
  group: THREE.Group;
  playerAvatar: ArticulatedHumanRig;
  update: (
    dt: number,
    groundSurface: GroundSurfaceMap,
    carX: number,
    carZ: number,
    carSpeedMs: number,
  ) => void;
  dispose: () => void;
}

export function createPedestrianSystem(
  specs: PedestrianRouteSpec[],
  groundSurface: GroundSurfaceMap,
  isSoftwareGl: boolean,
): PedestrianSystem {
  const group = new THREE.Group();
  group.name = 'CityPedestrians';

  const geos = createSharedHumanGeos();
  const trackedMaterials: THREE.Material[] = [];

  const activePeds: ActivePedestrian[] = [];

  for (const spec of specs) {
    const rig = assembleHuman(
      geos,
      spec.shirtColor,
      spec.pantsColor,
      spec.skinTone,
      spec.hairColor,
      trackedMaterials,
      isSoftwareGl,
    );
    const startWp = spec.waypoints[spec.startIndex % spec.waypoints.length];
    const nextWp = spec.waypoints[(spec.startIndex + 1) % spec.waypoints.length];
    const heading = Math.atan2(-(nextWp.x - startWp.x), -(nextWp.z - startWp.z));
    const groundY = groundHeightAt(startWp.x, startWp.z, groundSurface);

    rig.root.position.set(startWp.x, groundY, startWp.z);
    rig.root.rotation.y = heading;
    group.add(rig.root);

    activePeds.push({
      spec,
      rig,
      x: startWp.x,
      z: startWp.z,
      heading,
      waypointIdx: (spec.startIndex + 1) % spec.waypoints.length,
      pauseTimer: 0,
      walkPhase: Math.random() * Math.PI * 2,
    });
  }

  // Dedicated Articulated On-Foot Player Avatar (Sunset Jacket + Dark Jeans)
  const playerAvatar = assembleHuman(
    geos,
    0xf26430, // Distinct warm sunset bomber jacket
    0x1d2536,
    0xebb991,
    0x1b1514,
    trackedMaterials,
    isSoftwareGl,
  );
  playerAvatar.root.visible = false;
  group.add(playerAvatar.root);

  const update = (
    dt: number,
    surface: GroundSurfaceMap,
    carX: number,
    carZ: number,
    carSpeedMs: number,
  ) => {
    for (let i = 0; i < activePeds.length; i++) {
      const p = activePeds[i];

      if (p.pauseTimer > 0) {
        p.pauseTimer = Math.max(0, p.pauseTimer - dt);
        animateHumanWalk(p.rig, p.walkPhase, 0);
        continue;
      }

      const target = p.spec.waypoints[p.waypointIdx];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.35) {
        p.pauseTimer = target.pauseSec ?? 0;
        p.waypointIdx = (p.waypointIdx + 1) % p.spec.waypoints.length;
        continue;
      }

      // Yield politely when the player's moving car is very close
      const distToCar = Math.hypot(p.x - carX, p.z - carZ);
      let moveSpeed = p.spec.speed;
      if (distToCar < 4.5 && carSpeedMs > 1.5) {
        moveSpeed = 0;
      }

      if (moveSpeed > 0.01) {
        const step = Math.min(dist, moveSpeed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;

        const targetHeading = Math.atan2(-dx, -dz);
        let diff = targetHeading - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += diff * Math.min(1, dt * 8);

        p.walkPhase += step * 3.1;
        animateHumanWalk(p.rig, p.walkPhase, 1);
      } else {
        animateHumanWalk(p.rig, p.walkPhase, 0);
      }

      // Strict point-of-intersection grounding: feet sit strictly at groundHeightAt(x, z)
      const gy = groundHeightAt(p.x, p.z, surface);
      p.rig.root.position.set(p.x, gy, p.z);
      p.rig.root.rotation.y = p.heading;
    }
  };

  return {
    group,
    playerAvatar,
    update,
    dispose: () => {
      geos.headGeo.dispose();
      geos.hairGeo.dispose();
      geos.torsoGeo.dispose();
      geos.pelvisGeo.dispose();
      geos.armGeo.dispose();
      geos.legGeo.dispose();
      geos.shoeGeo.dispose();
      geos.shadowGeo.dispose();
      geos.shadowMat.dispose();
      geos.shoeMat.dispose();
      geos.shadowTex.dispose();
      trackedMaterials.forEach((m) => m.dispose());
    },
  };
}
