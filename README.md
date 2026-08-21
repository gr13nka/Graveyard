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

Anyone visiting your graveyard can light a candle at a grave, and it is still burning when
they come back. Candles live in that visitor's browser, so there is no count and nobody
else's to see. [How it works →](docs/GUIDE.md#lighting-a-candle)

## Use it with your agent to easily bury your projects and show your graveyard to other people.

To create your own fork the repo, then open your
fork in Claude Code - or any agent - and paste this:

> Read CLAUDE.md first. Then run `node tools/bury.mjs --list` and show me my stalest repos.
> For each one I pick, run `node tools/bury.mjs <repo>` — take the description and the dates
> from GitHub, but leave the epitaph and the cause blank for me to write. When I have filled
> them in, commit and push.

`CLAUDE.md` holds the invariants an agent would otherwise break — chief among them that a
grave's position is a hash of its slug, so **renaming a slug moves the grave**.

## Host it manualy in your Github without server

1. **Fork it.** `bury.mjs` asks `gh` who *you* are, so the fork is yours with nothing to edit.

   ```bash
   gh repo fork gr13nka/Graveyard --clone
   cd Graveyard
   echo '[]' > data/projects.json     # empty the yard — these graves are mine
   python3 -m http.server 8000        # → http://localhost:8000
   ```

   It has to be served over http: as a `file://` URL every ES module fails silently and the
   page renders half-drawn, with no error to explain why.

2. **Publish it.** Pages serves the fork at `https://<your-username>.github.io/Graveyard/`.

   ```bash
   git commit -am "My graveyard"
   git push
   gh api -X POST 'repos/{owner}/{repo}/pages' -f 'source[branch]=main' -f 'source[path]=/'
   ```

   Paths are relative, so the `/Graveyard/` subpath needs no configuration and a rename or a
   custom domain keeps working. Pages needs the repo to be **public** unless you are on a
   paid plan — and a graveyard names every repo in it.

## Bury a project

```bash
node tools/bury.mjs TwinStickDraft \
  --epitaph "Two sticks. Five weeks. One room." \
  --cause "got interested in something else on a Thursday"
```

It takes the description from the repo's own README and both dates from GitHub. It will not
write the epitaph or the cause; you supply those.
[Every flag →](docs/GUIDE.md#burying-a-project)

## Bury an idea that was never built

```bash
node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup.md --epitaph "..." --cause "..."
```

No repo, no birthday, and a cairn instead of a headstone: one date carved rather than a
lifespan. The report that killed it opens in the page.
[How an idea's grave differs →](docs/GUIDE.md#how-an-ideas-grave-differs)


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
