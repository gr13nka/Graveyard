#!/usr/bin/env node
/*
 * autopsy — put an idea that was never built in the graveyard.
 * -----------------------------------------------------------------------
 * `bury` takes a repo. This takes the report that killed an idea: a handoff
 * from the `filter-business-idea` skill, which is where these projects died —
 * at a desk, before anything was written.
 *
 * It reads the report for the three things that are actually in it — a name, a
 * date, and the analysis itself — and copies the report in beside the grave so
 * the panel can link to it. Everything else about the grave is hashed from the
 * slug, as usual.
 *
 * What it deliberately does NOT invent, exactly as `bury` does not: the
 * epitaph and the cause. It prints the report's own verdict material instead,
 * so they can be written without opening the file.
 */

import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

import { AUTOPSIES, IDEA_MARKERS, fail, parseArgs, slugify, inter } from './graveyard.mjs';

const HELP = `
autopsy — bury an idea that was never built

  node tools/autopsy.mjs <report.md> [options]

<report.md>  a handoff from the filter-business-idea skill

Options
  --epitaph <text>   One line, carved on the panel. Write it yourself.
  --cause <text>     Why it was never born. "the answer was already free".
  --desc <text>      The paragraph under the rule. English, like the rest.
  --marker <name>    ${IDEA_MARKERS.join(' | ')}
                     Omitted, one is picked from the slug and stays stable.
  --name <text>      Override the name. Keep it short — it sits under the
                     marker, capped at the stone's width.
  --died <date>      Override, YYYY-MM-DD. Default: the date of the analysis.
  --slug <name>      Override the id. Changing it moves the grave.
  --force            Overwrite an existing entry for this slug.
  --dry-run          Print the entry and what the report says, write nothing.
  --help

Example
  node tools/autopsy.mjs ~/handoffs/handoff-kopia-backup-idea.md \\
    --slug kopia-backup --name "Time Machine на kopia" \\
    --epitaph "Somebody had already built it, and was giving it away."
`.trim();

/* ---- reading the report ---------------------------------------------- */

/*
 * The skill's own genre prefixes. The title is a sentence — "Разбор идеи:
 * «базовый аналог Авито для Черногории»" — and what is wanted is the idea, not
 * the fact that somebody analysed it. Two of the reports carry no prefix at
 * all, so failing to match is a normal outcome, not an error.
 */
const TITLE_PREFIX = /^(?:(?:Разбор|Отсев|Фильтр)\s+идеи|Бэктест фильтра)\s*:\s*|^Хэндоф\s*:\s*(?:идея\s+)?/i;

export function reportTitle(markdown) {
  const line = markdown.split('\n').find((l) => /^#\s+/.test(l));
  if (!line) return '';
  return line.replace(/^#\s+/, '').replace(TITLE_PREFIX, '').replace(/^«(.+)»$/, '$1').trim();
}

/*
 * The date the idea was filtered — the only date these reports carry, and they
 * carry it four ways: "Дата разбора: 2026-07-28" on its own line, the same
 * inside a blockquote, "23.07.2026" mid-sentence, and the range "23–24.07.2026".
 * A file may also carry a later "Ревизия" date, which is the last word on it.
 *
 * So: take every date in the head of the document and keep the latest. A range
 * resolves for free — its second half is the one that parses as a full date.
 * Only the head, because the body cites launch dates and sources that have
 * nothing to do with when this was judged.
 */
export function reportDate(markdown, headLines = 40) {
  const head = markdown.split('\n').slice(0, headLines).join('\n');
  const found = [];
  for (const [, y, m, d] of head.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) found.push(`${y}-${m}-${d}`);
  for (const [, d, m, y] of head.matchAll(/(\d{1,2})\.(\d{2})\.(\d{4})/g)) {
    found.push(`${y}-${m}-${String(d).padStart(2, '0')}`);
  }
  return found.sort().pop() || '';
}

/**
 * What the report says killed it — for writing the epitaph by, never written
 * into the entry. The skill emits flags rather than a verdict, so the material
 * is spread across the money-snail's state line and the first red flags.
 */
function killMaterial(markdown) {
  const lines = markdown.split('\n');
  const state = lines.find((l) => /Состояние:/i.test(l) || /^Не собран[ао]\./i.test(l.trim()));
  const flags = lines
    .filter((l) => /🔴/.test(l))
    .map((l) => l.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .slice(0, 3);
  return { state: state?.trim() || '', flags };
}

/* ---- main ------------------------------------------------------------ */

function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2), {
    flags: ['help', 'force', 'dry-run'],
  });

  if (opts.help) { console.log(HELP); return; }
  if (!rest.length) { console.log(HELP); process.exit(1); }

  const source = resolve(rest[0].replace(/^~/, process.env.HOME || '~'));
  if (!existsSync(source)) fail(`no such report: ${source}`);
  const markdown = readFileSync(source, 'utf8');

  /* The filename is the cleanest identifier in the corpus — already latin,
     already kebab-case, and unlike the title it does not need translating. */
  const fromFile = basename(source).replace(/\.md$/, '').replace(/^handoff-/, '');
  const slug = slugify(opts.slug || fromFile);

  const name = opts.name || reportTitle(markdown);
  if (!name) fail(`could not find a title (an "# ..." line) in ${basename(source)}; pass --name`);

  const died = opts.died || reportDate(markdown);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(died)) {
    fail(`could not read the date of the analysis; pass --died YYYY-MM-DD`);
  }

  if (opts.marker && !IDEA_MARKERS.includes(opts.marker)) {
    fail(`unknown marker "${opts.marker}". An idea takes one of: ${IDEA_MARKERS.join(', ')}`);
  }

  const entry = {
    slug,
    name,
    kind: 'idea',
    died,
    epitaph: opts.epitaph || '',
    description: opts.desc || '',
    cause: opts.cause || '',
    autopsy: `autopsies/${slug}.md`,
  };
  if (opts.marker) entry.marker = opts.marker;

  if (opts['dry-run']) {
    console.log(`\n${JSON.stringify(entry, null, 2)}\n`);
    const { state, flags } = killMaterial(markdown);
    if (state) console.log(`  ${state}`);
    for (const flag of flags) console.log(`  ${flag}`);
    console.log('\nnothing written (--dry-run)\n');
    return;
  }

  mkdirSync(AUTOPSIES, { recursive: true });
  copyFileSync(source, join(AUTOPSIES, `${slug}.md`));
  const how = inter(entry, { force: opts.force });

  console.log(`\n  ${how === 'replaced' ? 'reburied' : 'buried'} ${name}`);
  console.log(`  filtered ${died}`);
  console.log(`  autopsy copied to ${entry.autopsy}`);
  if (!entry.epitaph || !entry.cause) {
    const { state, flags } = killMaterial(markdown);
    console.log('\n  no epitaph yet. What the report says killed it:');
    if (state) console.log(`    ${state}`);
    for (const flag of flags) console.log(`    ${flag}`);
    console.log(`\n  node tools/autopsy.mjs ${rest[0]} --force --epitaph "..." --cause "..."`);
  }
  console.log(`\n  reload the page to see it.\n`);
}

if (process.argv[1] && process.argv[1].endsWith('autopsy.mjs')) main();
