import https from 'https';
import http from 'http';

/**
 * Simple fetch helper that follows redirects.
 */
function fetchUrl(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = mod.get(
      {
        hostname: opts.hostname,
        path: opts.pathname + opts.search,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchUrl(
            new URL(res.headers.location, url).href
          ).then(resolve, reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({ status: res.statusCode, data })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Search GuitarTabs.cc for chord sheets.
 * Returns: [{ title, artist, url, source }]
 */
async function searchGuitarTabs(query) {
  // Split query into potential artist + song
  const url = `https://www.guitartabs.cc/search.php?tabtype=chords&band=${encodeURIComponent(query)}`;
  const res = await fetchUrl(url);
  if (res.status !== 200) return [];

  const results = [];
  // Pattern: <a href="/tabs/...crd.html">Song Name</a> ... <a>Artist</a>
  const rowRegex =
    /<tr[^>]*>[\s\S]*?<a\s+href="(\/tabs\/[^"]*_crd[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = rowRegex.exec(res.data)) !== null) {
    results.push({
      title: m[2].trim(),
      artist: m[3].trim(),
      url: `https://www.guitartabs.cc${m[1]}`,
      source: 'guitartabs',
    });
  }
  return results;
}

/**
 * Search Cifra Club by constructing a direct URL.
 * Tries /artist-slug/song-slug/ and returns the content if found.
 */
async function searchCifraClub(query) {
  // Try to split "Song Artist" or "Artist Song" patterns
  // We'll try the query as-is, slugified
  const slug = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // Also try artist/song combinations from GuitarTabs results
  return [];
}

/**
 * Fetch chord content from a GuitarTabs.cc URL.
 * Returns the raw "chords over words" text.
 */
async function fetchGuitarTabsContent(url) {
  const res = await fetchUrl(url);
  if (res.status !== 200) return null;

  // Content is in the second <pre> tag (first is title area)
  const preMatches = res.data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g);
  if (!preMatches || preMatches.length < 2) return null;

  // Get the actual content from the second <pre>
  const contentMatch = preMatches[1].match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!contentMatch) return null;

  return contentMatch[1]
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Fetch chord content from a Cifra Club URL.
 * Returns the raw "chords over words" text.
 */
async function fetchCifraClubContent(url) {
  const res = await fetchUrl(url);
  if (res.status !== 200) return null;

  // Content is in <pre> tag
  const preMatch = res.data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!preMatch) return null;

  // Extract title and artist from the page
  // og:title is "Perfect - Ed Sheeran - Cifra Club"
  const ogTitle = res.data.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
  const ogParts = (ogTitle?.[1] || '').split(' - ');
  const h1Match = res.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
  // Artist is in <h2><a href="/ed-sheeran/">Ed Sheeran</a></h2>
  const h2ArtistMatch = res.data.match(/<h2[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);

  return {
    content: preMatch[1]
      .replace(/<b>([^<]*)<\/b>/g, '$1') // Bold tags wrap chord names
      .replace(/<span[^>]*>[^<]*<\/span>/g, '')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .trim(),
    title: (h1Match?.[1] || '').trim()
      || (ogParts[0] || '').trim(),
    artist: (h2ArtistMatch?.[1] || '').trim()
      || (ogParts[1] || '').replace(/\s*-\s*Cifra Club/i, '').trim()
      || '',
  };
}

/**
 * Combined search: tries GuitarTabs.cc first, then augments with Cifra Club direct URLs.
 */
async function combinedSearch(query) {
  const results = [];

  // 1. Search GuitarTabs.cc
  try {
    const gtResults = await searchGuitarTabs(query);
    results.push(...gtResults);
  } catch (e) {
    console.warn('GuitarTabs search failed:', e.message);
  }

  // 2. Try constructing Cifra Club URLs from the search terms
  // Extract potential artist and song from query
  const words = query.trim().split(/\s+/);
  if (words.length >= 2) {
    // Try: first word(s) as song, last word(s) as artist (and vice versa)
    // Common patterns: "Perfect Ed Sheeran", "Ed Sheeran Perfect"
    for (let split = 1; split < words.length; split++) {
      const partA = words.slice(0, split).join('-').toLowerCase();
      const partB = words.slice(split).join('-').toLowerCase();

      // Try artist=partB, song=partA (e.g., "Perfect Ed-Sheeran" → ed-sheeran/perfect)
      const url1 = `https://www.cifraclub.com.br/${partB}/${partA}/`;
      try {
        const check = await fetchUrl(url1);
        if (check.status === 200 && check.data.includes('<pre')) {
          const titleMatch = check.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
          const artistMatch = check.data.match(/<a[^>]*class="[^"]*art[^"]*"[^>]*>([^<]+)<\/a>/);
          results.push({
            title: titleMatch?.[1]?.trim() || partA.replace(/-/g, ' '),
            artist: artistMatch?.[1]?.trim() || partB.replace(/-/g, ' '),
            url: url1,
            source: 'cifraclub',
          });
        }
      } catch { /* ignore */ }

      // Try artist=partA, song=partB (e.g., "Ed-Sheeran Perfect" → ed-sheeran/perfect)
      const url2 = `https://www.cifraclub.com.br/${partA}/${partB}/`;
      if (url2 !== url1) {
        try {
          const check = await fetchUrl(url2);
          if (check.status === 200 && check.data.includes('<pre')) {
            const titleMatch = check.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
            const artistMatch = check.data.match(/<a[^>]*class="[^"]*art[^"]*"[^>]*>([^<]+)<\/a>/);
            results.push({
              title: titleMatch?.[1]?.trim() || partB.replace(/-/g, ' '),
              artist: artistMatch?.[1]?.trim() || partA.replace(/-/g, ' '),
              url: url2,
              source: 'cifraclub',
            });
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/**
 * Look up BPM from Deezer (free API, no auth).
 * Halves the value when >115 to compensate for double-time detection.
 */
async function lookupBpm(title, artist) {
  try {
    const query = `${title} ${artist}`.trim();
    const res = await fetchUrl(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
    );
    if (res.status !== 200) return 0;
    const json = JSON.parse(res.data);
    const trackId = json.data?.[0]?.id;
    if (!trackId) return 0;

    const detail = await fetchUrl(`https://api.deezer.com/track/${trackId}`);
    if (detail.status !== 200) return 0;
    const track = JSON.parse(detail.data);
    let bpm = track.bpm || 0;
    if (bpm > 115) bpm = Math.round(bpm / 2);
    return bpm;
  } catch {
    return 0;
  }
}

/**
 * Vite server middleware plugin for chord search and fetch.
 */
export function chordProxyPlugin() {
  return {
    name: 'chord-proxy',
    configureServer(server) {
      // Search endpoint
      server.middlewares.use('/api/chords/search', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = url.searchParams.get('q');
          if (!query) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing q parameter' }));
            return;
          }

          const results = await combinedSearch(query);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(results));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message || 'Search failed' }));
        }
      });

      // Fetch chord content endpoint
      server.middlewares.use('/api/chords/fetch', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const tabUrl = url.searchParams.get('url');
          const source = url.searchParams.get('source');

          if (!tabUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          const songTitle = url.searchParams.get('title') || '';
          const songArtist = url.searchParams.get('artist') || '';

          let result;
          if (source === 'cifraclub') {
            result = await fetchCifraClubContent(tabUrl);
            if (result) {
              const effectiveTitle = result.title || songTitle;
              const effectiveArtist = result.artist || songArtist;
              const bpm = await lookupBpm(effectiveTitle, effectiveArtist);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  content: result.content,
                  title: effectiveTitle,
                  artist: effectiveArtist,
                  bpm,
                  source: 'cifraclub',
                })
              );
              return;
            }
          } else {
            const content = await fetchGuitarTabsContent(tabUrl);
            if (content) {
              const bpm = await lookupBpm(songTitle, songArtist);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  content,
                  bpm,
                  source: 'guitartabs',
                })
              );
              return;
            }
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Chord content not found' }));
        } catch (e) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({ error: e.message || 'Fetch failed' })
          );
        }
      });
    },
  };
}
