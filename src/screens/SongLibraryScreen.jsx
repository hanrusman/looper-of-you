import { useEffect } from 'react';
import useSongStore from '../store/songStore';
import Button from '../components/ui/Button';

const CARD_COLORS = [
  'bg-indigo-100 border-indigo-300',
  'bg-amber-100 border-amber-300',
  'bg-emerald-100 border-emerald-300',
  'bg-rose-100 border-rose-300',
  'bg-sky-100 border-sky-300',
  'bg-purple-100 border-purple-300',
];

export default function SongLibraryScreen({ onPlay, onEdit, onAdd, onImport, onSpotifySettings }) {
  const { songs, initializeSongs } = useSongStore();

  useEffect(() => {
    initializeSongs();
  }, [initializeSongs]);

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-white/60 backdrop-blur-sm border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800">
            Mijn Liedjes
          </h1>
          <p className="text-sm text-gray-500">
            {songs.length} {songs.length === 1 ? 'liedje' : 'liedjes'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSpotifySettings}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
            title="Spotify Instellingen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </button>
          <Button onClick={onImport} variant="primary" className="text-base px-3 py-2">
            <span className="flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Importeer
            </span>
          </Button>
          <Button onClick={onAdd} variant="accent">
            + Nieuw
          </Button>
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-6xl mb-4">🎸</p>
            <p className="text-lg font-semibold">Nog geen liedjes</p>
            <p className="text-sm">Voeg je eerste liedje toe!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {songs.map((song, i) => (
              <div
                key={song.id}
                className={`rounded-2xl border-2 p-4 ${CARD_COLORS[i % CARD_COLORS.length]} transition-all active:scale-[0.98]`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onPlay(song.id)}
                    className="flex-1 text-left"
                  >
                    <h2 className="text-lg font-bold text-gray-800">
                      {song.title}
                    </h2>
                    <p className="text-sm text-gray-600">{song.artist}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span>{song.bpm} BPM</span>
                      <span>{song.chordSequence?.length || 0} akkoorden</span>
                      {song.capo > 0 && (
                        <span className="bg-amber-200/60 text-amber-700 font-bold px-1.5 py-0.5 rounded-md">
                          Capo {song.capo}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex gap-2 ml-3">
                    <button
                      onClick={() => onEdit(song.id)}
                      className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                      title="Bewerken"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onPlay(song.id)}
                      className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                      title="Afspelen"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
