import * as THREE from 'three';
import type { CameraMode, CarTelemetry, GameState, PlayerMode, WorldSettings } from '../types';
import {
  WHEEL_RADIUS,
  computeGearAndRpm,
  createFootPlayerState,
  createInitialCarState,
  stepCarPhysics,
  stepFootPlayerPhysics,
  type CarInput,
  type CarState,
  type FootInput,
  type FootPlayerState,
} from './carPhysics';
import {
  createCityLayout,
  findHouseContainingPoint,
  overlapsAnyCollider,
  type CityLayout,
  type EnterableHouseSpec,
} from './cityLayout';
import { createSportsCar, type CarModelRig } from './carModel';
import { buildCoastalCityScene, type CitySceneAssets } from './cityScene';
import { groundHeightAt } from './groundSurface';
import { animateHumanWalk } from './pedestrianSystem';
import { createLightingRig, type LightingRig } from './lightingRig';
import { DrivingAudioEngine } from './audioEngine';

export interface DrivingEngineCallbacks {
  onTelemetry: (telemetry: CarTelemetry) => void;
  onPauseRequested: () => void;
  onStartRequested: () => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onMuteChange: (muted: boolean) => void;
  onToggleStudio: () => void;
}

// Reusable scratch vectors outside animation loop (Zero-GC)
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();
const _fwdVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _pullTarget = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class DrivingEngine {
  private container: HTMLElement;
  private callbacks: DrivingEngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private layout: CityLayout;
  private lighting: LightingRig;
  private city: CitySceneAssets;
  private carModel: CarModelRig;
  private carState: CarState;
  private footState: FootPlayerState;
  private playerMode: PlayerMode = 'driving';
  private audio: DrivingAudioEngine;

  private settings: WorldSettings;
  private gameState: GameState = 'title';
  private cameraMode: CameraMode = 'chase';
  private studioOpen = false;

  private keysHeld = new Set<string>();
  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsedSec = 0;
  private telemetryTimer = 0;
  private smokeTimer = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private impactFlash = 0;
  private orbitAngle = 0.55;

  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialSettings: WorldSettings,
    callbacks: DrivingEngineCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.settings = { ...initialSettings };
    this.isSoftwareGl = detectSoftwareGl();

    // 1. Renderer setup with ACESFilmicToneMapping + Software WebGL guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'driving-canvas');
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, width / Math.max(1, height), 0.2, 1800);

    // 3. Layout, Lighting, Coastal City & Car Model
    this.layout = createCityLayout();
    this.lighting = createLightingRig(this.scene, this.renderer, this.isSoftwareGl);
    this.city = buildCoastalCityScene(
      this.layout,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.isSoftwareGl,
    );
    this.scene.add(this.city.root);

    this.carModel = createSportsCar();
    this.scene.add(this.carModel.root);

    const spawnGroundY = groundHeightAt(
      this.layout.spawn.x,
      this.layout.spawn.z,
      this.layout.groundSurface,
    );
    this.carState = createInitialCarState(
      this.layout.spawn.x,
      this.layout.spawn.z,
      this.layout.spawn.heading,
      spawnGroundY,
    );
    this.footState = createFootPlayerState(
      this.layout.spawn.x + 2.4,
      this.layout.spawn.z,
      this.layout.spawn.heading,
      spawnGroundY,
    );

    this.audio = new DrivingAudioEngine();
    document.body.dataset.mode = this.playerMode;
    document.body.dataset.insideHouse = '';

    // Apply initial lighting & road wetness settings
    this.lighting.applySettings(
      this.settings,
      this.renderer,
      this.scene,
      this.city.windowMaterials,
      this.city.streetPointLights,
      this.city.roadMaterials,
    );
    this.syncCarVisuals();
    this.snapCameraToState();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Start render loop
    this.lastTimestamp = performance.now();
    this.tick();
  }

  public getLayout(): CityLayout {
    return this.layout;
  }

  public setGameState(next: GameState): void {
    const prev = this.gameState;
    this.gameState = next;
    this.keysHeld.clear();

    if (next === 'playing') {
      this.audio.initFromGesture();
      this.audio.setActive(this.playerMode === 'driving');
      if (prev === 'title') {
        this.snapCameraToState();
      }
      this.emitTelemetry();
    } else {
      this.audio.setActive(false);
    }
  }

  public setStudioOpen(open: boolean): void {
    this.studioOpen = open;
    if (open) {
      this.keysHeld.clear();
    }
  }

  public updateWorldSettings(next: WorldSettings): void {
    this.settings = { ...next };
    this.lighting.applySettings(
      this.settings,
      this.renderer,
      this.scene,
      this.city.windowMaterials,
      this.city.streetPointLights,
      this.city.roadMaterials,
    );
  }

  public cycleCameraMode(): void {
    const order: CameraMode[] = ['chase', 'hood', 'orbit'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    this.callbacks.onCameraModeChange(this.cameraMode);
    this.emitTelemetry();
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.callbacks.onCameraModeChange(mode);
    this.emitTelemetry();
  }

  public togglePlayerMode(): void {
    if (this.gameState !== 'playing') return;

    if (this.playerMode === 'driving') {
      // Stop car smoothly and step out onto safe non-colliding ground beside the car
      this.carState.vx *= 0.15;
      this.carState.vz *= 0.15;
      this.carState.forwardSpeed = 0;
      this.carState.lateralSpeed = 0;
      this.carState.speedKmh = 0;
      this.carState.isDrifting = false;
      this.carState.braking = false;

      const rightX = Math.cos(this.carState.heading);
      const rightZ = -Math.sin(this.carState.heading);
      const fwdX = -Math.sin(this.carState.heading);
      const fwdZ = -Math.cos(this.carState.heading);

      // Prefer sidewalk side (right), then driver left, then rear/front
      const candidates: Array<[number, number]> = [
        [this.carState.x + rightX * 2.5, this.carState.z + rightZ * 2.5],
        [this.carState.x - rightX * 2.5, this.carState.z - rightZ * 2.5],
        [this.carState.x - fwdX * 3.1, this.carState.z - fwdZ * 3.1],
        [this.carState.x + fwdX * 3.1, this.carState.z + fwdZ * 3.1],
      ];

      let exitX = candidates[0][0];
      let exitZ = candidates[0][1];
      for (const [cx, cz] of candidates) {
        if (!overlapsAnyCollider(cx, cz, 0.55, this.layout.colliders)) {
          exitX = cx;
          exitZ = cz;
          break;
        }
      }

      // If near an enterable house, face gently toward its open doorway for effortless entry!
      let exitHeading = this.carState.heading;
      const nearby = this.findNearbyHouse(exitX, exitZ, 26);
      if (nearby) {
        exitHeading = Math.atan2(-(nearby.doorWorldX - exitX), -(nearby.doorWorldZ - exitZ));
      }

      const gy = groundHeightAt(exitX, exitZ, this.layout.groundSurface);
      this.footState = createFootPlayerState(exitX, exitZ, exitHeading, gy);
      this.playerMode = 'on-foot';
      this.city.pedestrianSystem.playerAvatar.root.visible = true;
      this.syncFootVisuals();
      this.audio.setActive(false);
      document.body.dataset.mode = this.playerMode;
      this.emitTelemetry();
    } else {
      // Re-enter car if close enough (within 6.5m)
      const distToCar = Math.hypot(
        this.footState.x - this.carState.x,
        this.footState.z - this.carState.z,
      );
      if (distToCar <= 6.5) {
        this.playerMode = 'driving';
        this.city.pedestrianSystem.playerAvatar.root.visible = false;
        this.audio.setActive(true);
        document.body.dataset.mode = this.playerMode;
        document.body.dataset.insideHouse = '';
        this.emitTelemetry();
      }
    }
  }

  public resetCar(): void {
    const prevTop = this.carState.topSpeedKmh;
    const prevDrift = this.carState.driftScore;
    const prevDist = this.carState.distanceMeters;
    const spawnGroundY = groundHeightAt(
      this.layout.spawn.x,
      this.layout.spawn.z,
      this.layout.groundSurface,
    );
    this.carState = createInitialCarState(
      this.layout.spawn.x,
      this.layout.spawn.z,
      this.layout.spawn.heading,
      spawnGroundY,
    );
    this.carState.topSpeedKmh = prevTop;
    this.carState.driftScore = prevDrift;
    this.carState.distanceMeters = prevDist;
    this.playerMode = 'driving';
    this.city.pedestrianSystem.playerAvatar.root.visible = false;
    document.body.dataset.mode = 'driving';
    document.body.dataset.insideHouse = '';
    this.cameraTrauma = 0;
    this.hitstopTimer = 0;
    this.syncCarVisuals();
    this.snapCameraToState();
    this.emitTelemetry();
  }

  public toggleMute(): boolean {
    this.audio.initFromGesture();
    const nextMuted = !this.audio.isMuted();
    this.audio.setMuted(nextMuted);
    this.callbacks.onMuteChange(nextMuted);
    return nextMuted;
  }

  /** Renders a crisp fresh frame and exports PNG data URL for Creative Studio Photo/Video */
  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private findNearbyHouse(x: number, z: number, maxDist: number): EnterableHouseSpec | null {
    let best: EnterableHouseSpec | null = null;
    let bestD = maxDist;
    for (const h of this.layout.enterableHouses) {
      const d = Math.hypot(x - h.doorWorldX, z - h.doorWorldZ);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  private isTypingInForm(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isTypingInForm(e.target)) return;
    const code = e.code;

    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    if (this.gameState === 'title') {
      if (!e.repeat && (code === 'Enter' || code === 'Space')) {
        this.callbacks.onStartRequested();
      }
      return;
    }

    if (!e.repeat) {
      if (code === 'Escape' || code === 'KeyP') {
        this.callbacks.onPauseRequested();
        return;
      }
      if (this.gameState === 'playing') {
        if (code === 'KeyF') {
          this.togglePlayerMode();
          return;
        }
        if (code === 'KeyC') {
          this.cycleCameraMode();
          return;
        }
        if (code === 'KeyR') {
          this.resetCar();
          return;
        }
        if (code === 'KeyM') {
          this.toggleMute();
          return;
        }
        if (code === 'KeyT') {
          this.callbacks.onToggleStudio();
          return;
        }
      }
    }

    if (this.gameState === 'playing' && !this.studioOpen) {
      this.keysHeld.add(code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.keysHeld.clear();
    }
  };

  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private getCurrentCarInput(): CarInput {
    return {
      throttle: this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp'),
      brakeReverse: this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown'),
      steerLeft: this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft'),
      steerRight: this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight'),
      handbrake: this.keysHeld.has('Space'),
    };
  }

  private getCurrentFootInput(): FootInput {
    return {
      forward: this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp'),
      backward: this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown'),
      left: this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft'),
      right: this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight'),
      sprint: this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight'),
    };
  }

  private syncCarVisuals(): void {
    // Strict point-of-intersection elevation (y >= max ground height under chassis & all 4 wheels!)
    this.carModel.root.position.set(this.carState.x, this.carState.y, this.carState.z);
    this.carModel.root.rotation.y = this.carState.heading;

    // Suspension pitch & body roll on sprung body group
    this.carModel.bodyGroup.rotation.x = this.carState.pitch;
    this.carModel.bodyGroup.rotation.z = this.carState.roll;

    // Independent 4-wheel suspension drop: every wheel rests strictly on its local surface (>= wheelGroundY, zero footpath overlap!)
    for (let i = 0; i < 4; i++) {
      const wheelGround = this.carState.wheelGroundYs[i] ?? this.carState.y;
      const drop = Math.min(0.24, Math.max(0, this.carState.y - wheelGround));
      this.carModel.wheelMountGroups[i].position.y = WHEEL_RADIUS - drop;
    }

    // Front wheel steering pivot
    this.carModel.frontWheelPivots[0].rotation.y = this.carState.steerAngle;
    this.carModel.frontWheelPivots[1].rotation.y = this.carState.steerAngle;

    // Wheel spin rotation (negative X spins top of wheel forward toward -Z)
    for (let i = 0; i < 4; i++) {
      this.carModel.wheelSpinGroups[i].rotation.x = -this.carState.wheelSpin;
    }

    // Dynamic brake light brightness
    this.carModel.brakeLightMaterial.emissiveIntensity = this.carState.braking ? 3.8 : 1.45;
  }

  private syncFootVisuals(): void {
    const avatar = this.city.pedestrianSystem.playerAvatar;
    avatar.root.position.set(this.footState.x, this.footState.y, this.footState.z);
    avatar.root.rotation.y = this.footState.heading;
    animateHumanWalk(avatar, this.footState.walkPhase, this.footState.speedMs > 0.15 ? 1 : 0);
  }

  private snapCameraToState(): void {
    if (this.gameState === 'title') {
      // Unobstructed hero 3/4 sunset vista inside Pacific Blvd corridor framing car, Sunset Terrace Villa, & pedestrians
      this.camera.position.set(-2.6, 3.6, 35.2);
      _currentLookAt.set(3.2, 2.2, 8.0);
      this.camera.lookAt(_currentLookAt);
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
      return;
    }

    const fwdX = -Math.sin(this.carState.heading);
    const fwdZ = -Math.cos(this.carState.heading);
    this.camera.position.set(
      this.carState.x - fwdX * 7.8,
      this.carState.y + 3.15,
      this.carState.z - fwdZ * 7.8,
    );
    _currentLookAt.set(
      this.carState.x + fwdX * 6.0,
      this.carState.y + 1.35,
      this.carState.z + fwdZ * 6.0,
    );
    this.camera.lookAt(_currentLookAt);
    this.camera.fov = 56;
    this.camera.updateProjectionMatrix();
  }

  private updateCamera(dt: number): void {
    if (this.gameState === 'title') {
      const t = this.elapsedSec * 0.25;
      const cx = -2.2 + Math.sin(t) * 2.2;
      const cz = 35.0 + Math.cos(t * 0.7) * 2.4;
      const cy = 3.55 + Math.sin(t * 0.85) * 0.45;
      _desiredCamPos.set(cx, cy, cz);
      _desiredLookAt.set(3.2, 2.25, 6.0);

      const alpha = 1 - Math.exp(-3.0 * dt);
      this.camera.position.lerp(_desiredCamPos, alpha);
      _currentLookAt.lerp(_desiredLookAt, alpha);
      this.camera.lookAt(_currentLookAt);
      return;
    }

    if (this.playerMode === 'on-foot') {
      const insideHouse = findHouseContainingPoint(
        this.footState.x,
        this.footState.z,
        this.layout.enterableHouses,
      );
      _fwdVec.set(-Math.sin(this.footState.heading), 0, -Math.cos(this.footState.heading));

      // Tighter interior camera when inside a 4.4m-tall coastal house so roof/walls never obstruct view
      const followDist = insideHouse ? 2.15 : 3.7;
      const followHeight = insideHouse ? 1.85 : 2.25;
      const lookAhead = insideHouse ? 2.8 : 4.2;

      _desiredCamPos.set(
        this.footState.x - _fwdVec.x * followDist,
        this.footState.y + followHeight,
        this.footState.z - _fwdVec.z * followDist,
      );

      // Pull camera softly inward if it clips into any exterior wall/pillar
      for (const box of this.layout.colliders) {
        if (
          _desiredCamPos.x > box.minX - 0.35 &&
          _desiredCamPos.x < box.maxX + 0.35 &&
          _desiredCamPos.z > box.minZ - 0.35 &&
          _desiredCamPos.z < box.maxZ + 0.35
        ) {
          _pullTarget.set(this.footState.x, this.footState.y + 1.8, this.footState.z);
          _desiredCamPos.lerp(_pullTarget, 0.65);
          break;
        }
      }

      _desiredLookAt.set(
        this.footState.x + _fwdVec.x * lookAhead,
        this.footState.y + 1.38,
        this.footState.z + _fwdVec.z * lookAhead,
      );

      const posDamp = 1 - Math.exp(-8.5 * dt);
      const lookDamp = 1 - Math.exp(-12.0 * dt);
      this.camera.position.lerp(_desiredCamPos, posDamp);
      _currentLookAt.lerp(_desiredLookAt, lookDamp);

      const targetFov = insideHouse ? 62 : 56;
      const fovAlpha = 1 - Math.exp(-6.0 * dt);
      if (Math.abs(this.camera.fov - targetFov) > 0.02) {
        this.camera.fov += (targetFov - this.camera.fov) * fovAlpha;
        this.camera.updateProjectionMatrix();
      }
      this.camera.lookAt(_currentLookAt);
      return;
    }

    _fwdVec.set(-Math.sin(this.carState.heading), 0, -Math.cos(this.carState.heading));
    _rightVec.set(Math.cos(this.carState.heading), 0, -Math.sin(this.carState.heading));

    const speedNorm = Math.min(1, this.carState.speedKmh / 155);
    let targetFov = 56;

    if (this.cameraMode === 'chase') {
      const followDist = 7.4 + speedNorm * 1.85;
      const followHeight = this.carState.y + 2.95 + speedNorm * 0.32;
      const lateralLag = THREE.MathUtils.clamp(this.carState.lateralSpeed * 0.14, -1.5, 1.5);

      _desiredCamPos.set(
        this.carState.x - _fwdVec.x * followDist + _rightVec.x * lateralLag,
        followHeight,
        this.carState.z - _fwdVec.z * followDist + _rightVec.z * lateralLag,
      );

      for (const box of this.layout.colliders) {
        if (
          box.kind !== 'pillar' &&
          _desiredCamPos.x > box.minX - 0.6 &&
          _desiredCamPos.x < box.maxX + 0.6 &&
          _desiredCamPos.z > box.minZ - 0.6 &&
          _desiredCamPos.z < box.maxZ + 0.6
        ) {
          _pullTarget.set(this.carState.x, followHeight + 1.1, this.carState.z);
          _desiredCamPos.lerp(_pullTarget, 0.55);
          break;
        }
      }

      _desiredLookAt.set(
        this.carState.x + _fwdVec.x * (5.5 + speedNorm * 4.5),
        this.carState.y + 1.25,
        this.carState.z + _fwdVec.z * (5.5 + speedNorm * 4.5),
      );

      const posDamp = 1 - Math.exp(-6.8 * dt);
      const lookDamp = 1 - Math.exp(-10.5 * dt);
      this.camera.position.lerp(_desiredCamPos, posDamp);
      _currentLookAt.lerp(_desiredLookAt, lookDamp);
      targetFov = 55 + speedNorm * 11;
    } else if (this.cameraMode === 'hood') {
      _desiredCamPos.set(
        this.carState.x + _fwdVec.x * 0.48,
        this.carState.y + 1.32,
        this.carState.z + _fwdVec.z * 0.48,
      );
      _desiredLookAt.set(
        this.carState.x + _fwdVec.x * 24,
        this.carState.y + 1.12,
        this.carState.z + _fwdVec.z * 24,
      );
      this.camera.position.copy(_desiredCamPos);
      _currentLookAt.copy(_desiredLookAt);
      targetFov = 62 + speedNorm * 9;
    } else {
      this.orbitAngle += dt * 0.42;
      const r = 9.2;
      _desiredCamPos.set(
        this.carState.x + Math.cos(this.orbitAngle) * r,
        this.carState.y + 3.6,
        this.carState.z + Math.sin(this.orbitAngle) * r,
      );
      _desiredLookAt.set(this.carState.x, this.carState.y + 1.1, this.carState.z);
      const damp = 1 - Math.exp(-5.0 * dt);
      this.camera.position.lerp(_desiredCamPos, damp);
      _currentLookAt.lerp(_desiredLookAt, damp);
      targetFov = 52;
    }

    if (this.cameraTrauma > 0.001) {
      const shake = this.cameraTrauma * this.cameraTrauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.65;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.45;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);
    }

    const fovAlpha = 1 - Math.exp(-6.0 * dt);
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov += (targetFov - this.camera.fov) * fovAlpha;
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(_currentLookAt);
  }

  private emitTelemetry(): void {
    const activeX = this.playerMode === 'on-foot' ? this.footState.x : this.carState.x;
    const activeZ = this.playerMode === 'on-foot' ? this.footState.z : this.carState.z;
    const activeY = this.playerMode === 'on-foot' ? this.footState.y : this.carState.y;
    const activeHeading = this.playerMode === 'on-foot' ? this.footState.heading : this.carState.heading;

    const insideHouse =
      this.playerMode === 'on-foot'
        ? findHouseContainingPoint(activeX, activeZ, this.layout.enterableHouses)
        : null;
    const nearbyHouse = insideHouse ? null : this.findNearbyHouse(activeX, activeZ, 18);
    const canEnterCar =
      this.playerMode === 'on-foot' &&
      Math.hypot(this.footState.x - this.carState.x, this.footState.z - this.carState.z) <= 6.5;

    document.body.dataset.mode = this.playerMode;
    document.body.dataset.insideHouse = insideHouse ? insideHouse.id : '';

    const { gear, rpmRatio } = computeGearAndRpm(this.carState.forwardSpeed);
    this.callbacks.onTelemetry({
      speedKmh:
        this.playerMode === 'on-foot'
          ? Math.round(this.footState.speedMs * 3.6)
          : Math.round(this.carState.speedKmh),
      rpmRatio: this.playerMode === 'on-foot' ? 0.08 : rpmRatio,
      gear: this.playerMode === 'on-foot' ? 'W' : gear,
      isDrifting: this.playerMode === 'driving' && this.carState.isDrifting,
      driftScore: Math.round(this.carState.driftScore),
      topSpeedKmh: Math.round(this.carState.topSpeedKmh),
      distanceKm: this.carState.distanceMeters / 1000,
      cameraMode: this.cameraMode,
      playerMode: this.playerMode,
      insideHouseName: insideHouse ? insideHouse.name : null,
      nearbyHouseName: nearbyHouse ? nearbyHouse.name : null,
      canEnterCar,
      elevationY: Number(activeY.toFixed(3)),
      posX: activeX,
      posZ: activeZ,
      heading: activeHeading,
      steerAngle: this.carState.steerAngle,
      braking: this.carState.braking,
      impactFlash: this.impactFlash,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsedSec += dt;

    if (this.impactFlash > 0) {
      this.impactFlash = Math.max(0, this.impactFlash - dt * 3.5);
    }

    if (this.gameState === 'playing') {
      if (this.playerMode === 'driving') {
        if (this.hitstopTimer > 0) {
          this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        } else {
          const input = this.studioOpen
            ? { throttle: false, brakeReverse: false, steerLeft: false, steerRight: false, handbrake: false }
            : this.getCurrentCarInput();

          const stepRes = stepCarPhysics(
            this.carState,
            input,
            dt,
            this.layout.colliders,
            this.layout.worldBounds,
            this.settings.handlingPreset,
            this.layout.groundSurface,
          );

          if (stepRes.collided && stepRes.impactStrength > 0.16) {
            this.cameraTrauma = Math.min(1, this.cameraTrauma + stepRes.impactStrength * 0.78);
            this.impactFlash = Math.min(1, stepRes.impactStrength * 0.9);
            if (stepRes.impactStrength > 0.35) {
              this.hitstopTimer = 0.045;
            }
            this.audio.playImpact(stepRes.impactStrength);
          }

          const { rpmRatio } = computeGearAndRpm(this.carState.forwardSpeed);
          this.audio.update(rpmRatio, this.carState.speedKmh, input.throttle, this.carState.isDrifting);

          if (this.carState.isDrifting) {
            this.smokeTimer += dt;
            if (this.smokeTimer >= 0.032) {
              this.smokeTimer = 0;
              const fwdX = -Math.sin(this.carState.heading);
              const fwdZ = -Math.cos(this.carState.heading);
              const rightX = Math.cos(this.carState.heading);
              const rightZ = -Math.sin(this.carState.heading);
              for (const side of [-0.9, 0.9]) {
                this.city.smokePool.emit(
                  this.carState.x - fwdX * 1.38 + rightX * side,
                  this.carState.y + 0.24,
                  this.carState.z - fwdZ * 1.38 + rightZ * side,
                  -this.carState.vx * 0.12,
                  -this.carState.vz * 0.12,
                );
              }
            }
          }
        }

        this.syncCarVisuals();
        this.lighting.trackCarShadow(this.carState.x, this.carState.z);
      } else {
        const footInput: FootInput = this.studioOpen
          ? { forward: false, backward: false, left: false, right: false, sprint: false }
          : this.getCurrentFootInput();

        stepFootPlayerPhysics(
          this.footState,
          footInput,
          dt,
          this.layout.colliders,
          this.layout.worldBounds,
          this.layout.groundSurface,
        );
        this.syncFootVisuals();
        this.lighting.trackCarShadow(this.footState.x, this.footState.z);
      }
    }

    // Always animate bustling city pedestrians, ocean waves, palm breeze, smoke pool, and camera
    if (this.gameState !== 'paused') {
      const carSpeedMs = Math.hypot(this.carState.vx, this.carState.vz);
      this.city.pedestrianSystem.update(
        dt,
        this.layout.groundSurface,
        this.carState.x,
        this.carState.z,
        carSpeedMs,
      );
      this.city.updateAmbient(this.elapsedSec, dt, this.lighting.sunDirection);
      this.city.smokePool.update(dt, this.camera);
      this.updateCamera(dt);
    }

    // Throttle React HUD state updates to <= 12Hz
    this.telemetryTimer += dt;
    if (this.gameState === 'playing' && this.telemetryTimer >= 0.085) {
      this.telemetryTimer = 0;
      this.emitTelemetry();
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver.disconnect();
    this.audio.dispose();
    this.carModel.dispose();
    this.city.dispose();
    this.lighting.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
