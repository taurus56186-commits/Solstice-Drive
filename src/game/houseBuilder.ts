import * as THREE from 'three';
import type { EnterableHouseSpec } from './cityLayout';

function createHardwoodFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a4754d';
  ctx.fillRect(0, 0, 256, 256);

  const plankH = 32;
  for (let row = 0; row < 8; row++) {
    const shade = (row % 3) * 8 - 8;
    ctx.fillStyle = `rgb(${164 + shade},${116 + shade},${76 + shade})`;
    ctx.fillRect(0, row * plankH + 1, 256, plankH - 2);
    // Plank seam
    ctx.fillStyle = 'rgba(54, 34, 20, 0.55)';
    ctx.fillRect(0, row * plankH, 256, 2);
    // Vertical plank joint
    const jointX = ((row * 97) % 200) + 28;
    ctx.fillRect(jointX, row * plankH, 2, plankH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function createSunsetWallArtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#3a4f78');
  grad.addColorStop(0.55, '#eb8b54');
  grad.addColorStop(0.72, '#ffd085');
  grad.addColorStop(0.73, '#1e3c57');
  grad.addColorStop(1, '#14263b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#ffe5ad';
  ctx.beginPath();
  ctx.arc(64, 62, 16, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface EnterableHousesBundle {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Builds proper multi-part architectural coastal houses with real open framed doorways,
 * warm interior hardwood floors, furnished living/cafe spaces, windows, porch lanterns,
 * and overhanging roofs so both the player (on foot) and NPC pedestrians can freely
 * enter inside and exit back onto the street.
 */
export function buildEnterableHouses(
  houses: EnterableHouseSpec[],
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): EnterableHousesBundle {
  const group = new THREE.Group();
  group.name = 'EnterableCoastalHouses';

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

  const floorTex = createHardwoodFloorTexture(maxAnisotropy);
  textures.push(floorTex);
  const artTex = createSunsetWallArtTexture();
  textures.push(artTex);

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      roughness: 0.56,
      metalness: 0.06,
    }),
  );

  const interiorWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf7eee3,
      roughness: 0.84,
      metalness: 0.02,
    }),
  );

  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6f472e,
      roughness: 0.62,
      metalness: 0.08,
    }),
  );

  const darkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2e2a2d,
      roughness: 0.48,
      metalness: 0.25,
    }),
  );

  const sofaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2583a,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const rugMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b5c6e,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );

  const lampGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff0cc,
      emissive: 0xffbf70,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    }),
  );

  const porchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd5c4b0,
      roughness: 0.82,
      metalness: 0.02,
    }),
  );

  const welcomeMatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8f5638,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );

  const artMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: artTex,
      roughness: 0.45,
      metalness: 0.05,
    }),
  );

  const plantLeafMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3a703b,
      roughness: 0.68,
      metalness: 0.02,
    }),
  );

  const windowGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6b90ad,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );

  for (const h of houses) {
    const hGroup = new THREE.Group();
    hGroup.position.set(h.x, 0, h.z);

    // Rotate local house space so the FRONT OPEN DOORWAY always faces local +Z!
    // World doorFacing: 'south' -> +Z (0), 'west' -> -X (-PI/2), 'north' -> -Z (PI), 'east' -> +X (+PI/2)
    let rotY = 0;
    let localW = h.width;
    let localD = h.depth;
    if (h.doorFacing === 'west') {
      rotY = -Math.PI / 2;
      localW = h.depth;
      localD = h.width;
    } else if (h.doorFacing === 'east') {
      rotY = Math.PI / 2;
      localW = h.depth;
      localD = h.width;
    } else if (h.doorFacing === 'north') {
      rotY = Math.PI;
    }
    hGroup.rotation.y = rotY;

    const wallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: h.wallColor,
        roughness: 0.82,
        metalness: 0.04,
      }),
    );
    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: h.trimColor,
        roughness: 0.6,
        metalness: 0.12,
      }),
    );
    const roofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: h.roofColor,
        roughness: 0.72,
        metalness: 0.14,
      }),
    );

    const wallH = h.wallHeight;
    const t = 0.38; // solid wall thickness
    const hw = localW / 2;
    const hd = localD / 2;
    const doorW = h.doorWidth;
    const doorH = h.doorHeight;
    const baseY = 0.24; // flush on sidewalk!

    // 1. Interior hardwood floor slab sitting strictly at floorY = 0.27 (disjoint >= 0.03 above sidewalk)
    const floorGeo = trackGeo(new THREE.BoxGeometry(localW - 0.1, 0.06, localD - 0.1));
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, h.floorY - 0.03, 0);
    floorMesh.receiveShadow = true;
    hGroup.add(floorMesh);

    // 2. Front porch apron & welcome mat directly outside open doorway (+Z face)
    const porchGeo = trackGeo(new THREE.BoxGeometry(doorW + 3.2, 0.06, 2.2));
    const porch = new THREE.Mesh(porchGeo, porchMat);
    porch.position.set(0, baseY + 0.02, hd + 1.0);
    porch.receiveShadow = true;
    hGroup.add(porch);

    const matGeo = trackGeo(new THREE.BoxGeometry(2.0, 0.025, 1.1));
    const welcomeMat = new THREE.Mesh(matGeo, welcomeMatMat);
    welcomeMat.position.set(0, baseY + 0.052, hd + 0.65);
    hGroup.add(welcomeMat);

    // 3. Front Wall (+Z) WITH REAL OPEN FRAMED DOORWAY (Left wall + Right wall + Top transom lintel)
    const sideSegmentW = (localW - doorW) / 2;
    const frontSideGeo = trackGeo(new THREE.BoxGeometry(sideSegmentW, wallH, t));
    for (const side of [-1, 1]) {
      const seg = new THREE.Mesh(frontSideGeo, [wallMat, wallMat, wallMat, wallMat, wallMat, interiorWallMat]);
      seg.position.set(side * (doorW / 2 + sideSegmentW / 2), baseY + wallH / 2, hd - t / 2);
      seg.castShadow = !isSoftwareGl;
      seg.receiveShadow = true;
      hGroup.add(seg);
    }
    // Transom wall above open doorway
    const transomH = wallH - doorH;
    const transomGeo = trackGeo(new THREE.BoxGeometry(doorW, transomH, t));
    const transom = new THREE.Mesh(transomGeo, [wallMat, wallMat, wallMat, wallMat, wallMat, interiorWallMat]);
    transom.position.set(0, baseY + doorH + transomH / 2, hd - t / 2);
    hGroup.add(transom);

    // Architectural wooden doorframe jambs & lintel + overhanging entrance awning
    const jambGeo = trackGeo(new THREE.BoxGeometry(0.18, doorH, t + 0.14));
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(jambGeo, trimMat);
      jamb.position.set(side * (doorW / 2 - 0.05), baseY + doorH / 2, hd - t / 2);
      hGroup.add(jamb);
    }
    const lintelGeo = trackGeo(new THREE.BoxGeometry(doorW + 0.36, 0.22, t + 0.18));
    const lintel = new THREE.Mesh(lintelGeo, trimMat);
    lintel.position.set(0, baseY + doorH + 0.08, hd - t / 2);
    hGroup.add(lintel);

    const awningGeo = trackGeo(new THREE.BoxGeometry(doorW + 3.0, 0.18, 1.45));
    const awning = new THREE.Mesh(awningGeo, trimMat);
    awning.position.set(0, baseY + doorH + 0.42, hd + 0.72);
    awning.castShadow = !isSoftwareGl;
    hGroup.add(awning);

    // Porch columns supporting the entrance canopy (widely spaced so doorway approach is completely clear!)
    const colGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.13, doorH + 0.35, 10));
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(colGeo, trimMat);
      col.position.set(side * (doorW / 2 + 1.25), baseY + (doorH + 0.35) / 2, hd + 1.15);
      hGroup.add(col);
    }

    // Warm glowing porch lanterns flanking the open doorway (instant visual landmark!)
    const lanternGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.42, 0.24));
    for (const side of [-1, 1]) {
      const lantern = new THREE.Mesh(lanternGeo, lampGlowMat);
      lantern.position.set(side * (doorW / 2 + 0.55), baseY + 2.35, hd + 0.16);
      hGroup.add(lantern);
    }

    // 4. Back Wall (-Z) solid interior + exterior
    const backWallGeo = trackGeo(new THREE.BoxGeometry(localW, wallH, t));
    const backWall = new THREE.Mesh(backWallGeo, [wallMat, wallMat, wallMat, wallMat, interiorWallMat, wallMat]);
    backWall.position.set(0, baseY + wallH / 2, -hd + t / 2);
    backWall.castShadow = !isSoftwareGl;
    backWall.receiveShadow = true;
    hGroup.add(backWall);

    // 5. Side Walls (-X and +X) with architectural window cutouts & translucent glazing
    const sideWallLen = localD - t * 2;
    const winW = 3.2;
    const winBottomH = 1.15;
    const winH = 1.85;
    const pillarLen = (sideWallLen - winW) / 2;

    const sidePillarGeo = trackGeo(new THREE.BoxGeometry(t, wallH, pillarLen));
    const sideSillGeo = trackGeo(new THREE.BoxGeometry(t, winBottomH, winW));
    const sideTopGeo = trackGeo(new THREE.BoxGeometry(t, wallH - winBottomH - winH, winW));
    const sideGlassGeo = trackGeo(new THREE.BoxGeometry(0.08, winH, winW));

    for (const side of [-1, 1]) {
      const wx = side * (hw - t / 2);
      for (const zSide of [-1, 1]) {
        const pillar = new THREE.Mesh(sidePillarGeo, wallMat);
        pillar.position.set(wx, baseY + wallH / 2, zSide * (winW / 2 + pillarLen / 2));
        pillar.castShadow = !isSoftwareGl;
        hGroup.add(pillar);
      }
      const sill = new THREE.Mesh(sideSillGeo, wallMat);
      sill.position.set(wx, baseY + winBottomH / 2, 0);
      hGroup.add(sill);

      const topBar = new THREE.Mesh(sideTopGeo, wallMat);
      topBar.position.set(wx, baseY + winBottomH + winH + (wallH - winBottomH - winH) / 2, 0);
      hGroup.add(topBar);

      const glass = new THREE.Mesh(sideGlassGeo, windowGlassMat);
      glass.position.set(wx, baseY + winBottomH + winH / 2, 0);
      hGroup.add(glass);
    }

    // 6. Modern Coastal Overhanging Roof Slab + Second-Tier Clerestory Roof Crown + Ceiling Light
    const roofSlabGeo = trackGeo(new THREE.BoxGeometry(localW + 1.3, 0.34, localD + 1.3));
    const roofSlab = new THREE.Mesh(roofSlabGeo, roofMat);
    roofSlab.position.set(0, baseY + wallH + 0.17, 0);
    roofSlab.castShadow = !isSoftwareGl;
    hGroup.add(roofSlab);

    const clerestoryGeo = trackGeo(new THREE.BoxGeometry(localW * 0.62, 0.95, localD * 0.56));
    const clerestory = new THREE.Mesh(clerestoryGeo, trimMat);
    clerestory.position.set(0, baseY + wallH + 0.78, -0.4);
    hGroup.add(clerestory);

    // Warm interior ceiling light panel so interior is warmly illuminated!
    const ceilingLampGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.08, 2.6));
    const ceilingLamp = new THREE.Mesh(ceilingLampGeo, lampGlowMat);
    ceilingLamp.position.set(0, baseY + wallH - 0.06, 0);
    hGroup.add(ceilingLamp);

    // 7. Furnished Interior (kept along back/sides so player & NPCs have wide open center floor!)
    const fy = h.floorY;

    // Woven living room area rug in center-back
    const rugGeo = trackGeo(new THREE.BoxGeometry(4.4, 0.025, 3.2));
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.position.set(-0.6, fy + 0.015, -1.2);
    hGroup.add(rug);

    // Plush Lounge Sofa against back wall
    const sofaBaseGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.45, 1.05));
    const sofaBase = new THREE.Mesh(sofaBaseGeo, sofaMat);
    sofaBase.position.set(-0.6, fy + 0.24, -hd + 1.25);
    hGroup.add(sofaBase);

    const sofaBackGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.52, 0.24));
    const sofaBack = new THREE.Mesh(sofaBackGeo, sofaMat);
    sofaBack.position.set(-0.6, fy + 0.68, -hd + 0.85);
    hGroup.add(sofaBack);

    // Low wooden coffee table in front of sofa
    const tableTopGeo = trackGeo(new THREE.BoxGeometry(1.7, 0.08, 0.85));
    const tableTop = new THREE.Mesh(tableTopGeo, woodMat);
    tableTop.position.set(-0.6, fy + 0.44, -hd + 2.75);
    hGroup.add(tableTop);
    const legGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.42, 0.08));
    for (const lx of [-0.72, 0.72]) {
      for (const lz of [-0.32, 0.32]) {
        const leg = new THREE.Mesh(legGeo, darkTrimMat);
        leg.position.set(-0.6 + lx, fy + 0.21, -hd + 2.75 + lz);
        hGroup.add(leg);
      }
    }

    // Coastal Sunset Painting framed on the back interior wall
    const frameGeo = trackGeo(new THREE.BoxGeometry(2.3, 1.55, 0.08));
    const frame = new THREE.Mesh(frameGeo, woodMat);
    frame.position.set(-0.6, fy + 2.35, -hd + t + 0.05);
    hGroup.add(frame);
    const canvasGeo = trackGeo(new THREE.PlaneGeometry(2.05, 1.32));
    const painting = new THREE.Mesh(canvasGeo, artMat);
    painting.position.set(-0.6, fy + 2.35, -hd + t + 0.1);
    hGroup.add(painting);

    // Side credenza / kitchen bar counter along right interior wall (+X)
    const counterGeo = trackGeo(new THREE.BoxGeometry(0.95, 0.92, 3.8));
    const counter = new THREE.Mesh(counterGeo, woodMat);
    counter.position.set(hw - 1.0, fy + 0.46, -0.8);
    hGroup.add(counter);
    const counterTopGeo = trackGeo(new THREE.BoxGeometry(1.05, 0.08, 3.9));
    const counterTop = new THREE.Mesh(counterTopGeo, porchMat);
    counterTop.position.set(hw - 1.0, fy + 0.94, -0.8);
    hGroup.add(counterTop);

    // Standing warm floor lamp in back-left corner
    const lampStemGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 1.75, 8));
    const lampStem = new THREE.Mesh(lampStemGeo, darkTrimMat);
    lampStem.position.set(-hw + 1.25, fy + 0.88, -hd + 1.25);
    hGroup.add(lampStem);
    const lampShadeGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.34, 0.42, 12));
    const lampShade = new THREE.Mesh(lampShadeGeo, lampGlowMat);
    lampShade.position.set(-hw + 1.25, fy + 1.82, -hd + 1.25);
    hGroup.add(lampShade);

    // Indoor potted coastal plant in back-right corner
    const potGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.24, 0.46, 10));
    const pot = new THREE.Mesh(potGeo, trimMat);
    pot.position.set(hw - 1.25, fy + 0.23, -hd + 1.35);
    hGroup.add(pot);
    const leafGeo = trackGeo(new THREE.ConeGeometry(0.45, 0.95, 7));
    const leaf = new THREE.Mesh(leafGeo, plantLeafMat);
    leaf.position.set(hw - 1.25, fy + 0.88, -hd + 1.35);
    hGroup.add(leaf);

    group.add(hGroup);
  }

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
