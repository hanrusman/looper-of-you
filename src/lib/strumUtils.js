/**
 * Parse a strum pattern string into an array of tokens.
 * @param {string|null} pattern - e.g., "D - D U - U D U"
 * @returns {Array<'D'|'U'|'-'>|null}
 */
export function parseStrumPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return null;
  const tokens = pattern.trim().split(/\s+/).map((t) => {
    const upper = t.toUpperCase();
    if (upper === 'D' || upper === 'U' || upper === '-') return upper;
    return '-'; // Treat unknown tokens as rest
  });
  return tokens.length > 0 ? tokens : null;
}
