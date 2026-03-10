import { create } from 'zustand';
import { parseStrumPattern } from '../lib/strumUtils';

let intervalId = null;
let syncPollId = null;

// Compensate for YouTube IFrame API getCurrentTime() lag.
// The API returns a cached value that trails actual audio playback
// by ~200-500ms due to cross-iframe postMessage communication.
const SYNC_LOOKAHEAD_S = 0.5;

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

  // Strum pattern fields
  strumPattern: null, // parsed array: ['D','-','D','U',...] or null
  strumSubdivision: 0, // current position in pattern (0 to pattern.length-1)

  setYtPlayerRef: (ref) => set({ ytPlayerRef: ref }),

  loadSong: (song) => {
    // Clean up any running timers
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (syncPollId) { cancelAnimationFrame(syncPollId); syncPollId = null; }

    const hasSyncVideo = !!(song.youtubeId);
    const parsed = parseStrumPattern(song.strumPattern);

    set({
      isPlaying: false,
      currentSongId: song.id,
      currentChordIndex: 0,
      currentBeat: 0,
      bpm: song.bpm || 80,
      beatsPerChord: song.beatsPerChord || 4,
      totalChords: song.chordSequence?.length || 0,
      syncMode: hasSyncVideo,
      youtubeStartTime: song.youtubeStartTime || 0,
      strumPattern: parsed,
      strumSubdivision: 0,
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
    }

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
      const secondsPerBeat = 60 / state.bpm;
      const secondsPerChord = state.beatsPerChord * secondsPerBeat;
      const targetTime = state.youtubeStartTime + (clamped * secondsPerChord) - SYNC_LOOKAHEAD_S;
      const ytRef = state.ytPlayerRef;
      if (ytRef?.current?.isReady()) {
        ytRef.current.seekTo(targetTime);
      }
    }

    set({ currentChordIndex: clamped, currentBeat: 0, strumSubdivision: 0 });
  },

  adjustTempo: (newBpm) => {
    const state = get();
    if (state.syncMode) return; // Can't adjust tempo in sync mode

    const clamped = Math.max(40, Math.min(200, newBpm));
    set({ bpm: clamped });

    if (state.isPlaying) {
      if (intervalId) clearInterval(intervalId);
      _startTimerMode(get, set, clamped);
    }
  },
}));

// --- Private helper functions ---

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
    const elapsed = videoTime - state.youtubeStartTime + SYNC_LOOKAHEAD_S;
    const secondsPerBeat = 60 / state.bpm;
    const secondsPerChord = state.beatsPerChord * secondsPerBeat;

    if (elapsed < 0) {
      // Still in intro before first chord
      set({ currentChordIndex: 0, currentBeat: 0, strumSubdivision: 0 });
    } else {
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
