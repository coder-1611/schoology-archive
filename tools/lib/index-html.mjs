// Builds the mirror landing page (`_mirror/index.html`) — a categorized course
// list, not a flat URL dump. Reads manifests from <dataDir>/<courseId>/manifest.json
// and uses the actual files present under <dataDir>/_mirror/pages/ to decide
// which links to surface for each course.

import fs from 'node:fs/promises';
import path from 'node:path';

const ESC = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const SOURCE_ORDER = ['current', 'active', 'past', 'archived', 'manual', 'unknown'];
const SOURCE_LABEL = {
  current:  'Active courses',
  active:   'Active courses',
  past:     'Past courses',
  archived: 'Archived courses',
  manual:   'Other courses',
  unknown:  'Other courses',
};

async function readManifest(dataDir, courseId) {
  try {
    const raw = await fs.readFile(path.join(dataDir, courseId, 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

// Tabs we link to per course, in display order. Each is a (path, label) pair
// resolved against _mirror/pages/course/<id>/.
const TABS = [
  ['materials.html', 'Materials'],
  ['info.html',      'Info'],
  ['updates.html',   'Updates'],
  ['calendar.html',  'Calendar'],
];

async function presentTabs(mirrorRoot, courseId) {
  const out = [];
  for (const [rel, label] of TABS) {
    if (await fileExists(path.join(mirrorRoot, 'pages', 'course', courseId, rel))) {
      out.push({ href: `/mirror/pages/course/${courseId}/${rel}`, label });
    }
  }
  // Overview page (course/<id>.html) — fallback landing if materials isn't mirrored
  if (await fileExists(path.join(mirrorRoot, 'pages', 'course', `${courseId}.html`))) {
    out.unshift({ href: `/mirror/pages/course/${courseId}.html`, label: 'Overview' });
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.dataDir       Path to `data/` (containing per-course manifests)
 * @param {string} opts.mirrorRoot    Path to `data/_mirror/`
 * @param {Array<{id:string,title:string,source:string}>=} opts.courses
 *        Optional course list (used by mirror.mjs which already enumerated them).
 *        When omitted, we glob each course dir under dataDir for a manifest.
 * @param {string[]=} opts.targets    Optional full target URL list (added to the
 *        appendix "all pages" disclosure for completeness).
 */
export async function buildIndexHtml({ dataDir, mirrorRoot, courses, targets }) {
  // Discover courses if caller didn't pass them
  if (!courses) {
    const ents = await fs.readdir(dataDir, { withFileTypes: true });
    const found = [];
    for (const ent of ents) {
      if (!ent.isDirectory() || ent.name.startsWith('_')) continue;
      const m = await readManifest(dataDir, ent.name);
      if (m && m.id) found.push({ id: m.id, title: m.title || `Course ${ent.name}`, source: m.source || 'unknown' });
    }
    courses = found;
  }

  // Backfill title/source from manifests when available — manifests usually
  // have nicer titles than the enumerated index.
  const enriched = await Promise.all(courses.map(async (c) => {
    const m = await readManifest(dataDir, c.id);
    return {
      id: c.id,
      title: (m && m.title) || c.title || `Course ${c.id}`,
      source: c.source || (m && m.source) || 'unknown',
      tabs: await presentTabs(mirrorRoot, c.id),
    };
  }));

  // Group by source
  const groups = new Map();
  for (const c of enriched) {
    const key = SOURCE_ORDER.includes(c.source) ? c.source : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  // Sort each group alphabetically by title
  for (const list of groups.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }

  const totalCourses = enriched.length;
  const totalWithMirror = enriched.filter((c) => c.tabs.length > 0).length;
  const snapshotDate = new Date().toLocaleString();

  const html = [];
  html.push(`<!doctype html>
<meta charset="utf-8">
<title>Schoology Mirror</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
         max-width: 900px; margin: 2.2rem auto; padding: 0 1.4rem; color: #1a1a1a; }
  h1 { font-size: 1.55rem; margin: 0 0 0.2rem; }
  h2 { font-size: 1.05rem; margin: 1.8rem 0 0.4rem; color: #444;
       border-bottom: 1px solid #e5e5e5; padding-bottom: 0.25rem; }
  .meta { color: #666; font-size: 13px; margin-bottom: 0.4rem; }
  ul.courses { list-style: none; padding: 0; margin: 0; }
  ul.courses li { padding: 6px 0; border-bottom: 1px solid #f1f1f1; }
  ul.courses li:last-child { border-bottom: none; }
  .title { font-weight: 600; color: #111; }
  .title a { color: inherit; text-decoration: none; }
  .title a:hover { text-decoration: underline; color: #1a4fcf; }
  .tabs { font-size: 13px; color: #888; margin-left: 0.6rem; }
  .tabs a { color: #555; text-decoration: none; padding: 0 0.25rem; }
  .tabs a:hover { color: #1a4fcf; text-decoration: underline; }
  .id { font-size: 11px; color: #aaa; font-family: ui-monospace, Menlo, monospace; }
  details { margin-top: 2.4rem; color: #666; }
  details summary { cursor: pointer; font-size: 13px; }
  details ul { font-size: 12px; line-height: 1.4; max-height: 360px; overflow: auto;
               border: 1px solid #eee; padding: 0.6rem 1.2rem; margin-top: 0.6rem; }
</style>
<h1>Schoology Archive</h1>
<p class="meta">${ESC(totalCourses)} courses · ${ESC(totalWithMirror)} with mirrored content · snapshot ${ESC(snapshotDate)}</p>`);

  // Render each group in canonical order
  for (const key of SOURCE_ORDER) {
    const list = groups.get(key);
    if (!list || list.length === 0) continue;
    html.push(`<h2>${ESC(SOURCE_LABEL[key])} (${list.length})</h2>`);
    html.push(`<ul class="courses">`);
    for (const c of list) {
      // Pick the best primary landing: materials > overview > first available tab > nothing
      let primary = c.tabs.find((t) => t.label === 'Materials')
                 || c.tabs.find((t) => t.label === 'Overview')
                 || c.tabs[0];
      const titleHtml = primary
        ? `<a href="${ESC(primary.href)}">${ESC(c.title)}</a>`
        : ESC(c.title);
      const tabsHtml = c.tabs.length
        ? `<span class="tabs">${c.tabs.map((t) => `<a href="${ESC(t.href)}">${ESC(t.label)}</a>`).join(' · ')}</span>`
        : `<span class="tabs" style="color:#bbb">(not yet mirrored)</span>`;
      html.push(`<li><span class="title">${titleHtml}</span> ${tabsHtml} <span class="id">${ESC(c.id)}</span></li>`);
    }
    html.push(`</ul>`);
  }

  // Appendix: flat list of all mirrored URLs, collapsed by default
  if (targets && targets.length) {
    html.push(`<details><summary>All ${targets.length} mirrored pages (flat list)</summary><ul>`);
    for (const url of targets) {
      // We rely on the caller having already computed pageLocalPath compatible
      // hrefs if needed, but for the simple case just link the URL → /mirror/
      // form mirror.mjs already uses.
      html.push(`<li><a href="${ESC(url.href || url)}">${ESC(url.url || url)}</a></li>`);
    }
    html.push(`</ul></details>`);
  }

  return html.join('\n');
}
