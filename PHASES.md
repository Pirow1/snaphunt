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

- [x] **2.1** Round creation + role reveal — passed 2026-05-25
  - Files: `startGame()` store action, `src/screens/GameRouter.tsx`, `src/screens/RoleRevealScreen.tsx`; LobbyScreen "Begin the Hunt" wired
  - GameRouter is the in-game state machine: per-client `accepted` flag, renders RoleReveal then Hider/Seeker placeholder. View Transition runs lobby→game via session.status broadcast.
  - Stamp animation matches prototype (rotate(-4deg) scale 3→0.92→1 over 600ms)
  - Smoke (`_smoke/phase-2-1.mjs`, 3 browsers): all reach /game in 679 ms; hiders=1, seekers=2; stamps render; Accept Mission routes to correct placeholder
- [x] **2.2** Hider capture + embedding ⭐ Pillar 1 — passed 2026-05-25
  - Files: `src/lib/{camera,geolocation}.ts`, `src/components/game/PhotoCapture.tsx`, real `HiderCaptureScreen`, `setTrap()` store action, migration `0007_create_session_rpc` (avoids RLS chicken-and-egg on host upsert), `useSession` SUBSCRIBED re-fetch (catches realtime race), bumped Supabase anon rate limit to 200/hr/IP
  - Pillar 1 fully wired: compress → encode (CLIP) → GPS pin → upload → atomic round UPDATE
  - Smoke (`_smoke/phase-2-2.mjs`, non-headless): full 3-browser game start → trap. round row has photo_path, hider_lat=51.5074, hider_lng=-0.1278, hint, difficulty=medium, point_value=100, status=active, started_at, expires_at, 512-dim embedding with |v|=1.0000, photo accessible via signed URL
- [x] **2.3** Compass + bearing arrow ⭐ Pillar 4 — passed 2026-05-25
  - Files: `src/lib/compass.ts` (iOS webkitCompassHeading + Android 360-alpha + requestPermission gesture + bearingTo geodesic), `src/hooks/{useCompass,useGeolocation}.ts`, `src/components/game/BearingArrow.tsx`, `src/screens/CompassTestScreen.tsx` (`/compass-test` DEV-only)
  - Smoke (`_smoke/phase-2-3.mjs`): synthesises DeviceOrientation events. Position 330m N of Big Ben → bearing=180°. alpha=0 → heading=0° (arrow 180°); alpha=270 → heading=90° (arrow 90°). Δ=-90° = correct 90° CCW rotation. bearingTo(0,0,1,1)=45°.
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
- **2026-05-25** Phase 2.1 PASS — startGame()/GameRouter/RoleRevealScreen; 3-browser smoke: roles assigned correctly, View Transition lobby→game works (screenshot caught mid-morph)
- **2026-05-25** Phase 2.2 PASS — Pillar 1 wired into gameplay; setTrap() persists embedding (512 floats, |v|=1.0) + photo + GPS + difficulty. Migration 0007 atomic create_session_with_host RPC. Realtime SUBSCRIBED re-fetch race fix. Supabase anon rate limit bumped to 200/hr to support smoke runs.
- **2026-05-25** Phase 2.3 PASS — Pillar 4 compass + bearing math; cross-platform (iOS webkitCompassHeading, Android 360-alpha, requestPermission gesture); /compass-test DEV page verifies arrowAngle = (bearing − heading + 360) mod 360 with synthesised events.
