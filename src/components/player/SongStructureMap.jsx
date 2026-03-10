import { useMemo, useRef, useEffect } from 'react';
import { buildSectionMap } from '../../lib/chordProParser';

const SECTION_COLORS = {
  intro:   { bg: 'bg-purple-200', active: 'bg-purple-500', text: 'text-purple-700', activeText: 'text-white' },
  outro:   { bg: 'bg-purple-200', active: 'bg-purple-500', text: 'text-purple-700', activeText: 'text-white' },
  verse:   { bg: 'bg-sky-200',    active: 'bg-sky-500',    text: 'text-sky-700',    activeText: 'text-white' },
  couplet: { bg: 'bg-sky-200',    active: 'bg-sky-500',    text: 'text-sky-700',    activeText: 'text-white' },
  chorus:  { bg: 'bg-amber-200',  active: 'bg-amber-500',  text: 'text-amber-700',  activeText: 'text-white' },
  refrein: { bg: 'bg-amber-200',  active: 'bg-amber-500',  text: 'text-amber-700',  activeText: 'text-white' },
  bridge:  { bg: 'bg-emerald-200',active: 'bg-emerald-500',text: 'text-emerald-700', activeText: 'text-white' },
  brug:    { bg: 'bg-emerald-200',active: 'bg-emerald-500',text: 'text-emerald-700', activeText: 'text-white' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-200', active: 'bg-gray-500', text: 'text-gray-700', activeText: 'text-white' };

function getColors(type) {
  return SECTION_COLORS[type] || DEFAULT_COLORS;
}

// Abbreviate labels for compact display
function abbreviateLabel(label, index, allLabels) {
  // Count how many times this label appears
  const sameLabels = allLabels.filter((l) => l === label);
  if (sameLabels.length > 1) {
    // Add number suffix: Couplet → C1, C2, etc.
    const occurrence = allLabels.slice(0, index + 1).filter((l) => l === label).length;
    const abbr = label.charAt(0).toUpperCase();
    return `${abbr}${occurrence}`;
  }
  // Single occurrence: keep short
  if (label.length <= 5) return label;
  return label.substring(0, 4);
}

export default function SongStructureMap({ sections, chordSequence, currentChordIndex, onJumpToSection }) {
  const containerRef = useRef(null);

  const sectionMap = useMemo(() => {
    if (!sections || !chordSequence) return [];
    return buildSectionMap(sections, chordSequence);
  }, [sections, chordSequence]);

  // Find active section
  const activeSectionIdx = useMemo(() => {
    for (let i = 0; i < sectionMap.length; i++) {
      if (currentChordIndex >= sectionMap[i].startChordIndex && currentChordIndex <= sectionMap[i].endChordIndex) {
        return i;
      }
    }
    return 0;
  }, [sectionMap, currentChordIndex]);

  // Auto-scroll active section into view
  const activeRef = useRef(null);
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeSectionIdx]);

  if (sectionMap.length <= 1) return null; // Don't show for single-section songs

  const allLabels = sectionMap.map((s) => s.label);
  const totalChords = chordSequence.length || 1;

  return (
    <div
      ref={containerRef}
      className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0 bg-white/40 border-b border-gray-200 scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {sectionMap.map((section, idx) => {
        const isActive = idx === activeSectionIdx;
        const colors = getColors(section.type);
        const widthPercent = Math.max((section.chordCount / totalChords) * 100, 12);
        const label = abbreviateLabel(section.label, idx, allLabels);

        return (
          <button
            key={`${section.sectionIndex}-${idx}`}
            ref={isActive ? activeRef : null}
            onClick={() => onJumpToSection(section.sectionIndex)}
            className={`
              shrink-0 px-3 py-1 rounded-lg text-xs font-bold
              transition-all duration-200 active:scale-95
              ${isActive ? `${colors.active} ${colors.activeText} shadow-sm` : `${colors.bg} ${colors.text}`}
            `}
            style={{ minWidth: `${Math.max(widthPercent * 2.5, 36)}px` }}
            title={section.label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
