# Claude Code Playbook — SnapHunt

> Sequenced prompts to drive Claude Code through the 14-phase build. Copy each section and paste it as a message when you reach that phase. Start with the kickoff.

## How to use this file

1. Set up the empty repo with the three docs in place:
- `snaphunt-spec-v2.md`
- `snaphunt.html` (the visual prototype)
- `CLAUDE.md`
1. Open Claude Code in the repo root.
1. Paste the **kickoff prompt** (next section). Let Claude Code respond and confirm it’s ready.
1. After each phase completes its smoke test, paste the next phase prompt.
1. If you want to YOLO it, see the “autonomous mode” prompt at the end — but expect more drift.

-----

## 🚀 Kickoff prompt

```
We're building SnapHunt, a hackathon project. Three docs in this repo are your
context:

  1. CLAUDE.md — repo conventions. Auto-loaded. Read it first.
  2. snaphunt-spec-v2.md — full build specification.
  3. snaphunt.html — single-file visual prototype, authoritative for design.

The build is divided into 14 phases across 3 days, listed in spec §13.

Workflow:
  - I will paste one phase prompt at a time.
  - For each phase: read the spec sections it names, implement, run the smoke
    test, report results, then stop and wait for me.
  - Do not move to the next phase until I tell you.
  - Do not add dependencies, substitute pillars, or expand scope without asking.

Before we start: please read CLAUDE.md and the spec's §1–§3, then confirm in
your own words:
  (a) the four architecture pillars
  (b) the workflow you'll follow
  (c) any questions or concerns about the plan

Do not start writing code yet.
```

-----

## Day 1

### Phase 1.1 — Scaffolding

```
Begin Phase 1.1 — Scaffolding. Read spec §4 (project structure), §5 (environment
& setup), §11.2 (View Transitions wrapper), and §17.2 (View Transitions notes).

Do:
  - Run the setup commands from §5.3
  - Configure Tailwind with the design tokens from CLAUDE.md and spec §11.7
  - Configure vite-plugin-pwa per spec §5.4
  - Add Google Fonts links to index.html
  - Set up React Router with placeholder routes for all 11 screens
  - Create src/styles/globals.css, grain.css, transitions.css with the
    scaffolding from spec §11.3
  - Create src/hooks/useViewTransition.ts per spec §11.2

Do NOT:
  - Implement any screen content yet (placeholders only)
  - Add any other dependencies

Smoke test: `npm run dev`, the app loads on /, shows "Hello" or similar
placeholder, has the cream background with paper grain visible, and clicking a
link to a placeholder route triggers a smooth View Transition (no hard cut, no
FOUC). Verify with the user agent matching mobile.

Run `npx tsc --noEmit` to confirm clean compile. Then report results and stop.
```

### Phase 1.2 — Supabase + anonymous auth

```
Begin Phase 1.2 — Supabase + Auth. Read spec §6 (DB schema), §7 (auth model),
and §5 (env vars).

Do:
  - Create supabase/migrations/0001_init.sql with the FULL schema from §6
    (sessions, players, rounds, submissions, indexes, RLS, AND the
    finalize_round_winner function from §10.3)
  - Create the two storage buckets via SQL: round-photos and submission-photos
  - Apply RLS policies from §6.2
  - Create src/lib/supabase.ts with the typed client
  - Wire signInAnonymously() in App.tsx — on mount, check session, sign in if
    none, store authUserId in Zustand
  - Create src/lib/store.ts with the Zustand store skeleton (see spec §11.1)
  - Create src/lib/types.ts with TypeScript types matching the DB schema

Do NOT:
  - Implement any screen logic yet
  - Add seed data

Smoke test: Reload the app. Open browser console. Verify:
  - supabase.auth.getSession() returns a valid session with a uuid user id
  - Zustand store has authUserId set
  - No errors in console
  - Running `select * from auth.users` in Supabase Studio shows your anon user

Report results and stop.
```

### Phase 1.3 — Home + Create lobby

