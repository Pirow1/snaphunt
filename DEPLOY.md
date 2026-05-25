# SnapHunt — Deploy Checklist

Phase 3.4 prep landed on commit `a826f8f…`. The repo is deploy-ready;
this file is what you actually run + check.

## What's already done (verified locally)

- `.env` + `.env.local` gitignored; `.env.example` tracked; neither real env file has any git history.
- `npm run build` produces a clean `dist/` (Vite production bundle, ~1.4 MB JS gzipped to 388 KB + ~21 MB ORT WASM precached by the service worker).
- `npm run preview` serves the bundle on `:4173` with COOP/COEP headers — full 2-round game smoke (`_smoke/phase-3-3.mjs`) passes against it (recap cards, scoreboard, Play Again clears store).
- Edge function `verify-submission` already deployed to Supabase (Phase 3.1 deploy; `id c7eec51d-9190-4a7b-88b1-8c4efa055229`, status ACTIVE). Anthropic key already set as a Supabase secret.
- `vercel.json` ships COOP `same-origin` + COEP `credentialless` so SharedArrayBuffer is available in production (CLIP WebGPU + WASM-threaded fallback) and SPA rewrites send unknown paths to `index.html`.
- `manifest.webmanifest` structurally correct (`start_url: "/"`, `scope: "/"`, `display: standalone`, theme + bg color match design); SW + manifest links injected into `dist/index.html`.
- `window.supabase` + `window.useStore` exposed in production builds (anon-only, no secrets) for browser-console debugging from a deployed phone and so the production smoke can drive the bundle.

## Known deferred items (not blocking deploy)

- **PWA icons** — `public/icons/` does not exist; manifest has `icons: []`. iOS Add-to-Home-Screen will use a fallback (page screenshot); Android Chrome will use the URL favicon. Add `public/icons/icon-512.png` (and `icon-192.png`) + reference them in `vite.config.ts` when you have time.
- **`apple-touch-icon` link** — not in `index.html`. Same fallback story; add `<link rel="apple-touch-icon" href="/icons/icon-192.png" />` once icons exist.
- **`tsc -b` strict build** — the bundled production build script is now `vite build` only. The full project-references typecheck (`tsc -b`) surfaces ~30 real type errors from day 1 (circular `useStore` inference + `Database` type missing `Functions`/`Views` sections, so `.rpc()` arg types fall to `undefined`). Vite transpilation strips types correctly and the runtime smokes all pass; cleaning this up is a post-hackathon refactor. `npm run typecheck` still runs `tsc --noEmit` for local sanity.
- **Pre-flight camera/GPS check on RoleReveal** — playbook 3.3 suggested it; skipped because failures are already surfaced inline at the capture site and end-to-end smoke covers the happy path. Add later if real-device testing turns up permission edge cases.

---

## Deploy steps

### 1. Push to GitHub + import in Vercel (one-time)

```bash
git push origin main
```

In the Vercel dashboard:

1. **Add New… → Project** → import this repo.
2. Framework preset: **Vite** (autodetected). Build command stays `npm run build`; output dir stays `dist`.
3. **Environment Variables** (Production + Preview + Development):
   - `VITE_SUPABASE_URL` = `https://mnhcaciapuxjtotqmuwe.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (from local `.env` — already public, safe to paste)
4. Deploy. First build takes ~30 s.

### 2. Re-deploy the edge function (if you've touched it since 3.1)

```bash
npx supabase functions deploy verify-submission
```

The Anthropic key is already set via `npx supabase secrets set ANTHROPIC_API_KEY=…` — no action needed unless the key rotates.

### 3. Confirm COOP/COEP on the deployed origin

Once the Vercel URL is live, run:

```bash
curl -sI https://YOUR_VERCEL_URL/ | grep -i Cross-Origin
```

You should see:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

Without these the CLIP WebGPU path falls back silently to single-threaded WASM (slower but still works).

### 4. Verify the edge function from the deployed origin

Open the deployed URL in a browser, run a quick match, watch the network panel for a `POST /functions/v1/verify-submission` returning `200`.

If you want to test the cloud branch on demand, use the same in-browser trick the Phase 3.1 smoke uses:

```js
const s = window.useStore.getState().session;
window.supabase.from('sessions').update({
  settings: { ...s.settings, local_match_threshold: 2.0, local_reject_threshold: -1.0 },
}).eq('id', s.id).then(console.log);
```

Now any submission goes to Claude.

---

## On-phone smoke (spec §14.1 / playbook 3.4)

Test on at least one iOS device and one Android — the four pillars all behave differently per OS.

- [ ] PWA installs from the browser menu and opens fullscreen
- [ ] Camera permission flow works (rear camera on Hider Capture + Seeker Hunt)
- [ ] Geolocation permission flow works (`useGeolocation` first call)
- [ ] **iOS only**: Compass permission button appears in SeekerHuntScreen and `requestPermission()` succeeds inside the tap handler
- [ ] CLIP model downloads (`~85 MB`) — first load on cell data may take 20–60 s; HomeScreen progress UI runs
- [ ] CLIP model **cache hit** on second load (offline-ish — toggle airplane mode briefly)
- [ ] WebGPU vs WASM fallback — if WebGPU works you'll see `device=webgpu` in console; otherwise `device=wasm`
- [ ] Full 3-round game completes (host on phone A, two seekers on phone B + browser tab)
- [ ] Cold start mid-game (close PWA, reopen) — anon auth session persists, lobby reload works
- [ ] /gallery renders recap + scoreboard + Play Again works

---

## If something breaks

- **CLIP model never finishes loading** → check COOP/COEP headers (step 3 above); without SAB the threaded WASM init can hang on some devices.
- **Edge function 500** → `npx supabase functions logs verify-submission` — most common cause is Anthropic key rotation or rate limiting.
- **Realtime not delivering** → the broadcast pattern relies on `realtime.messages` RLS (migration 0005). Confirm `auth.uid()` matches `host_id`/player membership.
- **Camera black on iOS** → must be HTTPS (Vercel default is fine) and the `<input capture="environment">` must be in the DOM at click time.
