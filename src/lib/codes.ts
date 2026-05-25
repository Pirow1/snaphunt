// Join-code generation. 6 uppercase characters, excluding visually ambiguous
// glyphs (no 0/O, 1/I, L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length = 6): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function isValidJoinCode(input: string): boolean {
  return CODE_RE.test(input);
}

export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