```
Begin Phase 1.3 — HomeScreen + CreateLobbyScreen. Read spec §12.1, §12.2, and
the corresponding section of snaphunt.html for visuals. Read §11.7 (design
tokens).

Do:
  - Build src/lib/codes.ts: generateJoinCode() returns a 6-char uppercase code
    excluding ambiguous chars (no 0, O, 1, I, L)
  - Build src/components/ui/Button.tsx with the variants used in the prototype
    (primary blaze, dark, gold, ghost) — match the brutal shadow and active
    state exactly
  - Build src/components/ui/CrosshairBg.tsx (the SVG concentric circles + cross)
  - Build HomeScreen: title + tagline + two CTAs + meta footer (match prototype)
  - Build CreateLobbyScreen: name input (max 24 chars), 6-emoji picker
    (🦊🦌🦅🐝🐢🦉), Create button
  - Implement createSession() action in the store: insert into sessions, then
    players with is_host=true, navigate to /lobby/:sessionId
  - All inter-screen navigation uses useViewTransition

Do NOT:
  - Build LobbyScreen content yet (just the route)
  - Add a QR code yet

Smoke test:
  - Open the app, see the SNAPHUNT title with blaze accent rotated -3deg
  - Tap "START A HUNT", enter a name, pick an emoji, submit
  - Navigate to /lobby/<uuid> with a View Transition
  - Verify in Supabase Studio: one row in sessions, one row in players with
    is_host=true and your auth uid

Report results and stop.
```

### Phase 1.4 — Join screen + Lobby with realtime

```
Begin Phase 1.4 — JoinScreen + LobbyScreen with realtime. Read spec §12.3, §12.4,
§8 (realtime model). Match the prototype's keypad and lobby visuals exactly.

Do:
  - Build JoinScreen with the custom 6-slot code grid and the on-screen keypad
    (12 keys: 1-9, A, 0, DEL). Note: this replaces the native keyboard.
  - Support /join/:code deep linking — prefill code from URL param
  - On 6-char entered, call joinSession(code): validate code exists and session
    is in 'lobby' status, insert player row, navigate to /lobby/:sessionId
  - Build LobbyScreen:
    * Big mono code display
    * QR code (using the qrcode lib) encoding https://YOUR_DOMAIN/join/<CODE>
    * Player list with realtime subscription via useSession hook
    * "Begin Hunt" button (host only, disabled until ≥ 3 players)
  - Build src/hooks/useSession.ts that subscribes to players/rounds/submissions
    for the current session (see spec §8)
  - Player rows have a new-pulse animation when they appear (match prototype)

Do NOT:
  - Implement the "Begin Hunt" handler yet (Phase 2.1)
  - Build the vision loading indicator yet (Phase 1.5)

Smoke test:
  - Open two browsers (or one + an incognito window)
  - Browser A creates a session, sees the code
  - Browser B navigates to /join, types the code with the keypad
  - Browser B should appear in Browser A's lobby within 1 second (realtime)
  - Both QR codes are scannable and link to /join/<CODE>

Report results and stop.
```

### Phase 1.5 — Vision pipeline groundwork ⭐ PILLAR 1

