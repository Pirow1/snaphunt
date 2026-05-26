import type { CSSProperties } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';

export default function HomeScreen() {
  const go = useViewTransition();

  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden bg-forest-dark">
      {/* Forest background SVG */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 420 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#091408"/>
            <stop offset="35%" stopColor="#112010"/>
            <stop offset="70%" stopColor="#1A2E14"/>
            <stop offset="100%" stopColor="#0E1A0A"/>
          </linearGradient>
          <radialGradient id="sunBloom" cx="80%" cy="62%" r="50%">
            <stop offset="0%" stopColor="#F4C84A" stopOpacity="0.85"/>
            <stop offset="18%" stopColor="#D4982A" stopOpacity="0.6"/>
            <stop offset="45%" stopColor="#8A5A10" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#112010" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="warmRight" cx="100%" cy="82%" r="65%">
            <stop offset="0%" stopColor="#B06818" stopOpacity="0.45"/>
            <stop offset="55%" stopColor="#5A3208" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#091408" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="coolLeft" cx="2%" cy="48%" r="58%">
            <stop offset="0%" stopColor="#06120E" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#091408" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="mistGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1A2A14" stopOpacity="0"/>
            <stop offset="35%" stopColor="#C0A060" stopOpacity="0.1"/>
            <stop offset="65%" stopColor="#D8B860" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#F0C850" stopOpacity="0.18"/>
          </linearGradient>
          <linearGradient id="barkRedL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1C0C06"/>
            <stop offset="25%"  stopColor="#341A0E"/>
            <stop offset="55%"  stopColor="#4E2614"/>
            <stop offset="75%"  stopColor="#6A3820"/>
            <stop offset="100%" stopColor="#2A1408"/>
          </linearGradient>
          <linearGradient id="barkRedC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1C0E08"/>
            <stop offset="22%"  stopColor="#321A0C"/>
            <stop offset="52%"  stopColor="#522E16"/>
            <stop offset="72%"  stopColor="#6A3E1C"/>
            <stop offset="100%" stopColor="#3C2210"/>
          </linearGradient>
          <linearGradient id="barkRedR" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#241210"/>
            <stop offset="35%"  stopColor="#3A1E14"/>
            <stop offset="65%"  stopColor="#4C2A1A"/>
            <stop offset="100%" stopColor="#180A06"/>
          </linearGradient>
          <linearGradient id="barkSpruce" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#140C08"/>
            <stop offset="40%" stopColor="#241408"/>
            <stop offset="80%" stopColor="#2E1A0A"/>
            <stop offset="100%" stopColor="#1C1008"/>
          </linearGradient>
          <linearGradient id="groundL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0E1008"/>
            <stop offset="40%" stopColor="#1C1808"/>
            <stop offset="70%" stopColor="#2E2008"/>
            <stop offset="100%" stopColor="#463010"/>
          </linearGradient>
          <linearGradient id="uiFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#091208" stopOpacity="0"/>
            <stop offset="38%" stopColor="#091208" stopOpacity="0.28"/>
            <stop offset="62%" stopColor="#070F05" stopOpacity="0.84"/>
            <stop offset="100%" stopColor="#060C04" stopOpacity="0.97"/>
          </linearGradient>
          <linearGradient id="topDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040A03" stopOpacity="0.82"/>
            <stop offset="22%" stopColor="#040A03" stopOpacity="0"/>
          </linearGradient>
          <filter id="deepBlur"><feGaussianBlur stdDeviation="3.5"/></filter>
          <filter id="midBlur"><feGaussianBlur stdDeviation="1.5"/></filter>
          <filter id="rayBlur"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="mistBlur"><feGaussianBlur stdDeviation="4.5"/></filter>
        </defs>

        <rect width="420" height="900" fill="url(#skyBg)"/>

        {/* Canopy */}
        <g filter="url(#deepBlur)" opacity="0.82">
          <ellipse cx="0"   cy="28"  rx="90"  ry="65" fill="#0C1E08"/>
          <ellipse cx="80"  cy="8"   rx="85"  ry="55" fill="#14280E"/>
          <ellipse cx="190" cy="15"  rx="105" ry="60" fill="#1A3412"/>
          <ellipse cx="310" cy="8"   rx="95"  ry="55" fill="#1E3C14"/>
          <ellipse cx="400" cy="22"  rx="85"  ry="58" fill="#162C0E"/>
          <ellipse cx="130" cy="0"   rx="65"  ry="42" fill="#20380E"/>
          <ellipse cx="265" cy="0"   rx="75"  ry="45" fill="#243E14"/>
          <ellipse cx="370" cy="2"   rx="65"  ry="40" fill="#1C3410"/>
          <ellipse cx="420" cy="6"   rx="55"  ry="38" fill="#0E2008"/>
        </g>
        <g filter="url(#midBlur)" opacity="0.7">
          <ellipse cx="30"  cy="65"  rx="70"  ry="36" fill="#091608"/>
          <ellipse cx="210" cy="75"  rx="120" ry="32" fill="#102010"/>
          <ellipse cx="400" cy="60"  rx="70"  ry="34" fill="#0A1808"/>
          <ellipse cx="105" cy="82"  rx="65"  ry="28" fill="#0C1C08"/>
          <ellipse cx="330" cy="70"  rx="72"  ry="30" fill="#0E1E08"/>
        </g>

        {/* Atmosphere */}
        <rect width="420" height="900" fill="url(#sunBloom)"/>
        <rect width="420" height="900" fill="url(#warmRight)"/>
        <rect width="420" height="900" fill="url(#coolLeft)"/>

        {/* Light rays */}
        <g filter="url(#rayBlur)" opacity="0.17">
          <polygon points="415,500 406,900 366,900 382,500" fill="#F0C040"/>
          <polygon points="410,455 396,900 350,900 370,455" fill="#E0AE30"/>
          <polygon points="402,415 382,900 326,900 352,415" fill="#D09820"/>
          <polygon points="390,380 364,900 298,900 330,380" fill="#B88018"/>
          <polygon points="375,355 340,900 264,900 305,355" fill="#A07010"/>
          <polygon points="355,335 312,900 224,900 272,335" fill="#886008"/>
        </g>

        {/* Ghost background trees */}
        <g filter="url(#deepBlur)" opacity="0.22">
          <polygon points="50,800  55,180 65,800"  fill="#2A1A10"/>
          <polygon points="115,800 120,200 130,800" fill="#241610"/>
          <polygon points="185,800 191,170 202,800" fill="#2A1A10"/>
          <polygon points="260,800 267,188 278,800" fill="#241610"/>
          <polygon points="330,800 337,175 347,800" fill="#2A1A10"/>
          <polygon points="388,800 394,195 403,800" fill="#241610"/>
        </g>

        {/* Mid spruce trees */}
        <g filter="url(#midBlur)" opacity="0.52">
          <polygon points="30,760  36,220 44,760"  fill="#1E1008"/>
          <polygon points="98,760  105,195 115,760" fill="#1C0E08"/>
          <polygon points="165,760 172,185 183,760" fill="#1E1008"/>
          <polygon points="238,760 245,200 256,760" fill="#1C0E08"/>
          <polygon points="305,760 313,190 325,760" fill="#201208"/>
          <polygon points="368,760 376,208 387,760" fill="#221008"/>
        </g>

        {/* Mist band */}
        <rect x="0" y="450" width="420" height="80" fill="url(#mistGrad)" filter="url(#mistBlur)"/>

        {/* Trunk A: massive left-edge redwood */}
        <polygon points="-22,900 -6,0 40,0 52,900" fill="url(#barkRedL)"/>
        <rect x="-14" y="0" width="6"  height="900" fill="#0E0804" opacity="0.80"/>
        <rect x="16"  y="0" width="4"  height="900" fill="#0E0804" opacity="0.65"/>
        <rect x="40"  y="0" width="9"  height="900" fill="#724020" opacity="0.62"/>
        {/* bark crack lines */}
        <rect x="-22" y="155" width="74" height="1.5" fill="#855030" opacity="0.42"/>
        <rect x="-22" y="298" width="74" height="1.5" fill="#855030" opacity="0.34"/>
        <rect x="-22" y="452" width="74" height="1.5" fill="#855030" opacity="0.38"/>
        <rect x="-22" y="608" width="74" height="1.5" fill="#855030" opacity="0.32"/>
        <rect x="-22" y="754" width="74" height="1"   fill="#855030" opacity="0.28"/>

        {/* Trunk B: spruce center-left */}
        <polygon points="74,900 86,70 122,62 134,900" fill="url(#barkRedC)"/>
        <rect x="78"  y="72"  width="5"  height="828" fill="#0E0804" opacity="0.72"/>
        <rect x="108" y="64"  width="4"  height="836" fill="#0E0804" opacity="0.62"/>
        <rect x="122" y="64"  width="9"  height="836" fill="#623820" opacity="0.54"/>
        {/* bark crack lines */}
        <rect x="74" y="210" width="60" height="1.5" fill="#855030" opacity="0.36"/>
        <rect x="74" y="400" width="60" height="1.5" fill="#855030" opacity="0.30"/>
        <rect x="74" y="590" width="60" height="1.5" fill="#855030" opacity="0.34"/>
        <rect x="74" y="768" width="60" height="1"   fill="#855030" opacity="0.28"/>

        {/* Trunk C: right-edge pine */}
        <polygon points="378,900 390,140 420,132 432,900" fill="url(#barkRedR)"/>
        <rect x="382" y="142" width="4"  height="758" fill="#0E0804" opacity="0.72"/>
        <rect x="416" y="134" width="8"  height="766" fill="#4E2818" opacity="0.55"/>
        <rect x="378" y="278" width="54" height="1.5" fill="#855030" opacity="0.34"/>
        <rect x="378" y="498" width="54" height="1.5" fill="#855030" opacity="0.28"/>
        <rect x="378" y="698" width="54" height="1"   fill="#855030" opacity="0.25"/>

        {/* Forest floor */}
        <rect x="0" y="730" width="420" height="170" fill="url(#groundL)"/>
        <ellipse cx="35"  cy="750" rx="55"  ry="17" fill="#0C0E06" opacity="0.75"/>
        <ellipse cx="285" cy="744" rx="80"  ry="18" fill="#1A1606" opacity="0.45"/>

        {/* UI gradients */}
        <rect width="420" height="900" fill="url(#uiFade)"/>
        <rect width="420" height="900" fill="url(#topDark)"/>
      </svg>

      {/* UI overlay */}
      <div className="absolute inset-0 flex flex-col">
        {/* Top content */}
        <div className="flex-1 px-6 pt-8">
          {/* Eyebrow */}
          <div className="mb-[18px] inline-flex items-center gap-[7px] rounded-[3px] border border-gold/40 bg-black/40 px-3 py-1">
            <div className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-gold" />
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-gold">
              Photo Hide &amp; Seek
            </span>
          </div>

          {/* Wordmark */}
          <h1
            className="font-display font-[900] leading-[0.85] tracking-[-0.05em] text-parchment font-squeeze"
            style={{
              fontSize: 'clamp(52px, 14vw, 72px)',
              textShadow: '0 2px 30px rgba(0,0,0,0.95), 0 0 80px rgba(0,0,0,0.7)',
              viewTransitionName: 'app-title',
            } as CSSProperties}
          >
            SNAP<br />
            <span className="text-gold">HUNT</span>
          </h1>

          {/* Tagline */}
          <p
            className="mt-3 font-serif text-[14px] italic tracking-[0.02em] text-parchment/72"
            style={{ textShadow: '0 1px 10px rgba(0,0,0,0.95)' }}
          >
            photographic hide &amp; seek
          </p>

          {/* Stats */}
          <div className="mt-7 flex">
            <div className="flex-1">
              <div className="font-display text-[22px] font-bold leading-none text-gold" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>4.2k</div>
              <div className="mt-[3px] font-display text-[9px] font-semibold uppercase tracking-[0.15em] text-parchment/58">Players</div>
            </div>
            <div className="mx-4 w-px bg-gold/22" />
            <div className="flex-1">
              <div className="font-display text-[22px] font-bold leading-none text-gold" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>891</div>
              <div className="mt-[3px] font-display text-[9px] font-semibold uppercase tracking-[0.15em] text-parchment/58">Hunts run</div>
            </div>
            <div className="mx-4 w-px bg-gold/22" />
            <div className="flex-1">
              <div className="font-display text-[22px] font-bold leading-none text-gold" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>32</div>
              <div className="mt-[3px] font-display text-[9px] font-semibold uppercase tracking-[0.15em] text-parchment/58">Countries</div>
            </div>
          </div>
        </div>

        {/* Bottom CTAs */}
        <div className="px-[22px] pb-8">
          <hr className="mb-4 border-t border-gold/22" />
          <div className="flex flex-col gap-2.5">
            <Button variant="primary" onClick={() => go('/create')}>
              ▶ Start a Hunt
            </Button>
            <Button variant="dark" onClick={() => go('/join')}>
              ◉ Join with Code
            </Button>
          </div>
          <div className="mt-3.5 flex items-center justify-center gap-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-parchment/48">
            <span>3 friends min.</span>
            <span>·</span>
            <span>outdoors recommended</span>
          </div>
        </div>
      </div>
    </main>
  );
}
