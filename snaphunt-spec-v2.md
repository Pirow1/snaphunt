# SnapHunt — Build Specification v2

> A mobile-first photographic hide-and-seek game. Hiders photograph a real-world object; seekers race to find and photograph the same object. **A hybrid vision pipeline** (on-device CLIP via WebGPU + cloud Claude for borderline cases) verifies matches. Built as a Progressive Web App for a 3-day hackathon.

-----

## How to use this document

This spec is written for an AI coding agent (Claude Code) to implement end-to-end. Sections are ordered roughly in build order. Each feature includes acceptance criteria. **Do not deviate from the tech stack** without explicit approval — the choices are optimized for a 3-day timeline AND a deliberate learning curve (see §1.3).

**Suggested kickoff prompt for Claude Code:**

> Read `snaphunt-spec.md` in this repo. We’re building a 3-day hackathon project. Follow the day-by-day plan in section 12. Start with Day 1, Phase 1 (project scaffolding). Stop after each phase, run the smoke test described, and confirm before continuing. Use the exact dependencies and versions listed in section 2. Do not invent additional libraries. Pay special attention to the four architecture pillars in section 3 — these are the deliberate learning bets and must not be substituted with simpler alternatives.

-----

## Table of contents

1. Product overview
1. Tech stack
1. **Architecture pillars (the four learning bets)**
1. Project structure
1. Environment & setup
1. Database schema
1. Authentication model
1. Realtime model
1. **Hybrid vision pipeline** (on-device CLIP + cloud Claude)
1. Edge function (verification)
1. Frontend architecture (including View Transitions + Compass)
1. Screen-by-screen specification
1. Day-by-day implementation plan
1. Testing & deployment
1. Known risks & gotchas
1. Stretch goals (post-MVP)
1. Appendix — learning notes per pillar

-----

## 1. Product overview

### 1.1 The game

A session of SnapHunt is a series of rounds played among 3–8 players in the same physical area. In each round:

1. **One player is the hider.** They find a distinctive fixed object, photograph it, optionally write a one-line hint, and choose a difficulty tier (Easy / Medium / Legendary). When they “set the trap,” the app pins their GPS coordinates AND computes a CLIP embedding of the photo on-device.
1. **All other players are seekers.** They see a blurred version of the photo, the hint, a radar showing distance, and **a compass arrow that points toward the hider’s coordinates** (using device magnetometer + geodesic bearing math).
1. **Seekers race to find and photograph the object.** When a seeker captures a photo, the app encodes it on-device with CLIP, compares cosine similarity against the hider’s embedding locally (no network round-trip), and produces an instant provisional verdict.
1. **For borderline cases (similarity 0.55–0.85), the photo is uploaded and verified by Claude** via the API with a strict tool-use schema. Claude returns a refined similarity score, a same-object boolean, and one-sentence reasoning.
1. **First seeker to score a match wins the round.** Scoring uses the difficulty tier. Roles rotate.
1. **The gallery** at end of game shows every photo pair with the AI’s verdict.

### 1.2 Key product principles

- **Mobile-first PWA.** Installs to home screen. No app store.
- **Outdoor by default.** GPS is required; indoor mode is a stretch goal.
- **Trust no single signal.** A match requires visual similarity AND location proximity within tolerance.
- **Local-first inference.** Most verifications happen on-device in <200ms. Cloud AI is reserved for ambiguity.
- **Native feel.** Screen-to-screen morphs use the View Transitions API, not JS animation libraries.
- **Anonymous auth.** Players pick a name and emoji. No email, no password.

### 1.3 Why these particular technologies

This is a hackathon project deliberately structured as a learning exercise. Four “pillars” (see §3) were selected because each one teaches a transferable skill that’s genuinely current in 2026:

- On-device CLIP teaches hybrid AI architecture and the WebGPU/ONNX stack
- View Transitions teaches the modern web platform
- Claude tool use teaches the production LLM-integration pattern
- Compass bearing teaches browser sensor fusion and cross-platform sensor APIs

**Do not substitute these with simpler alternatives.** The friction is the point.

### 1.4 Out of scope for MVP

Persistent accounts, friend systems, cross-session leaderboards, in-app chat, indoor mode, AR overlays, spectator mode. These are listed in §16.

-----

## 2. Tech stack

All choices are pinned. Use exact versions.

### 2.1 Frontend

|Concern         |Choice                       |Version    |Rationale                 |
|----------------|-----------------------------|-----------|--------------------------|
|Framework       |React                        |^18.3.0    |Mature, ubiquitous        |
|Build tool      |Vite                         |^5.4.0     |Fast dev server           |
|Language        |TypeScript                   |^5.5.0     |Catch errors early        |
|Styling         |Tailwind CSS                 |^3.4.0     |Speed                     |
|State           |Zustand                      |^4.5.0     |Lightweight               |
|Routing         |React Router                 |^6.26.0    |Standard                  |
|PWA             |vite-plugin-pwa              |^0.20.0    |Service worker + manifest |
|Maps            |Leaflet + react-leaflet      |^1.9 / ^4.2|Free, no API key          |
|QR generate     |qrcode                       |^1.5.4     |Simple                    |
|QR scan         |html5-qrcode                 |^2.3.8     |Mobile camera scanning    |
|Image compress  |browser-image-compression    |^2.0.2     |Shrink before upload      |
|Icons           |lucide-react                 |^0.400.0   |Tree-shakable SVG         |
|**On-device ML**|**@huggingface/transformers**|**^3.5.0** |**CLIP via ONNX + WebGPU**|

### 2.2 Backend

|Concern                          |Choice                                                      |Rationale                           |
|---------------------------------|------------------------------------------------------------|------------------------------------|
|DB + Auth + Storage + Realtime   |Supabase                                                    |Single dashboard, generous free tier|
|Edge functions                   |Supabase Edge Functions (Deno)                              |Co-located with DB                  |
|Vision AI (borderline cases only)|**Anthropic Claude API with tool use** (`claude-sonnet-4-6`)|Structured outputs, strong vision   |
|Hosting                          |Vercel                                                      |Zero-config for Vite                |

### 2.3 Fonts

