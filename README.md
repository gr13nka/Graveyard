# Graveyard

A scrollable cemetery of dead projects. Graves stand in plots either side of a
path, each engraved with the years the project lived; clicking one lights the
ground around it and opens its epitaph on the right.

<!-- ![the graveyard](shots/README.png) -->

## Running it

```bash
python3 -m http.server 8000
open http://localhost:8000
```

There is no build step and nothing to install. **It must be served over http —
opening `index.html` as a `file://` URL silently breaks every ES module**, so
the boil, the entrance animations and the sound layer just never run and the
page looks half-finished with no error to explain why.

## Burying a project

```bash
node tools/bury.mjs <repo> [options]
```

`<repo>` accepts `owner/name`, a bare `name` (your own account is assumed), or
a full GitHub URL. It reads through the `gh` CLI you are already signed in to,
so **private repos work and there are no tokens to manage**.

```bash
node tools/bury.mjs TwinStickDraft \
  --epitaph "Two sticks. Five weeks. One room." \
  --cause "got interested in something else on a Thursday"
```

Then reload the page. That is the whole loop.

### Where the description comes from

By default, **the repo's own README** — its first real paragraph. The tool skips
the title, badge rows, tagline blockquotes, lists, tables and code fences, and
takes the first block that is actually prose, converts its markdown to plain
text and trims it to about 400 characters on a sentence boundary. That is
almost always the sentence you already wrote explaining the thing.

The order it tries:

1. `--desc "..."` if you passed one
2. the README's first prose paragraph
3. the repo's GitHub description
4. nothing — the panel simply omits the paragraph

Pass `--no-readme` to skip straight to the GitHub description. Check what it
found before committing to it:

```bash
node tools/bury.mjs pipipi --dry-run
```

### What it will not write for you

**The epitaph and the cause of death.** They are the only part of this site
worth reading, and a generated one reads exactly like a generated one. The tool
tells you when they are missing and prints the command to add them.

### Options

| Option | What it does |
| --- | --- |
| `--epitaph <text>` | One line, set large under the project name. |
| `--cause <text>` | What actually killed it. `"semester ended"`, `"got bored"`. |
| `--marker <name>` | `headstone-round`, `headstone-cross`, `obelisk`, `urn`, `mound`. Omit it and one is derived from the slug, stably. |
| `--desc <text>` | Override the description entirely. |
| `--no-readme` | Use the GitHub description instead of the README. |
| `--born <date>` | `YYYY-MM-DD`. Defaults to the repo's creation date. |
| `--died <date>` | `YYYY-MM-DD`. Defaults to its last push. |
| `--shot <path>` | A screenshot to copy in. Repeatable. |
| `--slug <name>` | Override the id. **Changing it moves the grave** (see below). |
| `--force` | Overwrite an entry that already exists. |
| `--dry-run` | Print the entry and write nothing. |
| `--list` | List your stalest unburied repos. |
| `--help` | The same table, in the terminal. |

### Finding candidates

```bash
node tools/bury.mjs --list
```

Your non-fork repos, stalest first, with anything already buried filtered out.
It does not guess what is dead — only what has not been touched in a while.

### Screenshots

```bash
node tools/bury.mjs avm --force --shot ~/Desktop/avm.png --shot ~/Desktop/avm-2.png
```

Files are copied to `shots/<slug>/1.png`, `2.png` and recorded in the entry, so
the originals can move or vanish afterwards. They render in the panel in a
framed card.

### Fixing an entry

Re-run with `--force`; it replaces the entry in place:

```bash
node tools/bury.mjs avm --force --epitaph "A virtual machine with no world to run."
```

Or edit `data/projects.json` directly — the file is the source of truth and the
tool has no state of its own.

## The data file

```json
{
  "slug": "twinstickdraft",
  "name": "TwinStickDraft",
  "repo": "https://github.com/gr13nka/TwinStickDraft",
  "born": "2025-04-14",
  "died": "2025-05-20",
  "epitaph": "Two sticks. Five weeks. One room.",
  "description": "First test project for a twin-stick shooter…",
  "cause": "got interested in something else on a Thursday",
  "marker": "mound",
  "screenshots": ["shots/twinstickdraft/1.png"]
}
```

Only `slug`, `name` and `died` are really required. `marker` and `screenshots`
are optional; empty strings are omitted from the panel rather than rendered as
blanks.

## How the layout works

**Graves come in blocks.** Plots of two or three aligned columns, two or three
rows, with roughly 70% of slots occupied. The column alignment is what reads as
"somebody laid this out"; the empty slots and the per-stone tilt are what stop
it reading as a spreadsheet. Blocks alternate sides of the path.

**Every placement derives from a hash of the slug** — which side, which column,
which marker, the tilt, the undergrowth around it. Nothing is stored in the data
file and nothing is random at runtime, so the yard is identical on every reload
and a grave you remember stays where you left it. The practical consequence:
**changing a project's `slug` moves its grave.** Its `name` can change freely.

**Order is by date of death, newest first.** You walk in from the fresh graves
and back through time. Year markers on the path show where each year begins, and
lanterns sit between blocks.

**Selecting a grave lights it.** A pool of light appears on the ground, stones
within about 460px warm toward the lantern colour, and each of them throws a
shadow on the side away from the light. Graves beyond that are untouched.

**You carry a candle.** Inside the yard the pointer becomes a small lit candle
with its own pool of light, warming the stones it passes. It throws no shadows
— only the grave you picked does that, so the shadows stay still instead of
swinging around with every movement of the mouse. Over the epitaph panel the
normal cursor returns; touch devices never see the candle.

## Project structure

```
index.html            the page; registers which motifs load
css/
  palettes.css        colour tokens; the site runs the "indigo night" palette
  graveyard.css       layout, scene, marker and panel styles
js/
  plots.js            block allocator — where every grave stands
  scene.js            the scrollable scene, lighting, selection
  marker.js           one grave: motif, engraved dates, shadow
  road.js             the procedurally drawn path
  epitaph.js          the right-hand panel
  doodles.js          motif loading and inlining
doodles/              hand-drawn SVG motifs, stroke-only
vendor/karakuli/      the Karakuli kit, copied in verbatim, never edited here
data/projects.json    the graves
shots/<slug>/         screenshots
tools/bury.mjs        the burial command
```

## A note on the style

The drawing follows [Karakuli](https://github.com/gr13nka/karakuli), the
hand-drawn design system in `~/Documents/karakuli` — one soft round-nib pen,
stroke-only motifs, no gradients, no shadows for separation, motion that
overshoots and settles. The kit is vendored into `vendor/karakuli/` and used
unmodified.

The one place this site departs from it is the ground: Karakuli's paper is warm
cream, and this is a night scene on deep indigo. That is the kit's *Dark mode*
backlog item, which has not been settled yet, so the night palette lives here as
a local override rather than being folded into canon. If it ever is, three
things found while building this need dealing with: the pen brights do not
survive inversion, several of the kit's hand-drawn data-URI assets bake the ink
colour into their markup and vanish on a dark ground, and `.krk-enter-sprout`
animates `transform`, so it destroys the placement of any element positioned
with one.
