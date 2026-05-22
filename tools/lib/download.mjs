// Walk a scraped course tree and persist every material to disk under a course directory.
// Layout on disk (per course):
//   data/<courseId>/
//     manifest.json       full scraped tree (annotated with local file paths)
//     files/...           downloaded documents, images, embedded pages, links, html pages
//     <folder-name>/...   nested folder structure mirrors course folders

import fs from 'node:fs/promises';
import path from 'node:path';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Build a rich HTML representation of an assignment/assessment using whatever
// resolveAssignment was able to pull off the page.
function renderAssignmentHtml(title, schoologyHref, details, { screenshotRel = null, renderedRel = null } = {}) {
  const d = details || {};
  const out = [];
  out.push(`<h1>${escapeHtml(title)}</h1>`);
  if (d.metadata) out.push(`<div class="meta">${escapeHtml(d.metadata)}</div>`);
  if (d.score) out.push(`<div class="meta">Score: <span class="score">${escapeHtml(d.score)}</span></div>`);

  if (d.googleLinks && d.googleLinks.length) {
    out.push(`<h2>Linked Google file${d.googleLinks.length > 1 ? 's' : ''}</h2>`);
    for (const g of d.googleLinks) {
      out.push(`<a class="google-link" href="${escapeHtml(g.url)}" target="_blank" rel="noopener">📄 Open Google ${escapeHtml(g.kind)}</a>`);
    }
  }

  if (d.description && d.description.trim().length > 0) {
    out.push(`<h2>Description / Directions</h2>`);
    // The description is already HTML from Schoology — pass through (links etc work).
    out.push(`<div>${d.description}</div>`);
  }

  if (d.questions && d.questions.length) {
    out.push(`<h2>Questions (${d.questions.length})</h2>`);
    for (let i = 0; i < d.questions.length; i++) {
      const q = d.questions[i];
      out.push(`<div class="question"><div><strong>Q${i + 1}.</strong> ${escapeHtml(q.text)}</div>`);
      if (q.answers && q.answers.length) {
        out.push('<ul class="answers">');
        for (const a of q.answers) {
          const cls = ['answer'];
          if (a.correct) cls.push('correct');
          if (a.selected) cls.push('selected');
          let badges = '';
          if (a.correct) badges += '<span class="badge correct">✓ correct</span>';
          if (a.selected) badges += '<span class="badge your">your answer</span>';
          out.push(`<li class="${cls.join(' ')}">${escapeHtml(a.text)}${badges}</li>`);
        }
        out.push('</ul>');
      }
      out.push('</div>');
    }
  } else if (d.googleLinks && d.googleLinks.length) {
    // Has Google content but no quiz questions — no fallback note needed.
  } else if (!d.description) {
    out.push(`<p class="fallback">No description, score, questions, or linked files were extractable from the assignment page. Use the Schoology link below to view it.</p>`);
  }

  if (d.usesLtiGoogleSubmission) {
    out.push(`<h2>📎 Google Drive submission</h2>`);
    out.push(`<p>This assignment uses Schoology's Google Drive integration. The actual document URL lives behind Google's auth and cannot be extracted via scraping — you have to be logged into Google as your school account to view it. Use the Schoology link below.</p>`);
  }

  if (screenshotRel || renderedRel) {
    out.push(`<h2>Browser capture</h2>`);
    out.push(`<div class="actions">`);
    if (renderedRel) out.push(`<a href="${renderedRel}" target="_blank">Open rendered HTML</a>`);
    if (screenshotRel) out.push(`<a href="${screenshotRel}" target="_blank">Open full-size screenshot</a>`);
    out.push(`</div>`);
    if (screenshotRel) out.push(`<img src="${screenshotRel}" alt="Screenshot of ${escapeHtml(title)}">`);
  }

  out.push(`<p class="fallback">Source: <a href="${escapeHtml(schoologyHref)}" target="_blank" rel="noopener">View on Schoology</a></p>`);

  // Reuse the same lightweight styles as the Common Assessment summary.
  const styles = `<style>
    body { font: 15px/1.5 -apple-system, system-ui, sans-serif; max-width: 980px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { font-size: 1.3rem; margin-bottom: .25rem; }
    h2 { font-size: 1rem; margin-top: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: .25rem; }
    .meta { color: #666; font-size: 13px; margin-bottom: 1rem; }
    .score { display: inline-block; background: #eef; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .google-link { display: inline-block; background: #fffbe6; padding: 6px 10px; border-radius: 4px; margin: 4px 6px 4px 0; text-decoration: none; color: #533; }
    .question { margin: 1rem 0; padding: .5rem .75rem; border-left: 3px solid #ddd; background: #fafafa; }
    .answers { list-style: none; padding-left: 1rem; }
    .answer { padding: 2px 0; }
    .answer.correct { color: #1a7f37; }
    .answer.selected { font-weight: 600; }
    .badge { font-size: 11px; padding: 1px 5px; border-radius: 3px; margin-left: 6px; }
    .badge.correct { background: #d1f0d8; color: #1a5522; }
    .badge.your { background: #e0e8ff; color: #223377; }
    .fallback { color: #888; font-style: italic; margin-top: 2rem; }
    .actions a { display: inline-block; background: #f6f6f6; padding: 6px 12px; border-radius: 4px; margin-right: 8px; text-decoration: none; color: #1a4fcf; }
    img { max-width: 100%; border: 1px solid #ddd; margin-top: 1rem; }
  </style>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${styles}</head><body>${out.join('\n')}</body></html>`;
}

