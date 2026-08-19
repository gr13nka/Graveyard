/*
 * Reading the analysis that killed an idea, without leaving the graveyard.
 * -----------------------------------------------------------------------
 * Callers say open(project) and the report appears over the yard. Fetching it,
 * parsing it, where it is cached, and how it is dismissed are this module's
 * business.
 *
 * Why in the page at all, when the file is right there in the repository:
 * `.nojekyll` makes Pages serve `autopsies/*.md` as `text/markdown` with no
 * charset, and a browser handed that falls back to a single-byte encoding — so
 * a Russian report opens as `ÐŸÐ¾Ð´Ð±Ð¾Ñ€`. There is no server here to set a
 * header on. Reading it through `fetch` sidesteps the whole question, because
 * `Response.text()` decodes as UTF-8 whatever the header claimed.
 *
 * It mounts on <body> rather than inside the scene or the panel, both of which
 * are thrown away and rebuilt underneath it.
 */

import { renderMarkdown } from './markdown.js';

const cache = new Map();

export function mountAutopsyReader(host = document.body) {
  const sheet = document.createElement('article');
  sheet.className = 'gy-autopsy__sheet';
  sheet.tabIndex = -1;

  const root = document.createElement('div');
  root.className = 'gy-autopsy';
  root.hidden = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'gy-autopsy__backdrop';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gy-autopsy__close';
  close.textContent = 'close';

  root.append(backdrop, sheet);
  sheet.appendChild(close);
  host.appendChild(root);

  /* Whatever the reader was opened from, so focus can go back to it. */
  let opener = null;

  function dismiss() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('gy-has-autopsy');
    opener?.focus?.();
    opener = null;
  }

  backdrop.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);
  /* Capture, so Escape closes the reader before anything below it reacts. */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) { e.stopPropagation(); dismiss(); }
  }, true);

  /* A dialog you can tab out of is a dialog that loses the reader behind the
     yard. Keep the ring inside the sheet while it is up. */
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = sheet.querySelectorAll('a[href], button, input:not([disabled])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function show(nodes, project) {
    sheet.replaceChildren(close);
    const head = document.createElement('header');
    head.className = 'gy-autopsy__head';
    const title = document.createElement('h2');
    title.className = 'gy-autopsy__title';
    title.textContent = project.name;
    const meta = document.createElement('p');
    meta.className = 'gy-autopsy__meta';
    meta.textContent = 'the analysis that killed it';
    head.append(title, meta);

    const body = document.createElement('div');
    body.className = 'gy-md';
    body.appendChild(nodes);

    sheet.append(head, body);
    sheet.scrollTop = 0;
  }

  async function open(project, from) {
    if (!project?.autopsy) return;
    opener = from ?? document.activeElement;
    root.hidden = false;
    document.body.classList.add('gy-has-autopsy');

    sheet.replaceChildren(close);
    const waiting = document.createElement('p');
    waiting.className = 'gy-autopsy__meta';
    waiting.textContent = 'reading…';
    sheet.appendChild(waiting);
    sheet.focus();

    try {
      if (!cache.has(project.autopsy)) {
        const res = await fetch(project.autopsy);
        if (!res.ok) throw new Error(`${res.status}`);
        cache.set(project.autopsy, await res.text());
      }
      show(renderMarkdown(cache.get(project.autopsy)), project);
    } catch (error) {
      /* The report is a file that may simply not have been committed. Say which
         one is missing rather than showing an empty sheet. */
      show(renderMarkdown(
        `## The report could not be read\n\n\`${project.autopsy}\` did not load (${error.message}).`
      ), project);
    }
    sheet.focus();
  }

  return { open, close: dismiss };
}
