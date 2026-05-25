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
- [x] **2.4** Seeker hunt screen + radar — passed 2026-05-25
  - Files: `src/components/game/{TargetCard,Radar}.tsx`, real `SeekerHuntScreen` (replaces placeholder), presence channel wiring
  - TargetCard: blurred photo via signed URL, sharpen power-up (blur 20→10→4→0 over 3 clicks), gold-left hint strip with one-shot reveal
  - Radar: CSS-only grid (3 rings + crosshair), 3s sweep, blaze ping, distance + temp (BURNING/HOT/WARM/COLD/FROZEN per spec §12.8), BearingArrow overlay
  - Presence: `presence:session:<id>` channel; seeker .track({ distance_meters }) — distance only, NO raw coords. Store flag `lastTrackedDistance` for diagnostic.
  - Smoke (`_smoke/phase-2-4.mjs`, non-headless): hider sets trap → seeker view loads, blurred photo via signed URL, sharpen×3 → blur 0/disabled, hint reveals, distance falls when GPS moves closer, presence track succeeds.
- [x] **2.5** Hybrid submission ⭐ Pillar 1 — local_high path passed 2026-05-25
  - Files: `submitGuess()` store action with 3-branch logic, `VerifyingScreen` (theatrical 4s scan), `ResultScreen` (forest/blaze banner + AI verdict + decision-source subtitle), SeekerHuntScreen submit-button wiring, GameRouter routing on submission status
  - Migrations: 0008 `claim_round_match` RPC (verifies seeker has matching submission before flipping round to finished, secure replacement for direct finalize_round_winner exposure), 0009 submissions UPDATE RLS for client-side local decisions
  - Cloud branch stubbed inline with 4s timer + random verdict (Phase 3.1 replaces with real Claude edge function)
  - Smoke (`_smoke/phase-2-5.mjs`, non-headless): seeker re-uploads hider's exact image → cosine=1.0 → decision_source=local_high, match=true, status=verified, ResultScreen "A Match!" / "Decided Locally · ~200ms", round.status=finished, winner_id set, +50 score
  - local_low + cloud branches: build is correct (Pillar 1 cosine path identical), full verification in Phase 3.1

## Day 3 — Cloud, scoring, polish

- [x] **3.1** Edge function with Claude tool use ⭐ Pillar 3 — passed 2026-05-25
  - Files: `supabase/functions/verify-submission/{index.ts,deno.json}`, `src/lib/store.ts` cloud branch swapped from setTimeout stub to `supabase.functions.invoke('verify-submission', ...)`
  - Edge function deployed via Supabase MCP (`deploy_edge_function`, id `c7eec51d-9190-4a7b-88b1-8c4efa055229`, ACTIVE). Uses `claude-sonnet-4-6` with VERDICT_TOOL + `tool_choice: { type: 'tool', name: 'submit_verdict' }` — schema-guaranteed output, no JSON parsing. Image content blocks use signed-URL sources. Function owns all DB writes for cloud branch + atomic `finalize_round_winner` RPC on match.
  - Spec departures: added CORS preflight handler (browser `functions.invoke` sends OPTIONS); imports rewritten to `jsr:`/`npm:` specifiers (Supabase MCP deploy convention vs. spec's `esm.sh`)
  - Smoke (`_smoke/phase-3-1.mjs`, non-headless): identical photos with seeker's local thresholds clamped to `[2.0, -1.0]` to force escalation. POST 200 in 5.5s edge-fn time / 11.4s round-trip. `decision_source='cloud'`, `cloud_similarity=100`, `is_match=true`, ResultScreen shows "A Match!" + "Verified by Claude" subtitle, round.status='finished', winner set, +50 score.
  - Sample reasoning Claude returned: *"These two images are pixel-perfect identical — the seeker didn't just find the statue, they practically found the same p[hoto]…"* (witty narrator voice per system prompt)
- [x] **3.2** Multi-round flow + scoring — passed 2026-05-25
  - Files: `src/hooks/useCountdown.ts`, real `src/screens/HiderWaitScreen.tsx`, `src/screens/GameRouter.tsx` (multi-round wiring), `src/hooks/useSession.ts` (submissions broadcast → store), `src/lib/store.ts` actions (`startNextRound`, `finishSession`, `expireRoundNoWinner`)
  - Migrations 0010 `start_next_round` + `expire_round_no_winner` RPCs (host-only, SECURITY DEFINER, atomic insert+update / status flip + hider 50% bonus), 0011 `broadcast_submission_change` trigger (mirrors 0006 pattern for submissions → `session:<id>` topic, event=`submissions`)
  - GameRouter multi-round wiring: when `round.id` changes, resets `accepted`/`currentSubmissionId`/`submissions` so RoleReveal fires again. Host-only effect: 5s after `round.status='finished'`, calls `startNextRound()` or `finishSession()` (last round). `session.status='finished'` triggers everyone navigating to `/gallery/:sessionId`.
  - HiderWaitScreen matches prototype: rotate(-3deg) "TRAP SET" stamp, floating eye SVG, mm:ss countdown via `useCountdown`, live seeker list reading from presence channel (distance + temp). Toasts on submission lifecycle (`X is verifying… (local)` / `X escalated to cloud` / `X matched!` or `no match`).
  - Smoke (`_smoke/phase-3-2.mjs`, non-headless, 3 browsers): full 3-round game with `rounds_total=3`. Hiders rotated Bob → Cleo → Alice (each +1 in join order), winners Alice/Alice/Bob, final scores Alice=100, Bob=50, Cleo=0, all clients navigated to `/gallery/<id>`, session.status='finished' with finished_at set.
  - Out of scope deferred to 3.3: hider/seeker "round over" mid-banner (currently they just see their existing screen during the 5s pause); no-winner expiry path (RPC exists, smoke doesn't exercise — 3 active wins).
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
- **2026-05-25** Phase 2.4 PASS — SeekerHuntScreen with TargetCard + Radar; sharpen 3-step blur, hint reveal, distance/temp readout, BearingArrow overlay, presence broadcasts distance only.
- **2026-05-25** Phase 2.5 PASS — Pillar 1 hybrid submission; local_high path verified end-to-end (cosine 1.0 → instant ResultScreen, +50pts, round finished). Cloud-stub fires after 4s; Phase 3.1 will swap with real Claude tool use.
- **2026-05-25** Phase 3.1 PASS — Pillar 3 wired; verify-submission edge function deployed, real Claude tool_use round-trip in ~5.5s, ResultScreen shows real reasoning + "Verified by Claude". Stub removed from store.ts.
- **2026-05-25** Phase 3.2 PASS — multi-round flow + scoring; HiderWaitScreen real (stamp + eye + presence list + countdown), GameRouter auto-advances on round.finished (5s pause), end-of-game → /gallery navigation. 3-round smoke verifies rotation, scores, finish-state across 3 browsers.
