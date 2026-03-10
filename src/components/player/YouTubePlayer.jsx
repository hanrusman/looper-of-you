import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

// Load the YouTube IFrame API script once globally
let apiReady = false;
let apiReadyPromise = null;

function loadYouTubeAPI() {
  if (apiReady) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      apiReady = true;
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      resolve();
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });

  return apiReadyPromise;
}

function getYouTubeErrorMessage(errorCode) {
  switch (errorCode) {
    case 2: return 'Ongeldige video ID';
    case 5: return 'Deze video kan niet in een externe speler worden afgespeeld';
    case 100: return 'Video niet gevonden (verwijderd of privé)';
    case 101:
    case 150: return 'Deze video mag niet buiten YouTube worden afgespeeld';
    default: return 'Video kon niet geladen worden';
  }
}

const YouTubePlayer = forwardRef(function YouTubePlayer({ youtubeId, onStateChange }, ref) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Expose player methods to parent via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current && ready) {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      if (playerRef.current && ready) {
        playerRef.current.pauseVideo();
      }
    },
    stop: () => {
      if (playerRef.current && ready) {
        playerRef.current.seekTo(0);
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (seconds) => {
      if (playerRef.current && ready) {
        playerRef.current.seekTo(seconds, true);
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && ready) {
        return playerRef.current.getCurrentTime();
      }
      return 0;
    },
    getPlayerState: () => {
      if (playerRef.current && ready) {
        return playerRef.current.getPlayerState();
      }
      return -1;
    },
    isReady: () => ready,
  }));

  const handleStateChange = useCallback((event) => {
    // Track playing state for UI indicator
    setPlaying(event.data === 1); // YT.PlayerState.PLAYING = 1
    if (onStateChange) {
      onStateChange(event.data);
    }
  }, [onStateChange]);

  const handleError = useCallback((event) => {
    const msg = getYouTubeErrorMessage(event.data);
    setError(msg);
  }, []);

  useEffect(() => {
    if (!youtubeId) return;

    let destroyed = false;
    setError(null);
    setPlaying(false);

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '1',
        width: '1',
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!destroyed) setReady(true);
          },
          onStateChange: handleStateChange,
          onError: handleError,
        },
      });
    });

    return () => {
      destroyed = true;
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }
      playerRef.current = null;
      setReady(false);
      setError(null);
      setPlaying(false);
    };
  }, [youtubeId]);

  if (!youtubeId) return null;

  return (
    <div className="shrink-0">
      {/* Hidden YouTube iframe — still loads for audio playback + sync */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div ref={containerRef} />
      </div>

      {/* Compact audio bar */}
      {error ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-red-500 shrink-0">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          <p className="text-xs font-semibold text-red-400 truncate">{error}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800">
          {/* YouTube icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-red-500 shrink-0">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          <span className="text-xs font-semibold text-gray-300">YouTube audio</span>

          {/* Sync/playing indicator */}
          <div className="ml-auto flex items-center gap-2">
            {playing && (
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5 items-end h-3">
                  <div className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '600ms' }} />
                  <div className="w-0.5 bg-red-500 rounded-full animate-bounce" style={{ height: '80%', animationDelay: '450ms', animationDuration: '600ms' }} />
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

export default YouTubePlayer;
