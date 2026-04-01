import { Midi } from '@tonejs/midi';

/**
 * Parse a MIDI file and extract tempo, time signature, and note onsets per track.
 * @param {ArrayBuffer} arrayBuffer - The MIDI file content
 * @returns {{ tempo, timeSignature, tracks, duration }}
 */
export function parseMidiFile(arrayBuffer) {
  const midi = new Midi(arrayBuffer);

  const tempo = midi.header.tempos?.[0]?.bpm
    ? Math.round(midi.header.tempos[0].bpm)
    : 120;

  const ts = midi.header.timeSignatures?.[0]?.timeSignature;
  const timeSignature = ts ? [ts[0], ts[1]] : [4, 4];

  const tracks = midi.tracks
    .map((track, index) => {
      if (track.notes.length === 0) return null;

      // Collect ALL unique onset times (collapse simultaneous notes within 50ms)
      const rawOnsets = [];
      const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);

      for (const note of sortedNotes) {
        const t = note.time;
        if (rawOnsets.length === 0 || t - rawOnsets[rawOnsets.length - 1] > 0.05) {
          rawOnsets.push(Math.round(t * 1000) / 1000);
        }
      }

      return {
        index,
        name: track.name || `Track ${index + 1}`,
        noteCount: track.notes.length,
        rawOnsetCount: rawOnsets.length,
        rawOnsets,
      };
    })
    .filter(Boolean);

  return {
    tempo,
    timeSignature,
    tracks,
    duration: midi.duration,
  };
}

/**
 * Filter onsets with a minimum interval — collapses rapid notes into groups.
 * Only keeps onsets that are at least `minInterval` seconds apart.
 *
 * @param {number[]} rawOnsets - All onset times
 * @param {number} minInterval - Minimum seconds between chord changes
 * @returns {number[]} Filtered onset times
 */
export function filterOnsets(rawOnsets, minInterval) {
  if (rawOnsets.length === 0) return [];
  const filtered = [rawOnsets[0]];
  for (let i = 1; i < rawOnsets.length; i++) {
    if (rawOnsets[i] - filtered[filtered.length - 1] >= minInterval) {
      filtered.push(rawOnsets[i]);
    }
  }
  return filtered;
}

/**
 * Auto-find the best minimum interval that produces a count closest to chordCount.
 * Uses binary search between 0.1s and 10s.
 *
 * @param {number[]} rawOnsets - All onset times
 * @param {number} chordCount - Target number of chords
 * @returns {{ interval: number, onsets: number[], count: number }}
 */
export function autoFindInterval(rawOnsets, chordCount) {
  if (rawOnsets.length === 0 || chordCount === 0) {
    return { interval: 1, onsets: [], count: 0 };
  }

  // If raw onsets already match, no filtering needed
  if (rawOnsets.length === chordCount) {
    return { interval: 0.05, onsets: [...rawOnsets], count: chordCount };
  }

  // Binary search for the best interval
  let lo = 0.05;
  let hi = 10;
  let bestInterval = 1;
  let bestOnsets = rawOnsets;
  let bestDiff = Math.abs(rawOnsets.length - chordCount);

  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const filtered = filterOnsets(rawOnsets, mid);
    const diff = Math.abs(filtered.length - chordCount);

    if (diff < bestDiff || (diff === bestDiff && Math.abs(mid - 1) < Math.abs(bestInterval - 1))) {
      bestDiff = diff;
      bestInterval = mid;
      bestOnsets = filtered;
    }

    if (filtered.length === chordCount) break;

    if (filtered.length > chordCount) {
      lo = mid; // Need larger interval to get fewer onsets
    } else {
      hi = mid; // Need smaller interval to get more onsets
    }
  }

  // Round to 2 decimals for UI
  bestInterval = Math.round(bestInterval * 100) / 100;
  bestOnsets = filterOnsets(rawOnsets, bestInterval);

  return {
    interval: bestInterval,
    onsets: bestOnsets,
    count: bestOnsets.length,
  };
}

/**
 * Map filtered onsets to a chordTimings array.
 * Returns { chordTimings, warning } where warning is null or a message string.
 *
 * @param {number[]} onsets - Filtered onset times in seconds
 * @param {number} chordCount - Number of chords in the ChordPro text
 * @returns {{ chordTimings: number[], warning: string|null }}
 */
export function mapOnsetsToChords(onsets, chordCount) {
  if (onsets.length === chordCount) {
    return { chordTimings: [...onsets], warning: null };
  }

  if (onsets.length > chordCount) {
    return {
      chordTimings: onsets.slice(0, chordCount),
      warning: `${onsets.length} wisselingen gevonden, ${chordCount} akkoorden in tekst. Extra events genegeerd. Probeer het interval te verhogen.`,
    };
  }

  // Fewer onsets than chords — pad remaining with estimated intervals
  const avgInterval =
    onsets.length >= 2
      ? (onsets[onsets.length - 1] - onsets[0]) / (onsets.length - 1)
      : 2;

  const padded = [...onsets];
  const lastTime = onsets.length > 0 ? onsets[onsets.length - 1] : 0;
  for (let i = onsets.length; i < chordCount; i++) {
    padded.push(Math.round((lastTime + (i - onsets.length + 1) * avgInterval) * 1000) / 1000);
  }

  return {
    chordTimings: padded,
    warning: `${onsets.length} wisselingen gevonden, ${chordCount} akkoorden in tekst. ${chordCount - onsets.length} akkoorden krijgen een geschat interval. Probeer het interval te verlagen.`,
  };
}

/**
 * Auto-select the best MIDI track for chord changes.
 * Prefers the track whose auto-found onset count is closest to chordCount.
 */
export function autoSelectTrack(tracks, chordCount) {
  if (tracks.length === 0) return 0;

  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < tracks.length; i++) {
    const { count } = autoFindInterval(tracks[i].rawOnsets, chordCount);
    const diff = Math.abs(count - chordCount);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}
