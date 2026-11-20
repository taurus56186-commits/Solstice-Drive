export type GameState = 'title' | 'playing' | 'paused';

export type CameraMode = 'chase' | 'hood' | 'orbit';

export type LightingPresetId = 'golden-sunset' | 'twilight-dusk' | 'coastal-afternoon';

export type HandlingPresetId = 'grand-tourer' | 'drift-spec' | 'track-grip';

export type PlayerMode = 'driving' | 'on-foot';

export interface CarTelemetry {
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: string; // 'R' | 'N' | '1'..'6'
  isDrifting: boolean;
  driftScore: number;
  topSpeedKmh: number;
  distanceKm: number;
  cameraMode: CameraMode;
  playerMode: PlayerMode;
  insideHouseName: string | null;
  nearbyHouseName: string | null;
  canEnterCar: boolean;
  elevationY: number;
  posX: number;
  posZ: number;
  heading: number;
  steerAngle: number;
  braking: boolean;
  impactFlash: number; // 0..1
}

export interface WorldSettings {
  lightingPreset: LightingPresetId;
  handlingPreset: HandlingPresetId;
  sunElevation: number; // degrees 2..35
  fogDensity: number; // 0.001..0.009
  roadWetness: number; // 0..1 (lower roughness = more sunset sheen)
}

export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  lightingPreset: 'golden-sunset',
  handlingPreset: 'grand-tourer',
  sunElevation: 5.2,
  fogDensity: 0.0042,
  roadWetness: 0.72,
};

export interface StudioAudioTrack {
  audioDataUrl: string;
  lyrics: string;
  model: string;
  prompt: string;
}

export interface StudioImageResult {
  imageUrl: string;
  caption?: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
}

export interface StudioVideoResult {
  videoUrl: string;
  aspectRatio: '16:9' | '9:16';
  prompt: string;
}
