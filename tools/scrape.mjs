#!/usr/bin/env node
// Schoology archive CLI.
//
// Usage:
//   node scrape.mjs                    scrape every course (active + archived) into ./data/
//   node scrape.mjs --course <id>      scrape only one course by id
//   node scrape.mjs --no-archived      skip archived courses
//   node scrape.mjs --list             only list courses; don't download anything

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './lib/config.mjs';
import { makeHttpClient } from './lib/http.mjs';
import { makeBrowserClient } from './lib/browser.mjs';
import { enumerateCourses } from './lib/courses.mjs';
import { scrapeCourseMaterials } from './lib/scraper.mjs';
import { persistCourse } from './lib/download.mjs';

function parseArgs(argv) {
  const args = { listOnly: false, includeArchivedOverride: null, courseId: null, noBrowser: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.listOnly = true;
    else if (a === '--no-archived') args.includeArchivedOverride = false;
    else if (a === '--archived') args.includeArchivedOverride = true;
    else if (a === '--course') args.courseId = argv[++i];
    else if (a === '--no-browser') args.noBrowser = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node scrape.mjs                 scrape all courses (active + archived)
  node scrape.mjs --course <id>   scrape one course
  node scrape.mjs --no-archived   skip archived
  node scrape.mjs --no-browser    skip Puppeteer (Common Assessments will be score-only)
  node scrape.mjs --list          list courses only`);
      process.exit(0);
    }
  }
  return args;
}

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig();
  if (args.includeArchivedOverride !== null) config.includeArchived = args.includeArchivedOverride;
  await ensureDir(config.dataDir);

  const http = makeHttpClient(config);
  const browser = args.noBrowser ? null : makeBrowserClient(config);
  console.log(`Schoology domain: ${config.domain}`);
  console.log(`Output directory: ${config.dataDir}`);
  console.log(`Browser fallback: ${browser ? 'enabled (Puppeteer)' : 'disabled'}`);

  let courses;
  if (args.courseId) {
    courses = [{ id: args.courseId, title: `Course ${args.courseId}`, source: 'manual' }];
  } else {
    console.log(`\nEnumerating courses${config.includeArchived ? ' (including archived)' : ''}…`);
    courses = await enumerateCourses(http, { includeArchived: config.includeArchived });
  }

  if (!courses.length) {
    console.error('\nNo courses found. Possible causes:');
    console.error('  • Cookie expired or wrong domain in config.json');
    console.error('  • Your school uses a non-standard URL — try opening /courses in your browser');
    console.error('    and check the network tab to find the right path.');
    process.exit(1);
  }

  console.log(`\nFound ${courses.length} course(s):`);
  for (const c of courses) console.log(`  [${c.source}] ${c.id}  ${c.title}`);

  if (args.listOnly) return;

  const indexPath = path.join(config.dataDir, 'index.json');
  const summary = { generatedAt: new Date().toISOString(), domain: config.domain, courses: [] };

  for (const course of courses) {
    console.log(`\n→ ${course.title} (${course.id}) [${course.source}]`);
    const courseDir = path.join(config.dataDir, course.id);
    try {
      const { materials, title: scrapedTitle, note } = await scrapeCourseMaterials(http, course.id, { browser });
      if (note) console.log(`  ${note}`);
      const finalTitle = scrapedTitle && scrapedTitle.length > 3 ? scrapedTitle : course.title;
      if (finalTitle !== course.title) console.log(`  title resolved → ${finalTitle}`);
      const { downloadedCount, failedCount } = await persistCourse(http, courseDir, materials);

      const manifest = {
        id: course.id,
        title: finalTitle,
        source: course.source,
        scrapedAt: new Date().toISOString(),
        downloaded: downloadedCount,
        failed: failedCount,
        materials
      };
      await fs.writeFile(path.join(courseDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log(`  ✓ saved (${downloadedCount} files, ${failedCount} failed)`);
      summary.courses.push({
        id: course.id, title: finalTitle, source: course.source,
        downloaded: downloadedCount, failed: failedCount
      });
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      summary.courses.push({ id: course.id, title: course.title, source: course.source, error: err.message });
    }
  }

  await fs.writeFile(indexPath, JSON.stringify(summary, null, 2));
  console.log(`\nDone. Index written to ${indexPath}`);
  console.log(`Start the viewer with:  npm run serve  (then open http://localhost:${config.port})`);

  if (browser) await browser.close();
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
