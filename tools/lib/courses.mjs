// Enumerate the user's courses (active + archived) by scraping the courses page.
//
// Schoology's course list HTML varies by school, but two patterns are extremely common:
//   - /courses                        active courses (sometimes redirects to /courses/mycourses/current)
//   - /courses/mycourses/past         archived/past courses
//
// Each course tile typically links to /course/<id> or /course/<id>/materials.
// We extract every unique /course/<number> link we can find on those pages.

import * as cheerio from 'cheerio';

const COURSE_ID_REGEX = /\/course\/(\d+)/;

function extractCoursesFromHtml(html, sourceLabel) {
  const $ = cheerio.load(html);
  const seen = new Map();

  $('a[href*="/course/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(COURSE_ID_REGEX);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;

    // Try to find a sensible title for this course.
    let title = $(el).attr('title') || $(el).text().trim();
    if (!title || title.length < 2) {
      // Walk up to a parent that has a heading or aria-label.
      const parent = $(el).closest('[aria-label], .course-item, .course-card, li, article, .course-info');
      title = parent.attr('aria-label') || parent.find('h2,h3,h4,.course-title,.course-name').first().text().trim() || title;
    }
    if (!title) title = `Course ${id}`;
    seen.set(id, { id, title: title.replace(/\s+/g, ' ').trim(), source: sourceLabel });
  });

  return [...seen.values()];
}

export async function enumerateCourses(http, { includeArchived = true } = {}) {
  const buckets = [
    { url: '/courses', label: 'active' },
    { url: '/courses/mycourses/current', label: 'active' }
  ];
  if (includeArchived) {
    buckets.push({ url: '/courses/mycourses/past', label: 'archived' });
    buckets.push({ url: '/courses/mycourses/archived', label: 'archived' });
  }

  const all = new Map();
  for (const b of buckets) {
    try {
      const res = await http.get(b.url);
      if (!res.ok) {
        console.warn(`  ⚠ ${b.url} returned ${res.status}, skipping`);
        continue;
      }
      const found = extractCoursesFromHtml(res.body, b.label);
      console.log(`  ${b.url} → ${found.length} course link(s)`);
      for (const c of found) {
        if (!all.has(c.id)) all.set(c.id, c);
      }
    } catch (err) {
      console.warn(`  ⚠ failed to fetch ${b.url}: ${err.message}`);
    }
  }

  return [...all.values()];
}
