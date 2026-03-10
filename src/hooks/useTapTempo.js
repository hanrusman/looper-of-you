import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for tap-tempo BPM detection.
 *
 * Tap rhythmically → BPM is calculated from average interval between taps.
 * Auto-resets after a pause (default 3 seconds).
 *
 * @param {Object} options
 * @param {function} options.onBpmDetected - Called with detected BPM (integer) after each tap (from tap 2+)
 * @param {number} options.resetAfterMs - Reset if pause exceeds this (default 3000ms)
 * @returns {{ tap: function, tapCount: number, currentBpm: number|null, reset: function }}
 */
export default function useTapTempo({ onBpmDetected, resetAfterMs = 3000 } = {}) {
  const [tapCount, setTapCount] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(null);
  const tapsRef = useRef([]);
  const resetTimerRef = useRef(null);

  const reset = useCallback(() => {
    tapsRef.current = [];
    setTapCount(0);
    setCurrentBpm(null);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const tap = useCallback(() => {
    const now = Date.now();

    // If too long since last tap, reset and start fresh
    const taps = tapsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > resetAfterMs) {
      taps.length = 0;
    }

    taps.push(now);
    setTapCount(taps.length);

    // Calculate BPM from average interval (need at least 2 taps)
    if (taps.length >= 2) {
      // Calculate intervals between consecutive taps
      let totalInterval = 0;
      for (let i = 1; i < taps.length; i++) {
        totalInterval += taps[i] - taps[i - 1];
      }
      const avgInterval = totalInterval / (taps.length - 1);
      const bpm = Math.round(60000 / avgInterval);

      // Clamp to reasonable range
      const clampedBpm = Math.max(30, Math.min(240, bpm));
      setCurrentBpm(clampedBpm);

      if (onBpmDetected) {
        onBpmDetected(clampedBpm);
      }
    }

    // Set auto-reset timer
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      reset();
    }, resetAfterMs);
  }, [onBpmDetected, resetAfterMs, reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return { tap, tapCount, currentBpm, reset };
}
