/*
 * The scrollable cemetery.
 * -----------------------------------------------------------------------
 * Owns the scroll column, the road, the sky, the way back to the gate, and
 * which grave is currently lit. Callers hand it plots and a callback and get
 * back a way to select a grave; they never touch a marker, an observer, or a
 * transform.
 *
 * The root element is turned into a frame holding a separate inner scroller,
 * so the gate button can sit still while the cemetery moves past it.
 *
 * Entrance doctrine (STYLE.md §6): graves are a doodle field, so they arrive
 * as one scattered burst rather than a sweep, and only on first reveal —
 * scrolling back up must not replay them.
 */

import { doodle } from './doodles.js';
import { markerEl } from './marker.js';
import { isLit, subscribe } from './vigil.js';
import { roadEl, ROAD_WIDTH } from './road.js';
import { krkStagger } from '../vendor/karakuli/anim.js';

const SKY = [
  { name: 'moon', x: 76, y: 74, size: 88 },
  { name: 'star', x: 17, y: 108, size: 32 },
  { name: 'star', x: 38, y: 52, size: 24 },
  { name: 'star', x: 91, y: 168, size: 28 },
  { name: 'star', x: 62, y: 206, size: 20 },
  { name: 'cloud', x: 27, y: 186, size: 70 },
  { name: 'spark', x: 52, y: 128, size: 26 },
  { name: 'spark', x: 86, y: 44, size: 20 },
];

function ambientEl({ name, size }) {
  const holder = document.createElement('span');
  holder.className = 'gy-ambient';
  holder.style.setProperty('--gy-size', `${size}px`);
  const svg = doodle(name);
  svg.classList.add('krk-boil');
  holder.appendChild(svg);
  return holder;
}

/**
 * Build the cemetery into `root`.
 * @returns {{select: (slug: string|null) => void, scrollHome: () => void}}
 */
