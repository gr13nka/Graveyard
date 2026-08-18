/*
 * The plot allocator — where every grave stands.
 * -----------------------------------------------------------------------
 * A churchyard is not a scatter and not a spreadsheet. Graves come in blocks:
 * a handful of aligned columns, a couple of rows deep, with gaps where nobody
 * was ever buried. The alignment inside a block is what reads as "somebody
 * laid this out"; the gaps and the tilt are what stop it reading as a grid.
 *
 * Every placement decision derives from a hash — of the project's slug for
 * per-grave choices, of the block index for the block's own shape — so the
 * yard never rearranges between reloads. Returning to a grave you remember
 * has to be possible.
 *
 * Callers get plots with {x, y, size, depth, variant, motifs} and never need
 * to know any of the arithmetic below.
 */

import { MARKER_VARIANTS } from './marker.js';

/* Road position and the two fields either side of it, as % of scene width. */
const ROAD_X = 58;
const LEFT_FIELD = { min: 9, max: 47, cols: 3 };
const RIGHT_FIELD = { min: 68, max: 92, cols: 2 };

const COL_STEP = 13.5;    // % of scene width between columns in a block
const ROW_STEP = 138;     // px between rows in a block; must clear a marker's height
const BLOCK_GAP = 104;    // px of empty ground between blocks
const TOP_MARGIN = 420;   // px of empty sky before the first block

const FILL_RATE = 0.7;    // share of slots in a block that hold a grave
const BACK_SCALE = 0.82;  // how much smaller the furthest row renders

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

/* A stable 0..1 for the nth independent decision about one key. */
function roll(key, n) {
  return (hash(`${key}#${n}`) % 10000) / 10000;
}

const lerp = (a, b, t) => a + (b - a) * t;

/*
 * One block's shape: which side of the road, how many rows, and which of its
 * slots are actually occupied. Slots are dropped rather than never created so
 * the survivors keep their column alignment — a block with a hole in it still
 * lines up, which is exactly what a real plot looks like.
 */
function blockShape(index) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const field = side === 'left' ? LEFT_FIELD : RIGHT_FIELD;
  const key = `block${index}`;
  const rows = roll(key, 1) < 0.5 ? 2 : 3;

  const slots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < field.cols; col++) slots.push({ row, col });
  }

  const kept = slots.filter((_, i) => roll(key, 10 + i) < FILL_RATE);
  /* A block of one is a stray, not a plot. */
  const filled = kept.length >= 2 ? kept : slots.slice(0, 2);

  /* How far the whole block sits from the road-side edge of its field. */
  const span = (field.cols - 1) * COL_STEP;
  const originX = lerp(field.min, Math.max(field.min, field.max - span), roll(key, 2));

  return { side, field, rows, filled, originX };
}

/**
 * Lay out the whole cemetery. Newest death nearest the top — you walk in from
 * the fresh graves and back through time.
 */
