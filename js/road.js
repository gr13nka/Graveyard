/*
 * The road down the middle of the cemetery.
 * -----------------------------------------------------------------------
 * A road hundreds of pixels long can't be a tiled sprite: repeat the same
 * wobble every 200px and the eye reads a texture, not a drawn line. So the
 * path is generated once, wandering the whole height, with the wander seeded
 * so it is the same road on every reload.
 *
 * Same pen contract as the doodles — stroke-only, currentColor, round caps —
 * which is also what lets it take the boil filter along with everything else.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const SEGMENT = 96;   // px between control points; shorter reads jittery, longer reads ruler-straight
const WANDER = 3.4;   // px the rail drifts either side of true
const WIDTH = 168;    // px of drawing space the road occupies

function wobble(seed, i) {
  return Math.sin(seed + i * 1.7) * WANDER + Math.sin(seed * 3.1 + i * 0.6) * (WANDER * 0.45);
}

function rail(x, height, seed) {
  const steps = Math.max(2, Math.ceil(height / SEGMENT));
  let d = `M${(x + wobble(seed, 0)).toFixed(1)},0`;
  for (let i = 1; i <= steps; i++) {
    const y = (height * i) / steps;
    const prevY = (height * (i - 1)) / steps;
    const cx1 = x + wobble(seed, i - 0.66);
    const cx2 = x + wobble(seed, i - 0.33);
    const px = x + wobble(seed, i);
    d += ` C${cx1.toFixed(1)},${(prevY + SEGMENT / 3).toFixed(1)}`
      + ` ${cx2.toFixed(1)},${(y - SEGMENT / 3).toFixed(1)}`
      + ` ${px.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

/* Cobbles: short cross-strokes, thinning as they recede up the road. */
function cobbles(height, seed) {
  const marks = [];
  for (let y = 140; y < height - 80; y += 74) {
    const drift = Math.sin(seed + y * 0.017) * 5;
    const half = 30 + Math.sin(seed * 2 + y * 0.03) * 8;
    marks.push(
      `M${(WIDTH / 2 - half + drift).toFixed(1)},${y.toFixed(1)}`
      + ` C${(WIDTH / 2 - half / 3 + drift).toFixed(1)},${(y - 2.5).toFixed(1)}`
      + ` ${(WIDTH / 2 + half / 3 + drift).toFixed(1)},${(y + 2.5).toFixed(1)}`
      + ` ${(WIDTH / 2 + half + drift).toFixed(1)},${y.toFixed(1)}`
    );
  }
  return marks;
}

function path(d, className) {
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  el.setAttribute('pathLength', '100');
  if (className) el.setAttribute('class', className);
  return el;
}

/** The full road as one inline <svg>, sized in real pixels so strokes don't distort. */
export function roadEl(height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'gy-road krk-boil');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
  svg.setAttribute('width', WIDTH);
  svg.setAttribute('height', height);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  svg.appendChild(path(rail(WIDTH / 2 - 38, height, 1.7)));
  svg.appendChild(path(rail(WIDTH / 2 + 38, height, 4.3)));
  cobbles(height, 2.9).forEach((d) => svg.appendChild(path(d, 'gy-road__cobble')));

  return svg;
}

export const ROAD_WIDTH = WIDTH;
