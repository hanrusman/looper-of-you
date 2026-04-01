import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3000;

// --- MIME types ---
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// --- Fetch helper (reused from chordProxy.js) ---
function fetchUrl(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = mod.get(
      {
        hostname: opts.hostname,
        path: opts.pathname + opts.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(new URL(res.headers.location, url).href).then(resolve, reject);
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// --- Chord search/fetch logic (same as chordProxy.js) ---

async function searchGuitarTabs(query) {
  const url = `https://www.guitartabs.cc/search.php?tabtype=chords&band=${encodeURIComponent(query)}`;
  const res = await fetchUrl(url);
  if (res.status !== 200) return [];
  const results = [];
  const rowRegex = /<tr[^>]*>[\s\S]*?<a\s+href="(\/tabs\/[^"]*_crd[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = rowRegex.exec(res.data)) !== null) {
    results.push({ title: m[2].trim(), artist: m[3].trim(), url: `https://www.guitartabs.cc${m[1]}`, source: 'guitartabs' });
  }
  return results;
}

async function fetchGuitarTabsContent(url) {
  const res = await fetchUrl(url);
  if (res.status !== 200) return null;
  const preMatches = res.data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g);
  if (!preMatches || preMatches.length < 2) return null;
  const contentMatch = preMatches[1].match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!contentMatch) return null;
  return contentMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
}

async function fetchCifraClubContent(url) {
  const res = await fetchUrl(url);
  if (res.status !== 200) return null;
  const preMatch = res.data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!preMatch) return null;
  const ogTitle = res.data.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
  const ogParts = (ogTitle?.[1] || '').split(' - ');
  const h1Match = res.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const h2ArtistMatch = res.data.match(/<h2[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
  return {
    content: preMatch[1].replace(/<b>([^<]*)<\/b>/g, '$1').replace(/<span[^>]*>[^<]*<\/span>/g, '').replace(/<\/?[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim(),
    title: (h1Match?.[1] || '').trim() || (ogParts[0] || '').trim(),
    artist: (h2ArtistMatch?.[1] || '').trim() || (ogParts[1] || '').replace(/\s*-\s*Cifra Club/i, '').trim() || '',
  };
}

async function combinedSearch(query) {
  const results = [];
  try { results.push(...await searchGuitarTabs(query)); } catch {}
  const words = query.trim().split(/\s+/);
  if (words.length >= 2) {
    for (let split = 1; split < words.length; split++) {
      const partA = words.slice(0, split).join('-').toLowerCase();
      const partB = words.slice(split).join('-').toLowerCase();
      const url1 = `https://www.cifraclub.com.br/${partB}/${partA}/`;
      try {
        const check = await fetchUrl(url1);
        if (check.status === 200 && check.data.includes('<pre')) {
          const titleMatch = check.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
          const artistMatch = check.data.match(/<a[^>]*class="[^"]*art[^"]*"[^>]*>([^<]+)<\/a>/);
          results.push({ title: titleMatch?.[1]?.trim() || partA.replace(/-/g, ' '), artist: artistMatch?.[1]?.trim() || partB.replace(/-/g, ' '), url: url1, source: 'cifraclub' });
        }
      } catch {}
      const url2 = `https://www.cifraclub.com.br/${partA}/${partB}/`;
      if (url2 !== url1) {
        try {
          const check = await fetchUrl(url2);
          if (check.status === 200 && check.data.includes('<pre')) {
            const titleMatch = check.data.match(/<h1[^>]*>([^<]+)<\/h1>/);
            const artistMatch = check.data.match(/<a[^>]*class="[^"]*art[^"]*"[^>]*>([^<]+)<\/a>/);
            results.push({ title: titleMatch?.[1]?.trim() || partB.replace(/-/g, ' '), artist: artistMatch?.[1]?.trim() || partA.replace(/-/g, ' '), url: url2, source: 'cifraclub' });
          }
        } catch {}
      }
    }
  }
  const seen = new Set();
  return results.filter((r) => { if (seen.has(r.url)) return false; seen.add(r.url); return true; });
}

async function lookupBpm(title, artist) {
  try {
    const query = `${title} ${artist}`.trim();
    const res = await fetchUrl(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`);
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
  } catch { return 0; }
}

// --- HTTP Server ---

function serveStatic(pathname, res) {
  const filePath = join(DIST_DIR, pathname);
  if (!existsSync(filePath)) return false;
  try {
    const content = readFileSync(filePath);
    const ext = extname(pathname);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(content);
    return true;
  } catch { return false; }
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // --- API routes ---
  if (pathname === '/api/chords/search') {
    try {
      const query = url.searchParams.get('q');
      if (!query) return jsonResponse(res, 400, { error: 'Missing q parameter' });
      const results = await combinedSearch(query);
      jsonResponse(res, 200, results);
    } catch (e) {
      jsonResponse(res, 500, { error: e.message || 'Search failed' });
    }
    return;
  }

  if (pathname === '/api/chords/fetch') {
    try {
      const tabUrl = url.searchParams.get('url');
      const source = url.searchParams.get('source');
      if (!tabUrl) return jsonResponse(res, 400, { error: 'Missing url parameter' });
      const songTitle = url.searchParams.get('title') || '';
      const songArtist = url.searchParams.get('artist') || '';

      if (source === 'cifraclub') {
        const result = await fetchCifraClubContent(tabUrl);
        if (result) {
          const effectiveTitle = result.title || songTitle;
          const effectiveArtist = result.artist || songArtist;
          const bpm = await lookupBpm(effectiveTitle, effectiveArtist);
          return jsonResponse(res, 200, { content: result.content, title: effectiveTitle, artist: effectiveArtist, bpm, source: 'cifraclub' });
        }
      } else {
        const content = await fetchGuitarTabsContent(tabUrl);
        if (content) {
          const bpm = await lookupBpm(songTitle, songArtist);
          return jsonResponse(res, 200, { content, bpm, source: 'guitartabs' });
        }
      }
      jsonResponse(res, 404, { error: 'Chord content not found' });
    } catch (e) {
      jsonResponse(res, 500, { error: e.message || 'Fetch failed' });
    }
    return;
  }

  // --- Health check ---
  if (pathname === '/health') {
    jsonResponse(res, 200, { status: 'ok' });
    return;
  }

  // --- Static files ---
  if (serveStatic(pathname, res)) return;

  // --- SPA fallback: serve index.html for all other routes ---
  serveStatic('/index.html', res) || jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Akkoordenboek server running on http://0.0.0.0:${PORT}`);
});
