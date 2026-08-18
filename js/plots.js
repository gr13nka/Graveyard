/*
 * The plot allocator — where every grave stands.
 * -----------------------------------------------------------------------
 * A cemetery has to look scattered by hand but must not rearrange itself
 * between reloads, or returning to a grave you remember becomes impossible.
 * So every placement decision is derived from a hash of the project's slug:
 * same slug, same plot, forever, with no coordinates stored in the data file.
 *
 * Callers get {x, y, side, variant, size, motifs} and never need to know any
 * of the arithmetic below.
 */

import { MARKER_VARIANTS } from './marker.js';

/* Road position and the two fields either side of it, as % of scene width. */
const ROAD_X = 58;
const LEFT_FIELD = { min: 13, max: 45 };
const RIGHT_FIELD = { min: 70, max: 88 };

const ROW_HEIGHT = 156;   // px of vertical rhythm per grave
const ROW_JITTER = 62;    // px of wander around that rhythm
const TOP_MARGIN = 420;   // px of empty sky before the first grave

const AMBIENT = ['tree', 'flower-daisy', 'sprout', 'leaf', 'fence-post'];

/* FNV-1a — small, fast, and stable across engines, which is the whole point. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* A stable 0..1 for the nth independent decision about one slug. */
function roll(slug, n) {
  return (hash(`${slug}#${n}`) % 10000) / 10000;
}

const lerp = (a, b, t) => a + (b - a) * t;

/*
 * Sides come from the hash, but a hash will happily put five graves in a row
 * on one side and leave the other empty. Forcing a switch after two keeps the
 * scatter honest without making it alternate mechanically.
 */
function chooseSide(slug, index, recent) {
  const natural = roll(slug, 1) < 0.5 ? 'left' : 'right';
  if (recent.length >= 2 && recent[0] === recent[1] && recent[0] === natural) {
    return natural === 'left' ? 'right' : 'left';
  }
  return natural;
}

/**
 * Lay out the whole cemetery. Newest death nearest the top — you walk in from
 * the fresh graves and back through time.
 */
export function layOutGraveyard(projects) {
  const buried = [...projects].sort((a, b) => String(b.died).localeCompare(String(a.died)));
  const recent = [];

  const plots = buried.map((project, index) => {
    const slug = project.slug;
    const side = chooseSide(slug, index, recent);
    recent.unshift(side);
    recent.length = 2;

    const field = side === 'left' ? LEFT_FIELD : RIGHT_FIELD;
    const variant = project.marker && MARKER_VARIANTS.includes(project.marker)
      ? project.marker
      : MARKER_VARIANTS[hash(slug) % MARKER_VARIANTS.length];

    return {
      project,
      side,
      variant,
      x: lerp(field.min, field.max, roll(slug, 2)),
      y: TOP_MARGIN + index * ROW_HEIGHT + (roll(slug, 3) - 0.5) * ROW_JITTER,
      size: Math.round(lerp(132, 190, roll(slug, 4))),
      tilt: lerp(-4.5, 4.5, roll(slug, 5)),
      motifs: ambientFor(slug, side),
    };
  });

  const height = TOP_MARGIN + buried.length * ROW_HEIGHT + 260;
  const milestones = milestonesFor(plots);

  return {
    plots,
    roadX: ROAD_X,
    height,
    milestones,
    lamps: lampsAlong(plots, height, milestones),
  };
}

/*
 * Lanterns down the road.
 * -----------------------------------------------------------------------
 * These are the scene's only warm light, and they do two jobs at once: they
 * give the eye somewhere to land in a field where every grave is drawn at the
 * same weight, and they mark the path so scrolling has a rhythm instead of
 * being an undifferentiated dark column. Spacing is deliberately looser than
 * the graves — light you pass every few steps reads as a path; light beside
 * every grave reads as decoration.
 */
function lampsAlong(plots, height, milestones) {
  const lamps = [];
  for (let i = 0; i < plots.length; i += 2) {
    const here = plots[i];
    const next = plots[i + 1];
    lamps.push({
      /* Between two graves, not beside one — a lamp level with a headstone
         reads as belonging to it, and lights the wrong thing. */
      y: next ? (here.y + next.y) / 2 : here.y + ROW_HEIGHT / 2,
      /* Inside the rails. The verge is only ~3% wide between the road and
         the grave fields, so a lamp placed there lands on somebody's name.
         Standing them on the path itself is both clear of everything and
         what a lit path actually looks like. */
      x: ROAD_X + (i % 4 === 0 ? -5.5 : 5.5),
      size: 54,
    });
  }
  /* Both stand in the road, so a lamp landing on a year marker covers the one
     thing that says where you are. The marker wins — but the lamp steps aside
     rather than being dropped: deleting it would thin the warm rhythm to
     nothing exactly where the yard changes year. */
  const CLEARANCE = 74;
  lamps.forEach((lamp) => {
    milestones.forEach((mark) => {
      const gap = lamp.y - mark.y;
      if (Math.abs(gap) <= CLEARANCE) {
        lamp.y = mark.y + (gap >= 0 ? CLEARANCE + 12 : -(CLEARANCE + 12));
      }
    });
  });

  return lamps.filter((lamp) => lamp.y > 120 && lamp.y < height - 80);
}

/*
 * A year marker wherever the year changes as you walk down. The yard is
 * ordered by date of death, and without these that ordering is invisible —
 * which is most of why an undifferentiated column is hard to navigate.
 */
function milestonesFor(plots) {
  const marks = [];
  let last = null;
  plots.forEach((plot) => {
    const year = String(plot.project.died).slice(0, 4);
    if (year === last) return;
    last = year;
    marks.push({ year, y: plot.y - 96 });
  });
  return marks;
}

/* One or two bits of undergrowth per grave, on the far side from the road. */
function ambientFor(slug, side) {
  const count = roll(slug, 6) < 0.45 ? 2 : 1;
  const outward = side === 'left' ? -1 : 1;
  return Array.from({ length: count }, (_, i) => ({
    name: AMBIENT[hash(`${slug}~${i}`) % AMBIENT.length],
    /* Pushed away from the road so undergrowth frames the grave instead of
       growing through it. */
    dx: Math.round(outward * lerp(58, 104, roll(slug, 10 + i))),
    dy: Math.round(lerp(-18, 26, roll(slug, 20 + i))),
    size: Math.round(lerp(34, 62, roll(slug, 30 + i))),
  }));
}
