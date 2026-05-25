# SnapHunt — Phase Tracker

Single source of truth for build progress. The `/pm` skill reads + writes this
file. Don't edit by hand mid-phase; let `/pm` mutate it so the log stays clean.

**Symbols** — `[ ]` pending · `[~]` in progress · `[x]` complete · `[!]` blocked

---

## Day 1 — Foundation

- [x] **1.1** Scaffolding — passed 2026-05-25 · commit `348d777`
  - Vite + React 18.3 + TS strict + Tailwind 3.4 + Router + PWA + View Transitions
  - Smoke: cream bg + grain visible, blaze/cream-2 buttons, VT API supported, nav works
- [x] **1.2** Supabase + anonymous auth — passed 2026-05-25
  - Files: `supabase/migrations/0001_init.sql`, `0002_harden_finalize_round_winner.sql`, `src/lib/{types,supabase,store}.ts`, `App.tsx` auth wire
  - 2026-05-25 — migrations 0001 + 0002 applied to remote via Supabase MCP
  - 2026-05-25 — Anonymous sign-ins toggled ON in Supabase dashboard
  - Smoke (`_smoke/phase-1-2.mjs`): getSession() returns UUID, store.identity.authUserId matches, isAnonymous=true, ES256 JWT, 0 console errors
- [x] **1.3** Home + Create lobby — passed 2026-05-25
  - Files: `src/lib/codes.ts`, `src/components/ui/{Button,CrosshairBg}.tsx`, `src/screens/{HomeScreen,CreateLobbyScreen}.tsx`, `createSession()` action in store
  - Migration `0003_fix_rls_recursion` applied to fix 42P17 in spec §6.2 policies (used a SECURITY DEFINER `my_session_ids()` helper)
  - Smoke (`_smoke/phase-1-3.mjs`): HUNT span rotate(-3deg) + blaze color, name+emoji flow inserts session+player row with correct fields, nav lands on /lobby/&lt;uuid&gt; via View Transition
- [x] **1.4** Join + Lobby with realtime — passed 2026-05-25
  - Files: `useSession` hook, `joinSession()` store action, `JoinScreen`, `LobbyScreen`, `TopBar`/`PlayerRow`/`CodeInput` components
  - Migrations 0004 (RPC + publication), 0005 (realtime.messages RLS), 0006 (broadcast triggers) applied via Supabase MCP
  - Spec quirks: codes restricted to `23456789A` to match keypad; realtime CDC unreliable on supabase-js 2.106 — switched to private-channel broadcast-from-trigger
  - Smoke (`_smoke/phase-1-4.mjs`): 2-browser test, B appears in A's lobby in 483 ms, QR canvas renders, Begin Hunt disabled at <3 players
- [x] **1.5** Vision pipeline groundwork ⭐ Pillar 1 — passed 2026-05-25
  - Files: `src/lib/{vision,embeddings}.ts`, `src/screens/VisionTestScreen.tsx` (`/vision-test` DEV-only), HomeScreen + LobbyScreen wired to `setVisionLoadProgress` / `setVisionReady`
  - Spec departure: dtype `q4` doesn't exist on Xenova/clip-vit-base-patch16; used `q8` which maps to vision_model_quantized.onnx (87MB int8 — matches spec's stated size)
  - COOP + COEP `credentialless` headers added to Vite for SharedArrayBuffer threading
  - WebGPU works in non-headless Chromium; headless lacks GPU adapter, WASM session create hangs there — smoke runs non-headless
  - Smoke (`_smoke/phase-1-5.mjs`): device=webgpu, |v|=1.0000, encode ~1.2s, identical→1.0, ordering verified (synthetic images compress to [0.999,1.000])

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
- **2026-05-25** Phase 1.2 — migrations 0001 + 0002 applied via Supabase MCP; advisor warnings on `finalize_round_winner` cleared; remaining blocker: enable Anonymous sign-ins in dashboard
- **2026-05-25** Phase 1.2 PASS — Anonymous sign-ins enabled; smoke test confirms anon UUID flows from Supabase → store
- **2026-05-25** Phase 1.3 PREP — migration `0003_fix_rls_recursion` applied via Supabase MCP; hotfix for 42P17 recursion in 0001's `players`/`sessions`/`rounds` SELECT policies. DB ready for Create lobby flow.
- **2026-05-25** Phase 1.3 PASS — Home + Create lobby; createSession() inserts session+host player; smoke verifies title rotation, blaze color, DB rows, store wiring
- **2026-05-25** Phase 1.4 PASS — Join + Lobby with realtime; broadcast-from-trigger pattern (CDC postgres_changes was unreliable on supabase-js 2.106); B appears in A's lobby in 483 ms
- **2026-05-25** Phase 1.5 PASS — Pillar 1 CLIP pipeline via @huggingface/transformers; WebGPU + q8 quantized model (~87MB); /vision-test dev page; HomeScreen pre-warms model on mount
