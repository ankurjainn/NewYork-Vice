import React from 'react';

interface TitleScreenProps {
  onStart: () => void;
  onQuickMission: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onQuickMission }) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(14, 11, 10, 0.86) 0%, rgba(14, 11, 10, 0.56) 38%, rgba(14, 11, 10, 0.08) 70%, rgba(14, 11, 10, 0) 100%)',
      }}
    >
      {/* Top safe margin */}
      <div className="pt-8 px-10 flex items-center justify-between">
        <span className="text-xs tracking-[0.22em] uppercase text-[#f5cf8d] font-display">
          Washington Square · Times Square · Central Park · Harlem Rucker · SoHo · DUMBO · Flushing · Bronx Arena
        </span>
      </div>

      {/* Asymmetric Left-Third Title Lockup & Actions */}
      <div className="px-10 max-w-xl pointer-events-auto">
        {/* Bespoke inline SVG Title Emblem — Empire Spire + Lady Liberty Crown */}
        <svg
          viewBox="0 0 510 172"
          className="w-full max-w-[480px] h-auto mb-4 overflow-visible"
          role="img"
          aria-label="New York Vice"
        >
          {/* Manhattan skyline crest silhouette */}
          <g transform="translate(0, 6)">
            <path
              d="M10 52 L10 30 L20 30 L20 22 L28 22 L28 52 Z M32 52 L32 24 L40 24 L40 16 L45 16 L45 2 L48 2 L48 16 L53 16 L53 24 L61 24 L61 52 Z M65 52 L65 26 L75 18 L85 26 L85 52 Z"
              fill="#f59e0b"
              stroke="#140d09"
              strokeWidth="2.4"
            />
            <rect x="6" y="52" width="84" height="5" fill="#fff7eb" stroke="#140d09" strokeWidth="1.5" />
            <line x1="106" y1="30" x2="486" y2="30" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.65" />
            <circle cx="486" cy="30" r="4" fill="#f59e0b" />
            <text
              x="108"
              y="22"
              fill="#f7d7a3"
              fontFamily="Chakra Petch, sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="3.8"
            >
              OPEN-WORLD NEW YORK PLAYGROUND
            </text>
          </g>

          {/* Hero Wordmark with crisp dark outer stroke */}
          <text
            x="4"
            y="122"
            fill="#fff8eb"
            stroke="#140d09"
            strokeWidth="7"
            paintOrder="stroke fill"
            fontFamily="Chakra Petch, sans-serif"
            fontSize="60"
            fontWeight="700"
            letterSpacing="2.5"
          >
            NEW YORK
          </text>
          <text
            x="336"
            y="122"
            fill="#f59e0b"
            stroke="#140d09"
            strokeWidth="7"
            paintOrder="stroke fill"
            fontFamily="Chakra Petch, sans-serif"
            fontSize="60"
            fontWeight="700"
            letterSpacing="2.5"
          >
            VICE
          </text>

          {/* Warm accent underline */}
          <rect x="6" y="138" width="246" height="4" fill="#f59e0b" />
          <rect x="260" y="138" width="64" height="4" fill="#fff7eb" fillOpacity="0.7" />
        </svg>

        <p className="text-[15px] leading-relaxed text-[#f2e2ca] max-w-md mb-7">
          Tear down Manhattan avenues in golden Hudson sunset or a roaring Atlantic Nor&apos;easter,
          join live pickup cricket in Central Park and streetball at Rucker Park, grab hot dogs &amp;
          halal carts, sail past Liberty Island, and conquer twenty-two New York street contracts.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="px-7 py-3.5 bg-[#f59e0b] hover:bg-[#fbbf24] active:translate-y-px text-[#160f0b] font-display font-bold text-base tracking-wider uppercase rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff7eb]"
          >
            Enter New York
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onQuickMission();
            }}
            className="px-5 py-3.5 bg-[#1d1612]/90 hover:bg-[#2a201a] text-[#fff4e0] border border-[#f59e0b]/45 font-display font-semibold text-sm tracking-wider uppercase rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]"
          >
            Start Mission 1
          </button>
        </div>
      </div>

      {/* Single flat borderless control hint in bottom safe margin */}
      <div className="pb-6 px-10">
        <p className="text-xs text-[#e5d2b5]/90 tracking-wide font-mono-num">
          WASD Move / Drive · E Ride or Shop · F/V Park Cricket &amp; Hoops · Space Jump / Swing · Shift Nitro · O Outfit · T Weather · M Dispatch
        </p>
      </div>
    </div>
  );
};
