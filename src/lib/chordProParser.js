const SECTION_REGEX = /^\[(Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-chorus|Post-chorus|Solo|Couplet|Refrein|Brug)\s*\d*\]$/i;
const CHORD_REGEX = /\[([A-G][#b]?m?\d?(?:sus\d?|add\d?|maj\d?|dim\d?|aug\d?|7|9|11|13|6)?(?:\/[A-G][#b]?)?)\]([^[]*)/g;

const SECTION_LABELS = {
  verse: 'Couplet',
  chorus: 'Refrein',
  bridge: 'Brug',
  intro: 'Intro',
  outro: 'Outro',
  interlude: 'Interlude',
  'pre-chorus': 'Pre-chorus',
  'post-chorus': 'Post-chorus',
  solo: 'Solo',
  couplet: 'Couplet',
  refrein: 'Refrein',
  brug: 'Brug',
};

export function parseChordPro(rawText) {
  const lines = rawText.split('\n');
  const sections = [];
  let currentSection = { type: 'verse', label: 'Couplet', lines: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(SECTION_REGEX);
    if (sectionMatch) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      const type = sectionMatch[1].toLowerCase();
      const label = SECTION_LABELS[type] || sectionMatch[1];
      currentSection = { type, label, lines: [] };
      continue;
    }

    const segments = [];
    let match;

    // Text before first chord
    const firstBracket = trimmed.indexOf('[');
    if (firstBracket > 0) {
      segments.push({ chord: null, lyrics: trimmed.slice(0, firstBracket) });
    }

    CHORD_REGEX.lastIndex = 0;
    while ((match = CHORD_REGEX.exec(trimmed)) !== null) {
      segments.push({ chord: match[1], lyrics: match[2] });
    }

    if (segments.length > 0) {
      currentSection.lines.push({ segments });
    }
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

// Build section boundary data for the structure map
export function buildSectionMap(sections, chordSequence) {
  const map = [];
  for (let si = 0; si < sections.length; si++) {
    const chordsInSection = chordSequence.filter((c) => c.sectionIndex === si);
    if (chordsInSection.length === 0) continue;
    map.push({
      sectionIndex: si,
      type: sections[si].type,
      label: sections[si].label,
      startChordIndex: chordsInSection[0].globalIndex,
      endChordIndex: chordsInSection[chordsInSection.length - 1].globalIndex,
      chordCount: chordsInSection.length,
    });
  }
  return map;
}

// Extract a flat list of all chords in order (for the player timer)
export function extractChordSequence(sections) {
  const chords = [];
  let globalIndex = 0;

  for (let si = 0; si < sections.length; si++) {
    for (let li = 0; li < sections[si].lines.length; li++) {
      for (let segi = 0; segi < sections[si].lines[li].segments.length; segi++) {
        const seg = sections[si].lines[li].segments[segi];
        if (seg.chord) {
          chords.push({
            chord: seg.chord,
            sectionIndex: si,
            lineIndex: li,
            segmentIndex: segi,
            globalIndex: globalIndex++,
          });
        }
      }
    }
  }

  return chords;
}
