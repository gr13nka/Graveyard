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

import { markerVariantsFor } from './marker.js';

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
 * One block's shape: how many rows, and which of its slots are actually
 * occupied. Slots are dropped rather than never created so the survivors keep
 * their column alignment — a block with a hole in it still lines up, which is
 * exactly what a real plot looks like.
 *
 * Which side it stands on is decided by the caller now, not here: the side
 * carries meaning, and only the caller knows whose graves these are.
 */
function blockShape(side, ordinal) {
  const field = side === 'left' ? LEFT_FIELD : RIGHT_FIELD;
  /* Keyed by side as well as position, or the two fields get the same run of
     shapes stamped down them in parallel. */
  const key = `${side}${ordinal}`;
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

/* A grave with no kind is a repo: every grave buried from one omits the key. */
const kindOf = (project) => project.kind ?? 'project';

/* Newest death nearest the top — you walk in from the fresh graves and back
   through time. */
const newestFirst = (a, b) => String(b.died).localeCompare(String(a.died));

/*
 * Pack graves into a run of blocks down the field.
 *
 * `sideAt` is the only thing separating the two yards this lays out: give
 * every block the same side and one kind fills one field; alternate, and a
 * single kind uses both. One packer either way — the split is a choice of
 * side, not a second layout that would have to be kept in step with this one.
 */
function packBlocks(buried, sideAt) {
  const plots = [];
  const blocks = [];
  let placed = 0;
  let ordinal = 0;
  let cursorY = TOP_MARGIN;

  while (placed < buried.length) {
    const side = sideAt(ordinal);
    const shape = blockShape(side, ordinal);
    const take = Math.min(shape.filled.length, buried.length - placed);
    /* The block only occupies the rows it actually uses, so a half-empty
       block doesn't leave a gap the size of a full one. */
    const usedRows = Math.max(...shape.filled.slice(0, take).map((s) => s.row)) + 1;
    const originY = cursorY + (usedRows - 1) * ROW_STEP;
    const index = blocks.length;

    blocks.push({ index, side, topY: cursorY, originY, count: take });

    for (let i = 0; i < take; i++) {
      const slot = shape.filled[i];
      const project = buried[placed + i];
      const slug = project.slug;

      /* Row 0 is the back row: further away, so smaller and painted behind. */
      const depth = shape.rows - 1 - slot.row;
      const scale = lerp(BACK_SCALE, 1, shape.rows === 1 ? 1 : slot.row / (shape.rows - 1));

      /* Only the markers its kind may stand under: a marker naming one from
         the other pool falls back to the hash, exactly as a typo does. */
      const variants = markerVariantsFor(project.kind);
      const variant = variants.includes(project.marker)
        ? project.marker
        : variants[hash(slug) % variants.length];

      plots.push({
        project,
        variant,
        kind: kindOf(project),
        side,
        block: index,
        /* Columns share an x — the alignment is the whole effect — and only
           then get a few pixels of wander so nothing looks stamped. */
        x: shape.originX + slot.col * COL_STEP + (roll(slug, 2) - 0.5) * 1.2,
        y: originY - (shape.rows - 1 - slot.row) * ROW_STEP + (roll(slug, 3) - 0.5) * 10,
        size: Math.round(lerp(112, 146, roll(slug, 4)) * scale),
        depth,
        tilt: lerp(-4, 4, roll(slug, 5)),
        /* Phase for anything that loops at this grave — today, the flicker of
           a candle somebody lit. Hashed like everything else here, so eight
           flames drift apart without the yard becoming random at runtime. */
        seed: roll(slug, 7),
        motifs: ambientFor(slug, side),
      });
    }

    placed += take;
    cursorY = originY + BLOCK_GAP;
    ordinal += 1;
  }

  return { plots, blocks, height: cursorY + 220 };
}

/*
 * Where a ground's header stands: centred over the field its graves occupy, in
 * the empty sky above the first block.
 */
function groundOver(kind, field, graves) {
  const years = graves.map((grave) => String(grave.died).slice(0, 4)).sort();
  return {
    kind,
    x: (field.min + field.max) / 2,
    y: TOP_MARGIN - 108,
    count: graves.length,
    from: years[0],
    to: years[years.length - 1],
  };
}

/**
 * Lay out the whole cemetery.
 *
 * The road divides the two kinds rather than just running between them: repos
 * stand in the left field, ideas in the right. The marker pools already say
 * which is which — a repo takes a headstone, an idea a cairn — and this puts
 * that same distinction somewhere you can read from the gate, instead of
 * leaving the two interleaved down one date-ordered column.
 */
export function layOutGraveyard(projects) {
  const repos = projects.filter((project) => kindOf(project) === 'project').sort(newestFirst);
  const ideas = projects.filter((project) => kindOf(project) === 'idea').sort(newestFirst);

  /* Both fields need something to stand in them. A fork holding only repos —
     which is every fork on its first day — gets the older yard, alternating
     down both fields, rather than one half left as empty ground. */
  if (!repos.length || !ideas.length) {
    const only = packBlocks([...projects].sort(newestFirst),
      (ordinal) => (ordinal % 2 === 0 ? 'left' : 'right'));
    return assemble([only], only, []);
  }

  const left = packBlocks(repos, () => 'left');
  const right = packBlocks(ideas, () => 'right');
  return assemble([left, right], left, [
    groundOver('project', LEFT_FIELD, repos),
    groundOver('idea', RIGHT_FIELD, ideas),
  ]);
}

/*
 * Join the runs into one scene.
 *
 * `timeline` is the run the year markers follow. They say where a year begins
 * as you walk down the road, and the two sides run to different clocks: the
 * repos span years, while every idea here was filtered inside a fortnight. One
 * road cannot carry both sets without them contradicting each other, so it
 * carries the repos'.
 */
function assemble(runs, timeline, grounds) {
  const height = Math.max(...runs.map((run) => run.height));
  const milestones = milestonesFor(timeline.plots, timeline.blocks);
  return {
    plots: runs.flatMap((run) => run.plots),
    roadX: ROAD_X,
    height,
    grounds,
    milestones,
    lamps: lampsAlong(height, milestones),
  };
}

/*
 * Lanterns down the road.
 * -----------------------------------------------------------------------
 * These are the scene's only ambient warm light, and they do two jobs: they
 * give the eye somewhere to land, and they mark the path so scrolling has a
 * rhythm instead of being an undifferentiated dark column.
 *
 * They used to stand in the gaps between blocks, which was a way of saying
 * "not beside a grave" back when blocks alternated sides and the road had
 * plots against it only every other block. Now that each field is a kind, the
 * road has graves along both sides for its whole length and there are no gaps
 * left to find — following the old rule put a single lantern in the entire
 * yard. So the rhythm is now the road's own: evenly spaced, the way a lit path
 * actually is, and stepped aside where a year marker already stands.
 */
const LAMP_STEP = 360;   // px between lanterns; ~2.5 rows, so one per stretch of graves

function lampsAlong(height, milestones) {
  const lamps = [];
  for (let y = TOP_MARGIN - 20; y < height - 120; y += LAMP_STEP) {
    lamps.push({
      y,
      /* Inside the rails. The verge between road and grave field is only a few
         percent wide, so a lamp placed there lands on somebody's name.
         Standing them on the path is both clear of everything and what a lit
         path actually looks like. */
      x: ROAD_X + (lamps.length % 2 === 0 ? -5.5 : 5.5),
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
