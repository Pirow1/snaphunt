# SnapHunt

**Mobile hide-and-seek, played with your camera.** A hider photographs an object; seekers race through the real world — guided by a compass bearing and a proximity radar — to find and photograph *the same physical object*. A hybrid vision pipeline judges every submission: on-device CLIP for the clear cases, Claude vision for the borderline ones.

Built solo in **3 days** as a hackathon project. Vite + Supabase PWA — installs to the home screen, no app store.

## Screenshots

<!-- SCREENSHOTS: lobby · hider capture · seeker hunt (compass + radar) · verifying stamp · round recap -->
*Screenshots coming soon.*

## How the game works

1. **Host creates a lobby**, friends join with a short code (anonymous Supabase auth — no accounts).
2. Each round, one player is secretly the **hider**: they sneak off and photograph an object nearby.
3. **Seekers** get the hunt screen: a live compass arrow (Device Orientation API) and a GPS proximity radar pointing toward the hider's capture location.
4. When a seeker thinks they've found it, they photograph it. The submission goes through the vision pipeline and comes back stamped **MATCH** or **NO MATCH**, with a one-line verdict from a witty narrator.
5. Rounds run with countdowns and eliminations; the game ends in a **winner reveal** plus a gallery recap of every photo and a scoreboard.

All lobby/game state flows over Supabase Realtime, so phones stay in sync without polling.

## The vision pipeline

The interesting part. Verifying "is this the same physical object?" needs to be fast, cheap, and occasionally smart — so verification is split into two tiers:

**Tier 1 — on-device CLIP (free, ~instant).**
The browser runs `Xenova/clip-vit-base-patch16` (int8-quantized, ~87 MB, cached after first load) via `@huggingface/transformers`, preferring **WebGPU** and falling back to WASM where WebGPU isn't available. Both photos are embedded on the seeker's phone and compared by cosine similarity. A clearly-similar score is an instant local **match**; a clearly-different score is an instant local **reject**. No network round-trip, no API cost.

**Tier 2 — Claude vision for borderline calls.**
Scores between the two thresholds escalate to a Supabase Edge Function (Deno), which sends both photos to Claude with **forced tool use** — `tool_choice` pinned to a `submit_verdict` tool whose schema requires `similarity_score` (0–100), `same_object` (boolean), and a one-sentence `reasoning` written as the game's narrator. Structured output by construction: no JSON-in-prose parsing, no malformed responses. The prompt encodes the game's core rule — *same physical object, not same type* (two red mugs in different rooms are not a match; the same statue from two angles is).

The thresholds live in per-session settings, so the escalation rate is tunable per game without a redeploy.

## Stack

| Layer | Tech |
| --- | --- |
| App | React 18 + Vite + TypeScript, Tailwind CSS |
| State / routing | Zustand, React Router, **View Transitions API** for screen animation (no animation libraries) |
| On-device ML | `@huggingface/transformers` — CLIP ViT-B/16, WebGPU with WASM fallback |
| Cloud vision | Supabase Edge Function (Deno) + Anthropic SDK, Claude with forced tool use |
| Backend | Supabase — Postgres, Realtime broadcast, anonymous Auth, Storage, Edge Functions |
| Sensors | Device Orientation API compass (iOS `webkitCompassHeading` + Android `deviceorientationabsolute`), Geolocation API |
| Delivery | PWA with a service worker (precaches the ONNX runtime); deployed on Vercel with COOP/COEP headers so `SharedArrayBuffer` is available for threaded WASM |

## Getting started

### Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) project + the Supabase CLI
- An Anthropic API key (for the verification edge function)

### 1. Install & configure

```bash
npm install
cp .env.example .env.local
# fill in:
#   VITE_SUPABASE_URL=https://<your-project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>
```

### 2. Database & edge function

```bash
npx supabase db reset                            # apply migrations (tables, RLS, realtime policies)
npx supabase functions deploy verify-submission  # the Claude verification function
npx supabase secrets set ANTHROPIC_API_KEY=...   # server-side only; never shipped to the client
```

### 3. Run

```bash
npm run dev       # Vite dev server on :5173
npm run build     # production bundle to ./dist
npm run preview   # serve the bundle on :4173 (with COOP/COEP headers)
```

Camera, compass and geolocation all require a secure context — test on real phones over HTTPS (Vercel previews work well). First load downloads the ~87 MB CLIP model with a progress UI; it's cached after that.

### Deployment

Push to `main` → Vercel auto-deploys the frontend (`vercel.json` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, plus SPA rewrites). The edge function deploys separately via the Supabase CLI. Without the COOP/COEP headers the CLIP pipeline silently falls back to single-threaded WASM — slower, but the game still works.

## Project layout

```
src/screens/      One component per route (lobby, capture, hunt, verify, results, gallery)
src/components/   ui/ primitives (Button, Stamp, Toast) + game/ (Radar, BearingArrow, TargetCard)
src/lib/          Pure modules: vision, embeddings, compass, geolocation, camera, codes, audio, store
src/hooks/        useSession, useCompass, useGeolocation, useCountdown, useViewTransition
supabase/
  migrations/     Postgres schema, RLS, realtime policies
  functions/verify-submission/   Claude vision edge function (Deno)
```

## Honest notes

This was a 3-day hackathon build, and it shows in the right places: the happy path is smoke-tested end-to-end and the game plays well on real phones, but there are known rough edges (PWA icons are missing, and a strict `tsc -b` build still surfaces day-1 type debt that Vite happily transpiles through). The four "pillar" technologies — on-device CLIP, View Transitions, Claude tool use, and the cross-platform compass — were deliberate learning constraints, not incidental choices.
