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
export function mountScene(root, layout, { onSelect, heading } = {}) {
  const { plots, roadX, height, lamps = [], milestones = [] } = layout;

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

    const pool = doodle('light-pool');
    pool.classList.add('gy-lamp__pool');
    el.appendChild(pool);

    const rays = doodle('glow');
    rays.classList.add('gy-lamp__rays', 'krk-boil');
    el.appendChild(rays);

    const lamplight = doodle('lantern');
    lamplight.classList.add('gy-lamp__body', 'krk-boil');
    el.appendChild(lamplight);

    wayLayer.appendChild(el);
  });

  const plotLayer = document.createElement('div');
  plotLayer.className = 'gy-plots';
  field.appendChild(plotLayer);

  const byslug = new Map();

  plots.forEach((plot) => {
    const el = document.createElement('div');
    el.className = `gy-plot gy-plot--${plot.side}`;
    el.style.setProperty('--gy-size', `${plot.size}px`);
    el.style.setProperty('--gy-tilt', `${plot.tilt}deg`);
    el.style.left = `${plot.x}%`;
    el.style.top = `${plot.y}px`;

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

    byslug.set(plot.project.slug, { el, marker });
    plotLayer.appendChild(el);
  });

  /* Stable per-grave delays now; the class that consumes them is added when
     the grave actually scrolls into view. */
  krkStagger(plotLayer, { mode: 'scatter', spread: 450 });

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

  function select(slug) {
    if (selected) byslug.get(selected)?.el.classList.remove('is-selected');
    selected = slug;
    if (!slug) return;
    const entry = byslug.get(slug);
    if (!entry) return;
    entry.el.classList.add('is-selected');
    /* Restart the squash-and-settle even on a repeat click. */
    entry.marker.classList.remove('gy-marker--struck');
    void entry.marker.offsetWidth;
    entry.marker.classList.add('gy-marker--struck');
  }

  return { select, scrollHome };
}
