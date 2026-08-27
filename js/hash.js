/*
 * One stable hash, for every choice that has to survive a reload.
 * -----------------------------------------------------------------------
 * Nothing in this yard is random at runtime: a grave's column, its stone, its
 * tilt and the drift of its flame are all derived from its slug, so that
 * returning to a grave you remember is possible. Two modules need that — the
 * plot allocator and the pen that draws a marker — and they have to agree, so
 * the function lives apart from both rather than inside whichever one happened
 * to want it first.
 */

/* FNV-1a — small, fast, and stable across engines, which is the whole point. */
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
