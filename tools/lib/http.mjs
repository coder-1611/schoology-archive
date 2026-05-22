// Cookie-aware fetch with rate limiting + retry. Mirrors the original util.js
// (15 requests per 5 second rolling window).

const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX = 15;
const requestTimestamps = [];

async function checkRateLimit() {
  const now = Date.now();
  requestTimestamps.push(now);
  if (requestTimestamps.length <= RATE_LIMIT_MAX) return;
  const oldest = requestTimestamps.shift();
  const age = now - oldest;
  if (age < RATE_LIMIT_WINDOW_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_WINDOW_MS - age));
  }
}

export function makeHttpClient(config) {
  const baseHeaders = {
    'Cookie': config.cookie,
    'User-Agent': config.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  function resolveUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return config.domain + url;
    return config.domain + '/' + url;
  }

  async function get(url, { asBuffer = false, headers = {}, redirect = 'follow' } = {}) {
    const fullUrl = resolveUrl(url);
    await checkRateLimit();

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers: { ...baseHeaders, ...headers },
          redirect
        });
        if (res.status === 429) {
          const wait = (attempt + 1) * 5000;
          console.warn(`  ⚠ 429 rate-limited on ${fullUrl}, waiting ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        if (!res.ok && res.status >= 500) {
          const wait = (attempt + 1) * 2000;
          console.warn(`  ⚠ ${res.status} on ${fullUrl}, retrying in ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        return {
          ok: res.ok,
          status: res.status,
          url: res.url,
          headers: res.headers,
          body: asBuffer
            ? Buffer.from(await res.arrayBuffer())
            : await res.text()
        };
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastErr || new Error(`Failed to fetch ${fullUrl}`);
  }

  return { get, resolveUrl };
}
