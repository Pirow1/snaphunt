type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = (window as WebkitWindow).AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); return ctx; } catch { return null; }
}

export function setMuted(m: boolean): void { muted = m; }

export function blip(freq: number, durationMs = 80, type: OscillatorType = 'sine', volume = 0.08): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playTap(): void { blip(880, 40, 'sine', 0.04); }

// ---------------------------------------------------------------------------
// Shutter — classic mechanical SLR (mirror slap → curtain → return).
// ---------------------------------------------------------------------------
export function playShutter(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const audio = c; // non-nullable alias — TypeScript can't narrow across closure boundaries
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;

  function noiseClick(startSec: number, vol: number, durMs: number, freq: number, q: number) {
    const durSec = durMs / 1000;
    const bufSize = Math.max(1, Math.floor(audio.sampleRate * durSec));
    const buf = audio.createBuffer(1, bufSize, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = audio.createBufferSource();
    src.buffer = buf;
    const bpf = audio.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = freq;
    bpf.Q.value = q;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(vol, startSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec * 2.5);
    src.connect(bpf).connect(gain).connect(audio.destination);
    src.start(startSec);
  }

  noiseClick(t0,         0.90, 7,  2200, 0.5);
  noiseClick(t0 + 0.006, 0.55, 5,  1400, 0.9);
  noiseClick(t0 + 0.055, 0.60, 6,  2000, 0.6);
  noiseClick(t0 + 0.060, 0.35, 4,  1000, 1.2);
  const thudOsc = c.createOscillator();
  const tg = c.createGain();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(140, t0 + 0.065);
  thudOsc.frequency.exponentialRampToValueAtTime(55, t0 + 0.16);
  tg.gain.setValueAtTime(0, t0 + 0.063);
  tg.gain.linearRampToValueAtTime(0.22, t0 + 0.068);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  thudOsc.connect(tg).connect(c.destination);
  thudOsc.start(t0 + 0.063);
  thudOsc.stop(t0 + 0.20);
}

// ---------------------------------------------------------------------------
// Bomb plant — ascending digital confirmation tones.
// ---------------------------------------------------------------------------
export function playBombPlant(): void {
  blip(440, 80,  'square', 0.14);
  setTimeout(() => blip(660, 80,  'square', 0.16), 120);
  setTimeout(() => blip(880, 120, 'square', 0.18), 250);
  setTimeout(() => blip(440, 200, 'sawtooth', 0.10), 420);
}

// ---------------------------------------------------------------------------
// Countdown beep — digital square wave, urgent variant is higher + sharper.
// ---------------------------------------------------------------------------
export function playCountdownBeep(urgent = false): void {
  blip(urgent ? 1400 : 900, urgent ? 50 : 70, 'square', urgent ? 0.20 : 0.14);
}

// ---------------------------------------------------------------------------
// Defused — rising digital arpeggio.
// ---------------------------------------------------------------------------
export function playDefused(): void {
  [523, 659, 784, 1047, 1319].forEach((f, i) =>
    setTimeout(() => blip(f, 150, 'triangle', 0.12), i * 80)
  );
}

// ---------------------------------------------------------------------------
// Explosion — layered crash: crack → boom → debris → rumble tail (~4s).
// ---------------------------------------------------------------------------
export function playExplosion(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const audio = c;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;

  function noiseBurst(startT: number, duration: number, vol: number, lpFreq?: number, hpFreq?: number) {
    const samples = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buf = audio.createBuffer(1, samples, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) d[i] = Math.random() * 2 - 1;
    const src = audio.createBufferSource();
    src.buffer = buf;
    let node: AudioNode = src;
    if (hpFreq) {
      const hp = audio.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hpFreq;
      src.connect(hp);
      node = hp;
    }
    if (lpFreq) {
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lpFreq;
      node.connect(lp);
      node = lp;
    }
    const gain = audio.createGain();
    gain.gain.setValueAtTime(vol, startT);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + duration);
    node.connect(gain).connect(audio.destination);
    src.start(startT);
  }

  // Phase 1: Initial crack — full-spectrum noise transient
  noiseBurst(t0, 0.04, 1.0, undefined, 2000);

  // Phase 2: Deep boom sweep — the core shockwave body
  const boom = audio.createOscillator();
  const boomG = audio.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(200, t0 + 0.01);
  boom.frequency.exponentialRampToValueAtTime(16, t0 + 3.0);
  boomG.gain.setValueAtTime(0, t0 + 0.005);
  boomG.gain.linearRampToValueAtTime(0.75, t0 + 0.03);
  boomG.gain.setValueAtTime(0.75, t0 + 0.12);
  boomG.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
  boom.connect(boomG).connect(audio.destination);
  boom.start(t0 + 0.005);
  boom.stop(t0 + 3.3);

  // Phase 3: Sawtooth crash chord (power-chord distortion feel)
  [55, 73, 98].forEach((freq) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t0 + 0.02);
    g.gain.setValueAtTime(0.14, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(g).connect(audio.destination);
    osc.start(t0 + 0.02);
    osc.stop(t0 + 1.15);
  });

  // Phase 4: Broadband explosion noise (low-passed — the "fire" body)
  noiseBurst(t0 + 0.05, 2.0, 0.55, 900);

  // Phase 5: Mid-frequency pressure wave
  noiseBurst(t0 + 0.08, 1.0, 0.38, 4000, 400);

  // Phase 6: Debris/secondary impacts
  [0.45, 0.65, 0.85, 1.1, 1.45, 1.8, 2.2].forEach((delay) => {
    const vol = 0.06 + Math.random() * 0.14;
    noiseBurst(t0 + delay, 0.05 + Math.random() * 0.1, vol);
  });

  // Phase 7: Deep subwoofer rumble tail
  noiseBurst(t0 + 0.9, 3.0, 0.22, 120);
}

