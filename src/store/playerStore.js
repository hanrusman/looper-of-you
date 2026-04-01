import { create } from 'zustand';
import { parseStrumPattern } from '../lib/strumUtils';

let intervalId = null;
let syncPollId = null;
let rafId = null; // for variable-timing mode
let playStartTime = null; // performance.now() when play started
let playStartChordTime = 0; // chordTimings offset when play started

// Compensate for YouTube IFrame API getCurrentTime() lag.
// The API returns a cached value that trails actual audio playback
// by ~200-500ms due to cross-iframe postMessage communication.
const SYNC_LOOKAHEAD_S = 1.0;

const usePlayerStore = create((set, get) => ({
  isPlaying: false,
  currentSongId: null,
  currentChordIndex: 0,
  currentBeat: 0,
  bpm: 80,
  beatsPerChord: 4,
  totalChords: 0,

  // Sync mode fields
  syncMode: false,
  youtubeStartTime: 0,
  ytPlayerRef: null, // set by SongPlayerScreen

  // Sync fine-tune offset (seconds, adjustable by user)
  syncOffset: 0,

  // Strum pattern fields
  strumPattern: null, // parsed array: ['D','-','D','U',...] or null
  strumSubdivision: 0, // current position in pattern (0 to pattern.length-1)

  // Variable timing (from MIDI)
  chordTimings: null, // array of onset times in seconds, or null
  midiTempo: null, // original MIDI tempo for tempo scaling

  setYtPlayerRef: (ref) => set({ ytPlayerRef: ref }),

  loadSong: (song) => {
    // Clean up any running timers
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    playStartTime = null;

    const hasSyncVideo = !!(song.youtubeId);
    const parsed = parseStrumPattern(song.strumPattern);
    const chordCount = song.chordSequence?.length || 0;
    const hasTimings = song.chordTimings && song.chordTimings.length === chordCount;

    set({
      isPlaying: false,
      currentSongId: song.id,
      currentChordIndex: 0,
      currentBeat: 0,
      bpm: song.bpm || 80,
      beatsPerChord: song.beatsPerChord || 4,
      totalChords: chordCount,
      syncMode: hasSyncVideo,
      youtubeStartTime: song.youtubeStartTime || 0,
      strumPattern: parsed,
      strumSubdivision: 0,
      chordTimings: hasTimings ? song.chordTimings : null,
      midiTempo: hasTimings ? (song.midiTempo || song.bpm || 80) : null,
    });
  },

  play: () => {
    const state = get();
    if (state.isPlaying || state.totalChords === 0) return;

    set({ isPlaying: true });

    if (state.syncMode) {
      // SYNC MODE: control YouTube + poll position
      const ytRef = state.ytPlayerRef;
      if (ytRef?.current?.isReady()) {
        ytRef.current.play();
      }
      _startSyncPoll(get, set);
    } else if (state.chordTimings) {
      // VARIABLE TIMING MODE: use MIDI chord timings with rAF
      _startVariableTimingMode(get, set);
    } else {
      // TIMER MODE: BPM-based interval
      _startTimerMode(get, set);
    }
  },

  pause: () => {
    const state = get();

    if (state.syncMode) {
      const ytRef = state.ytPlayerRef;
      if (ytRef?.current?.isReady()) {
        ytRef.current.pause();
      }
      if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }
    } else {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    set({ isPlaying: false });
  },

  stop: () => {
    const state = get();

    if (state.syncMode) {
      const ytRef = state.ytPlayerRef;
      if (ytRef?.current?.isReady()) {
        ytRef.current.stop();
      }
      if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }
    } else {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    playStartTime = null;

    set({ isPlaying: false, currentChordIndex: 0, currentBeat: 0, strumSubdivision: 0 });
  },

  // Called when YouTube state changes (play/pause from YouTube UI directly)
  onYouTubeStateChange: (ytState) => {
    const state = get();
    if (!state.syncMode) return;

    // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0
    if (ytState === 1 && !state.isPlaying) {
      // YouTube started playing from its own UI
      set({ isPlaying: true });
      _startSyncPoll(get, set);
    } else if (ytState === 2 && state.isPlaying) {
      // YouTube paused from its own UI
      if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }
      set({ isPlaying: false });
    } else if (ytState === 0) {
      // Video ended
      if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }
      set({ isPlaying: false, currentChordIndex: 0, currentBeat: 0, strumSubdivision: 0 });
    }
  },

  jumpToChordIndex: (chordIndex) => {
    const state = get();
    const clamped = Math.max(0, Math.min(chordIndex, state.totalChords - 1));

    if (state.syncMode) {
      // Calculate the time position for this chord index and seek YouTube
      let targetTime;
      if (state.chordTimings) {
        targetTime = state.youtubeStartTime + state.chordTimings[clamped] - SYNC_LOOKAHEAD_S - state.syncOffset;
      } else {
        const secondsPerBeat = 60 / state.bpm;
        const secondsPerChord = state.beatsPerChord * secondsPerBeat;
        targetTime = state.youtubeStartTime + (clamped * secondsPerChord) - SYNC_LOOKAHEAD_S - state.syncOffset;
      }
      const ytRef = state.ytPlayerRef;
      if (ytRef?.current?.isReady()) {
        ytRef.current.seekTo(targetTime);
      }
    } else if (state.chordTimings && state.isPlaying) {
      // Reset the rAF timer to start from this chord's time
      const tempoScale = state.midiTempo ? state.bpm / state.midiTempo : 1;
      playStartTime = performance.now();
      playStartChordTime = state.chordTimings[clamped] * tempoScale;
    }

    set({ currentChordIndex: clamped, currentBeat: 0, strumSubdivision: 0 });
  },

  adjustSyncOffset: (delta) => {
    set((state) => ({ syncOffset: Math.round((state.syncOffset + delta) * 4) / 4 }));
  },

  adjustTempo: (newBpm) => {
    const state = get();
    const clamped = Math.max(40, Math.min(200, newBpm));
    set({ bpm: clamped });

    if (state.isPlaying && !state.chordTimings) {
      // Only restart interval in fixed-timing mode
      if (intervalId) clearInterval(intervalId);
      _startTimerMode(get, set, clamped);
    }
    // In variable timing mode, tempo change takes effect automatically
    // through the tempoScale calculation in the rAF loop
  },
}));

