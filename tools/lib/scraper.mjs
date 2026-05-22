// Port of the original src/scraper.js to a Node + cheerio environment.
// Walks a course materials page and produces a tree of materials.
//
// One important difference from the bookmarklet: the bookmarklet runs *after*
// the user manually opens every folder in the page. In Node we don't have a live
// DOM, so we have to fetch each folder's contents directly. Schoology exposes
// folder contents at `/course/<courseId>/folder/<folderId>` (server-rendered HTML).

import * as cheerio from 'cheerio';

function classify($el, href = '') {
  const cls = $el.attr('class') || '';
  if (cls.includes('material-row-folder')) return 'folder';
  if (cls.includes('type-document') && $el.find('.attachments-link').length) return 'link';
  if (cls.includes('type-document')) return 'document';
  if (cls.includes('type-page')) return 'page';
  // Common Assessment URLs follow /course/<id>/assessments/<aid> — the actual
  // questions are React-rendered, so we route them to Puppeteer downstream.
  if (/\/assessments\/\d+/.test(href)) return 'common_assessment';
  // Other quiz-type items.
  if (cls.includes('type-assessment') || cls.includes('type-test_quiz') || cls.includes('type-quiz') || cls.includes('material-type-test')) return 'assessment';
  if (cls.includes('type-assignment')) return 'assignment';
  if (cls.includes('type-discussion')) return 'discussion';
  return 'other';
}

function pickTitleSelector(type) {
  switch (type) {
    case 'folder': return '.folder-title a';
    case 'document': return '.attachments-file-name a';
    case 'link': return '.attachments-link a';
    case 'common_assessment': return '.item-title a, a';
    default: return '.item-title a';
  }
}

function absoluteHref(href, base) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return href; }
}

// Extract real download URL from a document's page (Schoology embeds the file in a
// doc-viewer iframe; the viewer page has a script tag containing JSON with `downloadLink`).
async function resolveDocumentDownload(http, docPageUrl) {
  const docRes = await http.get(docPageUrl);
  if (!docRes.ok) return null;
  const $ = cheerio.load(docRes.body);

  // Case 1: it's an image directly embedded.
  const img = $('#content-wrapper img').first();
  if (img.length) {
    const src = img.attr('src');
    if (src) return { downloadLink: absoluteHref(src, docPageUrl), kind: 'image' };
  }

  // Case 2: doc-viewer iframe (PDFTron).
  const iframe = $('iframe.docviewer-iframe').first();
  if (!iframe.length) return null;
  const iframeSrc = absoluteHref(iframe.attr('src'), docPageUrl);
  if (!iframeSrc) return null;

  const viewerRes = await http.get(iframeSrc);
  if (!viewerRes.ok) return null;
  const $$ = cheerio.load(viewerRes.body);
  const scriptText = $$('#main-content-wrapper script').first().html() || $$('script').text();
  const match = scriptText.match(/"custom"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return null;

  const rawObject = match[1]
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\\//g, '/');
  try {
    const parsed = JSON.parse(rawObject);
    if (parsed.downloadLink) {
      return { downloadLink: absoluteHref(parsed.downloadLink, iframeSrc), kind: 'doc' };
    }
  } catch { /* fall through */ }
  return null;
}

async function resolvePageContent(http, pageUrl) {
  const res = await http.get(pageUrl);
  if (!res.ok) return null;
  const $ = cheerio.load(res.body);
  const content = $('.s-page-content-full').first();
  if (!content.length) return null;
  const images = [];
  content.find('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) images.push(absoluteHref(src, pageUrl));
  });
  return { html: content.html() || '', images };
}

