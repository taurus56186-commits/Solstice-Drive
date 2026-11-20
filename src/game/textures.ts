import * as THREE from 'three';

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random helper so procedural textures look rich and consistent
function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface RoadTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export function createRoadTextures(maxAnisotropy: number): RoadTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size, size);
  const [roughC, rCtx] = createCanvas(size, size);
  const [bumpC, bCtx] = createCanvas(size, size);
  const rand = seededRand(42);

  // Base dark coastal asphalt
  aCtx.fillStyle = '#25272d';
  aCtx.fillRect(0, 0, size, size);

  // Base roughness: 0.72 matte asphalt, smoother in worn tire tracks (~0.34) for sunset sheen
  rCtx.fillStyle = '#b8b8b8';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Aggregate mineral speckles
  for (let i = 0; i < 9500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 1 + rand() * 2.2;
    const shade = 26 + Math.floor(rand() * 34);
    aCtx.fillStyle = `rgb(${shade},${shade + 1},${shade + 5})`;
    aCtx.fillRect(x, y, w, w);

    const bVal = 95 + Math.floor(rand() * 68);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(x, y, w, w);
  }

  // Subtle polished wheel tracks & sunset damp sheen bands along the 4 lanes
  const trackPositions = [0.16, 0.34, 0.66, 0.84];
  for (const pos of trackPositions) {
    const cx = pos * size;
    const grad = rCtx.createLinearGradient(cx - 34, 0, cx + 34, 0);
    grad.addColorStop(0, 'rgba(184,184,184,0)');
    grad.addColorStop(0.5, 'rgba(68,68,68,0.88)');
    grad.addColorStop(1, 'rgba(184,184,184,0)');
    rCtx.fillStyle = grad;
    rCtx.fillRect(cx - 34, 0, 68, size);

    const aGrad = aCtx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    aGrad.addColorStop(0, 'rgba(20,22,28,0)');
    aGrad.addColorStop(0.5, 'rgba(14,16,22,0.35)');
    aGrad.addColorStop(1, 'rgba(20,22,28,0)');
    aCtx.fillStyle = aGrad;
    aCtx.fillRect(cx - 28, 0, 56, size);
  }

  // Subtle gutter edge lines
  aCtx.fillStyle = 'rgba(235, 228, 214, 0.78)';
  aCtx.fillRect(14, 0, 6, size);
  aCtx.fillRect(size - 20, 0, 6, size);

  // Double amber-yellow center line
  aCtx.fillStyle = '#e6a83a';
  aCtx.fillRect(size / 2 - 9, 0, 5, size);
  aCtx.fillRect(size / 2 + 4, 0, 5, size);

  // Dashed white lane dividers (left & right 2-lane splits)
  aCtx.fillStyle = 'rgba(244, 240, 232, 0.88)';
  for (let y = 24; y < size; y += 128) {
    aCtx.fillRect(size * 0.25 - 3, y, 6, 62);
    aCtx.fillRect(size * 0.75 - 3, y, 6, 62);
  }

  return {
    map: finalizeTexture(albedoC, true, maxAnisotropy, 1, 1),
    roughnessMap: finalizeTexture(roughC, false, maxAnisotropy, 1, 1),
    bumpMap: finalizeTexture(bumpC, false, maxAnisotropy, 1, 1),
  };
}

export function createIntersectionTexture(maxAnisotropy: number): RoadTextureSet {
  const size = 512;
  const [albedoC, aCtx] = createCanvas(size, size);
  const [roughC, rCtx] = createCanvas(size, size);
  const [bumpC, bCtx] = createCanvas(size, size);
  const rand = seededRand(108);

  aCtx.fillStyle = '#24262c';
  aCtx.fillRect(0, 0, size, size);

  // Reflective center intersection sheen catching sunset sky
  const rGrad = rCtx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.6);
  rGrad.addColorStop(0, '#5a5a5a');
  rGrad.addColorStop(0.65, '#8c8c8c');
  rGrad.addColorStop(1, '#b6b6b6');
  rCtx.fillStyle = rGrad;
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 1 + rand() * 2;
    const shade = 25 + Math.floor(rand() * 32);
    aCtx.fillStyle = `rgb(${shade},${shade + 1},${shade + 4})`;
    aCtx.fillRect(x, y, w, w);

    const bVal = 96 + Math.floor(rand() * 64);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(x, y, w, w);
  }

  // Crisp zebra crosswalks on all 4 edges + stop bars
  aCtx.fillStyle = 'rgba(244, 240, 232, 0.9)';
  const stripeCount = 8;
  const stripeSpacing = 38;
  const startOffset = (size - (stripeCount - 1) * stripeSpacing - 18) / 2;

  for (let i = 0; i < stripeCount; i++) {
    const pos = startOffset + i * stripeSpacing;
    // North & South crosswalks
    aCtx.fillRect(pos, 18, 18, 44);
    aCtx.fillRect(pos, size - 62, 18, 44);
    // West & East crosswalks
    aCtx.fillRect(18, pos, 44, 18);
    aCtx.fillRect(size - 62, pos, 44, 18);
  }

  // Subtle stop bars inside crosswalks
  aCtx.fillStyle = 'rgba(244, 240, 232, 0.72)';
  aCtx.fillRect(size * 0.52, 74, size * 0.36, 7);
  aCtx.fillRect(size * 0.12, size - 81, size * 0.36, 7);
  aCtx.fillRect(74, size * 0.12, 7, size * 0.36);
  aCtx.fillRect(size - 81, size * 0.52, 7, size * 0.36);

  return {
    map: finalizeTexture(albedoC, true, maxAnisotropy, 1, 1),
    roughnessMap: finalizeTexture(roughC, false, maxAnisotropy, 1, 1),
    bumpMap: finalizeTexture(bumpC, false, maxAnisotropy, 1, 1),
  };
}

