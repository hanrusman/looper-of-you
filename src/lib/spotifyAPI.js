/**
 * Spotify Web API wrapper.
 * Uses Spotify Connect (remote control) — works on iPad Safari.
 */

const BASE = 'https://api.spotify.com/v1';

async function apiFetch(endpoint, accessToken, options = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 204) return null; // No content (common for PUT/POST)
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Spotify API fout (${res.status})`);
  }
  return res.json();
}

// --- Search ---

export async function searchTracks(query, accessToken, limit = 10) {
  const params = new URLSearchParams({ q: query, type: 'track', limit });
  const data = await apiFetch(`/search?${params}`, accessToken);
  return data.tracks.items.map((t) => ({
    id: t.id,
    uri: t.uri,
    name: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album.name,
    albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
    durationMs: t.duration_ms,
  }));
}

// --- Playback (Spotify Connect) ---

/**
 * Get current playback state.
 * Returns null if no active device.
 */
export async function getPlaybackState(accessToken) {
  try {
    const data = await apiFetch('/me/player', accessToken);
    if (!data) return null;
    return {
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms || 0,
      trackUri: data.item?.uri || null,
      trackName: data.item?.name || null,
      deviceName: data.device?.name || 'Onbekend apparaat',
      deviceId: data.device?.id || null,
    };
  } catch {
    return null;
  }
}

/**
 * Get available Spotify Connect devices.
 */
export async function getDevices(accessToken) {
  const data = await apiFetch('/me/player/devices', accessToken);
  return (data.devices || []).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    isActive: d.is_active,
  }));
}

/**
 * Start or resume playback on a device.
 * @param {string} accessToken
 * @param {object} options - { trackUri, positionMs, deviceId }
 */
export async function play(accessToken, { trackUri, positionMs, deviceId } = {}) {
  const params = deviceId ? `?device_id=${deviceId}` : '';
  const body = {};
  if (trackUri) body.uris = [trackUri];
  if (positionMs !== undefined) body.position_ms = Math.max(0, Math.round(positionMs));

  await apiFetch(`/me/player/play${params}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Pause playback.
 */
export async function pause(accessToken) {
  await apiFetch('/me/player/pause', accessToken, { method: 'PUT' });
}

/**
 * Seek to position in currently playing track.
 * @param {number} positionMs - Position in milliseconds
 */
export async function seekTo(accessToken, positionMs) {
  await apiFetch(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, accessToken, {
    method: 'PUT',
  });
}

/**
 * Transfer playback to a specific device.
 */
export async function transferPlayback(accessToken, deviceId, startPlaying = false) {
  await apiFetch('/me/player', accessToken, {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: startPlaying }),
  });
}

// --- User profile ---

export async function getUserProfile(accessToken) {
  const data = await apiFetch('/me', accessToken);
  return {
    id: data.id,
    displayName: data.display_name,
    product: data.product, // 'premium' or 'free'
    imageUrl: data.images?.[0]?.url || null,
  };
}
