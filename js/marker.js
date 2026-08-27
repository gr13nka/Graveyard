/*
 * The pen that draws one grave.
 * -----------------------------------------------------------------------
 * Callers ask for "a cross that says 2023–2025" and get a focusable element
 * back. Everything else — which motif file that maps to, where the dates sit
 * on that particular stone's face, how the engraving is sized so it stays
 * inside the carved area, boil wiring — is this module's business.
 */

import { doodle } from './doodles.js';
import { hash } from './hash.js';

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
  cairn:             { x: 24.0, y: 37.9, size: 4.4, gap: 0,   lines: 1 },
  stake:             { x: 24.0, y: 31.8, size: 4.1, gap: 0,   lines: 1 },
};

/*
 * Which markers a kind of grave may stand under. A project lived and stopped;
 * an idea was filtered before anything was built, and giving it a headstone
 * would claim a life it never had. The two pools do not overlap, and that is
 * the whole point of them.
 *
 * Both of the unbuilt's markers carry one line: they are narrow, and an idea
 * has only ever got the one date anyway.
 *
 * Every name here needs an ENGRAVING entry above and a motif in index.html's
 * MOTIFS. Missing the first carves no dates; missing the second throws.
 */
const VARIANTS_BY_KIND = {
  project: ['headstone-round', 'headstone-cross', 'obelisk', 'urn', 'mound'],
  idea: ['cairn', 'stake'],
};

/** The markers open to a grave of this kind. Unknown kinds are projects. */
export function markerVariantsFor(kind) {
  return VARIANTS_BY_KIND[kind] || VARIANTS_BY_KIND.project;
}

/**
 * The marker one grave stands under: the one it names, if its kind may take
 * it, and otherwise one picked from its slug and kept for good.
 *
 * The yard draws this stone and so does the epitaph panel, and a grave showing
 * a cross on the ground and an urn in the panel reads as two graves. So there
 * is one answer to the question and both of them ask it here.
 *
 * A marker naming the other kind's pool falls back to the hash, exactly as a
 * typo does: the pools not overlapping is the constraint, not an oversight.
 */
export function markerFor(project) {
  const variants = markerVariantsFor(project.kind);
  return variants.includes(project.marker)
    ? project.marker
    : variants[hash(project.slug) % variants.length];
}

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

  /*
   * The shadow this grave throws when another one is lit near it. It is a
   * ground blob rather than the marker's own silhouette because these motifs
   * are stroke-only — headstone-cross in particular is separate open strokes
   * with no fillable area, so there is nothing to cast. One blob works for
   * every variant. Invisible until --gy-lit rises above zero.
   */
  const cast = doodle('shadow-blob');
  cast.classList.add('gy-marker__cast');
  cast.setAttribute('aria-hidden', 'true');
  button.appendChild(cast);

  const svg = doodle(variant);
  svg.classList.add('krk-boil', 'gy-marker__stone');
  engrave(svg, variant, born, died);
  button.appendChild(svg);

  /*
   * The candle burns only where somebody lit one, and it sprouts rather than
   * fades in. It carries no boil: it flickers already, and a boil filter that
   * never stops — on however many graves hold a vigil — is the one cost this
   * scene has actually been measured to care about.
   */
  const candle = doodle('candle');
  candle.classList.add('gy-marker__candle');
  candle.setAttribute('aria-hidden', 'true');
  button.appendChild(candle);

  const flame = document.createElement('span');
  flame.className = 'gy-marker__flame';
  flame.setAttribute('aria-hidden', 'true');
  button.appendChild(flame);

  const label = document.createElement('span');
  label.className = 'gy-marker__name krk-hand';
  label.textContent = name;
  button.appendChild(label);

  return button;
}
