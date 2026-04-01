import { useState, useCallback } from 'react';
import useSpotifyStore from '../../store/spotifyStore';
import { searchTracks } from '../../lib/spotifyAPI';

/**
 * Spotify track search widget for the song editor.
 * Lets the user search for a Spotify track and select it.
 *
 * @param {function} onSelect - Called with { uri, name, artist, albumArt } when a track is selected
 * @param {string} currentUri - Currently selected Spotify URI (for highlighting)
 */
export default function SpotifyTrackSearch({ onSelect, currentUri }) {
  const { isAuthenticated, getToken } = useSpotifyStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const token = await getToken();
      if (!token) {
        setError('Niet ingelogd bij Spotify');
        return;
      }
      const tracks = await searchTracks(query, token, 8);
      setResults(tracks);
    } catch (err) {
      setError(err.message || 'Zoeken mislukt');
    } finally {
      setLoading(false);
    }
  }, [query, getToken]);

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-center">
        <p className="text-sm text-gray-500">
          Log in bij Spotify via Instellingen om tracks te zoeken
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Zoek op Spotify..."
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold text-sm focus:border-green-500 focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? '...' : 'Zoek'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto rounded-xl border-2 border-gray-200 bg-white divide-y divide-gray-100">
          {results.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelect({
                uri: track.uri,
                name: track.name,
                artist: track.artist,
                albumArt: track.albumArt,
              })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                track.uri === currentUri
                  ? 'bg-green-50'
                  : 'hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {track.albumArt && (
                <img
                  src={track.albumArt}
                  alt=""
                  className="w-10 h-10 rounded-lg shrink-0 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${
                  track.uri === currentUri ? 'text-green-700' : 'text-gray-800'
                }`}>
                  {track.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{track.artist}</p>
              </div>
              {track.uri === currentUri && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && !error && (
        <p className="text-xs text-gray-400 text-center py-2">Geen resultaten gevonden</p>
      )}
    </div>
  );
}
