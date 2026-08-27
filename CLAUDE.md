# Graveyard — notes for agents

A scrollable cemetery of dead projects. Static site, no build step, no dependencies.
Served over http, published to GitHub Pages from `main` at the repo root.

`README.md` is the landing page — what the project is and the shortest way in.
`docs/GUIDE.md` is the usage reference: every flag, the data file, the `?edit` token.
This file is only the things that are non-obvious and have already cost time.

## Running and verifying

```bash
python3 -m http.server 8000        # then open http://localhost:8000
node tools/bury.mjs --help         # burying a repo
node tools/autopsy.mjs --help      # burying an idea that was never built
```

**`file://` breaks every ES module silently.** No console error, just a half-rendered page
with no boil, no entrances and no sound. If the scene looks inert, check how it is served
before debugging anything else.

There is no test suite. Verification is browser-driven: load the page over CDP, assert the
element counts, and run the contrast audit that walks every text node against its surface.
That audit is the project's quality bar — every text element must clear 4.5:1 (3:1 for
large). **Disable the browser's cache when driving it**, or edited SVGs and CSS look like
no-ops and you will chase a bug that isn't there.

Two things the audit itself gets wrong unless it is written for them, both of which look
exactly like real failures:

- **Let the entrances finish before sampling.** Every panel child carries a `krk-enter-*`
  class and `krkStagger` spreads them over a wave, so a node caught part-way through is
  measured at a fraction of its opacity. Sampling 260ms after a click reported five
  failures at ratios like 1.09:1; at 1100ms the same yard is clean.
- **Resolve colours through a canvas, not a regex.** `.gy-marker__stone` is a `color-mix()`
  that computes to `oklab(…)`, and pulling numbers out of that string reads a chalk
  engraving as near-black — 1.21:1 for text that actually clears 8.5:1. Paint the value
  into a 1×1 canvas and read the pixel back. SVG text also takes its colour from `fill`,
  not `color`, and its `font-size` is in user units rather than rendered pixels.

There is a third guard that drops them just as quietly: **opacity is not invisibility.**
`.gy-engraving` is deliberately `0.82` — chalk cut into stone — so a visibility test that
skips anything under full opacity throws away all twenty-eight engraved years *and still
reports a pass*. Skip only what is at nothing (`< 0.05`), and fold the element's effective
opacity into the foreground alpha before compositing, because 0.82 chalk over the stone is
what the eye actually gets.

