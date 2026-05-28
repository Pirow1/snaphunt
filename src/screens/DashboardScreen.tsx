import type { SVGProps } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';

const MAROON = '#800020';

// ── Botanical SVG components ──────────────────────────────────────────────────

/** Single oak leaf centred at origin, 22px tall, 28px wide.
 *  Has 3 lobes per side and a short petiole, with ghostly white veins. */
function OakLeaf({
  x = 0,
  y = 0,
  rotate = 0,
  scale = 1,
  opacity = 1,
}: {
  x?: number; y?: number; rotate?: number; scale?: number; opacity?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`} opacity={opacity}>
      {/* Leaf body */}
      <path
        d="M 0 -22 C -3 -18 -9 -13 -7 -8 C -11 -11 -16 -6 -13 -1 C -15 -3 -18 1 -14 5 C -16 3 -13 9 -9 9 C -11 13 -10 17 -7 20 C -4 23 0 25 0 25 C 0 25 4 23 7 20 C 10 17 11 13 9 9 C 13 9 16 3 14 5 C 18 1 15 -3 13 -1 C 16 -6 11 -11 7 -8 C 9 -13 3 -18 0 -22 Z"
        fill={MAROON}
      />
      {/* Central vein */}
      <line x1="0" y1="-18" x2="0" y2="22" stroke="white" strokeWidth="0.8" strokeOpacity="0.22" />
      {/* Left veins */}
      <line x1="0" y1="-8" x2="-10" y2="-4" stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      <line x1="0" y1="2"  x2="-11" y2="4"  stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      <line x1="0" y1="11" x2="-9"  y2="14" stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      {/* Right veins */}
      <line x1="0" y1="-8" x2="10"  y2="-4" stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      <line x1="0" y1="2"  x2="11"  y2="4"  stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      <line x1="0" y1="11" x2="9"   y2="14" stroke="white" strokeWidth="0.5" strokeOpacity="0.18" />
      {/* Petiole */}
      <line x1="0" y1="25" x2="0" y2="32" stroke={MAROON} strokeWidth="1.2" />
    </g>
  );
}

/** Spiral tendril — a tight coiling Bezier. */
function Tendril({ x = 0, y = 0, rotate = 0, scale = 1 }: {
  x?: number; y?: number; rotate?: number; scale?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
      <path
        d="M 0 0 C 14 -6 20 8 12 16 C 4 24 -8 20 -10 10 C -12 2 -4 -2 2 4"
        fill="none"
        stroke={MAROON}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Curling stem — gentle cubic bezier stem line. */
function Stem({ d, ...rest }: SVGProps<SVGPathElement> & { d: string }) {
  return <path d={d} fill="none" stroke={MAROON} strokeWidth="1.4" strokeLinecap="round" {...rest} />;
}

/** Top-left corner spray: stem + 3 leaves + 2 tendrils. */
function CornerSprayLeft() {
  return (
    <svg
      width={90}
      height={110}
      viewBox="0 0 90 110"
      className="pointer-events-none absolute"
      style={{ top: 3, left: 4 }}
      aria-hidden="true"
    >
      {/* Main curling stem from bottom-left to upper right */}
      <Stem d="M 8 108 C 12 80 30 60 50 38 C 62 24 70 14 78 8" />
      {/* Branch left */}
      <Stem d="M 30 68 C 18 58 10 48 14 36" />
      {/* Branch right */}
      <Stem d="M 50 38 C 58 30 62 20 56 12" />

      {/* Leaves */}
      <OakLeaf x={16} y={32} rotate={-120} scale={0.78} opacity={0.9} />
      <OakLeaf x={52} y={34} rotate={-30}  scale={0.7}  opacity={0.85} />
      <OakLeaf x={72} y={16} rotate={10}   scale={0.6}  opacity={0.8} />

      {/* Tendrils */}
      <Tendril x={28} y={55} rotate={-20} scale={0.6} />
      <Tendril x={60} y={42} rotate={40}  scale={0.55} />
    </svg>
  );
}

/** Top-right corner spray — mirrored version of left. */
function CornerSprayRight() {
  return (
    <svg
      width={90}
      height={110}
      viewBox="0 0 90 110"
      className="pointer-events-none absolute"
      style={{ top: 3, right: 4, transform: 'scaleX(-1)' }}
      aria-hidden="true"
    >
      <Stem d="M 8 108 C 12 80 30 60 50 38 C 62 24 70 14 78 8" />
      <Stem d="M 30 68 C 18 58 10 48 14 36" />
      <Stem d="M 50 38 C 58 30 62 20 56 12" />
      <OakLeaf x={16} y={32} rotate={-120} scale={0.78} opacity={0.9} />
      <OakLeaf x={52} y={34} rotate={-30}  scale={0.7}  opacity={0.85} />
      <OakLeaf x={72} y={16} rotate={10}   scale={0.6}  opacity={0.8} />
      <Tendril x={28} y={55} rotate={-20} scale={0.6} />
      <Tendril x={60} y={42} rotate={40}  scale={0.55} />
    </svg>
  );
}

/** Botanical divider: oak leaves flanking ◆, connected by curved stems. */
function BotanicalDivider() {
  return (
    <svg
      width={300}
      height={44}
      viewBox="0 0 300 44"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* Left curved stem with tendril */}
      <Stem d="M 12 22 C 50 18 90 22 130 22" />
      <Tendril x={40} y={19} rotate={-30} scale={0.5} />
      {/* Right curved stem with tendril */}
      <Stem d="M 170 22 C 210 22 250 18 288 22" />
      <Tendril x={260} y={19} rotate={150} scale={0.5} />

      {/* Left oak leaf pair */}
      <OakLeaf x={20}  y={22} rotate={-90} scale={0.6} opacity={0.95} />
      <OakLeaf x={55}  y={20} rotate={-105} scale={0.52} opacity={0.85} />

      {/* Right oak leaf pair */}
      <OakLeaf x={245} y={22} rotate={90}  scale={0.6} opacity={0.95} />
      <OakLeaf x={280} y={20} rotate={75}  scale={0.52} opacity={0.85} />

      {/* Central diamond ◆ */}
      <text
        x={150}
        y={26}
        textAnchor="middle"
        fontSize={10}
        fill={MAROON}
        fontFamily="serif"
      >◆</text>
    </svg>
  );
}

/** Footer botanical accent: small pair of leaves flanking ◆. */
function FooterAccent() {
  return (
    <svg
      width={100}
      height={36}
      viewBox="0 0 100 36"
      aria-hidden="true"
    >
      <OakLeaf x={22}  y={18} rotate={-75}  scale={0.5} opacity={0.7} />
      <OakLeaf x={78}  y={18} rotate={75}   scale={0.5} opacity={0.7} />
      <text x={50} y={22} textAnchor="middle" fontSize={9} fill={MAROON} opacity={0.7} fontFamily="serif">◆</text>
    </svg>
  );
}

export default function DashboardScreen() {
  const go = useViewTransition();

  return (
    <main className="relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-white">

      {/* Top maroon band */}
      <div className="w-full flex-shrink-0" style={{ height: 5, background: MAROON }} />

      {/* Corner botanical sprays (overlapping top band + header) */}
      <CornerSprayLeft />
      <CornerSprayRight />

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

        {/* Botanical divider */}
        <div className="mt-6 flex w-full max-w-[300px] items-center justify-center">
          <BotanicalDivider />
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
        <div className="flex items-center justify-center mb-2">
          <FooterAccent />
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
