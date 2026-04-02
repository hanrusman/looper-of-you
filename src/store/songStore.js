import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sampleSongs } from '../data/sampleSongs';
import { parseChordPro, extractChordSequence } from '../lib/chordProParser';

function processSong(song) {
  const sections = parseChordPro(song.rawText);
  const chordSequence = extractChordSequence(sections);
  return { ...song, sections, chordSequence };
}

const useSongStore = create(
  persist(
    (set, get) => ({
      songs: [],
      initialized: false,

      initializeSongs: () => {
        const existing = get().songs;
        const sampleIds = new Set(sampleSongs.map((s) => s.id));

        // Remove old sample songs that no longer exist in the sample set
        const cleaned = existing.filter(
          (s) => !s.id.startsWith('sample-') || sampleIds.has(s.id)
        );

        const cleanedIds = new Set(cleaned.map((s) => s.id));
        const missing = sampleSongs.filter((s) => !cleanedIds.has(s.id));

        // Merge new fields from sample songs into existing sample songs
        const sampleMap = Object.fromEntries(sampleSongs.map((s) => [s.id, s]));
        const updated = cleaned.map((s) => {
          if (sampleIds.has(s.id)) {
            const sample = sampleMap[s.id];
            const merged = { ...sample, ...s };
            if (JSON.stringify(merged) !== JSON.stringify(s)) {
              return processSong(merged);
            }
          }
          return s;
        });

        const changed = missing.length > 0 || !get().initialized || updated !== cleaned || cleaned.length < existing.length;
        if (changed) {
          const newSongs = missing.map(processSong);
          set({
            songs: [...updated, ...newSongs],
            initialized: true,
          });
        }
      },

      getSong: (id) => get().songs.find((s) => s.id === id),

      addSong: (song) => {
        const newSong = processSong({
          ...song,
          id: 'song-' + Date.now(),
          createdAt: Date.now(),
        });
        set((state) => ({ songs: [...state.songs, newSong] }));
        return newSong.id;
      },

      updateSong: (id, updates) => {
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === id ? processSong({ ...s, ...updates }) : s
          ),
        }));
      },

      deleteSong: (id) => {
        set((state) => ({
          songs: state.songs.filter((s) => s.id !== id),
        }));
      },
    }),
    {
      name: 'akkoordenboek-songs',
      version: 8,
      migrate: (persistedState, version) => {
        if (version < 5) {
          // Wipe all sample songs so they get re-added with correct data
          return {
            ...persistedState,
            songs: (persistedState.songs || []).filter(
              (s) => !s.id.startsWith('sample-')
            ),
            initialized: false,
          };
        }
        if (version < 6) {
          // Add MIDI timing fields to existing songs
          persistedState = {
            ...persistedState,
            songs: (persistedState.songs || []).map((s) => ({
              ...s,
              chordTimings: s.chordTimings || null,
              midiTempo: s.midiTempo || null,
              midiTimeSignature: s.midiTimeSignature || null,
              midiFileName: s.midiFileName || null,
            })),
          };
        }
        if (version < 7) {
          // Add Spotify fields to existing songs
          persistedState = {
            ...persistedState,
            songs: (persistedState.songs || []).map((s) => ({
              ...s,
              audioSource: s.youtubeId ? 'youtube' : 'none',
              spotifyUri: s.spotifyUri || null,
              spotifyStartTime: s.spotifyStartTime || 0,
            })),
          };
        }
        if (version < 8) {
          // Add audio file fields to existing songs
          return {
            ...persistedState,
            songs: (persistedState.songs || []).map((s) => ({
              ...s,
              audioFileName: s.audioFileName || null,
              audioFileStartTime: s.audioFileStartTime || 0,
            })),
          };
        }
        return persistedState;
      },
    }
  )
);

export default useSongStore;
