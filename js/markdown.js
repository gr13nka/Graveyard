/*
 * Just enough Markdown to read an autopsy.
 * -----------------------------------------------------------------------
 * Callers hand over the text of a report and get a DocumentFragment back.
 *
 * This is deliberately not a general Markdown implementation. It covers the
 * constructs the reports in autopsies/ actually use — headings, blockquotes,
 * tables, the three kinds of list, rules, fenced code, and inline emphasis,
 * code, strikethrough and links — and treats everything else as text.
 *
 * It builds nodes and sets textContent; it never assembles a string of HTML.
 * That is not a style preference. A report is a file in the repository, a fork
 * can carry any file at all, and one of the reports here already ends with a
 * stray `</content>` from whatever produced it. Building DOM means markup in a
 * report can only ever be read as the characters it is made of, so there is no
 * injection question to get wrong later.
 */

/* A link may only point somewhere a link can point. Anything else — most of
   all `javascript:` — is dropped and its text is kept, because losing the
   sentence would be worse than losing the link. */
function safeHref(url) {
  const clean = url.trim();
  if (/^(https?:|mailto:)/i.test(clean)) return clean;
  if (/^[./#]/.test(clean) && !/^\/\//.test(clean)) return clean;
  return null;
}

/*
 * Inline runs, innermost meaning first: code is literal, so it is matched
 * before anything that could appear inside it, and links before the emphasis
 * that can appear in their text.
 */
const INLINE = [
  { re: /`([^`]+)`/, tag: 'code', literal: true },
  { re: /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, link: true },
  { re: /\*\*([^*]+)\*\*/, tag: 'strong' },
  { re: /(?<![\w*])\*([^*\n]+)\*(?![\w*])/, tag: 'em' },
  { re: /(?<![\w_])_([^_\n]+)_(?![\w_])/, tag: 'em' },
  { re: /~~([^~]+)~~/, tag: 'del' },
];

/** Inline markup into nodes, appended to `parent`. */
function inline(parent, text) {
  let rest = text;
  outer: while (rest) {
    let best = null;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, rule };
    }
    if (!best) break;

    const { m, rule } = best;
    if (m.index) parent.appendChild(document.createTextNode(rest.slice(0, m.index)));

    if (rule.link) {
      const href = safeHref(m[2]);
      const node = href ? document.createElement('a') : document.createDocumentFragment();
      if (href) {
        node.href = href;
        node.className = 'gy-md__link';
        /* Only leaving the site warrants a new tab; an in-repo path does not. */
        if (/^https?:/i.test(href)) { node.target = '_blank'; node.rel = 'noreferrer noopener'; }
      }
      inline(node, m[1]);
      parent.appendChild(node);
    } else {
      const node = document.createElement(rule.tag);
      if (rule.literal) node.textContent = m[1];
      else inline(node, m[1]);
      parent.appendChild(node);
    }

    rest = rest.slice(m.index + m[0].length);
    continue outer;
  }
  if (rest) parent.appendChild(document.createTextNode(rest));
}

const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isDivider = (line) => /^\|?[\s:-]*-[\s|:-]*$/.test(line) && line.includes('-');

/** The text of a report, as nodes. */
export function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const frag = document.createDocumentFragment();
  let i = 0;

  const add = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) inline(el, text);
    frag.appendChild(el);
    return el;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    /* Fenced code is verbatim to its closing fence, or to the end of the file
       if it never closes — an unterminated fence must not eat the document. */
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const pre = document.createElement('pre');
      pre.className = 'gy-md__pre';
      const code = document.createElement('code');
      code.textContent = body.join('\n');
      pre.appendChild(code);
      frag.appendChild(pre);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      add(`h${Math.min(heading[1].length + 1, 6)}`, 'gy-md__h', heading[2].trim());
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line) || /^\s*---+\s*$/.test(line)) {
      frag.appendChild(document.createElement('hr')).className = 'gy-md__rule';
      i++;
      continue;
    }

    /* A table is a header row followed by a divider; without the divider the
       pipes are just punctuation in a sentence. */
    if (line.includes('|') && isDivider(lines[i + 1] ?? '')) {
      const table = document.createElement('table');
      table.className = 'gy-md__table';
      const head = table.createTHead().insertRow();
      for (const c of cells(line)) inline(head.appendChild(document.createElement('th')), c);
      i += 2;
      const body = table.createTBody();
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const row = body.insertRow();
        for (const c of cells(lines[i])) inline(row.insertCell(), c);
        i++;
      }
      const scroller = document.createElement('div');
      scroller.className = 'gy-md__scroll';
      scroller.appendChild(table);
      frag.appendChild(scroller);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      /*
       * Each line of a blockquote keeps its own line, which CommonMark would
       * not do — it folds them into one paragraph, and so does GitHub. Every
       * report here opens with a quoted band of one fact per line, and none of
       * them uses the two-trailing-spaces hard break, so folding produces
       * "…🟡 2 Дата разбора: 2026-08-03", which is the run-on this reader
       * exists to avoid. Prose paragraphs are still folded: they are written
       * one line per paragraph, so a break inside one really is a wrap.
       */
      const quote = add('blockquote', 'gy-md__quote');
      body.forEach((text, n) => {
        if (n) quote.appendChild(document.createElement('br'));
        inline(quote, text.trim());
      });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/;
    const number = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || number.test(line)) {
      const ordered = !bullet.test(line);
      const re = ordered ? number : bullet;
      const list = document.createElement(ordered ? 'ol' : 'ul');
      list.className = 'gy-md__list';
      while (i < lines.length && re.test(lines[i])) {
        const item = document.createElement('li');
        let text = lines[i].match(re)[1];
        /* A task list keeps its box, unticked or ticked — several reports end
           on checks that were never run, and that is information. */
        const task = text.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const box = document.createElement('input');
          box.type = 'checkbox';
          box.disabled = true;
          box.checked = task[1].toLowerCase() === 'x';
          item.appendChild(box);
          item.classList.add('is-task');
          text = task[2];
        }
        inline(item, text);
        list.appendChild(item);
        i++;
      }
      frag.appendChild(list);
      continue;
    }

    /* A paragraph runs to the next blank line or the next block that starts
       one of its own. */
    const body = [];
    while (
      i < lines.length && lines[i].trim()
      && !/^\s*(#{1,6}\s|>|```)/.test(lines[i])
      && !bullet.test(lines[i]) && !number.test(lines[i])
      && !/^\s*---+\s*$/.test(lines[i])
      && !(lines[i].includes('|') && isDivider(lines[i + 1] ?? ''))
    ) body.push(lines[i++]);
    if (body.length) add('p', 'gy-md__p', body.join(' '));
    else i++;
  }

  return frag;
}
