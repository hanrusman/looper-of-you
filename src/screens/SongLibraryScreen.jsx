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

export default function SongLibraryScreen({ onPlay, onEdit, onAdd }) {
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
        <Button onClick={onAdd} variant="accent">
          + Nieuw
        </Button>
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
