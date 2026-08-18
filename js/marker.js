/*
 * The pen that draws one grave.
 * -----------------------------------------------------------------------
 * Callers ask for "a cross that says 2023–2025" and get a focusable element
 * back. Everything else — which motif file that maps to, where the dates sit
 * on that particular stone's face, how the engraving is sized so it stays
 * inside the carved area, boil wiring — is this module's business.
 */

import { doodle } from './doodles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/*
 * Where the dates are carved, per marker, in the motif's own 48x48 coordinate
 * space: x/y is the baseline of the first line, gap the leading. These are
 * eyeballed against each drawing's carved face — a cross has no face, so its
 * dates sit just under the crossbar, and a mound's go on its little plaque.
 */
const ENGRAVING = {
  'headstone-round': { x: 24.0, y: 25.4, size: 5.6, gap: 6.2, lines: 2 },
  'headstone-cross': { x: 24.0, y: 34.4, size: 4.6, gap: 5.0, lines: 2 },
  obelisk:           { x: 24.0, y: 34.2, size: 4.1, gap: 0,   lines: 1 },
  urn:               { x: 24.0, y: 29.6, size: 4.0, gap: 0,   lines: 1 },
  mound:             { x: 24.0, y: 24.0, size: 4.2, gap: 4.7, lines: 2 },
};

export const MARKER_VARIANTS = Object.keys(ENGRAVING);

const year = (iso) => (iso ? String(iso).slice(0, 4) : '');

/*
 * A project that was born and died in the same year gets one line, the way a
 * headstone for a short life does — two identical years read as a mistake.
 */
function engravedYears(born, died) {
  const from = year(born);
  const to = year(died);
  if (!from || from === to) return [to || from];
  return [from, to];
}

function engrave(svg, variant, born, died) {
  const spot = ENGRAVING[variant];
  if (!spot) return;
  /* An obelisk and an urn are too narrow to carry a lifespan legibly, so they
     get the year that matters — the one it died. */
  const years = engravedYears(born, died);
  const carved = spot.lines === 1 ? [years[years.length - 1]] : years;
  carved.forEach((line, i) => {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', spot.x);
    text.setAttribute('y', spot.y + i * spot.gap);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', spot.size);
    text.setAttribute('class', 'gy-engraving');
    text.textContent = line;
    svg.appendChild(text);
  });
}

/**
 * One grave marker, ready to place. Returns a <button> so it is reachable by
 * Tab and Enter without any extra ARIA scaffolding.
 */
export function markerEl(variant, { name, born, died }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gy-marker';
  button.setAttribute('aria-label', `${name}, ${engravedYears(born, died).join('–')}`);

  const svg = doodle(variant);
  svg.classList.add('krk-boil', 'gy-marker__stone');
  engrave(svg, variant, born, died);
  button.appendChild(svg);

  /* The candle only exists while this grave is the selected one — it is the
     colour moment, and it sprouts rather than fades in. */
  const flame = doodle('candle');
  flame.classList.add('gy-marker__candle', 'krk-boil');
  button.appendChild(flame);

  const label = document.createElement('span');
  label.className = 'gy-marker__name krk-hand';
  label.textContent = name;
  button.appendChild(label);

  return button;
}
