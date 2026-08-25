<div align="center">

# Graveyard

[![live site](https://img.shields.io/badge/live-gr13nka.github.io%2FGraveyard-6f6ac4?style=flat-square)](https://gr13nka.github.io/Graveyard/)
[![pages](https://img.shields.io/github/deployments/gr13nka/Graveyard/github-pages?style=flat-square&label=pages)](https://gr13nka.github.io/Graveyard/)
[![license MIT](https://img.shields.io/badge/license-MIT-6f6ac4?style=flat-square)](LICENSE)
![no build step](https://img.shields.io/badge/build-none-8b8b8b?style=flat-square)
![zero dependencies](https://img.shields.io/badge/dependencies-0-8b8b8b?style=flat-square)

**[See my own Graveyard live →](https://gr13nka.github.io/Graveyard/)**

***Your projects died. Bury them properly.***

<a href="https://gr13nka.github.io/Graveyard/"><img src="docs/images/hero.png" alt="A night graveyard: headstones in plots either side of a lit path, lanterns between them" width="100%"></a>

</div>

You have the folder. Thirty-odd repos you'll get back to any day now. You won't.

Graveyard buries them. Each one gets a headstone with the years it ran, a line for the
epitaph, and a line for what killed it. People can leave a candle.

No server, no database, no build.

## Light a candle to show your honour

<img src="docs/images/candle.gif" alt="A match is struck on the box, carried up to the wick, and the candle catches" width="400">

Scroll a grave to the bottom and there's a candle. 
[How it works →](docs/GUIDE.md#lighting-a-candle)

## Quick start

Fork it, run it. Over http — `file://` breaks every module and doesn't say so:

```bash
gh repo fork gr13nka/Graveyard --clone
cd Graveyard
echo '[]' > data/projects.json     # empty the yard — these graves are mine
python3 -m http.server 8000        # → http://localhost:8000
```

Bury something (below), push to Pages when it's worth showing.
[Fork & publish in full →](docs/GUIDE.md#making-your-own)

## Drive it with an agent

Open your fork in Claude Code, or whatever
you use, and paste this:

> Read CLAUDE.md first. Then run `node tools/bury.mjs --list` and show me my stalest repos.
> For each one I pick, run `node tools/bury.mjs <repo>` — take the description and the dates
> from GitHub, but leave the epitaph and the cause blank for me to write. When I have filled
> them in, commit and push.

`CLAUDE.md` has the rules an agent will otherwise break. Main one: a grave's spot is a hash
of its slug, so rename the slug and the grave moves.

## Bury a project

```bash
node tools/bury.mjs TwinStickDraft \
  --epitaph "Two sticks. Five weeks. One room." \
  --cause "got interested in something else on a Thursday"
```

One command, one grave. It writes everything but the epitaph and the cause of death. Those
are the parts anyone reads, so you write them. [Every flag →](docs/GUIDE.md#burying-a-project)

## Bury an idea that was never built

```bash
node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup.md --epitaph "..." --cause "..."
```

Some die before the first commit. No repo, no birthday. A cairn and one date, the day you
gave up. [How an idea's grave differs →](docs/GUIDE.md#how-an-ideas-grave-differs)

## Edit from the page

<img src="docs/images/edit.png" alt="A grave selected with ?edit on: the panel is a form for its epitaph, cause, dates and marker" width="100%">

Add `?edit` to the URL. Graves become forms, Save writes to GitHub. Still no server.
[Setting it up →](docs/GUIDE.md#editing-from-the-page)

## FAQ

**Needs a server?** No. It's a static page. The editor commits through a token you paste
once.

**Where do the candles live?** Your browser. Not a database, because there is no database.
No count, nobody else's to see.

**It's not really dead though.** It's 2026 and you last touched it in 2023. It's dead.

**Why bother?** Closure. And it reads better than a profile full of repos that just stop.

## Docs

Every option, the data file format, the `?edit` token and how the lighting works are in
**[docs/GUIDE.md](docs/GUIDE.md)**. Invariants and traps for anyone changing the code are
in [CLAUDE.md](CLAUDE.md).

## License

MIT. Dig one up, keep it. The drawing is [Karakuli](https://github.com/gr13nka/karakuli),
used as-is bar [two changes](docs/GUIDE.md#a-note-on-the-style).
