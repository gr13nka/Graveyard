/*
 * The right-hand page — what a grave says when you stand at it.
 * -----------------------------------------------------------------------
 * Owns its own markup and its entrance. Callers only ever say show(project)
 * or showEmpty().
 *
 * Screenshots are the one thing here with no Karakuli precedent: canon covers
 * doodles and washes, never a raster image. They are framed the way a
 * .krk-card--line is — 1.5px ink hairline, organic radius, no shadow — so a
 * photo sits in the page like a pinned print rather than a floating tile.
 */

import { doodle } from './doodles.js';
import { krkStagger } from '../vendor/karakuli/anim.js';

const fmt = (iso) => {
  if (!iso) return '';
  const [y, m] = String(iso).split('-');
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return m ? `${months[Number(m) - 1]} ${y}` : y;
};

function lifespan(born, died) {
  const from = fmt(born);
  const to = fmt(died);
  return from && to ? `${from} — ${to}` : to || from;
}

function block(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

export function mountEpitaph(root) {
  root.classList.add('gy-epitaph');

  function render(children) {
    root.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'gy-epitaph__page';
    children.forEach((child) => page.appendChild(child));
    root.appendChild(page);
    krkStagger(page, { mode: 'wave', step: 65 });
    return page;
  }

  function showEmpty() {
    /* Батон, the loaf cat — canon's mascot for rest and quiet empty states. */
    const cat = doodle('baton-sleep');
    cat.classList.add('krk-boil');
    const art = block('div', 'gy-epitaph__empty-art krk-enter-sprout');
    art.appendChild(cat);
    render([
      art,
      block('p', 'gy-epitaph__empty krk-hand krk-enter-rise',
        'Pick a grave. Somebody has to remember these.'),
    ]);
    root.classList.add('is-empty');
  }

  function show(project) {
    root.classList.remove('is-empty');
    const parts = [];

    const marker = doodle(project.marker || 'headstone-round');
    marker.classList.add('krk-boil');
    const badge = block('div', 'gy-epitaph__badge krk-enter-draw');
    badge.appendChild(marker);
    parts.push(badge);

    parts.push(block('h2', 'gy-epitaph__name krk-enter-rise', project.name));
    parts.push(block('p', 'gy-epitaph__dates krk-enter-rise',
      lifespan(project.born, project.died)));

    if (project.epitaph) {
      parts.push(block('p', 'gy-epitaph__quote krk-hand krk-enter-rise', project.epitaph));
    }

    if (project.repo) {
      const link = block('a', 'gy-epitaph__link krk-arrow-inline krk-enter-rise',
        project.repo.replace(/^https?:\/\/(www\.)?github\.com\//, ''));
      link.href = project.repo;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      parts.push(link);
    }

    parts.push(block('hr', 'krk-divider krk-enter-rise'));

    if (project.description) {
      parts.push(block('p', 'gy-epitaph__body krk-enter-rise', project.description));
    }

    if (project.cause) {
      const cause = block('p', 'gy-epitaph__cause krk-enter-rise');
      cause.appendChild(block('span', 'gy-epitaph__cause-label', 'cause of death '));
      cause.appendChild(block('span', null, project.cause));
      parts.push(cause);
    }

    const shots = project.screenshots ?? [];
    if (shots.length) {
      const gallery = block('div', 'gy-shots krk-enter-rise');
      shots.forEach((src) => {
        const frame = block('figure', 'gy-shot');
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${project.name} screenshot`;
        img.loading = 'lazy';
        frame.appendChild(img);
        gallery.appendChild(frame);
      });
      parts.push(gallery);
    }

    render(parts);
  }

  showEmpty();
  return { show, showEmpty };
}
