import React from 'react';
import type { CameraMode, CarTelemetry } from '../types';
import type { CityLayout } from '../game/cityLayout';

interface DrivingHudProps {
  telemetry: CarTelemetry;
  layout: CityLayout;
  muted: boolean;
  studioOpen: boolean;
  onCycleCamera: () => void;
  onTogglePlayerMode: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onToggleStudio: () => void;
  onResetCar: () => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  hood: 'HOOD',
  orbit: 'ORBIT',
};

export const DrivingHud: React.FC<DrivingHudProps> = ({
  telemetry,
  layout,
  muted,
  studioOpen,
  onCycleCamera,
  onTogglePlayerMode,
  onToggleMute,
  onTogglePause,
  onToggleStudio,
  onResetCar,
}) => {
  const isOnFoot = telemetry.playerMode === 'on-foot';
  const rpmSegments = 14;
  const activeSegments = Math.max(1, Math.round(Math.min(1, telemetry.rpmRatio) * rpmSegments));

  // Expanded 320m x 360m city minimap transform: x in [-104, 234] (span 338), z in [-168, 168] (span 336)
  const MIN_X = -104;
  const SPAN_X = 338;
  const MIN_Z = -168;
  const SPAN_Z = 336;
  const mapX = (wx: number) => ((wx - MIN_X) / SPAN_X) * 116;
  const mapZ = (wz: number) => ((wz - MIN_Z) / SPAN_Z) * 116;
  const playerMapX = mapX(telemetry.posX);
  const playerMapY = mapZ(telemetry.posZ);
  const playerDeg = (-telemetry.heading * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Subtle collision peripheral flash */}
      {telemetry.impactFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-4 border-[#ff7c4d]"
          style={{ opacity: telemetry.impactFlash * 0.55 }}
        />
      )}

      {/* TOP-LEFT: Contextual House Interior / Doorway Prompt (zero overlap with top-right buttons) */}
      {!studioOpen && telemetry.insideHouseName && (
        <div className="fixed top-4 left-5 bg-[#1a121f]/90 border border-[#ffd08a]/55 px-4 py-2 shadow-[0_8px_24px_rgba(10,5,14,0.65)]">
          <div className="font-mono-hud text-xs uppercase tracking-[0.14em] text-[#ffe5bf]">
            INSIDE · {telemetry.insideHouseName}{' '}
            <span className="text-[#ffb978]/85">— Walk out doorway to exit</span>
          </div>
        </div>
      )}

      {!studioOpen && !telemetry.insideHouseName && telemetry.nearbyHouseName && (
        <div className="fixed top-4 left-5 bg-[#1a121f]/88 border border-[#ffb978]/40 px-3.5 py-2 shadow-[0_8px_24px_rgba(10,5,14,0.55)]">
          <div className="font-mono-hud text-[11px] uppercase tracking-[0.12em] text-[#ffe8cc]">
            {isOnFoot
              ? `OPEN DOORWAY · ${telemetry.nearbyHouseName} — Walk Inside`
              : `NEAR ${telemetry.nearbyHouseName} — Press [F] to Walk Inside`}
          </div>
        </div>
      )}

      {/* TOP-RIGHT: Compact square world-matched utility buttons */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          data-testid="toggle-foot-mode"
          disabled={isOnFoot && !telemetry.canEnterCar}
          aria-label={isOnFoot ? 'Enter car' : 'Exit car to walk and enter houses'}
          title={isOnFoot ? 'Enter Car [F]' : 'Exit Car / Walk Inside Houses [F]'}
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePlayerMode();
          }}
          className={`h-10 px-3 flex items-center gap-2 border text-xs font-mono-hud tracking-wider transition-colors ${
            isOnFoot && !telemetry.canEnterCar
              ? 'bg-[#1a121f]/65 border-[#ffb978]/20 text-[#fff2e3]/45 cursor-not-allowed'
              : isOnFoot
                ? 'bg-[#e85a32] hover:bg-[#f26b42] border-[#ffd6a8] text-[#fff8f0] cursor-pointer'
                : 'bg-[#1a121f]/88 hover:bg-[#2a1d30] border-[#ffb978]/35 text-[#fff2e3] cursor-pointer'
          }`}
        >
          <span>{isOnFoot ? 'ENTER CAR' : 'WALK'}</span>
          <span className="opacity-75">[F]</span>
        </button>

        {!isOnFoot && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Switch camera view (${CAMERA_LABELS[telemetry.cameraMode]})`}
            title="Camera View [C]"
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            className="h-10 px-3 flex items-center gap-2 bg-[#1a121f]/88 hover:bg-[#2a1d30] border border-[#ffb978]/35 text-[#fff2e3] text-xs font-mono-hud tracking-wider cursor-pointer transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-[#ffb978]" strokeWidth="2">
              <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
            <span>{CAMERA_LABELS[telemetry.cameraMode]}</span>
            <span className="text-[#ffb978]/75">[C]</span>
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-label={studioOpen ? 'Close Studio & Tuner' : 'Open Studio & Tuner'}
          aria-expanded={studioOpen}
          title="Lighting, Physics & AI Studio [T]"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleStudio();
          }}
          className={`h-10 px-3 flex items-center gap-2 border text-xs font-mono-hud tracking-wider cursor-pointer transition-colors ${
            studioOpen
              ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
              : 'bg-[#1a121f]/88 hover:bg-[#2a1d30] border-[#ffb978]/35 text-[#fff2e3]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="9" cy="6" r="2" fill="currentColor" />
            <circle cx="15" cy="12" r="2" fill="currentColor" />
            <circle cx="11" cy="18" r="2" fill="currentColor" />
          </svg>
          <span>STUDIO</span>
          <span className="opacity-75">[T]</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Reset car to intersection"
          title="Reset Car [R]"
          onClick={(e) => {
            e.currentTarget.blur();
            onResetCar();
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#1a121f]/88 hover:bg-[#2a1d30] border border-[#ffb978]/35 text-[#fff2e3] cursor-pointer transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-[#ffb978]" strokeWidth="2">
            <path d="M4 12a8 8 0 1 1 2.3 5.6" />
            <path d="M4 7v5h5" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          title="Toggle Audio [M]"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#1a121f]/88 hover:bg-[#2a1d30] border border-[#ffb978]/35 text-[#fff2e3] cursor-pointer transition-colors"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-[#ff8c6b]" strokeWidth="2">
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              <path d="M22 9l-6 6M16 9l6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-[#ffb978]" strokeWidth="2">
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause game"
          title="Pause [Esc]"
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePause();
          }}
          className="w-10 h-10 flex items-center justify-center bg-[#1a121f]/88 hover:bg-[#2a1d30] border border-[#ffb978]/35 text-[#fff2e3] cursor-pointer transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#ffb978]">
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        </button>
      </div>

      {/* BOTTOM-LEFT: Expanded Coastal City Minimap + Compact Controls Reference */}
      {!studioOpen && (
        <div className="fixed bottom-5 left-5 flex items-end gap-3">
          <div className="bg-[#18101d]/88 border border-[#ffb978]/35 p-1.5 shadow-[0_8px_24px_rgba(10,5,14,0.6)]">
            <svg viewBox="0 0 116 116" className="w-[108px] h-[108px] block" aria-label="Coastal City Minimap">
              {/* Ocean strip on West */}
              <rect x="0" y="0" width={mapX(-94)} height="116" fill="#1b3a54" />
              {/* City land */}
              <rect x={mapX(-94)} y="0" width={116 - mapX(-94)} height="116" fill="#2a2230" />

              {/* Roads */}
              {layout.roads.map((r, idx) => {
                const rw = r.axis === 'ns' ? r.width : r.length;
                const rd = r.axis === 'ns' ? r.length : r.width;
                const x1 = mapX(r.x - rw / 2);
                const y1 = mapZ(r.z - rd / 2);
                const w = (rw / SPAN_X) * 116;
                const h = (rd / SPAN_Z) * 116;
                return <rect key={idx} x={x1} y={y1} width={w} height={h} fill="#4c4352" />;
              })}

              {/* Buildings */}
              {layout.buildings.map((b) => {
                const bx = mapX(b.x - b.width / 2);
                const by = mapZ(b.z - b.depth / 2);
                const bw = (b.width / SPAN_X) * 116;
                const bh = (b.depth / SPAN_Z) * 116;
                return (
                  <rect
                    key={b.id}
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill="#6c5955"
                    stroke="#ffb978"
                    strokeOpacity="0.2"
                    strokeWidth="0.4"
                  />
                );
              })}

              {/* Enterable Coastal Houses highlighted in warm gold */}
              {layout.enterableHouses.map((h) => {
                const hx = mapX(h.x - h.width / 2);
                const hy = mapZ(h.z - h.depth / 2);
                const hw = (h.width / SPAN_X) * 116;
                const hh = (h.depth / SPAN_Z) * 116;
                return (
                  <rect
                    key={h.id}
                    x={hx}
                    y={hy}
                    width={hw}
                    height={hh}
                    fill="#f2a950"
                    stroke="#fff3d6"
                    strokeWidth="0.7"
                  />
                );
              })}

              {/* Live player chevron */}
              <g transform={`translate(${playerMapX}, ${playerMapY}) rotate(${playerDeg})`}>
                <polygon
                  points="0,-5 3.6,4 0,2 -3.6,4"
                  fill={isOnFoot ? '#52e5b8' : '#ff7a45'}
                  stroke="#fff4e6"
                  strokeWidth="0.9"
                />
              </g>
            </svg>
          </div>

          <div className="hidden sm:block pb-1">
            <div className="font-mono-hud text-[11px] uppercase tracking-[0.14em] text-[#ffd7b0]/90 hud-text-shadow">
              {telemetry.insideHouseName
                ? `${telemetry.insideHouseName} · Interior`
                : 'Pacific Blvd · Expanded Sunset City'}
            </div>
            <div className="font-mono-hud text-[11px] tracking-[0.08em] text-[#fff2e6]/80 hud-text-shadow mt-0.5">
              {isOnFoot
                ? 'W/S Walk · A/D Turn · Shift Run · F Re-Enter Car'
                : 'W/S Accel·Rev · A/D Steer · Space Drift · F Walk · C Cam'}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT: Speedometer (KM/H) or On-Foot Readout */}
      {!studioOpen && (
        <div className="fixed bottom-5 right-5 flex flex-col items-end gap-1.5">
          {telemetry.isDrifting && (
            <div className="px-2.5 py-0.5 bg-[#e85a32] border border-[#ffd6a8] font-mono-hud text-[11px] font-bold tracking-[0.16em] text-[#fff8f0] uppercase">
              DRIFT · {telemetry.driftScore} PTS
            </div>
          )}

          <div className="relative bg-[#18101d]/90 border border-[#ffb978]/35 px-4 pt-3 pb-2.5 shadow-[0_8px_24px_rgba(10,5,14,0.6)] min-w-[184px]">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-[#ffb978]/85">
                  {isOnFoot ? 'ON FOOT' : 'SPEED'}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    data-testid="hud-speed"
                    className="font-mono-hud text-4xl font-bold leading-none text-[#fff7ed]"
                  >
                    {telemetry.speedKmh}
                  </span>
                  <span className="font-mono-hud text-[11px] font-bold tracking-widest text-[#ffb978]">
                    KM/H
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center w-9 h-10 bg-[#2a1b2e] border border-[#ffb978]/40">
                <span className="font-mono-hud text-[9px] text-[#ffb978]/75 leading-none">
                  {isOnFoot ? 'M' : 'G'}
                </span>
                <span
                  data-testid="hud-gear"
                  className="font-mono-hud text-lg font-bold leading-tight text-[#fff5e8]"
                >
                  {telemetry.gear}
                </span>
              </div>
            </div>

            {!isOnFoot && (
              <div className="grid grid-cols-14 gap-1 mt-3 mb-2" aria-hidden="true">
                {Array.from({ length: rpmSegments }).map((_, idx) => {
                  const lit = idx < activeSegments;
                  const isRedline = idx >= 11;
                  return (
                    <div
                      key={idx}
                      className="h-2"
                      style={{
                        backgroundColor: lit
                          ? isRedline
                            ? '#ff4e33'
                            : '#ffad5c'
                          : 'rgba(255, 220, 190, 0.14)',
                      }}
                    />
                  );
                })}
              </div>
            )}

            <div className={`flex items-center justify-between text-[10px] font-mono-hud text-[#f2d6be]/80 ${isOnFoot ? 'mt-2.5' : ''}`}>
              <span>{isOnFoot ? `ELEV ${telemetry.elevationY.toFixed(2)}M` : `DRIFT ${telemetry.driftScore}`}</span>
              <span>{telemetry.distanceKm.toFixed(2)} KM</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
