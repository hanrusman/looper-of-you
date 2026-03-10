/**
 * Extract a YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=abc123
 * - https://youtu.be/abc123
 * - https://youtube.com/embed/abc123
 * - abc123 (direct ID)
 */
export function extractYouTubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID (11 characters, alphanumeric + dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    // youtube.com/watch?v=ID
    if (url.hostname.includes('youtube.com') && url.searchParams.has('v')) {
      return url.searchParams.get('v');
    }

    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1);
    }

    // youtube.com/embed/ID
    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/embed/')[1]?.split('?')[0];
    }
  } catch {
    // Not a valid URL, try to extract ID-like string
    const match = trimmed.match(/[a-zA-Z0-9_-]{11}/);
    return match ? match[0] : null;
  }

  return null;
}
