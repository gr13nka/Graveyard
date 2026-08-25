# Graveyard — the full guide

Everything the [README](../README.md) leaves out. Invariants and traps for anyone
changing the code live in [CLAUDE.md](../CLAUDE.md) instead.

- [Running it locally](#running-it-locally)
- [Burying a project](#burying-a-project)
- [Making your own](#making-your-own)
- [Burying an idea that was never built](#burying-an-idea-that-was-never-built)
- [Lighting a candle](#lighting-a-candle)
- [Editing from the page](#editing-from-the-page)
- [The data file](#the-data-file)
- [How the layout works](#how-the-layout-works)
- [Project structure](#project-structure)
- [A note on the style](#a-note-on-the-style)

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
gh api -X POST 'repos/{owner}/{repo}/pages' \
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

## Burying an idea that was never built

Some projects die before anything is written. They have no repo, no first
commit and no last one — just the day somebody worked out that they would not
pay. Those get buried too:

```bash
node tools/autopsy.mjs <report.md> --epitaph "..." --cause "..."
```

`<report.md>` is a handoff from a `filter-business-idea` analysis — the
document that killed the idea. The tool reads the three things actually in it,
copies the report to `autopsies/<slug>.md`, and links the grave to it.

| Read from the report | How |
| --- | --- |
| slug | the filename, `handoff-<slug>.md` |
| name | the `#` title, minus the genre prefix |
| the date | `Дата разбора:`, or a `DD.MM.YYYY` in the opening lines; a later `Ревизия` wins |

As with `bury`, **it will not write the epitaph or the cause.** It prints what
the report says killed the idea so you can write them without opening the file.

```bash
node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup-idea.md --dry-run
```

### How an idea's grave differs

A project lived and stopped; an idea never started, and the yard says so rather
than inventing a lifespan for it.

- **Its marker is a cairn or a stake** — a stack of field stones, or a sawn
  plank with a nail through it. Never a headstone. The two sets do not overlap,
  so `--marker obelisk` on an idea is an error, and so is `--marker cairn` on a
  project.
- **One date, not two.** It is carved with the year it was filtered, and the
  panel says `filtered jul 2026` rather than a lifespan.
- **The panel says `never born, because`**, not `cause of death`.
- **Where a repo link would be, there is `read the autopsy`** — the full
  analysis opens over the yard, rendered in the page.
- **It is buried on the other side of the road.** Ideas take the right-hand
  field, repos the left, so which ground a grave stands in says what it was
  before you read a word of it.

## Lighting a candle

Read a grave's page to the end and there is a candle, a matchbox and a match,
stacked in that order. Drag the match up onto the box's striking face and scrub
it sideways until it catches, then carry it up to the wick before it burns down
to your fingers — you have five seconds, and if you dawdle it gutters out and a
fresh one rolls in. Striking is sideways and carrying is upward on purpose: laid
out in a row, one sweep did both and there was nothing to hurry for. The candle then burns at the foot of that
grave in the yard, throws its own small pool of light, and is still burning when
you come back.

Clicking the candle does the whole thing on its own, which is the keyboard and
touch path — and it is how you find out the match is draggable in the first
place.

**They are your candles, in this browser.** They live in `localStorage`, are
never sent anywhere, and there is no count and nobody else's to see: a static
page has no way to know whether anyone else lit anything, and pretending
otherwise would be the one dishonest thing on the site. Clearing site data is
the only way to put them out.

## Editing from the page

Add `?edit` to the URL — on the live site or a local server — click a grave, and
the panel becomes a form: epitaph, cause, description, name, marker, dates, repo
link, and an **exhume** button. On an idea the form follows the grave — it asks
for the autopsy rather than a repo, offers no birthday, and its marker list
holds only the two an idea may stand under. Changes redraw the yard immediately, so a new
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

### Why it asks for a token at all

Because there is no way to get a credential here without one being pasted. A
commit needs authorisation, and both alternatives are closed: OAuth's web flow
needs a `client_secret`, which a static page cannot hold without publishing it,
and OAuth's device flow — built for exactly this case — is served from GitHub
endpoints that send **no CORS headers**, so a browser cannot call them at all.

The page also cannot borrow your github.com session; that is cross-origin by
design. Every remaining workaround is a proxy, and a proxy is a server. The
floor really is one authorisation, once.

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

An idea that was never built is the same file, with `kind` and no lifespan:

```json
{
  "slug": "kopia-backup",
  "name": "Time Machine на kopia",
  "kind": "idea",
  "died": "2026-07-23",
  "epitaph": "Somebody had already built it, and was giving it away.",
  "description": "Time Machine for every platform — a friendly face on kopia's…",
  "cause": "BlinkDisk shipped the same fork of kopia, free",
  "autopsy": "autopsies/kopia-backup.md"
}
```

`kind` is absent on a project, which is what every existing grave is. `born`
and `repo` are absent on an idea: it has no birthday and no code. `autopsy` is
a path inside this repository, read by the page itself.

### Why the report is rendered in the page

Because linking to it does not work. `.nojekyll` makes Pages serve
`autopsies/*.md` as `text/markdown` **with no charset**, and a browser handed
that falls back to a single-byte encoding — so a Russian report opens as
`ÐŸÐ¾Ð´Ð±Ð¾Ñ€ Ð³Ð¸Ñ‚Ð°Ñ€Ð½Ð¾Ð³Ð¾`. There is no server here to set a header
on, and there is not going to be one.

Fetching it sidesteps the question entirely: `Response.text()` decodes as UTF-8
whatever the header claimed. `js/markdown.js` then renders the subset these
reports use — headings, blockquotes, tables, lists, rules, fenced code, and
inline emphasis, code and links. It builds DOM nodes and never assembles HTML,
so markup inside a report is only ever read as the characters it is made of.

## How the layout works

**The road divides the two kinds.** Repos stand in the field left of it, ideas
in the field right of it. The marker pools already said which was which — a repo
takes a headstone, an idea a cairn — and the two grounds put that same
distinction somewhere you can read from the gate instead of leaving the two
interleaved down one column. Each ground carries a header naming it and counting
what is buried there.

**Graves come in blocks.** Plots of two or three aligned columns, two or three
rows, with roughly 70% of slots occupied. The column alignment is what reads as
"somebody laid this out"; the empty slots and the per-stone tilt are what stop
it reading as a spreadsheet. Each field gets its own run of blocks down it.

**Every placement derives from a hash of the slug** — which column, which
marker, the tilt, the undergrowth around it. Which *side* is the one thing that
does not: that is the grave's kind. Nothing else is stored in the data file and
nothing is random at runtime, so the yard is identical on every reload and a
grave you remember stays where you left it. The practical consequence:
**changing a project's `slug` moves its grave.** Its `name` can change freely.

**Order is by date of death, newest first,** down each side independently. You
walk in from the fresh graves and back through time. Year markers on the path
follow the repos — the only side with a spread of years to mark, since the ideas
here were all filtered inside a fortnight — and lanterns are spaced evenly down
the road rather than sitting in the gaps between blocks, because with a field on
each side there are no gaps left to sit in.

**A yard holding only one kind is laid out the old way,** blocks alternating
down both fields. Half an empty yard is worse than a mixed one, and a fork on
its first day — repos buried, no ideas yet — would otherwise get exactly that.

**Selecting a grave lights it.** A pool of light appears on the ground, stones
within about 460px warm toward the lantern colour, and each of them throws a
shadow on the side away from the light. Graves beyond that are untouched.

**A lit candle is a light too.** A candle somebody lit stands at the foot of its
grave, warms its own stone and the nearest few around it, and throws the
smallest pool in the yard — deliberately well under what a selected grave
throws, so "somebody lit one over there" never reads as "this is the grave you
picked".

**You carry a candle.** Inside the yard the pointer becomes a small lit candle
with its own pool of light, warming the stones it passes. It throws no shadows
— only the grave you picked does that, so the shadows stay still instead of
swinging around with every movement of the mouse. Over the epitaph panel the
normal cursor returns; touch devices never see the candle.

**On a narrow screen the panel is a sheet, and it closes.** Below 900px the two
panes become one: the yard fills the screen and a grave's page rises over the
foot of it. Nothing is picked, no sheet — so the graveyard is whole until you
tap something. `close`, or Escape, puts it away and gives the grave back. With a
report open, Escape closes the report first and leaves the grave beneath it.

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
  matchbox.js         the match, the box, and lighting a candle
  vigil.js            which graves have a candle burning
  candle.js           the candle that replaces the cursor
  editor.js           the ?edit form; commits via the GitHub API
  autopsy.js          the report reader, over the yard
  markdown.js         just enough Markdown to read a report
  github.js           reading and writing one file through the Contents API
  doodles.js          motif loading and inlining
doodles/              hand-drawn SVG motifs, stroke-only
vendor/karakuli/      the Karakuli kit, copied in verbatim, never edited here
data/projects.json    the graves
autopsies/<slug>.md   the analysis that killed an idea
shots/<slug>/         screenshots, created by bury.mjs --shot
tools/bury.mjs        the burial command, for repos
tools/autopsy.mjs     the burial command, for ideas
tools/graveyard.mjs   the data file, shared by both
docs/GUIDE.md         this file
docs/images/          the README's screenshots
README.md             what the project is, and the shortest way in
CLAUDE.md             invariants and traps, for anyone editing the code
LICENSE               MIT
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
the candle you carry, the lanterns, the pool around a selected grave, the flame
on one somebody lit — is a CSS radial falloff. They were originally stroked SVG motifs, to stay inside the rule, and
they looked wrong: lumpy edges and spiky rays that read as smudges and sparkles
rather than as light. This is a deliberate reversal, not an oversight. It is
confined to depicting light and used nowhere else, and the no-gradient rule
still holds for every surface, card and divider in the project.
