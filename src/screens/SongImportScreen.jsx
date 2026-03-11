import { useState, useMemo } from 'react';
import Button from '../components/ui/Button';
import { convertToChordPro } from '../lib/chordConverter';
import { parseChordPro } from '../lib/chordProParser';

export default function SongImportScreen({ onImport, onBack }) {
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  // Convert pasted text to ChordPro in real-time
  const converted = useMemo(() => {
    if (!pastedText.trim()) return null;
    try {
      return convertToChordPro(pastedText);
    } catch {
      return null;
    }
  }, [pastedText]);

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

  // Use detected title/artist from metadata, or user input
  const effectiveTitle = title || converted?.detectedTitle || '';
  const effectiveArtist = artist || converted?.detectedArtist || '';

  const handleImport = () => {
    if (!converted?.chordProText) return;

    onImport({
      title: effectiveTitle,
      artist: effectiveArtist,
      rawText: converted.chordProText,
      capo: converted.capo,
    });
  };

  const canImport = converted?.chordProText && chordCount > 0;

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
        <h1 className="text-lg font-bold text-gray-800">
          Importeer Liedje
        </h1>
        <Button
          onClick={handleImport}
          variant="accent"
          className="text-base px-4 py-2"
          disabled={!canImport}
        >
          Importeer
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Instructions */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-blue-700 mb-1">
            Hoe werkt het?
          </p>
          <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
            <li>
              Ga naar{' '}
              <a
                href="https://www.ultimate-guitar.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                Ultimate Guitar
              </a>{' '}
              en zoek een liedje
            </li>
            <li>Open de "Chords" versie</li>
            <li>Selecteer alle tekst (Ctrl+A / Cmd+A) en kopieer</li>
            <li>Plak hieronder</li>
          </ol>
        </div>

        {/* Title & Artist (optional override) */}
        {converted?.chordProText && (
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

        {/* No chords found warning */}
        {pastedText.trim() && !canImport && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 text-sm">
            <p className="font-bold text-amber-700">Geen akkoorden gevonden</p>
            <p className="text-amber-600 text-xs">
              Zorg dat je tekst akkoorden bevat in het formaat "chords boven tekst" of ChordPro ([Am]tekst).
            </p>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
