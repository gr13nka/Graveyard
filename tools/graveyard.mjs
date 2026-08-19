/*
 * The graveyard file, for the tools that write to it.
 * -----------------------------------------------------------------------
 * `bury` and `autopsy` fill in graves from completely different sources — one
 * interrogates GitHub, the other reads a markdown report off your disk — but
 * they agree on where the yard lives and what an entry looks like. That
 * agreement is this module, so the two cannot drift apart.
 *
 * The marker lists here are a deliberate copy of the ones in `js/marker.js`,
 * and have to be: these tools run in Node, and importing that module would
 * drag in `js/doodles.js`, which needs `fetch` and `document`. That is a real
 * boundary. Two Node tools each keeping their own copy would not be.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = join(ROOT, 'data', 'projects.json');
export const SHOTS = join(ROOT, 'shots');
export const AUTOPSIES = join(ROOT, 'autopsies');

/* Which markers each kind of grave may stand under — see js/marker.js, which
   is where these are enforced when the page draws. */
export const PROJECT_MARKERS = ['headstone-round', 'headstone-cross', 'obelisk', 'urn', 'mound'];
export const IDEA_MARKERS = ['cairn', 'stake'];

export function fail(message) {
  console.error(`${process.argv[1]?.split('/').pop()?.replace(/\.mjs$/, '') || 'graveyard'}: ${message}`);
  process.exit(1);
}

/**
 * Flags in, values out. `flags` are the ones that take no value; `repeatable`
 * ones collect into an array. Everything not starting with `--` is positional.
 */
export function parseArgs(argv, { flags = [], repeatable = [] } = {}) {
  const opts = {};
  for (const key of repeatable) opts[key] = [];
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { rest.push(arg); continue; }
    const key = arg.slice(2);
    if (flags.includes(key)) { opts[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined) fail(`--${key} needs a value`);
    if (repeatable.includes(key)) opts[key].push(value);
    else opts[key] = value;
  }
  return { opts, rest };
}

export const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function loadProjects() {
  if (!existsSync(DATA)) return [];
  try {
    return JSON.parse(readFileSync(DATA, 'utf8'));
  } catch (error) {
    fail(`data/projects.json is not valid JSON (${error.message})`);
  }
}

export const saveProjects = (list) => writeFileSync(DATA, `${JSON.stringify(list, null, 2)}\n`);

/**
 * Put an entry in the yard, replacing one that shares its slug. Answers with
 * how it landed so the caller can say so.
 *
 * @returns {'added' | 'replaced'}
 */
export function inter(entry, { force = false } = {}) {
  const projects = loadProjects();
  const at = projects.findIndex((p) => p.slug === entry.slug);
  if (at !== -1 && !force) {
    fail(`${entry.slug} is already buried. Use --force to overwrite, or --slug to bury a second one.`);
  }
  if (at !== -1) projects[at] = entry;
  else projects.push(entry);
  saveProjects(projects);
  return at !== -1 ? 'replaced' : 'added';
}