// Scrape the body of an assignment / assessment page. We look for:
//   - Google Drive/Docs/Sheets/Slides links anywhere on the page (links + iframe srcs)
//   - A score / grade if visible
//   - A description / directions block
//   - Quiz questions with answer choices, marking the user's pick and the correct
//     answer when Schoology shows them
//
// Selectors are best-effort across Schoology themes. Anything we can't find is just
// omitted — the saved HTML always falls back to a "View on Schoology" link.
const GOOGLE_HOST_REGEX = /https?:\/\/(?:docs|drive|sheets|slides)\.google\.com\/[^\s"'<>)]+/gi;

function classifyGoogleLink(url) {
  if (url.includes('/document/')) return 'Doc';
  if (url.includes('/spreadsheets/') || url.includes('sheets.google')) return 'Sheet';
  if (url.includes('/presentation/') || url.includes('slides.google')) return 'Slides';
  if (url.includes('/forms/')) return 'Form';
  if (url.includes('drive.google')) return 'Drive file';
  return 'Google file';
}

async function resolveAssignment(http, assignmentUrl, browser = null) {
  const res = await http.get(assignmentUrl);
  if (!res.ok) return null;
  const $ = cheerio.load(res.body);
  const baseUrl = res.url;

  const data = {
    score: null,
    description: '',
    googleLinks: [],
    questions: [],
    submissionsLink: null,
    viaBrowser: false
  };

  // ---- description / directions ----
  const descSelectors = [
    '.info-body.s-rte',        // Round Rock ISD (real, confirmed)
    '.info-body',
    '.summary-rte', '.assignment-description', '.assessment-description',
    '.s-page-content-full', '#assignment-description', '.assignment-body',
    '.assessment-summary'
  ];
  for (const sel of descSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 0) {
      data.description = el.html() || '';
      break;
    }
  }

  // ---- due date / metadata ----
  const $details = $('.assignment-details').first();
  if ($details.length) {
    data.metadata = $details.text().replace(/\s+/g, ' ').trim();
  }

  // ---- score / grade ----
  const scoreSelectors = [
    '.grading-grade',          // Round Rock ISD (real, confirmed) — e.g. "Grade: 100/100"
    '.gradebook-score', '.score-display', '.grade-display', '.assignment-grade',
    '.numeric-grade', '.user-score', '.your-score'
  ];
  for (const sel of scoreSelectors) {
    const el = $(sel).first();
    if (el.length) {
      let text = el.text().replace(/\s+/g, ' ').trim();
      // Strip leading "Grade:" / "Score:" prefix Schoology adds.
      text = text.replace(/^(Grade|Score)\s*[:=]\s*/i, '');
      if (text && text !== 'N/A' && text.length < 80) { data.score = text; break; }
    }
  }
  // Fallback: text patterns like "Grade: 95/100" or "Score: 18/20" anywhere on the page.
  if (!data.score) {
    const bodyText = $('body').text();
    const m = bodyText.match(/(?:Grade|Score)\s*[:=]\s*([\d.]+\s*\/\s*[\d.]+)/i);
    if (m) data.score = m[1];
  }

  // ---- google links (anywhere in the page) ----
  const seen = new Set();
  function addGoogle(url) {
    if (!url) return;
    let clean = url.replace(/&amp;/g, '&').replace(/[)\].,;]+$/, '');
    if (!seen.has(clean)) { seen.add(clean); data.googleLinks.push({ url: clean, kind: classifyGoogleLink(clean) }); }
  }
  $('a[href*="google.com"]').each((_, el) => addGoogle($(el).attr('href')));
  $('iframe[src*="google.com"]').each((_, el) => addGoogle($(el).attr('src')));
  // Also grep the raw HTML — Schoology sometimes stores Google embeds inside HTML
  // comments (hidden until the lazy-loader expands them).
  const rawMatches = res.body.match(GOOGLE_HOST_REGEX) || [];
  for (const m of rawMatches) addGoogle(m);

  // ---- quiz questions ----
  // Schoology assessment review pages typically have a list of questions, each with
  // answer choices and (when released) the user's submitted answer + the correct one.
  const questionSel = '.question-item, .question-content, .q-content, .question-row, .assessment-question, .question';
  $(questionSel).each((_, el) => {
    const $q = $(el);
    const qText = ($q.find('.q-text, .question-text, .question-body, .stem, .question-stem').first().text() ||
                   $q.find('p').first().text() || $q.text().split('\n')[0]).trim();
    if (!qText) return;
    const answers = [];
    $q.find('.answer, .answer-option, .answer-choice, .choice, li').each((_, a) => {
      const $a = $(a);
      const text = $a.text().replace(/\s+/g, ' ').trim();
      if (!text || text.length > 500) return;
      const cls = ($a.attr('class') || '') + ' ' + ($a.find('input').attr('class') || '');
      const isSelected = /selected|user-answer|chosen|your-answer/i.test(cls) || $a.find('input:checked').length > 0;
      const isCorrect = /\bcorrect\b/i.test(cls) && !/incorrect/i.test(cls);
      answers.push({ text, selected: isSelected, correct: isCorrect });
    });
    data.questions.push({ text: qText, answers });
  });

  // ---- link to attempts/review page (best-effort) ----
  const reviewLink = $('a[href*="/attempt/"], a[href*="/review/"], a:contains("Review"), a:contains("View Submission")').first();
  if (reviewLink.length) {
    const href = reviewLink.attr('href');
    if (href) data.submissionsLink = absoluteHref(href, baseUrl);
  }

  // ---- React UI fallback ----
  // Detect Schoology's new React-based assignment UI: the final URL after redirect
  // uses /assignments/ (plural) instead of /assignment/, AND/OR the page has
  // window.initSgyUiApp / caAssessmentDelivery React mounts. In that case the
  // description, attachments, and any Google doc link only appear after JS runs
  // (and often only after clicking the "My Document" tab).
  const isReactUI = /\/assignments\//.test(baseUrl) ||
                    res.body.includes('window.initSgyUiApp') ||
                    res.body.includes('design-system-view');
  const haveAnythingUseful = data.description || data.score || data.googleLinks.length || data.questions.length;
  if (isReactUI && !haveAnythingUseful && browser) {
    try {
      const rendered = await browser.fetchRendered(assignmentUrl, {
        clickTexts: ['My Document', 'My Submission', 'Submission', 'View'],
        waitForSelectors: ['a[href*="google.com"]', 'iframe[src*="google.com"]', '.assignment-description', '[class*="dropbox"]']
      });
      data.viaBrowser = true;
      data.screenshotBuffer = rendered.screenshot;
      data.renderedHtml = rendered.html;
      // Detect LTI/Google Drive integration so the rendered HTML can flag it.
      data.usesLtiGoogleSubmission = /\/apps\/lti\/[^\"]+context=assignment_submission/.test(rendered.html) ||
                                     /lti-submission-google\.app\.schoology\.com/.test(rendered.html);
      // Extract Google links from rendered HTML
      const $$ = cheerio.load(rendered.html);
      const seen = new Set(data.googleLinks.map(g => g.url));
      function addGoogle(url) {
        if (!url) return;
        const clean = url.replace(/&amp;/g, '&').replace(/[)\].,;]+$/, '');
        if (!seen.has(clean)) { seen.add(clean); data.googleLinks.push({ url: clean, kind: classifyGoogleLink(clean) }); }
      }
      $$('a[href*="google.com"]').each((_, el) => addGoogle($$(el).attr('href')));
      $$('iframe[src*="google.com"]').each((_, el) => addGoogle($$(el).attr('src')));
      (rendered.html.match(GOOGLE_HOST_REGEX) || []).forEach(addGoogle);
      // Also retry pulling description/score from the rendered DOM.
      if (!data.description) {
        for (const sel of ['.assignment-description', '.info-body.s-rte', '[class*="description"]']) {
          const el = $$(sel).first();
          if (el.length && el.text().trim().length > 0) { data.description = el.html() || ''; break; }
        }
      }
      if (!data.score) {
        const m = $$('body').text().match(/(?:Grade|Score)\s*[:=]\s*([\d.]+\s*\/\s*[\d.]+)/i);
        if (m) data.score = m[1];
      }
    } catch (err) {
      console.warn(`    ⚠ Puppeteer assignment fallback failed for ${assignmentUrl}: ${err.message}`);
    }
  }

  return data;
}

