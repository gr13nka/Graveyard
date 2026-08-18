/*
 * The candle you carry.
 * -----------------------------------------------------------------------
 * Replaces the pointer inside the graveyard with a lit candle. This module
 * owns the cursor *object* only — the pool of light it throws belongs to the
 * scene, in field coordinates, underneath the stones. A glow drawn up here
 * would paint over the graves it is supposed to be lighting.
 *
 * The flame trails the pointer slightly. A cursor welded to the exact pointer
 * position reads as a sticker; a little lag reads as something being carried.
 */

import { doodle } from './doodles.js';

const EASE = 0.24;      // how much of the remaining distance is closed per frame
const SETTLE = 0.4;     // px below which the chase stops, so rAF can idle

/**
 * Mount the candle inside `frame`. Returns { destroy } — the pointer handling
 * is scoped to the frame, so the panel keeps its native cursor.
 */
export function mountCandle(frame) {
  const el = document.createElement('div');
  el.className = 'gy-candle';
  el.setAttribute('aria-hidden', 'true');

  const glow = doodle('glow');
  glow.classList.add('gy-candle__glow');
  el.appendChild(glow);

  const wick = doodle('candle');
  /* Deliberately not boiled. It is the one element that moves every frame, so
     a per-frame filter re-rasterisation here is the most expensive it can be —
     and a boil nobody can see while the cursor is moving buys nothing. */
  wick.classList.add('gy-candle__body');
  el.appendChild(wick);

  frame.appendChild(el);

  let target = null;      // where the pointer is
  let at = null;          // where the flame has caught up to
  let frameId = 0;

  function step() {
    frameId = 0;
    if (!target) return;
    if (!at) at = { ...target };

    const dx = target.x - at.x;
    const dy = target.y - at.y;
    if (Math.abs(dx) < SETTLE && Math.abs(dy) < SETTLE) {
      at = { ...target };
    } else {
      at.x += dx * EASE;
      at.y += dy * EASE;
      frameId = requestAnimationFrame(step);
    }
    el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
  }

  function chase() {
    if (!frameId) frameId = requestAnimationFrame(step);
  }

  function onMove(event) {
    target = { x: event.clientX, y: event.clientY };
    if (!at) {
      /* First sighting: appear where the pointer already is rather than flying
         in from the last place it was seen. */
      at = { ...target };
      el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
    }
    el.classList.add('is-held');
    chase();
  }

  function onLeave() {
    el.classList.remove('is-held');
    target = null;
  }

  frame.addEventListener('pointermove', onMove);
  frame.addEventListener('pointerleave', onLeave);

  return {
    destroy() {
      cancelAnimationFrame(frameId);
      frame.removeEventListener('pointermove', onMove);
      frame.removeEventListener('pointerleave', onLeave);
      el.remove();
    },
  };
}
