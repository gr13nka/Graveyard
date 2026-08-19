/*
 * Editing your graveyard from the page it is served on.
 * -----------------------------------------------------------------------
 * Reached at ?edit. Invisible otherwise: a visitor never sees an affordance,
 * and finding the URL gets them nothing, because writing needs a token only
 * the owner has.
 *
 * There is no server. Save commits data/projects.json through the GitHub
 * Contents API and Pages redeploys itself.
 *
 * Why a token at all — this was asked and is worth writing down, because the
 * obvious instinct is to design it away:
 *
 *   - OAuth's web flow needs a client_secret, which a static page cannot hold.
 *   - OAuth's device flow exists for exactly this case, but GitHub's
 *     /login/device/code and /login/oauth/access_token send no CORS headers,
 *     so a browser cannot call them at all. Every workaround is a proxy.
 *   - The page cannot borrow the visitor's github.com session; that is
 *     cross-origin by design.
 *
 * So the floor is one authorisation, once. After that every save is a single
 * click. Do not add a download fallback: it once occupied this button and
 * meant nobody could find the save.
 */

import { repoFromLocation, fileStore } from './github.js';
import { MARKER_VARIANTS } from './marker.js';

const TOKEN_KEY = 'gy_token';
const REPO_KEY = 'gy_repo';
const DATA_PATH = 'data/projects.json';