async function resolveEmbeddedPage(http, pageUrl) {
  const res = await http.get(pageUrl);
  if (!res.ok) return null;
  // Schoology hides the iframe inside HTML comments to lazy-load it; strip them first.
  const cleaned = res.body.replaceAll('<!--', '').replaceAll('-->', '');
  const $ = cheerio.load(cleaned);
  const iframe = $('iframe').first();
  if (!iframe.length) return null;
  return absoluteHref(iframe.attr('src'), pageUrl);
}

async function resolveCommonAssessment(http, browser, url) {
  // 1) Always pull the static HTML — it has score + page title, which we want
  //    regardless of whether the browser branch works.
  const data = { score: null, screenshotPath: null, renderedHtmlPath: null, viaBrowser: false };
  try {
    const res = await http.get(url);
    if (res.ok) {
      const $ = cheerio.load(res.body);
      const scoreText = $('.grading-grade').first().text().replace(/^(Grade|Score)\s*[:=]\s*/i, '').replace(/\s+/g, ' ').trim();
      if (scoreText && scoreText !== 'N/A') data.score = scoreText;
    }
  } catch { /* fall through */ }

  // 2) If we have a browser, render the page so the React app loads the questions.
  if (browser) {
    try {
      const rendered = await browser.fetchRendered(url);
      data.viaBrowser = true;
      data.renderedHtml = rendered.html;
      data.screenshotBuffer = rendered.screenshot;
    } catch (err) {
      console.warn(`    ⚠ Puppeteer fetch failed for ${url}: ${err.message}`);
    }
  }
  return data;
}

