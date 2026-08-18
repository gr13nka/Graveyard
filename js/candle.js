/*
 * The candle you carry.
 * -----------------------------------------------------------------------
 * Replaces the pointer inside the graveyard with a small lit candle.
 *
 * It tracks the pointer exactly, with no easing. An earlier version eased
 * toward the pointer to feel "carried" and just felt broken — a cursor is the
 * one element on a page that must never lag behind the hand moving it.
 *
 * The glow is CSS, not SVG. Drawing light as stroked blobs gave it a lumpy
 * edge that read as a smudge rather than a light; a radial falloff is the one
 * job gradients are actually for. This is a deliberate, noted exception to
 * Karakuli's no-gradients rule, confined to depicting light.
 */

import { doodle } from './doodles.js';

/** Mount the candle inside `frame`; pointer handling is scoped to it. */
export function mountCandle(frame) {
  const el = document.createElement('div');
  el.className = 'gy-candle';
  el.setAttribute('aria-hidden', 'true');

  const glow = document.createElement('span');
  glow.className = 'gy-candle__glow';
  el.appendChild(glow);

  const wick = doodle('candle');
  wick.classList.add('gy-candle__body');
  el.appendChild(wick);

  frame.appendChild(el);

  /* transform only — a compositor-level move, so tracking the pointer costs
     nothing per frame. */
  const onMove = (event) => {
    el.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    el.classList.add('is-held');
  };
  const onLeave = () => el.classList.remove('is-held');

  frame.addEventListener('pointermove', onMove);
  frame.addEventListener('pointerleave', onLeave);

  return {
    destroy() {
      frame.removeEventListener('pointermove', onMove);
      frame.removeEventListener('pointerleave', onLeave);
      el.remove();
    },
  };
}
