// Web Audio primitives. Lazy-init the AudioContext on the first interaction
// so we comply with browser autoplay gates (Chrome/Safari refuse to start
// a context outside a user gesture). All API calls below are no-ops until
// then; we resume() on demand if the context was suspended.
//
// Vibration helper colocated here so call sites can fire both in one line.

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = (window as WebkitWindow).AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean): void {
  muted = m;
}

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
  // Tiny attack + linear decay so taps don't click.
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playSuccessArpeggio(): void {
  // C5 E5 G5 triangle wave, staggered ~90ms apart.
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => window.setTimeout(() => blip(f, 180, 'triangle', 0.1), i * 90));
}

export function playFailDescend(): void {
  // Quick sawtooth pitch drop.
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(330, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.35);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.08, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.42);
}

export function playTap(): void {
  blip(880, 40, 'sine', 0.04);
}

export function playJoin(): void {
  blip(660, 120, 'sine', 0.05);
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers (desktop Safari) just throw — silently ignore.
  }
}
