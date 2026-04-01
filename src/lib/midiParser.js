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

      // Collect unique onset times (collapse simultaneous notes within 50ms)
      const onsets = [];
      const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);

      for (const note of sortedNotes) {
        const t = note.time;
        if (onsets.length === 0 || t - onsets[onsets.length - 1] > 0.05) {
          onsets.push(Math.round(t * 1000) / 1000); // round to ms precision
        }
      }

      return {
        index,
        name: track.name || `Track ${index + 1}`,
        noteCount: track.notes.length,
        onsetCount: onsets.length,
        onsets,
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
 * Map MIDI onsets from a track to a chordTimings array.
 * Returns { chordTimings, warning } where warning is null or a message string.
 *
 * @param {number[]} onsets - Onset times in seconds from the MIDI track
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
      warning: `MIDI heeft ${onsets.length} akkoordwisselingen, tekst heeft ${chordCount} akkoorden. Extra MIDI-events worden genegeerd.`,
    };
  }

  // Fewer onsets than chords — pad remaining with estimated intervals
  const avgInterval =
    onsets.length >= 2
      ? (onsets[onsets.length - 1] - onsets[0]) / (onsets.length - 1)
      : 2; // default 2 seconds per chord

  const padded = [...onsets];
  const lastTime = onsets.length > 0 ? onsets[onsets.length - 1] : 0;
  for (let i = onsets.length; i < chordCount; i++) {
    padded.push(Math.round((lastTime + (i - onsets.length + 1) * avgInterval) * 1000) / 1000);
  }

  return {
    chordTimings: padded,
    warning: `MIDI heeft ${onsets.length} akkoordwisselingen, tekst heeft ${chordCount} akkoorden. ${chordCount - onsets.length} extra akkoorden krijgen een geschat interval.`,
  };
}

/**
 * Auto-select the best MIDI track for chord changes.
 * Prefers the track whose onset count is closest to chordCount.
 */
export function autoSelectTrack(tracks, chordCount) {
  if (tracks.length === 0) return 0;

  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < tracks.length; i++) {
    const diff = Math.abs(tracks[i].onsetCount - chordCount);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return bestIndex;
}