```
Begin Phase 1.5 — Vision pipeline. Read spec §9 (the entire section), §17.1
(the appendix on Pillar 1), and §15 (the WebGPU/WASM gotchas).

THIS IS A LEARNING-CRITICAL PHASE. Read §17.1 in full before writing code.

Do:
  - Build src/lib/vision.ts exactly as spec §9.2. Use Xenova/clip-vit-base-patch16
    with dtype 'q4' and device 'webgpu', with WASM fallback on failure
  - Build src/lib/embeddings.ts with cosine, serialize, and deserialize (spec §9.3)
  - In HomeScreen, fire initVision() in a useEffect (don't await; let it download
    in background)
  - In LobbyScreen, show a "VISION xx%" indicator if the model is still loading
  - Add a temporary dev-only test page at /vision-test that lets you upload two
    images and see their cosine similarity
  - Configure the service worker to cache .onnx files (already in spec §5.4)

Do NOT:
  - Wire vision into the gameplay yet (that's Phase 2.2 and 2.5)
  - Try to optimize beyond q4 (q4 is the right tradeoff for our model)

Smoke test:
  - Reload the app. Open DevTools Network tab.
  - See the ONNX model files downloading (~85MB total)
  - In the console, verify the device is 'webgpu' (NOT 'wasm')
  - Navigate to /vision-test
  - Upload two photos of the same object (different angles): cosine should be > 0.85
  - Upload two photos of different objects: cosine should be < 0.55
  - Reload the app — model should load from service worker cache in <2s
  - Disable WebGPU in chrome://flags, reload — should fall back to WASM, still
    works (just slower, ~2s per encode)

Report results and stop. Mention the model load time and your cosine numbers.
```

-----

## Day 2

### Phase 2.1 — Round creation + role reveal

```
Begin Phase 2.1 — Round creation + role reveal. Read spec §12.4 (Begin Hunt
logic), §12.5 (RoleRevealScreen), §11.3 (shared-element view transitions).

Do:
  - Implement startGame() in the store, called by the host's "Begin Hunt" button:
    * Update session.status to 'playing'
    * Insert a row into rounds with round_number=1, status='pending', a
      randomly-chosen hider_id, point_value matching the difficulty default
    * Set session.current_round_id to the new round id
  - Build a GameRouter component at /game/:sessionId that watches the current
    round and renders the correct screen based on round.status and myRole
  - Build RoleRevealScreen with:
    * Stamp animation matching the prototype (rotate -4deg, scale-in keyframes)
    * Role title in blaze (hider) or gold (seeker), wdth 70
    * Role description (italic Fraunces)
    * "Accept Mission" button advancing to /game/:sessionId
  - The stamp element has viewTransitionName: 'role-stamp' so it morphs across
    routes (define the keyframes in transitions.css per spec §11.3)
  - Trigger View Transition when navigating into and out of RoleReveal

Do NOT:
  - Build HiderCaptureScreen content yet (Phase 2.2)
  - Build SeekerHuntScreen content yet (Phase 2.4)

Smoke test:
  - Across two browsers in the same session, host presses Begin Hunt
  - Both clients navigate to /game/:sessionId
  - One client sees "HIDER" stamp + role title, the other sees "SEEKER"
  - The stamp scale-in animation runs (no jank)
  - "Accept Mission" advances to a placeholder screen for hider/seeker

Report results and stop.
```

### Phase 2.2 — Hider capture + embedding ⭐ PILLAR 1

```
Begin Phase 2.2 — Hider capture screen + embedding storage. Read spec §12.6
and §9.5 (hider flow with embedding). Match the prototype's capture screen visuals.

Do:
  - Build src/components/game/PhotoCapture.tsx wrapping a hidden file input with
    capture="environment" and onChange handler
  - Build src/lib/camera.ts with compressedPhoto(file) using
    browser-image-compression (maxSizeMB: 0.5)
  - Build src/lib/geolocation.ts with getCurrentCoords() (high accuracy, 10s
    timeout) and haversine()
  - Build HiderCaptureScreen:
    * Capture target area with crosshair corner overlay (match prototype)
    * Difficulty chip row (Easy +50 / Medium +100 / Legendary +250)
    * Hint textarea (optional, italic Fraunces font)
    * Capture button + Set Trap button
  - On Set Trap:
    1. Compress photo
    2. encodeImage(blob) to get the embedding (show a brief encoding state)
    3. Upload photo to round-photos bucket at <roundId>.jpg
    4. getCurrentCoords()
    5. Update round with photo_path, photo_embedding (serialized), hider_lat,
       hider_lng, hint, difficulty, point_value, status='active', started_at,
       expires_at
  - The capture-target element has viewTransitionName: 'target-photo' to morph
    into the wait screen on the next phase

Do NOT:
  - Build HiderWaitScreen yet (next phase touches it briefly; full content
    is part of Phase 2.4 / 3.2)

Smoke test:
  - As hider, take a photo
  - See the photo encode (console: "encoding 1 image…")
  - Set Trap → wait ~1 second → navigate away
  - In Supabase Studio: round row should have photo_path, hider_lat, hider_lng,
    AND photo_embedding (an array of 512 floats)
  - The encoded embedding magnitude should be ~1.0 (since we normalize)

Report results and stop.
```

