# Schoology Archive — Claude Context

## What This Is

A personal archiver for Soham's Schoology (Round Rock ISD) account. Three components:
- **CLI scraper** (`npm run scrape`) — downloads every course's materials into organized `data/` folders
- **Static mirror** (`npm run mirror`) — Schoology-look-alike browseable snapshot in `data/_mirror/`
- **Local viewer** (`npm run serve`) — Express server at http://localhost:3000

Account: 44 courses (8 active + 36 archived) on `https://roundrockisd.schoology.com`.  
Active courses: Adv Alg II, Adv Biology, Adv CS I, Adv Thea Arts I, Advanced English I, APHG-Spring, Inst Ensemble I, Symphonic Band I.

## Repo Layout

```
tools/                        # all custom code
├── scrape.mjs                # CLI: enumerate courses + scrape each
├── mirror.mjs                # CLI: static mirror everything
├── server.mjs                # Express viewer (/, /file/, /mirror/* routes)
├── config.json               # GITIGNORED — {domain, cookie, includeArchived, dataDir, port}
├── config.example.json       # template
└── lib/
    ├── config.mjs            # loads config.json
    ├── http.mjs              # cookie-aware fetch, 15 req/5s rate limit + retry
    ├── browser.mjs           # shared Puppeteer instance (cookies set once)
    ├── courses.mjs           # enumerate /courses + /courses/mycourses/{current,past,archived}
    ├── scraper.mjs           # cheerio walker + Puppeteer fallback for React UI
    ├── download.mjs          # persists materials to disk
    └── mirror.mjs            # Puppeteer page capture + asset capture + URL rewriter

src/                          # original bookmarklet — DO NOT MODIFY (kept for reference)
data/                         # gitignored normally; committed for portability (4.6 GB total)
├── <courseId>/
│   ├── manifest.json         # full scraped tree + metadata
│   └── <folders/files>       # PDFs, HTML pages, .url shortcuts, quiz screenshots
└── _mirror/
    ├── pages/<path>.html     # mirrored pages (rewritten URLs)
    └── _assets/<host>/<path> # captured CSS/JS/images/fonts
```

## Running

```bash
cd tools && npm install
cp config.example.json config.json   # fill in domain + cookie

npm run scrape                        # all 44 courses (~30-45 min)
npm run scrape -- --course <id>       # one course
npm run scrape -- --list              # list courses only
npm run scrape -- --no-browser        # skip Puppeteer (faster, no quiz capture)

npm run mirror                        # all courses (~5-10 hours full deep)
npm run mirror -- --course <id>
npm run mirror -- --shallow           # 5 main pages per course only
npm run mirror -- --dashboard         # /home page only

npm run serve                         # http://localhost:3000
```

## Schoology Gotchas (Hard-Won)

### Two IDs per course
Every course has a **section ID** (used for materials/folders) and a **parent ID** (used for assessments/breadcrumbs). `mirror.mjs` maintains an alias map to treat them as equivalent.

### Folder URLs
Use query-string form: `/course/<id>/materials?f=<folderId>` — NOT `/folder/`.

### Two assignment UIs
- **Old PHP** `/assignment/<id>` — server-rendered; cheerio works. Has `.info-body.s-rte` description, `.grading-grade` score.
- **New React** `/assignments/<id>/info` (plural) — React app; requires Puppeteer.

### Common Assessments
`/course/<cid>/assessments/<aid>` — React quiz tool. Landing page has score + "View" link. "View" is a React click handler (no URL change) that loads the submission review. Must click via Puppeteer to capture questions.

### My Document tab (LTI/Google Drive)
The tab loads an LTI iframe (`/apps/lti/<id>/run/assignment/<aid>?context=assignment_submission`) which is X-Frame-Options blocked when iframed. Fix: visit the LTI URL **top-level** in Puppeteer — it redirects to `lti-submission-google.app.schoology.com/assignment/student/<id>` whose rendered HTML contains the real Google doc URL. Save as `<basename>__my_document.html` with a yellow banner injected with the recovered URL.

### Cookie expiry
Sessions last ~2 weeks. When 401s or login redirects start, refresh the cookie automatically — do NOT ask the user to paste it from DevTools.

**Use `tools/refresh-cookie.py`** — it reads cookies straight from logged-in Chrome, decrypts via macOS Keychain, and updates whichever target needs the cookie. Pick the right invocation:

```bash
python3 tools/refresh-cookie.py --print-only            # just print, don't touch anything
python3 tools/refresh-cookie.py --also-local --skip-secret   # local mirror/scrape only
python3 tools/refresh-cookie.py --also-local --trigger  # local + GH secret + dispatch workflow
python3 tools/refresh-cookie.py --trigger               # GH secret + dispatch workflow
```

Prerequisites:
- User is logged into Schoology in **Chrome** (not Safari/Firefox/Arc)
- For anything touching GitHub: `GITHUB_TOKEN` env var, or `tools/.github-token` file (gitignored), with `repo` scope
- First run will pop a macOS Keychain GUI prompt — user clicks "Always Allow"

Only fall back to asking the user to paste the cookie if the script fails (e.g. Chrome encryption scheme changed, Keychain access denied).

### Rate limit
~15 requests per 5 seconds. `lib/http.mjs` handles this. Schoology 429s past that.

## Mirror Architecture

### URL rewriting (`lib/mirror.mjs` → `rewriteHtml`)
1. Course-ID aliases normalized first
2. Absolute `https://` URLs → `/mirror/_assets/<host>/<path>` (assets) or `/mirror/pages/<path>.html` (mirrored pages)
3. Root-relative `/...` URLs → same, resolved against page URL
4. `srcset` per-URL, `<style>` blocks' `url(...)` rewritten
5. URLs starting with `/mirror/` are **skipped** (prevents double-rewrite bug)
6. URLs for pages not yet mirrored are left **absolute** (fall through to live Schoology)

### Injected into every mirrored page
- `<meta name="color-scheme" content="light">` — prevents browser dark-mode adjustments
- Tile-click shim: finds `[data-key^=".$<id>"]` elements and binds them to `/mirror/pages/course/<id>.html` (dashboard React tile clicks are otherwise dead)

### Puppeteer sharing
Single browser instance in `lib/browser.mjs`. Cookies set once. `_rawNewPage()` exposed for `mirror.mjs` to attach response listeners for asset capture.

## Known Brittle Selectors

| Location | Selector/Pattern | Risk |
|----------|-----------------|------|
| `lib/browser.mjs` `fetchRendered` | React class names for quiz questions | Schoology React refactor |
| `lib/scraper.mjs` `resolveDocumentDownload` | regex `"custom"\s*:\s*"((?:\\.|[^"\\])*)"` | PDFTron viewer swap |
| Dashboard shim | `[data-key^=".$<id>"]` | Schoology rewrites dashboard |

## Things That Will Never Work (Without Further Auth)

- **Google doc preview** — embed is auth-walled. We extract the URL; clicking opens in user's real browser.
- **/grades** — 403, teacher-side restriction.
- **/members** — 403.
- **Live Schoology features** (search, notifications, real-time feed) — require live JS.

## Excluded From Git

`data/6052026620/U.S. & Canada/U.S Canada PRWPoint.pptx` — 127 MB, over GitHub's 100 MB per-file limit.

## User Preferences

- Pragmatic results over theoretical correctness
- OK with long background tasks (hours)
- Progress tracking via terminal one-liners
- Prefers HTML/screenshots over abstract data dumps
- VS Code on macOS