export function mountScene(root, layout, { onSelect, heading, groundLabels = {} } = {}) {
  const { plots, roadX, height, lamps = [], milestones = [], grounds = [] } = layout;

  /* How far each light reaches, in px. Bounded on purpose: a falloff that
     never reaches zero is a global tint, not a light. The carried candle is
     the smaller of the two — it is one flame, not a standing memorial. */
  const LIGHT_RADIUS = 460;
  const CANDLE_RADIUS = 330;
  /* A votive standing on the ground is the smallest light in the yard, and has
     to stay legibly under the one you get for picking a grave. The falloff is
     linear, so at 260 a neighbour one ROW_STEP away takes ~0.5 where the
     selected grave would give it 0.7 — "somebody lit a candle over there"
     rather than "this is the grave you are standing at". */
  const VIGIL_RADIUS = 260;
  const LIGHT_STEPS = 10;   // how many discrete brightness levels a stone can take

  root.classList.add('gy-frame');
  root.innerHTML = '';

  const scroller = document.createElement('div');
  scroller.className = 'gy-scene';
  root.appendChild(scroller);

  const field = document.createElement('div');
  field.className = 'gy-field';
  field.style.height = `${height}px`;
  scroller.appendChild(field);

  const sky = document.createElement('div');
  sky.className = 'gy-sky';
  SKY.forEach((body) => {
    const holder = ambientEl(body);
    holder.classList.add('krk-enter-sprout');
    holder.style.left = `${body.x}%`;
    holder.style.top = `${body.y}px`;
    sky.appendChild(holder);
  });
  field.appendChild(sky);
  krkStagger(sky, { mode: 'scatter', spread: 600 });

  /* The gate sign. It lives in the empty sky above the first grave rather
     than in fixed chrome, so arriving at the top of the scroll means arriving
     somewhere, and the count tells you how far down this goes. */
  if (heading) {
    const gateSign = document.createElement('header');
    gateSign.className = 'gy-sign';
    const name = document.createElement('h1');
    name.className = 'gy-sign__name krk-hand krk-enter-rise';
    name.textContent = heading.title;
    const meta = document.createElement('p');
    meta.className = 'gy-sign__meta krk-enter-rise';
    meta.textContent = heading.meta;
    gateSign.append(name, meta);
    field.appendChild(gateSign);
    krkStagger(gateSign, { mode: 'wave', step: 90 });
  }

  /*
   * One header over each ground. The gate sign says what the whole place is;
   * these say which half of it you are looking at, and they stand over their
   * own field rather than on the road, which belongs to neither.
   */
  grounds.forEach((ground) => {
    const label = groundLabels[ground.kind] ?? {};
    const header = document.createElement('header');
    header.className = `gy-ground gy-ground--${ground.kind}`;
    header.id = `gy-ground-${ground.kind}`;
    header.dataset.kind = ground.kind;
    header.style.left = `${ground.x}%`;
    header.style.top = `${ground.y}px`;

    const groundName = document.createElement('h2');
    groundName.className = 'gy-ground__name krk-hand krk-enter-rise';
    groundName.textContent = label.title ?? ground.kind;
    const groundMeta = document.createElement('p');
    groundMeta.className = 'gy-ground__meta krk-enter-rise';
    groundMeta.textContent = label.meta ?? String(ground.count);

    header.append(groundName, groundMeta);
    field.appendChild(header);
    krkStagger(header, { mode: 'wave', step: 90 });
  });

  const road = roadEl(height);
  road.style.left = `calc(${roadX}% - ${ROAD_WIDTH / 2}px)`;
  field.appendChild(road);

  /* Lamps and milestones sit between the road and the graves: they read as
     part of the path, and they must not out-shout the graves themselves. */
  const wayLayer = document.createElement('div');
  wayLayer.className = 'gy-way';
  field.appendChild(wayLayer);

  milestones.forEach((mark) => {
    const el = document.createElement('span');
    el.className = 'gy-milestone krk-hand krk-enter-rise';
    el.textContent = mark.year;
    el.style.left = `${roadX}%`;
    el.style.top = `${mark.y}px`;
    el.setAttribute('aria-hidden', 'true');
    wayLayer.appendChild(el);
  });

  lamps.forEach((lamp) => {
    const el = document.createElement('span');
    el.className = 'gy-lamp';
    el.style.setProperty('--gy-size', `${lamp.size}px`);
    el.style.left = `${lamp.x}%`;
    el.style.top = `${lamp.y}px`;
    el.setAttribute('aria-hidden', 'true');

    /* Both the pool on the ground and the halo around the flame are CSS
       radial falloffs, matching the candle. Drawn as stroked motifs they were
       spiky starbursts that read as sparkles rather than lamplight. */
    const pool = document.createElement('span');
    pool.className = 'gy-lamp__pool';
    el.appendChild(pool);

    const rays = document.createElement('span');
    rays.className = 'gy-lamp__rays';
    el.appendChild(rays);

    const lamplight = doodle('lantern');
    lamplight.classList.add('gy-lamp__body', 'krk-boil');
    el.appendChild(lamplight);

    wayLayer.appendChild(el);
  });

  /*
   * The light a selected grave throws. Its own layer, under every stone, so
   * the pool never paints over a marker. Three nested blobs at stepped
   * opacity rather than a radial gradient — canon has no gradients, and a
   * stepped falloff is how you draw light by hand anyway.
   */
  const haloLayer = document.createElement('div');
  haloLayer.className = 'gy-halo-layer';

  const halo = document.createElement('div');
  halo.className = 'gy-halo';
  halo.setAttribute('aria-hidden', 'true');
  haloLayer.appendChild(halo);

  const candleHalo = document.createElement('div');
  candleHalo.className = 'gy-halo gy-halo--candle';
  candleHalo.setAttribute('aria-hidden', 'true');
  haloLayer.appendChild(candleHalo);

  field.appendChild(haloLayer);

  /*
   * A layer per ground, so each half of the yard is a landmark a screen reader
   * can move between instead of one flat run of fifteen buttons. Both are
   * inset:0 and neither takes a z-index of its own, so a plot's depth still
   * resolves against every other plot rather than only its own side's.
   */
  const layers = new Map();

  function layerFor(kind) {
    const key = grounds.length ? kind : 'all';
    if (!layers.has(key)) {
      const el = document.createElement(grounds.length ? 'section' : 'div');
      el.className = grounds.length ? `gy-plots gy-plots--${key}` : 'gy-plots';
      if (grounds.length) {
        el.dataset.kind = key;
        el.setAttribute('aria-labelledby', `gy-ground-${key}`);
      }
      field.appendChild(el);
      layers.set(key, el);
    }
    return layers.get(key);
  }

  const byslug = new Map();

  plots.forEach((plot) => {
    const el = document.createElement('div');
    el.className = `gy-plot gy-plot--${plot.side}`;
    el.dataset.kind = plot.kind;
    el.style.setProperty('--gy-size', `${plot.size}px`);
    el.style.setProperty('--gy-tilt', `${plot.tilt}deg`);
    el.style.setProperty('--gy-seed', String(plot.seed ?? 0));
    el.style.left = `${plot.x}%`;
    el.style.top = `${plot.y}px`;
    /* Front rows overlap back rows. Done with z-index rather than DOM order so
       the plots array can stay chronological for milestones and lamps. */
    el.style.zIndex = String(plot.depth);

    plot.motifs.forEach((motif) => {
      const holder = ambientEl(motif);
      holder.style.left = `calc(50% + ${motif.dx}px)`;
      holder.style.bottom = `${motif.dy}px`;
      el.appendChild(holder);
    });

    const marker = markerEl(plot.variant, plot.project);
    marker.addEventListener('click', () => {
      select(plot.project.slug);
      onSelect?.(plot.project);
    });
    el.appendChild(marker);

    byslug.set(plot.project.slug, { el, marker, plot });
    layerFor(plot.kind).appendChild(el);
  });

  /* Stable per-grave delays now; the class that consumes them is added when
     the grave actually scrolls into view. */
  layers.forEach((layer) => krkStagger(layer, { mode: 'scatter', spread: 450 }));

  const revealed = new WeakSet();
  const watcher = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || revealed.has(entry.target)) return;
        revealed.add(entry.target);
        /* The sprout keyframes animate `transform`, and .gy-plot uses
           `transform` for its own translate(-50%, -100%) placement — putting
           the class on the plot would animate the grave off its own plot.
           The contents sprout instead; they position with the individual
           `translate`/`rotate` properties, which compose with `transform`
           rather than replacing it. The stagger delay set on the plot
           inherits down to them. */
        entry.target.querySelectorAll('.gy-marker, .gy-ambient')
          .forEach((child) => child.classList.add('krk-enter-sprout'));
        watcher.unobserve(entry.target);
      });
    },
    { root: scroller, rootMargin: '0px 0px -6% 0px', threshold: 0.02 }
  );
  byslug.forEach(({ el }) => watcher.observe(el));

  const scrollHome = () => scroller.scrollTo({ top: 0, behavior: 'smooth' });

  const gate = document.createElement('button');
  gate.type = 'button';
  gate.className = 'gy-gate';
  gate.setAttribute('aria-label', 'Back to the gate');
  gate.appendChild(doodle('arrow-right'));
  gate.addEventListener('click', scrollHome);
  root.appendChild(gate);

  /* Nothing to go back to while you're still standing at the gate — and at
     the top it would sit right on the sign, competing with it. */
  const syncGate = () => gate.classList.toggle('is-shown', scroller.scrollTop > 260);
  scroller.addEventListener('scroll', syncGate, { passive: true });
  syncGate();

  let selected = null;

  /* Where the pointer is, in VIEWPORT coordinates, or null when it is outside
     the yard. Stored unconverted on purpose: the field position of a fixed
     pointer changes as the yard scrolls under it, so the conversion has to
     happen at use time, not at capture time. */
  let pointer = null;

  /*
   * Light the yard from every source at once: the grave you picked, which
   * stays lit whether or not you are near it, and the candle you are carrying.
   * A stone takes whichever light reaches it more strongly and throws its
   * shadow away from that one, so walking the candle past a lit grave hands
   * the shadow over rather than fighting it.
   *
   * Percent-based x has to become pixels first, which is why this re-runs on
   * resize.
   */
  function castLight() {
    /*
     * Every layout read happens here, before the first style write. The halo's
     * left/top used to be written between clientWidth and the rect read below,
     * so each frame the pointer moved flushed those writes and laid the whole
     * field out again mid-pass — a forced reflow per frame, for nothing.
     */
    const width = scroller.clientWidth || 1;
    const box = pointer ? scroller.getBoundingClientRect() : null;
    const scrolled = scroller.scrollTop;
    const toPx = (pct) => (pct / 100) * width;

    const sources = [];
    const chosen = selected && byslug.get(selected);
    if (chosen) {
      sources.push({
        x: toPx(chosen.plot.x), y: chosen.plot.y, radius: LIGHT_RADIUS,
        slug: selected, casts: true,
      });
      halo.style.left = `${chosen.plot.x}%`;
      halo.style.top = `${chosen.plot.y}px`;
    }
    halo.classList.toggle('is-lit', Boolean(chosen));

    /*
     * Every candle somebody lit. Static, so the list is rebuilt when the store
     * changes rather than here — this runs on every frame the pointer moves.
     * casts: false, like the carried candle: a permanent shadow would freeze
     * the direction the selected grave is supposed to be deciding.
     */
    for (const vigil of vigilSources) {
      sources.push({ x: toPx(vigil.x), y: vigil.y, radius: VIGIL_RADIUS, slug: vigil.slug, casts: false });
    }

    if (pointer) {
      const cx = pointer.x - box.left;
      const cy = pointer.y - box.top + scrolled;
      /* casts: false — a shadow that swung around with every twitch of the
         pointer read as noise, not as light. The candle warms what it passes;
         only the grave you picked throws shadows. */
      sources.push({ x: cx, y: cy, radius: CANDLE_RADIUS, slug: null, casts: false });
      /* transform, not left/top: this moves every frame, and left/top would
         force a layout pass on the whole field each time. */
      candleHalo.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    }
    candleHalo.classList.toggle('is-lit', Boolean(pointer));

    byslug.forEach((entry, slug) => {
      const { el, plot } = entry;
      let best = 0;      // brightest light reaching this stone, from any source
      let shade = 0;      // brightest among the sources that throw shadows
      let dir = 0;
      for (const source of sources) {
        /* The selected grave does not light itself — it would glow at its own
           feet and cast a shadow from a light standing inside it. */
        if (source.slug === slug) continue;
        const dx = toPx(plot.x) - source.x;
        const reach = Math.max(0, 1 - Math.hypot(dx, plot.y - source.y) / source.radius);
        if (reach > best) best = reach;
        if (source.casts && reach > shade) { shade = reach; dir = dx; }
      }

      /*
       * Quantised, and only written when it actually changes. --gy-lit feeds a
       * color-mix on the stone, and the stone carries the boil filter, so every
       * distinct value forces that filter to re-rasterise. Continuous values
       * meant re-filtering every stone on every frame — measured at ~40ms a
       * frame while the pointer moved, against ~16ms idle. In steps, most
       * frames write nothing at all, and stepped falloff is the look already:
       * the halos are drawn as discrete rings for the same reason.
       */
      const lit = Math.round(best * LIGHT_STEPS) / LIGHT_STEPS;
      const cast = shade > 0 ? (dir >= 0 ? 'right' : 'left') : 'none';
      if (lit === entry.lit && cast === entry.cast) return;
      entry.lit = lit;
      entry.cast = cast;
      el.style.setProperty('--gy-lit', String(lit));
      el.style.setProperty('--gy-shade', String(Math.round(shade * LIGHT_STEPS) / LIGHT_STEPS));
      el.classList.toggle('is-cast-right', cast === 'right');
      el.classList.toggle('is-cast-left', cast === 'left');
    });
  }

  /*
   * Which graves are holding a vigil, and the pool each one throws. Recomputed
   * only when the store changes — the candles are static, so castLight() must
   * never go asking.
   *
   * A grave does not light its own stone (a light standing inside it would
   * glow at its own feet), so its own warmth comes from --gy-lit-floor in CSS
   * instead: one write per change, not one per frame.
   */
  const vigilHalos = new Map();
  let vigilSources = [];

  function refreshVigil() {
    vigilSources = [];
    byslug.forEach((entry, slug) => {
      const lit = isLit(slug);
      entry.el.classList.toggle('is-vigil', lit);
      if (!lit) {
        vigilHalos.get(slug)?.remove();
        vigilHalos.delete(slug);
        return;
      }
      vigilSources.push({ x: entry.plot.x, y: entry.plot.y, slug });
      if (vigilHalos.has(slug)) return;
      const pool = document.createElement('div');
      pool.className = 'gy-halo gy-halo--vigil';
      pool.setAttribute('aria-hidden', 'true');
      pool.style.left = `${entry.plot.x}%`;
      pool.style.top = `${entry.plot.y}px`;
      haloLayer.appendChild(pool);
      vigilHalos.set(slug, pool);
    });
    castLight();
  }

  /* Reading the store at mount is what makes a lit candle survive a rebuild;
     the subscription is what saves it from needing one. */
  const stopVigil = subscribe(refreshVigil);
  refreshVigil();

  const sizeWatcher = new ResizeObserver(castLight);
  sizeWatcher.observe(scroller);

  /* Pointer position is read in viewport space and used in field space, so it
     has to survive scrolling — hence the scrollTop term. Throttled to a frame:
     pointermove fires far more often than anything here needs to run. */
  let pendingLight = 0;
  const queueLight = () => {
    if (pendingLight) return;
    pendingLight = requestAnimationFrame(() => { pendingLight = 0; castLight(); });
  };

  scroller.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    queueLight();
  });

  scroller.addEventListener('pointerleave', () => { pointer = null; queueLight(); });
  scroller.addEventListener('scroll', () => { if (pointer) queueLight(); }, { passive: true });

  function select(slug) {
    if (selected) byslug.get(selected)?.el.classList.remove('is-selected');
    selected = slug;
    if (!slug) { castLight(); return; }
    const entry = byslug.get(slug);
    if (!entry) return;
    entry.el.classList.add('is-selected');
    /* Restart the squash-and-settle even on a repeat click. */
    entry.marker.classList.remove('gy-marker--struck');
    void entry.marker.offsetWidth;
    entry.marker.classList.add('gy-marker--struck');
    castLight();
  }

  /* mountScene replaces the whole frame, so the scene it replaces has to let
     go of everything that outlives the DOM it was watching. */
  function destroy() {
    stopVigil();
    watcher.disconnect();
    sizeWatcher.disconnect();
  }

  return { select, scrollHome, destroy };
}
