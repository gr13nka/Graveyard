#!/usr/bin/env node
/*
 * bury — put a dead repo in the graveyard.
 * -----------------------------------------------------------------------
 * Reads what it can from GitHub through the `gh` CLI you are already logged
 * into, so private repos work and there are no tokens to manage, then appends
 * an entry to data/projects.json.
 *
 * The description comes from the repo's README by default — its first real
 * paragraph, skipping the title, badges, blockquotes and code — because that
 * is almost always the sentence you already wrote explaining the thing. When
 * a repo has no README, or none of it is prose, it falls back to the repo's
 * GitHub description. Either can be overridden with --desc.
 *
 * What it deliberately does NOT invent: the epitaph and the cause of death.
 * Those are the point of the site, and a generated one would read like it.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

import {
  SHOTS, PROJECT_MARKERS as MARKERS,
  fail, parseArgs, slugify, loadProjects, inter,
} from './graveyard.mjs';

const HELP = `
bury — put a dead repo in the graveyard

  node tools/bury.mjs <repo> [options]
  node tools/bury.mjs --list

<repo>  owner/name, a bare name (your own account is assumed), or a GitHub URL

Options
  --epitaph <text>   One line, carved on the panel. Write it yourself.
  --cause <text>     What actually killed it. "semester ended", "got bored".
  --marker <name>    ${MARKERS.join(' | ')}
                     Omitted, one is picked from the slug and stays stable.
  --desc <text>      Override the description.
  --no-readme        Use the repo's GitHub description instead of its README.
  --born <date>      Override, YYYY-MM-DD. Default: repo creation date.
  --died <date>      Override, YYYY-MM-DD. Default: last push.
  --shot <path>      Screenshot to copy in. Repeatable.
  --slug <name>      Override the URL-ish id. Changing it moves the grave.
  --force            Overwrite an existing entry for this slug.
  --dry-run          Print the entry, write nothing.
  --list             Show your stalest non-fork repos, i.e. likely corpses.
  --help

Examples
  node tools/bury.mjs TwinStickDraft --epitaph "Two sticks. Five weeks. One room."
  node tools/bury.mjs gr13nka/avm --cause "semester ended" --marker obelisk
  node tools/bury.mjs OOP --desc "Coursework. Exists to prove attendance." --shot ~/shot.png
`.trim();

/* ---- github ---------------------------------------------------------- */

function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = (error.stderr || '').trim();
    /* A missing repo and a missing README are both answers, not crashes.
       "Could not resolve to a Repository" is what gh says for a name typo —
       matching it as an auth failure sent people to `gh auth login` over a
       misspelling. */
    if (/not found|could not resolve to a/i.test(stderr)) return null;
    if (/not logged in|authentication|gh auth login/i.test(stderr)) {
      fail('gh is not authenticated. Run: gh auth login');
    }
    fail(stderr || error.message);
  }
}

const me = () => (gh(['api', 'user', '--jq', '.login']) || '').trim();

/** Accepts owner/name, a bare name, or any github.com URL. */
function resolveRepo(input) {
  const cleaned = input.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  if (cleaned.includes('/')) return cleaned.split('/').slice(0, 2).join('/');
  const owner = me();
  if (!owner) fail('could not work out your GitHub username; pass owner/name');
  return `${owner}/${cleaned}`;
}

function fetchRepo(nameWithOwner) {
  const raw = gh(['repo', 'view', nameWithOwner, '--json',
    'name,description,createdAt,pushedAt,primaryLanguage,url,isArchived']);
  if (!raw) fail(`no such repo: ${nameWithOwner}`);
  return JSON.parse(raw);
}

function fetchReadme(nameWithOwner) {
  const encoded = gh(['api', `repos/${nameWithOwner}/readme`, '--jq', '.content']);
  if (!encoded) return '';
  return Buffer.from(encoded.replace(/\s/g, ''), 'base64').toString('utf8');
}

/* ---- turning a README into one paragraph ----------------------------- */

/** Markdown inline syntax to plain text — the site renders text, not markup. */
function plain(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links keep their text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = 400) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > max * 0.5) return cut.slice(0, stop + 1).trim();
  return `${cut.replace(/\s+\S*$/, '').trim()}…`;
}

/**
 * The first paragraph that is actually prose. READMEs open with a title, then
 * usually a row of badges, sometimes a tagline blockquote — none of which
 * describe the project to somebody standing at its grave.
 */
