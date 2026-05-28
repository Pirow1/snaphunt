import { useViewTransition } from '../hooks/useViewTransition';

const MAROON = '#800020';

export default function DashboardScreen() {
  const go = useViewTransition();

  return (
    <main className="relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-white">

      {/* Top maroon band */}
      <div className="w-full flex-shrink-0" style={{ height: 5, background: MAROON }} />

      {/* Header */}
      <div className="flex flex-col items-center px-6 pt-9 pb-5 text-center">

        {/* City label */}
        <div
          className="mb-3 text-[10px] uppercase tracking-[0.35em]"
          style={{ color: MAROON, fontFamily: '"JetBrains Mono", monospace' }}
        >
          ✦ &nbsp; Potchefstroom &nbsp; ✦
        </div>

        {/* Main title */}
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", "Fraunces", Georgia, serif',
            fontSize: 'clamp(40px, 12vw, 56px)',
            fontWeight: 600,
            fontStyle: 'italic',
            color: '#0A0A0A',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
          }}
        >
          Potch<br />Treasure Hunt
        </h1>

        {/* Maroon rule */}
        <div className="mt-6 flex w-full max-w-[300px] items-center gap-3">
          <div className="h-px flex-1" style={{ background: MAROON }} />
          <div className="text-[8px]" style={{ color: MAROON }}>◆</div>
          <div className="h-px flex-1" style={{ background: MAROON }} />
        </div>

        <p
          className="mt-3 text-[10px] uppercase tracking-[0.25em]"
          style={{ color: '#888888', fontFamily: '"JetBrains Mono", monospace' }}
        >
          Select your game mode
        </p>
      </div>

      {/* Game cards */}
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6">

        {/* ── SNAPHUNT ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => go('/snaphunt')}
          className="group relative overflow-hidden text-left transition-transform active:scale-[0.98]"
          style={{ borderRadius: 4, border: `2px solid ${MAROON}` }}
        >
          {/* Forest background */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(140deg, #091408 0%, #1A2E14 55%, #243A1A 100%)' }}
          />
          {/* Warm gold bloom */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-25"
            style={{ background: 'radial-gradient(circle at 80% 20%, #E8B547, transparent 70%)' }}
          />

          <div className="relative px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="mb-1 text-[10px] uppercase tracking-[0.25em]"
                  style={{ color: '#E8B547', fontFamily: '"JetBrains Mono", monospace' }}
                >
                  Game Mode I
                </div>
                <div
                  className="leading-none"
                  style={{
                    fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
                    fontSize: 30,
                    fontWeight: 800,
                    color: '#F4E8D0',
                    letterSpacing: '0.04em',
                  }}
                >
                  SNAPHUNT
                </div>
                <div
                  className="mt-1.5 text-[13px]"
                  style={{ color: '#8A7040', fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
                >
                  Photographic hide &amp; seek
                </div>
              </div>
              <div className="text-[36px] leading-none flex-shrink-0">🌿</div>
            </div>

            {/* SnapHunt-style button */}
            <div
              className="mt-4 inline-block"
              style={{
                background: '#E94F2A',
                color: '#F4E8D0',
                fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '8px 18px',
                borderRadius: 2,
                border: '2px solid #1A1614',
                boxShadow: '3px 3px 0 #1A1614',
              }}
            >
              Play SnapHunt →
            </div>
          </div>
        </button>

        {/* ── RUSH B ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => go('/rushb')}
          className="group relative overflow-hidden text-left transition-transform active:scale-[0.98] w-full"
          style={{ borderRadius: 4, border: `2px solid ${MAROON}` }}
        >
          <RushBCardInner />
          <div className="relative px-5 pb-5 pt-6">
            <div className="flex items-start justify-between gap-3">
              <RushBText />
              <div className="text-[36px] leading-none flex-shrink-0">💣</div>
            </div>
            {/* Rush B-style button */}
            <div
              className="mt-4 inline-block"
              style={{
                background: '#FF2020',
                color: '#FFFFFF',
                fontFamily: '"Share Tech Mono", "JetBrains Mono", monospace',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '8px 18px',
                borderRadius: 2,
              }}
            >
              Play Rush B →
            </div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center px-5 pb-5 text-center">
        <div className="flex w-full max-w-[300px] items-center gap-3 mb-3">
          <div className="h-px flex-1" style={{ background: '#E0D0C8' }} />
          <div className="text-[8px] text-neutral-300">◆</div>
          <div className="h-px flex-1" style={{ background: '#E0D0C8' }} />
        </div>
        <div
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
            fontSize: 12,
            color: '#AAAAAA',
            letterSpacing: '0.05em',
          }}
        >
          North West Province
        </div>
      </div>

      {/* Bottom maroon band */}
      <div
        className="w-full flex-shrink-0"
        style={{ height: 5, background: MAROON }}
      />

      {/* Subtle maroon corner ornaments */}
      <div
        className="pointer-events-none absolute left-0 top-5 h-16 w-[3px]"
        style={{ background: `linear-gradient(to bottom, ${MAROON}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute right-0 top-5 h-16 w-[3px]"
        style={{ background: `linear-gradient(to bottom, ${MAROON}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute bottom-5 left-0 h-16 w-[3px]"
        style={{ background: `linear-gradient(to top, ${MAROON}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute bottom-5 right-0 h-16 w-[3px]"
        style={{ background: `linear-gradient(to top, ${MAROON}, transparent)` }}
      />
    </main>
  );
}

function RushBCardInner() {
  return (
    <>
      {/* Void background */}
      <div className="absolute inset-0" style={{ background: '#0A0A0D' }} />
      {/* Warning stripe top edge */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0"
        style={{
          height: 4,
          background: 'repeating-linear-gradient(-45deg, #FFE000 0px, #FFE000 5px, #000 5px, #000 10px)',
        }}
      />
    </>
  );
}

function RushBText() {
  return (
    <div className="min-w-0">
      <div
        className="mb-1 text-[10px] uppercase tracking-[0.25em]"
        style={{ color: '#FFE000', fontFamily: '"Share Tech Mono", "JetBrains Mono", monospace' }}
      >
        Game Mode II
      </div>
      <div
        className="leading-none"
        style={{
          fontFamily: '"Impact", "Arial Narrow", sans-serif',
          fontSize: 30,
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: '0.08em',
        }}
      >
        RUSH B
      </div>
      <div
        className="mt-1.5 text-[13px]"
        style={{ color: '#404050', fontFamily: '"Share Tech Mono", "JetBrains Mono", monospace' }}
      >
        Plant &amp; defuse the bomb
      </div>
    </div>
  );
}
