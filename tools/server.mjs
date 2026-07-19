#!/usr/bin/env node
// Local viewer for the archived Schoology data. Serves browse pages + raw files at
// http://localhost:<port>/.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

import { loadConfig } from './lib/config.mjs';

const config = loadConfig();
const app = express();
const DATA = config.dataDir;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 980px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  header { display: flex; align-items: baseline; gap: 1rem; border-bottom: 1px solid #eee; padding-bottom: .75rem; margin-bottom: 1rem; }
  header a { color: #555; text-decoration: none; }
  h1 { font-size: 1.4rem; margin: 0; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; }
  ul { list-style: none; padding-left: 1rem; }
  li { padding: 2px 0; }
  .badge { display: inline-block; background: #eef; color: #335; border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-left: 6px; vertical-align: middle; }
  .badge.archived { background: #fee; color: #733; }
  .type { color: #888; font-size: 12px; margin-left: 4px; }
  .empty { color: #999; font-style: italic; }
  .courses { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: .5rem; }
  .course { border: 1px solid #eee; border-radius: 6px; padding: .6rem .8rem; }
  .course a { color: #1a4fcf; text-decoration: none; font-weight: 600; }
  .stat { color: #666; font-size: 12px; }
  a { color: #1a4fcf; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style></head><body>
<header><h1><a href="/">📚 Schoology Archive</a></h1><span class="stat">${esc(config.domain)}</span></header>
${body}
</body></html>`;
}

function renderTree(items, courseId, prefix = '') {
  if (!items || !items.length) return '<p class="empty">(no items)</p>';
  return '<ul>' + items.map(it => {
    const title = esc(it.title || 'untitled');
    let inner = title;
    if (it.localPath) {
      inner = `<a href="/file/${encodeURIComponent(courseId)}/${it.localPath.split('/').map(encodeURIComponent).join('/')}" target="_blank">${title}</a>`;
    } else if (it.href) {
      inner = `<a href="${esc(it.href)}" target="_blank" rel="noopener">${title}</a>`;
    }
    let kids = '';
    if (it.type === 'folder') kids = renderTree(it.children || [], courseId);
    return `<li>${inner}<span class="type">${esc(it.type)}</span>${kids}</li>`;
  }).join('') + '</ul>';
}

app.get('/', async (_req, res) => {
  if (!fs.existsSync(DATA)) return res.status(404).send(layout('No data', '<p class="empty">No data directory yet. Run <code>npm run scrape</code> first.</p>'));
  const entries = await fsp.readdir(DATA, { withFileTypes: true });
  const courses = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(DATA, e.name, 'manifest.json');
    try {
      const m = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
      courses.push(m);
    } catch { /* skip dirs without manifest */ }
  }
  courses.sort((a, b) => (a.source === b.source ? a.title.localeCompare(b.title) : a.source.localeCompare(b.source)));

  const grouped = { active: [], archived: [], other: [] };
  for (const c of courses) (grouped[c.source] || grouped.other).push(c);

  function section(label, list) {
    if (!list.length) return '';
    return `<h2>${label} (${list.length})</h2><div class="courses">` + list.map(c => `
      <div class="course">
        <a href="/course/${esc(c.id)}">${esc(c.title)}</a>
        <div class="stat">${c.downloaded || 0} file(s)${c.failed ? `, ${c.failed} failed` : ''} · scraped ${esc((c.scrapedAt || '').slice(0, 10))}</div>
      </div>
    `).join('') + `</div>`;
  }

  res.send(layout('Schoology Archive', section('Active courses', grouped.active) + section('Archived courses', grouped.archived) + section('Other', grouped.other) || '<p class="empty">No courses scraped yet.</p>'));
});

app.get('/course/:id', async (req, res) => {
  const id = req.params.id.replace(/[^0-9a-zA-Z_-]/g, '');
  const manifestPath = path.join(DATA, id, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return res.status(404).send(layout('Not found', '<p>Course not found.</p>'));
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const badge = manifest.source === 'archived' ? '<span class="badge archived">archived</span>' : '<span class="badge">active</span>';
  res.send(layout(manifest.title, `
    <h1 style="margin-bottom:0">${esc(manifest.title)} ${badge}</h1>
    <p class="stat">Course ${esc(manifest.id)} · ${manifest.downloaded || 0} files saved${manifest.failed ? `, ${manifest.failed} failed` : ''}</p>
    ${renderTree(manifest.materials, manifest.id)}
  `));
});

// Serve raw files out of the course directory. We use a manual handler (not express.static)
// because filenames contain unicode/spaces and we want strict path scoping.
app.get('/file/:id/*', async (req, res) => {
  const id = req.params.id.replace(/[^0-9a-zA-Z_-]/g, '');
  const rel = req.params[0] || '';
  const courseDir = path.join(DATA, id);
  const target = path.resolve(courseDir, rel);
  if (!target.startsWith(path.resolve(courseDir))) return res.status(400).send('bad path');
  if (!fs.existsSync(target)) return res.status(404).send('not found');

  // Material trees link folders as well as files. sendFile can't serve a directory,
  // so browse it instead — otherwise every folder click dead-ends in a 404.
  if (fs.statSync(target).isDirectory()) {
    const entries = await fsp.readdir(target, { withFileTypes: true });
    entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    const href = e => `/file/${encodeURIComponent(id)}/` +
      [...rel.split('/').filter(Boolean), e.name].map(encodeURIComponent).join('/');
    const up = rel.split('/').filter(Boolean).slice(0, -1);
    const upHref = up.length
      ? `/file/${encodeURIComponent(id)}/${up.map(encodeURIComponent).join('/')}`
      : `/course/${encodeURIComponent(id)}`;
    const list = entries.length
      ? '<ul>' + entries.map(e =>
          `<li><a href="${esc(href(e))}">${esc(e.name)}</a>` +
          `<span class="type">${e.isDirectory() ? 'folder' : 'file'}</span></li>`).join('') + '</ul>'
      : '<p class="empty">(empty folder — nothing was scraped here)</p>';
    return res.send(layout(rel || id, `
      <h1 style="margin-bottom:0">${esc(rel.split('/').filter(Boolean).pop() || id)}</h1>
      <p class="stat"><a href="${esc(upHref)}">← up</a> · ${entries.length} item(s)</p>
      ${list}
    `));
  }

  res.sendFile(target);
});

// Serve the Schoology static mirror. Path scoping to data/_mirror prevents traversal.
const MIRROR_ROOT = path.join(DATA, '_mirror');
app.get('/mirror', (_req, res) => res.redirect('/mirror/index.html'));

// Dynamically generate the index by walking pages/ — works while mirror is mid-run.
function renderMirrorIndex() {
  const pagesRoot = path.join(MIRROR_ROOT, 'pages');
  if (!fs.existsSync(pagesRoot)) {
    return layout('Schoology Mirror', '<p class="empty">No mirror data yet. Start with: <code>npm run mirror</code></p>');
  }
  const found = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(full, r);
      else if (e.name.endsWith('.html')) found.push(r);
    }
  })(pagesRoot, '');
  found.sort();
  // Group by top-level segment for readability.
  const groups = {};
  for (const p of found) {
    const top = p.split('/')[0] || 'misc';
    (groups[top] ||= []).push(p);
  }
  const sections = Object.entries(groups).map(([g, items]) => {
    const lis = items.map(p => `<li><a href="/mirror/pages/${p.split('/').map(encodeURIComponent).join('/')}">${esc(p)}</a></li>`).join('');
    return `<h2>${esc(g)} (${items.length})</h2><ul>${lis}</ul>`;
  }).join('');
  return layout('Schoology Mirror', `<p class="stat">${found.length} page(s) mirrored so far</p>${sections}`);
}

app.get('/mirror/index.html', (_req, res) => {
  // Prefer the on-disk index.html if it exists (final post-run version);
  // otherwise generate dynamically.
  const onDisk = path.join(MIRROR_ROOT, 'index.html');
  if (fs.existsSync(onDisk)) return res.sendFile(onDisk);
  res.set('Content-Type', 'text/html; charset=utf-8').send(renderMirrorIndex());
});

app.get('/mirror/*', (req, res) => {
  const rel = decodeURIComponent(req.params[0] || '');
  const target = path.resolve(MIRROR_ROOT, rel);
  if (!target.startsWith(path.resolve(MIRROR_ROOT))) return res.status(400).send('bad path');
  if (!fs.existsSync(target)) return res.status(404).send('mirror file not found');
  res.sendFile(target);
});

// Backward-compat alias: the mirrored HTML uses GitHub-Pages-absolute paths
// (/schoology-archive/tools/data/_mirror/...) so it works when published. Serve
// the same files locally too so npm run serve keeps working.
app.get('/schoology-archive/tools/data/_mirror/*', (req, res) => {
  const rel = decodeURIComponent(req.params[0] || '');
  const target = path.resolve(MIRROR_ROOT, rel);
  if (!target.startsWith(path.resolve(MIRROR_ROOT))) return res.status(400).send('bad path');
  if (!fs.existsSync(target)) return res.status(404).send('mirror file not found');
  res.sendFile(target);
});

app.listen(config.port, () => {
  console.log(`Schoology archive viewer running:  http://localhost:${config.port}`);
});