### Phase 2.3 — Compass + bearing arrow ⭐ PILLAR 4

```
Begin Phase 2.3 — Compass module + bearing arrow. Read spec §11.4 (compass
module), §11.5 (useCompass hook), §11.6 (BearingArrow component), and §17.4
(the appendix on Pillar 4).

Read §17.4 in full before writing code.

Do:
  - Build src/lib/compass.ts EXACTLY as in spec §11.4 — including the iOS
    webkitCompassHeading branch, Android alpha → 360-alpha conversion, and the
    requestCompassPermission() for iOS gesture
  - Add bearingTo(lat1, lng1, lat2, lng2) to compass.ts (geodesic bearing math
    in spec §11.4)
  - Build src/hooks/useCompass.ts (spec §11.5)
  - Build src/components/game/BearingArrow.tsx (spec §11.6)
  - The arrow is an SVG triangle, transformed via CSS rotate
  - In transitions, smooth with a 200ms ease (compass jitter is annoying)

Do NOT:
  - Wire the arrow into the seeker screen yet (next phase)

Smoke test:
  - Build a temporary /compass-test page that:
    * Shows the current device heading degrees
    * Shows a hardcoded bearing to a known landmark (use lat/lng for a famous
      building near you)
    * Shows a BearingArrow pointing at that landmark
  - On an iPhone: see the "Enable compass" button; tap it; heading reads;
    arrow points correctly relative to which way you face
  - On Android: should auto-work without permission prompt
  - Rotate the device 90° — arrow should rotate the same amount in the opposite
    direction (since you turned, but the target didn't move)

Report results and stop. Mention which platforms you tested.
```

### Phase 2.4 — Seeker hunt screen + radar

```
Begin Phase 2.4 — Seeker hunt screen. Read spec §12.8 and match the prototype's
seeker screen pixel-by-pixel (radar sweep, ping, distance, temp readout, action
buttons).

Do:
  - Build src/components/game/Radar.tsx with:
    * CSS-only radar grid (concentric circles + crosshair)
    * Animated sweep beam (3s linear infinite rotation, gold gradient)
    * Pulsing ping dot
    * Distance number in big mono font with shadow
    * Temp readout (BURNING / HOT / WARM / COLD / FROZEN) per thresholds
      in spec §12.8
    * BearingArrow overlaid at the center, rotating to point at hider
  - Build src/components/game/TargetCard.tsx with:
    * Blurred photo (filter: blur(20px) saturate(0.6))
    * Reveal-meta line ("RESOLUTION: 4%")
    * Hint strip with gold left border
  - Build SeekerHuntScreen:
    * Top: TargetCard
    * Middle: Radar
    * Bottom: action row with hint/sharpen mini-buttons + big shutter button
  - Implement useGeolocation hook with watchPosition (high accuracy, max age 2s)
  - Broadcast distance-only via Supabase Realtime presence (NEVER raw coords)
  - On first entry: show iOS "Enable compass" button if needed
  - Sharpen power-up: 3 levels (blur 20 → 10 → 4 → none), updates reveal-meta
  - Hint power-up: shows the hider's hint (1 use per round if hint exists)

Do NOT:
  - Wire the submit button to actual submission yet (next phase)
  - Implement HiderWaitScreen — that gets the simple version in 3.2

Smoke test:
  - As seeker, see the target card with blurred photo
  - Radar sweep animates smoothly
  - Distance updates as you "move" (simulate by changing GPS in DevTools)
  - Bearing arrow rotates as you face different directions
  - Sharpen 3 times → photo fully revealed
  - On hider's side: in Supabase Realtime presence, see seeker's distance
    updates (but NOT their coords)

Report results and stop.
```

