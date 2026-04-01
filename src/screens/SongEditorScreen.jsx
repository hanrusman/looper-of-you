import { useState, useEffect, useCallback, useMemo } from 'react';
import useSongStore from '../store/songStore';
import Button from '../components/ui/Button';
import { parseChordPro, extractChordSequence } from '../lib/chordProParser';
import { CHORD_LIBRARY } from '../data/chords';
import { extractYouTubeId } from '../lib/youtubeUtils';
import { STRUM_PRESETS } from '../data/strumPatterns';
import { parseStrumPattern } from '../lib/strumUtils';
import StrumPattern from '../components/player/StrumPattern';
import useTapTempo from '../hooks/useTapTempo';
import { parseMidiFile, mapOnsetsToChords, autoSelectTrack } from '../lib/midiParser';

export default function SongEditorScreen({ songId, importData, onSave, onBack }) {
  const { getSong, addSong, updateSong, deleteSong } = useSongStore();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState(80);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [rawText, setRawText] = useState('');
  const [capo, setCapo] = useState(0);
  const [strumPattern, setStrumPattern] = useState('');
  const [strumPreset, setStrumPreset] = useState('none');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeStartTime, setYoutubeStartTime] = useState(0);

  // MIDI timing state
  const [midiData, setMidiData] = useState(null); // parsed MIDI result
  const [midiFileName, setMidiFileName] = useState('');
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0);
  const [chordTimings, setChordTimings] = useState(null);
  const [midiTempo, setMidiTempo] = useState(null);
  const [midiTimeSignature, setMidiTimeSignature] = useState(null);
  const [midiWarning, setMidiWarning] = useState(null);

  const isEditing = !!songId;

  // Tap-tempo
  const handleBpmDetected = useCallback((detectedBpm) => {
    setBpm(detectedBpm);
  }, []);
  const { tap, tapCount, reset: resetTap } = useTapTempo({ onBpmDetected: handleBpmDetected });

  useEffect(() => {
    if (songId) {
      const song = getSong(songId);
      if (song) {
        setTitle(song.title);
        setArtist(song.artist);
        setBpm(song.bpm);
        setBeatsPerChord(song.beatsPerChord);
        setRawText(song.rawText);
        setCapo(song.capo || 0);
        setStrumPattern(song.strumPattern || '');
        // Find matching preset
        const matchingPreset = STRUM_PRESETS.find((p) => p.pattern === song.strumPattern);
        setStrumPreset(matchingPreset ? matchingPreset.id : (song.strumPattern ? 'custom' : 'none'));
        setYoutubeUrl(song.youtubeId ? `https://youtu.be/${song.youtubeId}` : '');
        setYoutubeStartTime(song.youtubeStartTime || 0);
        if (song.chordTimings) {
          setChordTimings(song.chordTimings);
          setMidiTempo(song.midiTempo || null);
          setMidiTimeSignature(song.midiTimeSignature || null);
          setMidiFileName(song.midiFileName || 'MIDI geladen');
        }
      }
    } else if (importData) {
      // Pre-fill from imported data
      setTitle(importData.title || '');
      setArtist(importData.artist || '');
      setRawText(importData.rawText || '');
      setCapo(importData.capo || 0);
      if (importData.bpm) setBpm(importData.bpm);
    }
  }, [songId, importData, getSong]);

  const handleSave = () => {
    if (!title.trim() || !rawText.trim()) return;

    const songData = {
      title: title.trim(),
      artist: artist.trim(),
      bpm: Number(bpm) || 80,
      beatsPerChord: Number(beatsPerChord) || 4,
      capo: Number(capo) || 0,
      strumPattern: strumPattern.trim() || null,
      rawText: rawText.trim(),
      youtubeId: extractYouTubeId(youtubeUrl),
      youtubeStartTime: Number(youtubeStartTime) || 0,
      chordTimings: chordTimings || null,
      midiTempo: midiTempo || null,
      midiTimeSignature: midiTimeSignature || null,
      midiFileName: midiFileName || null,
    };

    if (isEditing) {
      updateSong(songId, songData);
    } else {
      addSong(songData);
    }
    onSave();
  };

  const handleDelete = () => {
    if (songId) {
      deleteSong(songId);
      onSave();
    }
  };

  // Preview: parse the raw text
  const previewSections = rawText ? parseChordPro(rawText) : [];
  const chordCount = useMemo(
    () => extractChordSequence(previewSections).length,
    [previewSections]
  );
  const previewYoutubeId = extractYouTubeId(youtubeUrl);

  // Handle MIDI file upload
  const handleMidiUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMidiFile(buffer);
      setMidiData(parsed);
      setMidiFileName(file.name);
      setMidiTempo(parsed.tempo);
      setMidiTimeSignature(parsed.timeSignature);
      setBpm(parsed.tempo);

      // Auto-select best matching track
      const bestIdx = autoSelectTrack(parsed.tracks, chordCount);
      setSelectedTrackIdx(bestIdx);

      // Map onsets to chords
      if (parsed.tracks[bestIdx]) {
        const { chordTimings: timings, warning } = mapOnsetsToChords(
          parsed.tracks[bestIdx].onsets,
          chordCount
        );
        setChordTimings(timings);
        setMidiWarning(warning);
      }
    } catch (err) {
      setMidiWarning('Kon MIDI-bestand niet lezen: ' + (err.message || 'onbekende fout'));
    }
  };

  // Handle track selection change
  const handleTrackChange = (idx) => {
    setSelectedTrackIdx(idx);
    if (midiData?.tracks[idx]) {
      const { chordTimings: timings, warning } = mapOnsetsToChords(
        midiData.tracks[idx].onsets,
        chordCount
      );
      setChordTimings(timings);
      setMidiWarning(warning);
    }
  };

  // Remove MIDI
  const handleRemoveMidi = () => {
    setMidiData(null);
    setMidiFileName('');
    setChordTimings(null);
    setMidiTempo(null);
    setMidiTimeSignature(null);
    setMidiWarning(null);
    setSelectedTrackIdx(0);
  };

  // Find unknown chords
  const unknownChords = new Set();
  for (const section of previewSections) {
    for (const line of section.lines) {
      for (const seg of line.segments) {
        if (seg.chord && !CHORD_LIBRARY[seg.chord]) {
          unknownChords.add(seg.chord);
        }
      }
    }
  }

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
          {isEditing ? 'Bewerken' : 'Nieuw Liedje'}
        </h1>
        <Button onClick={handleSave} variant="accent" className="text-base px-4 py-2">
          Opslaan
        </Button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title & Artist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naam van het liedje"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Artiest</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artiest of Traditioneel"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Strum Pattern */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-1">
            Tokkelpatroon
          </label>
          <p className="text-xs text-gray-400 mb-2">
            D = neer, U = op, - = rust
          </p>
          <select
            value={strumPreset}
            onChange={(e) => {
              const preset = STRUM_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                setStrumPreset(preset.id);
                setStrumPattern(preset.pattern || '');
              } else {
                setStrumPreset('custom');
              }
            }}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors mb-2"
          >
            {STRUM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}{p.pattern ? ` (${p.pattern})` : ''}</option>
            ))}
            <option value="custom">Aangepast</option>
          </select>
          {(strumPreset === 'custom' || strumPattern) && (
            <input
              type="text"
              value={strumPattern}
              onChange={(e) => {
                setStrumPattern(e.target.value);
                setStrumPreset('custom');
              }}
              placeholder="D - D U - U D U"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-mono font-semibold focus:border-primary focus:outline-none transition-colors"
            />
          )}
          {strumPattern && (
            <div className="mt-3 flex items-center justify-center bg-white rounded-xl border-2 border-gray-200 py-3">
              <StrumPattern pattern={parseStrumPattern(strumPattern)} currentSubdivision={-1} animated={false} />
            </div>
          )}
        </div>

        {/* YouTube link */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-1">
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
              </svg>
              YouTube link
            </span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Optioneel — plak een YouTube link om mee te spelen
          </p>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
          />
          {youtubeUrl && !previewYoutubeId && (
            <p className="text-xs text-red-500 mt-1">Ongeldige YouTube link</p>
          )}
          {previewYoutubeId && (
            <div className="mt-2 rounded-xl overflow-hidden border-2 border-gray-200">
              <iframe
                src={`https://www.youtube.com/embed/${previewYoutubeId}?rel=0&modestbranding=1`}
                title="YouTube preview"
                width="100%"
                height="160"
                allow="accelerometer; encrypted-media; gyroscope"
                className="border-0"
              />
            </div>
          )}
          {previewYoutubeId && (
            <div className="mt-3">
              <label className="block text-sm font-bold text-gray-600 mb-1">
                Starttijd eerste akkoord (sec)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Op welke seconde in de video begint het eerste akkoord? (bijv. 12.5)
              </p>
              <input
                type="number"
                value={youtubeStartTime}
                onChange={(e) => setYoutubeStartTime(e.target.value)}
                min="0"
                step="0.5"
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* MIDI timing */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-1">
            <span className="inline-flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              MIDI-bestand
            </span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Optioneel — upload een MIDI voor exacte timing per akkoord
          </p>

          {!midiFileName ? (
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 font-semibold cursor-pointer hover:border-primary hover:text-primary transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Kies MIDI-bestand
              <input
                type="file"
                accept=".mid,.midi"
                onChange={handleMidiUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-2">
              {/* File info bar */}
              <div className="flex items-center justify-between bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span className="text-sm font-semibold text-indigo-700 truncate">{midiFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveMidi}
                  className="shrink-0 text-indigo-400 hover:text-red-500 transition-colors ml-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* MIDI info */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5">
                  <div className="text-xs text-gray-400">Tempo</div>
                  <div className="text-sm font-bold text-gray-700">{midiTempo} BPM</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5">
                  <div className="text-xs text-gray-400">Maatsoort</div>
                  <div className="text-sm font-bold text-gray-700">
                    {midiTimeSignature ? `${midiTimeSignature[0]}/${midiTimeSignature[1]}` : '-'}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5">
                  <div className="text-xs text-gray-400">Match</div>
                  <div className={`text-sm font-bold ${chordTimings?.length === chordCount ? 'text-green-600' : 'text-amber-600'}`}>
                    {chordTimings?.length || 0}/{chordCount}
                  </div>
                </div>
              </div>

              {/* Track selection */}
              {midiData && midiData.tracks.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Track</label>
                  <select
                    value={selectedTrackIdx}
                    onChange={(e) => handleTrackChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-800 text-sm font-semibold focus:border-primary focus:outline-none transition-colors"
                  >
                    {midiData.tracks.map((t, i) => (
                      <option key={i} value={i}>
                        {t.name} — {t.onsetCount} wisselingen ({t.noteCount} noten)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warning */}
              {midiWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  {midiWarning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BPM with tap-tempo, Beats per chord & Capo */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              Tempo (BPM)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                min="40"
                max="200"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={tap}
                className={`shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 font-bold text-xs transition-all active:scale-90 ${
                  tapCount > 0
                    ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm shadow-amber-200'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {/* Tap/metronome icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{tapCount > 0 ? `${tapCount}x` : 'Tik'}</span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              Beats/akk
            </label>
            <input
              type="number"
              value={beatsPerChord}
              onChange={(e) => setBeatsPerChord(e.target.value)}
              min="1"
              max="8"
              className="w-20 px-3 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">
              Capo
            </label>
            <input
              type="number"
              value={capo}
              onChange={(e) => setCapo(e.target.value)}
              min="0"
              max="12"
              className="w-20 px-3 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-semibold focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Raw text input */}
        <div>
          <label className="block text-sm font-bold text-gray-600 mb-1">
            Tekst met akkoorden
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Zet akkoorden tussen blokhaken: [Am]tekst [G]meer tekst.
            Secties: [Verse], [Chorus], [Couplet], [Refrein]
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            placeholder={`[Couplet]\n[C]Twinkle twinkle [F]little [C]star\n[F]How I [C]wonder [G]what you [C]are\n\n[Refrein]\n[C]Up above the [F]world so [C]high`}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-mono text-sm focus:border-primary focus:outline-none transition-colors resize-none"
            spellCheck={false}
          />
        </div>

        {/* Unknown chords warning */}
        {unknownChords.size > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 text-sm">
            <p className="font-bold text-amber-700">Onbekende akkoorden:</p>
            <p className="text-amber-600">
              {[...unknownChords].join(', ')} — deze worden wel getoond als tekst maar hebben geen diagram.
            </p>
          </div>
        )}

        {/* Preview */}
        {previewSections.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-600 mb-2">Preview</h3>
            <div className="bg-white rounded-xl border-2 border-gray-200 px-4 py-3 space-y-3">
              {previewSections.map((section, si) => (
                <div key={si}>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    {section.label}
                  </p>
                  {section.lines.map((line, li) => (
                    <div key={li} className="mb-2 flex flex-wrap gap-x-1">
                      {line.segments.map((seg, segi) => (
                        <span key={segi} className="inline-flex flex-col">
                          {seg.chord && (
                            <span className="text-xs font-bold text-primary bg-primary-light/30 px-1 rounded mb-0.5">
                              {seg.chord}
                            </span>
                          )}
                          <span className="text-sm text-gray-700">{seg.lyrics || '\u00A0'}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete button (only when editing) */}
        {isEditing && (
          <div className="pt-4">
            <Button onClick={handleDelete} variant="danger" className="w-full">
              Verwijderen
            </Button>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
