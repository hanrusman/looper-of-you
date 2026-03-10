import { useEffect, useRef } from 'react';
import { CHORD_LIBRARY } from '../../data/chords';

export default function LyricsDisplay({ sections, chordSequence, currentChordIndex }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentChordIndex]);

  // Build a lookup: sectionIndex-lineIndex-segmentIndex -> globalChordIndex
  const chordIndexMap = {};
  if (chordSequence) {
    for (const entry of chordSequence) {
      const key = `${entry.sectionIndex}-${entry.lineIndex}-${entry.segmentIndex}`;
      chordIndexMap[key] = entry.globalIndex;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      {sections.map((section, si) => (
        <div key={si}>
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
            {section.label}
          </h3>

          {section.lines.map((line, li) => (
            <div key={li} className="mb-3">
              <div className="flex flex-wrap gap-x-1">
                {line.segments.map((seg, segi) => {
                  const key = `${si}-${li}-${segi}`;
                  const globalIdx = chordIndexMap[key];
                  const isActive = globalIdx === currentChordIndex;
                  const isPast = globalIdx !== undefined && globalIdx < currentChordIndex;
                  const chord = seg.chord ? CHORD_LIBRARY[seg.chord] : null;

                  return (
                    <span
                      key={segi}
                      ref={isActive ? activeRef : null}
                      className="inline-flex flex-col"
                    >
                      {seg.chord && (
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-md inline-block mb-0.5 transition-all duration-200 ${
                            isActive
                              ? 'bg-primary text-white scale-110'
                              : isPast
                                ? 'bg-gray-200 text-gray-400'
                                : 'bg-primary-light/30 text-primary-dark'
                          }`}
                        >
                          {seg.chord}
                        </span>
                      )}
                      <span
                        className={`text-lg leading-snug transition-colors duration-200 ${
                          isActive
                            ? 'text-gray-900 font-bold'
                            : isPast
                              ? 'text-gray-400'
                              : 'text-gray-700'
                        }`}
                      >
                        {seg.lyrics || '\u00A0'}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Bottom padding so last line can scroll to center */}
      <div className="h-40" />
    </div>
  );
}
