/*
 * The match, the box and the candle you light with them.
 * -----------------------------------------------------------------------
 * Callers say matchbox(project) and get one element back. The drag, the strike,
 * the burn-down, the hit test on the wick and the writing of the vigil are all
 * in here; the epitaph panel that hosts it knows none of it.
 *
 * The whole ritual is ONE continuous press: you drag the match across the box
 * to strike it, and then you have five seconds to reach the wick before it
 * burns down to your fingers. Letting go mid-air drops it. That is the joke,
 * and it only works because the two halves are one gesture — a strike you
 * could pause and think about is not a match.
 *
 * Clicking the candle instead runs the same ritual on its own. That is the
 * keyboard and touch path, and it is also how the drag gets discovered: you
 * watch the match do it once and then reach for it yourself. The feature is
 * never gated behind a dexterity puzzle.
 */

import { doodle } from './doodles.js';
import { isLit, litAt, light } from './vigil.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/* How far you have to scrub across the striking face before it catches. Total
   travel, not displacement — scrubbing back and forth is how a match is
   actually struck, and rewarding only one clean sweep felt like a gesture test. */
const STRIKE_TRAVEL = 34;

/* How close the flame has to get to the wick. Deliberately a radius on the
   wick tip rather than the candle's box: reaching for the wax does nothing. */
const WICK_REACH = 24;

/* Where the match's lit head sits inside its own 48x48 drawing, and where the
   wick tip sits inside the candle's. Both are read off the .svg paths. */
const HEAD_AT = { x: 0.29, y: 0.35 };
const WICK_AT = { x: 0.5, y: 0.25 };

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const on = (at) => {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

function motif(name, className, boil = true) {
  const svg = doodle(name);
  svg.classList.add(className);
  if (boil) svg.classList.add('krk-boil');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

/* Where a doodle's drawn feature sits, in viewport coordinates. Both rects
   this is used against move with the panel's own scrolling, so it is always
   read fresh and never cached across a gesture. */
function anchor(node, at) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width * at.x, y: box.top + box.height * at.y };
}

/**
 * The vigil control for one grave: an unlit candle, a match and a box, or —
 * once it is lit — the burning candle and the date somebody lit it.
 */