Google Fonts: **Bricolage Grotesque** (display/UI, variable), **Fraunces** (italic accents), **JetBrains Mono** (mono).

### 2.4 Notably NOT used

- **No animation library** (framer-motion, react-spring) — use the View Transitions API natively
- **No JSON parsing for AI responses** — Claude tool use guarantees the schema
- **No third-party realtime SDK** beyond Supabase — Supabase Realtime is sufficient
- **No vector DB service** (Pinecone, Weaviate) — embeddings live in JSON columns; if you want indexed search later, pgvector is in Postgres already

-----

## 3. Architecture pillars (the four learning bets)

These shape decisions throughout the rest of the document. Read this section before any others.

### 3.1 Pillar 1 — On-device CLIP first-pass

The verification pipeline is **two-stage hybrid**:

1. **Local stage (always runs, ~200ms on WebGPU)**: Hider’s photo embedding is precomputed when they set the trap and downloaded by seekers when the round starts. When a seeker captures a photo, their device encodes it and computes cosine similarity locally. The result drives an *instant provisional verdict*.
1. **Cloud stage (only for similarity 0.55–0.85)**: If local similarity is in the uncertain band, the photo is uploaded and Claude is called via tool use. Claude returns a refined similarity, same-object boolean, and a witty reasoning string.

Outside the uncertain band, the local result is final — high similarity (>0.85) auto-matches; low (<0.55) auto-rejects. This cuts Claude API calls by ~70% and makes the UX feel instant for the obvious cases.

**Model choice**: `Xenova/clip-vit-base-patch16` in q4 quantization, image encoder only (`CLIPVisionModelWithProjection`). 512-dim embeddings. Bundle is ~85MB but cached after first download.

### 3.2 Pillar 2 — View Transitions for screen routing

All screen-to-screen navigation uses `document.startViewTransition()`. Shared elements (the hider’s photo card morphing into the seeker’s target reveal; the role stamp persisting across role-reveal → role screen) are coordinated via `view-transition-name` CSS. No JS animation library.

For browsers that don’t support View Transitions (older Safari, Firefox without flag), the API gracefully degrades to instant transitions — the app still works, just without the morph.

### 3.3 Pillar 3 — Claude tool use for verification

The edge function does not ask Claude to “return JSON.” It defines a `submit_verdict` tool with a strict input schema and uses `tool_choice: { type: 'tool', name: 'submit_verdict' }`. The model is forced to produce a structured response that’s already parsed by the SDK. No regex, no try/catch around `JSON.parse`.

### 3.4 Pillar 4 — Compass bearing arrow

The seeker’s radar isn’t just distance; it has a bearing arrow rotating in real time. The arrow points toward the hider’s coordinates by combining:

- **Geodesic bearing** (haversine sibling): computes the compass direction *from seeker → hider* given both lat/lng pairs
- **Device heading**: from `deviceorientationabsolute` (Android) or `webkitCompassHeading` (iOS)
- **Final rotation**: `arrowAngle = geodesicBearing - deviceHeading`

The iOS/Android divergence and the `requestPermission()` gesture-trigger are first-class concerns of the implementation, not afterthoughts.

-----

## 4. Project structure

```
snaphunt/
├── public/
│   ├── icons/                       # PWA icons
│   ├── manifest.webmanifest
│   └── favicon.svg
├── src/
│   ├── main.tsx                     # Entry
│   ├── App.tsx                      # Router root + View Transitions wrapper
│   ├── styles/
│   │   ├── globals.css              # Tailwind + custom CSS vars
│   │   ├── grain.css                # Paper texture overlay
│   │   └── transitions.css          # ::view-transition rules
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Stamp.tsx
│   │   │   ├── Ticket.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── CrosshairBg.tsx
│   │   └── game/
│   │       ├── Radar.tsx            # Includes BearingArrow
│   │       ├── BearingArrow.tsx     # Compass-driven rotation
│   │       ├── CodeInput.tsx
│   │       ├── PlayerRow.tsx
│   │       ├── PhotoCapture.tsx
│   │       ├── TargetCard.tsx
│   │       └── VerifyAnimation.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── CreateLobbyScreen.tsx
│   │   ├── JoinScreen.tsx
│   │   ├── LobbyScreen.tsx
│   │   ├── RoleRevealScreen.tsx
│   │   ├── HiderCaptureScreen.tsx
│   │   ├── HiderWaitScreen.tsx
│   │   ├── SeekerHuntScreen.tsx
│   │   ├── VerifyingScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   └── GalleryScreen.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── store.ts                 # Zustand store
│   │   ├── vision.ts                # CLIP pipeline (PILLAR 1)
│   │   ├── embeddings.ts            # Cosine, serialization
│   │   ├── geolocation.ts           # haversine + geodesic bearing
│   │   ├── compass.ts               # Cross-platform compass (PILLAR 4)
│   │   ├── camera.ts                # Capture + compression
│   │   ├── audio.ts                 # Web Audio blips
│   │   ├── codes.ts                 # Join code gen/validate
│   │   └── types.ts                 # Shared TS types
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useGeolocation.ts
│   │   ├── useCompass.ts            # PILLAR 4
│   │   ├── useViewTransition.ts     # PILLAR 2 wrapper
│   │   ├── useCountdown.ts
│   │   └── useToast.ts
│   └── api/
│       └── verify.ts                # Calls edge function when needed
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── functions/
│       └── verify-submission/
│           ├── index.ts             # Tool-use Claude call (PILLAR 3)
│           └── deno.json
├── .env.example
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

-----

## 5. Environment & setup

### 5.1 Required accounts

1. **Supabase** — new project; note URL + anon key
1. **Anthropic** — API key from console.anthropic.com
1. **Vercel** — for deployment

### 5.2 Environment variables

```bash
# Public (frontend)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Server-only (set via `supabase secrets set`)
ANTHROPIC_API_KEY=sk-ant-...
```

### 5.3 Initial commands

```bash
npm create vite@latest snaphunt -- --template react-ts
cd snaphunt
npm install

# Core
npm install @supabase/supabase-js zustand react-router-dom \
  leaflet react-leaflet qrcode html5-qrcode \
  browser-image-compression lucide-react