### Phase 2.5 — Hybrid submission flow ⭐ PILLAR 1

```
Begin Phase 2.5 — Hybrid submission with local CLIP first-pass. Read spec §9.6
(the entire decision branching), §12.9 (VerifyingScreen), §12.10 (ResultScreen).

THIS IS THE ARCHITECTURAL HEART OF THE PROJECT. Re-read §17.1 first.

Do:
  - Implement submitGuess(rawFile) in the store, per spec §9.6 exactly:
    1. Compress photo
    2. encodeImage to get seeker embedding
    3. deserialize hider embedding from currentRound.photo_embedding
    4. Compute cosine similarity locally
    5. Compute haversine distance
    6. Insert submission row with local_similarity
    7. BRANCH:
       - sim ≥ local_match_threshold AND withinRange → upload, finalize local_high,
         show match
       - sim < local_reject_threshold → don't upload, finalize local_low, show
         no-match
       - otherwise → upload, navigate to /verifying, call edge function
  - Build VerifyingScreen exactly per the prototype: side-by-side photos with
    scan lines, "Cross-Referencing" title, rotating step messages, progress bar,
    dot trail
  - For now, STUB the edge function: it returns a random verdict after 4s
    (you'll replace it with the real one in Phase 3.1)
  - Build ResultScreen exactly per the prototype: match/no-match banner, points
    badge if match, side-by-side comparison, AI verdict quote, action buttons
  - Include the "DECIDED LOCALLY" / "VERIFIED BY CLAUDE" subtitle text per
    decision_source

Do NOT:
  - Wire the real Claude API yet (Phase 3.1)
  - Build the leaderboard / multi-round flow yet (Phase 3.2)

Smoke test:
  - As hider, set a trap with a clear, distinctive object
  - As seeker, capture the SAME object → local high → instant ResultScreen with
    "DECIDED LOCALLY · ~200ms" subtitle, +50 points
  - As seeker, capture an obvious wrong thing (e.g. photo of the floor) →
    local low → instant ResultScreen with no-match, "REJECTED LOCALLY · NO API
    CALL" subtitle
  - As seeker, capture something borderline (similar but not exact, e.g. a
    different green bench) → VerifyingScreen runs the animation → stub returns
    a random verdict → ResultScreen
  - Verify in DB: submissions have local_similarity, decision_source filled
    correctly per branch

Report results and stop. Confirm what % of your test submissions hit each branch.
```

-----

## Day 3

### Phase 3.1 — Edge function with Claude tool use ⭐ PILLAR 3

```
Begin Phase 3.1 — Real verification via Claude tool use. Read spec §10 (the
ENTIRE edge function spec), §17.3 (Pillar 3 appendix).

Read §17.3 first.

Do:
  - Create supabase/functions/verify-submission/index.ts EXACTLY as spec §10.2.
    Pay attention to:
    * The VERDICT_TOOL definition with input_schema
    * tool_choice: { type: 'tool', name: 'submit_verdict' } — REQUIRED
    * The system prompt (do not modify the wording)
    * The image content blocks with signed URLs
    * Extracting tool_use from response.content (not text!)
  - Add the deno.json with the necessary imports
  - Set the secret: npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
  - Replace the frontend stub from Phase 2.5 with a real fetch to the deployed
    edge function (or `supabase.functions.invoke('verify-submission', ...)`)
  - Confirm finalize_round_winner SQL function from Phase 1.2 is in place
  - Test with both match and no-match borderline submissions

Do NOT:
  - Modify the tool schema. The fields are exactly: similarity_score (int 0-100),
    same_object (bool), reasoning (string ≤280 chars)
  - Try to parse free-form text. The tool use is the entire point.
  - Add JSON parsing fallbacks "just in case" — let it error and retry

Smoke test:
  - Deploy edge function: npx supabase functions deploy verify-submission
  - Submit a borderline photo (similar but not identical)
  - VerifyingScreen runs → real Claude call → ResultScreen with:
    * Real cloud_similarity score (0-100)
    * Real cloud_reasoning sentence (witty narrator voice)
    * "VERIFIED BY CLAUDE" subtitle
  - Check edge function logs (npx supabase functions logs verify-submission):
    * Verify the response.content has a tool_use block
    * No JSON parsing errors
  - DB submission row: cloud_similarity, cloud_reasoning, decision_source='cloud',
    status='verified' all populated
  - If it's a match: round.winner_id set, status='finished', player.score
    incremented by point_value
  - Submit a SECOND match-photo from a different seeker in the same round →
    should get is_match=false (round already finished); finalize_round_winner
    RPC returns null

Report results and stop. Include the actual reasoning Claude returned for one
of your tests.
```

