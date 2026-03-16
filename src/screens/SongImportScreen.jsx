import { useState, useMemo } from 'react';
import Button from '../components/ui/Button';
import { convertToChordPro } from '../lib/chordConverter';
import { parseChordPro } from '../lib/chordProParser';

export default function SongImportScreen({ onImport, onBack }) {
  const [mode, setMode] = useState('search'); // 'search' or 'paste'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState(null);

  // Paste mode state
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  // Convert pasted text to ChordPro in real-time
  const converted = useMemo(() => {
    if (mode !== 'paste' || !pastedText.trim()) return null;
    try {
      return convertToChordPro(pastedText);
    } catch {
      return null;
    }
  }, [mode, pastedText]);

  // Parse the converted ChordPro for preview
  const previewSections = useMemo(() => {
    if (!converted?.chordProText) return [];
    try {
      return parseChordPro(converted.chordProText);
    } catch {
      return [];
    }
  }, [converted?.chordProText]);

  // Count total chords in preview
  const chordCount = useMemo(() => {
    let count = 0;
    for (const section of previewSections) {
      for (const line of section.lines) {
        for (const seg of line.segments) {
          if (seg.chord) count++;
        }
      }
    }
    return count;
  }, [previewSections]);

  const effectiveTitle = title || converted?.detectedTitle || '';
  const effectiveArtist = artist || converted?.detectedArtist || '';

  // Search handler
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/chords/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Zoeken mislukt');
      }
      const data = await res.json();
      if (data.length === 0) {
        setError('Geen resultaten gevonden. Probeer andere zoektermen.');
      }
      setResults(data);
    } catch (err) {
      setError(err.message || 'Er ging iets mis bij het zoeken');
    } finally {
      setSearching(false);
    }
  };

  // Import from search result
  const handleSearchImport = async (result) => {
    setImporting(result.url);
    setError(null);
    try {
      const res = await fetch(
        `/api/chords/fetch?url=${encodeURIComponent(result.url)}&source=${result.source}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ophalen mislukt');
      }
      const data = await res.json();

      // Convert the raw chord text to our ChordPro format
      const { chordProText, capo } = convertToChordPro(data.content);

      if (!chordProText) {
        throw new Error('Geen akkoorden gevonden in de content');
      }

      onImport({
        title: data.title || result.title,
        artist: data.artist || result.artist,
        rawText: chordProText,
        capo,
      });
    } catch (err) {
      setError(err.message || 'Er ging iets mis bij het importeren');
    } finally {
      setImporting(null);
    }
  };

  // Import from paste
  const handlePasteImport = () => {
    if (!converted?.chordProText) return;
    onImport({
      title: effectiveTitle,
      artist: effectiveArtist,
      rawText: converted.chordProText,
      capo: converted.capo,
    });
  };

  const canPasteImport = converted?.chordProText && chordCount > 0;

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/60 backdrop-blur-sm border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800">Importeer Liedje</h1>
        {mode === 'paste' ? (
          <Button
            onClick={handlePasteImport}
            variant="accent"
            className="text-base px-4 py-2"
            disabled={!canPasteImport}
          >
            Importeer
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex mx-4 mt-3 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
            mode === 'search'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500'
          }`}
        >
          Zoeken
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
            mode === 'paste'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500'
          }`}
        >
          Plakken
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {mode === 'search' ? (
          <>
            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Titel + artiest (bijv. Perfect Ed Sheeran)"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
              />
              <Button
                onClick={handleSearch}
                variant="primary"
                className="px-4 py-3"
                disabled={searching || !query.trim()}
              >
                {searching ? '...' : 'Zoek'}
              </Button>
            </div>

            {/* Source info */}
            <p className="text-xs text-gray-400">
              Zoekt op Cifra Club en GuitarTabs.cc (gratis bronnen)
            </p>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Loading */}
            {searching && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className="rounded-xl border-2 border-gray-200 bg-white p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 truncate">
                        {result.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {result.artist}
                      </p>
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {result.source === 'cifraclub' ? 'Cifra Club' : 'GuitarTabs'}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleSearchImport(result)}
                      variant="accent"
                      className="ml-3 px-3 py-2 text-sm shrink-0"
                      disabled={importing === result.url}
                    >
                      {importing === result.url ? '...' : 'Importeer'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Paste mode instructions */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-blue-700 mb-1">
                Handmatig plakken
              </p>
              <p className="text-xs text-blue-600">
                Kopieer akkoorden + tekst van een website en plak ze hieronder.
                Het formaat "akkoorden boven tekst" wordt automatisch herkend.
              </p>
            </div>

            {/* Title & Artist */}
            {pastedText.trim() && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">Titel</label>
                  <input
                    type="text"
                    value={effectiveTitle}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Naam van het liedje"
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">Artiest</label>
                  <input
                    type="text"
                    value={effectiveArtist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Artiest"
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Paste area */}
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">
                Plak hier de akkoorden + tekst
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
                placeholder={`[Verse 1]\n   G                 Em\nI found a love for me\n              C\nDarling just dive right in\n\n[Chorus]\n       Em          C\nBaby I'm dancing in the dark`}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-mono text-xs focus:border-primary focus:outline-none transition-colors resize-none"
                spellCheck={false}
              />
            </div>

            {/* Status bar */}
            {converted?.chordProText && (
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg">
                  {chordCount} akkoorden
                </span>
                <span className="bg-sky-100 text-sky-700 font-bold px-2 py-1 rounded-lg">
                  {previewSections.length} secties
                </span>
                {converted.capo > 0 && (
                  <span className="bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-lg">
                    Capo {converted.capo}
                  </span>
                )}
              </div>
            )}

            {/* Preview */}
            {previewSections.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-600 mb-2">Preview</h3>
                <div className="bg-white rounded-xl border-2 border-gray-200 px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
                  {previewSections.map((section, si) => (
                    <div key={si}>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                        {section.label}
                      </p>
                      {section.lines.map((line, li) => (
                        <div key={li} className="mb-1.5 flex flex-wrap gap-x-0.5">
                          {line.segments.map((seg, segi) => (
                            <span key={segi} className="inline-flex flex-col">
                              {seg.chord && (
                                <span className="text-[10px] font-bold text-primary bg-primary-light/30 px-1 rounded mb-0.5">
                                  {seg.chord}
                                </span>
                              )}
                              <span className="text-xs text-gray-700">{seg.lyrics || '\u00A0'}</span>
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No chords warning */}
            {pastedText.trim() && !canPasteImport && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 text-sm">
                <p className="font-bold text-amber-700">Geen akkoorden gevonden</p>
                <p className="text-amber-600 text-xs">
                  Zorg dat je tekst akkoorden bevat in het formaat "chords boven tekst" of ChordPro ([Am]tekst).
                </p>
              </div>
            )}
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
