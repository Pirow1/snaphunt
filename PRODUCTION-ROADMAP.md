# Production Hardening Roadmap

> Path from "complete hackathon build" to a premium, production-worthy two-game
> app (SnapHunt + Rush B under the Potch hub). Sequenced by dependency and risk.
> **Status: proposed — awaiting approval. No work started.**

Legend: **[me]** I can do it · **[you]** needs your decision/device · **[dep]** needs a new-dependency approval (CLAUDE.md rule)

Effort is rough dev-days assuming I implement and you test/decide.

> **Execution status (updated as work lands):**
> - **M0 decisions taken** (defaults, all reversible): brand = "Potch Treasure Hunt" umbrella with SnapHunt/Rush B as modes; design = shared shell + per-game palettes; email/phone = keep but lock down.
> - **M1 in progress.** ✅ user_profiles PII leak closed (migration `0021`: table locked, owner-scoped SECURITY DEFINER RPCs, lookup leaks no contact, photo writes scoped to owner folder). Verified against prod. ⏳ Remaining: tighten `WITH CHECK (true)` session INSERT policies; cost/abuse guard on `verify-submission`; document anon sign-in posture.
> - ⚠️ **Deploy coupling:** `0021` locks the table, so the OLD deployed frontend's direct-table profile calls break until the new RPC-based frontend deploys. Push `main` to redeploy.

---

## M0 — Decisions & foundation (0.5 day)

These unblock later milestones, so settle them first.

- **[you] Brand name.** "Potch Treasure Hunt" (hub) vs "SnapHunt" (manifest/repo) vs per-game names. Pick the public name; everything downstream (title, manifest, theme, icons, copy) follows.
- **[you] Design direction.** One unifying language, or a deliberate *hub → game* hierarchy where each game keeps its identity under a shared shell? Drives M3.
- **[you] Data policy.** Do we actually need email/phone (returning-player lookup), or drop them for privacy/simplicity? Drives M1 scope.
- **[me] Push the pending commit** so GitHub matches prod (`origin/main` is 1 behind).
- **Deliverable:** decisions recorded here; clean git state.

---

## M1 — Security & privacy hardening (1 day) 🔴 highest risk

The one true production blocker. All verifiable against prod via the (now correctly pointed) Supabase MCP.