# The learning-bet dep
npm install @huggingface/transformers

# Dev
npm install -D tailwindcss postcss autoprefixer \
  vite-plugin-pwa @types/leaflet @types/qrcode

npx tailwindcss init -p
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 5.4 Vite config notes

The transformers.js library uses Web Workers and dynamic ONNX imports. In `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*'],
      workbox: {
        // Cache the ONNX runtime + CLIP model files for offline use
        runtimeCaching: [{
          urlPattern: /^https:\/\/huggingface\.co\/.*\.onnx$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'onnx-models',
            expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        }],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,  // 100MB for model files
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],  // Let it load its own WASM/ONNX
  },
});
```

-----

## 6. Database schema

Run as `supabase/migrations/0001_init.sql`.

```sql
create extension if not exists vector;  -- enables pgvector (used in stretch goals)

-- =============================================
-- SESSIONS
-- =============================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  status text not null default 'lobby',
  current_round_id uuid,
  settings jsonb not null default '{
    "rounds_total": 5,
    "round_duration_seconds": 1200,
    "location_tolerance_meters": 30,
    "local_match_threshold": 0.85,
    "local_reject_threshold": 0.55,
    "final_match_threshold": 75
  }'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_sessions_code on sessions(code);

-- =============================================
-- PLAYERS
-- =============================================
create table players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null check (length(name) between 1 and 24),
  emoji text not null default '🦊',
  score int not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_players_session on players(session_id);

-- =============================================
-- ROUNDS
-- =============================================
create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_number int not null,
  hider_id uuid not null references players(id),
  photo_path text,
  -- PILLAR 1: store CLIP embedding (512-dim float32) for fast seeker comparison
  photo_embedding jsonb,  -- json array of 512 floats; could use pgvector later
  hint text,
  difficulty text not null default 'easy',
  point_value int not null default 50,
  hider_lat double precision,
  hider_lng double precision,
  status text not null default 'pending',
  winner_id uuid references players(id),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_rounds_session on rounds(session_id);

-- =============================================
-- SUBMISSIONS
-- =============================================
create table submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  seeker_id uuid not null references players(id),
  photo_path text,                       -- nullable if local-rejected, no upload
  -- PILLAR 1: local fast-pass score
  local_similarity numeric,              -- 0.0-1.0 cosine similarity from CLIP
  -- Cloud verdict (only populated when escalated)
  cloud_similarity int,                  -- 0-100 from Claude
  cloud_reasoning text,
  -- Final decision
  is_match boolean,
  decision_source text,                  -- 'local_high' | 'local_low' | 'cloud'
  seeker_lat double precision not null,
  seeker_lng double precision not null,
  distance_meters double precision,
  status text not null default 'pending', -- pending | verified | error
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index idx_submissions_round on submissions(round_id);
```

### 6.1 Storage buckets

- `round-photos` (private) — hider’s target photos
- `submission-photos` (private) — seeker submissions that escalated to cloud

### 6.2 RLS policies

Identical to the v1 spec — see [v1 spec §5.3] for the SQL. The same anon-auth model applies. The new columns inherit the same row-level access. A snapshot of the key rules:

```sql
alter table sessions enable row level security;
alter table players  enable row level security;
alter table rounds   enable row level security;
alter table submissions enable row level security;

create policy "read own sessions" on sessions for select
  using (id in (select session_id from players where id = auth.uid()));
create policy "create session" on sessions for insert with check (true);
create policy "host updates session" on sessions for update using (host_id = auth.uid());

create policy "read session players" on players for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "join session" on players for insert with check (id = auth.uid());
create policy "update self" on players for update using (id = auth.uid());

create policy "read session rounds" on rounds for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "hider updates round" on rounds for update using (hider_id = auth.uid());

create policy "read own submissions" on submissions for select
  using (
    seeker_id = auth.uid()
    or round_id in (select id from rounds where hider_id = auth.uid())
  );
create policy "submit guess" on submissions for insert with check (seeker_id = auth.uid());
-- Edge function uses service role and bypasses RLS for updates
```

-----

## 7. Authentication model

Anonymous sign-in via `supabase.auth.signInAnonymously()` on app load. Player rows use `auth.uid()` as their primary key. Identity is `{ name, emoji }`. See §6 v1 spec; unchanged.

-----

## 8. Realtime model

Supabase Realtime CDC on `players`, `rounds`, `submissions` filtered by session/round. Presence channel for live position broadcasting from seekers (distance only, never raw coords).

Subscribe pattern in `useSession.ts`:

```ts
const channel = supabase.channel(`session:${sessionId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'players',
       filter: `session_id=eq.${sessionId}` }, handlePlayer)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds',
       filter: `session_id=eq.${sessionId}` }, handleRound)
  .subscribe();