// ---------------------------------------------------------------------------
// Radar ping — ascending sonar chirp for medium-range direction finding.
// ---------------------------------------------------------------------------
export function playRadarPing(volume = 0.12): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;

  // Primary chirp: 280Hz → 1100Hz ascending over 220ms
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(280, t0);
  osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.18);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.35);

  // Subtle echo at half volume, 120ms later
  const echo = c.createOscillator();
  const echoG = c.createGain();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(280, t0 + 0.12);
  echo.frequency.exponentialRampToValueAtTime(1100, t0 + 0.30);
  echoG.gain.setValueAtTime(0, t0 + 0.12);
  echoG.gain.linearRampToValueAtTime(volume * 0.35, t0 + 0.125);
  echoG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  echo.connect(echoG).connect(c.destination);
  echo.start(t0 + 0.12);
  echo.stop(t0 + 0.48);
}

// ---------------------------------------------------------------------------
// Digital proximity beep — two sharp square pulses (heart-monitor style).
// Replaces the organic thud for close-range (<20m) proximity feedback.
// ---------------------------------------------------------------------------
export function playHeartbeatPulse(volume: number): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;

  // Pulse 1 — sharp square beep
  const o1 = c.createOscillator();
  const g1 = c.createGain();
  o1.type = 'square';
  o1.frequency.setValueAtTime(1100, t0);
  g1.gain.setValueAtTime(0, t0);
  g1.gain.linearRampToValueAtTime(volume * 0.7, t0 + 0.003);
  g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
  o1.connect(g1).connect(c.destination);
  o1.start(t0);
  o1.stop(t0 + 0.06);

  // Pulse 2 — slightly lower, 75ms later
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(880, t0 + 0.075);
  g2.gain.setValueAtTime(0, t0 + 0.075);
  g2.gain.linearRampToValueAtTime(volume * 0.45, t0 + 0.078);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  o2.connect(g2).connect(c.destination);
  o2.start(t0 + 0.075);
  o2.stop(t0 + 0.14);
}

// ---------------------------------------------------------------------------
// Proximity bands
//
// RADAR bands  (20m – 100m): slower sonar pings, guidance toward the bomb.
// HEARTBEAT bands (≤20m): rapid digital beeps, urgency when very close.
// ---------------------------------------------------------------------------
const RADAR_BANDS = [
  { maxDist: 30,  intervalMs: 900,  volume: 0.16 },
  { maxDist: 60,  intervalMs: 2200, volume: 0.12 },
  { maxDist: 100, intervalMs: 4000, volume: 0.08 },
] as const;

const HEARTBEAT_BANDS = [
  { maxDist: 5,   intervalMs: 180,  volume: 0.35 },
  { maxDist: 10,  intervalMs: 350,  volume: 0.28 },
  { maxDist: 20,  intervalMs: 600,  volume: 0.20 },
] as const;

export type RadarBand     = { intervalMs: number; volume: number };
export type HeartbeatBand = { intervalMs: number; volume: number };

export function getRadarBand(distanceMeters: number): RadarBand | null {
  if (distanceMeters <= 20) return null; // heartbeat takes over below 20m
  for (const band of RADAR_BANDS) {
    if (distanceMeters <= band.maxDist) return { intervalMs: band.intervalMs, volume: band.volume };
  }
  return null;
}

export function getHeartbeatBand(distanceMeters: number): HeartbeatBand | null {
  for (const band of HEARTBEAT_BANDS) {
    if (distanceMeters <= band.maxDist) return { intervalMs: band.intervalMs, volume: band.volume };
  }
  return null;
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