### Phase 3.2 — Multi-round flow + scoring

```
Begin Phase 3.2 — Multi-round flow + hider wait screen. Read spec §12.7
(HiderWaitScreen) and §13 Phase 3.2.

Do:
  - Build HiderWaitScreen with:
    * "TRAP SET" stamp at top
    * The wait-eye SVG illustration (match prototype)
    * Live seeker tracking list (read from Realtime presence — distance only)
    * Countdown timer using useCountdown hook
  - Build src/hooks/useCountdown.ts that takes an expires_at timestamp and
    returns mm:ss
  - Implement auto-create-next-round logic in GameRouter:
    * When current round status becomes 'finished'
    * If session.rounds_played < settings.rounds_total → host creates next round
      with rotated hider (next player in join order), navigates everyone to
      RoleReveal
    * If reached rounds_total → set session.status to 'finished', navigate to
      /gallery/:sessionId
  - When round ends with no winner: hider gets a bonus equal to 50% of
    point_value (silently incremented in DB; surfaced in ResultScreen)
  - HiderWaitScreen shows toasts when submissions come in:
    * "🐝 Sam is verifying… (local)" for decision_source !== 'cloud'
    * "🐝 Sam escalated to cloud" for decision_source === 'cloud'

Do NOT:
  - Build the gallery yet (Phase 3.3)
  - Add a manual "skip round" button (out of scope)

Smoke test:
  - Two browsers, run a full 3-round game (host setting rounds_total to 3 if
    needed for speed)
  - Each round rotates the hider correctly
  - HiderWaitScreen shows live tracking
  - Toasts appear when seeker submits
  - After 3 rounds, session.status = 'finished', everyone navigates to
    /gallery/:sessionId (placeholder)
  - Scores accumulate correctly across rounds

Report results and stop.
```

### Phase 3.3 — Gallery + polish

```
Begin Phase 3.3 — Gallery + sounds + haptics + final polish. Read spec §12.11
and match the prototype's gallery recap and scoreboard exactly.

Do:
  - Build GalleryScreen:
    * "THE SOUVENIRS" hero title
    * Recap card per round: hider name + match stamp (MATCH / NO MATCH /
      LEGENDARY) + photos side-by-side + AI quote
    * Each card shows decision source as a small stamp: "LOCAL" or "CLAUDE"
    * Scoreboard sorted desc with current player highlighted gold
    * "Play Again" button → navigate to / and clear session state
  - Build src/lib/audio.ts with:
    * blip(freq, duration, type) — Web Audio oscillator
    * playSuccessArpeggio() — 3-note triangle (C E G)
    * playFailDescend() — sawtooth pitch drop
  - Wire sounds on:
    * Button taps (subtle blip)
    * Match success (arpeggio)
    * No-match (descend)
    * Player joining lobby (sine blip)
  - Add navigator.vibrate calls on key actions (50ms for taps, 200ms for match,
    pattern [50,30,50] for fail)
  - Audit all toasts — make sure they have appropriate messaging
  - Add error states for: vision model failed to load, GPS denied, camera
    denied, edge function 500, network offline
  - Pre-flight check on RoleRevealScreen entry: confirm camera + GPS work

Do NOT:
  - Add new features
  - Refactor anything not directly broken

Smoke test:
  - Complete a full 3-round game
  - GalleryScreen renders correctly with all photos and AI quotes
  - Scoreboard math adds up
  - "Play Again" returns to home and clears state
  - Sound effects play and are not annoying
  - Vibration works on mobile (silent in desktop browser is fine)
  - Test denying camera permission → see appropriate error
  - Test denying GPS permission → see appropriate error

Report results and stop.
```