// Separate channel per active round for submissions
const roundChannel = supabase.channel(`round:${roundId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions',
       filter: `round_id=eq.${roundId}` }, handleSubmission)
  .subscribe();
```

-----

## 9. Hybrid vision pipeline (PILLAR 1)

This section is the architectural heart of the project. Implement it carefully.

### 9.1 Model selection

- Model: `Xenova/clip-vit-base-patch16`
- Quantization: `q4` (smallest at ~85MB, acceptable accuracy)
- Device: `webgpu` with automatic fallback to `wasm`
- Subset: image encoder only (no text encoder needed for image-to-image comparison)

### 9.2 Pipeline module: `src/lib/vision.ts`

```ts
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers';

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let loadPromise: Promise<void> | null = null;

const MODEL_ID = 'Xenova/clip-vit-base-patch16';

export async function initVision(onProgress?: (pct: number) => void): Promise<void> {
  if (model && processor) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
    model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q4',
      device: 'webgpu',
      progress_callback: (info: any) => {
        if (info?.status === 'progress' && onProgress) {
          onProgress(Math.round(info.progress ?? 0));
        }
      },
    });
  })();

  try {
    await loadPromise;
  } catch (err) {
    // WebGPU failed; fallback to WASM
    console.warn('WebGPU init failed, falling back to WASM', err);
    model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: 'q4',
      device: 'wasm',
    });
  }
}

/**
 * Encodes an image (File, Blob, or HTMLImageElement) into a 512-dim normalized embedding.
 */
export async function encodeImage(input: Blob | string): Promise<Float32Array> {
  if (!model || !processor) {
    throw new Error('Vision not initialized. Call initVision() first.');
  }
  const image = await RawImage.read(input);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  // image_embeds is a Tensor [1, 512]
  const arr = image_embeds.data as Float32Array;
  return normalize(arr);
}

function normalize(v: Float32Array): Float32Array {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / mag;
  return out;
}
```

### 9.3 Cosine similarity: `src/lib/embeddings.ts`

```ts
/** Cosine similarity for L2-normalized vectors reduces to dot product. */
export function cosine(a: Float32Array, b: number[] | Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * (b as any)[i];
  return dot;  // already normalized
}

export function serializeEmbedding(v: Float32Array): number[] {
  // For JSONB storage; lose precision past float32 boundary
  return Array.from(v);
}

export function deserializeEmbedding(arr: number[]): Float32Array {
  return Float32Array.from(arr);
}
```

### 9.4 Boot strategy

Vision is initialized in the background as soon as the player joins a session — well before they need it. The lobby screen shows a subtle “Loading vision model… 23%” indicator if the model is still loading when the game starts.

```ts
// In LobbyScreen.tsx or useSession.ts
useEffect(() => {
  if (sessionId) {
    initVision((pct) => setVisionLoadProgress(pct));
  }
}, [sessionId]);
```

### 9.5 Hider flow (encoding once, then storing)

```ts
// In HiderCaptureScreen, on "Set Trap":
const photoBlob = await compressedPhoto(rawFile);
const embedding = await encodeImage(photoBlob);

// Upload photo to storage
const { data } = await supabase.storage
  .from('round-photos')
  .upload(`${roundId}.jpg`, photoBlob);

// Update round with photo_path AND embedding
await supabase.from('rounds').update({
  photo_path: data.path,
  photo_embedding: serializeEmbedding(embedding),
  hider_lat: coords.lat,
  hider_lng: coords.lng,
  hint,
  difficulty,
  status: 'active',
  started_at: new Date(),
  expires_at: new Date(Date.now() + 600_000),
}).eq('id', roundId);
```

### 9.6 Seeker flow (the hybrid decision)

```ts
// In SeekerHuntScreen, when seeker submits a photo:
async function submitGuess(rawFile: File) {
  const blob = await compressedPhoto(rawFile);
  const seekerEmbedding = await encodeImage(blob);
  const hiderEmbedding = deserializeEmbedding(currentRound.photo_embedding);
  const localSim = cosine(seekerEmbedding, hiderEmbedding);
  
  const settings = session.settings;
  const distanceM = haversine(myCoords, hiderCoords);
  const withinRange = distanceM <= settings.location_tolerance_meters;

  // Insert submission with local result
  const { data: submission } = await supabase.from('submissions').insert({
    round_id: currentRound.id,
    seeker_id: authUserId,
    seeker_lat: myCoords.lat,
    seeker_lng: myCoords.lng,
    distance_meters: distanceM,
    local_similarity: localSim,
  }).select().single();

  // Three branches:
  if (localSim >= settings.local_match_threshold && withinRange) {
    // Auto-match. Upload photo for the gallery; mark verified.
    await uploadAndFinalize(submission.id, blob, true, 'local_high', localSim);
    return showResult(true);
  }

  if (localSim < settings.local_reject_threshold) {
    // Auto-reject. Don't upload (save bandwidth).
    await finalizeNoUpload(submission.id, false, 'local_low', localSim);
    return showResult(false);
  }

  // Borderline → upload + call edge function
  await uploadPhoto(submission.id, blob);
  navigate('/verifying');
  const verdict = await fetch('/api/verify', {
    method: 'POST',
    body: JSON.stringify({ submission_id: submission.id }),
  }).then(r => r.json());
  return showResult(verdict.is_match);
}
```

### 9.7 Important caveat — bandwidth of embeddings

A 512-dim float32 embedding serialized as JSON is ~6KB. Sending it with every round read is fine. If you ever scale this to 100+ rounds per session, switch the column to `vector(512)` (pgvector) and only fetch the active round’s embedding.

### 9.8 Why this is the most important part of the project

Read §17.1 in the appendix before you start coding. The hybrid pattern is the headline learning outcome and the most non-obvious part of the build.

-----

## 10. Edge function — `verify-submission` (PILLAR 3)

**Only called for borderline submissions** (local similarity in the uncertain band). Implementation uses Claude’s tool use API for guaranteed structured output.

### 10.1 Input/output

```jsonc
// POST body
{ "submission_id": "uuid" }

// Response
{
  "submission_id": "uuid",
  "cloud_similarity": 87,
  "is_match": true,
  "distance_meters": 7.2,
  "cloud_reasoning": "Both photos show the same wooden park bench…",
  "round_winner": true
}
```

### 10.2 Full implementation

```ts
// supabase/functions/verify-submission/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Record the verification verdict for a SnapHunt submission.',
  input_schema: {
    type: 'object',
    properties: {
      similarity_score: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Visual similarity 0-100. 90-100 = clearly same object; 75-89 = likely same; 50-74 = same type but probably different specimen; 0-49 = different.',
      },
      same_object: {
        type: 'boolean',
        description: 'Whether both photos show the SAME PHYSICAL OBJECT (not just the same type).',
      },
      reasoning: {
        type: 'string',
        maxLength: 280,
        description: 'One sentence, written in the voice of a witty narrator delivering a verdict.',
      },
    },
    required: ['similarity_score', 'same_object', 'reasoning'],
  },
} as const;

const SYSTEM_PROMPT = `You are the verification judge for SnapHunt, a photo-based hide-and-seek game.
You compare two photos and decide if they show THE SAME PHYSICAL OBJECT — not just the same type.
Two red mugs in different rooms are NOT the same object. Two photos of the same statue from different angles ARE.
Always call the submit_verdict tool with your decision. Never reply in plain text.`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { submission_id } = await req.json();

  // 1. Load submission and round
  const { data: submission } = await supabase
    .from('submissions').select('*, rounds(*)').eq('id', submission_id).single();
  if (!submission) return new Response('Not found', { status: 404 });
  const round = submission.rounds;

  // 2. Compute distance
  const distance = haversine(
    round.hider_lat, round.hider_lng,
    submission.seeker_lat, submission.seeker_lng
  );

  // 3. Generate signed URLs for both photos
  const { data: hiderUrl } = await supabase.storage
    .from('round-photos').createSignedUrl(round.photo_path, 3600);
  const { data: seekerUrl } = await supabase.storage
    .from('submission-photos').createSignedUrl(submission.photo_path, 3600);

  // 4. Call Claude with tool use
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [VERDICT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_verdict' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Photo A (target object):' },
        { type: 'image', source: { type: 'url', url: hiderUrl.signedUrl } },
        { type: 'text', text: 'Photo B (seeker submission):' },
        { type: 'image', source: { type: 'url', url: seekerUrl.signedUrl } },
        { type: 'text', text: 'Compare and submit your verdict.' },
      ],
    }],
  });

  // 5. Extract verdict (guaranteed schema thanks to tool_choice)
  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    await supabase.from('submissions').update({ status: 'error' }).eq('id', submission_id);
    return new Response('AI response malformed', { status: 502 });
  }
  const verdict = toolUse.input as {
    similarity_score: number;
    same_object: boolean;
    reasoning: string;
  };

  // 6. Combine vision verdict + location check
  const sessionSettings = await getSessionSettings(round.session_id);
  const withinRange = distance <= sessionSettings.location_tolerance_meters;
  const isMatch = verdict.same_object
                  && verdict.similarity_score >= sessionSettings.final_match_threshold
                  && withinRange;

  // 7. Update submission
  await supabase.from('submissions').update({
    cloud_similarity: verdict.similarity_score,
    cloud_reasoning: verdict.reasoning,
    distance_meters: distance,
    is_match: isMatch,
    decision_source: 'cloud',
    status: 'verified',
    verified_at: new Date().toISOString(),
  }).eq('id', submission_id);

  // 8. If match AND round still active: declare winner
  let roundWinner = false;
  if (isMatch) {
    const { data: updatedRound } = await supabase.rpc('finalize_round_winner', {
      p_round_id: round.id,
      p_seeker_id: submission.seeker_id,
    });
    roundWinner = !!updatedRound;
  }

  return Response.json({
    submission_id,
    cloud_similarity: verdict.similarity_score,
    is_match: isMatch,
    distance_meters: distance,
    cloud_reasoning: verdict.reasoning,
    round_winner: roundWinner,
  });
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

async function getSessionSettings(sessionId: string) {
  const { data } = await supabase.from('sessions').select('settings').eq('id', sessionId).single();
  return data.settings;
}
```

### 10.3 Required SQL helper

```sql
create or replace function finalize_round_winner(p_round_id uuid, p_seeker_id uuid)
returns rounds as $$
declare
  v_round rounds%rowtype;
begin
  -- Atomic: only the first match wins
  update rounds
    set winner_id = p_seeker_id,
        status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;
  
  if v_round.id is not null then
    update players
      set score = score + v_round.point_value
      where id = p_seeker_id;
  end if;
  return v_round;
end;
$$ language plpgsql security definer;
```

### 10.4 Why tool use, not JSON-in-text

The previous spec parsed `JSON.parse(message.content[0].text)`. With tool use:

- The model **cannot return malformed JSON** — the API guarantees it
- No regex fallback, no try/catch around the parse
- Schema is part of the request, so the model has less freedom to drift
- `tool_choice: { type: 'tool', name: 'submit_verdict' }` forces the model to call this specific tool every time

This is the production pattern. Use it everywhere from now on.

-----

## 11. Frontend architecture

### 11.1 State management

Single Zustand store (`src/lib/store.ts`). Slices: identity, session, current round, geolocation, compass heading, submissions, vision-load-progress, toast.

### 11.2 Routing with View Transitions (PILLAR 2)

**Wrapper hook**: `src/hooks/useViewTransition.ts`

```ts
import { useNavigate } from 'react-router-dom';

export function useViewTransition() {
  const navigate = useNavigate();
  return (to: string, options?: { state?: unknown }) => {
    if (!('startViewTransition' in document)) {
      navigate(to, options);
      return;
    }
    (document as any).startViewTransition(() => {
      // React Router uses startTransition under the hood; flushSync isn't needed
      navigate(to, options);
    });
  };
}
```

**Usage in screens:**

```tsx
const go = useViewTransition();
<Button onClick={() => go('/lobby/' + sessionId)}>Begin Hunt</Button>
```

### 11.3 Shared-element transitions

Assign `view-transition-name` to elements that should morph across routes:

```tsx
// In HiderCaptureScreen
<img src={previewUrl} style={{ viewTransitionName: 'hider-photo' }} />

// In HiderWaitScreen (after navigation)
<img src={previewUrl} style={{ viewTransitionName: 'hider-photo' }} />
```

The browser auto-morphs the image’s position, size, and crop between the two screens. Combine with `src/styles/transitions.css`:

```css
@view-transition { navigation: auto; }  /* Opt in to MPA-style transitions */

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 350ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Custom transition for the role stamp */
::view-transition-old(role-stamp) {
  animation: stamp-out 250ms ease;
}
::view-transition-new(role-stamp) {
  animation: stamp-in 400ms cubic-bezier(0.5, -0.5, 0.3, 1.5);
}
```

### 11.4 Compass (PILLAR 4): `src/lib/compass.ts`

```ts
type CompassHandler = (headingDeg: number) => void;

let permissionGranted = false;

/**
 * iOS requires this to be called inside a user-gesture handler.
 */
export async function requestCompassPermission(): Promise<boolean> {
  const ev = (window as any).DeviceOrientationEvent;
  if (ev?.requestPermission) {
    try {
      const res = await ev.requestPermission();
      permissionGranted = res === 'granted';
      return permissionGranted;
    } catch {
      return false;
    }
  }
  // Android / desktop — no explicit permission needed
  permissionGranted = true;
  return true;
}

export function subscribeCompass(handler: CompassHandler): () => void {
  const listener = (e: DeviceOrientationEvent) => {
    let heading: number | null = null;
    // iOS-specific
    const webkitHeading = (e as any).webkitCompassHeading;
    if (typeof webkitHeading === 'number') {
      heading = webkitHeading;  // 0=N, 90=E, 180=S, 270=W (already clockwise)
    } else if ((e as any).absolute && typeof e.alpha === 'number') {
      // Android absolute: alpha is 0-360 counter-clockwise from north
      heading = 360 - e.alpha;
    }
    if (heading !== null) {
      handler(((heading % 360) + 360) % 360);
    }
  };
  // Prefer the absolute event when available
  const supportsAbsolute = 'ondeviceorientationabsolute' in window;
  const eventName = supportsAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(eventName, listener as any);
  return () => window.removeEventListener(eventName, listener as any);
}

/**
 * Geodesic bearing from (lat1, lng1) to (lat2, lng2), in degrees clockwise from north.
 */
export function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}
```

### 11.5 `useCompass` hook

```ts
export function useCompass(): { heading: number | null; requestPerm: () => Promise<boolean> } {
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => subscribeCompass(setHeading), []);
  return { heading, requestPerm: requestCompassPermission };
}
```

### 11.6 `<BearingArrow>` component

```tsx
function BearingArrow({ targetLat, targetLng }: { targetLat: number; targetLng: number }) {
  const { heading } = useCompass();
  const { coords } = useGeolocation();
  if (!coords || heading === null) return null;
  const bearing = bearingTo(coords.lat, coords.lng, targetLat, targetLng);
  const arrowAngle = (bearing - heading + 360) % 360;
  return (
    <div style={{ transform: `rotate(${arrowAngle}deg)`, transition: 'transform 0.2s ease' }}>
      ▲
    </div>
  );
}
```

### 11.7 Visual design tokens

Same as v1 — cream/ink/blaze/gold palette, Bricolage Grotesque + Fraunces + JetBrains Mono, brutal 4px offset shadows. See the prototype `snaphunt.html`.

-----

## 12. Screen-by-screen specification

Where a screen is mostly unchanged from v1, only the new responsibilities are listed.

### 12.1 HomeScreen — `/`

Triggers `supabase.auth.signInAnonymously()` on mount. **Also pre-initializes vision** in the background (`initVision()` fired but not awaited) so the model has a head start.

### 12.2 CreateLobbyScreen — `/create`

Name + emoji + create. **Now also: shows a “loading vision model” line if the model is still downloading.** Player can proceed without waiting; it’ll be ready by the time gameplay starts.

### 12.3 JoinScreen — `/join` or `/join/:code`

Unchanged from v1. The custom 6-key keypad UI.

### 12.4 LobbyScreen — `/lobby/:sessionId`

Code display, QR, player list, host’s “Begin Hunt” button. **New: shows a “VISION 87%” indicator until `initVision()` resolves.** Host button is disabled if vision model is still loading on any client (broadcast load status via Realtime presence).

### 12.5 RoleRevealScreen

Stamp animation; uses View Transitions to morph the stamp from a small element on the previous screen into the giant role title. `view-transition-name: role-stamp`.

### 12.6 HiderCaptureScreen

Photo capture, difficulty chip, hint, GPS pin. **New responsibilities:**

- On “Set Trap”: calls `encodeImage(photoBlob)` to compute the CLIP embedding
- Embedding is included in the round update along with photo_path/coords
- Shows “encoding…” spinner during the 100-300ms encode step (perceptually instant on WebGPU)

The capture-target element has `view-transition-name: target-photo` so it morphs into the wait screen’s photo preview.

### 12.7 HiderWaitScreen

Live tracking of seekers. Shows toast “🐝 Sam is verifying… (local)” or “🐝 Sam escalated to cloud” depending on `decision_source` field of incoming submissions.

### 12.8 SeekerHuntScreen

**This is where compass + view-transitions + on-device CLIP all converge.**

- Loads the hider’s embedding from the round (cached in store)
- `useGeolocation` watches position
- `useCompass` provides heading
- Radar shows distance, hot/cold meter, AND **bearing arrow rotating to point at the hider**
- iOS users: when entering this screen, show a one-time button “Enable compass” → `requestCompassPermission()` (must be inside a tap)
- On photo submit: runs `submitGuess()` which does local CLIP encode + cosine + decision branching (§9.6)
- The submit button has `view-transition-name: shutter-btn` and morphs into the verifying screen’s scanline target

### 12.9 VerifyingScreen

**Only shown when the submission escalated to cloud.** Theatrical loading. The previous spec’s 5-step messages remain.

For local-decided submissions (the 70% case), this screen is skipped — go straight to ResultScreen with no loading.

### 12.10 ResultScreen

Match / no-match banner, points, AI verdict.

- For local-high decisions: subtitle reads “DECIDED LOCALLY · 200ms” (a nice little flex)
- For local-low decisions: subtitle reads “REJECTED LOCALLY · NO API CALL”
- For cloud decisions: subtitle reads “VERIFIED BY CLAUDE” and shows the cloud reasoning quote

The result-photos use `view-transition-name: target-photo` and `submission-photo` to morph back to their cards on subsequent screens.

### 12.11 GalleryScreen — `/gallery/:sessionId`

End-of-game recap. Each recap card shows decision source as a small stamp (“LOCAL” or “CLAUDE”). Scoreboard sorted by score.

-----

## 13. Day-by-day implementation plan

Each phase ends with a smoke test. Do not proceed until it passes.

### Day 1 — Foundation

**Phase 1.1 — Scaffolding (1h)**

- Run setup commands from §5.3
- Configure Tailwind with custom palette + fonts
- Configure vite-plugin-pwa
- Set up React Router with empty placeholder routes
- Add View Transitions CSS scaffold to `transitions.css`
- **Smoke test:** App loads, shows “Hello” on `/`, dark/cream theme visible, route changes flash smoothly (no FOUC).

**Phase 1.2 — Supabase + auth (1.5h)**

- Run migration `0001_init.sql`
- Wire `signInAnonymously()` on load → store `authUserId`
- **Smoke test:** Console shows valid `auth.uid()`, no errors.

**Phase 1.3 — Home + Create lobby (1.5h)**

- HomeScreen with title + CTAs
- CreateLobbyScreen with name/emoji
- `createSession()` inserts session + host player
- Use `useViewTransition` for nav
- **Smoke test:** Create session → row in DB; route changes have View Transition morph.

**Phase 1.4 — Join + Lobby with realtime (2h)**

- JoinScreen with custom keypad
- LobbyScreen with QR + player list + realtime subscription
- **Smoke test:** Two browsers, one creates and one joins → both see live updated list.

**Phase 1.5 — Vision pipeline groundwork (2h) ⭐ PILLAR 1**

- Build `src/lib/vision.ts` and `src/lib/embeddings.ts`
- Call `initVision()` from HomeScreen on mount
- Add load-progress display to LobbyScreen
- Write a one-off test page: upload two images → log cosine similarity
- **Smoke test:** Load 2 images of the same object → cosine > 0.85. Load 2 different objects → cosine < 0.55. WebGPU device active in console.

### Day 2 — Gameplay core

**Phase 2.1 — Round creation + role reveal (1.5h)**

- “Begin Hunt” → create round 1 with random hider
- Realtime sub on `rounds` drives screen routing
- RoleRevealScreen with stamp animation + View Transition `role-stamp`
- **Smoke test:** All clients see correct role; stamp morphs on transition.

**Phase 2.2 — Hider capture + embedding (2.5h) ⭐ PILLAR 1**

- HiderCaptureScreen with photo capture + difficulty + hint
- GPS pin via `getCurrentPosition`
- On “Set Trap”: compress → encode (CLIP) → upload → update round with `photo_embedding`
- **Smoke test:** Round row has photo_path, lat/lng, AND `photo_embedding` (512-float array).

**Phase 2.3 — Compass + bearing arrow (2h) ⭐ PILLAR 4**

- Build `src/lib/compass.ts` with cross-platform compass
- Build `useCompass` and `<BearingArrow>` components
- Add iOS permission prompt UX to SeekerHuntScreen entry
- **Smoke test:** On an iPhone, tap “Enable compass” → arrow rotates to point at a known landmark. On Android, arrow auto-works.

**Phase 2.4 — Seeker hunt screen + radar (2h)**

- SeekerHuntScreen with TargetCard (blurred photo + sharpen), hint, radar (distance + temp + bearing arrow)
- `useGeolocation` watchPosition
- Presence broadcast of distance (not coords)
- **Smoke test:** Distance updates as coords change; arrow rotates as device rotates.

**Phase 2.5 — Hybrid submission + verifying (2h) ⭐ PILLAR 1**

- `submitGuess()` per §9.6: local encode → cosine → branch on thresholds
- VerifyingScreen only shown for cloud branch
- Stub edge function — return random verdict for now
- **Smoke test:** Take 3 obvious-match photos → all decided locally with no API call. Take 3 borderline photos → VerifyingScreen renders.

### Day 3 — Cloud verification, scoring, polish

**Phase 3.1 — Edge function with tool use (2h) ⭐ PILLAR 3**

- Build `verify-submission/index.ts` per §10
- Set `ANTHROPIC_API_KEY` via `supabase secrets set`
- Wire frontend to call only for borderline cases
- Run the SQL helper `finalize_round_winner`
- **Smoke test:** Submit a borderline photo → Claude returns structured verdict via tool use → DB updated; first match wins.

**Phase 3.2 — Result + multi-round flow (1.5h)**

- ResultScreen showing decision source + verdict
- After round ends, host auto-creates next round with rotated hider
- After N rounds, session → finished
- **Smoke test:** Full 3-round game across 2 devices; scores accumulate.

**Phase 3.3 — Gallery + polish (2.5h)**

- GalleryScreen with recap cards + scoreboard + “LOCAL”/“CLAUDE” stamps
- Sound effects (Web Audio blips, success arpeggio)
- Haptic feedback (`navigator.vibrate`)
- All toasts + error states
- Test on real phones
- **Smoke test:** Full 3-round game ends → gallery renders correctly.

**Phase 3.4 — Deploy (1h)**

- Push to GitHub → Vercel auto-deploy
- Set env vars in Vercel
- Deploy edge function
- **Smoke test:** Open deployed URL on phone, install as PWA, run a complete game.

-----

## 14. Testing & deployment

### 14.1 Manual test matrix

For each of iOS Safari, Android Chrome, desktop Chrome:

- Camera permission flow
- GPS permission flow
- **Compass permission flow (iOS-specific)**
- **Vision model download (first time)**
- **Vision model cache hit (second time, offline-ish)**
- **WebGPU vs WASM fallback** (test by disabling WebGPU in chrome://flags)
- PWA install
- Cold start mid-game

### 14.2 Deploy

```bash
git push origin main                                          # Vercel auto-deploys
npx supabase functions deploy verify-submission
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

-----

## 15. Known risks & gotchas

|Risk                                                     |Mitigation                                                                                                                                               |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
|**CLIP model 85MB on first load over cell data**         |Pre-cache via service worker; show progress UI; download starts on HomeScreen before user needs it                                                       |
|**WebGPU unsupported (~30% of devices)**                 |Automatic WASM fallback in `initVision()`; slower (~2s vs 200ms) but works                                                                               |
|**iOS Safari requires gesture for compass permission**   |First entry to SeekerHuntScreen shows a tap-to-enable button — never request silently                                                                    |
|**iOS uses `webkitCompassHeading`, Android uses `alpha`**|Cross-platform abstraction in `compass.ts` handles both                                                                                                  |
|**CLIP image embedding is rotation-sensitive**           |Tell hiders to take well-framed photos; tell seekers to match orientation. Optional: rotate seeker photo 0/90/180/270 and take max similarity.           |
|**Claude tool use occasionally returns no tool block**   |Edge function falls back to setting `status='error'` and lets frontend retry                                                                             |
|**Embedding similarity high but objects look different** |The cloud-stage Claude review catches this for borderline cases; the truly worst false positives only happen in the >0.85 auto-accept band, which is rare|
|**Two seekers match simultaneously**                     |`finalize_round_winner` RPC uses `update … where status='active'` — only first match returns a row                                                       |
|**iOS Safari blocks `getUserMedia` on non-HTTPS**        |Deploy to HTTPS day 1                                                                                                                                    |
|**View Transitions unsupported in older browsers**       |Wrapper hook degrades gracefully to instant `navigate()`                                                                                                 |
|**`view-transition-name` must be unique per frame**      |Generate dynamic names for list items: `view-transition-name: player-${id}`                                                                              |
|**Vision context isolation across sessions**             |Module-level `model` singleton is fine; cleanup not needed since each session starts fresh anyway                                                        |
|**Browser tab backgrounded → WebGPU context lost**       |Reload model on visibility change if `model` is null                                                                                                     |
|**Magnetometer interference (metal objects, indoors)**   |Bearing arrow shows a “low confidence” state when readings are erratic; fall back to distance-only UI                                                    |
|**Service role key leakage**                             |Only set on edge function via `supabase secrets`; never in frontend env                                                                                  |

-----

## 16. Stretch goals (post-MVP)

In priority order. Do not touch until §13 is complete.

1. **pgvector index on embeddings** — currently embeddings are in jsonb; promote to `vector(512)` with HNSW index for cross-session “similar past hunts” search
1. **Local fine-tune** — let players “vote” on bad matches; collect a small dataset; demonstrate few-shot learning prompts to improve Claude’s verdicts
1. **Decoy mode** — hider plants 1 real + 2 fake photos; seekers pick which is real (CLIP embeddings make this scoring trivial)
1. **WebXR AR overlay** — show the hider’s photo as a translucent ghost in the camera preview
1. **Team mode**
1. **Cross-session leaderboard via pgvector** — find “you’ve hidden objects similar to this 3 times before”
1. **Persistent accounts via Sign in with Apple/passkeys**

-----

## 17. Appendix — learning notes per pillar

Read each section *before* you start implementing the corresponding code.

### 17.1 Pillar 1 — On-device CLIP

**The mental model:** A neural net compresses any image into a fixed-size vector (“embedding”). Two embeddings can be compared via cosine similarity — a number from -1 to 1 measuring how “close” the meanings are in the model’s understanding. Same object from different angles → close (high cosine). Different objects → far (low cosine).

CLIP was trained on 400M image-caption pairs from the internet, so its embeddings encode rich semantic information. We’re using just the vision tower (image encoder) — not the text encoder, since we’re doing image-to-image comparison.

**Why on-device:** The math is the same whether it runs on a server or in your browser via WebGPU. By running it client-side, you avoid an API call, upload bandwidth, and latency. The tradeoff is the one-time 85MB model download and slower-than-server inference (~200ms on WebGPU instead of ~50ms on a beefy server GPU).

**Why hybrid:** CLIP embeddings are good but not perfect. The cosine score in the middle range (0.55–0.85) is where the model is genuinely uncertain. For those cases, a frontier vision model like Claude — with much larger context, reasoning ability, and natural-language understanding — does much better. So: do the cheap thing first, and only call the expensive thing when needed. This is the same pattern as caching, CDN edges, and tiered storage.

**What you’ll be able to do next**: any “find me products similar to this image” feature, any RAG-with-images system, any zero-shot classification, any on-device CV preview.

### 17.2 Pillar 2 — View Transitions API

**The mental model:** The browser takes a “snapshot” of the page before your DOM change and another after; then it interpolates between the two, animating elements by their bounding boxes. You name elements you want to track across the transition (`view-transition-name`) and the browser does the math.

**Why this matters:** Previously, doing this with JavaScript meant heavy libraries (framer-motion’s `LayoutAnimation`) that re-measured the DOM and animated transforms manually. View Transitions move this to native code — GPU-accelerated, no jank, way less code.

**Gotchas you’ll hit:**

- Two elements can’t share the same `view-transition-name` simultaneously (only one rendered per frame)
- Default animation crops to viewport — large off-screen morphs need explicit duration
- Doesn’t work for transitions you trigger programmatically without `startViewTransition()`

**What you’ll be able to do next**: any production app that needs native-feeling navigation; e-commerce product card → detail page; photo gallery → lightbox; sidebar → fullscreen.

### 17.3 Pillar 3 — Claude tool use

**The mental model:** Instead of asking an LLM “please return JSON in this shape” and parsing the text, you describe a function (tool) the LLM is allowed to “call.” The API returns a structured tool-call object that’s already typed. `tool_choice` forces the model to call your tool, eliminating “the model decided to chat instead” failures.

**Why this matters:** In production, you need guarantees about output shape. Parsing free-form LLM text is brittle — the model might add “Here’s your JSON:”, might add comments inside JSON, might forget a comma. Tool use eliminates all of this. It’s the production-grade pattern for any LLM-as-a-component system.

**What you’ll be able to do next**: any AI agent system (the “function calling” pattern), any structured data extraction pipeline (e.g. parse invoices → strict schema), any LLM-to-API bridge.

### 17.4 Pillar 4 — Compass bearing

**The mental model:** Your phone has a magnetometer, an accelerometer, and a gyroscope. Fused together, they estimate which way the device is pointing relative to magnetic north. The browser surfaces this via `deviceorientation` events. Combined with GPS (yours + target’s), you can compute the geodesic bearing from your position to the target’s, then subtract your heading to get the on-screen arrow angle.

**Why this is harder than it sounds:**

- iOS reports compass heading as `webkitCompassHeading` (clockwise from true north, 0=N)
- Android reports it as `alpha` on `deviceorientationabsolute` (counter-clockwise — so you subtract from 360)
- iOS requires a user-gesture-triggered `requestPermission()` call (added in iOS 13 for privacy)
- Magnetometer is noisy near metal (don’t test next to your laptop); needs smoothing for stable display
- “Absolute” orientation isn’t supported on all Android devices — falls back to relative (useless for compass)

**What you’ll be able to do next**: any geospatial AR experience; navigation apps that show “this way” arrows; any device-orientation game (tilt-to-steer); any sensor-fusion app.

-----

*End of specification v2. Target: ~3500 lines of TS/TSX + 100 lines of SQL + 250 lines of edge function. Achievable in 3 days for a focused team of 2-3, with the four pillars adding ~10 hours of learning-with-implementation that you’d otherwise miss.*