import React from 'react';
import type { CarTelemetry } from '../types';

interface PauseModalProps {
  telemetry: CarTelemetry;
  onResume: () => void;
  onResetCar: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  telemetry,
  onResume,
  onResetCar,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#120b17]/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-md bg-[#1c1322] border-2 border-[#ffb978]/50 p-7 shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between border-b border-[#ffb978]/20 pb-3">
          <h2 id="pause-title" className="font-display text-2xl font-extrabold tracking-[0.14em] uppercase text-[#fff5e9]">
            PAUSED
          </h2>
          <span className="font-mono-hud text-xs uppercase tracking-widest text-[#ffb978]">
            SOLSTICE DRIVE
          </span>
        </div>

        {/* Session telemetry snapshot */}
        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="bg-[#271b2e] border border-[#ffb978]/20 p-3 text-center">
            <div className="font-mono-hud text-[10px] uppercase tracking-wider text-[#f3c79e]/80">
              Top Speed
            </div>
            <div className="font-mono-hud text-xl font-bold text-[#fff6ec] mt-1">
              {telemetry.topSpeedKmh}
              <span className="text-[10px] text-[#ffb978] ml-1">KM/H</span>
            </div>
          </div>

          <div className="bg-[#271b2e] border border-[#ffb978]/20 p-3 text-center">
            <div className="font-mono-hud text-[10px] uppercase tracking-wider text-[#f3c79e]/80">
              Drift Pts
            </div>
            <div className="font-mono-hud text-xl font-bold text-[#fff6ec] mt-1">
              {telemetry.driftScore}
            </div>
          </div>

          <div className="bg-[#271b2e] border border-[#ffb978]/20 p-3 text-center">
            <div className="font-mono-hud text-[10px] uppercase tracking-wider text-[#f3c79e]/80">
              Distance
            </div>
            <div className="font-mono-hud text-xl font-bold text-[#fff6ec] mt-1">
              {telemetry.distanceKm.toFixed(2)}
              <span className="text-[10px] text-[#ffb978] ml-1">KM</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-[#e85a32] hover:bg-[#f26b42] text-[#fff8f0] font-display font-bold tracking-[0.14em] text-sm uppercase border border-[#ffd4a6] cursor-pointer transition-colors"
          >
            Resume Drive
          </button>
          <button
            type="button"
            onClick={() => {
              onResetCar();
              onResume();
            }}
            className="w-full py-2.5 bg-[#2a1d32] hover:bg-[#382742] text-[#fff2e3] font-mono-hud text-xs uppercase tracking-[0.14em] border border-[#ffb978]/35 cursor-pointer transition-colors"
          >
            Reset Car to Intersection
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-transparent hover:bg-[#2a1d32]/60 text-[#f3cbb0] font-mono-hud text-xs uppercase tracking-[0.14em] border border-[#ffb978]/20 cursor-pointer transition-colors"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
