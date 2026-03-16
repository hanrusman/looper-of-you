import ChordSheetJS from 'chordsheetjs';

/**
 * Maps ChordSheetJS section tag names to labels our parser recognizes.
 */
const SECTION_TAG_MAP = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  intro: 'Intro',
  outro: 'Outro',
  interlude: 'Interlude',
  solo: 'Solo',
  part: null,
};

/**
 * Maps Portuguese section names from Cifra Club to English equivalents.
 */
const PORTUGUESE_SECTION_MAP = {
  'primeira parte': 'Verse',
  'segunda parte': 'Verse 2',
  'terceira parte': 'Verse 3',
  'quarta parte': 'Verse 4',
  'refrão': 'Chorus',
  'refrao': 'Chorus',
  'ponte': 'Bridge',
  'introdução': 'Intro',
  'introducao': 'Intro',
  'intro': 'Intro',
  'outro': 'Outro',
  'final': 'Outro',
  'solo': 'Solo',
  'interlúdio': 'Interlude',
  'interludio': 'Interlude',
  'pré-refrão': 'Pre-chorus',
  'pre-refrao': 'Pre-chorus',
  // Cifra Club often has "Dedilhado" (fingerpicking) sections — skip these
  'dedilhado': null,
  'dedilhado - primeira parte': null,
  'dedilhado - segunda parte': null,
  'dedilhado - refrão': null,
};

/**
 * Normalize Cifra Club section headers in the raw text before parsing.
 * Converts Portuguese section names and filters out fingerpicking sections.
 */
function normalizeCifraClubText(text) {
  const lines = text.split('\n');
  const outputLines = [];
  let skipUntilNextSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line is a section header [Something]
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      const lower = sectionName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Check if this is a Portuguese section name
      const mapped = PORTUGUESE_SECTION_MAP[lower];
      if (mapped === null) {
        // Skip this section (e.g., fingerpicking tabs)
        skipUntilNextSection = true;
        continue;
      } else if (mapped) {
        skipUntilNextSection = false;
        outputLines.push(`[${mapped}]`);
        continue;
      }

      // Not Portuguese — pass through (already English)
      skipUntilNextSection = false;
      outputLines.push(trimmed);
      continue;
    }

    if (skipUntilNextSection) continue;
    outputLines.push(line);
  }

  return outputLines.join('\n');
}

/**
 * Convert a chord sheet (from any source) to our ChordPro format.
 *
 * @param {string} inputText - Raw chord text (chords-over-words or ChordPro)
 * @returns {{ chordProText: string, capo: number, detectedTitle: string, detectedArtist: string }}
 */
export function convertToChordPro(inputText) {
  if (!inputText || !inputText.trim()) {
    return { chordProText: '', capo: 0, detectedTitle: '', detectedArtist: '' };
  }

  // Normalize Cifra Club Portuguese section headers
  let text = normalizeCifraClubText(inputText.trim());

  // Extract capo
  let capo = 0;
  const capoMatch = text.match(/[Cc]apo[:\s]*(\d+)/);
  if (capoMatch) {
    capo = parseInt(capoMatch[1], 10);
  }

  // Detect format
  const hasChordProBrackets = /\[[A-G][#b]?m?[^[\]]*\]/.test(text);
  const hasChordsOverWords = /^[ \t]*[A-G][#b]?m?\d?.*$/m.test(text);

  let song;
  if (hasChordProBrackets && !hasChordsOverWords) {
    const parser = new ChordSheetJS.ChordProParser();
    song = parser.parse(text);
  } else {
    const parser = new ChordSheetJS.ChordsOverWordsParser();
    song = parser.parse(text);
  }

  // Build ChordPro output
  const outputLines = [];

  for (const line of song.lines) {
    if (!line.items || line.items.length === 0) continue;

    for (const item of line.items) {
      if (item.name) {
        if (item.name.startsWith('end_of_')) continue;

        if (item.name.startsWith('start_of_')) {
          const sectionType = item.name.replace('start_of_', '');
          const label = item.value || '';
          let sectionName = label || SECTION_TAG_MAP[sectionType] || 'Verse';

          if (outputLines.length > 0) outputLines.push('');
          outputLines.push(`[${sectionName}]`);
          continue;
        }
        continue;
      }
    }

    // Build chord+lyrics line
    let lineStr = '';
    for (const item of line.items) {
      if (item.name) continue;
      const chord = (item.chords || '').trim();
      const lyrics = item.lyrics || '';
      // Skip non-chord entries: repeat markers like (4), x4, etc.
      const isRealChord = chord && /^[A-G]/.test(chord);
      if (isRealChord) {
        lineStr += `[${chord}]${lyrics}`;
      } else if (lyrics) {
        lineStr += lyrics;
      }
    }

    const trimmedLine = lineStr.trim();
    if (trimmedLine) {
      if (/^[Cc]apo[:\s]*\d+$/.test(trimmedLine)) continue;
      if (/^x\d+$/i.test(trimmedLine)) continue;
      // Skip "Parte X De Y" lines from Cifra Club fingerpicking
      if (/^Parte \d+ De \d+$/i.test(trimmedLine)) continue;
      outputLines.push(trimmedLine);
    }
  }

  let detectedTitle = song.title || '';
  let detectedArtist = song.artist || '';

  const chordProText = outputLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    // Snap chords to word boundaries: "You're g[Em7]onna" → "You're [Em7]gonna"
    // Only when chord is mid-word (preceded by letters AND followed by letters)
    .replace(/([a-zA-Z',]+)(\[[\w#b/]+\])(?=[a-zA-Z])/g, '$2$1')
    .trim();

  return { chordProText, capo, detectedTitle, detectedArtist };
}
