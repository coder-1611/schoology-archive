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

import { loadConfig } from './lib/config.mjs';
import { buildIndexHtml } from './lib/index-html.mjs';

async function main() {
  const config = loadConfig();
  const mirrorRoot = path.join(config.dataDir, '_mirror');

  // No `courses` or `targets` passed — buildIndexHtml will discover courses
  // by globbing manifests itself, and the appendix will simply be omitted.
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
