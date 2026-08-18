/*
 * Karakuli — "boil" filter defs
 * -----------------------------------------------------------------------
 * Injects one hidden inline <svg> holding the SVG filters that make an
 * illustration look hand-redrawn each frame ("boil" is the traditional
 * animation term for that per-frame line jitter): three near-identical
 * feTurbulence + feDisplacementMap filters (different noise seeds, same
 * wobble strength) that boil.css cycles between on a stepped animation,
 * plus a finer, higher-frequency #krk-crayon filter for grain on hero
 * strokes.
 *
 * Usage: load this module once per page (or call injectBoilFilters()
 * yourself), then:
 *   - add class="krk-boil" to any inline SVG illustration to make it live
 *   - add class="krk-crayon" for a static grain pass on hero strokes
 * The animation/class rules live in web/boil.css and require these defs
 * to exist — load both, in either order.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOIL_SEEDS = { 'krk-boil-1': 2, 'krk-boil-2': 7, 'krk-boil-3': 13 };

function wobbleFilter(id, seed) {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);

  const turbulence = document.createElementNS(SVG_NS, 'feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.012 0.016');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', String(seed));

  const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displace.setAttribute('in', 'SourceGraphic');
  displace.setAttribute('scale', '2.4');

  filter.append(turbulence, displace);
  return filter;
}

function crayonFilter() {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', 'krk-crayon');

  const turbulence = document.createElementNS(SVG_NS, 'feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.9');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', '5');

  const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displace.setAttribute('in', 'SourceGraphic');
  displace.setAttribute('scale', '1.4');

  filter.append(turbulence, displace);
  return filter;
}

export function injectBoilFilters() {
  if (document.getElementById('krk-boil-defs')) return;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('id', 'krk-boil-defs');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.overflow = 'hidden';

  const defs = document.createElementNS(SVG_NS, 'defs');
  for (const [id, seed] of Object.entries(BOIL_SEEDS)) defs.append(wobbleFilter(id, seed));
  defs.append(crayonFilter());
  svg.append(defs);

  document.body.append(svg);
}

document.addEventListener('DOMContentLoaded', injectBoilFilters);

if (typeof window !== 'undefined') {
  window.karakuliBoil = { injectBoilFilters };
}
