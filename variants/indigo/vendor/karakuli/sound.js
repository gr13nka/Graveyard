/*
 * Karakuli — sound layer
 * -----------------------------------------------------------------------
 * Wraps uisfx (npm `uisfx`, MIT code / CC0 audio) with Karakuli's sound
 * doctrine: the "zen" pack, always ("paper folds, soft brush, warm wood,
 * and quiet chimes"), sitting under the interface at a default volume of
 * 0.35, filtered through the app's energy dial (see STYLE.md §7 / §Sound).
 *
 * Install: npm install uisfx
 * In a bundler-less page, no separate action is needed: initKarakuliSound()
 * tries the bare `import('uisfx')` specifier first (so bundled apps keep
 * npm resolution) and automatically falls back to the esm.sh CDN build
 * (https://esm.sh/uisfx@0.4) if that fails to resolve.
 *
 * Usage:
 *   import { initKarakuliSound, KRK_CUES } from './sound.js';
 *   const krk = initKarakuliSound({ energy: 'playful' });
 *   button.addEventListener('click', () => krk.play(KRK_CUES.tap));
 */

// Semantic cue mapping — see STYLE.md §Sound for the doctrine behind each
// entry. Call sites should reach for these names, not raw uisfx cue names,
// so the mapping stays the single place doctrine changes land. `confirm` is
// for affirmative completions (not per-checkbox ticks — 'success' read as
// an unpleasant chime there). `pick`/`unpick`/`radio` are the user's by-ear
// picks for checking/unchecking a checkbox and selecting a radio option, and
// are provisional pending further tuning. `slide` is the sliding screen
// selector's travel cue — zen's soft brush, the nearest thing the pack has
// to a swipe; it shares 'drag-start' with `pick` deliberately, the way
// `radio` and `holdEnd` already share 'release'. IMPORTANT: uisfx's cue catalog
// has no 'click' cue — using it plays nothing, which is how tap ended up
// silent — so never reintroduce 'click' here.
export const KRK_CUES = {
  tap: 'press',
  holdStart: 'long-press',
  holdEnd: 'release',
  pick: 'drag-start',
  unpick: 'invalid-drop',
  radio: 'release',
  slide: 'drag-start',
  confirm: 'success',
  done: 'complete',
  warn: 'warning',
  fail: 'error',
  drop: 'drop',
  moment: 'level-up',
  busy: 'loading',
};

// Calm apps (meditation, exhaustion tracker) only ever get state-of-the-world
// cues; playful apps get the full mapping. Anything not listed here for a
// calm app is silently swallowed rather than played.
const CALM_CUES = new Set(['success', 'complete', 'error', 'warning']);

export function initKarakuliSound({ energy = 'calm', volume = 0.35 } = {}) {
  let ui = null;
  let unlocked = false;
  // Requests made before the async import resolves would otherwise be lost
  // (ui is still null) — buffer the latest one and apply it once ui exists.
  let pendingEnabled = null;
  let pendingVolume = volume;
  const stoppedHandle = { stop: () => {} };

  function onUISFXReady({ createUISFX }) {
    ui = createUISFX({ pack: 'zen', preferences: {} });
    ui.setVolume(pendingVolume);
    if (pendingEnabled !== null) ui.setEnabled(pendingEnabled);
  }

  function loadUISFX() {
    // Bare specifier first, so a bundled app resolves it via npm/node_modules
    // like normal; a plain browser page can't resolve a bare specifier at
    // all and rejects instantly, so fall back to a CDN build in that case.
    return import('uisfx').catch(() => import('https://esm.sh/uisfx@0.4'));
  }

  try {
    loadUISFX()
      .then(onUISFXReady)
      .catch(() => {
        // Offline, or both the bare specifier and the CDN fallback failed —
        // sound degrades to silent no-ops below rather than breaking the app.
      });
  } catch {
    // Environments without dynamic import() (very old bundlers) — same
    // graceful degradation as a failed import.
  }

  if (typeof document !== 'undefined') {
    // No { once: true }: the import is async, so the first pointerdown can
    // easily land before ui exists. Stay attached until an unlock actually
    // succeeds, then detach — a later gesture is what unlocks WebAudio.
    document.addEventListener('pointerdown', function onFirstPointerDown() {
      if (unlocked || !ui) return;
      unlocked = true;
      document.removeEventListener('pointerdown', onFirstPointerDown);
      ui.unlock().catch(() => {});
    });
  }

  function allowed(cue) {
    return energy === 'calm' ? CALM_CUES.has(cue) : true;
  }

  return {
    play(cue) {
      if (!ui || !cue || !allowed(cue)) return;
      ui.play(cue);
    },
    loop(cue) {
      if (!ui || !cue || !allowed(cue)) return stoppedHandle;
      return ui.play(cue);
    },
    setEnabled(on) {
      pendingEnabled = on;
      ui?.setEnabled(on);
    },
    setVolume(v) {
      pendingVolume = v;
      ui?.setVolume(v);
    },
    get ui() {
      return ui;
    },
  };
}
