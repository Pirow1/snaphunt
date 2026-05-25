# CLAUDE.md

> This file is loaded automatically by Claude Code at the start of every session in this repo. Treat it as the project constitution.

## What this project is

**SnapHunt** — a mobile-first PWA hide-and-seek game where hiders photograph an object and seekers race to find and photograph the same object. A hybrid vision pipeline (on-device CLIP via WebGPU + cloud Claude for borderline cases) verifies matches. Built in 3 days as a hackathon project.

## Where the canonical docs live

- **`snaphunt-spec-v2.md`** — the full build specification. Read the relevant section before implementing anything.
- **`snaphunt.html`** — single-file visual prototype. Source of truth for design (colors, typography, button shadows, animations). Match it.
- **`claude-code-playbook.md`** — sequenced prompts for each build phase.

If anything in this file conflicts with `snaphunt-spec-v2.md`, the spec wins. If anything in the spec conflicts with the prototype’s visual treatment, the prototype wins for visuals.

## The four pillars — DO NOT substitute

This project deliberately uses four specific technologies for learning value. Do not swap them for simpler alternatives, even if you think you have a better idea. Ask the user first.

1. **On-device CLIP via `@huggingface/transformers` + WebGPU** for fast image similarity (with WASM fallback)
1. **View Transitions API** for screen routing (NOT framer-motion, NOT react-spring)
1. **Claude tool use** with `tool_choice` for the verification edge function (NOT JSON-in-text parsing)
1. **Device Orientation API** for compass bearing (cross-platform: iOS `webkitCompassHeading` + Android `deviceorientationabsolute`)

If you’re tempted to write `npm install framer-motion` — stop. Use `document.startViewTransition()`.

If you’re tempted to ask Claude to “respond with JSON” — stop. Define a tool and use `tool_choice: { type: 'tool', name: '...' }`.

## Tech stack (locked)

See spec §2 for the full table with versions. Highlights:

- React 18 + Vite + TypeScript + Tailwind
- Zustand for state, React Router for routing
- Supabase (Postgres + Realtime + Auth + Storage + Edge Functions)
- `@huggingface/transformers` for on-device ML
- Anthropic SDK (`@anthropic-ai/sdk`) for cloud vision via tool use

**No new dependencies without explicit user approval.** If you think you need one, ask.

## File layout

Follow spec §4 exactly. Quick reference:

- `src/screens/` — one component per route
- `src/components/ui/` — generic primitives (Button, Stamp, Toast)
- `src/components/game/` — game-specific (Radar, BearingArrow, TargetCard)
- `src/lib/` — pure modules (vision, embeddings, compass, geolocation, codes, audio)
- `src/hooks/` — React hooks (useSession, useCompass, useViewTransition, useGeolocation)
- `src/api/` — frontend API call wrappers (e.g. verify.ts → edge function)
- `supabase/migrations/` — SQL
- `supabase/functions/verify-submission/` — edge function (Deno)

## Coding conventions

### TypeScript

- `tsconfig.json` should have `strict: true`. Don’t loosen it.
- Prefer `type` aliases over `interface` for plain shapes; `interface` only for things meant to be extended.
- No `any`. Use `unknown` + narrowing.
- Exhaustive switches use a `never` assertion in the default branch.

### React

- Functional components only. No class components.
- Hooks at top level — never inside conditions or loops.
- One screen component per file. Components in the same folder are co-located helpers.
- Default exports for screens (matches React Router convention); named exports for everything else.

### Styling

- Tailwind utility classes for everything. No inline `style` props except for dynamic transforms (compass arrow) and `viewTransitionName`.
- Custom CSS only in `src/styles/` for things Tailwind can’t do (paper grain, view-transition pseudo-elements, custom keyframes).
- Colors and fonts via CSS variables defined in `globals.css` — also surfaced in `tailwind.config.ts` so utilities like `bg-blaze` work.

### Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for components.
- Variables: `camelCase`. Constants: `SCREAMING_SNAKE_CASE`.
- Booleans: prefix with `is`/`has`/`should`/`can`.
- Hooks: prefix with `use`.

### Errors

- Async functions throw on failure; the caller handles. Don’t return `{ ok, error }` tuples.
- User-facing errors go through the `toast()` helper. Never `alert()`.
- Edge function errors return JSON `{ error: string }` with proper HTTP status.

### Comments

- Comments explain *why*, not *what*. Code shows what.
- TODO comments must include a name or ticket: `// TODO(snaphunt): refine bearing smoothing`.
- No commented-out code. Delete it; git remembers.

## Visual design

The prototype (`snaphunt.html`) is authoritative. Key tokens (also in `tailwind.config.ts`):

- Cream `#F4E8D0`, ink `#1A1614`, forest `#1F3A2E`, blaze `#E94F2A`, gold `#E8B547`, plum `#5C2A4A`
- Display + UI: Bricolage Grotesque (variable, `wdth` axis used for the squeezed look)
- Italic accents: Fraunces (`WONK 1` axis for the wonky cuts)
- Mono: JetBrains Mono
- Signature button: `border-2 border-ink` + `shadow-brutal` (4px 4px 0 ink); active state translates 3px/3px with smaller shadow
- Paper grain overlay on every screen via `::before` pseudo-element on `#app`
- Stamps: rotate `-3deg`, blaze background, cream text, 800 weight, wide tracking

If you’re unsure how a screen should look, open `snaphunt.html` and copy the visual treatment.

## Workflow

This is critical. Follow it.

1. **Read the relevant spec section before writing code.** Each phase prompt names the sections.
1. **Implement one phase at a time.** Do not skip ahead.
1. **Run the smoke test at the end of each phase.** State the result clearly: “smoke test passed: [what you verified]”.
1. **STOP after each phase and report.** Wait for user confirmation before continuing.
1. **If a smoke test fails, debug first.** Do not silently move on.
1. **If you discover a problem in the spec, surface it.** Don’t paper over it — the spec is meant to be a living doc.

## What NOT to do

- ❌ Add new dependencies without asking
- ❌ Substitute any of the four pillars
- ❌ Use `framer-motion`, `react-spring`, or any JS animation library — use View Transitions
- ❌ Parse free-form text from Claude — use tool use
- ❌ Add chat features, persistent accounts, friend systems, AR (these are explicitly out of scope; see spec §16)
- ❌ Write integration tests until the entire MVP is done — there’s no time
- ❌ Refactor working code mid-phase — finish the phase, then propose refactors
- ❌ Hide errors behind try/catch + silent return — let them surface
- ❌ Commit `.env.local`, API keys, or `node_modules`

## Commands

```bash
# Dev
npm run dev                                    # Vite dev server on :5173

# Build
npm run build                                  # Production bundle to ./dist
npm run preview                                # Preview the production bundle

# Type check
npx tsc --noEmit                               # Run before declaring a phase done

# Supabase
npx supabase db reset                          # Reapply migrations to local DB
npx supabase functions serve verify-submission # Local edge function dev
npx supabase functions deploy verify-submission
npx supabase secrets set ANTHROPIC_API_KEY=... # Set production secret

# Deploy
git push origin main                           # Vercel auto-deploys frontend
```

## Pacing expectations

- ~3 days total
- 14 phases (5 on day 1, 5 on day 2, 4 on day 3) — see spec §13
- Each phase is 1–3 hours
- If a phase is taking >2x the estimate, stop and ask for help — something is wrong with the approach

## When in doubt

Ask. Don’t guess at:

- Whether to add a library
- Whether to change a schema
- Whether to alter visual design
- Whether to skip a smoke test
- Whether to deviate from a pillar

A 30-second clarification beats 30 minutes of wasted work.