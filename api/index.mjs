// Vercel entrypoint for the Schoology archive viewer.
//
// The archive itself (10 GB) can't live inside a serverless function, so this
// app serves everything out of the public GitHub repo: small/rewritable files
// are proxied through the function, large binaries redirect to raw content.
// File-existence checks and folder listings come from api/data-index.json
// (built from `git ls-files tools/data`), course metadata from api/courses.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';

const RAW_BASE = 'https://raw.githubusercontent.com/coder-1611/schoology-archive/main/tools/data/';
const PASSWORD = process.env.ARCHIVE_PASSWORD || 'Soham@123';
const PROXY_LIMIT = 4 * 1024 * 1024; // Vercel response cap is 4.5 MB; redirect anything bigger

const PATHS = new Set(JSON.parse(fs.readFileSync(new URL('./data-index.json', import.meta.url), 'utf8')));
const COURSES = JSON.parse(fs.readFileSync(new URL('./courses.json', import.meta.url), 'utf8'));

// Directory set derived from file paths (git tracks only files).
const DIRS = new Set(['']);
for (const p of PATHS) {
  const segs = p.split('/');
  for (let i = 1; i < segs.length; i++) DIRS.add(segs.slice(0, i).join('/'));
}

const app = express();

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
<header><h1><a href="/">📚 Schoology Archive</a></h1></header>
${body}
</body></html>`;
}

// ---------- auth ----------

const AUTH_COOKIE = 'archive_auth';
const AUTH_TOKEN = crypto.createHash('sha256').update(`schoology-archive:${PASSWORD}`).digest('hex');

app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  if (req.path === '/login') return next();
  const cookies = Object.fromEntries((req.headers.cookie || '')
    .split(';').map(c => c.trim().split('=').map(s => decodeURIComponent(s || ''))).filter(p => p[0]));
  if (cookies[AUTH_COOKIE] === AUTH_TOKEN) return next();
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
});

function loginPage(error, nextUrl) {
  return layout('Sign in', `
    <div style="max-width:340px;margin:15vh auto 0;text-align:center">
      <h1 style="margin-bottom:.25rem">🔒 Schoology Archive</h1>
      <p class="stat" style="margin-top:0">This archive is password-protected.</p>
      ${error ? '<p style="color:#b00020">Wrong password, try again.</p>' : ''}
      <form method="post" action="/login">
        <input type="hidden" name="next" value="${esc(nextUrl)}">
        <input type="password" name="password" placeholder="Password" autofocus required
          style="width:100%;box-sizing:border-box;padding:.55rem .7rem;font-size:15px;border:1px solid #ccc;border-radius:6px">
        <button type="submit"
          style="margin-top:.6rem;width:100%;padding:.55rem;font-size:15px;border:0;border-radius:6px;background:#1a4fcf;color:#fff;cursor:pointer">
          Sign in</button>
      </form>
    </div>
  `);
}

const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//')) ? n : '/';

app.get('/login', (req, res) => res.send(loginPage(false, safeNext(req.query.next))));
app.post('/login', (req, res) => {
  const next = safeNext(req.body.next);
  if (req.body.password !== PASSWORD) return res.status(401).send(loginPage(true, next));
  const secure = process.env.VERCEL ? ' Secure;' : '';
  res.set('Set-Cookie', `${AUTH_COOKIE}=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=2592000`);
  res.redirect(next);
});

// ---------- GitHub-backed data access ----------

const rawUrl = rel => RAW_BASE + rel.split('/').map(encodeURIComponent).join('/');

const MIME = {
  html: 'text/html; charset=utf-8', css: 'text/css', js: 'application/javascript',
  mjs: 'application/javascript', json: 'application/json', pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
  txt: 'text/plain; charset=utf-8', url: 'text/plain; charset=utf-8',
};
const mimeFor = rel => MIME[(rel.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

const manifestCache = new Map();
async function fetchManifest(id) {
  if (manifestCache.has(id)) return manifestCache.get(id);
  const r = await fetch(rawUrl(`${id}/manifest.json`));
  if (!r.ok) return null;
  const m = await r.json();
  manifestCache.set(id, m);
  return m;
}

// Proxy small files with a correct content type; redirect big ones to raw
// (raw.githubusercontent serves generic MIME, so HTML must always be proxied).
async function serveData(rel, res, transformHtml) {
  if (!PATHS.has(rel)) return res.status(404).send('not found');
  const isHtml = rel.toLowerCase().endsWith('.html');
  const r = await fetch(rawUrl(rel));
  if (!r.ok) return res.status(502).send(`upstream ${r.status}`);
  const size = Number(r.headers.get('content-length') || 0);
  if (!isHtml && size > PROXY_LIMIT) {
    r.body?.cancel?.();
    return res.redirect(rawUrl(rel));
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.set('Content-Type', mimeFor(rel));
  res.set('Cache-Control', 'public, max-age=3600');
  if (isHtml && transformHtml) return res.send(transformHtml(buf.toString('utf8')));
  res.send(buf);
}

// ---------- mirror HTML rewrites (same behavior as tools/server.mjs) ----------

function pageLocalPath(urlString) {
  const u = new URL(urlString);
  let p = u.pathname;
  if (p === '/') p = '/home';
  if (p.endsWith('/')) p += 'index';
  p = p.replace(/^\/+/, '').split('/').map(seg => seg.replace(/[\x00-\x1f<>:"|?*\\]+/g, '_')).join('/');
  if (u.search) p += `__q_${u.search.slice(1).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)}`;
  return `pages/${p}.html`;
}

function relinkMirroredPages(html) {
  return html.replace(/(href|src)="(https:\/\/[a-z0-9.-]*schoology\.com[^"]*)"/gi, (whole, attr, url) => {
    try {
      const local = pageLocalPath(url.replace(/&amp;/g, '&'));
      if (!PATHS.has(`_mirror/${local}`)) return whole;
      return `${attr}="/mirror/${local.split('/').map(encodeURIComponent).join('/')}"`;
    } catch { return whole; }
  });
}

const GRADES_NAV_SHIM = `<script>
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest && e.target.closest('button[data-sgy-sitenav="nav-trigger"]');
  if (b && /^\\s*Grades\\b/.test(b.textContent)) {
    e.preventDefault(); e.stopImmediatePropagation();
    location.href = '/grades';
  }
}, true);
</script>`;

const injectNavShim = html =>
  html.includes('data-sgy-sitenav') ? html.replace(/<\/body>/i, GRADES_NAV_SHIM + '</body>') : html;

const mirrorHtmlTransform = html => injectNavShim(relinkMirroredPages(html));

// ---------- routes (mirroring tools/server.mjs) ----------

function renderTree(items, courseId) {
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

function courseCard(c) {
  const href = PATHS.has(`_mirror/pages/course/${c.id}.html`)
    ? `/mirror/pages/course/${esc(c.id)}.html` : `/course/${esc(c.id)}`;
  const badge = c.source === 'archived' ? '<span class="badge archived">archived</span>' : '<span class="badge">active</span>';
  return `<div class="course"><a href="${href}">${esc(c.title)}</a> ${badge}
    <div class="stat"><a href="/course/${esc(c.id)}">materials</a> · <a href="/mirror/grades/${esc(c.id)}.html">grades</a></div></div>`;
}

function courseListPage(title) {
  const grouped = { active: [], archived: [], other: [] };
  for (const c of COURSES) (grouped[c.source] || grouped.other).push(c);
  const section = (label, list) => list.length
    ? `<h2>${label} (${list.length})</h2><div class="courses">${list.map(courseCard).join('')}</div>` : '';
  return layout(title, `
    <h1>${esc(title)}</h1>
    <p class="stat"><a href="/mirror/pages/home.html">dashboard</a> · <a href="/mirror/grades/index.html">grades</a> · <a href="/mirror/index.html">course index</a></p>
    ${section('Active', grouped.active)}${section('Archived', grouped.archived)}${section('Other', grouped.other)}
  `);
}

app.get('/', (_req, res) => res.send(courseListPage('Schoology Archive')));
app.get(['/courses', '/courses/*'], (_req, res) => res.send(courseListPage('My Courses')));
app.get(['/grades', '/grades/*'], (_req, res) => res.redirect('/mirror/grades/index.html'));

app.get('/course/:id', async (req, res) => {
  const id = req.params.id.replace(/[^0-9a-zA-Z_-]/g, '');
  const manifest = await fetchManifest(id);
  if (!manifest) return res.status(404).send(layout('Not found', '<p>Course not found.</p>'));
  const badge = manifest.source === 'archived' ? '<span class="badge archived">archived</span>' : '<span class="badge">active</span>';
  res.send(layout(manifest.title, `
    <h1 style="margin-bottom:0">${esc(manifest.title)} ${badge}</h1>
    <p class="stat">Course ${esc(manifest.id)} · ${manifest.downloaded || 0} files saved${manifest.failed ? `, ${manifest.failed} failed` : ''}</p>
    ${renderTree(manifest.materials, manifest.id)}
  `));
});

app.get('/file/:id/*', async (req, res) => {
  const id = req.params.id.replace(/[^0-9a-zA-Z_-]/g, '');
  const rel = (req.params[0] || '').replace(/\/+$/, '');
  const full = rel ? `${id}/${rel}` : id;
  if (full.split('/').some(s => s === '..' || s === '')) return res.status(400).send('bad path');

  if (DIRS.has(full)) {
    const names = new Map(); // name -> isDir
    for (const p of PATHS) {
      if (!p.startsWith(full + '/')) continue;
      const rest = p.slice(full.length + 1);
      const name = rest.split('/')[0];
      names.set(name, rest.includes('/') || names.get(name) === true);
    }
    const entries = [...names.entries()].map(([name, isDir]) => ({ name, isDir }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    const href = e => `/file/${encodeURIComponent(id)}/` +
      [...rel.split('/').filter(Boolean), e.name].map(encodeURIComponent).join('/');
    const up = rel.split('/').filter(Boolean).slice(0, -1);
    const upHref = up.length
      ? `/file/${encodeURIComponent(id)}/${up.map(encodeURIComponent).join('/')}`
      : `/course/${encodeURIComponent(id)}`;
    const list = entries.length
      ? '<ul>' + entries.map(e =>
          `<li><a href="${esc(href(e))}">${esc(e.name)}</a>` +
          `<span class="type">${e.isDir ? 'folder' : 'file'}</span></li>`).join('') + '</ul>'
      : '<p class="empty">(empty folder — nothing was scraped here)</p>';
    return res.send(layout(rel || id, `
      <h1 style="margin-bottom:0">${esc(rel.split('/').filter(Boolean).pop() || id)}</h1>
      <p class="stat"><a href="${esc(upHref)}">← up</a> · ${entries.length} item(s)</p>
      ${list}
    `));
  }

  await serveData(full, res);
});

app.get('/mirror', (_req, res) => res.redirect('/mirror/index.html'));
app.get('/mirror/index.html', (_req, res) => serveData('_mirror/index.html', res, relinkMirroredPages));
app.get('/mirror/*', (req, res) => serveData('_mirror/' + decodeURIComponent(req.params[0] || ''), res, mirrorHtmlTransform));
app.get('/schoology-archive/tools/data/_mirror/*', (req, res) =>
  serveData('_mirror/' + decodeURIComponent(req.params[0] || ''), res, mirrorHtmlTransform));

export default app;
