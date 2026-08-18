/*
 * The road down the middle of the cemetery.
 * -----------------------------------------------------------------------
 * A road hundreds of pixels long can't be a tiled sprite: repeat the same
 * wobble every 200px and the eye reads a texture, not a drawn line. So the
 * wander is generated once down the whole height, seeded so it is the same
 * road on every reload.
 *
 * In the flat style the road is a filled band rather than two rails, which
 * means the same generated wander has to be walkable backwards to close the
 * shape — hence the segment list rather than a path string.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const SEGMENT = 96;   // px between control points; shorter reads jittery, longer reads ruler-straight
const WANDER = 3.4;   // px the edge drifts either side of true
const WIDTH = 168;    // px of drawing space the road occupies
const HALF = 38;      // px from centre to each edge

function wobble(seed, i) {
  return Math.sin(seed + i * 1.7) * WANDER + Math.sin(seed * 3.1 + i * 0.6) * (WANDER * 0.45);
}

/* One edge as an ordered segment list, so it can be emitted in either
   direction. A path string can only be walked forwards. */
function edge(x, height, seed) {
  const steps = Math.max(2, Math.ceil(height / SEGMENT));
  const start = { x: x + wobble(seed, 0), y: 0 };
  const segs = [];
  for (let i = 1; i <= steps; i++) {
    const y = (height * i) / steps;
    const prevY = (height * (i - 1)) / steps;
    segs.push({
      c1: { x: x + wobble(seed, i - 0.66), y: prevY + SEGMENT / 3 },
      c2: { x: x + wobble(seed, i - 0.33), y: y - SEGMENT / 3 },
      p: { x: x + wobble(seed, i), y },
    });
  }
  return { start, segs };
}

const at = (pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;

const forward = ({ segs }) => segs.map((s) => `C${at(s.c1)} ${at(s.c2)} ${at(s.p)}`).join(' ');

/* Reversing a cubic means walking the segments backwards with each pair of
   control points swapped. */
function backward({ start, segs }) {
  const out = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const to = i === 0 ? start : segs[i - 1].p;
    out.push(`C${at(segs[i].c2)} ${at(segs[i].c1)} ${at(to)}`);
  }
  return out.join(' ');
}

/* Cross-strokes on the path, thinning as they recede up the road. */
function cobbles(height, seed) {
  const marks = [];
  for (let y = 150; y < height - 90; y += 78) {
    const drift = Math.sin(seed + y * 0.017) * 5;
    const half = 26 + Math.sin(seed * 2 + y * 0.03) * 7;
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
  if (className) el.setAttribute('class', className);
  return el;
}

/** The road as one inline <svg>, sized in real pixels so strokes don't distort. */
export function roadEl(height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'gy-road');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
  svg.setAttribute('width', WIDTH);
  svg.setAttribute('height', height);
  svg.setAttribute('aria-hidden', 'true');

  const left = edge(WIDTH / 2 - HALF, height, 1.7);
  const right = edge(WIDTH / 2 + HALF, height, 4.3);

  /* Down the left edge, across the bottom, back up the right, close. */
  const band = `M${at(left.start)} ${forward(left)}`
    + ` L${at(right.segs[right.segs.length - 1].p)}`
    + ` ${backward(right)} Z`;

  svg.appendChild(path(band, 'gy-road__band'));
  cobbles(height, 2.9).forEach((d) => svg.appendChild(path(d, 'gy-road__cobble')));

  return svg;
}

export const ROAD_WIDTH = WIDTH;