export function firstProse(markdown) {
  const body = markdown
    .replace(/^---[\s\S]*?^---/m, '')     // front matter
    .replace(/<!--[\s\S]*?-->/g, '')      // comments
    .replace(/```[\s\S]*?```/g, '');      // fenced code

  for (const block of body.split(/\n\s*\n/)) {
    const chunk = block.trim();
    if (!chunk) continue;
    if (/^#{1,6}\s/.test(chunk)) continue;          // heading
    if (/^>/.test(chunk)) continue;                 // tagline blockquote
    if (/^([-*+]|\d+\.)\s/.test(chunk)) continue;   // list
    if (/^\|/.test(chunk)) continue;                // table
    if (/^<\w/.test(chunk)) continue;               // raw HTML
    if (/^\s*[-*_]{3,}\s*$/.test(chunk)) continue;  // rule
    const text = plain(chunk);
    if (!text) continue;                            // badges reduce to nothing
    if (text.length < 25) continue;                 // a stray word is not a description
    return truncate(text);
  }
  return '';
}

/* ---- the graveyard file ---------------------------------------------- */

function copyShots(slug, paths) {
  if (!paths.length) return [];
  const dir = join(SHOTS, slug);
  mkdirSync(dir, { recursive: true });
  return paths.map((source, i) => {
    const from = resolve(source.replace(/^~/, process.env.HOME || '~'));
    if (!existsSync(from)) fail(`no such screenshot: ${from}`);
    const file = `${i + 1}${extname(from) || '.png'}`;
    copyFileSync(from, join(dir, file));
    return `shots/${slug}/${file}`;
  });
}

/* ---- candidates ------------------------------------------------------ */

function listCandidates() {
  const raw = gh(['repo', 'list', '--limit', '200', '--json',
    'name,description,isFork,isPrivate,pushedAt,primaryLanguage']);
  const repos = JSON.parse(raw || '[]')
    .filter((r) => !r.isFork)
    .sort((a, b) => a.pushedAt.localeCompare(b.pushedAt));

  const buried = new Set(loadProjects().map((p) => p.slug));
  const rows = repos.filter((r) => !buried.has(slugify(r.name))).slice(0, 20);

  console.log(`\n${rows.length} unburied repos, stalest first:\n`);
  for (const r of rows) {
    const lang = (r.primaryLanguage || {}).name || '—';
    console.log(`  ${r.pushedAt.slice(0, 10)}  ${r.name.padEnd(24)} ${lang.padEnd(12)}`
      + `${r.isPrivate ? 'private' : 'public '}  ${(r.description || '').slice(0, 44)}`);
  }
  console.log('\nBury one:  node tools/bury.mjs <name> --epitaph "..."\n');
}

/* ---- main ------------------------------------------------------------ */

function main() {
  const { opts, rest } = parseArgs(process.argv.slice(2), {
    flags: ['help', 'list', 'force', 'dry-run', 'no-readme'],
    repeatable: ['shot'],
  });

  if (opts.help) { console.log(HELP); return; }
  if (opts.list) { listCandidates(); return; }
  if (!rest.length) { console.log(HELP); process.exit(1); }

  const nameWithOwner = resolveRepo(rest[0]);
  const repo = fetchRepo(nameWithOwner);
  const slug = opts.slug ? slugify(opts.slug) : slugify(repo.name);

  const clash = loadProjects().find((p) => p.slug === slug);
  if (clash && !opts.force) {
    fail(`${slug} is already buried. Use --force to overwrite, or --slug to bury a second one.`);
  }

  let description = opts.desc || '';
  let source = 'given';
  if (!description && !opts['no-readme']) {
    description = firstProse(fetchReadme(nameWithOwner));
    if (description) source = 'README';
  }
  if (!description) {
    description = repo.description || '';
    source = repo.description ? 'repo description' : 'nothing found';
  }

  if (opts.marker && !MARKERS.includes(opts.marker)) {
    fail(`unknown marker "${opts.marker}". One of: ${MARKERS.join(', ')}`);
  }

  const entry = {
    slug,
    name: repo.name,
    repo: repo.url,
    born: opts.born || repo.createdAt.slice(0, 10),
    died: opts.died || repo.pushedAt.slice(0, 10),
    epitaph: opts.epitaph || '',
    description,
    cause: opts.cause || '',
    screenshots: [],
  };
  if (opts.marker) entry.marker = opts.marker;

  if (opts['dry-run']) {
    console.log(`\n${JSON.stringify(entry, null, 2)}\n`);
    console.log(`description from: ${source}`);
    console.log('nothing written (--dry-run)\n');
    return;
  }

  entry.screenshots = copyShots(slug, opts.shot);
  inter(entry, { force: true });

  const lang = (repo.primaryLanguage || {}).name;
  console.log(`\n  buried ${repo.name}${lang ? ` (${lang})` : ''}`);
  console.log(`  ${entry.born} — ${entry.died}`);
  console.log(`  description from ${source}`);
  if (entry.screenshots.length) console.log(`  ${entry.screenshots.length} screenshot(s) copied`);
  if (!entry.epitaph) console.log('\n  no epitaph. Add one — it is the only part worth reading:');
  if (!entry.epitaph) console.log(`  node tools/bury.mjs ${rest[0]} --force --epitaph "..."`);
  console.log(`\n  reload the page to see it.\n`);
}

if (process.argv[1] && process.argv[1].endsWith('bury.mjs')) main();
