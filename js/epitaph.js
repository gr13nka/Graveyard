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
import { markerVariantsFor } from './marker.js';
import { matchbox } from './matchbox.js';
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

/*
 * A grave's one door out.
 *
 * A project links to its repo. An idea has no repo — it has the analysis that
 * killed it, and that is not a link but a thing to read here: handing a
 * visitor a raw .md is handing them a download, and on Pages a mis-decoded one
 * at that. So the two are different elements, an <a> and a <button>, and the
 * panel says which by asking the grave what it is.
 */
function doorOut(project) {
  if (project.repo) {
    const link = block('a', 'gy-epitaph__link krk-arrow-inline krk-enter-rise',
      project.repo.replace(/^https?:\/\/(www\.)?github\.com\//, ''));
    link.href = project.repo;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    return link;
  }
  if (!project.autopsy) return null;

  const open = block('button', 'gy-epitaph__link gy-epitaph__link--read krk-arrow-inline krk-enter-rise',
    'read the autopsy');
  open.type = 'button';
  /* The panel is replaced on every selection, so it cannot own the reader.
     It says what happened and lets the page decide, the way the matchbox
     does with gy:strike and gy:lit. */
  open.addEventListener('click', () => {
    open.dispatchEvent(new CustomEvent('gy:autopsy', { bubbles: true, detail: project }));
  });
  return open;
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
    const idea = project.kind === 'idea';
    const parts = [];

    const marker = doodle(project.marker || markerVariantsFor(project.kind)[0]);
    marker.classList.add('krk-boil');
    const badge = block('div', 'gy-epitaph__badge krk-enter-draw');
    badge.appendChild(marker);
    parts.push(badge);

    parts.push(block('h2', 'gy-epitaph__name krk-enter-rise', project.name));
    /* An idea has one date and it is not a death — it is the day somebody sat
       down and worked out that it would not pay. A bare month and year there
       would read as a lifespan with half of it missing. */
    parts.push(block('p', 'gy-epitaph__dates krk-enter-rise',
      idea ? `filtered ${fmt(project.died)}` : lifespan(project.born, project.died)));

    if (project.epitaph) {
      parts.push(block('p', 'gy-epitaph__quote krk-hand krk-enter-rise', project.epitaph));
    }

    const door = doorOut(project);
    if (door) parts.push(door);

    parts.push(block('hr', 'krk-divider krk-enter-rise'));

    if (project.description) {
      parts.push(block('p', 'gy-epitaph__body krk-enter-rise', project.description));
    }

    if (project.cause) {
      const cause = block('p', 'gy-epitaph__cause krk-enter-rise');
      /* Nothing that was never built has a cause of death. */
      cause.appendChild(block('span', 'gy-epitaph__cause-label',
        idea ? 'never born, because ' : 'cause of death '));
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

    /* Last, and after a rule of its own: you read the whole page and then there
       is something to do about it. showEmpty() gets none of this — there is no
       grave there to light a candle for. */
    parts.push(block('hr', 'krk-divider krk-enter-rise'));
    parts.push(matchbox(project));

    render(parts);
  }

  showEmpty();
  return { show, showEmpty };
}