// Walk a folder/material table. `tableHtml` is the inner HTML of a tbody.
// `browser` is an optional Puppeteer client used for Common Assessments.
async function walkTable(http, browser, tableHtml, baseUrl, courseId, depth = 0) {
  const $ = cheerio.load(`<table><tbody>${tableHtml}</tbody></table>`);
  const rows = $('tbody > tr').toArray();
  const out = [];

  for (const row of rows) {
    const $row = $(row);
    // Peek at any link inside the row to enable URL-based classification
    // (Common Assessments don't have a recognizable CSS class — we detect them
    // by their /assessments/<id> href).
    const peekHref = absoluteHref($row.find('a[href]').first().attr('href'), baseUrl);
    const type = classify($row, peekHref || '');
    const titleSelector = pickTitleSelector(type);
    const $title = $row.find(titleSelector).first();
    let title = ($title.text() || '').trim();
    let href = absoluteHref($title.attr('href'), baseUrl) || peekHref;
    if (!title) title = ($row.find('a[href]').first().text() || '').trim();

    // Embedded page fallback (text-based detection — matches the original).
    if (!title && $row.text().includes('Embedded Page')) {
      const $alt = $row.find('.document-body-title a').first();
      title = ($alt.text() || '').trim();
      href = absoluteHref($alt.attr('href'), baseUrl);
      const realSrc = href ? await resolveEmbeddedPage(http, href) : null;
      out.push({ type: 'embedded_page', title, href: realSrc || href });
      continue;
    }

    if (!title) {
      console.warn(`    ⚠ unsupported material row in course ${courseId} (depth ${depth})`);
      continue;
    }

    const material = { type, title, href };

    if (type === 'page' && href) {
      const page = await resolvePageContent(http, href);
      if (page) {
        material.content = page.html;
        material.images = page.images;
      }
    } else if (type === 'document' && href) {
      const resolved = await resolveDocumentDownload(http, href);
      if (resolved) {
        material.downloadLink = resolved.downloadLink;
        material.ext = (resolved.downloadLink.split('?')[0].split('#')[0].split('.').pop() || 'bin').toLowerCase();
        const dupExt = new RegExp(`\\.${material.ext}\\.${material.ext}$`, 'i');
        if (dupExt.test(`${material.title}.${material.ext}`)) {
          material.title = material.title.replace(new RegExp(`\\.${material.ext}$`, 'i'), '');
        }
      }
    } else if ((type === 'assignment' || type === 'assessment') && href) {
      const details = await resolveAssignment(http, href, browser);
      if (details) material.assignmentDetails = details;
    } else if (type === 'common_assessment' && href) {
      const details = await resolveCommonAssessment(http, browser, href);
      if (details) material.commonAssessmentDetails = details;
    } else if (type === 'link' && href) {
      // Schoology wraps external links in a redirect URL with ?path=<real_url>
      try {
        const u = new URL(href);
        material.href = u.searchParams.get('path') || href;
      } catch { /* keep as-is */ }
    } else if (type === 'folder' && href) {
      // Schoology folder URLs vary by school. The common patterns are
      //   /course/<id>/materials?f=<folderId>
      //   /course/<id>/folder/<folderId>
      // Both server-render the materials table filtered to that folder, so we
      // just hit the href directly.
      const folderRes = await http.get(href);
      if (folderRes.ok) {
        const $$ = cheerio.load(folderRes.body);
        const tbody = $$('#course-profile-materials-folders tbody').first();
        if (tbody.length) {
          material.children = await walkTable(http, browser, tbody.html() || '', folderRes.url, courseId, depth + 1);
        } else {
          material.children = [];
        }
      } else {
        console.warn(`    ⚠ folder fetch failed (${folderRes.status}): ${href}`);
        material.children = [];
      }
    }

    out.push(material);
  }
  return out;
}

export async function scrapeCourseMaterials(http, courseId, { browser = null } = {}) {
  const url = `/course/${courseId}/materials`;
  const res = await http.get(url);
  if (!res.ok) {
    throw new Error(`Materials page for course ${courseId} returned ${res.status}`);
  }
  const $ = cheerio.load(res.body);

  // Grab the full course title from the page header (same selector the original
  // bookmarklet uses). Falls back to <title> or the page heading.
  let title = ($('#main-content-wrapper .page-title').first().text() || '').trim();
  if (!title) title = ($('h1.page-title, .page-title h1, h1').first().text() || '').trim();
  if (!title) {
    const docTitle = ($('title').first().text() || '').trim();
    title = docTitle.replace(/\s*\|\s*Schoology\s*$/i, '').replace(/^Course Materials:\s*/i, '');
  }

  const tbody = $('#course-profile-materials-folders tbody').first();
  if (!tbody.length) {
    return { materials: [], title, note: 'No materials table found on this course page.' };
  }
  const materials = await walkTable(http, browser, tbody.html() || '', res.url, courseId, 0);
  return { materials, title };
}
