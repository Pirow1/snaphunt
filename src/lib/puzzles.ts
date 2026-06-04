// Puzzle types and random generators for the trap mini-game.
// All puzzles are self-contained data objects; rendering lives in the puzzle components.

export type MCPuzzle = {
  kind: 'mc';
  prompt: string;
  visual?: { type: 'color'; hex: string } | { type: 'flash'; emoji: string; count: number };
  answer: string;
  options: string[]; // 4 items, already shuffled, includes answer
};

export type TrueFalsePuzzle = {
  kind: 'tf';
  statement: string;
  answer: boolean;
};

export type MemoryPuzzle = {
  kind: 'memory';
  pairs: string[]; // 3 unique emoji — 6 cards total
};

export type OddOneOutPuzzle = {
  kind: 'odd';
  items: string[]; // 9 items: 8 identical + 1 different
  oddIdx: number;
};

export type ShapeSortPuzzle = {
  kind: 'shape';
  items: string[]; // 9 items
  prompt: string;
  targetIndices: number[];
};

export type SimonPuzzle = {
  kind: 'simon';
  sequence: Array<'red' | 'blue' | 'green' | 'gold'>;
};

export type Puzzle =
  | MCPuzzle
  | TrueFalsePuzzle
  | MemoryPuzzle
  | OddOneOutPuzzle
  | ShapeSortPuzzle
  | SimonPuzzle;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function rng(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[rng(0, arr.length - 1)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeMCOptions(answer: string, wrongs: string[]): string[] {
  const distractors = shuffle(wrongs).slice(0, 3);
  return shuffle([answer, ...distractors]);
}

// ─────────────────────────────────────────────
// 1. Quick Math
// ─────────────────────────────────────────────

function mathPuzzle(): MCPuzzle {
  const ops = ['+', '-', '×'] as const;
  const op = pick(ops);
  let a: number, b: number, answer: number;

  if (op === '+') {
    a = rng(5, 25); b = rng(5, 25); answer = a + b;
  } else if (op === '-') {
    a = rng(15, 50); b = rng(5, a - 1); answer = a - b;
  } else {
    a = rng(2, 12); b = rng(2, 12); answer = a * b;
  }

  const wrongs = shuffle([
    answer + rng(1, 4),
    answer - rng(1, 4),
    answer + rng(5, 9),
  ]).map(String);

  return {
    kind: 'mc',
    prompt: `${a} ${op} ${b} = ?`,
    answer: String(answer),
    options: makeMCOptions(String(answer), wrongs),
  };
}

// ─────────────────────────────────────────────
// 2. Number Sequence
// ─────────────────────────────────────────────

const SEQUENCES = [
  { seq: [2, 4, 6, 8], next: 10 },
  { seq: [1, 3, 5, 7], next: 9 },
  { seq: [5, 10, 15, 20], next: 25 },
  { seq: [1, 2, 4, 8], next: 16 },
  { seq: [3, 6, 9, 12], next: 15 },
  { seq: [10, 8, 6, 4], next: 2 },
  { seq: [1, 4, 9, 16], next: 25 },
  { seq: [2, 3, 5, 8], next: 13 },
  { seq: [100, 50, 25], next: 12 }, // wait, this is /2 but not integer after... remove
  { seq: [7, 14, 21, 28], next: 35 },
  { seq: [1, 1, 2, 3, 5], next: 8 },
  { seq: [3, 9, 27, 81], next: 243 },
  { seq: [50, 40, 30, 20], next: 10 },
];

function sequencePuzzle(): MCPuzzle {
  const { seq, next } = pick(SEQUENCES.filter((s) => s.seq[0] !== 100));
  const wrongs = shuffle([next + rng(1, 5), next - rng(1, 5), next + rng(6, 12)]).map(String);
  return {
    kind: 'mc',
    prompt: `${seq.join(', ')}, ?`,
    answer: String(next),
    options: makeMCOptions(String(next), wrongs),
  };
}

// ─────────────────────────────────────────────
// 3. Trivia
// ─────────────────────────────────────────────

const TRIVIA = [
  { q: 'How many sides on a hexagon?',      a: '6',            w: ['5', '7', '8'] },
  { q: 'Which bird can fly backwards?',      a: 'Hummingbird',  w: ['Hawk', 'Eagle', 'Owl'] },
  { q: 'How many legs does a spider have?',  a: '8',            w: ['6', '10', '12'] },
  { q: 'Which planet is closest to the Sun?', a: 'Mercury',     w: ['Venus', 'Mars', 'Earth'] },
  { q: 'What is H₂O?',                       a: 'Water',        w: ['Salt', 'Hydrogen', 'Acid'] },
  { q: 'How many minutes in two hours?',     a: '120',          w: ['90', '100', '150'] },
  { q: 'How many continents are there?',     a: '7',            w: ['5', '6', '8'] },
  { q: 'What do bees make?',                 a: 'Honey',        w: ['Wax', 'Silk', 'Milk'] },
  { q: 'How many days in a leap year?',      a: '366',          w: ['365', '364', '367'] },
  { q: 'Which animal is the fastest land animal?', a: 'Cheetah', w: ['Lion', 'Horse', 'Leopard'] },
  { q: 'How many colors in a rainbow?',      a: '7',            w: ['5', '6', '8'] },
  { q: 'What is the hardest natural substance?', a: 'Diamond',  w: ['Gold', 'Iron', 'Quartz'] },
];

function triviaPuzzle(): MCPuzzle {
  const item = pick(TRIVIA);
  return {
    kind: 'mc',
    prompt: item.q,
    answer: item.a,
    options: makeMCOptions(item.a, item.w),
  };
}

// ─────────────────────────────────────────────
// 4. Word Scramble
// ─────────────────────────────────────────────

const WORDS = [
  'FOREST', 'HUNTER', 'TRAIL', 'PHOTO', 'SEARCH',
  'SHADOW', 'BRIDGE', 'WINDOW', 'STONE', 'TRACK',
  'GROUND', 'BRANCH', 'LEAVES', 'SIGNAL', 'PATROL',
];

function scramble(word: string): string {
  const letters = word.split('');
  let scrambled = word;
  while (scrambled === word) scrambled = shuffle(letters).join('');
  return scrambled;
}

function wordScramblePuzzle(): MCPuzzle {
  const answer = pick(WORDS);
  const sc = scramble(answer);
  const wrongs = shuffle(WORDS.filter((w) => w !== answer)).slice(0, 3);
  return {
    kind: 'mc',
    prompt: `Unscramble: ${sc}`,
    answer,
    options: makeMCOptions(answer, wrongs),
  };
}

// ─────────────────────────────────────────────
// 5. Color Name
// ─────────────────────────────────────────────

const COLORS = [
  { name: 'Red',     hex: '#E84040' },
  { name: 'Blue',    hex: '#3B82F6' },
  { name: 'Green',   hex: '#22C55E' },
  { name: 'Yellow',  hex: '#EAB308' },
  { name: 'Orange',  hex: '#F97316' },
  { name: 'Purple',  hex: '#A855F7' },
  { name: 'Pink',    hex: '#EC4899' },
  { name: 'Cyan',    hex: '#06B6D4' },
  { name: 'Lime',    hex: '#84CC16' },
  { name: 'Indigo',  hex: '#6366F1' },
];

function colorNamePuzzle(): MCPuzzle {
  const target = pick(COLORS);
  const wrongs = shuffle(COLORS.filter((c) => c.name !== target.name))
    .slice(0, 3)
    .map((c) => c.name);
  return {
    kind: 'mc',
    prompt: 'What color is this?',
    visual: { type: 'color', hex: target.hex },
    answer: target.name,
    options: makeMCOptions(target.name, wrongs),
  };
}

// ─────────────────────────────────────────────
// 6. Count Items (flash then ask)
// ─────────────────────────────────────────────

const COUNT_EMOJI = ['🌲', '🍄', '🌿', '🪨', '🐝', '🌸', '🦋', '🌾'];

function countItemsPuzzle(): MCPuzzle {
  const emoji = pick(COUNT_EMOJI);
  const count = rng(4, 9);
  const wrongs = shuffle([count - 1, count + 1, count + 2].filter((n) => n > 0 && n !== count)).slice(0, 3).map(String);
  return {
    kind: 'mc',
    prompt: `How many ${emoji} were there?`,
    visual: { type: 'flash', emoji, count },
    answer: String(count),
    options: makeMCOptions(String(count), wrongs),
  };
}

// ─────────────────────────────────────────────
// 7. True / False
// ─────────────────────────────────────────────

const TF_FACTS = [
  { s: 'A group of crows is called a murder.',      a: true  },
  { s: 'Spiders are insects.',                       a: false },
  { s: 'Lightning never strikes the same place twice.', a: false },
  { s: 'Bats are completely blind.',                 a: false },
  { s: 'A snail can sleep for up to 3 years.',       a: true  },
  { s: 'Sharks are mammals.',                        a: false },
  { s: 'Mount Everest is in Nepal.',                 a: true  },
  { s: 'The Amazon River is in Africa.',             a: false },
  { s: 'Owls can fully rotate their heads 360°.',   a: false },
  { s: 'Honey never expires.',                       a: true  },
  { s: 'Penguins live at the North Pole.',           a: false },
  { s: 'A group of fish is called a school.',        a: true  },
];

function trueFalsePuzzle(): TrueFalsePuzzle {
  const item = pick(TF_FACTS);
  return { kind: 'tf', statement: item.s, answer: item.a };
}

// ─────────────────────────────────────────────
// 8. Memory Cards (3 pairs)
// ─────────────────────────────────────────────

const MEMORY_POOL = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉', '🌲', '🍄', '🪨', '🌿', '🦋', '🐿️'];

function memoryPuzzle(): MemoryPuzzle {
  const pairs = shuffle(MEMORY_POOL).slice(0, 3);
  return { kind: 'memory', pairs };
}

// ─────────────────────────────────────────────
// 9. Odd One Out
// ─────────────────────────────────────────────

const ODD_SETS: [string, string][] = [
  ['🌲', '🌴'], ['🐝', '🐛'], ['🌸', '🌻'], ['🦊', '🐺'],
  ['🪨', '🪵'], ['🌿', '🍀'], ['⭐', '🌙'], ['🔴', '🟠'],
  ['🟦', '🟩'], ['🎯', '🎪'], ['🌊', '💧'], ['🍎', '🍊'],
];

function oddOneOutPuzzle(): OddOneOutPuzzle {
  const [main, odd] = pick(ODD_SETS);
  const oddIdx = rng(0, 8);
  const items = Array.from({ length: 9 }, (_, i) => (i === oddIdx ? odd : main));
  return { kind: 'odd', items, oddIdx };
}

// ─────────────────────────────────────────────
// 10. Shape Sort (tap all targets)
// ─────────────────────────────────────────────

const SORT_SETS = [
  { target: '⭐', others: ['🌙', '☀️', '💫'] },
  { target: '🔴', others: ['🔵', '🟡', '🟢'] },
  { target: '🌲', others: ['🌸', '🌿', '🍄'] },
  { target: '🦋', others: ['🐝', '🪲', '🐛'] },
  { target: '💎', others: ['🪨', '🔮', '💠'] },
];

function shapeSortPuzzle(): ShapeSortPuzzle {
  const { target, others } = pick(SORT_SETS);
  const targetCount = rng(3, 4);
  const targetIndices = shuffle([0,1,2,3,4,5,6,7,8]).slice(0, targetCount);
  const filler = shuffle([...others, ...others, ...others]).slice(0, 9 - targetCount);
  const items: string[] = [];
  let fillerIdx = 0;
  for (let i = 0; i < 9; i++) {
    items.push(targetIndices.includes(i) ? target : filler[fillerIdx++]);
  }
  return {
    kind: 'shape',
    items,
    prompt: `Tap all ${target}`,
    targetIndices,
  };
}

// ─────────────────────────────────────────────
// 11. Simon Says (colour sequence)
// ─────────────────────────────────────────────

const SIMON_COLOURS = ['red', 'blue', 'green', 'gold'] as const;

function simonPuzzle(): SimonPuzzle {
  const len = 4;
  const sequence = Array.from({ length: len }, () => pick([...SIMON_COLOURS]));
  return { kind: 'simon', sequence };
}

// ─────────────────────────────────────────────
// 12. Anagram True/False
// ─────────────────────────────────────────────

const ANAGRAM_PAIRS: Array<{ w1: string; w2: string; isAnagram: boolean }> = [
  { w1: 'LISTEN', w2: 'SILENT', isAnagram: true  },
  { w1: 'STONE',  w2: 'NOTES',  isAnagram: true  },
  { w1: 'TRAIL',  w2: 'ALERT',  isAnagram: true  },
  { w1: 'FOREST', w2: 'SOFTER', isAnagram: true  },
  { w1: 'CLOUD',  w2: 'COULD',  isAnagram: true  },
  { w1: 'TRACK',  w2: 'CRACK',  isAnagram: false },
  { w1: 'PHOTO',  w2: 'TOPHO',  isAnagram: false },
  { w1: 'BRIDGE', w2: 'GIRDBE', isAnagram: false },
  { w1: 'SHADOW', w2: 'SHOWS',  isAnagram: false },
  { w1: 'LEAVES', w2: 'SLEAVE', isAnagram: true  },
];

function anagramPuzzle(): TrueFalsePuzzle {
  const item = pick(ANAGRAM_PAIRS);
  return {
    kind: 'tf',
    statement: `"${item.w1}" is an anagram of "${item.w2}"`,
    answer: item.isAnagram,
  };
}

// ─────────────────────────────────────────────
// Random puzzle picker
// ─────────────────────────────────────────────

const GENERATORS = [
  mathPuzzle,
  sequencePuzzle,
  triviaPuzzle,
  wordScramblePuzzle,
  colorNamePuzzle,
  countItemsPuzzle,
  trueFalsePuzzle,
  memoryPuzzle,
  oddOneOutPuzzle,
  shapeSortPuzzle,
  simonPuzzle,
  anagramPuzzle,
];

export function randomPuzzle(): Puzzle {
  return pick(GENERATORS)();
}