export function layOutGraveyard(projects) {
  const buried = [...projects].sort((a, b) => String(b.died).localeCompare(String(a.died)));

  const plots = [];
  const blocks = [];
  let placed = 0;
  let blockIndex = 0;
  let cursorY = TOP_MARGIN;

  while (placed < buried.length) {
    const shape = blockShape(blockIndex);
    const take = Math.min(shape.filled.length, buried.length - placed);
    /* The block only occupies the rows it actually uses, so a half-empty
       block doesn't leave a gap the size of a full one. */
    const usedRows = Math.max(...shape.filled.slice(0, take).map((s) => s.row)) + 1;
    const originY = cursorY + (usedRows - 1) * ROW_STEP;

    blocks.push({ index: blockIndex, side: shape.side, topY: cursorY, originY, count: take });

    for (let i = 0; i < take; i++) {
      const slot = shape.filled[i];
      const project = buried[placed + i];
      const slug = project.slug;

      /* Row 0 is the back row: further away, so smaller and painted behind. */
      const depth = shape.rows - 1 - slot.row;
      const scale = lerp(BACK_SCALE, 1, shape.rows === 1 ? 1 : slot.row / (shape.rows - 1));

      const variant = project.marker && MARKER_VARIANTS.includes(project.marker)
        ? project.marker
        : MARKER_VARIANTS[hash(slug) % MARKER_VARIANTS.length];

      plots.push({
        project,
        variant,
        side: shape.side,
        block: blockIndex,
        /* Columns share an x — the alignment is the whole effect — and only
           then get a few pixels of wander so nothing looks stamped. */
        x: shape.originX + slot.col * COL_STEP + (roll(slug, 2) - 0.5) * 1.2,
        y: originY - (shape.rows - 1 - slot.row) * ROW_STEP + (roll(slug, 3) - 0.5) * 10,
        size: Math.round(lerp(112, 146, roll(slug, 4)) * scale),
        depth,
        tilt: lerp(-4, 4, roll(slug, 5)),
        motifs: ambientFor(slug, shape.side),
      });
    }

    placed += take;
    cursorY = originY + BLOCK_GAP;
    blockIndex += 1;
  }

  const height = cursorY + 220;
  const milestones = milestonesFor(plots, blocks);

  return {
    plots,
    blocks,
    roadX: ROAD_X,
    height,
    milestones,
    lamps: lampsBetween(blocks, height, milestones),
  };
}

/*
 * Lanterns down the road.
 * -----------------------------------------------------------------------
 * These are the scene's only ambient warm light, and they do two jobs: they
 * give the eye somewhere to land, and they mark the path so scrolling has a
 * rhythm instead of being an undifferentiated dark column. One between each
 * pair of blocks — light you pass between plots reads as a path; light beside
 * every grave reads as decoration.
 */
function lampsBetween(blocks, height, milestones) {
  const lamps = blocks.slice(0, -1).map((block, i) => ({
    y: (block.originY + blocks[i + 1].topY) / 2 + 30,
    /* Inside the rails. The verge between road and grave field is only a few
       percent wide, so a lamp placed there lands on somebody's name.
       Standing them on the path is both clear of everything and what a lit
       path actually looks like. */
    x: ROAD_X + (i % 2 === 0 ? -5.5 : 5.5),
    size: 54,
  }));

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
 * A year marker wherever the year changes as you walk down, placed above the
 * block that year starts in rather than beside one grave — a marker floating
 * mid-block reads as belonging to a stone instead of to a stretch of the yard.
 */
function milestonesFor(plots, blocks) {
  const marks = [];
  const claimed = new Set();
  let last = null;

  plots.forEach((plot) => {
    const year = String(plot.project.died).slice(0, 4);
    if (year === last) return;
    last = year;

    /* A year that starts a block gets the tidy spot above it. A year that
       starts partway through a block still gets a marker, beside the grave
       it starts at — dropping it would hide a whole year of the yard, which
       is the opposite of what these are for. */
    const atBlockTop = !claimed.has(plot.block);
    claimed.add(plot.block);
    marks.push({ year, y: atBlockTop ? blocks[plot.block].topY - 78 : plot.y - 34 });
  });

  /* Two markers close together read as one smudge. Push later ones down. */
  const MIN_GAP = 96;
  for (let i = 1; i < marks.length; i++) {
    const gap = marks[i].y - marks[i - 1].y;
    if (gap < MIN_GAP) marks[i].y = marks[i - 1].y + MIN_GAP;
  }

  return marks;
}

/* One or two bits of undergrowth per grave, on the far side from the road. */
function ambientFor(slug, side) {
  const count = roll(slug, 6) < 0.35 ? 2 : 1;
  const outward = side === 'left' ? -1 : 1;
  return Array.from({ length: count }, (_, i) => ({
    name: AMBIENT[hash(`${slug}~${i}`) % AMBIENT.length],
    dx: Math.round(outward * lerp(44, 72, roll(slug, 10 + i))),
    dy: Math.round(lerp(-10, 18, roll(slug, 20 + i))),
    size: Math.round(lerp(26, 44, roll(slug, 30 + i))),
  }));
}
