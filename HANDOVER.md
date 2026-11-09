# Handover: jehanzeb.xyz portfolio

Last updated 2026-11-04. Branch `3d-experiment`.

## The repo at a glance

A static site with no build step and no package.json. It deploys on Vercel (`vercel.json`: clean URLs, plus 1-day caching on `/media` and `/fonts`).

```
index.html, style.css, tokens.css, base.css   classic site (the live one on main)
favicon.svg, fonts/, media/, cv/              shared assets, used by both versions
3d/                                           the 3D experiment (this branch only)
  index.html     page shell: HUD, chapter cards, loader
  style.css      3D page styles (same darkroom + amber palette as the classic site)
  main.js        the whole scene (~620 lines, plain ES modules)
  vendor/        Three.js r170 + bloom postprocessing, copied from npm, no CDN
  CONCEPTS.md    what was built, plus 7 other 3D directions to try
```

## Branches

| Branch | State |
|---|---|
| `main` | The live classic site. Untouched by the 3D work. |
| `3d-experiment` | `main` plus the `3d/` folder and this file. Not merged, no PR opened. |

Merging is safe: the branch only adds files, and the 3D page lives at `/3d/`. Nothing links to `/3d/` from the classic site yet. Adding a link to the banner or footer in `index.html` is the one-line step if you want people to find it.

## Running it

```
python3 -m http.server 8000      # from the repo root
# classic: http://localhost:8000/     3D: http://localhost:8000/3d/
```

Serve the folder; don't open the file directly (ES modules and the import map need http). The 3D page uses `../media`, `../fonts` and `../cv`, so it must be served from the repo root.

## How the 3D page works (`3d/main.js`)

| Lines (approx.) | Part |
|---|---|
| 16-63 | Palette, renderer, lights, bloom composer, loading screen (hides on load or after 6 s) |
| 65-175 | Helpers: `jitter` (low-poly rock look), `label` (canvas-text sprites), `makeBoing` (makes a group clickable), `island`, `tree`, `screen` (poster that swaps to video), `float` |
| 176-427 | The six islands, one `{ }` block each, numbered 1-6. Each sets its centre `c` and pushes it to `STOPS`. |
| 428-460 | Ambient: paper planes, dust, the sun glow |
| 461-495 | Camera path. `buildPath()` builds two CatmullRom curves, for camera position and look target, through intro → 6 islands → outro. They have different offsets for wide and tall screens. `plateau()` makes the camera rest at each stop. |
| 497-525 | Active chapter (an IntersectionObserver drives the card highlight and the dots). `syncVideos()` plays only the screen nearest the camera. |
| 527-566 | Pointer: parallax, hover cursor, click → squash spring + sparks. Screens and game cards (`opens = true`) open their URL. A tap guard ignores drags. |
| 568-end | Resize and the frame loop. The fog widens for the intro/outro overviews. |

**The DOM drives the scroll.** There are 8 `<section class="ch">` blocks in `3d/index.html`, each 100vh tall. Chapter *i* lines up with camera stop *i*.

### Common edits

- **Add or reorder an island.** Add a `<section class="ch">` in `index.html` in the right order, and add a block in `main.js` that pushes its centre to `STOPS` in the same order. The section count must equal `STOPS.length + 2` (intro + outro).
- **Change framing.** Edit the offsets in `buildPath()`. The `tall` branch is for phones.
- **Swap a video.** It's the `screen(w, h, poster, video, url)` call inside that island's block.
- **Colours.** The `C` object at the top of `main.js`, and `:root` in `3d/style.css`.
- **Bloom strength.** `new UnrealBloomPass(..., 0.55, 0.5, 0.82)`: strength, radius, threshold.
- **Upgrade Three.js.** Run `npm pack three@<ver>` and copy `build/three.module.min.js` plus the same `examples/jsm/postprocessing` and `shaders` files into `3d/vendor/`, keeping the folder layout (the bloom files import `../shaders/`).

### Behaviour to keep

- Under `prefers-reduced-motion`, nothing animates, videos don't autoplay, and the camera jumps rather than glides.
- With no WebGL, the page adds `.no-webgl`, hides the canvas and shows the cards as a plain page.
- All real links (CVs, email, project sites) are in the HTML cards. 3D clicks are a bonus, never the only route.

## Tested

- Headless Chromium (software WebGL) at 1440×900: all 8 chapters screenshotted. At 390×844: chapters 0, 3 and 5. No console errors.
- Not tested on real devices: iOS Safari, Android, or a low-end GPU. Check those first, especially video textures on iOS and scroll smoothness.

## Valar content (added 2026-11-06)

- Media: `media/valar.mp4` (30 s walkthrough, re-encoded to 720p with no audio, 1.2 MB) and stills `valar.jpg` (poster), `valar-risk.jpg` and `valar-audit.jpg`, taken from that video.
- Classic site, `#valar` section: the video, three points (one base URL, reversible redaction, deterministic policies), two stills, the policy console (observe / alert / redact / block, using the real `[REDACTED:type:n]` placeholder format), and a facts sheet. The console text lives in the `states` object in the inline script at the bottom of `index.html`.
- 3D site: the Valar island now has the video on a screen, and its card has the key numbers.
- Source copy for Valar (CV bullets, one-liner, tech line) came from Jehanzeb. If the numbers change (94% recall, 96% precision, +7 ms p95, 20+ detectors, 216 tests), update both `index.html` and `3d/index.html`.

## AI site (ai.jehanzeb.xyz), added 2026-11-09

- Lives in `ai/` (`index.html`, `style.css`, `tokens.css`, `base.css`). It is fully separate from the classic and 3D sites, built with the Hallmark design skill (theme Lumen, shape Stat-Led). The stamp at the top of `ai/style.css` records every design decision and waiver.
- Served at `jehanzeb.xyz/ai/`. On `ai.jehanzeb.xyz`, `middleware.js` (Vercel Routing Middleware) rewrites every path except `/ai/`, `/media`, `/fonts`, `/cv` and the favicon to `/ai/…`. A `vercel.json` rewrite cannot do this, because Vercel serves the root `index.html` and `style.css` before applying rewrites. Any other host passes through untouched. **Setup needed once:** in Vercel → the project → Settings → Domains, add `ai.jehanzeb.xyz` (Vercel shows the DNS record to add, usually a CNAME to `cname.vercel-dns.com`).
- Content is from the Applied AI CV v5 (`cv/Jehanzeb-Ali-CV-Applied-AI.pdf`, the file the AI site's download buttons serve). The classic site still links the older `cv/Jehanzeb-Ali-CV-AI.pdf`.
- Hero: the English / Roman Urdu switch (Prompt Guard 2: 194/400 vs 46/399). The numbers live in the `rates` object in the inline script and in the markup.
- ⌘K / Ctrl+K opens a command palette (the `<dialog data-palette>` list). Add a link by adding an `<li>`.
- Video: `media/valar-product.mp4` is the walkthrough cropped to the product screen and trimmed to 21 s.
- The two sample attack sentences in "one attack, two scripts" were written for the page and labelled as samples. Swap in a real pair from the eval set if you prefer.

## Known rough edges and next steps

- The Sudoku board and the small labels under the sprites ("physics", "PSX") are hard to read from the camera distance.
- The intro view shows the islands quite small. A closer first stop might land better.
- No analytics and no OG image for `/3d/` yet. It reuses the favicon only.
- `media/` videos are full-size MP4s shared with the classic site. Smaller, lower-bitrate copies would help mobile load times.
- Ideas for further 3D directions are in `3d/CONCEPTS.md`.

## Contact

Owner: Jehanzeb Ali, jehanzebali111@gmail.com