function safeName(s) {
  return (s || 'untitled')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .slice(0, 180) || 'untitled';
}

async function uniquePath(dir, baseName, ext) {
  let candidate = ext ? `${baseName}.${ext}` : baseName;
  let n = 1;
  while (true) {
    const full = path.join(dir, candidate);
    try {
      await fs.access(full);
      n += 1;
      candidate = ext ? `${baseName} (${n}).${ext}` : `${baseName} (${n})`;
    } catch {
      return { fullPath: full, basename: candidate };
    }
  }
}

async function writeFileBuffered(fullPath, buf) {
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buf);
}

export async function persistCourse(http, courseDir, materials) {
  await fs.mkdir(courseDir, { recursive: true });

  let downloadedCount = 0;
  let failedCount = 0;

  async function walk(items, dirOnDisk, relPrefix) {
    for (const item of items) {
      const title = safeName(item.title);

      try {
        if (item.type === 'folder') {
          const subDir = path.join(dirOnDisk, title);
          const subRel = path.posix.join(relPrefix, title);
          await fs.mkdir(subDir, { recursive: true });
          item.localPath = subRel;
          if (Array.isArray(item.children)) {
            await walk(item.children, subDir, subRel);
          }
        } else if (item.type === 'document' && item.downloadLink) {
          const ext = (item.ext || 'bin').replace(/[^a-zA-Z0-9]/g, '') || 'bin';
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, ext);
          const res = await http.get(item.downloadLink, { asBuffer: true });
          if (!res.ok) {
            console.warn(`    ⚠ document failed ${item.downloadLink} (${res.status})`);
            failedCount += 1;
            continue;
          }
          await writeFileBuffered(fullPath, res.body);
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        } else if (item.type === 'page') {
          // Inline embedded images into a self-contained HTML.
          let html = item.content || '';
          if (Array.isArray(item.images) && item.images.length) {
            for (let i = 0; i < item.images.length; i++) {
              const src = item.images[i];
              try {
                const imgRes = await http.get(src, { asBuffer: true });
                if (!imgRes.ok) continue;
                const imgExt = (src.split('?')[0].split('#')[0].split('.').pop() || 'img').replace(/[^a-z0-9]/gi, '').slice(0, 5);
                const imgName = `${safeName(title)}_img${i}.${imgExt}`;
                await writeFileBuffered(path.join(dirOnDisk, imgName), imgRes.body);
                const localRel = './' + imgName;
                html = html.split(src).join(localRel);
                // Also handle protocol-relative or domain-stripped variants.
                try {
                  const u = new URL(src);
                  html = html.split(u.pathname + u.search).join(localRel);
                } catch { /* ignore */ }
              } catch { /* skip image */ }
            }
          }
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, 'html');
          const wrapped = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`;
          await writeFileBuffered(fullPath, Buffer.from(wrapped, 'utf8'));
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        } else if (item.type === 'embedded_page' && item.href) {
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, 'html');
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><iframe src="${item.href}" style="width:100vw;height:100vh;border:0"></iframe></body></html>`;
          await writeFileBuffered(fullPath, Buffer.from(html, 'utf8'));
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        } else if (item.type === 'link' && item.href) {
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, 'url');
          const content = `[InternetShortcut]\nURL=${item.href}\n`;
          await writeFileBuffered(fullPath, Buffer.from(content, 'utf8'));
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        } else if ((item.type === 'assignment' || item.type === 'assessment') && item.href) {
          const d = item.assignmentDetails || {};
          // If we rendered with the browser, save screenshot + rendered HTML side-by-side.
          let screenshotRel = null, renderedRel = null;
          if (d.screenshotBuffer) {
            const screenshotName = `${safeName(title)}_screenshot.png`;
            await writeFileBuffered(path.join(dirOnDisk, screenshotName), d.screenshotBuffer);
            screenshotRel = './' + screenshotName;
            delete d.screenshotBuffer;
          }
          if (d.renderedHtml) {
            const renderedName = `${safeName(title)}_rendered.html`;
            await writeFileBuffered(path.join(dirOnDisk, renderedName), Buffer.from(d.renderedHtml, 'utf8'));
            renderedRel = './' + renderedName;
            delete d.renderedHtml;
          }
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, 'html');
          const html = renderAssignmentHtml(title, item.href, d, { screenshotRel, renderedRel });
          await writeFileBuffered(fullPath, Buffer.from(html, 'utf8'));
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        } else if (item.type === 'common_assessment' && item.href) {
          const d = item.commonAssessmentDetails || {};
          // Write rendered HTML + screenshot side-by-side. The summary page links to both.
          let screenshotRel = null, renderedRel = null;
          if (d.screenshotBuffer) {
            const screenshotName = `${safeName(title)}_screenshot.png`;
            await writeFileBuffered(path.join(dirOnDisk, screenshotName), d.screenshotBuffer);
            screenshotRel = './' + screenshotName;
            delete d.screenshotBuffer; // strip from manifest to keep JSON small
          }
          if (d.renderedHtml) {
            const renderedName = `${safeName(title)}_rendered.html`;
            await writeFileBuffered(path.join(dirOnDisk, renderedName), Buffer.from(d.renderedHtml, 'utf8'));
            renderedRel = './' + renderedName;
            delete d.renderedHtml;
          }
          const summary = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; max-width: 980px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { font-size: 1.3rem; margin-bottom: .25rem; }
  .meta { color: #666; font-size: 13px; margin: .25rem 0 1rem; }
  .score { display: inline-block; background: #eef; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
  .actions a { display: inline-block; background: #f6f6f6; padding: 6px 12px; border-radius: 4px; margin-right: 8px; text-decoration: none; color: #1a4fcf; }
  img { max-width: 100%; border: 1px solid #ddd; margin-top: 1rem; }
  .stamp { color: #999; font-size: 12px; margin-top: 2rem; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
${d.score ? `<div class="meta">Score: <span class="score">${escapeHtml(d.score)}</span></div>` : ''}
<div class="actions">
  ${renderedRel ? `<a href="${renderedRel}" target="_blank">Open rendered HTML</a>` : ''}
  ${screenshotRel ? `<a href="${screenshotRel}" target="_blank">Open full-size screenshot</a>` : ''}
  <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">View on Schoology</a>
</div>
${screenshotRel ? `<img src="${screenshotRel}" alt="Screenshot of ${escapeHtml(title)}">` : ''}
${!d.viaBrowser ? `<p class="stamp">Captured static page only (Puppeteer was not available or failed).</p>` : `<p class="stamp">Rendered via headless Chromium.</p>`}
</body></html>`;
          const { fullPath, basename } = await uniquePath(dirOnDisk, title, 'html');
          await writeFileBuffered(fullPath, Buffer.from(summary, 'utf8'));
          item.localPath = path.posix.join(relPrefix, basename);
          downloadedCount += 1;
        }
      } catch (err) {
        failedCount += 1;
        console.warn(`    ⚠ ${item.type} '${item.title}' failed: ${err.message}`);
      }
    }
  }

  await walk(materials, courseDir, '');
  return { downloadedCount, failedCount };
}
