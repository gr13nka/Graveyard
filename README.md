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

**[Walk through it →](https://gr13nka.github.io/Graveyard/)**

<img src="docs/images/hero.png" alt="A night graveyard: headstones in plots either side of a lit path, lanterns between them" width="100%">

</div>

## Light a candle to show your honour

<img src="docs/images/candle.gif" alt="A match is struck on the box, carried up to the wick, and the candle catches" width="400">

Visitors can light a candle at a grave, privately, in their own browser.
[How it works →](docs/GUIDE.md#lighting-a-candle)

## Quick start

No server, no build — fork it and run it over http:

```bash
gh repo fork gr13nka/Graveyard --clone
cd Graveyard
echo '[]' > data/projects.json     # empty the yard — these graves are mine
python3 -m http.server 8000        # → http://localhost:8000
```

Opened as a `file://` URL the modules fail silently, so serve it. Bury your first project
(below), then publish to Pages when it's worth showing.
[Fork & publish in full →](docs/GUIDE.md#making-your-own)

## Bury a project

```bash
node tools/bury.mjs TwinStickDraft \
  --epitaph "Two sticks. Five weeks. One room." \
  --cause "got interested in something else on a Thursday"
```

One command per grave; you write the epitaph.
[Every flag →](docs/GUIDE.md#burying-a-project)

## Bury an idea that was never built

```bash
node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup.md --epitaph "..." --cause "..."
```

For an idea that died before any code — a cairn, not a headstone.
[How an idea's grave differs →](docs/GUIDE.md#how-an-ideas-grave-differs)

## Edit from the page

<img src="docs/images/edit.png" alt="A grave selected with ?edit on: the panel is a form for its epitaph, cause, dates and marker" width="100%">

Add `?edit` to the URL to edit graves in place; Save commits to GitHub, no server.
[Setting it up →](docs/GUIDE.md#editing-from-the-page)

## Drive it with an agent

To make your own, fork the repo and open it in Claude Code — or any agent — and paste this:

> Read CLAUDE.md first. Then run `node tools/bury.mjs --list` and show me my stalest repos.
> For each one I pick, run `node tools/bury.mjs <repo>` — take the description and the dates
> from GitHub, but leave the epitaph and the cause blank for me to write. When I have filled
> them in, commit and push.

`CLAUDE.md` holds the invariants an agent would otherwise break — chief among them that a
grave's position is a hash of its slug, so **renaming a slug moves the grave**.

## Docs

Every option, the data file format, the `?edit` token and how the lighting works are in
**[docs/GUIDE.md](docs/GUIDE.md)**. Invariants and traps for anyone changing the code are
in [CLAUDE.md](CLAUDE.md).

## License

MIT. The drawing follows [Karakuli](https://github.com/gr13nka/karakuli), used unmodified
apart from [two deliberate departures](docs/GUIDE.md#a-note-on-the-style).
