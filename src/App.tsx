import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_WORLD_SETTINGS,
  type CameraMode,
  type CarTelemetry,
  type GameState,
  type WorldSettings,
} from './types';
import { createCityLayout } from './game/cityLayout';
import { DrivingEngine } from './game/DrivingEngine';
import { TitleOverlay } from './components/TitleOverlay';
import { DrivingHud } from './components/DrivingHud';
import { PauseModal } from './components/PauseModal';
import { CreativeStudioDrawer } from './components/CreativeStudioDrawer';

const INITIAL_TELEMETRY: CarTelemetry = {
  speedKmh: 0,
  rpmRatio: 0.14,
  gear: 'N',
  isDrifting: false,
  driftScore: 0,
  topSpeedKmh: 0,
  distanceKm: 0,
  cameraMode: 'chase',
  posX: 3.6,
  posZ: 27,
  heading: 0,
  steerAngle: 0,
  braking: false,
  impactFlash: 0,
};

export default function App() {
  const autostart = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  }, []);

  const [gameState, setGameState] = useState<GameState>(autostart ? 'playing' : 'title');
  const [telemetry, setTelemetry] = useState<CarTelemetry>(INITIAL_TELEMETRY);
  const [settings, setSettings] = useState<WorldSettings>(DEFAULT_WORLD_SETTINGS);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DrivingEngine | null>(null);
  const layout = useMemo(() => createCityLayout(), []);

  // Stable refs for callbacks so WebGL engine mounts strictly once
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const studioOpenRef = useRef<boolean>(studioOpen);
  studioOpenRef.current = studioOpen;

  const transitionState = useCallback((next: GameState) => {
    document.body.dataset.state = next;
    gameStateRef.current = next;
    setGameState(next);
    if (next !== 'playing') {
      setStudioOpen(false);
      engineRef.current?.setStudioOpen(false);
    }
    engineRef.current?.setGameState(next);
  }, []);

  // Keep body data-state synchronized on initial mount
  useEffect(() => {
    document.body.dataset.state = gameStateRef.current;
  }, []);

  // Mount Three.js DrivingEngine once inside isolated canvas container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new DrivingEngine(mountEl, DEFAULT_WORLD_SETTINGS, {
      onTelemetry: (t) => setTelemetry(t),
      onStartRequested: () => {
        if (gameStateRef.current === 'title') {
          transitionState('playing');
        }
      },
      onPauseRequested: () => {
        if (gameStateRef.current === 'playing') {
          if (studioOpenRef.current) {
            setStudioOpen(false);
            engine.setStudioOpen(false);
          } else {
            transitionState('paused');
          }
        } else if (gameStateRef.current === 'paused') {
          transitionState('playing');
        }
      },
      onCameraModeChange: (mode) => setCameraMode(mode),
      onMuteChange: (m) => setMuted(m),
      onToggleStudio: () => {
        if (gameStateRef.current !== 'playing') return;
        const nextOpen = !studioOpenRef.current;
        setStudioOpen(nextOpen);
        engine.setStudioOpen(nextOpen);
      },
    });

    engineRef.current = engine;
    if (gameStateRef.current === 'playing') {
      engine.setGameState('playing');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [transitionState]);

  const handleUpdateSettings = useCallback((next: WorldSettings) => {
    setSettings(next);
    engineRef.current?.updateWorldSettings(next);
  }, []);

  const handleSetCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleCycleCamera = useCallback(() => {
    engineRef.current?.cycleCameraMode();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleResetCar = useCallback(() => {
    engineRef.current?.resetCar();
  }, []);

  const handleToggleStudio = useCallback(() => {
    setStudioOpen((prev) => {
      const next = !prev;
      engineRef.current?.setStudioOpen(next);
      return next;
    });
  }, []);

  const handleCaptureSnapshot = useCallback(() => {
    return engineRef.current?.captureSnapshot() ?? '';
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#120e14]">
      {/* Isolated WebGL canvas mount (React HUD updates never re-create the renderer) */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full" />

      {gameState === 'title' && (
        <TitleOverlay onStart={() => transitionState('playing')} />
      )}

      {gameState === 'playing' && (
        <>
          <DrivingHud
            telemetry={telemetry}
            layout={layout}
            muted={muted}
            studioOpen={studioOpen}
            onCycleCamera={handleCycleCamera}
            onToggleMute={handleToggleMute}
            onTogglePause={() => transitionState('paused')}
            onToggleStudio={handleToggleStudio}
            onResetCar={handleResetCar}
          />
          <CreativeStudioDrawer
            open={studioOpen}
            onClose={() => {
              setStudioOpen(false);
              engineRef.current?.setStudioOpen(false);
            }}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            cameraMode={cameraMode}
            onSetCameraMode={handleSetCameraMode}
            telemetry={telemetry}
            onCapture3DSnapshot={handleCaptureSnapshot}
          />
        </>
      )}

      {gameState === 'paused' && (
        <PauseModal
          telemetry={telemetry}
          onResume={() => transitionState('playing')}
          onResetCar={handleResetCar}
          onReturnTitle={() => {
            handleResetCar();
            transitionState('title');
          }}
        />
      )}
    </main>
  );
}