### Phase 3.4 — Deploy

```
Begin Phase 3.4 — Production deploy. Read spec §14 (deployment).

Do:
  - Confirm .env.local is gitignored and .env.example is committed
  - Create a Vercel project linked to the repo
  - Set Vercel env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  - Deploy frontend: git push origin main
  - Deploy edge function: npx supabase functions deploy verify-submission
  - Update QR code base URL to the Vercel domain (or custom domain if set)
  - Update manifest.webmanifest start_url + scope to the production URL
  - Open the deployed URL on an actual phone (not desktop simulator)
  - Add PWA to home screen
  - Run a full game from the installed PWA

Smoke test:
  - PWA installs and opens fullscreen on phone home screen
  - Camera permission flow works
  - Geolocation permission flow works
  - Compass permission flow works on iOS
  - CLIP model loads (might take 30s on cell data the first time)
  - Full 3-round game completes successfully on production
  - Cold-start (close PWA, reopen) — auth session persists, can rejoin
    if mid-game

Report results and stop. We're done!
```

-----

## 🤖 Autonomous mode (use at your own risk)

If you’d rather let Claude Code run unattended:

```
We're building SnapHunt. Three docs are in this repo:
  1. CLAUDE.md — repo conventions
  2. snaphunt-spec-v2.md — full spec (14 phases in §13)
  3. snaphunt.html — visual prototype
  4. claude-code-playbook.md — phase-by-phase prompts

Read CLAUDE.md and the spec. Then execute all 14 phases in order, running the
smoke test at the end of each phase. Continue to the next phase only if the
smoke test passes. If a smoke test fails, debug it before proceeding. If you
must deviate from the spec, ask me first.

After each phase, post a brief status update naming the phase, what you built,
and the smoke test result. Then continue.

Begin with Phase 1.1.
```

Be warned: autonomous mode will drift more, especially around visual fidelity
(it will skip prototype-matching details) and the four pillars (it may suggest
“simpler” alternatives). The phase-by-phase mode produces better results.

-----

## Troubleshooting prompts

### When something is broken and you don’t know why

```
Phase X.Y smoke test is failing. Specifically: [paste error or describe behavior].

Do not start changing code yet. First:
  1. Re-read the relevant spec section(s)
  2. Identify which assumption might be wrong
  3. Suggest a debugging plan (what to log, what to inspect)
  4. Wait for me to confirm before changing anything

If the issue is a missing or unclear part of the spec, surface that explicitly.
```

### When Claude wants to add a dependency

```
You proposed adding [library]. Per CLAUDE.md, dependencies require approval.

Before approving, answer:
  1. Why can't this be done with the existing stack?
  2. What's the bundle size impact?
  3. Is there a one-pillar substitute hiding in here? (e.g. framer-motion when
     View Transitions would work)
  4. How much code does it save vs writing it ourselves?

If 1 and 4 have weak answers, write it ourselves.
```

### When visual fidelity is slipping

```
The screen you just built doesn't match snaphunt.html for [specific element].

Reopen snaphunt.html, find the section for this screen, and adjust the
implementation to match exactly: [colors / shadows / typography / animations /
spacing — whichever specifically].

The prototype is the source of truth for visuals. Don't paraphrase it.
```

-----

*End of playbook. 14 phases, ~22 hours of focused work, three days, four learning bets.*