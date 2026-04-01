import { useEffect, useRef, useCallback } from 'react';
import useSongStore from '../store/songStore';
import usePlayerStore from '../store/playerStore';
import CurrentChord from '../components/player/CurrentChord';
import LyricsDisplay from '../components/player/LyricsDisplay';
import PlayerControls from '../components/player/PlayerControls';
import YouTubePlayer from '../components/player/YouTubePlayer';
import SpotifyPlayer from '../components/player/SpotifyPlayer';
import SongStructureMap from '../components/player/SongStructureMap';

export default function SongPlayerScreen({ songId, onBack }) {
  const song = useSongStore((s) => s.getSong(songId));
  const { loadSong, stop, currentChordIndex, setYtPlayerRef, setSpotifyPlayerRef, onYouTubeStateChange, jumpToChordIndex } = usePlayerStore();
  const ytPlayerRef = useRef(null);
  const spotifyPlayerRef = useRef(null);

  const audioSource = song?.audioSource || (song?.youtubeId ? 'youtube' : 'none');

  useEffect(() => {
    if (song) {
      setYtPlayerRef(ytPlayerRef);
      setSpotifyPlayerRef(spotifyPlayerRef);
      loadSong(song);
    }
    return () => {
      stop();
      setYtPlayerRef(null);
      setSpotifyPlayerRef(null);
    };
  }, [songId]);

  const handleAudioStateChange = useCallback((state) => {
    onYouTubeStateChange(state); // Same handler works for both — uses YT state codes
  }, [onYouTubeStateChange]);

  if (!song) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <p className="text-gray-400">Liedje niet gevonden</p>
      </div>
    );
  }

  const currentChordEntry = song.chordSequence?.[currentChordIndex];
  const currentChordName = currentChordEntry?.chord || null;

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/60 backdrop-blur-sm border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-800 truncate">{song.title}</h1>
            {song.capo > 0 && (
              <span className="shrink-0 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-300">
                Capo {song.capo}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{song.artist}</p>
        </div>
      </div>

      {/* Song Structure Map */}
      <SongStructureMap
        sections={song.sections}
        chordSequence={song.chordSequence}
        currentChordIndex={currentChordIndex}
        onJumpToSection={(sectionIndex) => {
          const firstChord = song.chordSequence.find((c) => c.sectionIndex === sectionIndex);
          if (firstChord) jumpToChordIndex(firstChord.globalIndex);
        }}
      />

      {/* Audio Player */}
      {audioSource === 'youtube' && (
        <YouTubePlayer
          ref={ytPlayerRef}
          youtubeId={song.youtubeId}
          onStateChange={handleAudioStateChange}
        />
      )}
      {audioSource === 'spotify' && (
        <SpotifyPlayer
          ref={spotifyPlayerRef}
          spotifyUri={song.spotifyUri}
          onStateChange={handleAudioStateChange}
        />
      )}

      {/* Main content: chord diagram + lyrics */}
      <div className="flex flex-col md:landscape:flex-row flex-1 min-h-0">
        {/* Chord diagram area */}
        <div
          className="h-[35vh] md:landscape:h-full md:landscape:w-[35%] flex items-center justify-center bg-white/40 shrink-0"
        >
          <CurrentChord chordName={currentChordName} />
        </div>

        {/* Lyrics area */}
        <LyricsDisplay
          sections={song.sections}
          chordSequence={song.chordSequence}
          currentChordIndex={currentChordIndex}
        />
      </div>

      {/* Controls */}
      <div className="shrink-0">
        <PlayerControls />
      </div>
    </div>
  );
}