An audit that skips those does not fail loudly — it silently stops covering the engraved
years, because `offsetParent` is null for every SVG node and the obvious visibility guard
drops them all. Check the count: the yard alone is **63 text nodes, 28 of them engraved**.
With an autopsy open it is around 450, since a rendered report is by far the largest block
of text on the site. Measure that number rather than trusting it — it moves whenever chrome
is added (the two ground headers and the panel's close button moved it from 39), and a
stale count is worse than none, since the whole point of it is to catch a silent hole.

## Invariants

**Placement derives from a hash of the slug — except which side.** `js/plots.js` computes
column, tilt and undergrowth from `hash(slug)`, and `markerFor()` picks the stone from the
same hash. That hash lives in `js/hash.js` because two modules need to agree on it. Side is
the grave's *kind*: repos fill the left field, ideas the right, and the road between them is
the boundary rather than just a thing running down the middle. Nothing about layout is
stored in
`data/projects.json`, and nothing is random at runtime — so the yard is identical on every
reload. The consequence: **changing a project's `slug` moves its grave** within its ground,
and **changing its `kind` moves it across the road.** Its `name` is free to change.

**One packer lays out both yards.** `packBlocks(graves, sideAt)` takes a callback deciding
which side each block stands on, so the split (every block on one side) and the fallback for
a yard holding only one kind (blocks alternating down both fields) are the same algorithm
answering one question differently. That fallback is not decoration: a fork on its first day
has repos and no ideas, and would otherwise get a yard with one half empty. Do not grow a
second layout function for it — it would have to be kept in step with this one forever.

**Lanterns are spaced evenly, not placed between blocks.** They used to sit in the gaps
between consecutive blocks, which was a way of saying "not beside a grave" back when blocks
alternated and the road had plots against it only every other block. Now each field is a
kind, the road has graves along both sides for its whole length, and there are no gaps left
to find — following the old rule put *one* lantern in the entire yard. `LAMP_STEP` is the
rhythm now. Milestones still push a lamp aside rather than deleting it.

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

**A candle at a grave means somebody lit one — it is not selection.** `.gy-marker__candle`
used to sprout under `.is-selected` as decoration, which said nothing: clicking a grave
lights nothing. It now reveals under `.is-vigil` and stays after you click away. Selection
still reads on its own — it tints the marker and the name and throws the ground pool. Do
not "restore" the sprout-on-select; it is the thing this feature took over.

**A grave does not light its own stone, so a vigil warms it through `--gy-lit-floor`.**
`castLight()` skips a source for the grave it stands on — a light inside a grave would glow
at its own feet — so a grave holding a vigil would sit dark under a lit candle. The floor is
a static CSS declaration on `.is-vigil` and `.gy-marker__stone` takes `max()` of the two. It
is written once per change, never per frame, which is what keeps it clear of the
quantisation rule above.

**`js/vigil.js` is the only reader or writer of `gy_vigils`, and it never removes a slug.**
No counts, no un-lighting, no server, no network: there is no way to know whether anyone
else lit anything, and the page must never imply otherwise. It also must never throw —
Safari's private mode and a `file://` origin make every `localStorage` access a
`SecurityError`, and a graveyard that will not render because of a storage entry is worse
than one with no candles.

**Lighting a candle must never call `rebuild()`.** The scene subscribes to `vigil` and
redraws just the candles; `rebuild()` clears the frame, and an edit can be open in the panel
while it happens. That subscription is also why `mountScene` returns a `destroy()` and why
`rebuild()` calls it first — without that, every rebuild leaves the previous scene's
subscription and observers writing to detached nodes.

**`krk-boil` is not free per element.** The flame on a lit grave deliberately carries no
boil: it flickers already, and a filter that never stops, on however many graves hold a
vigil, is the one cost this scene has been measured to care about.

**The candle, the box and the match are stacked, and that is load-bearing.** Side by side
they were collinear: one leftward sweep scrubbed the match across the box AND carried it to
the wick, so it lit in a single motion and the five seconds never happened. Striking is now
horizontal and carrying is vertical, and one gesture cannot be mistaken for the other. Do
not lay them out in a row to save vertical space.

**The strike target is `.gy-matchbox__strip`, not the box drawing.** `matchbox.svg` is a
48-unit square with the box lying across its middle, so its element box is nearly twice the
height of anything drawn in it — hit-testing against that let a match catch in mid-air well
above the grit. The strip is an invisible element positioned over the drawn hatch, and it is
the only thing the strike test looks at.

**The ritual is timed by `setTimeout`, not by the animations that draw it.** `animationend`
and the `finished` promise both need the page to be producing frames, and a page that has
stopped painting still runs script: a run started from the keyboard reached the end of its
travel with neither ever arriving, and the match sat burning in mid-air forever. The three
durations live once, as `--gy-burn` / `--gy-spend` / `--gy-run` on `.gy-matchbox`, and both
the stylesheet and the script read them, so the picture and the clock cannot drift. Every
beat is guarded on `root.isConnected`, because the panel throws its contents away on every
`show()` and a beat outlives what it was counting for.

**A `prefers-reduced-motion` block must repeat the selectors that set the animation.** A
media query adds no specificity, so `.gy-marker__flame` alone loses to
`.is-vigil .gy-marker__flame` and the flame keeps flickering. Only the endless animations
stop there — the match's burn-down is a one-shot whose `animationend` *is* the timer, and
stilling it would leave a match burning forever.

**Every motif must be listed in `index.html`'s `MOTIFS`.** `doodle()` throws for anything
not preloaded, and an unhandled throw inside `mountScene` leaves a half-built scene with no
obvious cause.

**`rebuild()` must destroy the candle before re-mounting it.** `mountScene` wipes the frame,
which detaches the candle's element but leaves its `pointermove` and `pointerleave`
listeners bound to the frame that survives. Without the `destroy()`, every rebuild stacks
another handler writing transforms into a node that is no longer in the document — editing
graves is the only path that rebuilds, but nothing bounds how often that happens.

**Every layout read in `castLight()` happens before the first style write.** The halo's
`left`/`top` used to be written between the `clientWidth` read and the `getBoundingClientRect`
below it, so each frame the pointer moved flushed those writes and laid out the whole field
again mid-pass. Hoisting the reads took forced layouts during a hover from ~37 a second to
13. Anything added there reads first and writes second.

**`pointer` is stored in viewport coordinates on purpose, and scrolling must recast.** The
field position of a stationary pointer changes as the yard scrolls under it, so the
conversion happens at use time. Scrolling therefore costs what hovering costs — that is
correct, not a bug to optimise away by clearing `pointer` on scroll, which would detach the
carried candle's glow from the cursor.

**`mountScene` clears its root, and that is the rebuild mechanism.** To redraw after the
data changes — a new marker, a different death date, an exhumed grave — call it again with
fresh plots rather than patching the DOM. Two consequences: anything else living in the same
frame is wiped, so **`mountCandle` has to be re-mounted after every rebuild** (see
`rebuild()` in `index.html`); and `rebuild()` deliberately does not touch the epitaph panel,
because an edit redraws the yard while its form is still open in that panel.

**Adding a marker variant touches four places**, and there is no single list to add it to:

1. `doodles/<name>.svg` — drawn to the 48×48 stroke-only contract.
2. `ENGRAVING` in `js/marker.js` — where its dates are carved.
3. `VARIANTS_BY_KIND` in `js/marker.js` — which kind of grave may stand under it. A variant
   in `ENGRAVING` but in neither pool is drawable and unreachable, which is a silent no-op.
4. `MOTIFS` in `index.html`, or `doodle()` throws.

`tools/graveyard.mjs` keeps its own copy of the pools, and has to: it runs in Node, and
importing `js/marker.js` would drag in `js/doodles.js`, which needs `fetch` and `document`.
That duplicate is a deliberate consequence of the browser/Node boundary, not an oversight —
but it is **one** copy, shared by both tools. Do not give a tool its own.

**A grave's kind decides which markers it may stand under, and the pools do not overlap.**
`markerVariantsFor(kind)` in `js/marker.js` is the only answer to that question. A project
cannot take a cairn and an idea cannot take a headstone, and that constraint is the feature,
not an oversight to relax.

**`markerFor(project)` is the only place that answers which stone one grave gets.** It
validates `project.marker` against its kind's pool and falls back to `hash(slug)` when it
names one from the other pool — the same thing a typo does. The yard draws that stone and so
does the epitaph panel's badge, and they used to work it out separately: `plots.js` hashed,
while the panel took `project.marker || variants[0]`. Every grave in the yard carried an
explicit marker, so the two agreed by accident — until `bury.mjs`, which never writes one,
put sixteen hash-picked stones in the ground under a panel that showed `headstone-round` for
all of them. One resolver, two callers, and nothing to keep in step.

**`kind` absent means `"project"`.** Every grave buried from a repo omits it, and
`tools/bury.mjs` must keep omitting it — writing `"kind": "project"` onto nineteen existing
entries would be churn for nothing. Read it as `project.kind ?? 'project'`.

**An idea has no `born` and no `repo`, and that is load-bearing, not missing data.** It was
never born, and there is no code. `engravedYears()` already carves one year when there is no
birth, which is why an idea's marker needs no special case — but do not "repair" an idea by
giving it a birthday from the date of its analysis. The one date it has is the day it was
filtered, and the panel labels it as such.

**An autopsy is read in the page, and it has to be.** `.nojekyll` makes Pages serve
`autopsies/<slug>.md` as `text/markdown` with **no charset**, so a browser decodes it as
single-byte and every Russian report opens as `ÐŸÐ¾Ð´Ð±Ð¾Ñ€`. There is no server here to set
a header on. `fetch` + `Response.text()` always decodes UTF-8 regardless of the header, which
is what makes `js/autopsy.js` the fix rather than a nicety — do not "simplify" it back to a
link to the file, on github.com or anywhere else.

**`js/markdown.js` builds nodes and never assembles HTML.** Not a style preference: a report
is a file in the repo, a fork can carry any file, and `autopsies/indie-platform-bez-18plus.md`
already ends with a stray `</content>` from whatever produced it. Building DOM means markup
in a report can only be read as characters, so there is no injection question to get wrong
later. Anything added there — a new block type, a new inline rule — keeps that property.

**Blockquote lines keep their own lines, which CommonMark does not do.** It folds them into
one paragraph, and so does GitHub. Every report opens with a quoted band of one fact per
line and none of them uses the two-trailing-spaces hard break, so folding gives
`…🟡 2 Дата разбора: 2026-08-03`. Prose paragraphs are still folded — they are written one
line per paragraph, so a break inside one really is a wrap.

**The reader mounts on `<body>`.** `rebuild()` clears the scene and every `show()` throws the
panel away; an open report must survive both. The panel therefore does not own it — the
autopsy button dispatches `gy:autopsy` and `index.html` opens the reader, the same shape as
the matchbox's `gy:strike` / `gy:lit`.

**The panel's way out is narrow-only, and dismissal is the empty state.** Below 900px the
two panes become one and the epitaph is a fixed sheet over the foot of the yard. Closing is
`showEmpty()` plus dropping the selection — `.gy-epitaph.is-empty` is `display: none` in
that media query, so there is no third state to hold. The same rule is what keeps the yard
whole before anything is picked: the sleeping-cat empty state is a wide-screen affordance,
and on a phone it was 62vh of nothing sitting on the graveyard with no way out from under
it. On desktop the close button is hidden, because there the panel covers nothing.

**There is deliberately no backdrop behind that sheet.** It covers 62vh and the yard above
stays visible, so a scrim would block the one gesture worth having — picking a different
grave. Close, or Escape.

**The panel's close button is built once, outside `render()`.** `render()` throws the page
away and rebuilds it on every `show()`; a dismissal built with the page would be rebound
fifteen times a session. It is appended to the root and `render()` replaces only its own
`.gy-epitaph__page`.

**That Escape handler is on the bubble phase, and it matters.** `js/autopsy.js` takes Escape
on *capture* and stops it there, so with a report open the report closes and the grave
underneath it survives. Move the panel's listener to capture and one Escape closes both.

**An idea's door out is a `<button>`, so it has to give up every button default.** It opens
the report here rather than navigating, but it must read as the same affordance as the repo
link beside it. Shipped once without the reset and the contrast audit caught it at 1.53:1.

**`repoFromLocation()` must never throw.** It reads `localStorage`, and any caller outside
`?edit` runs for every visitor — so Safari's private mode or a `file://` origin would take
down whatever called it. Same lesson as `js/vigil.js`, one module further out.

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

Two deliberate departures from the kit, both documented in `docs/GUIDE.md` so they don't
get "fixed" back:

- **The dark ground** — the kit's paper is cream. This is the kit's unsettled *Dark mode*
  item, living here as a local override.
- **Gradients, for depicting light only** — the kit forbids them outright. Every glow is a
  CSS radial falloff. Stroked-SVG light read as smudges and sparkles. The no-gradient rule
  still holds for every surface, card and divider.

## Editing graves

`data/projects.json` is the source of truth and is safe to hand-edit. Candles are not in it
and never will be — see the vigil invariant above.

- `tools/bury.mjs` adds a grave from a GitHub repo. It asks `gh` who you are rather than
  assuming an owner, which is what lets a fork work for its new owner unedited.
- `tools/autopsy.mjs` adds a grave from an idea's analysis. It is a separate tool rather than
  a mode on `bury.mjs` because `bury.mjs` is `gh` calls from top to bottom and shares none of
  them; what the two do share lives in `tools/graveyard.mjs`.
- **Neither tool writes the epitaph or the cause**, and neither should learn to. `autopsy`
  prints the report's own kill material instead, so they can be written without opening it.
  A generated epitaph reads exactly like a generated epitaph.
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
