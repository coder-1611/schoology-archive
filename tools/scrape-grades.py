#!/usr/bin/env python3
"""Scrape per-course grades from Schoology's `/course/<id>/student_grades` page
and save structured JSON to `data/<courseId>/grades.json` next to the manifest.

Schoology's `/grades` overview only shows currently-enrolled courses, so once
the school year ends it goes empty. Per-course pages still serve the full
grade table for archived courses, which is what we want.

Usage:
  python3 tools/scrape-grades.py                   # all courses with manifests
  python3 tools/scrape-grades.py <id> [<id>...]    # specific courses

Reads cookie from tools/config.json (same file the mirror uses).
"""

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional

TOOLS_DIR = Path(__file__).resolve().parent
DATA_DIR = TOOLS_DIR / 'data'
CONFIG_PATH = TOOLS_DIR / 'config.json'


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"missing {CONFIG_PATH}")
    return json.load(open(CONFIG_PATH))


def fetch(url: str, cookie: str, user_agent: str) -> str:
    req = urllib.request.Request(url)
    req.add_header('Cookie', cookie)
    req.add_header('User-Agent', user_agent)
    req.add_header('Accept', 'text/html,application/json,*/*')
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


_TR_RE = re.compile(
    r"<tr[^>]*?(?:data-id='([^']*)')?[^>]*?(?:data-parent-id='([^']*)')?[^>]*?class='([^']+)'[^>]*>(.*?)</tr>",
    re.DOTALL,
)
_TITLE_RE = re.compile(r"<span class='title'[^>]*>(.*?)</span></div>", re.DOTALL)
_GRADE_COL_RE = re.compile(r'<td class="grade-column">(.*?)</td>', re.DOTALL)
_AWARDED_RE = re.compile(
    r"<span class='awarded-grade'[^>]*>(.*?)</span>(?:<span class='max-grade'>([^<]+)</span>)?",
    re.DOTALL,
)
_DEPTH_RE = re.compile(r"reportSpacer-(\d+)")
_TAG_RE = re.compile(r'<[^>]+>')


def parse_grades(html: str) -> List[Dict]:
    """Return a flat list of row dicts, each with type/depth/title/grade/max.

    Row types: course | period | category | item.
    """
    rows = []
    for m in _TR_RE.finditer(html):
        did = m.group(1) or ''
        parent = m.group(2) or ''
        cls = m.group(3).split()
        body = m.group(4)

        title = ''
        tm = _TITLE_RE.search(body)
        if tm:
            inner = _TAG_RE.sub('', tm.group(1)).strip()
            # remove appended accessibility text
            inner = re.sub(r'\s*(Course|Category|Period|Section)\s*$', '', inner).strip()
            title = inner

        grade: Optional[str] = None
        max_g: Optional[str] = None
        gm = _GRADE_COL_RE.search(body)
        if gm:
            inner = gm.group(1)
            awm = _AWARDED_RE.search(inner)
            if awm:
                grade = _TAG_RE.sub('', awm.group(1)).strip()
                if awm.group(2):
                    max_g = awm.group(2).replace('&nbsp;', ' ').strip(' /')
            elif 'no-grade' in inner:
                grade = '—'
            if 'excused' in inner or 'Exempt' in inner:
                grade = 'Exempt'

        row_type = 'unknown'
        for t in ('course-row', 'period-row', 'category-row', 'item-row'):
            if t in cls:
                row_type = t.replace('-row', '')
                break

        depth_m = _DEPTH_RE.search(body)
        depth = int(depth_m.group(1)) if depth_m else 0

        # Course-level computed grade — Schoology shows it as text in the
        # td-content-wrapper sometimes (no <span class='awarded-grade'>).
        if row_type == 'course' and not grade and gm:
            inner = gm.group(1)
            txt = _TAG_RE.sub('', inner).strip()
            if txt and txt not in ('', '—'):
                grade = txt

        rows.append({
            'id': did, 'parent': parent, 'type': row_type, 'depth': depth,
            'title': title, 'grade': grade, 'max': max_g,
        })
    return rows


def stats(rows: List[Dict]) -> Dict:
    items = [r for r in rows if r['type'] == 'item']
    graded = [r for r in items if r['grade'] and r['grade'] not in ('—', 'Exempt')]
    # Try to compute a simple average if all items have numeric grades + maxes
    total_awarded = 0.0
    total_max = 0.0
    for r in graded:
        try:
            a = float(r['grade'])
            m = float(r['max']) if r['max'] else 100.0
            total_awarded += a
            total_max += m
        except (TypeError, ValueError):
            pass
    avg = (100.0 * total_awarded / total_max) if total_max else None

    # Course-level grade if Schoology gave us one
    course = next((r for r in rows if r['type'] == 'course'), None)
    course_grade = course['grade'] if course else None

    return {
        'items_total': len(items),
        'items_graded': len(graded),
        'avg_percent': round(avg, 2) if avg is not None else None,
        'course_grade': course_grade,
    }


def discover_courses() -> List[str]:
    out = []
    for d in sorted(DATA_DIR.iterdir()):
        if d.is_dir() and not d.name.startswith('_'):
            if (d / 'manifest.json').exists():
                out.append(d.name)
    return out


def main() -> None:
    cfg = load_config()
    cookie = cfg['cookie']
    domain = cfg.get('domain', 'https://roundrockisd.schoology.com').rstrip('/')
    user_agent = cfg.get('userAgent',
                         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                         'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36')

    course_ids = sys.argv[1:] or discover_courses()
    if not course_ids:
        raise SystemExit("no courses found — pass IDs explicitly or run scrape first")

    print(f'scraping grades for {len(course_ids)} course(s)…', file=sys.stderr)
    rate_delay = 0.3  # be polite
    for cid in course_ids:
        try:
            html = fetch(f'{domain}/course/{cid}/student_grades', cookie, user_agent)
        except urllib.error.HTTPError as e:
            print(f'  ✗ {cid} HTTP {e.code}', file=sys.stderr)
            continue
        except Exception as e:
            print(f'  ✗ {cid} {e!r}', file=sys.stderr)
            continue

        # Detect login-redirect (expired cookie) and bail loudly
        if 'Log in to Schoology' in html[:1000]:
            raise SystemExit(
                f"{cid} returned the login page — cookie is expired. "
                "Refresh tools/config.json (or run tools/refresh-cookie.py)."
            )

        rows = parse_grades(html)
        summary = stats(rows)
        out = {
            'courseId': cid,
            'scrapedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'summary': summary,
            'rows': rows,
        }
        out_path = DATA_DIR / cid / 'grades.json'
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2))
        avg = summary['avg_percent']
        avg_str = f'{avg:.2f}%' if avg is not None else (summary['course_grade'] or '—')
        print(f'  ✓ {cid}  {summary["items_graded"]:>3}/{summary["items_total"]:<3} items  {avg_str}',
              file=sys.stderr)
        time.sleep(rate_delay)


if __name__ == '__main__':
    main()
