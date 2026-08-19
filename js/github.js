/*
 * Committing a file to GitHub from the browser.
 * -----------------------------------------------------------------------
 * This is why the site needs no server. GitHub's Contents API accepts a file
 * write over plain HTTPS, and Pages redeploys itself afterwards, so the whole
 * "edit your graveyard" story is a static page plus one fetch.
 *
 * Callers get read() and write() and never deal with base64, the sha
 * handshake, or GitHub's error shapes.
 */

const API = 'https://api.github.com';

/*
 * base64 in a browser is byte-oriented, and btoa throws on anything above
 * U+00FF. Epitaphs are full of em dashes and Cyrillic, so both directions have
 * to go through UTF-8 explicitly. Getting this wrong corrupts text silently —
 * it only shows up later as mojibake in the committed file.
 */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded) {
  const binary = atob(encoded.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Which repository is serving this page.
 *
 * A Pages URL carries both halves — `owner.github.io/repo/` — which is what
 * lets somebody fork this and get a working editor without configuring
 * anything. Returns null off Pages (localhost, a custom domain), where the
 * caller should fall back to downloading the file instead of guessing.
 *
 * `localStorage.gy_repo = "owner/name"` overrides it, for working on the
 * editor locally against a real repo.
 */
export function repoFromLocation() {
  /* Safari's private mode and a file:// origin make every localStorage access
     a SecurityError. The epitaph panel calls this for every grave it draws, so
     a throw here would take the whole panel down for a visitor who never asked
     to edit anything. No override is a fine answer; an exception is not. */
  let override = null;
  try {
    override = localStorage.getItem('gy_repo');
  } catch {
    /* storage unreachable — fall through to the URL, which always works */
  }
  if (override && override.includes('/')) {
    const [owner, repo] = override.split('/');
    return { owner, repo };
  }

  const host = location.hostname.match(/^([\w-]+)\.github\.io$/);
  if (!host) return null;

  const owner = host[1];
  const first = location.pathname.split('/').filter(Boolean)[0];
  /* A user site is served from the root; its repo is named after the host. */
  return { owner, repo: first || `${owner}.github.io` };
}

class GitHubError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;   // 'auth' | 'conflict' | 'missing' | 'network' | 'other'
  }
}

/** Map GitHub's status codes onto the few cases a caller can act on. */
function describe(status, body) {
  const detail = body?.message || `HTTP ${status}`;
  if (status === 401) return new GitHubError('auth', 'That token was rejected. It may be expired or mistyped.');
  if (status === 403) return new GitHubError('auth', 'That token lacks permission. It needs Contents: read and write on this repository.');
  if (status === 404) return new GitHubError('missing', 'Not found — either the file, or the token cannot see this repository.');
  if (status === 409 || status === 422) {
    return new GitHubError('conflict', 'The file changed on GitHub since this page loaded.');
  }
  return new GitHubError('other', detail);
}

/**
 * A single file in a single repository.
 *
 * Writes are compare-and-swap: read() remembers the file's sha and write()
 * sends it back, so a stale tab is refused rather than being allowed to revert
 * somebody's whole graveyard.
 */
export function fileStore({ owner, repo, path, token, branch = 'main' }) {
  let sha = null;

  const request = async (url, init = {}) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (cause) {
      throw new GitHubError('network', 'Could not reach GitHub.');
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw describe(response.status, body);
    return body;
  };

  return {
    /** Current contents, and the sha a later write must match. */
    async read() {
      const url = `${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
        + `&t=${Date.now()}`;   // GitHub's CDN caches this endpoint
      const body = await request(url);
      sha = body.sha;
      return fromBase64(body.content);
    },

    /** Commit new contents. Throws kind 'conflict' if the file moved under us. */
    async write(text, message) {
      if (!sha) throw new GitHubError('other', 'Read the file before writing it.');
      const body = await request(`${API}/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: toBase64(text), sha, branch }),
      });
      sha = body.content.sha;
      return body.commit.sha;
    },
  };
}
