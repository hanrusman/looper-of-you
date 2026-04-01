import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import useSpotifyStore from '../../store/spotifyStore';
import * as spotifyAPI from '../../lib/spotifyAPI';

/**
 * Spotify Connect player component.
 * Exposes the same imperative API as YouTubePlayer:
 *   play(), pause(), stop(), seekTo(seconds), getCurrentTime(), isReady()
 *
 * Uses Spotify Connect (remote control) — works on iPad Safari.
 * Polls GET /me/player for position tracking.
 */
const SpotifyPlayer = forwardRef(function SpotifyPlayer({ spotifyUri, onStateChange }, ref) {
  const { getToken, isAuthenticated, activeDeviceName } = useSpotifyStore();
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // For interpolating position between polls
  const lastPollTime = useRef(0);
  const lastPollPositionMs = useRef(0);
  const isPlayingRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const trackStarted = useRef(false);

  // Check readiness when authenticated
  useEffect(() => {
    if (!spotifyUri || !isAuthenticated) {
      setReady(false);
      return;
    }

    let cancelled = false;

    async function checkReady() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        // Check if there's an active device
        const state = await spotifyAPI.getPlaybackState(token);
        if (cancelled) return;

        if (state?.deviceId) {
          setReady(true);
          setError(null);
        } else {
          // Try to find any device
          const devices = await spotifyAPI.getDevices(token);
          if (cancelled) return;
          if (devices.length > 0) {
            setReady(true);
            setError(null);
          } else {
            setError('Open Spotify op een apparaat om te verbinden');
            setReady(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Kan geen verbinding maken met Spotify');
          setReady(false);
        }
      }
    }

    checkReady();
    // Re-check every 10 seconds
    const id = setInterval(checkReady, 10000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [spotifyUri, isAuthenticated]);

  // Poll playback state
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    async function poll() {
      try {
        const token = await getToken();
        if (!token) return;

        const state = await spotifyAPI.getPlaybackState(token);
        if (!state) return;

        lastPollTime.current = performance.now();
        lastPollPositionMs.current = state.progressMs;
        setCurrentTimeMs(state.progressMs);

        const wasPlaying = isPlayingRef.current;
        isPlayingRef.current = state.isPlaying;
        setPlaying(state.isPlaying);

        // Notify parent of state changes
        if (state.isPlaying && !wasPlaying) {
          onStateChange?.(1); // PLAYING
        } else if (!state.isPlaying && wasPlaying) {
          onStateChange?.(2); // PAUSED
        }
      } catch {
        // Ignore polling errors
      }
    }

    poll(); // Immediate first poll
    pollIntervalRef.current = setInterval(poll, 800);
  }, [getToken, onStateChange]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Expose player methods
  useImperativeHandle(ref, () => ({
    play: async () => {
      try {
        const token = await getToken();
        if (!token) return;

        if (!trackStarted.current) {
          // First play — start the track
          await spotifyAPI.play(token, { trackUri: spotifyUri });
          trackStarted.current = true;
        } else {
          // Resume
          await spotifyAPI.play(token);
        }
        isPlayingRef.current = true;
        setPlaying(true);
        startPolling();
      } catch (err) {
        setError(err.message);
      }
    },

    pause: async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await spotifyAPI.pause(token);
        isPlayingRef.current = false;
        setPlaying(false);
        stopPolling();
      } catch (err) {
        setError(err.message);
      }
    },

    stop: async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await spotifyAPI.pause(token);
        await spotifyAPI.seekTo(token, 0);
        isPlayingRef.current = false;
        setPlaying(false);
        setCurrentTimeMs(0);
        lastPollPositionMs.current = 0;
        trackStarted.current = false;
        stopPolling();
      } catch {
        // Ignore stop errors
      }
    },

    seekTo: async (seconds) => {
      try {
        const token = await getToken();
        if (!token) return;
        const ms = Math.round(seconds * 1000);
        await spotifyAPI.seekTo(token, ms);
        lastPollTime.current = performance.now();
        lastPollPositionMs.current = ms;
        setCurrentTimeMs(ms);
      } catch (err) {
        setError(err.message);
      }
    },

    getCurrentTime: () => {
      // Interpolate between polls for smoother tracking
      if (isPlayingRef.current && lastPollTime.current > 0) {
        const elapsed = performance.now() - lastPollTime.current;
        return (lastPollPositionMs.current + elapsed) / 1000;
      }
      return currentTimeMs / 1000;
    },

    getPlayerState: () => {
      if (isPlayingRef.current) return 1; // PLAYING
      if (currentTimeMs > 0) return 2; // PAUSED
      return -1;
    },

    isReady: () => ready,
  }));

  if (!spotifyUri) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800">
        <SpotifyIcon />
        <p className="text-xs font-semibold text-gray-400">
          Log in bij Spotify via Instellingen
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800">
        <SpotifyIcon />
        <p className="text-xs font-semibold text-amber-400 truncate">{error}</p>
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800">
        <SpotifyIcon />
        <span className="text-xs font-semibold text-gray-300">
          Spotify{activeDeviceName ? ` · ${activeDeviceName}` : ''}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {playing && (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '600ms' }} />
                <div className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '600ms' }} />
                <div className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '600ms' }} />
                <div className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: '80%', animationDelay: '450ms', animationDuration: '600ms' }} />
              </div>
            </div>
          )}
          {ready && !playing && (
            <div className="w-2 h-2 rounded-full bg-green-500" title="Klaar" />
          )}
          {!ready && !error && (
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" title="Verbinden..." />
          )}
        </div>
      </div>
    </div>
  );
});

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954" className="shrink-0">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export default SpotifyPlayer;
