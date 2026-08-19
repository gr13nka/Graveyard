/*
 * Which graves have a candle burning.
 * -----------------------------------------------------------------------
 * A vigil is one visitor's act, kept in that visitor's browser. There is no
 * server here and no way to get one, so this deliberately does NOT model a
 * count: it can only ever answer "did *you* light this one", and the page must
 * never dress that up as a crowd. Honest and small beats a fake tally.
 *
 * Callers ask isLit/litAt/light and subscribe for changes. That the answer is
 * a JSON blob in localStorage under a particular key is this module's business
 * and nobody else's.
 */

const KEY = 'gy_vigils';

/*
 * Read through a Map rather than localStorage, because castLight() asks isLit()
 * for every grave inside a rAF-throttled loop and localStorage reads are
 * synchronous main-thread work.
 */
const burning = new Map();
const listeners = new Set();

/*
 * Storage is optional, not guaranteed. Safari's private mode and a file://
 * origin both make every key access throw SecurityError, and a half-written
 * entry from an interrupted write parses as garbage. A graveyard that refuses
 * to render because of either is a far worse outcome than one with no candles,
 * so both failures degrade to an in-memory store for the session.
 */
function readStore() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.entries(saved).forEach(([slug, at]) => {
      if (typeof at === 'number' && Number.isFinite(at)) burning.set(slug, at);
    });
  } catch {
    /* Unreadable. Start empty; the next light() overwrites it. */
  }
}

function writeStore() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(burning)));
  } catch {
    /* Quota, private mode, file://. The candle still burns for this session. */
  }
}

readStore();

/** Is a candle burning at this grave? */
export function isLit(slug) {
  return burning.has(slug);
}

/** When it was lit, in epoch ms — or null if it never was. */
export function litAt(slug) {
  return burning.get(slug) ?? null;
}

/**
 * Light one. Idempotent: relighting a burning candle is a no-op rather than a
 * reset, so the "burning since" date is the first time, which is the date worth
 * keeping.
 */
export function light(slug) {
  if (!slug || burning.has(slug)) return;
  burning.set(slug, Date.now());
  writeStore();
  listeners.forEach((fn) => fn());
}

/** Called on every change. Returns its own unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
