#!/usr/bin/env node
// Regenerate `data/_mirror/index.html` from whatever's currently on disk —
// no scraping, no network. Useful when you want to refresh the landing page
// after editing manifests, or to convert an old flat index to the new
// categorized course-list format without running the full mirror.
//
// Usage:
//   node tools/rebuild-index.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './lib/config.mjs';
import { buildIndexHtml } from './lib/index-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();
  const mirrorRoot = path.join(config.dataDir, '_mirror');

  // First regenerate every per-course tree-view page so the landing's
  // "Files & Links" links resolve.
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'build-course-pages.mjs')],
      { stdio: 'inherit', cwd: __dirname });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`build-course-pages exited ${code}`)));
  });

  // Then build the landing — no `courses` or `targets` passed, so buildIndexHtml
  // discovers courses by globbing manifests and the appendix is omitted.
  const html = await buildIndexHtml({
    dataDir: config.dataDir,
    mirrorRoot,
  });

  const out = path.join(mirrorRoot, 'index.html');
  await fs.writeFile(out, html);
  console.log(`Wrote ${out} (${html.length} bytes)`);
  console.log(`Open: http://localhost:${config.port}/mirror/index.html`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