export function createSidewalkTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const [albedoC, aCtx] = createCanvas(size, size);
  const [bumpC, bCtx] = createCanvas(size, size);
  const rand = seededRand(77);

  aCtx.fillStyle = '#c4b7a6';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#a0a0a0';
  bCtx.fillRect(0, 0, size, size);

  const tiles = 4;
  const step = size / tiles;
  for (let gx = 0; gx < tiles; gx++) {
    for (let gy = 0; gy < tiles; gy++) {
      const tint = Math.floor((rand() - 0.5) * 14);
      aCtx.fillStyle = `rgb(${194 + tint},${180 + tint},${164 + tint})`;
      aCtx.fillRect(gx * step + 2, gy * step + 2, step - 4, step - 4);
    }
  }

  // Fine sandstone speckles
  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 160 + Math.floor(rand() * 48);
    aCtx.fillStyle = `rgba(${v},${v - 8},${v - 16},0.4)`;
    aCtx.fillRect(x, y, 2, 2);
  }

  // Paver joint lines
  aCtx.strokeStyle = 'rgba(92, 82, 74, 0.55)';
  aCtx.lineWidth = 2;
  bCtx.strokeStyle = '#383838';
  bCtx.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    const p = i * step;
    aCtx.beginPath();
    aCtx.moveTo(p, 0);
    aCtx.lineTo(p, size);
    aCtx.moveTo(0, p);
    aCtx.lineTo(size, p);
    aCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(p, 0);
    bCtx.lineTo(p, size);
    bCtx.moveTo(0, p);
    bCtx.lineTo(size, p);
    bCtx.stroke();
  }

  return {
    map: finalizeTexture(albedoC, true, maxAnisotropy, 1, 1),
    bumpMap: finalizeTexture(bumpC, false, maxAnisotropy, 1, 1),
  };
}

