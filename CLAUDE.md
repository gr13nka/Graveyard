# Graveyard — notes for agents

A scrollable cemetery of dead projects. Static site, no build step, no dependencies.
Served over http, published to GitHub Pages from `main` at the repo root.

`README.md` explains what the project is and how to use it. This file is only the things
that are non-obvious and have already cost time.

## Running and verifying

```bash
python3 -m http.server 8000        # then open http://localhost:8000
node tools/bury.mjs --help         # the burial command
```

**`file://` breaks every ES module silently.** No console error, just a half-rendered page
with no boil, no entrances and no sound. If the scene looks inert, check how it is served
before debugging anything else.

There is no test suite. Verification is browser-driven: load the page over CDP, assert the
element counts, and run the contrast audit that walks every text node against its surface.
That audit is the project's quality bar — every text element must clear 4.5:1 (3:1 for
large). **Disable the browser's cache when driving it**, or edited SVGs and CSS look like
no-ops and you will chase a bug that isn't there.

## Invariants

**Placement derives from a hash of the slug.** `js/plots.js` computes side, column, marker
variant, tilt and undergrowth from `hash(slug)`. Nothing about layout is stored in
`data/projects.json`, and nothing is random at runtime — so the yard is identical on every
reload. The consequence: **changing a project's `slug` moves its grave.** Its `name` is free
to change.

**Only `.gy-marker__stone` may be tinted, never the name label.** Lighting mixes the stone's
colour toward the lamp colour. Tinting the label too would put text contrast at the mercy of
where the pointer happens to be, and the audit would start failing intermittently.

**`--gy-lit` is quantised to ten steps and written only when it changes.** It feeds a
`color-mix` on the stone, and the stone carries the boil filter, so every distinct value
forces that filter to re-rasterise. Continuous values measured ~40ms/frame against ~17ms
idle. Do not "simplify" this back to a raw float.

**`--gy-shade` is separate from `--gy-lit`.** `--gy-lit` is total brightness from any light;
`--gy-shade` is brightness from the sources that cast shadows. That separation is what lets
the carried candle warm a stone without swinging its shadow around.

**`.krk-enter-sprout` animates `transform`.** Putting it on an element that uses `transform`
for its own placement erases that placement — graves animated off their own plots this way.
Put it on a child, or position with the individual `translate` / `rotate` properties, which
compose with `transform` rather than replacing it.

**Every motif must be listed in `index.html`'s `MOTIFS`.** `doodle()` throws for anything
not preloaded, and an unhandled throw inside `mountScene` leaves a half-built scene with no
obvious cause.

**`mountScene` clears its root, and that is the rebuild mechanism.** To redraw after the
data changes — a new marker, a different death date, an exhumed grave — call it again with
fresh plots rather than patching the DOM. Two consequences: anything else living in the same
frame is wiped, so **`mountCandle` has to be re-mounted after every rebuild** (see
`rebuild()` in `index.html`); and `rebuild()` deliberately does not touch the epitaph panel,
because an edit redraws the yard while its form is still open in that panel.

**Adding a marker variant touches three places**, and there is no single list to add it to:

1. `doodles/<name>.svg` — drawn to the 48×48 stroke-only contract.
2. `ENGRAVING` in `js/marker.js` — where its dates are carved. `MARKER_VARIANTS` derives
   from these keys, so the scene and the editor's dropdown both follow automatically.
3. `MOTIFS` in `index.html`, or `doodle()` throws.

`tools/bury.mjs` keeps its own copy of the list, and has to: it runs in Node, and importing
`js/marker.js` would drag in `js/doodles.js`, which needs `fetch` and `document`. That
duplicate is a deliberate consequence of the browser/Node boundary, not an oversight.

**Engraved dates must fit the carved face.** `ENGRAVING` tunes size and position per marker
because a headstone has a broad face and an obelisk does not; narrow markers carry one line
(the death year) rather than two. When adding or reshaping a marker, measure the text's
bounding box against the path's — eyeballing a screenshot misses overflow of a few pixels.

## Colour

`<html data-palette="…">` in `index.html` picks the palette; `css/palettes.css` defines four
(`a` warm dusk, `b` cool indigo, `c` canon cream, `d` dark scene on cream chrome). The site
runs **`b`**. They exist because the palette was chosen by eye from mockups, and they are
kept so the choice can be revisited without rebuilding anything — changing that one attribute
re-skins the entire site.

Each palette also defines the scene's own tones on top of the kit's: `--gy-near` / `--gy-mid`
/ `--gy-far` for atmospheric depth, `--gy-lamp` for light, and `--gy-cast` for shadows.
`--gy-cast` must sit **below** the ground tone in luminance — it was once `--gy-far`, a
distance tone, and shadows visibly lightened whatever they fell on.

## The Karakuli kit

`vendor/karakuli/` is copied verbatim from `~/Documents/karakuli` and **is never edited
here**. Override in `css/graveyard.css` instead. Two traps:

- Its hand-drawn assets (`.krk-divider`, `.krk-arrow-inline`) bake `#26241F` into data-URI
  SVG markup, so they render dark-on-dark and vanish on this site's dark ground. The fix
  already in place re-cuts them as CSS masks driven by `currentColor`.
- CSS load order is load-bearing: `tokens.css` before `karakuli.css`.

Two deliberate departures from the kit, both documented in `README.md` so they don't get
"fixed" back:

- **The dark ground** — the kit's paper is cream. This is the kit's unsettled *Dark mode*
  item, living here as a local override.
- **Gradients, for depicting light only** — the kit forbids them outright. Every glow is a
  CSS radial falloff. Stroked-SVG light read as smudges and sparkles. The no-gradient rule
  still holds for every surface, card and divider.

## Editing graves

`data/projects.json` is the source of truth and is safe to hand-edit.

- `tools/bury.mjs` adds a grave from a GitHub repo. It asks `gh` who you are rather than
  assuming an owner, which is what lets a fork work for its new owner unedited.
- `js/editor.js` is the in-page editor at `?edit`. It commits `data/projects.json` through
  the GitHub Contents API straight from the browser — there is no server, and adding one
  would be a step backwards.

**Why the editor asks for a token, and why you can't design it away.** This gets questioned
every time. A commit needs a credential, and neither way of getting one without the user
pasting it can work here: OAuth's web flow needs a `client_secret` a static page cannot
hold, and OAuth's device flow — built for exactly this case — is served from GitHub
endpoints that send **no CORS headers**, so a browser cannot call them at all. The page also
cannot borrow the visitor's github.com session; that is cross-origin by design. Every
workaround is a proxy, which is a server. The floor is one authorisation, once.

**Save must always say Save.** It shipped once as a button that renamed itself to
"download" whenever it couldn't commit, with the connect step hidden in a collapsed
`<details>` — so the first thing anyone saw was a download button and no way to save. Do not
reintroduce a fallback that takes over the primary action. A failed save keeps the user's
text in the form and says what went wrong; that is what protects their work.

**`btoa` alone corrupts non-ASCII.** Epitaphs contain em dashes and Cyrillic. Anything
encoding content for the GitHub API must go through `TextEncoder` first, and anything
decoding must come back through `TextDecoder`.

**Writes are compare-and-swap.** The Contents API `PUT` carries the `sha` the file had when
it was read. Never write without it — a stale tab would silently revert the whole graveyard.
