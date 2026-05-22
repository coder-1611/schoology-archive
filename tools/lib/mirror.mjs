// Mirror a Schoology page (rendered via Puppeteer) to disk as a self-contained
// static snapshot. We capture every network response Puppeteer makes during the
// page load (HTML, CSS, JS, images, fonts), save them under the mirror root with
// their original URL paths preserved, and rewrite the page HTML so all asset
// URLs point at the local copies.
//
// Layout on disk:
//   data/_mirror/
//     pages/<sanitized-path>.html      saved page HTML (URLs rewritten)
//     _assets/<hostname>/<path>        raw mirrored assets (CSS/JS/images/etc.)
//
// Internal navigation:
//   - Links from a mirrored page that target another URL we've also mirrored
//     are rewritten to /mirror/pages/<sanitized-path>.html.
//   - Other Schoology URLs remain absolute (so clicking them goes to live
//     Schoology — useful for things we didn't mirror).

import fs from 'node:fs/promises';
import path from 'node:path';

const MIRROR_HOST_REGEX = /\.schoology\.com$|^schoology\.com$/i;

export function shouldMirrorHost(hostname) {
  return MIRROR_HOST_REGEX.test(hostname);
}

// Convert a URL to a stable, OS-safe asset path under _assets/.
function assetLocalPath(urlObj) {
  let p = urlObj.pathname;
  if (p.endsWith('/')) p += 'index';
  // Drop any leading slash for path.join.
  p = p.replace(/^\/+/, '');
  // Sanitize each path segment.
  p = p.split('/').map(seg => seg.replace(/[\x00-\x1f<>:"|?*\\]+/g, '_')).join('/');
  // Append a stable hash of the query string so URLs that differ only by
  // ?cache=... or ?v=... don't collide.
  if (urlObj.search) {
    const safeQs = urlObj.search.slice(1).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    p += `__q_${safeQs}`;
  }
  return path.join('_assets', urlObj.hostname, p);
}

function assetServerUrl(urlObj) {
  return '/mirror/' + assetLocalPath(urlObj).split(path.sep).join('/');
}

// Convert a Schoology page URL into the file path under pages/ where its mirrored HTML lives.
export function pageLocalPath(urlString) {
  const u = new URL(urlString);
  let p = u.pathname;
  if (p === '/') p = '/home';
  if (p.endsWith('/')) p += 'index';
  p = p.replace(/^\/+/, '').split('/').map(seg => seg.replace(/[\x00-\x1f<>:"|?*\\]+/g, '_')).join('/');
  if (u.search) {
    const qs = u.search.slice(1).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    p += `__q_${qs}`;
  }
  return path.join('pages', p + '.html');
}

function pageServerUrl(urlString) {
  return '/mirror/' + pageLocalPath(urlString).split(path.sep).join('/');
}

// File-extension based asset detection — anything else is treated as a page.
const ASSET_EXT_REGEX = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|ogg|wav|pdf|zip)(?:$|\?)/i;

// Rewrite a single URL string (absolute or relative) to its local mirror path.
// Returns the original string if it shouldn't be rewritten.
//
// - If the URL resolves to a Schoology host and we mirrored it → /mirror/pages/...
// - If it's clearly an asset (CSS/JS/image/etc.) → /mirror/_assets/...
// - Otherwise (a page-shaped URL we didn't mirror) → leave as absolute URL so
//   clicking falls through to live Schoology rather than 404-ing locally.
//
// `aliasMap` lets us treat Schoology's parent-course vs section-course IDs as
// equivalent: any URL containing /course/<aliasId>/... gets normalized to
// /course/<canonicalId>/... before lookup.
function rewriteOneUrl(rawUrl, baseUrl, mirroredPages, aliasMap = null) {
  if (!rawUrl) return rawUrl;
  if (/^(?:#|data:|mailto:|tel:|javascript:|blob:|about:)/i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/mirror/')) return rawUrl;
  let u;
  try { u = new URL(rawUrl, baseUrl); } catch { return rawUrl; }
  if (!shouldMirrorHost(u.hostname)) return rawUrl;

  // Course-ID alias normalization: replace aliased course IDs with canonical.
  let normalizedPath = u.pathname;
  if (aliasMap && aliasMap.size > 0) {
    normalizedPath = normalizedPath.replace(/\/course\/(\d+)/g, (m, id) =>
      aliasMap.has(id) ? '/course/' + aliasMap.get(id) : m
    );
  }
  const normalized = u.origin + normalizedPath.replace(/\/+$/, '') + u.search;

  if (mirroredPages.has(normalized)) return pageServerUrl(normalized);

  // Only treat as a mirrored asset if the path looks like one.
  if (ASSET_EXT_REGEX.test(u.pathname)) return assetServerUrl(u);

  // Page-shaped URL we didn't mirror — keep absolute so the click goes to live
  // Schoology instead of falling into _assets/ as a broken file.
  return u.toString();
}

// Rewrite any URL appearing inside the HTML that points to a Schoology host
// (or is a relative URL that resolves to one). Handles:
//   - Absolute https?://...
//   - Root-relative /path
//   - Path-relative ./path or ../path
//   - URLs inside attribute values: href, src, action, data-href, srcset, poster
//   - URLs inside <style> tags via url(...)
//
// `baseUrl` is the URL the page was originally fetched from — needed to resolve
// relative paths.
function rewriteHtml(html, baseUrl, mirroredPages, aliasMap = null) {
  const r = (raw) => rewriteOneUrl(raw, baseUrl, mirroredPages, aliasMap);

  // 1) Absolute URLs anywhere in the document.
  let out = html.replace(/https?:\/\/[^\s"'`<>)]+/g, r);

  // 2) Common URL-bearing attributes with quoted values that start with /, ./, or ../.
  const attrRe = /\b(href|src|action|data-href|data-src|poster|formaction)\s*=\s*(['"])(?!#|https?:|data:|mailto:|tel:|javascript:|blob:|about:)([./][^'"]*)\2/g;
  out = out.replace(attrRe, (_m, attr, quote, ref) => {
    return `${attr}=${quote}${r(ref)}${quote}`;
  });

  // 3) srcset attributes — comma-separated list of "url descriptor".
  out = out.replace(/\bsrcset\s*=\s*(['"])([^'"]+)\1/g, (_m, q, val) => {
    const rewritten = val.split(',').map(part => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const sp = trimmed.indexOf(' ');
      const url = sp === -1 ? trimmed : trimmed.slice(0, sp);
      const desc = sp === -1 ? '' : trimmed.slice(sp);
      return r(url) + desc;
    }).join(', ');
    return `srcset=${q}${rewritten}${q}`;
  });

  // 4) <style> blocks with url(...) refs.
  out = out.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => {
    const rewrittenCss = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (cm, quote, ref) => {
      if (ref.startsWith('data:')) return cm;
      return `url(${quote}${r(ref)}${quote})`;
    });
    return m.replace(css, rewrittenCss);
  });

  return out;
}

// Recursively rewrite url(...) references inside a saved CSS file. CSS uses
// relative paths inside url(); we resolve them against the CSS file's URL and
// rewrite to /mirror/_assets/... paths.
async function rewriteCssFile(absPath, baseUrl) {
  let css;
  try { css = await fs.readFile(absPath, 'utf8'); }
  catch { return; }
  const rewritten = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, _q, ref) => {
    if (ref.startsWith('data:')) return m;
    let resolved;
    try { resolved = new URL(ref, baseUrl); } catch { return m; }
    if (!shouldMirrorHost(resolved.hostname)) return m;
    return `url("${assetServerUrl(resolved)}")`;
  });
  if (rewritten !== css) await fs.writeFile(absPath, rewritten);
}

export async function mirrorPage(browser, http, url, { mirrorRoot, mirroredPages, aliasMap = null, timeout = 45000 } = {}) {
  await fs.mkdir(mirrorRoot, { recursive: true });

  // Reuse the browser client's auth — we need a fresh page to attach response listeners.
  const page = await browser._rawNewPage();

  const capturedAssets = []; // for CSS post-processing

  page.on('response', async (response) => {
    const respUrl = response.url();
    let u;
    try { u = new URL(respUrl); } catch { return; }
    if (!shouldMirrorHost(u.hostname)) return;
    // Don't save the top-level page response — we use page.content() instead.
    if (respUrl === url) return;
    if (response.status() >= 300) return;
    try {
      const buf = await response.buffer();
      const rel = assetLocalPath(u);
      const abs = path.join(mirrorRoot, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      const ct = (response.headers()['content-type'] || '').toLowerCase();
      if (ct.includes('text/css')) capturedAssets.push({ absPath: abs, baseUrl: respUrl });
    } catch { /* ignore individual asset failures */ }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout });
    await new Promise(r => setTimeout(r, 1500));

    // For Common Assessments (URL contains /assessments/), Schoology shows a
    // landing page with a "View" link that opens the submission review via
    // client-side React routing (no URL change). For the mirror to show the
    // actual quiz, click "View" before snapshotting.
    if (/\/assessments\/\d+/.test(url)) {
      const clicked = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        const view = candidates.find(c => (c.textContent || '').trim().toLowerCase() === 'view');
        if (view) { view.click(); return true; }
        return false;
      });
      if (clicked) {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null),
          new Promise(r => setTimeout(r, 3500))
        ]);
      }
    }

    const rawHtml = await page.content();
    // Use the final post-redirect URL as the base for resolving relative links,
    // since that's what relative paths in the rendered HTML were rendered against.
    const finalUrl = page.url();
    // Build the shared post-processing pipeline: force light color scheme,
    // bind dashboard tile clicks, bind assignment-tab clicks.
    function postProcess(rawHtml, tabBindings = null) {
      let h = rewriteHtml(rawHtml, finalUrl, mirroredPages, aliasMap);
      h = h.replace(/<head([^>]*)>/i,
        '<head$1><meta name="color-scheme" content="light"><style>html{color-scheme:light}body{background:#fff}</style>');
      const tileShim = `function go(e){var k=(e.currentTarget.getAttribute('data-key')||'').match(/\\.\\$(\\d+)/);if(k){e.preventDefault();e.stopPropagation();window.location.href='/mirror/pages/course/'+k[1]+'.html';}}document.querySelectorAll('[data-key^=".$"]').forEach(function(el){el.style.cursor='pointer';el.addEventListener('click',go);});`;
      // Tab bindings: bind {label: url} clicks on any <a>/<button>/[role=tab] whose
      // visible text matches. Capture phase + preventDefault overrides React handlers.
      const tabShim = tabBindings ? `var TABS=${JSON.stringify(tabBindings)};function bindTab(el){var t=(el.textContent||'').trim();if(TABS[t]){el.style.cursor='pointer';el.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();window.location.href=TABS[t];},true);}}document.querySelectorAll('a, button, [role="tab"]').forEach(bindTab);` : '';
      const shim = `<script>(function(){${tileShim}${tabShim}})();</script>`;
      h = h.replace(/<\/body>/i, shim + '</body>');
      return h;
    }

    const pageRel = pageLocalPath(url);
    const pageAbs = path.join(mirrorRoot, pageRel);

    // For Schoology assignments (not assessments), there's commonly a second
    // tab — "My Document" — whose content only renders after a React click.
    // Capture it as a separate page and bind the tabs to navigate between them.
    //
    // For Google-Drive-integrated submissions, the My Document tab embeds an
    // LTI iframe whose final destination is the actual Google file. The embed
    // is blocked by X-Frame-Options, but if we visit the LTI URL top-level in
    // a separate page we can extract the Google doc URL from the rendered HTML.
    let secondaryRel = null;
    let googleDocUrl = null;
    if (/\/assignments?\/\d+/.test(url) && !/\/assessments\//.test(url)) {
      try {
        const tabClicked = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
          const tab = candidates.find(c => (c.textContent || '').trim() === 'My Document');
          if (tab) { tab.click(); return true; }
          return false;
        });
        if (tabClicked) {
          await new Promise(r => setTimeout(r, 3500));

          // Pull every LTI iframe src that points at assignment_submission.
          const ltiUrls = await page.evaluate(() =>
            Array.from(document.querySelectorAll('iframe'))
              .map(f => f.src)
              .filter(s => /\/apps\/lti\/.+context=assignment_submission/.test(s))
          );

          // For each LTI URL, visit it top-level in a sibling page and scrape
          // the resulting page for any google.com document URLs.
          for (const ltiUrl of ltiUrls) {
            const sidePage = await browser._rawNewPage();
            try {
              await sidePage.goto(ltiUrl, { waitUntil: 'networkidle2', timeout: 20000 });
              await new Promise(r => setTimeout(r, 1500));
              const sideHtml = await sidePage.content();
              const m = sideHtml.match(/https?:\/\/(?:docs|drive|sheets|slides)\.google\.com\/[^\s"'<>)]+/i);
              if (m) { googleDocUrl = m[0]; break; }
            } catch { /* try next iframe */ } finally {
              await sidePage.close();
            }
          }

          const secondaryRaw = await page.content();
          secondaryRel = pageRel.replace(/\.html$/, '__my_document.html');
          const secondaryAbs = path.join(mirrorRoot, secondaryRel);
          await fs.mkdir(path.dirname(secondaryAbs), { recursive: true });
          // Inject a prominent "Open the actual Google document" banner if we
          // recovered the URL.
          let secondaryRawWithBanner = secondaryRaw;
          if (googleDocUrl) {
            const banner = `<div style="background:#fffbe6;border:2px solid #f0c46a;border-radius:6px;padding:14px 18px;margin:12px 16px;font:14px/1.4 system-ui;">📄 <strong>Open the actual Google document:</strong> <a href="${googleDocUrl}" target="_blank" rel="noopener" style="color:#1a4fcf;text-decoration:underline;font-weight:600;">${googleDocUrl}</a> <span style="color:#666;font-size:12px;">(opens in Google — you'll need to be logged into your school Google account)</span></div>`;
            secondaryRawWithBanner = secondaryRaw.replace(/<body([^>]*)>/i, '<body$1>' + banner);
          }
          const secondaryHtml = postProcess(secondaryRawWithBanner, {
            'Assignment': '/mirror/' + pageRel.split(path.sep).join('/')
          });
          await fs.writeFile(secondaryAbs, secondaryHtml, 'utf8');
        }
      } catch { /* if the click flow errors, just skip the secondary capture */ }
    }

    // Now save the main HTML. If we captured a secondary, bind "My Document" → it.
    const mainBindings = secondaryRel
      ? { 'My Document': '/mirror/' + secondaryRel.split(path.sep).join('/') }
      : null;
    const html = postProcess(rawHtml, mainBindings);
    await fs.mkdir(path.dirname(pageAbs), { recursive: true });
    await fs.writeFile(pageAbs, html, 'utf8');

    // Post-process saved CSS files so url() references resolve locally.
    for (const a of capturedAssets) {
      await rewriteCssFile(a.absPath, a.baseUrl);
    }

    return { pageRel, pageAbs, assetsCaptured: capturedAssets.length, secondaryRel };
  } finally {
    await page.close();
  }
}
