# Home Energy Roadmap 

A standalone, client-side tool: enter your home's characteristics, geography, current
systems, and needs, and it builds a prioritized, budget-phased plan of which energy
systems to install — solar, geothermal, heat pumps, battery backup, an EV charger, and
more. No backend, no build step — just static files, ready for GitHub Pages.

## Run it locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. (Opening `index.html` directly via `file://` will
mostly work but the ZIP-code auto-lookup may be blocked by the browser's CORS handling
of local files — serve it over http to test that feature.)

## Deploy to GitHub Pages

1. Push this folder to a repo (or a `docs/` folder, or a `gh-pages` branch).
2. In the repo's **Settings → Pages**, point Pages at that folder/branch.
3. Done — no build step required.

## How it works

- **`data.js`** — the solutions catalog. Each system has a cost range, payback range,
  rough CO₂ impact, a prerequisite check (e.g. geothermal needs a well or land), a
  scoring function (how well it fits *this* home), and a cited source for the cost data.
- **`app.js`** — reads the form, auto-fills geography from a ZIP code using two
  no-API-key-required services (Zippopotam.us for geocoding, Open-Meteo for a year of
  solar/wind/temperature history), scores every solution against your inputs, and
  packs the best-fitting ones into budget phases (highest-fit first, like a funding
  waterfall — fill phase 1, then phase 2, etc.).
- **`index.html` / `styles.css`** — the UI. Design tokens (moss green, slate blue, burnt
  amber; Fraunces for display type, Inter for body, JetBrains Mono for data) built to
  sit alongside your portfolio's look without literally reusing its CSS.

## Known gaps to close next

- **The ZIP lookup could not be tested from the sandbox this was built in** (its network
  allowlist doesn't include Zippopotam or Open-Meteo). Test it live once deployed —
  if it silently fails, open the browser console; the classification thresholds
  (what counts as "high" sun or "cold" climate) are rough and worth tuning against a
  few known ZIP codes you trust.
- **Cost data confidence is mixed.** Items marked "approx." in the UI are ballpark
  figures, not freshly verified against a citation — solar PV, geothermal, air-source
  heat pumps, battery storage, and EV chargers are backed by cited 2026 market data;
  solar thermal, heat pump water heaters, wood/pellet stoves, and small wind are
  reasonable published estimates that deserve a closer look before you trust them for
  real budgeting.
- **No graphics yet** — this is built to take the visuals you create or upload
  (a home diagram, icons per system, etc.); right now the "signature element" is the
  connected roadmap spine in CSS, not an illustration.
- **Scoring weights are a first pass.** The point values in each solution's
  `scoreFactors()` function are my best judgment, not a formal model — worth
  sanity-checking against a few real scenarios (e.g. an old farmhouse with a well and
  land vs. a new-build suburban home with a small roof) and adjusting.

## Design system

Restyled to match the live source of jessiemlacey.com/ux-design (pulled from the
`msjessiemeghan/ux-design` repo on GitHub, not guessed): Alfa Slab One for display
type, Bebas Neue for eyebrow/label text, Work Sans (300) for body, lime green
`#8EC63F` / `#5C8A2A` accent, sharp 0px corners, dashed header rule, hairline section
dividers, black pill badges. No dark mode — the source site doesn't have one, so
this doesn't either.

## Placeholder graphics

- **Icons**: one simple stroke SVG per system, inlined in `app.js` under the `ICONS`
  object (search for `const ICONS = {`). Each is keyed by the solution's `id` from
  `data.js` (e.g. `'solar-pv'`, `'battery-storage'`) — swap the SVG string for that
  key to replace an icon, no other code changes needed.
- **Hero graphic**: a placeholder house/sun/battery line illustration, inlined
  directly in `index.html` inside `<svg class="hero-graphic">`. Replace that whole
  `<svg>...</svg>` block with an `<img>` tag or your own SVG once you have real art.
