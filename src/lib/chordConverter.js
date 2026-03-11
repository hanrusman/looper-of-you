import ChordSheetJS from 'chordsheetjs';

/**
 * Maps ChordSheetJS section tag names to labels our parser recognizes.
 * Our chordProParser.js SECTION_REGEX accepts:
 * Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-chorus|Solo|Couplet|Refrein|Brug
 */
const SECTION_TAG_MAP = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  intro: 'Intro',
  outro: 'Outro',
  interlude: 'Interlude',
  solo: 'Solo',
  part: null, // generic "part" — use the label if provided
};

/**
 * Convert a pasted chord sheet (from Ultimate Guitar or similar) to our ChordPro format.
 *
 * Supports:
 * - "Chords over words" format (UG-style)
 * - ChordPro format (already has [brackets])
 * - Plain chords-over-words from any source
 *
 * @param {string} inputText - Raw pasted text
 * @returns {{ chordProText: string, capo: number, detectedTitle: string, detectedArtist: string }}
 */
export function convertToChordPro(inputText) {
  if (!inputText || !inputText.trim()) {
    return { chordProText: '', capo: 0, detectedTitle: '', detectedArtist: '' };
  }

  const text = inputText.trim();

  // Extract capo from text (UG often has "Capo: 3" or "Capo 3" at top)
  let capo = 0;
  const capoMatch = text.match(/[Cc]apo[:\s]*(\d+)/);
  if (capoMatch) {
    capo = parseInt(capoMatch[1], 10);
  }

  // Try to detect if input is already ChordPro format
  const hasChordProBrackets = /\[[A-G][#b]?m?[^[\]]*\]/.test(text);
  const hasChordsOverWords = /^[ \t]*[A-G][#b]?m?\d?.*$/m.test(text);

  let song;

  if (hasChordProBrackets && !hasChordsOverWords) {
    // Already ChordPro format — parse directly
    const parser = new ChordSheetJS.ChordProParser();
    song = parser.parse(text);
  } else {
    // Chords-over-words format (from UG or any source)
    const parser = new ChordSheetJS.ChordsOverWordsParser();
    song = parser.parse(text);
  }

  // Build our ChordPro output from the parsed song
  const outputLines = [];
  let lastSectionEnded = false;

  for (const line of song.lines) {
    if (!line.items || line.items.length === 0) continue;

    for (const item of line.items) {
      // Section tags
      if (item.name) {
        const tagName = item.name;

        // Skip end tags
        if (tagName.startsWith('end_of_')) {
          lastSectionEnded = true;
          continue;
        }

        // Handle start tags
        if (tagName.startsWith('start_of_')) {
          const sectionType = tagName.replace('start_of_', '');
          const label = item.value || ''; // e.g., "Verse 1", "Chorus"

          // Map to a name our parser understands
          let sectionName;
          if (label) {
            // Use the label directly if it starts with a recognized section name
            sectionName = label;
          } else {
            sectionName = SECTION_TAG_MAP[sectionType] || 'Verse';
          }

          // Add blank line before section (for readability)
          if (outputLines.length > 0) {
            outputLines.push('');
          }
          outputLines.push(`[${sectionName}]`);
          lastSectionEnded = false;
          continue;
        }

        // Skip other metadata tags (title, artist, etc.) but try to extract them
        continue;
      }
    }

    // Build chord+lyrics line from ChordLyricsPair items
    let lineStr = '';
    let hasChordContent = false;

    for (const item of line.items) {
      // Skip tags (already handled above)
      if (item.name) continue;

      const chord = (item.chords || '').trim();
      const lyrics = item.lyrics || '';

      if (chord) {
        lineStr += `[${chord}]${lyrics}`;
        hasChordContent = true;
      } else if (lyrics) {
        lineStr += lyrics;
      }
    }

    const trimmedLine = lineStr.trim();
    if (trimmedLine) {
      // Skip lines that are just capo info
      if (/^[Cc]apo[:\s]*\d+$/.test(trimmedLine)) continue;
      // Skip lines that are just "x2", "x4" etc.
      if (/^x\d+$/i.test(trimmedLine)) continue;

      outputLines.push(trimmedLine);
    }
  }

  // Try to detect title/artist from metadata tags
  let detectedTitle = '';
  let detectedArtist = '';

  if (song.title) detectedTitle = song.title;
  if (song.artist) detectedArtist = song.artist;

  // Clean up: remove excessive blank lines
  const chordProText = outputLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { chordProText, capo, detectedTitle, detectedArtist };
}
