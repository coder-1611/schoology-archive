# Schoology Archive (Node CLI + Local Viewer)

A Node-based extension of [schoology-export](https://github.com/dawoodhq/schoology-export). The original tool is a bookmarklet that exports **one course at a time** as a ZIP. This version:

- Runs from your terminal (`node scrape.mjs`)
- Enumerates **every** course you have access to, including **archived** ones
- Downloads every document, page, link, and embedded page into a local folder tree
- Serves it back at **http://localhost:3000** via a small Node server, so you can browse all your archived classes anytime in a browser

---

## Setup (one time)

### 1. Install Node deps
```bash
cd schoology-export/tools
npm install
```
Requires Node 20+.

### 2. Get your Schoology cookie
The script doesn't have a Schoology password — it reuses your existing logged-in session by sending your browser cookie.

1. Log into Schoology in your browser as usual.
2. Open DevTools → **Application** (Chrome/Edge) or **Storage** (Firefox) tab → **Cookies** → pick your Schoology domain.
3. You're looking for one or more cookies named like `SESS<hash>` (Schoology is built on Drupal, which uses session cookies of that form). Copy the **entire cookie header** — easiest way:
   - Network tab → reload page → click any request → in the Request Headers, find the `Cookie:` line → right-click → **Copy value**.

### 3. Create `config.json`
```bash
cp config.example.json config.json
```
Edit it:
```json
{
  "domain": "https://YOURSCHOOL.schoology.com",
  "cookie": "SESSabc123=...; SESSdef456=...",
  "includeArchived": true,
  "dataDir": "./data",
  "port": 3000
}
```
- `domain` — whatever you see in the URL bar after logging in (no trailing slash). If your school uses `app.schoology.com`, use that.
- `cookie` — paste the whole `Cookie:` header value.

The file is `.gitignore`d so it stays local.

---

## Usage

### Scrape everything
```bash
npm run scrape
```
Lists every course it finds (active + archived), then walks each one — fetching folders, documents (resolves the real download URL via Schoology's docviewer), pages, links, embedded pages — and saves them under `./data/<courseId>/`.

Each course gets a `manifest.json` describing the tree + a mirror of the folder structure on disk.

### Variants
```bash
npm run scrape -- --list             # just print discovered courses, don't download
npm run scrape -- --no-archived      # skip archived courses
npm run scrape -- --course 12345678  # scrape one specific course by id
```

### View it
```bash
npm run serve
```
Open **http://localhost:3000** in your browser. You'll see:
- All courses grouped by Active / Archived
- Click a course → tree of folders + items
- Click a document → file opens in a new tab (PDFs, images, html pages, `.url` shortcuts)

The server reads `./data/` live — you can re-run `npm run scrape` anytime to refresh, no restart needed.

---

## How it works (at a glance)

```
tools/
  scrape.mjs        CLI entry: orchestrates enumerate → scrape → persist
  server.mjs        Express app for browsing ./data/
  lib/
    config.mjs      loads + validates config.json
    http.mjs        cookie-aware fetch with 15 req/5 sec rate limit + retries
    courses.mjs     enumerates /courses + /courses/mycourses/past pages
    scraper.mjs     cheerio port of the original DOM scraper, with one twist:
                    fetches each folder's URL directly instead of relying on
                    the user to expand them (since there's no live DOM here)
    download.mjs    persists each material to disk in a sensible layout
data/
  <courseId>/
    manifest.json
    <folder>/<file.ext>
    ...
```

The scraping logic (classifying rows by `type-document` / `material-row-folder` etc., unwrapping the PDFTron doc viewer to find real download URLs, stripping comments around embedded iframes) is faithful to `../src/scraper.js`. The new pieces are:

1. **Course enumeration** (`courses.mjs`) — scans `/courses`, `/courses/mycourses/current`, `/courses/mycourses/past`, and `/courses/mycourses/archived` and unions every `/course/<id>` link.
2. **Folder hydration** — in the bookmarklet, folders show up in the DOM only after the user manually expands them. Here we hit `/course/<id>/folder/<folderId>` directly to get their server-rendered HTML.
3. **Local viewer** (`server.mjs`) — a tiny Express server. Routes:
   - `GET /` — index of all scraped courses
   - `GET /course/:id` — material tree for one course
   - `GET /file/:id/*` — serves a raw file out of `data/<id>/...`

---

## Limitations & gotchas

- **Cookie expires.** Sessions don't last forever. If you get 401/403/redirects to the login page, re-paste a fresh cookie.
- **School-specific URLs.** Schools sometimes use non-default paths for archived courses. If `npm run scrape -- --list` shows no courses or misses archived ones, check what URL your browser uses for the "Past Courses" page and adjust `lib/courses.mjs` (the array of paths at the top).
- **Assignments.** Schoology assignments don't usually have a downloadable body; they're saved as stub HTML files that link back to Schoology.
- **Doc viewer rot.** The trick that extracts the real download URL from the doc viewer relies on a specific JSON shape (`"custom": "..."`) in the viewer page's script tag. If Schoology changes their viewer, that has to be updated in `lib/scraper.mjs → resolveDocumentDownload`.
- **Throughput.** Hard-capped at 15 requests per 5 seconds (matches the original) so Schoology doesn't 429 you. Large archives can take a while.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `No courses found` | Wrong domain or bad cookie | Confirm both in `config.json`; visit `https://<domain>/courses` in your browser to make sure it shows your courses |
| Lots of 403s | Cookie expired | Re-copy cookie and update `config.json` |
| Lots of 429s in the log | Rate limited | Wait a few minutes, re-run; the script already backs off |
| Some files saved with weird `.bin` extension | Doc viewer URL didn't expose an extension | Open the file — usually it's still the right binary, just unnamed |
| Course shows in browser but not in `--list` | Non-standard archived URL for your school | Add your school's "past courses" path to `BUCKETS` in `lib/courses.mjs` |
