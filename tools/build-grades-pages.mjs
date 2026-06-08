#!/usr/bin/env node
// Render the scraped grades.json files into browseable HTML pages in the mirror:
//   - _mirror/grades/index.html     — summary across all courses
//   - _mirror/grades/<id>.html      — per-course breakdown (periods → categories → items)
//
// Usage:
//   node tools/build-grades-pages.mjs            # all courses with grades.json
//   node tools/build-grades-pages.mjs <id> ...   # specific courses (still rebuilds index)

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';

const ESC = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const TYPE_ICON = {
  course:   '📊',
  period:   '🗓️',
  category: '📚',
  item:     '✏️',
};

async function readJson(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}

// Apply manual overrides from data/<cid>/grades.overrides.json onto grades.rows.
// Matches by case-insensitive substring of `item.match` against the row title;
// first hit wins. Marks the row with `_override: true` and copies the note for
// rendering so users can see what was changed. Returns the same grades object
// (mutated) with `_hasOverrides` set if any override took effect.
function applyOverrides(grades, overrides) {
  if (!overrides || !Array.isArray(overrides.items) || !grades || !Array.isArray(grades.rows)) return grades;
  let applied = 0;
  for (const ov of overrides.items) {
    if (!ov || !ov.match) continue;
    const needle = String(ov.match).toLowerCase();
    for (const r of grades.rows) {
      if (r.type !== 'item') continue;
      if (r._override) continue; // already overridden by an earlier entry
      if (String(r.title || '').toLowerCase().includes(needle)) {
        if (ov.grade !== undefined) r.grade = String(ov.grade);
        if (ov.max !== undefined) r.max = String(ov.max);
        r._override = true;
        if (ov.note) r._overrideNote = ov.note;
        applied++;
        break;
      }
    }
  }
  if (applied > 0) grades._hasOverrides = true;
  return grades;
}

// Recompute summary fields (items_graded, avg_percent) from possibly-overridden
// rows. Uses the same scoring rules as scrape-grades.py: when an item has no
// explicit max, assume 100. This keeps the all-courses index consistent
// whether overrides have been applied or not.
function recomputeSummary(grades) {
  if (!grades || !Array.isArray(grades.rows)) return grades;
  const items = grades.rows.filter((r) => r.type === 'item');
  const graded = items.filter((r) => r.grade && r.grade !== '—' && r.grade !== 'Exempt');
  let awarded = 0, total = 0;
  for (const r of graded) {
    const a = parseFloat(r.grade);
    if (Number.isNaN(a)) continue;
    const m = r.max ? parseFloat(r.max) : 100;
    if (!m) continue;
    awarded += a;
    total += m;
  }
  grades.summary = {
    ...grades.summary,
    items_total: items.length,
    items_graded: graded.length,
    avg_percent: total ? +(100 * awarded / total).toFixed(2) : null,
  };
  return grades;
}

async function findCourses(dataDir) {
  const out = [];
  const ents = await fs.readdir(dataDir, { withFileTypes: true });
  for (const e of ents) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    if ((await readJson(path.join(dataDir, e.name, 'grades.json'))) !== null) {
      out.push(e.name);
    }
  }
  return out;
}

function pillColor(pct) {
  if (pct == null) return '#999';
  if (pct >= 95) return '#1e7e34';
  if (pct >= 90) return '#3a8c1c';
  if (pct >= 80) return '#a07a00';
  if (pct >= 70) return '#b8651a';
  return '#a02020';
}

function fmtGrade(row) {
  if (row.grade == null || row.grade === '') return '—';
  if (row.grade === '—') return '—';
  if (row.grade === 'Exempt') return 'Exempt';
  if (row.max) return `${row.grade} / ${row.max}`;
  return row.grade;
}

function rowPercent(row) {
  if (!row.grade || row.grade === '—' || row.grade === 'Exempt') return null;
  const a = parseFloat(row.grade);
  if (Number.isNaN(a)) return null;
  // Only compute a percent when we know the max — otherwise the raw score
  // could be on any scale (Schoology omits max for some quiz/test items)
  // and assuming 100 is wrong.
  if (!row.max) return null;
  const m = parseFloat(row.max);
  if (!m) return null;
  return (100 * a) / m;
}

