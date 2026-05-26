import { useId } from 'react';

export function ForestBg({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, 'x');

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ zIndex: -1 }}
      viewBox="0 0 420 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#050B03"/>
          <stop offset="45%"  stopColor="#0A1607"/>
          <stop offset="100%" stopColor="#0E1C09"/>
        </linearGradient>
        <linearGradient id={`${uid}tkL`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1A0C06"/>
          <stop offset="28%"  stopColor="#321608"/>
          <stop offset="58%"  stopColor="#4C220E"/>
          <stop offset="78%"  stopColor="#602E16"/>
          <stop offset="100%" stopColor="#2A1208"/>
        </linearGradient>
        <linearGradient id={`${uid}tkC`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#140A06"/>
          <stop offset="30%"  stopColor="#2E1408"/>
          <stop offset="60%"  stopColor="#4A2818"/>
          <stop offset="100%" stopColor="#301808"/>
        </linearGradient>
        <linearGradient id={`${uid}tkR`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#221008"/>
          <stop offset="38%"  stopColor="#3C2010"/>
          <stop offset="100%" stopColor="#160A04"/>
        </linearGradient>
        <linearGradient id={`${uid}gnd`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0C1006"/>
          <stop offset="45%"  stopColor="#1C1A08"/>
          <stop offset="100%" stopColor="#0E1206"/>
        </linearGradient>
        <linearGradient id={`${uid}ui`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#040A02" stopOpacity="0.75"/>
          <stop offset="20%"  stopColor="#040A02" stopOpacity="0.12"/>
          <stop offset="58%"  stopColor="#040A02" stopOpacity="0.52"/>
          <stop offset="100%" stopColor="#030802" stopOpacity="0.94"/>
        </linearGradient>
        <filter id={`${uid}deep`}><feGaussianBlur stdDeviation="3"/></filter>
        <filter id={`${uid}mid`}><feGaussianBlur stdDeviation="1.5"/></filter>
      </defs>

      {/* Sky */}
      <rect width="420" height="900" fill={`url(#${uid}sky)`}/>

      {/* Far canopy */}
      <g filter={`url(#${uid}deep)`} opacity="0.78">
        <ellipse cx="0"   cy="32" rx="80"  ry="52" fill="#091C06"/>
        <ellipse cx="85"  cy="14" rx="88"  ry="50" fill="#112208"/>
        <ellipse cx="200" cy="20" rx="102" ry="55" fill="#172E0E"/>
        <ellipse cx="322" cy="12" rx="92"  ry="50" fill="#1B3410"/>
        <ellipse cx="420" cy="28" rx="80"  ry="52" fill="#132608"/>
      </g>

      {/* Mid canopy */}
      <g filter={`url(#${uid}mid)`} opacity="0.62">
        <ellipse cx="35"  cy="72" rx="65"  ry="30" fill="#081406"/>
        <ellipse cx="215" cy="82" rx="115" ry="28" fill="#0E1C0A"/>
        <ellipse cx="390" cy="68" rx="65"  ry="28" fill="#0A1606"/>
      </g>

      {/* Ghost pines */}
      <g filter={`url(#${uid}deep)`} opacity="0.22">
        <polygon points="62,800  67,210 76,800"  fill="#2C1C12"/>
        <polygon points="148,800 154,228 165,800" fill="#261812"/>
        <polygon points="285,800 291,218 302,800" fill="#2C1C12"/>
        <polygon points="362,800 368,208 380,800" fill="#261812"/>
      </g>

      {/* Mid-ground trees */}
      <g filter={`url(#${uid}mid)`} opacity="0.5">
        <polygon points="32,760  38,245 48,760"  fill="#1E1008"/>
        <polygon points="180,760 186,232 197,760" fill="#1C0E08"/>
        <polygon points="372,760 379,238 390,760" fill="#1E1008"/>
      </g>

      {/* TRUNK L — left-edge redwood */}
      <polygon points="-22,900 -5,0 40,0 52,900" fill={`url(#${uid}tkL)`}/>
      <rect x="-14" y="0" width="5"  height="900" fill="#0C0602" opacity="0.80"/>
      <rect x="12"  y="0" width="4"  height="900" fill="#0C0602" opacity="0.66"/>
      <rect x="40"  y="0" width="9"  height="900" fill="#6E3C20" opacity="0.60"/>
      <rect x="-22" y="162" width="74" height="1.5" fill="#7E4428" opacity="0.40"/>
      <rect x="-22" y="318" width="74" height="1.5" fill="#7E4428" opacity="0.32"/>
      <rect x="-22" y="468" width="74" height="1.5" fill="#7E4428" opacity="0.36"/>
      <rect x="-22" y="632" width="74" height="1.5" fill="#7E4428" opacity="0.30"/>
      <rect x="-22" y="778" width="74" height="1"   fill="#7E4428" opacity="0.26"/>

      {/* TRUNK C — center-left spruce */}
      <polygon points="80,900 92,72 126,66 138,900" fill={`url(#${uid}tkC)`}/>
      <rect x="84"  y="74"  width="5" height="826" fill="#0A0604" opacity="0.74"/>
      <rect x="110" y="68"  width="4" height="832" fill="#0A0604" opacity="0.62"/>
      <rect x="126" y="68"  width="9" height="832" fill="#5E3222" opacity="0.52"/>
      <rect x="80" y="218" width="58" height="1.5" fill="#7E4428" opacity="0.34"/>
      <rect x="80" y="428" width="58" height="1.5" fill="#7E4428" opacity="0.28"/>
      <rect x="80" y="638" width="58" height="1.5" fill="#7E4428" opacity="0.32"/>

      {/* TRUNK R — right-edge pine */}
      <polygon points="376,900 388,148 418,142 432,900" fill={`url(#${uid}tkR)`}/>
      <rect x="380" y="150" width="4" height="750" fill="#0A0604" opacity="0.70"/>
      <rect x="414" y="144" width="7" height="756" fill="#4C2618" opacity="0.54"/>
      <rect x="376" y="283" width="56" height="1.5" fill="#7E4428" opacity="0.32"/>
      <rect x="376" y="508" width="56" height="1.5" fill="#7E4428" opacity="0.28"/>
      <rect x="376" y="718" width="56" height="1"   fill="#7E4428" opacity="0.24"/>

      {/* Forest floor */}
      <rect x="0" y="742" width="420" height="158" fill={`url(#${uid}gnd)`}/>
      <ellipse cx="38"  cy="758" rx="58" ry="14" fill="#0A0E05" opacity="0.72"/>
      <ellipse cx="295" cy="752" rx="88" ry="16" fill="#181606" opacity="0.42"/>

      {/* UI readability overlay */}
      <rect width="420" height="900" fill={`url(#${uid}ui)`}/>
    </svg>
  );
}
