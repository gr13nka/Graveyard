/*
 * Karakuli — entrance-motion stagger helper
 * -----------------------------------------------------------------------
 * Pairs with web/anim.css's .krk-enter-* classes, which all read a single
 * --krk-enter-delay custom property for their animation-delay. This is
 * the one function that sets it — call it once per container after its
 * children exist, then let CSS custom-property inheritance carry the
 * delay down to whichever descendant actually carries the animation
 * class (a grid cell and the motif inside it, say).
 *
 * Usage:
 *   import { krkStagger } from './anim.js';
 *   krkStagger(grid);                                  // scatter, default pacing
 *   krkStagger(list, { mode: 'wave', step: 60 });       // sequential cascade
 */

export function krkStagger(container, { mode = 'scatter', step = 60, jitter = 0, spread = 450 } = {}) {
  const children = Array.from(container.children);
  children.forEach((el, i) => {
    const delayMs = mode === 'scatter'
      ? Math.random() * spread
      : i * step + (jitter > 0 ? Math.random() * jitter : 0);
    el.style.setProperty('--krk-enter-delay', `${delayMs.toFixed(1)}ms`);
  });
  return children;
}
