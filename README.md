# Graveyard

A scrollable cemetery of dead projects. Graves stand in plots either side of a
path, each engraved with the years the project lived; clicking one lights the
ground around it and opens its epitaph on the right.

**→ [gr13nka.github.io/Graveyard](https://gr13nka.github.io/Graveyard/)**

<!-- ![the graveyard](shots/README.png) -->

## Running it locally

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

## Making your own

Everything here works against *your* GitHub account, not mine — `bury.mjs` asks
`gh` who you are and lists your repos, so a fork needs no editing to become
somebody else's graveyard.

```bash
gh repo fork gr13nka/Graveyard --clone --fork-name Graveyard
cd Graveyard
echo '[]' > data/projects.json     # empty the yard; these graves are mine
node tools/bury.mjs --list         # your stalest repos
node tools/bury.mjs <repo> --epitaph "..." --cause "..."
python3 -m http.server 8000        # look at it
```

When it is worth showing:

```bash
git commit -am "My graveyard"
git push
gh api -X POST repos/:owner/Graveyard/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

Pages serves it at `https://<you>.github.io/Graveyard/`. Every path in the page
is relative, so the `/Graveyard/` subpath needs no configuration — and if you
rename the repo, or serve it from a custom domain, it keeps working.

Two things worth knowing before you publish:

- **Pages needs the repo to be public** unless you are on a paid plan, and the
  graveyard names every repo in it. Check `data/projects.json` for anything you
  would rather not announce — a private repo's name and your description of why
  it died are both visible once this is up.
- **The epitaph is the point.** A yard of auto-filled descriptions and blank
  epitaphs is a list of repos with extra steps.

Then link it from your profile README (`<you>/<you>`, `README.md`):

```markdown
[⚰︎ my graveyard](https://<you>.github.io/Graveyard/) — projects that didn't make it
```

## Editing from the page

Add `?edit` to the URL — on the live site or a local server — click a grave, and
the panel becomes a form: epitaph, cause, description, name, marker, dates, repo
link, and an **exhume** button. Changes redraw the yard immediately, so a new
marker or a corrected date shows up before you save.

**Save commits straight to GitHub.** No server, nothing to run: the page writes
`data/projects.json` through GitHub's Contents API and Pages redeploys itself
about a minute later.

GitHub will not let an anonymous page write to a repository, so there is exactly
one setup step, once:

1. Open `?edit`, and the **Connect GitHub so Save can write** panel is already
   open — it is the only thing between you and a working Save.
2. Follow the link to create a
   [fine-grained token](https://github.com/settings/personal-access-tokens/new)
   with **access to only this repository** and one permission —
   **Contents: read and write**.
3. Paste it, press connect. Every save after that is a single click.

The page works out which repository to commit to from its own URL, so a fork
needs no configuration. Served from somewhere that can't say — localhost, a
custom domain — the panel asks for `owner/name` once as well.

The token is a real credential: it lives in that browser's `localStorage` and is
sent only to `api.github.com`. Don't do this on a shared computer; there's a
**sign out** beside the connect button.

Nothing about the editor is visible without `?edit`, and a visitor who finds the
URL still cannot save anything.

> There is deliberately no "download the file" fallback. An earlier version had
> one, and because it also renamed the Save button whenever it couldn't commit,
> the only thing anyone could find was a download button and no way to save.

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
  candle.js           the candle that replaces the cursor
  editor.js           the ?edit form; commits via the GitHub API
  github.js           reading and writing one file through the Contents API
  doodles.js          motif loading and inlining
doodles/              hand-drawn SVG motifs, stroke-only
vendor/karakuli/      the Karakuli kit, copied in verbatim, never edited here
data/projects.json    the graves
shots/<slug>/         screenshots
tools/bury.mjs        the burial command
CLAUDE.md             invariants and traps, for anyone editing the code
.nojekyll             stops GitHub Pages running the files through Jekyll
```

## A note on the style

The drawing follows [Karakuli](https://github.com/gr13nka/karakuli), the
hand-drawn design system in `~/Documents/karakuli` — one soft round-nib pen,
stroke-only motifs, no gradients, no shadows for separation, motion that
overshoots and settles. The kit is vendored into `vendor/karakuli/` and used
unmodified.

It departs from the kit in two places, both on purpose.

**The ground.** Karakuli's paper is warm cream; this is a night scene on deep
indigo. That is the kit's *Dark mode* backlog item, which has not been settled,
so the night palette lives here as a local override rather than being folded
into canon. If it ever is, three things found while building this need dealing
with: the pen brights do not survive inversion, several of the kit's hand-drawn
data-URI assets bake the ink colour into their markup and vanish on a dark
ground, and `.krk-enter-sprout` animates `transform`, so it destroys the
placement of any element positioned with one.

**Light is drawn with gradients**, which the kit forbids outright. Every glow —
the candle, the lanterns, the pool around a selected grave — is a CSS radial
falloff. They were originally stroked SVG motifs, to stay inside the rule, and
they looked wrong: lumpy edges and spiky rays that read as smudges and sparkles
rather than as light. This is a deliberate reversal, not an oversight. It is
confined to depicting light and used nowhere else, and the no-gradient rule
still holds for every surface, card and divider in the project.