// --- Private helper functions ---

/**
 * Find the chord index at a given time using chord timings.
 * Uses tempo scaling: effectiveTime = realTime * (bpm / midiTempo)
 */
function _findChordAtTime(chordTimings, timeSeconds, totalChords) {
  for (let i = chordTimings.length - 1; i >= 0; i--) {
    if (chordTimings[i] <= timeSeconds) return Math.min(i, totalChords - 1);
  }
  return 0;
}

/**
 * Variable timing mode: uses MIDI chord timings with requestAnimationFrame.
 * Tempo adjustments work as a scale factor (userBpm / midiTempo).
 */
function _startVariableTimingMode(get, set) {
  if (rafId) cancelAnimationFrame(rafId);

  const state = get();
  const tempoScale = state.midiTempo ? state.bpm / state.midiTempo : 1;

  // Start from current chord position
  playStartTime = performance.now();
  playStartChordTime = state.chordTimings[state.currentChordIndex] || 0;

  function tick() {
    const s = get();
    if (!s.isPlaying || !s.chordTimings) return;

    const tempoScale = s.midiTempo ? s.bpm / s.midiTempo : 1;
    const elapsedMs = performance.now() - playStartTime;
    const elapsedScaled = playStartChordTime + (elapsedMs / 1000) * tempoScale;

    const newIndex = _findChordAtTime(s.chordTimings, elapsedScaled, s.totalChords);

    // Derive beat within current chord
    const chordStart = s.chordTimings[newIndex] || 0;
    const chordEnd = newIndex < s.chordTimings.length - 1
      ? s.chordTimings[newIndex + 1]
      : chordStart + (s.beatsPerChord * 60 / s.bpm); // fallback for last chord
    const chordDuration = chordEnd - chordStart;
    const chordElapsed = elapsedScaled - chordStart;
    const beatFraction = chordDuration > 0 ? chordElapsed / chordDuration : 0;
    const newBeat = Math.min(
      Math.floor(beatFraction * s.beatsPerChord),
      s.beatsPerChord - 1
    );

    // Check if song ended
    if (newIndex >= s.totalChords - 1 && chordElapsed > chordDuration) {
      get().stop();
      return;
    }

    if (newIndex !== s.currentChordIndex || newBeat !== s.currentBeat) {
      set({ currentChordIndex: newIndex, currentBeat: Math.max(0, newBeat) });
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

function _startTimerMode(get, set, overrideBpm) {
  const state = get();
  const bpm = overrideBpm || state.bpm;
  const pattern = state.strumPattern;

  if (pattern && pattern.length > 0) {
    // STRUM PATTERN MODE: interval at subdivision rate
    const secondsPerChord = state.beatsPerChord * (60 / bpm);
    const msPerSubdivision = (secondsPerChord * 1000) / pattern.length;

    intervalId = setInterval(() => {
      const { strumSubdivision, strumPattern, beatsPerChord, currentChordIndex, totalChords } = get();
      const patLen = strumPattern.length;
      const nextSub = strumSubdivision + 1;

      if (nextSub >= patLen) {
        // Pattern complete → next chord
        const nextChord = currentChordIndex + 1;
        if (nextChord >= totalChords) {
          get().stop();
          return;
        }
        set({
          strumSubdivision: 0,
          currentChordIndex: nextChord,
          currentBeat: 0,
        });
      } else {
        // Advance subdivision and derive beat
        const newBeat = Math.min(
          Math.floor((nextSub / patLen) * beatsPerChord),
          beatsPerChord - 1
        );
        set({ strumSubdivision: nextSub, currentBeat: newBeat });
      }
    }, msPerSubdivision);
  } else {
    // NO PATTERN: standard beat-rate interval
    const ms = (60 / bpm) * 1000;

    intervalId = setInterval(() => {
      const { currentBeat, beatsPerChord, currentChordIndex, totalChords } = get();
      const nextBeat = currentBeat + 1;

      if (nextBeat >= beatsPerChord) {
        const nextChord = currentChordIndex + 1;
        if (nextChord >= totalChords) {
          get().stop();
          return;
        }
        set({ currentBeat: 0, currentChordIndex: nextChord });
      } else {
        set({ currentBeat: nextBeat });
      }
    }, ms);
  }
}

function _startSyncPoll(get, set) {
  if (syncPollId) cancelAnimationFrame(syncPollId);

  function poll() {
    const state = get();

    if (!state.isPlaying || !state.syncMode) return;

    const ytRef = state.ytPlayerRef;
    if (!ytRef?.current?.isReady()) {
      syncPollId = requestAnimationFrame(poll);
      return;
    }

    const videoTime = ytRef.current.getCurrentTime();
    const elapsed = videoTime - state.youtubeStartTime + SYNC_LOOKAHEAD_S + state.syncOffset;

    if (elapsed < 0) {
      // Still in intro before first chord
      set({ currentChordIndex: 0, currentBeat: 0, strumSubdivision: 0 });
    } else if (state.chordTimings) {
      // VARIABLE TIMING: use chord timings for sync
      const tempoScale = state.midiTempo ? state.bpm / state.midiTempo : 1;
      const scaledElapsed = elapsed * tempoScale;
      const newChordIndex = _findChordAtTime(state.chordTimings, scaledElapsed, state.totalChords);
      const chordStart = state.chordTimings[newChordIndex] || 0;
      const chordEnd = newChordIndex < state.chordTimings.length - 1
        ? state.chordTimings[newChordIndex + 1]
        : chordStart + (state.beatsPerChord * 60 / state.bpm);
      const chordDuration = chordEnd - chordStart;
      const chordElapsed = scaledElapsed - chordStart;
      const beatFraction = chordDuration > 0 ? chordElapsed / chordDuration : 0;
      const newBeat = Math.min(Math.floor(beatFraction * state.beatsPerChord), state.beatsPerChord - 1);

      if (newChordIndex !== state.currentChordIndex || newBeat !== state.currentBeat) {
        set({ currentChordIndex: newChordIndex, currentBeat: Math.max(0, newBeat), strumSubdivision: 0 });
      }
    } else {
      // FIXED TIMING: original BPM-based calculation
      const secondsPerBeat = 60 / state.bpm;
      const secondsPerChord = state.beatsPerChord * secondsPerBeat;

      const newChordIndex = Math.min(
        Math.floor(elapsed / secondsPerChord),
        state.totalChords - 1
      );
      const chordElapsed = elapsed - (newChordIndex * secondsPerChord);
      const newBeat = Math.min(
        Math.floor(chordElapsed / secondsPerBeat),
        state.beatsPerChord - 1
      );

      // Calculate strum subdivision if pattern exists
      let newSub = 0;
      if (state.strumPattern && state.strumPattern.length > 0) {
        const patLen = state.strumPattern.length;
        newSub = Math.min(
          Math.floor((chordElapsed / secondsPerChord) * patLen),
          patLen - 1
        );
      }

      if (newChordIndex !== state.currentChordIndex || newBeat !== state.currentBeat || newSub !== state.strumSubdivision) {
        set({ currentChordIndex: newChordIndex, currentBeat: newBeat, strumSubdivision: newSub });
      }
    }

    syncPollId = requestAnimationFrame(poll);
  }

  syncPollId = requestAnimationFrame(poll);
}

export default usePlayerStore;
