// Join-code alphabet. Constrained to characters typeable on the JoinScreen
// keypad (1-9, A, 0, DEL — see snaphunt-spec-v2.md §12.3 and the playbook).
// The keypad rule is binding; the spec's broader "no 0/O/1/I/L" guidance
// would generate codes with un-typeable letters (P, Y, etc.).
//
// 9 chars × 6 positions = 531_441 combos — plenty for hackathon scale.
const ALPHABET = '23456789A';

export function generateJoinCode(length = 6): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

const CODE_RE = /^[23456789A]{6}$/;

export function isValidJoinCode(input: string): boolean {
  return CODE_RE.test(input);
}

export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
