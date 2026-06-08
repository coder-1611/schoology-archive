#!/usr/bin/env node
// Build per-course static "everything in this course" pages from manifests.
// The mirrored Schoology materials.html relies on JS that doesn't run offline,
// so the file/link tree is invisible. This generator walks each manifest and
// emits a flat, browseable tree at `_mirror/courses/<id>.html` plus an entry
// in the main course index linking to it.
//
// Usage:
//   node tools/build-course-pages.mjs              # all courses
//   node tools/build-course-pages.mjs <courseId>   # one course

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';

const ESC = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const TYPE_ICON = {
  folder: '📁',
  document: '📄',
  page: '📝',
  assignment: '📋',
  link: '🔗',
  discussion: '💬',
  assessment: '🧪',
  external_tool: '🧩',
  media_album: '🖼️',
};

// Map a Schoology href to its mirrored local path (mirroring the same scheme
// `lib/mirror.mjs`'s pageLocalPath uses: query strings become `__q_<k>_<v>`).
function localMirrorPath(href) {
  try {
    const u = new URL(href);
    let p = u.pathname.replace(/\/+$/, '');
    if (u.search) {
      const params = new URLSearchParams(u.search);
      const parts = [];
      for (const [k, v] of params) parts.push(`${k}_${v}`);
      p += '__q_' + parts.join('_');
    }
    return `/mirror/pages${p}.html`;
  } catch {
    return null;
  }
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function renderTree(items, mirrorRoot, depth = 0) {
  if (!items || !items.length) return '';
  const lines = [];
  lines.push(`<ul class="tree depth-${depth}">`);
  for (const it of items) {
    const icon = TYPE_ICON[it.type] || '·';
    const title = ESC(it.title || '(untitled)');
    const cls = `item type-${it.type || 'unknown'}`;

    // Decide what to link to:
    //   - folder: link to the mirrored folder page if available
    //   - document with localPath: link to the downloaded file on disk
    //   - everything else: link to the mirrored Schoology page if it exists
    let href = null;
    let extra = '';

    if (it.localPath) {
      // Downloaded file (PDF, doc, etc) — link to the file directly
      href = '/file/' + (it._courseId || '') + '/' + it.localPath.split(path.sep).join('/');
      extra = `<span class="badge">file</span>`;
    } else if (it.href) {
      const mirrored = localMirrorPath(it.href);
      if (mirrored) href = mirrored;
    }

    if (href) {
      lines.push(`<li class="${cls}"><span class="icon">${icon}</span> <a href="${ESC(href)}">${title}</a>${extra}</li>`);
    } else {
      lines.push(`<li class="${cls}"><span class="icon">${icon}</span> ${title}${extra}</li>`);
    }

    if (it.children && it.children.length) {
      lines.push(renderTree(it.children, mirrorRoot, depth + 1));
    }
  }
  lines.push(`</ul>`);
  return lines.join('\n');
}

// Recursively attach courseId to every nested item so leaf items can build
// /file/<courseId>/<localPath> URLs without losing context.
function tagCourseId(items, courseId) {
  for (const it of (items || [])) {
    it._courseId = courseId;
    if (it.children) tagCourseId(it.children, courseId);
  }
}

function pageHtml(courseId, manifest, treeHtml) {
  const title = manifest.title || `Course ${courseId}`;
  const source = manifest.source || 'unknown';
  const total = manifest.downloaded ?? '?';
  return `<!doctype html>
<meta charset="utf-8">
<title>${ESC(title)} — Schoology Archive</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
         max-width: 980px; margin: 1.8rem auto; padding: 0 1.2rem; color: #1a1a1a; }
  header { border-bottom: 1px solid #e5e5e5; padding-bottom: 0.7rem; margin-bottom: 1rem; }
  header h1 { font-size: 1.3rem; margin: 0; }
  header p { font-size: 12px; color: #666; margin: 0.3rem 0 0; }
  header .nav { margin-top: 0.4rem; font-size: 12px; }
  header .nav a { color: #1a4fcf; text-decoration: none; }
  header .nav a:hover { text-decoration: underline; }
  ul.tree { list-style: none; padding-left: 1.2rem; margin: 0.3rem 0; border-left: 1px solid #f0f0f0; }
  ul.tree.depth-0 { padding-left: 0; border-left: none; }
  ul.tree li { padding: 3px 0; }
  ul.tree li.type-folder { font-weight: 600; margin-top: 0.5rem; }
  ul.tree li a { color: #1a4fcf; text-decoration: none; }
  ul.tree li a:hover { text-decoration: underline; }
  .icon { display: inline-block; width: 1.3em; text-align: center; }
  .badge { display: inline-block; margin-left: 0.5em; padding: 1px 6px; font-size: 10px;
           background: #eef; color: #335; border-radius: 8px; vertical-align: middle; }
  .empty { color: #999; font-style: italic; }
</style>
<header>
  <h1>${ESC(title)}</h1>
  <p>${ESC(source)} course · ${ESC(courseId)} · ${ESC(total)} items downloaded</p>
  <p class="nav">
    <a href="/mirror/index.html">← All courses</a> ·
    <a href="/mirror/grades/${ESC(courseId)}.html">Grades</a> ·
    <a href="/mirror/pages/course/${ESC(courseId)}/materials.html">Schoology materials view</a> ·
    <a href="/mirror/pages/course/${ESC(courseId)}/updates.html">Updates</a> ·
    <a href="/mirror/pages/course/${ESC(courseId)}/info.html">Info</a>
  </p>
</header>
${treeHtml || '<p class="empty">No materials recorded in manifest.</p>'}
`;
}

async function buildOne(courseId, dataDir, mirrorRoot) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(dataDir, courseId, 'manifest.json'), 'utf8'));
  } catch {
    console.warn(`  ! ${courseId}: no manifest, skipping`);
    return null;
  }
  tagCourseId(manifest.materials, courseId);
  const tree = renderTree(manifest.materials, mirrorRoot);
  const html = pageHtml(courseId, manifest, tree);
  const outDir = path.join(mirrorRoot, 'courses');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${courseId}.html`);
  await fs.writeFile(outPath, html);
  return outPath;
}

async function main() {
  const config = loadConfig();
  const mirrorRoot = path.join(config.dataDir, '_mirror');
  const onlyOne = process.argv[2];

  let courseIds;
  if (onlyOne) {
    courseIds = [onlyOne];
  } else {
    const ents = await fs.readdir(config.dataDir, { withFileTypes: true });
    courseIds = ents
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name);
  }

  let built = 0;
  for (const id of courseIds) {
    const out = await buildOne(id, config.dataDir, mirrorRoot);
    if (out) { built++; console.log(`  ✓ ${out}`); }
  }
  console.log(`\nBuilt ${built} course page(s) at ${path.join(mirrorRoot, 'courses')}/`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