export interface BuildingFacadeTextures {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function createBuildingFacadeTextures(
  style: 'glass-tower' | 'terracotta-modern' | 'coastal-hotel' | 'podium-office',
  maxAnisotropy: number,
): BuildingFacadeTextures {
  const w = 512;
  const h = 512;
  const [aC, aCtx] = createCanvas(w, h);
  const [eC, eCtx] = createCanvas(w, h);
  const [rC, rCtx] = createCanvas(w, h);

  const seedMap = {
    'glass-tower': 201,
    'terracotta-modern': 307,
    'coastal-hotel': 419,
    'podium-office': 523,
  };
  const rand = seededRand(seedMap[style]);

  // Base wall material colors & roughness
  const wallBg =
    style === 'glass-tower'
      ? '#344052'
      : style === 'terracotta-modern'
        ? '#9d6652'
        : style === 'coastal-hotel'
          ? '#d6c4ae'
          : '#505b6b';

  aCtx.fillStyle = wallBg;
  aCtx.fillRect(0, 0, w, h);

  // Dark unlit emissive base
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  // Matte spandrel walls (roughness ~ 0.85 -> 216)
  rCtx.fillStyle = '#d8d8d8';
  rCtx.fillRect(0, 0, w, h);

  const cols = style === 'glass-tower' ? 8 : style === 'coastal-hotel' ? 6 : 7;
  const rows = style === 'glass-tower' ? 10 : 8;
  const cellW = w / cols;
  const cellH = h / rows;

  const padX = style === 'glass-tower' ? 4 : 8;
  const padY = style === 'glass-tower' ? 7 : 10;

  for (let row = 0; row < rows; row++) {
    // Horizontal floor slab / balcony band
    if (style === 'coastal-hotel' || style === 'terracotta-modern') {
      aCtx.fillStyle = style === 'coastal-hotel' ? '#e7dbc9' : '#7b4d3e';
      aCtx.fillRect(0, row * cellH + cellH - 8, w, 8);
    }

    for (let col = 0; col < cols; col++) {
      const x = col * cellW + padX;
      const y = row * cellH + padY;
      const ww = cellW - padX * 2;
      const wh = cellH - padY * 2;

      // Reflective tinted glass pane gradient (reflecting golden sunset sky!)
      const g = aCtx.createLinearGradient(x, y, x, y + wh);
      if (style === 'glass-tower') {
        g.addColorStop(0, '#5a6e8a');
        g.addColorStop(0.55, '#3b4a64');
        g.addColorStop(1, '#7c5c59'); // warm sunset reflection near sill
      } else {
        g.addColorStop(0, '#3a4a5e');
        g.addColorStop(0.6, '#273244');
        g.addColorStop(1, '#5d4745');
      }
      aCtx.fillStyle = g;
      aCtx.fillRect(x, y, ww, wh);

      // Glossy glass roughness (~ 0.14 -> 36)
      rCtx.fillStyle = '#242424';
      rCtx.fillRect(x, y, ww, wh);

      // Warm lit interior offices/apartments (~34% lit at golden sunset)
      const roll = rand();
      if (roll < 0.36) {
        const warmth = rand();
        const litColor =
          warmth < 0.55 ? '#ffca80' : warmth < 0.85 ? '#ffae5c' : '#ffe6bd';
        eCtx.fillStyle = litColor;
        eCtx.fillRect(x + 2, y + 2, ww - 4, wh - 4);

        // Subtle interior ceiling blind line
        eCtx.fillStyle = 'rgba(0,0,0,0.28)';
        eCtx.fillRect(x + 2, y + 2, ww - 4, wh * 0.25);
      }
    }
  }

  // Mullion grid accent for glass towers
  if (style === 'glass-tower' || style === 'podium-office') {
    aCtx.fillStyle = '#26303d';
    for (let c = 0; c <= cols; c++) {
      aCtx.fillRect(c * cellW - 1.5, 0, 3, h);
    }
  }

  return {
    map: finalizeTexture(aC, true, maxAnisotropy, 1, 1),
    emissiveMap: finalizeTexture(eC, true, maxAnisotropy, 1, 1),
    roughnessMap: finalizeTexture(rC, false, maxAnisotropy, 1, 1),
  };
}

export function createLobbyFacadeTextures(maxAnisotropy: number): BuildingFacadeTextures {
  const w = 512;
  const h = 256;
  const [aC, aCtx] = createCanvas(w, h);
  const [eC, eCtx] = createCanvas(w, h);
  const [rC, rCtx] = createCanvas(w, h);

  // Dark charcoal granite base & mullions
  aCtx.fillStyle = '#2d2b32';
  aCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = '#cccbc8';
  rCtx.fillRect(0, 0, w, h);

  const bays = 4;
  const bayW = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = i * bayW;
    // Limestone/granite architectural column between storefront bays
    aCtx.fillStyle = '#5a5352';
    aCtx.fillRect(x, 0, 18, h);
    aCtx.fillRect(x + bayW - 10, 0, 10, h);

    // Recessed warm-lit storefront glass bay
    const gx = x + 20;
    const gy = 26;
    const gw = bayW - 32;
    const gh = h - 46;

    const grad = aCtx.createLinearGradient(gx, gy, gx, gy + gh);
    grad.addColorStop(0, '#3a4b61');
    grad.addColorStop(0.55, '#2b3446');
    grad.addColorStop(1, '#5c463d');
    aCtx.fillStyle = grad;
    aCtx.fillRect(gx, gy, gw, gh);

    // Glossy storefront window roughness
    rCtx.fillStyle = '#1f1f1f';
    rCtx.fillRect(gx, gy, gw, gh);

    // Warm golden cafe/lobby interior glow behind glass
    const eGrad = eCtx.createLinearGradient(gx, gy, gx, gy + gh);
    eGrad.addColorStop(0, '#ffcb85');
    eGrad.addColorStop(0.65, '#f09e54');
    eGrad.addColorStop(1, '#633c29');
    eCtx.fillStyle = eGrad;
    eCtx.fillRect(gx + 4, gy + 4, gw - 8, gh - 8);

    // Crisp vertical door mullion & transom bar
    aCtx.fillStyle = '#24252b';
    aCtx.fillRect(gx + gw / 2 - 2, gy, 4, gh);
    aCtx.fillRect(gx, gy + 32, gw, 5);
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(gx + gw / 2 - 2, gy, 4, gh);
    eCtx.fillRect(gx, gy + 32, gw, 5);
  }

  return {
    map: finalizeTexture(aC, true, maxAnisotropy, 1, 1),
    emissiveMap: finalizeTexture(eC, true, maxAnisotropy, 1, 1),
    roughnessMap: finalizeTexture(rC, false, maxAnisotropy, 1, 1),
  };
}

export function createPalmBarkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = createCanvas(128, 256);
  ctx.fillStyle = '#755640';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = '#5c412f';
    ctx.fillRect(0, y, 128, 5);
    ctx.fillStyle = '#8d6c53';
    ctx.fillRect(0, y + 5, 128, 3);
  }
  return finalizeTexture(c, true, maxAnisotropy, 1, 6);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = createCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 22, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(6, 5, 10, 0.88)');
  grad.addColorStop(0.55, 'rgba(8, 6, 12, 0.52)');
  grad.addColorStop(0.85, 'rgba(8, 6, 12, 0.14)');
  grad.addColorStop(1, 'rgba(8, 6, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSmokeTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = createCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 240, 224, 0.82)');
  grad.addColorStop(0.45, 'rgba(230, 208, 195, 0.42)');
  grad.addColorStop(1, 'rgba(210, 190, 180, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
