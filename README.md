<div align="center">

# Graveyard

[![live site](https://img.shields.io/badge/live-gr13nka.github.io%2FGraveyard-6f6ac4?style=flat-square)](https://gr13nka.github.io/Graveyard/)
[![pages](https://img.shields.io/github/deployments/gr13nka/Graveyard/github-pages?style=flat-square&label=pages)](https://gr13nka.github.io/Graveyard/)
[![license MIT](https://img.shields.io/badge/license-MIT-6f6ac4?style=flat-square)](LICENSE)
![no build step](https://img.shields.io/badge/build-none-8b8b8b?style=flat-square)
![zero dependencies](https://img.shields.io/badge/dependencies-0-8b8b8b?style=flat-square)

**A scrollable cemetery of dead projects.**

Bury a repo with one command, write its epitaph, and let people
light a candle at the grave.

**[Walk through it →](https://gr13nka.github.io/Graveyard/)**

<img src="docs/images/hero.png" alt="A night graveyard: headstones in plots either side of a lit path, lanterns between them" width="100%">

</div>

## Light a candle

<img src="docs/images/candle.gif" alt="A match is struck on the box, carried up to the wick, and the candle catches" width="400">

Drag the match onto the box, scrub it sideways until it catches, then carry it up to the
wick — you have five seconds before it burns down to your fingers. The candle then burns at
the foot of that grave, and is still burning when you come back.

**They are your candles, in this browser.** No count, no server, nobody else's to see: a
static page cannot know whether anyone else lit anything, and pretending otherwise would
be the one dishonest thing on the site. [The whole ritual →](docs/GUIDE.md#lighting-a-candle)

## Make your own

```bash
gh repo fork gr13nka/Graveyard --clone --fork-name Graveyard
cd Graveyard
echo '[]' > data/projects.json     # empty the yard; these graves are mine
node tools/bury.mjs --list         # your stalest repos
node tools/bury.mjs <repo> --epitaph "..." --cause "..."
python3 -m http.server 8000        # look at it
```

Nothing to install and no build step — but it **must be served over http**. Opened as a
`file://` URL every ES module fails silently and the page just looks half-drawn.

Publish it:

```bash
git push
gh api -X POST repos/:owner/Graveyard/pages -f 'source[branch]=main' -f 'source[path]=/'
```

`bury.mjs` asks `gh` who *you* are, so a fork becomes your graveyard unedited.

## Bury a project

```bash
node tools/bury.mjs TwinStickDraft \
  --epitaph "Two sticks. Five weeks. One room." \
  --cause "got interested in something else on a Thursday"
```

It takes the description from the repo's own README and the two dates from GitHub. It will
not write the epitaph or the cause — those are the only part worth reading, and a generated
one reads exactly like a generated one. [Every flag →](docs/GUIDE.md#burying-a-project)

## Bury an idea that was never built

```bash
node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup.md --epitaph "..." --cause "..."
```

No repo, no birthday, and a cairn instead of a headstone — it never lived, so the yard
carves one date rather than inventing a lifespan. The analysis that killed it opens over
the graves. [How an idea's grave differs →](docs/GUIDE.md#how-an-ideas-grave-differs)


## Edit from the page

<img src="docs/images/edit.png" alt="A grave selected with ?edit on: the panel is a form for its epitaph, cause, dates and marker" width="100%">

Add `?edit` to the URL and the panel becomes a form — epitaph, cause, dates, marker, and an
exhume button. Save commits `data/projects.json` straight to GitHub through the Contents
API, so there is still no server. [Setting it up →](docs/GUIDE.md#editing-from-the-page)

## Docs

Every option, the data file format, the `?edit` token and how the lighting works are in
**[docs/GUIDE.md](docs/GUIDE.md)**. Invariants and traps for anyone changing the code are
in [CLAUDE.md](CLAUDE.md).

## License

MIT. The drawing follows [Karakuli](https://github.com/gr13nka/karakuli), used unmodified
apart from [two deliberate departures](docs/GUIDE.md#a-note-on-the-style).