- **[me] `user_profiles` RLS.** Replace `USING (true)` with per-user policies: read/update only your own row (tie to `auth.uid()` via a join table or an `owner_uid` column). Today any anon key holder can read/overwrite **everyone's name, email, phone**.
- **[me] `profile-photos` bucket.** Make private; scope read/write to the owner; serve via signed URLs (mirrors SnapHunt's existing `round-photos` pattern).
- **[me/you] Data minimization.** If M0 says drop email/phone, remove the columns + lookup; else add explicit consent copy + keep them locked down.
- **[me] Tighten `WITH CHECK (true)` INSERT policies** on `sessions` / `rb_sessions` / `rb_*` — constrain to the authenticated caller.
- **[me/you] Anonymous sign-in posture.** Keep (frictionless) but confirm it's intentional and rate-limited; document the decision.
- **[me] Abuse/cost guard on `verify-submission`.** Per-user/session rate limit + daily cap so the Claude path isn't an open spend tap.
- **[me] Verify:** `get_advisors(security)` returns clean for new objects; anon REST probes confirm a non-owner can't read others' PII.
- **Deliverable:** migration(s) applied to prod + verified; advisor delta documented.

---

## M2 — Playable & installable (0.5–1 day) 🟡 fastest premium first impression

Table-stakes so the app *feels* like a real product on a phone.

- **[me] PWA icons.** Generate `192`, `512`, and maskable icons → `public/icons/`; wire into manifest + `apple-touch-icon` + favicon.
- **[me] Theme color.** Fix `index.html` `theme-color` (currently white) and manifest (currently cream) to the **dark forest** the app actually uses; align to chosen brand.
- **[me] Manifest name/short_name** aligned to the M0 brand decision.
- **[me] First-load UX.** Confident branded loading state for the ~85 MB CLIP download on mobile data (extend existing progress UI).
- **[you] On-phone smoke (both games, iOS + Android).** Run the DEPLOY.md §14.1 checklist — camera, GPS, compass permission, model download + cache hit, WebGPU↔WASM, full round, cold-start resume. I'll prep a tightened checklist; you run it on devices.
- **Deliverable:** installs cleanly with proper icon + status bar; both games verified on real hardware.

---

## M3 — Design cohesion & branding (1–2 days) 🟡 the "premium" core

Today there are three visual languages: Potch (maroon + Cormorant/Fraunces serif, inline styles), SnapHunt (forest + Bricolage), Rush B (void/threat-red). A premium app reads as one product.

- **[you] Sign off** on the cohesion direction from M0 (I'll mock 1–2 options first).
- **[me] Tokenize.** Move the dashboard's hardcoded `#800020` maroon + serif fonts into `globals.css` CSS vars + `tailwind.config.ts`; remove inline `style` props (CLAUDE.md violation).
- **[me] Shared shell.** Consistent buttons, toasts, headers, back-nav, transitions across hub + both games.
- **[me] Reconcile the two games' palettes** under the chosen hierarchy so switching between them feels intentional, not jarring.
- **Deliverable:** one coherent design system; dashboard on-system; before/after screenshots.

---

## M4 — Code health & maintainability (1–2 days) 🟢

- **[me] De-duplicate Rush B's 5 forked lib modules** (`compass`, `geolocation`, `vision`, `embeddings`, `audio`) back to shared `src/lib`. Care: `audio`/`vision` diverged — extract a shared core + game-specific layers. (Until done, every lib fix must be applied twice — argues for doing this before M3 polish if we touch those.)
- **[me] Fix the ~30 `tsc -b` errors** (circular `useStore` inference + `Database` type missing `Functions`/`Views`) and restore strict typecheck in the build/CI gate.
- **[me] Minor UX cleanups:** Rush B `alert()` → toast; remove dead `onExpired` callback; replace 400 ms submission polling with realtime; add photo-upload retry; delete unused `_Placeholder.tsx`.
- **Deliverable:** single source for shared logic; green strict build; cleanup PR.

---

## M5 — Production operations & observability (1 day) 🟢

The "is it actually production?" layer that hackathons skip.

- **[dep] Error tracking** (e.g. Sentry) for frontend + edge function — needs your OK on the dependency.
- **[me] CI gate.** GitHub Action: typecheck + build (+ smoke) on PRs; Vercel preview deploys per branch.
- **[me/you] Supabase ops.** Confirm backups, storage quotas, realtime/connection limits, anon rate limits; keep advisors clean.
- **[me] Edge function monitoring.** Logging + Anthropic cost/latency visibility; alert on 5xx spikes.
- **[me] Screen-by-screen loading/error-state audit** (offline, permission-denied, slow network) across both games.
- **[dep?] Analytics** (optional) — privacy-respecting, if you want funnel data.
- **Deliverable:** observable, gated, recoverable in production.

---

## Suggested order & total

`M0 → M1 → M2 → M3 → M4 → M5` (M4 dedup may jump ahead of M3 if M3 touches forked libs).

**~5–8 dev-days** of my work + your decisions (M0), device testing (M2), and dependency approvals (M5). M1+M2 alone (~1.5–2 days) get you to "safe to share and good to play."

## Definition of "production-worthy" (exit checklist)

- [ ] No PII or storage readable/writable by non-owners (advisors clean)
- [ ] Cloud-verify path rate-limited and cost-bounded
- [ ] Installs as a PWA with correct icon, name, dark theme on iOS + Android
- [ ] Both games pass a full on-phone round
- [ ] One coherent visual identity across hub + both games
- [ ] Strict typecheck + build green in CI on every PR
- [ ] Errors tracked; edge-function failures observable
- [ ] Graceful loading/error/offline states on every screen
