/*
 * Editing your graveyard from the page it is served on.
 * -----------------------------------------------------------------------
 * Reached at ?edit. Invisible otherwise: a visitor never sees an affordance,
 * and finding the URL gets them nothing, because writing needs a token only
 * the owner has.
 *
 * There is no server. Saving commits data/projects.json through the GitHub
 * Contents API and Pages redeploys itself. Off Pages — locally, or without a
 * token — Save downloads the file instead, so the no-token path is never a
 * dead end.
 */

import { repoFromLocation, fileStore } from './github.js';

const TOKEN_KEY = 'gy_token';
const DATA_PATH = 'data/projects.json';
const MARKERS = ['headstone-round', 'headstone-cross', 'obelisk', 'urn', 'mound'];

/* The fields worth editing by hand. Everything else about a grave — where it
   stands, which undergrowth grows round it — is derived from the slug and has
   nowhere to be typed. */
const FIELDS = [
  { key: 'epitaph', label: 'Epitaph', type: 'text', hint: 'One line. The only part anyone reads twice.' },
  { key: 'cause', label: 'Cause of death', type: 'text' },
  { key: 'description', label: 'Description', type: 'area' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'marker', label: 'Marker', type: 'marker' },
  { key: 'born', label: 'Born', type: 'date' },
  { key: 'died', label: 'Died', type: 'date' },
  { key: 'repo', label: 'Repo URL', type: 'text' },
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const serialise = (projects) => `${JSON.stringify(projects, null, 2)}\n`;

function download(projects) {
  const blob = new Blob([serialise(projects)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'projects.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Mount the editor over the epitaph panel.
 *
 * @param panel    the epitaph panel element, whose contents the form replaces
 * @param projects the live array — edits mutate it in place
 * @param rebuild  called after a change so the scene can redraw
 * @param reselect called to put the read-only epitaph back in the panel
 * @returns {{ setSelected(project): void }}
 */
export function mountEditor(panel, { projects, rebuild, reselect }) {
  const coords = repoFromLocation();
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let current = null;
  let store = null;

  const canCommit = () => Boolean(coords && token);

  function connectStore() {
    store = canCommit()
      ? fileStore({ ...coords, path: DATA_PATH, token })
      : null;
  }
  connectStore();

  /* ---- the small "edit" handle that lives on the read-only panel ---- */

  function setSelected(project) {
    current = project;
    if (!project) return;
    const button = el('button', 'gy-edit-open', 'edit');
    button.type = 'button';
    button.addEventListener('click', () => openForm(project));
    panel.querySelector('.gy-epitaph__page')?.prepend(button);
  }

  /* ---- the form ---- */

  function openForm(project) {
    panel.innerHTML = '';
    panel.classList.remove('is-empty');
    const form = el('div', 'gy-form');

    form.appendChild(el('p', 'gy-form__slug', project.slug));
    const inputs = new Map();

    for (const field of FIELDS) {
      const row = el('label', 'gy-form__row');
      row.appendChild(el('span', 'gy-form__label', field.label));

      let input;
      if (field.type === 'marker') {
        input = document.createElement('select');
        input.appendChild(new Option('(from the slug)', ''));
        MARKERS.forEach((name) => input.appendChild(new Option(name, name)));
      } else if (field.type === 'area') {
        input = document.createElement('textarea');
        input.rows = 4;
      } else {
        input = document.createElement('input');
        input.type = field.type === 'date' ? 'date' : 'text';
      }
      input.className = 'gy-form__input';
      input.value = project[field.key] ?? '';
      inputs.set(field.key, input);
      row.appendChild(input);

      if (field.hint) row.appendChild(el('span', 'gy-form__hint', field.hint));
      form.appendChild(row);
    }

    const status = el('p', 'gy-form__status');
    const actions = el('div', 'gy-form__actions');

    const save = el('button', 'gy-btn gy-btn--go', canCommit() ? 'save to GitHub' : 'download');
    save.type = 'button';
    const cancel = el('button', 'gy-btn', 'cancel');
    cancel.type = 'button';
    const exhume = el('button', 'gy-btn gy-btn--danger', 'exhume');
    exhume.type = 'button';

    actions.append(save, cancel, exhume);

    const apply = () => {
      for (const [key, input] of inputs) {
        const value = input.value.trim();
        if (value) project[key] = value;
        else delete project[key];
      }
      /* name and slug are required for the grave to exist at all */
      if (!project.name) project.name = project.slug;
    };

    save.addEventListener('click', async () => {
      apply();
      rebuild();
      await commit(status, save, `Rewrite ${project.slug}'s epitaph`);
    });

    cancel.addEventListener('click', () => closeForm());

    exhume.addEventListener('click', async () => {
      if (!confirm(`Exhume ${project.name}? The grave and its entry go away.`)) return;
      const at = projects.indexOf(project);
      if (at !== -1) projects.splice(at, 1);
      current = null;
      rebuild();
      await commit(status, exhume, `Exhume ${project.slug}`);
      closeForm();
    });

    form.append(status, actions, tokenPanel(status, save));
    panel.appendChild(form);
  }

  function closeForm() {
    if (current) reselect(current);
    else panel.innerHTML = '';
  }

  /* ---- saving ---- */

  async function commit(status, button, message) {
    if (!store) {
      download(projects);
      status.textContent = coords
        ? 'Downloaded. Add a token below to commit straight to GitHub instead.'
        : 'Downloaded — replace data/projects.json with it. Committing needs the site served from GitHub Pages.';
      return;
    }

    button.disabled = true;
    status.textContent = 'saving…';
    try {
      await store.read();                       // refresh the sha we write against
      await store.write(serialise(projects), message);
      status.textContent = 'Committed. GitHub Pages rebuilds in about a minute.';
    } catch (error) {
      if (error.kind === 'conflict') {
        status.textContent = 'The file changed on GitHub since this page loaded. Reload, then edit again.';
      } else if (error.kind === 'auth') {
        status.textContent = `${error.message} Replace it below.`;
      } else {
        status.textContent = error.message;
      }
    } finally {
      button.disabled = false;
    }
  }

  /* ---- the token, asked for once ---- */

  function tokenPanel(status, save) {
    const box = el('details', 'gy-token');
    box.appendChild(el('summary', null, canCommit() ? 'GitHub token — connected' : 'Connect GitHub to save here'));

    if (!coords) {
      box.appendChild(el('p', 'gy-token__note',
        'This page is not being served from GitHub Pages, so it cannot tell which '
        + 'repository to commit to. Save downloads the file instead.'));
      return box;
    }

    box.appendChild(el('p', 'gy-token__note',
      `Committing to ${coords.owner}/${coords.repo}. Create a fine-grained token with `
      + 'access to only that repository and one permission — Contents: read and write. '
      + 'It is kept in this browser and sent only to api.github.com. Do not do this on a '
      + 'shared computer.'));

    const link = el('a', 'gy-token__link', 'create a token on GitHub');
    link.href = 'https://github.com/settings/personal-access-tokens/new';
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    box.appendChild(link);

    const input = el('input', 'gy-form__input');
    input.type = 'password';
    input.placeholder = 'github_pat_…';
    input.value = token;
    box.appendChild(input);

    const row = el('div', 'gy-form__actions');
    const connect = el('button', 'gy-btn gy-btn--go', 'connect');
    connect.type = 'button';
    connect.addEventListener('click', () => {
      token = input.value.trim();
      localStorage.setItem(TOKEN_KEY, token);
      connectStore();
      save.textContent = canCommit() ? 'save to GitHub' : 'download';
      status.textContent = canCommit() ? 'Connected.' : 'No token — Save will download.';
    });

    const forget = el('button', 'gy-btn gy-btn--danger', 'sign out');
    forget.type = 'button';
    forget.addEventListener('click', () => {
      token = '';
      localStorage.removeItem(TOKEN_KEY);
      input.value = '';
      connectStore();
      save.textContent = 'download';
      status.textContent = 'Token cleared from this browser.';
    });

    row.append(connect, forget);
    box.appendChild(row);
    return box;
  }

  return { setSelected };
}
