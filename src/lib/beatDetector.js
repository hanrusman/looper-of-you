/**
 * Browser-based beat detector using Web Audio API.
 * Port of Swift energy-onset detection using OfflineAudioContext.
 *
 * Input: ArrayBuffer of MP3/WAV/OGG file
 * Output: { beats: number[], estimatedBPM: number|null, duration: number }
 */

/**
 * Detect beats in an audio file buffer.
 * @param {ArrayBuffer} arrayBuffer - Raw audio file data
 * @returns {Promise<{ beats: number[], estimatedBPM: number|null, duration: number }>}
 */
export async function detectBeats(arrayBuffer) {
  // Decode audio to raw PCM samples
  const audioCtx = new OfflineAudioContext(1, 1, 44100); // temporary context for decoding
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Downmix to mono
  const mono = downmixToMono(audioBuffer);
  if (mono.length === 0) {
    return { beats: [], estimatedBPM: null, duration };
  }

  // Compute energy in overlapping windows
  const windowSize = Math.round(sampleRate * 0.02);  // 20ms windows
  const hopSize = Math.round(sampleRate * 0.01);     // 10ms hop
  const energies = computeEnergy(mono, windowSize, hopSize);

  if (energies.length <= 10) {
    return { beats: [], estimatedBPM: null, duration };
  }

  // Compute onset detection function (half-wave rectified energy difference)
  const onsetFunction = computeOnsetFunction(energies);

  // Pick peaks with adaptive threshold
  const peakIndices = pickPeaks(onsetFunction, {
    medianWindowSize: 15,
    thresholdMultiplier: 1.4,
    minPeakDistance: Math.round(0.15 * sampleRate / hopSize), // min 150ms between beats
  });

  // Convert indices to timestamps
  const beats = peakIndices.map((i) => i * hopSize / sampleRate);

  // Estimate BPM
  const estimatedBPM = estimateBPM(beats);

  return { beats, estimatedBPM, duration };
}

/**
 * Given detected beats and a chord count, create chord timings.
 * Groups beats into chord-sized intervals.
 *
 * @param {number[]} beats - Beat timestamps in seconds
 * @param {number} chordCount - Number of chords to map to
 * @param {number} beatsPerChord - How many beats per chord change
 * @returns {{ chordTimings: number[], warning: string|null }}
 */
export function mapBeatsToChords(beats, chordCount, beatsPerChord = 4) {
  if (beats.length === 0 || chordCount === 0) {
    return { chordTimings: [], warning: 'Geen beats of akkoorden gevonden' };
  }

  // Group every N beats as one chord change
  const chordTimings = [];
  for (let i = 0; i < beats.length && chordTimings.length < chordCount; i += beatsPerChord) {
    chordTimings.push(beats[i]);
  }

  let warning = null;

  // Pad if too few
  if (chordTimings.length < chordCount) {
    const lastTime = chordTimings[chordTimings.length - 1] || 0;
    const avgInterval = chordTimings.length > 1
      ? (lastTime - chordTimings[0]) / (chordTimings.length - 1)
      : 2.0;
    while (chordTimings.length < chordCount) {
      chordTimings.push(lastTime + avgInterval * (chordTimings.length - chordTimings.indexOf(lastTime)));
    }
    warning = `Minder beats dan akkoorden — laatste ${chordCount - chordTimings.length} zijn geschat`;
  }

  return { chordTimings, warning };
}

// --- DSP helper functions ---

function downmixToMono(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (channelCount === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Average all channels
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channelCount; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i];
    }
  }
  const divisor = channelCount;
  for (let i = 0; i < length; i++) {
    mono[i] /= divisor;
  }
  return mono;
}

function computeEnergy(samples, windowSize, hopSize) {
  const energies = [];
  let i = 0;
  while (i + windowSize <= samples.length) {
    let energy = 0;
    for (let j = i; j < i + windowSize; j++) {
      energy += samples[j] * samples[j];
    }
    energies.push(energy / windowSize);
    i += hopSize;
  }
  return energies;
}

function computeOnsetFunction(energies) {
  const onset = new Float32Array(energies.length);
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    onset[i] = diff > 0 ? diff : 0; // half-wave rectification
  }
  return onset;
}

function pickPeaks(onsetFunction, { medianWindowSize, thresholdMultiplier, minPeakDistance }) {
  const count = onsetFunction.length;
  const peaks = [];
  const halfWindow = Math.floor(medianWindowSize / 2);

  for (let i = halfWindow; i < count - halfWindow; i++) {
    // Compute local median as adaptive threshold
    const windowStart = Math.max(0, i - halfWindow);
    const windowEnd = Math.min(count, i + halfWindow + 1);
    const window = [];
    for (let j = windowStart; j < windowEnd; j++) {
      window.push(onsetFunction[j]);
    }
    window.sort((a, b) => a - b);
    const median = window[Math.floor(window.length / 2)];
    const threshold = median * thresholdMultiplier + 1e-8;

    // Check if this is a local peak above threshold
    if (
      onsetFunction[i] > threshold &&
      onsetFunction[i] >= onsetFunction[Math.max(0, i - 1)] &&
      onsetFunction[i] >= onsetFunction[Math.min(count - 1, i + 1)]
    ) {
      // Enforce minimum distance
      if (peaks.length > 0 && (i - peaks[peaks.length - 1]) < minPeakDistance) {
        // Keep the stronger peak
        if (onsetFunction[i] > onsetFunction[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i;
        }
      } else {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

function estimateBPM(beats) {
  if (beats.length < 4) return null;

  const intervals = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }

  // Filter outliers: keep 0.2s - 2.0s (30-300 BPM range)
  const filtered = intervals.filter((t) => t >= 0.2 && t <= 2.0);
  if (filtered.length === 0) return null;

  const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  let bpm = Math.round(60 / avgInterval);

  // Normalize to reasonable range (halve if too fast)
  if (bpm > 180) bpm = Math.round(bpm / 2);

  return bpm;
}
