import React from 'react';
import type { CameraMode, CarTelemetry } from '../types';
import type { CityLayout } from '../game/cityLayout';

interface DrivingHudProps {
  telemetry: CarTelemetry;
  layout: CityLayout;
  muted: boolean;
  studioOpen: boolean;
  onCycleCamera: () => void;
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
  onToggleMute,
  onTogglePause,
  onToggleStudio,
  onResetCar,
}) => {
  // Segmented RPM bar count
  const rpmSegments = 14;
  const activeSegments = Math.max(1, Math.round(Math.min(1, telemetry.rpmRatio) * rpmSegments));

  // Minimap coordinate transform: map world x in [-58, 76], z in [-76, 76] into 116x116 SVG
  const mapX = (wx: number) => ((wx + 58) / 134) * 116;
  const mapZ = (wz: number) => ((wz + 76) / 152) * 116;
  const carMapX = mapX(telemetry.posX);
  const carMapY = mapZ(telemetry.posZ);
  // heading 0 faces -Z (up on minimap); positive heading turns CCW (left)
  const carDeg = (-telemetry.heading * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Subtle collision peripheral flash */}
      {telemetry.impactFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-4 border-[#ff7c4d]"
          style={{ opacity: telemetry.impactFlash * 0.55 }}
        />
      )}

      {/* TOP-RIGHT: Compact square world-matched utility buttons */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto">
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

      {/* BOTTOM-LEFT: Coastal City Minimap + Compact Controls Reference */}
      {!studioOpen && (
        <div className="fixed bottom-5 left-5 flex items-end gap-3">
          <div className="bg-[#18101d]/88 border border-[#ffb978]/35 p-1.5 shadow-[0_8px_24px_rgba(10,5,14,0.6)]">
            <svg viewBox="0 0 116 116" className="w-[104px] h-[104px] block" aria-label="Coastal City Minimap">
              {/* Ocean strip on West */}
              <rect x="0" y="0" width={mapX(-48)} height="116" fill="#1b3a54" />
              {/* City land */}
              <rect x={mapX(-48)} y="0" width={116 - mapX(-48)} height="116" fill="#2a2230" />

              {/* Roads */}
              {layout.roads.map((r, idx) => {
                const rw = r.axis === 'ns' ? r.width : r.length;
                const rd = r.axis === 'ns' ? r.length : r.width;
                const x1 = mapX(r.x - rw / 2);
                const y1 = mapZ(r.z - rd / 2);
                const w = (rw / 134) * 116;
                const h = (rd / 152) * 116;
                return <rect key={idx} x={x1} y={y1} width={w} height={h} fill="#4c4352" />;
              })}

              {/* Buildings */}
              {layout.buildings.map((b) => {
                const bx = mapX(b.x - b.width / 2);
                const by = mapZ(b.z - b.depth / 2);
                const bw = (b.width / 134) * 116;
                const bh = (b.depth / 152) * 116;
                return (
                  <rect
                    key={b.id}
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill="#7c6358"
                    stroke="#ffb978"
                    strokeOpacity="0.25"
                    strokeWidth="0.6"
                  />
                );
              })}

              {/* Live player car chevron */}
              <g transform={`translate(${carMapX}, ${carMapY}) rotate(${carDeg})`}>
                <polygon points="0,-5.5 4,4.5 0,2.2 -4,4.5" fill="#ff7a45" stroke="#fff4e6" strokeWidth="1" />
              </g>
            </svg>
          </div>

          <div className="hidden sm:block pb-1">
            <div className="font-mono-hud text-[11px] uppercase tracking-[0.14em] text-[#ffd7b0]/90 hud-text-shadow">
              Pacific Blvd · Sunset District
            </div>
            <div className="font-mono-hud text-[11px] tracking-[0.08em] text-[#fff2e6]/80 hud-text-shadow mt-0.5">
              W/S Accel·Rev · A/D Steer · Space Drift · C Cam
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT: Speedometer (KM/H), Segmented RPM Gauge, Gear & Drift Telemetry */}
      {!studioOpen && (
        <div className="fixed bottom-5 right-5 flex flex-col items-end gap-1.5">
          {telemetry.isDrifting && (
            <div className="px-2.5 py-0.5 bg-[#e85a32] border border-[#ffd6a8] font-mono-hud text-[11px] font-bold tracking-[0.16em] text-[#fff8f0] uppercase">
              DRIFT · {telemetry.driftScore} PTS
            </div>
          )}

          <div className="relative bg-[#18101d]/90 border border-[#ffb978]/35 px-4 pt-3 pb-2.5 shadow-[0_8px_24px_rgba(10,5,14,0.6)] min-w-[182px]">
            <div className="flex items-end justify-between gap-3">
              {/* Digital Speed Readout */}
              <div className="flex flex-col">
                <span className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-[#ffb978]/85">
                  SPEED
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

              {/* Gear Box */}
              <div className="flex flex-col items-center justify-center w-9 h-10 bg-[#2a1b2e] border border-[#ffb978]/40">
                <span className="font-mono-hud text-[9px] text-[#ffb978]/75 leading-none">G</span>
                <span
                  data-testid="hud-gear"
                  className="font-mono-hud text-lg font-bold leading-tight text-[#fff5e8]"
                >
                  {telemetry.gear}
                </span>
              </div>
            </div>

            {/* Clean Contained Segmented RPM Gauge (Zero Overlap) */}
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

            <div className="flex items-center justify-between text-[10px] font-mono-hud text-[#f2d6be]/80">
              <span>DRIFT {telemetry.driftScore}</span>
              <span>{telemetry.distanceKm.toFixed(2)} KM</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
