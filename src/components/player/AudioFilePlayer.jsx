import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

/**
 * HTML5 Audio player component for local audio files (MP3/WAV/OGG).
 * Exposes the same imperative API as YouTubePlayer:
 *   play(), pause(), stop(), seekTo(seconds), getCurrentTime(), isReady()
 *
 * Uses a blob URL from the stored audio file data.
 */
const AudioFilePlayer = forwardRef(function AudioFilePlayer({ audioUrl, onStateChange }, ref) {
  const audioRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (audioRef.current && ready) {
        audioRef.current.play().catch(() => {});
      }
    },
    pause: () => {
      if (audioRef.current && ready) {
        audioRef.current.pause();
      }
    },
    stop: () => {
      if (audioRef.current && ready) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    },
    seekTo: (seconds) => {
      if (audioRef.current && ready) {
        audioRef.current.currentTime = seconds;
      }
    },
    getCurrentTime: () => {
      if (audioRef.current && ready) {
        return audioRef.current.currentTime;
      }
      return 0;
    },
    getPlayerState: () => {
      if (playing) return 1; // PLAYING
      if (audioRef.current && audioRef.current.currentTime > 0) return 2; // PAUSED
      return -1;
    },
    isReady: () => ready,
  }));

  const handlePlay = useCallback(() => {
    setPlaying(true);
    onStateChange?.(1); // PLAYING
  }, [onStateChange]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    onStateChange?.(2); // PAUSED
  }, [onStateChange]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    onStateChange?.(0); // ENDED
  }, [onStateChange]);

  const handleCanPlay = useCallback(() => {
    setReady(true);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setError('Kan audiobestand niet afspelen');
    setReady(false);
  }, []);

  // Reset when URL changes
  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setError(null);
  }, [audioUrl]);

  if (!audioUrl) return null;

  return (
    <div className="shrink-0">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        style={{ display: 'none' }}
      />

      {/* Compact audio bar */}
      {error ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800">
          <AudioIcon />
          <p className="text-xs font-semibold text-red-400 truncate">{error}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800">
          <AudioIcon />
          <span className="text-xs font-semibold text-gray-300">Audio</span>

          <div className="ml-auto flex items-center gap-2">
            {playing && (
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5 items-end h-3">
                  <div className="w-0.5 bg-violet-500 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-violet-500 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-violet-500 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-violet-500 rounded-full animate-bounce" style={{ height: '80%', animationDelay: '450ms', animationDuration: '600ms' }} />
                </div>
              </div>
            )}
            {ready && !playing && (
              <div className="w-2 h-2 rounded-full bg-green-500" title="Klaar" />
            )}
            {!ready && !error && (
              <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" title="Laden..." />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function AudioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export default AudioFilePlayer;
