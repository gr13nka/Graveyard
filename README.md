<div align="center">

# Graveyard

[![live site](https://img.shields.io/badge/live-gr13nka.github.io%2FGraveyard-6f6ac4?style=flat-square)](https://gr13nka.github.io/Graveyard/)
[![pages](https://img.shields.io/github/deployments/gr13nka/Graveyard/github-pages?style=flat-square&label=pages)](https://gr13nka.github.io/Graveyard/)
[![license MIT](https://img.shields.io/badge/license-MIT-6f6ac4?style=flat-square)](LICENSE)
![no build step](https://img.shields.io/badge/build-none-8b8b8b?style=flat-square)
![zero dependencies](https://img.shields.io/badge/dependencies-0-8b8b8b?style=flat-square)

**Cosy cemetery of your dead projects.**

You can bury a repo with one command, write its epitaph, and let people
light a candle at the grave.

**[Walk through my →](https://gr13nka.github.io/Graveyard/)**

<img src="docs/images/hero.png" alt="A night graveyard: headstones in plots either side of a lit path, lanterns between them" width="100%">

</div>

## Light a candle to show your honour

<img src="docs/images/candle.gif" alt="A match is struck on the box, carried up to the wick, and the candle catches" width="400">

## Host it in your Github without server

1. Fork it:
2. Publish it:
```bash
git push
gh api -X POST repos/:owner/Graveyard/pages -f 'source[branch]=main' -f 'source[path]=/'
```

## Use it with your agent to easily bury your projects and show your graveyard to other people.

Below should go the instructions super simple how to use this yourself or just how to use it with any agent. 


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
