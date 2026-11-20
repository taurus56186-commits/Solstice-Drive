import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { LightingPresetId, WorldSettings } from '../types';

export interface LightingPresetConfig {
  sunElevation: number;
  sunAzimuth: number; // degrees
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  exposure: number;
  windowEmissiveIntensity: number;
  streetlightIntensity: number;
}

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPresetConfig> = {
  'golden-sunset': {
    sunElevation: 5.2,
    sunAzimuth: -112, // Low golden sun glowing across Pacific Ocean & intersection
    sunColor: 0xff9347,
    sunIntensity: 3.3,
    hemiSkyColor: 0x6976b0,
    hemiGroundColor: 0x5c342e,
    hemiIntensity: 1.0,
    fogColor: 0xdc8864,
    fogDensity: 0.0042,
    turbidity: 10.5,
    rayleigh: 3.15,
    mieCoefficient: 0.015,
    mieDirectionalG: 0.89,
    exposure: 1.05,
    windowEmissiveIntensity: 1.35,
    streetlightIntensity: 24,
  },
  'twilight-dusk': {
    sunElevation: 2.4,
    sunAzimuth: -118,
    sunColor: 0xff7547,
    sunIntensity: 1.75,
    hemiSkyColor: 0x455894,
    hemiGroundColor: 0x2d1e2b,
    hemiIntensity: 0.9,
    fogColor: 0x62445c,
    fogDensity: 0.0046,
    turbidity: 10,
    rayleigh: 3.2,
    mieCoefficient: 0.012,
    mieDirectionalG: 0.88,
    exposure: 1.0,
    windowEmissiveIntensity: 1.95,
    streetlightIntensity: 32,
  },
  'coastal-afternoon': {
    sunElevation: 24,
    sunAzimuth: -108,
    sunColor: 0xfff0d4,
    sunIntensity: 3.4,
    hemiSkyColor: 0x8cc2eb,
    hemiGroundColor: 0x6e5a4b,
    hemiIntensity: 1.15,
    fogColor: 0xc2d5e3,
    fogDensity: 0.0024,
    turbidity: 4.5,
    rayleigh: 1.4,
    mieCoefficient: 0.004,
    mieDirectionalG: 0.78,
    exposure: 1.05,
    windowEmissiveIntensity: 0.35,
    streetlightIntensity: 4,
  },
};

export interface LightingRig {
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  sky: Sky;
  sunDirection: THREE.Vector3;
  applySettings: (
    settings: WorldSettings,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    windowMaterials: THREE.MeshStandardMaterial[],
    streetPointLights: THREE.PointLight[],
    roadMaterials: THREE.MeshStandardMaterial[],
  ) => void;
  trackCarShadow: (carX: number, carZ: number) => void;
  dispose: () => void;
}

export function createLightingRig(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): LightingRig {
  // Mandatory studio PBR environment map for crisp metallic & reflective car/glass surfaces
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmremGenerator.dispose();

  // Realistic atmospheric Sky dome
  const sky = new Sky();
  sky.scale.setScalar(1200);
  scene.add(sky);

  const sunDirection = new THREE.Vector3();

  // Warm key directional sun light (with tight tracking orthographic shadow frustum)
  const sunLight = new THREE.DirectionalLight(0xffa65c, 3.1);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 210;
  const d = 52;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Cool coastal twilight sky / warm ground bounce hemisphere fill
  const hemiLight = new THREE.HemisphereLight(0x7d8ec2, 0x5c3832, 1.05);
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  // Fog matching sunset horizon
  scene.fog = new THREE.FogExp2(0xd98f6c, 0.0038);

  const applySettings = (
    settings: WorldSettings,
    targetRenderer: THREE.WebGLRenderer,
    targetScene: THREE.Scene,
    windowMaterials: THREE.MeshStandardMaterial[],
    streetPointLights: THREE.PointLight[],
    roadMaterials: THREE.MeshStandardMaterial[],
  ) => {
    const preset = LIGHTING_PRESETS[settings.lightingPreset];
    const elevation = settings.sunElevation;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(preset.sunAzimuth);

    sunDirection.setFromSphericalCoords(1, phi, theta);

    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = preset.turbidity;
    uniforms['rayleigh'].value = preset.rayleigh;
    uniforms['mieCoefficient'].value = preset.mieCoefficient;
    uniforms['mieDirectionalG'].value = preset.mieDirectionalG;
    uniforms['sunPosition'].value.copy(sunDirection);

    sunLight.color.setHex(preset.sunColor);
    // Modulate sun intensity gently if user slides elevation very low
    const elevFactor = THREE.MathUtils.clamp((elevation + 2) / 10, 0.45, 1.15);
    sunLight.intensity = preset.sunIntensity * elevFactor;
    sunLight.position.copy(sunDirection).multiplyScalar(110);

    hemiLight.color.setHex(preset.hemiSkyColor);
    hemiLight.groundColor.setHex(preset.hemiGroundColor);
    hemiLight.intensity = preset.hemiIntensity;

    targetRenderer.toneMappingExposure = preset.exposure;

    if (targetScene.fog instanceof THREE.FogExp2) {
      targetScene.fog.color.setHex(preset.fogColor);
      targetScene.fog.density = settings.fogDensity;
    }

    for (const mat of windowMaterials) {
      mat.emissiveIntensity = preset.windowEmissiveIntensity;
    }
    for (const pl of streetPointLights) {
      pl.intensity = preset.streetlightIntensity;
    }
    // Adjust asphalt specular sheen (roadWetness 0..1 -> roughness 0.92..0.46)
    const roadRough = THREE.MathUtils.lerp(0.92, 0.46, settings.roadWetness);
    for (const rm of roadMaterials) {
      rm.roughness = roadRough;
      rm.envMapIntensity = THREE.MathUtils.lerp(0.55, 1.45, settings.roadWetness);
    }
  };

  const trackCarShadow = (carX: number, carZ: number) => {
    sunLight.target.position.set(carX, 0, carZ);
    sunLight.position.set(
      carX + sunDirection.x * 110,
      Math.max(12, sunDirection.y * 110),
      carZ + sunDirection.z * 110,
    );
  };

  return {
    sunLight,
    hemiLight,
    sky,
    sunDirection,
    applySettings,
    trackCarShadow,
    dispose: () => {
      envRT.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
    },
  };
}
