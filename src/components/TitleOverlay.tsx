import React from 'react';

interface TitleOverlayProps {
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none p-7 sm:p-12">
      {/* Upper-left Title Lockup framed over sunset sky negative space */}
      <div className="max-w-lg mt-4 sm:mt-8 pointer-events-auto">
        <svg
          viewBox="0 0 460 132"
          className="w-[310px] sm:w-[430px] h-auto drop-shadow-[0_6px_22px_rgba(12,6,16,0.78)]"
          role="img"
          aria-label="Solstice Drive"
        >
          {/* Sunset horizon emblem mark */}
          <g transform="translate(8, 12)">
            <clipPath id="sun-clip">
              <circle cx="34" cy="34" r="28" />
            </clipPath>
            <g clipPath="url(#sun-clip)">
              <rect x="4" y="4" width="60" height="32" fill="#ffb86b" />
              <rect x="4" y="36" width="60" height="8" fill="#ff7b47" />
              <rect x="4" y="46" width="60" height="6" fill="#e64b3b" />
              <rect x="4" y="54" width="60" height="10" fill="#a8324c" />
            </g>
            <circle cx="34" cy="34" r="28" fill="none" stroke="#fff0dc" strokeWidth="2.2" />
            {/* Stylized coastal road perspective stripes */}
            <path d="M12 64 L56 64" stroke="#ffb86b" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M22 71 L46 71" stroke="#ff7b47" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Bespoke display title lockup */}
          <text
            x="84"
            y="58"
            fill="#fff5e9"
            stroke="#1b0f1b"
            strokeWidth="4"
            paintOrder="stroke fill"
            fontFamily="Syne, sans-serif"
            fontWeight="800"
            fontSize="44"
            letterSpacing="3"
          >
            SOLSTICE
          </text>
          <text
            x="86"
            y="102"
            fill="#ffae63"
            stroke="#1b0f1b"
            strokeWidth="3.5"
            paintOrder="stroke fill"
            fontFamily="Syne, sans-serif"
            fontWeight="800"
            fontSize="36"
            letterSpacing="11"
          >
            DRIVE
          </text>
          <line x1="86" y1="115" x2="365" y2="115" stroke="#ffae63" strokeOpacity="0.65" strokeWidth="2" />
        </svg>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="px-7 py-3.5 bg-[#e85a32] hover:bg-[#f26b42] active:bg-[#d14a25] text-[#fff8f0] font-display font-bold tracking-[0.14em] text-sm uppercase border-2 border-[#ffd4a6] shadow-[0_10px_28px_rgba(14,6,18,0.65)] transition-colors cursor-pointer"
          >
            Start Drive
          </button>
          <span className="font-mono-hud text-xs uppercase tracking-[0.16em] text-[#ffe8d2]/85 hud-text-shadow">
            Press Enter or Space
          </span>
        </div>
      </div>

      {/* Single flat borderless control-hint line in bottom safe margin */}
      <div className="w-full flex justify-center sm:justify-start">
        <p className="font-mono-hud text-xs sm:text-[13px] tracking-[0.12em] uppercase text-[#fff1e2]/90 hud-text-shadow">
          WASD / Arrows Drive · Space Drift · F Walk &amp; Enter Houses · C Camera · T Studio · Esc Pause
        </p>
      </div>
    </div>
  );
};