/* The fields worth editing by hand. Everything else about a grave — where it
   stands, what grows round it — derives from the slug and has nowhere to be
   typed. */
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
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let coords = repoFromLocation();
  let current = null;

  const connected = () => Boolean(coords && token);

  const store = () => fileStore({ ...coords, path: DATA_PATH, token });

  /* ---- the small "edit" handle on the read-only panel ---- */

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
        MARKER_VARIANTS.forEach((name) => input.appendChild(new Option(name, name)));
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
    const connect = connectPanel(status);

    const save = el('button', 'gy-btn gy-btn--go', 'Save');
    save.type = 'button';
    const cancel = el('button', 'gy-btn', 'cancel');
    cancel.type = 'button';
    const exhume = el('button', 'gy-btn gy-btn--danger', 'exhume');
    exhume.type = 'button';

    const actions = el('div', 'gy-form__actions');
    actions.append(save, cancel, exhume);

    /* Typed values land on the project before anything else happens, so a
       failed save still leaves the form — and the scene — showing what the
       user wrote. Losing their text is the one outcome worth engineering
       against. */
    const apply = () => {
      for (const [key, input] of inputs) {
        const value = input.value.trim();
        if (value) project[key] = value;
        else delete project[key];
      }
      if (!project.name) project.name = project.slug;
    };

    save.addEventListener('click', () => {
      apply();
      rebuild();
      commit(status, save, connect, `Rewrite ${project.slug}'s epitaph`);
    });

    cancel.addEventListener('click', () => {
      if (current) reselect(current);
      else panel.innerHTML = '';
    });

    exhume.addEventListener('click', () => {
      if (!confirm(`Exhume ${project.name}? The grave and its entry go away.`)) return;
      const at = projects.indexOf(project);
      if (at !== -1) projects.splice(at, 1);
      current = null;
      rebuild();
      commit(status, exhume, connect, `Exhume ${project.slug}`);
    });

    form.append(actions, status, connect.box);
    panel.appendChild(form);
  }

  /* ---- saving ---- */

  async function commit(status, button, connect, message) {
    if (!connected()) {
      connect.reveal();
      status.textContent = coords
        ? 'One step first: GitHub needs to let this page write. It takes a minute, once.'
        : 'Tell it which repository to commit to, below.';
      return;
    }

    button.disabled = true;
    status.textContent = 'saving…';
    try {
      const file = store();
      await file.read();                    // refresh the sha we write against
      await file.write(serialise(projects), message);
      status.textContent = location.hostname.endsWith('github.io')
        ? 'Saved. GitHub Pages rebuilds in about a minute.'
        : 'Saved to GitHub. Run git pull — your local copy is now behind.';
      connect.collapse();
    } catch (error) {
      if (error.kind === 'conflict') {
        status.textContent = 'The file changed on GitHub since this page loaded. Reload and edit again — your text is still here.';
      } else if (error.kind === 'auth') {
        status.textContent = error.message;
        connect.reveal();
      } else {
        status.textContent = error.message;
      }
    } finally {
      button.disabled = false;
    }
  }

  /* ---- connecting, once ---- */

  function connectPanel(status) {
    const box = el('section', 'gy-connect');
    const body = el('div', 'gy-connect__body');
    const summary = el('button', 'gy-connect__summary');
    summary.type = 'button';

    const render = () => {
      box.classList.toggle('is-done', connected());
      summary.textContent = connected()
        ? `connected to ${coords.owner}/${coords.repo} · change`
        : 'Connect GitHub so Save can write';
    };

    summary.addEventListener('click', () => box.classList.toggle('is-open'));

    /* Off Pages — localhost, a custom domain — the URL carries no repository,
       so ask rather than falling back to something that isn't saving. */
    let repoInput = null;
    if (!coords || localStorage.getItem(REPO_KEY)) {
      const row = el('label', 'gy-form__row');
      row.appendChild(el('span', 'gy-form__label', 'Repository'));
      repoInput = el('input', 'gy-form__input');
      repoInput.placeholder = 'owner/name';
      repoInput.value = localStorage.getItem(REPO_KEY)
        || (coords ? `${coords.owner}/${coords.repo}` : '');
      row.appendChild(repoInput);
      body.appendChild(row);
    }

    body.appendChild(el('p', 'gy-connect__note',
      'Create a fine-grained token with access to only this repository, and one '
      + 'permission — Contents: read and write. It is kept in this browser and sent '
      + 'only to api.github.com. Not on a shared computer.'));

    const link = el('a', 'gy-connect__link', 'create the token on GitHub →');
    link.href = 'https://github.com/settings/personal-access-tokens/new';
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    body.appendChild(link);

    const field = el('label', 'gy-form__row');
    field.appendChild(el('span', 'gy-form__label', 'Token'));
    const input = el('input', 'gy-form__input');
    input.type = 'password';
    input.placeholder = 'github_pat_…';
    input.value = token;
    field.appendChild(input);
    body.appendChild(field);

    const done = el('button', 'gy-btn gy-btn--go', 'connect');
    done.type = 'button';
    done.addEventListener('click', () => {
      const repo = repoInput?.value.trim();
      if (repo && repo.includes('/')) {
        localStorage.setItem(REPO_KEY, repo);
        const [owner, name] = repo.split('/');
        coords = { owner, repo: name };
      }
      token = input.value.trim();
      if (token) localStorage.setItem(TOKEN_KEY, token);
      render();
      status.textContent = connected()
        ? 'Connected. Press Save.'
        : 'Still missing a token.';
      if (connected()) box.classList.remove('is-open');
    });

    const forget = el('button', 'gy-btn gy-btn--danger', 'sign out');
    forget.type = 'button';
    forget.addEventListener('click', () => {
      token = '';
      localStorage.removeItem(TOKEN_KEY);
      input.value = '';
      render();
      box.classList.add('is-open');
      status.textContent = 'Token cleared from this browser.';
    });

    const row = el('div', 'gy-form__actions');
    row.append(done, forget);
    body.appendChild(row);

    box.append(summary, body);
    render();
    /* Open until it is done: this is the one thing between the user and a
       working Save, so it must not be something they have to go looking for. */
    if (!connected()) box.classList.add('is-open');

    return {
      box,
      reveal() {
        box.classList.add('is-open', 'is-wanted');
        input.focus();
      },
      collapse() {
        box.classList.remove('is-open', 'is-wanted');
        render();
      },
    };
  }

  return { setSelected };
}
