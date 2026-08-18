/*
 * Doodle library access.
 * -----------------------------------------------------------------------
 * The .svg files in doodles/ are the single source of truth and are kept in
 * the Karakuli library contract (48x48, stroke-only, no pathLength) so they
 * can be contributed back to the kit unchanged. Everything this project needs
 * on top of that — pathLength for .krk-enter-draw, inlining so boil's
 * url(#krk-boil-N) filters can resolve — is added here at load time, the same
 * way the kit's own demo/motion.js does it.
 *
 * Doodles must be inlined, not <img src>: an external SVG document cannot
 * reference the boil filters, which live in the host page.
 */

const markup = new Map();

/** Fetch the named motifs once. Must resolve before any doodle() call. */
export async function loadDoodles(names, baseUrl) {
  await Promise.all(
    names.map(async (name) => {
      if (markup.has(name)) return;
      const res = await fetch(`${baseUrl}${name}.svg`);
      if (!res.ok) throw new Error(`doodle "${name}" missing (${res.status})`);
      markup.set(name, (await res.text()).replace(/<path /g, '<path pathLength="100" '));
    })
  );
}

/** A fresh, detached <svg> element for the named motif. */
export function doodle(name) {
  const source = markup.get(name);
  if (!source) throw new Error(`doodle "${name}" not loaded — add it to loadDoodles()`);
  const holder = document.createElement('template');
  holder.innerHTML = source.trim();
  return holder.content.firstElementChild.cloneNode(true);
}
