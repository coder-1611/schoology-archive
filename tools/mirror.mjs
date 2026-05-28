#!/usr/bin/env node
// Static-site mirror of every Schoology course page the user can access.
//
// Usage:
//   node mirror.mjs               mirror dashboard + all 44 course pages
//   node mirror.mjs --course <id> mirror dashboard + one course's pages
//   node mirror.mjs --dashboard   mirror just the /home dashboard
//
// Output goes to data/_mirror/. The local viewer (npm run serve) exposes it at
// http://localhost:3000/mirror/pages/home.html.

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadConfig, projectRoot } from './lib/config.mjs';
import { makeHttpClient } from './lib/http.mjs';
import { makeBrowserClient } from './lib/browser.mjs';
import { enumerateCourses } from './lib/courses.mjs';
import { mirrorPage, pageLocalPath } from './lib/mirror.mjs';

function parseArgs(argv) {
  const args = { courseIds: [], dashboardOnly: false, shallow: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--course') args.courseIds.push(argv[++i]);
    else if (a === '--dashboard') args.dashboardOnly = true;
    else if (a === '--shallow') args.shallow = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node mirror.mjs                 mirror dashboard + every course's pages + every item URL from manifests
  node mirror.mjs --course <id>   mirror a single course (repeat the flag for multiple)
  node mirror.mjs --dashboard     mirror only the dashboard
  node mirror.mjs --shallow       only the 5 main pages per course (skip individual items)`);
      process.exit(0);
    }
  }
  return args;
}

// Inspect all available manifests and produce a course-ID alias map. Schoology
// addresses the same course with multiple IDs (e.g. section ID 7919100090 +
// parent ID 7919100080). We pick one canonical ID per course (the one whose
// manifest exists) and map every alias seen in that manifest's URLs to it.
async function buildAliasMap(dataDir, courses) {
  const map = new Map();
  for (const c of courses) {
    const mfPath = path.join(dataDir, c.id, 'manifest.json');
    try {
      const m = JSON.parse(await fs.readFile(mfPath, 'utf8'));
      const idsSeen = new Set();
      const walk = (items) => {
        for (const it of items || []) {
          if (it.href) {
            const cm = it.href.match(/\/course\/(\d+)/);
            if (cm) idsSeen.add(cm[1]);
          }
          if (it.children) walk(it.children);
        }
      };
      walk(m.materials);
      for (const altId of idsSeen) {
        if (altId !== c.id) map.set(altId, c.id);
      }
    } catch { /* no manifest — skip */ }
  }
  return map;
}

// Walk a course's manifest.json (written by scrape.mjs) and return every item
// href that points to the Schoology domain. Returns [] if no manifest exists.
async function collectItemUrlsFromManifest(dataDir, courseId, domain) {
  const manifestPath = path.join(dataDir, courseId, 'manifest.json');
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const m = JSON.parse(raw);
    const urls = new Set();
    const walk = (items) => {
      for (const it of items || []) {
        if (it.href && it.href.startsWith(domain)) urls.add(it.href);
        if (it.children) walk(it.children);
      }
    };
    walk(m.materials);
    return [...urls];
  } catch {
    return [];
  }
}

// Per-course pages we'll mirror (relative paths joined onto config.domain).
const COURSE_PAGE_PATHS = [
  '',                 // course home
  '/materials',
  '/info',
  '/calendar',
  '/updates'
];

async function buildTargets(config, courses, args) {
  const targets = new Set();
  // Dashboard.
  targets.add(config.domain + '/home');
  if (args.dashboardOnly) return [...targets];

  // Per-course top-level pages.
  for (const c of courses) {
    for (const p of COURSE_PAGE_PATHS) {
      targets.add(config.domain + '/course/' + c.id + p);
    }
  }

  // Deep mode (default): pull every item URL from each course's manifest.json.
  if (!args.shallow) {
    let deepCount = 0;
    let missingCount = 0;
    for (const c of courses) {
      const urls = await collectItemUrlsFromManifest(config.dataDir, c.id, config.domain);
      if (!urls.length) { missingCount++; continue; }
      for (const u of urls) targets.add(u);
      deepCount += urls.length;
    }
    console.log(`Deep mode: collected ${deepCount} item URL(s) from manifests` +
                (missingCount ? `  (${missingCount} courses had no manifest — run scrape first to deepen them)` : ''));
  }
  return [...targets];
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig();
  const mirrorRoot = path.join(config.dataDir, '_mirror');

  const http = makeHttpClient(config);
  const browser = makeBrowserClient(config);

  let courses;
  if (args.dashboardOnly) courses = [];
  else if (args.courseIds.length) {
    courses = args.courseIds.map(id => ({ id, title: `Course ${id}`, source: 'manual' }));
  } else {
    console.log('Enumerating courses…');
    courses = await enumerateCourses(http, { includeArchived: config.includeArchived });
    console.log(`  found ${courses.length} courses`);
    if (courses.length === 0) {
      console.error('FATAL: 0 courses found — likely expired cookie or auth redirect to login page. Refresh SCHOOLOGY_COOKIE and retry.');
      await browser.close().catch(() => {});
      process.exit(2);
    }
  }

  // Build course-ID alias map across all courses we're about to mirror.
  const aliasMap = await buildAliasMap(config.dataDir, courses);
  if (aliasMap.size) console.log(`Alias map: ${[...aliasMap.entries()].map(([a,c]) => `${a}→${c}`).join(', ')}`);

  const targets = await buildTargets(config, courses, args);
  // Build the set of "mirrored page" URLs so that intra-mirror links resolve locally.
  const mirroredPages = new Set(targets.map(u => {
    const x = new URL(u);
    return x.origin + x.pathname.replace(/\/+$/, '') + x.search;
  }));

  console.log(`Mirror root: ${mirrorRoot}`);
  console.log(`Mirroring ${targets.length} pages…`);

  let okCount = 0, failCount = 0, skipCount = 0;
  for (let i = 0; i < targets.length; i++) {
    const url = targets[i];
    const pageAbs = path.join(mirrorRoot, pageLocalPath(url));
    try {
      await fs.access(pageAbs);
      skipCount++;
      continue; // already mirrored
    } catch { /* not yet mirrored — proceed */ }

    process.stdout.write(`  [${i + 1}/${targets.length}] ${url} … `);
    try {
      const { pageRel, assetsCaptured } = await mirrorPage(browser, http, url, { mirrorRoot, mirroredPages, aliasMap });
      console.log(`saved ${pageRel} (+${assetsCaptured} css files)`);
      okCount++;
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      failCount++;
    }
  }

  // Write a small index.html listing every mirrored page.
  const indexLines = ['<!doctype html><meta charset="utf-8"><title>Schoology Mirror</title>',
    '<style>body{font:14px/1.5 system-ui;max-width:780px;margin:2rem auto;padding:0 1rem}h1{font-size:1.2rem}a{color:#1a4fcf;text-decoration:none}a:hover{text-decoration:underline}li{padding:2px 0}</style>',
    '<h1>Schoology Mirror</h1><p>Snapshots taken on ' + new Date().toLocaleString() + '. Click any page to view the offline copy.</p><ul>'];
  for (const url of targets) {
    const local = '/mirror/' + pageLocalPath(url).split(path.sep).join('/');
    indexLines.push(`<li><a href="${local}">${url}</a></li>`);
  }
  indexLines.push('</ul>');
  await fs.writeFile(path.join(mirrorRoot, 'index.html'), indexLines.join('\n'));

  console.log(`\nDone. ${okCount} saved, ${skipCount} already done, ${failCount} failed.`);
  console.log(`Open http://localhost:${config.port}/mirror/index.html (start server with: npm run serve)`);
  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
