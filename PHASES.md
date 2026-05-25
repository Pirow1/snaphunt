# SnapHunt — Phase Tracker

Single source of truth for build progress. The `/pm` skill reads + writes this
file. Don't edit by hand mid-phase; let `/pm` mutate it so the log stays clean.

**Symbols** — `[ ]` pending · `[~]` in progress · `[x]` complete · `[!]` blocked

---

## Day 1 — Foundation

- [x] **1.1** Scaffolding — passed 2026-05-25 · commit `348d777`
  - Vite + React 18.3 + TS strict + Tailwind 3.4 + Router + PWA + View Transitions
  - Smoke: cream bg + grain visible, blaze/cream-2 buttons, VT API supported, nav works
- [~] **1.2** Supabase + anonymous auth — code written 2026-05-25, awaiting migration apply
  - Files: `supabase/migrations/0001_init.sql`, `src/lib/{types,supabase,store}.ts`, `App.tsx` auth wire
  - Blocker: user must apply migration via Studio SQL editor and enable Anonymous sign-ins
- [ ] **1.3** Home + Create lobby
- [ ] **1.4** Join + Lobby with realtime
- [ ] **1.5** Vision pipeline groundwork ⭐ Pillar 1

## Day 2 — Gameplay core

- [ ] **2.1** Round creation + role reveal
- [ ] **2.2** Hider capture + embedding ⭐ Pillar 1
- [ ] **2.3** Compass + bearing arrow ⭐ Pillar 4
- [ ] **2.4** Seeker hunt screen + radar
- [ ] **2.5** Hybrid submission ⭐ Pillar 1

## Day 3 — Cloud, scoring, polish

- [ ] **3.1** Edge function with Claude tool use ⭐ Pillar 3
- [ ] **3.2** Multi-round flow + scoring
- [ ] **3.3** Gallery + polish
- [ ] **3.4** Deploy

---

## Activity log

- **2026-05-25** Phase 1.1 PASS — commit `348d777` (root-commit)
- **2026-05-25** Phase 1.2 START — code written; awaiting Supabase migration apply