// Schoology's own reported course grade (string like "96.5%") parsed as a number,
// or null if not present.
function parseCourseGradePercent(s) {
  if (!s) return null;
  const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

// Prefer Schoology's reported course_grade. If overrides have been applied,
// the Schoology number is stale, so use the (override-aware) computed avg.
function bestAvg(summary, grades) {
  if (grades && grades._hasOverrides && summary.avg_percent != null) {
    return { pct: summary.avg_percent, source: 'override' };
  }
  const reported = parseCourseGradePercent(summary.course_grade);
  if (reported != null) return { pct: reported, source: 'reported' };
  if (summary.avg_percent != null) return { pct: summary.avg_percent, source: 'computed' };
  return { pct: null, source: 'none' };
}

function renderRows(rows) {
  const out = [];
  for (const r of rows) {
    const icon = TYPE_ICON[r.type] || '·';
    const indent = `style="padding-left:${0.8 * (r.depth || 0)}rem"`;
    const grade = fmtGrade(r);
    const pct = rowPercent(r);
    const gradeColor = pillColor(pct);
    const classes = ['row', `type-${r.type}`];
    if (r.type === 'course') classes.push('row-course');
    if (r.type === 'period') classes.push('row-period');
    if (r.type === 'category') classes.push('row-category');
    const overrideBadge = r._override
      ? ` <span class="override-badge" title="${ESC(r._overrideNote || 'manual override')}">override</span>`
      : '';
    out.push(
      `<tr class="${classes.join(' ')}${r._override ? ' is-override' : ''}">` +
      `<td ${indent} class="title-cell"><span class="icon">${icon}</span> ${ESC(r.title || '(untitled)')}${overrideBadge}</td>` +
      `<td class="grade-cell" style="color:${gradeColor}">${ESC(grade)}</td>` +
      `</tr>`
    );
  }
  return out.join('\n');
}

function coursePage(courseId, manifest, grades) {
  const title = (manifest && manifest.title) || `Course ${courseId}`;
  const source = (manifest && manifest.source) || 'unknown';
  const s = grades.summary;
  const best = bestAvg(s, grades);
  const avgStr = best.pct != null ? `${best.pct.toFixed(2)}%` : '—';
  const avgLabel = best.source === 'override' ? 'recomputed w/ overrides'
                : best.source === 'reported' ? 'Schoology grade'
                : best.source === 'computed' ? 'computed avg'
                : '';
  const courseGrade = s.course_grade && s.course_grade !== '—' ? s.course_grade : null;
  return `<!doctype html>
<meta charset="utf-8">
<title>${ESC(title)} — Grades</title>
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
  .summary { display: inline-block; background: #f5f7fa; padding: 0.5rem 0.9rem;
             border-radius: 8px; font-size: 13px; margin-top: 0.5rem; }
  .summary strong { font-size: 1.05rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 0.8rem; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #f1f1f1;
           vertical-align: top; }
  th { font-size: 11px; color: #999; font-weight: 500; text-transform: uppercase;
       letter-spacing: 0.04em; }
  .row-course .title-cell { font-weight: 700; }
  .row-period .title-cell { font-weight: 600; background: #fafafa; }
  .row-category .title-cell { font-weight: 500; color: #555; }
  .grade-cell { font-family: ui-monospace, Menlo, monospace; white-space: nowrap;
                font-variant-numeric: tabular-nums; text-align: right; width: 12em; }
  .icon { display: inline-block; width: 1.4em; text-align: center; }
  .empty { color: #999; font-style: italic; padding: 1rem 0; }
  .override-badge { display: inline-block; margin-left: 0.5em; padding: 1px 6px;
                    font-size: 10px; background: #fff3cd; color: #856404;
                    border: 1px solid #ffeeba; border-radius: 8px;
                    vertical-align: middle; }
  tr.is-override .grade-cell { background: #fffbeb; }
</style>
<header>
  <h1>${ESC(title)}</h1>
  <p>${ESC(source)} course · ${ESC(courseId)} · scraped ${ESC(grades.scrapedAt)}</p>
  <p class="nav">
    <a href="/mirror/grades/index.html">← All grades</a> ·
    <a href="/mirror/courses/${ESC(courseId)}.html">Files & Links</a> ·
    <a href="/mirror/index.html">All courses</a>
  </p>
  <div class="summary">
    <strong>${ESC(avgStr)}</strong>${avgLabel ? ` <span style="color:#888">(${avgLabel})</span>` : ''} &nbsp;·&nbsp;
    ${s.items_graded} / ${s.items_total} items graded${
      best.source === 'computed' && s.avg_percent != null
        ? ' &nbsp;·&nbsp; <span style="color:#888">no Schoology-reported grade for this course</span>'
        : ''
    }
  </div>
</header>
${grades.rows.length === 0
  ? '<p class="empty">No grades recorded for this course.</p>'
  : `<table>
  <thead><tr><th>Item</th><th style="text-align:right">Grade</th></tr></thead>
  <tbody>
  ${renderRows(grades.rows)}
  </tbody>
</table>`}
`;
}

function indexPage(courses) {
  // Sort by best-available average desc (no-grade last)
  const sorted = [...courses].sort((a, b) => {
    const av = bestAvg(a.grades.summary, a.grades).pct;
    const bv = bestAvg(b.grades.summary, b.grades).pct;
    if (av == null && bv == null) return a.title.localeCompare(b.title);
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });

  const withGrades = sorted.filter((c) => bestAvg(c.grades.summary, c.grades).pct != null);
  const without = sorted.filter((c) => bestAvg(c.grades.summary, c.grades).pct == null);

  // Overall = simple mean of per-course best percentages, but only counting
  // courses that actually have graded items. A course can have a hollow
  // course_grade reported by Schoology with 0 underlying item scores
  // (e.g. legacy data, partial enrollment) — those are excluded from the mean.
  const courseAvgs = withGrades
    .filter((c) => c.grades.summary.items_graded > 0)
    .map((c) => bestAvg(c.grades.summary, c.grades).pct)
    .filter((p) => p != null);
  const overall = courseAvgs.length
    ? courseAvgs.reduce((a, b) => a + b, 0) / courseAvgs.length
    : null;

  const renderRow = (c) => {
    const s = c.grades.summary;
    const best = bestAvg(s, c.grades);
    const color = pillColor(best.pct);
    const avgStr = best.pct != null ? `${best.pct.toFixed(2)}%` : '—';
    const srcBadge = best.source === 'override'
      ? ' <span style="font-size:9px;color:#856404">★</span>'
      : best.source === 'computed' ? ' <span style="font-size:9px;color:#999">(calc)</span>'
      : '';
    return `<tr>
      <td><a href="/mirror/grades/${ESC(c.courseId)}.html"><strong>${ESC(c.title)}</strong></a>
          <div class="meta">${ESC(c.source)} · ${ESC(c.courseId)}</div></td>
      <td class="grade-cell" style="color:${color}">${ESC(avgStr)}${srcBadge}</td>
      <td class="count-cell">${s.items_graded} / ${s.items_total}</td>
    </tr>`;
  };

  return `<!doctype html>
<meta charset="utf-8">
<title>Grades — Schoology Archive</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
         max-width: 980px; margin: 2rem auto; padding: 0 1.4rem; color: #1a1a1a; }
  header { border-bottom: 1px solid #e5e5e5; padding-bottom: 0.7rem; margin-bottom: 1rem; }
  header h1 { font-size: 1.5rem; margin: 0; }
  header .nav { margin-top: 0.4rem; font-size: 12px; }
  header .nav a { color: #1a4fcf; text-decoration: none; }
  header .nav a:hover { text-decoration: underline; }
  .overall { display: inline-block; background: #f5f7fa; padding: 0.7rem 1.1rem;
             border-radius: 10px; font-size: 14px; margin: 0.6rem 0 1rem; }
  .overall strong { font-size: 1.4rem; color: ${pillColor(overall)}; }
  h2 { font-size: 1.05rem; margin: 1.5rem 0 0.4rem; color: #444; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #f1f1f1;
           vertical-align: top; }
  th { font-size: 11px; color: #999; font-weight: 500; text-transform: uppercase; }
  .meta { color: #999; font-size: 11px; font-family: ui-monospace, monospace; margin-top: 1px; }
  .grade-cell { font-family: ui-monospace, monospace; white-space: nowrap;
                font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; width: 8em; }
  .count-cell { font-family: ui-monospace, monospace; color: #666; font-size: 12px;
                text-align: right; width: 6em; }
  a { color: #111; text-decoration: none; }
  a:hover { text-decoration: underline; color: #1a4fcf; }
</style>
<header>
  <h1>Grades</h1>
  <p class="nav"><a href="/mirror/index.html">← All courses</a></p>
  ${overall != null ? `<div class="overall">Mean across ${courseAvgs.length} courses: <strong>${overall.toFixed(2)}%</strong></div>` : ''}
</header>

${withGrades.length ? `<h2>Courses with recorded grades (${withGrades.length})</h2>
<table>
  <thead><tr><th>Course</th><th style="text-align:right">Average</th><th style="text-align:right">Items</th></tr></thead>
  <tbody>
  ${withGrades.map(renderRow).join('\n  ')}
  </tbody>
</table>` : ''}

${without.length ? `<h2>Courses with no recorded grades (${without.length})</h2>
<table>
  <thead><tr><th>Course</th><th style="text-align:right">Average</th><th style="text-align:right">Items</th></tr></thead>
  <tbody>
  ${without.map(renderRow).join('\n  ')}
  </tbody>
</table>` : ''}
`;
}

async function main() {
  const config = loadConfig();
  const dataDir = config.dataDir;
  const mirrorRoot = path.join(dataDir, '_mirror');
  const onlyIds = process.argv.slice(2);

  const allIds = onlyIds.length ? onlyIds : await findCourses(dataDir);
  if (!allIds.length) {
    console.warn('No courses with grades.json found. Run tools/scrape-grades.py first.');
    return;
  }

  const outDir = path.join(mirrorRoot, 'grades');
  await fs.mkdir(outDir, { recursive: true });

  // Build per-course pages + collect for index
  const courses = [];
  for (const cid of allIds) {
    const grades = recomputeSummary(applyOverrides(
      await readJson(path.join(dataDir, cid, 'grades.json')),
      await readJson(path.join(dataDir, cid, 'grades.overrides.json'))
    ));
    if (!grades) continue;
    const manifest = await readJson(path.join(dataDir, cid, 'manifest.json'));
    const html = coursePage(cid, manifest, grades);
    await fs.writeFile(path.join(outDir, `${cid}.html`), html);
    courses.push({
      courseId: cid,
      title: (manifest && manifest.title) || `Course ${cid}`,
      source: (manifest && manifest.source) || 'unknown',
      grades,
    });
    console.log(`  ✓ grades/${cid}.html`);
  }

  // If we're doing a subset, still rebuild the index from ALL grades.json files
  // so we don't accidentally drop courses from the index.
  if (onlyIds.length) {
    const fullList = await findCourses(dataDir);
    const all = [];
    for (const cid of fullList) {
      const grades = recomputeSummary(applyOverrides(
      await readJson(path.join(dataDir, cid, 'grades.json')),
      await readJson(path.join(dataDir, cid, 'grades.overrides.json'))
    ));
      if (!grades) continue;
      const manifest = await readJson(path.join(dataDir, cid, 'manifest.json'));
      all.push({
        courseId: cid,
        title: (manifest && manifest.title) || `Course ${cid}`,
        source: (manifest && manifest.source) || 'unknown',
        grades,
      });
    }
    await fs.writeFile(path.join(outDir, 'index.html'), indexPage(all));
  } else {
    await fs.writeFile(path.join(outDir, 'index.html'), indexPage(courses));
  }

  console.log(`\nWrote ${courses.length} per-course pages + grades/index.html to ${outDir}/`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