export function matchbox(project) {
  const root = el('div', 'gy-matchbox krk-enter-rise');
  const tray = el('div', 'gy-matchbox__tray');
  const label = el('p', 'gy-matchbox__label krk-hand');
  /* Hidden, and separate from the visible line on purpose: a role="status" on
     visible content would announce "burning since…" on every mount of an
     already-lit grave. This starts empty and only ever carries transitions. */
  const status = el('p', 'gy-matchbox__status gy-sr-only');
  status.setAttribute('role', 'status');

  const candle = el('button', 'gy-matchbox__candle');
  candle.type = 'button';
  const glow = el('span', 'gy-matchbox__glow');
  glow.setAttribute('aria-hidden', 'true');
  candle.appendChild(glow);

  root.append(tray, label, status);
  tray.appendChild(candle);

  function dressAsLit() {
    root.dataset.state = 'lit';
    candle.querySelector('svg')?.remove();
    /* No krk-boil on a permanent flame: it flickers already, and a boil filter
       that never stops is the scene's measured bottleneck. */
    candle.appendChild(motif('candle', 'gy-matchbox__wax', false));
    candle.setAttribute('aria-label', `A candle is burning for ${project.name}`);
    label.textContent = `burning since ${on(litAt(project.slug) ?? Date.now())}`;
  }

  if (isLit(project.slug)) {
    dressAsLit();
    return root;
  }

  root.dataset.state = 'ready';
  candle.appendChild(motif('candle-out', 'gy-matchbox__wax'));
  candle.setAttribute('aria-label', `Light a candle for ${project.name}`);
  label.textContent = 'light a candle';

  const box = motif('matchbox', 'gy-matchbox__box');
  /*
   * The striking face is its own element rather than the box drawing's bounds.
   * The drawing is a 48-unit square with the box lying across its middle, so
   * its element box is nearly twice the height of anything drawn in it — using
   * that as the target would let a match catch in mid-air well above the grit.
   */
  const strip = el('span', 'gy-matchbox__strip');
  strip.setAttribute('aria-hidden', 'true');

  const match = el('div', 'gy-matchbox__match');
  /* Decorative and not focusable: the candle button is the accessible path. */
  match.setAttribute('aria-hidden', 'true');
  const fire = el('span', 'gy-matchbox__fire');
  fire.append(el('span', 'gy-matchbox__spark'), motif('flame', 'gy-matchbox__flame', false));
  match.append(motif('match', 'gy-matchbox__stick', false), fire);
  tray.append(box, strip, match);

  let origin = null;      // pointer position when the match was picked up
  let head = null;        // offset from the pointer to the match's lit head
  let lastX = 0;
  let scrubbed = 0;

  const state = () => root.dataset.state;
  const setState = (next) => { root.dataset.state = next; };
  const say = (name) => root.dispatchEvent(new CustomEvent(name, { bubbles: true }));

  /* Put it back through the same property the drag writes, so a dropped match
     returns to exactly where the stylesheet had it. */
  const rest = () => { match.style.translate = ''; };

  /*
   * The clock. Each beat — the burn down to your fingers, the puff of smoke,
   * the scripted run — is drawn by a CSS animation and timed by this, and both
   * read the same custom property so the picture and the state cannot drift.
   *
   * Deliberately NOT driven by the animation itself. `animationend` and the
   * `finished` promise both need the page to be producing frames, and a page
   * that has stopped painting still runs script: a run started from the
   * keyboard reached the end of its travel with neither ever arriving, and the
   * match sat burning in mid-air forever. A timer keeps counting regardless.
   *
   * The isConnected guard is the other half of it. The panel throws its whole
   * contents away on every show(), so a beat can easily outlive the thing it
   * was counting for.
   */
  let ticking = 0;
  const beats = getComputedStyle(root);
  const beat = (name, then) => {
    clearTimeout(ticking);
    ticking = setTimeout(
      () => { if (root.isConnected) then(); },
      parseFloat(beats.getPropertyValue(name)) || 0
    );
  };

  function commit() {
    clearTimeout(ticking);
    light(project.slug);
    match.remove();
    box.remove();
    dressAsLit();
    status.textContent = `Candle lit for ${project.name}.`;
    say('gy:lit');
  }

  /* Guttered out, whether it burned down or was dropped mid-air: a puff of
     smoke, then a fresh one rolls in. Setting a new beat here also replaces the
     burn's, so the two can never race. */
  function spend() {
    setState('spent');
    beat('--gy-spend', () => {
      if (state() !== 'spent') return;
      setState('ready');
      rest();
    });
  }

  function strike() {
    setState('burning');
    status.textContent = 'Match struck — five seconds.';
    say('gy:strike');
    beat('--gy-burn', () => {
      if (state() !== 'burning') return;
      status.textContent = 'The match burned out. A fresh one.';
      spend();
    });
  }

  function drop() {
    if (state() === 'burning') spend();
    else if (state() === 'held') { setState('ready'); rest(); }
  }

  match.addEventListener('pointerdown', (event) => {
    if (state() !== 'ready') return;
    event.preventDefault();
    match.setPointerCapture(event.pointerId);
    origin = { x: event.clientX, y: event.clientY };
    const tip = anchor(match, HEAD_AT);
    head = { x: tip.x - event.clientX, y: tip.y - event.clientY };
    lastX = event.clientX;
    scrubbed = 0;
    setState('held');
  });

  match.addEventListener('pointermove', (event) => {
    const phase = state();
    if (phase !== 'held' && phase !== 'burning') return;
    match.style.translate = `${event.clientX - origin.x}px ${event.clientY - origin.y}px`;

    if (phase === 'held') {
      const face = strip.getBoundingClientRect();
      /*
       * Accumulate over the coalesced samples, not just the delivered event: a
       * quick flick — which is exactly how a match gets struck — can jump the
       * whole strip between two pointermove events, so the natural gesture was
       * the one that failed while a slow careful drag worked.
       */
      for (const sample of (event.getCoalescedEvents?.() ?? [event])) {
        const x = sample.clientX + head.x;
        const y = sample.clientY + head.y;
        const onFace = x > face.left - 10 && x < face.right + 10
          && y > face.top - 10 && y < face.bottom + 10;
        if (onFace) scrubbed += Math.abs(sample.clientX - lastX);
        lastX = sample.clientX;
      }
      if (scrubbed >= STRIKE_TRAVEL) strike();
      return;
    }

    const wick = anchor(candle, WICK_AT);
    const x = event.clientX + head.x;
    const y = event.clientY + head.y;
    if (Math.hypot(x - wick.x, y - wick.y) < WICK_REACH) commit();
  });

  match.addEventListener('pointerup', drop);
  match.addEventListener('pointercancel', drop);

  /*
   * Clicking the candle performs the ritual instead of demanding it. This is
   * the keyboard and touch path — the button is a real <button>, so Enter and
   * Space arrive here with no extra scaffolding — and it is also how the drag
   * gets discovered.
   */
  candle.addEventListener('click', () => {
    if (state() !== 'ready') return;
    setState('auto');
    say('gy:strike');
    beat('--gy-run', () => { if (state() === 'auto') commit(); });
  });

  return root;
}
