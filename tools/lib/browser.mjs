// Puppeteer wrapper for fetching pages that need JavaScript to render (Schoology
// Common Assessments — the React-based quiz tool). Reuses a single browser +
// page across all requests so we don't pay the Chromium boot cost per item.

import puppeteer from 'puppeteer';

function parseCookieHeader(cookieHeader, domainHostname) {
  return cookieHeader.split(';').map(s => {
    const trimmed = s.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) return null;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    return { name, value, domain: domainHostname, path: '/' };
  }).filter(Boolean);
}

export function makeBrowserClient(config) {
  let browser = null;
  let initialized = false;
  const domainUrl = new URL(config.domain);

  async function ensureBrowser() {
    if (browser) return browser;
    console.log('  🚀 launching Chromium…');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    return browser;
  }

  // Loads a URL in a fresh page, with cookies set, and waits for the React
  // app to render. Optionally clicks tab buttons by visible text. Returns
  // { html, screenshot, finalUrl, title }.
  //
  // Options:
  //   clickTexts      array of visible labels (case-insensitive) to click in order
  //                   e.g. ['View'] for Common Assessment "View Submission" link,
  //                        ['My Document'] for assignment dropbox tab.
  //   waitForSelectors  CSS selectors to wait for after navigation (any matching)
  //   timeout         navigation timeout
  async function fetchRendered(url, {
    clickTexts = ['View'],
    waitForSelectors = null,
    timeout = 30000,
    scroll = true
  } = {}) {
    const b = await ensureBrowser();
    const page = await b.newPage();
    try {
      await page.setUserAgent(config.userAgent);
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

      if (!initialized) {
        // Set cookies once per browser session — for any subsequent page within
        // the same domain the cookies will already be there.
        const cookies = parseCookieHeader(config.cookie, domainUrl.hostname);
        await page.setCookie(...cookies);
        initialized = true;
      }

      await page.goto(url, { waitUntil: 'networkidle2', timeout });

      // Click through React tabs / "View" links by matching visible text. We
      // pass `clickTexts` from the caller; first matching element gets clicked.
      // After each click we wait for the React app to settle.
      for (const target of clickTexts) {
        const clicked = await page.evaluate((needle) => {
          const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"], [role="button"]'));
          const el = candidates.find(c => (c.textContent || '').trim().toLowerCase() === needle.toLowerCase());
          if (el) { el.click(); return true; }
          return false;
        }, target);
        if (clicked) {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null),
            new Promise(r => setTimeout(r, 2500))
          ]);
        }
      }

      // Wait for some indicator that the React content has mounted.
      const selectors = waitForSelectors || [
        '[class*="ca-question"]', '[class*="assessment-question"]',
        '.question-content', '.question-item',
        '[class*="QuestionView"]', '[data-testid*="question"]',
        'a[href*="google.com"]', 'iframe[src*="google.com"]'
      ];
      for (const sel of selectors) {
        try {
          await page.waitForSelector(sel, { timeout: 4000 });
          break;
        } catch { /* try next */ }
      }
      // Small settle delay for any animations/late renders.
      await new Promise(r => setTimeout(r, 1500));

      if (scroll) {
        // Trigger lazy-loaded content by scrolling to the bottom and back.
        await page.evaluate(async () => {
          await new Promise(resolve => {
            let y = 0;
            const step = 400;
            const max = document.documentElement.scrollHeight;
            const t = setInterval(() => {
              window.scrollTo(0, y); y += step;
              if (y >= max) { clearInterval(t); window.scrollTo(0, 0); resolve(); }
            }, 100);
          });
        });
        await new Promise(r => setTimeout(r, 500));
      }

      const html = await page.content();
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const title = (await page.title()) || '';
      const finalUrl = page.url();
      return { html, screenshot, title, finalUrl };
    } finally {
      await page.close();
    }
  }

  async function close() {
    if (browser) {
      await browser.close();
      browser = null;
    }
  }

  // For callers that need to drive the browser directly (e.g. the mirror module
  // attaches its own response listeners).
  async function _rawNewPage() {
    const b = await ensureBrowser();
    const page = await b.newPage();
    await page.setUserAgent(config.userAgent);
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    if (!initialized) {
      const cookies = parseCookieHeader(config.cookie, domainUrl.hostname);
      await page.setCookie(...cookies);
      initialized = true;
    }
    return page;
  }

  return { fetchRendered, close, _rawNewPage };
}
