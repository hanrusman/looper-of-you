import { FINGER_COLORS } from '../../data/chords';

const SIZES = {
  sm: 90,
  md: 150,
  lg: 260,
};

// SVG coordinate constants (within viewBox)
const PAD_TOP = 35;
const PAD_LEFT = 18;
const PAD_RIGHT = 18;
const STRING_COUNT = 6;
const FRET_COUNT = 4;
const FRET_SPACING = 26;
const DOT_RADIUS = 7;

export default function ChordDiagram({ chord, size = 'md' }) {
  if (!chord) return null;

  const width = 120;
  const stringSpacing = (width - PAD_LEFT - PAD_RIGHT) / (STRING_COUNT - 1);
  const height = PAD_TOP + FRET_COUNT * FRET_SPACING + 12;

  const nutY = PAD_TOP;
  const pixelWidth = SIZES[size] || SIZES.md;

  const getStringX = (i) => PAD_LEFT + i * stringSpacing;
  const getFretY = (fret) => nutY + fret * FRET_SPACING;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={pixelWidth}
        style={{ maxWidth: '100%' }}
      >
        {/* Chord name */}
        <text
          x={width / 2}
          y={14}
          textAnchor="middle"
          fontSize="16"
          fontWeight="800"
          fill="#1e293b"
          fontFamily="Nunito, sans-serif"
        >
          {chord.name}
        </text>

        {/* Open / Muted markers above nut */}
        {chord.frets.map((fret, i) => {
          const x = getStringX(i);
          const y = nutY - 10;
          if (fret === 0) {
            return (
              <circle
                key={`open-${i}`}
                cx={x}
                cy={y}
                r={5}
                fill="none"
                stroke="#475569"
                strokeWidth={1.5}
              />
            );
          }
          if (fret === -1) {
            return (
              <text
                key={`muted-${i}`}
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="bold"
                fill="#ef4444"
                fontFamily="Nunito, sans-serif"
              >
                X
              </text>
            );
          }
          return null;
        })}

        {/* Nut (thick top line) */}
        <line
          x1={getStringX(0)}
          y1={nutY}
          x2={getStringX(5)}
          y2={nutY}
          stroke="#1e293b"
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* Fret lines */}
        {Array.from({ length: FRET_COUNT }, (_, i) => (
          <line
            key={`fret-${i}`}
            x1={getStringX(0)}
            y1={getFretY(i + 1)}
            x2={getStringX(5)}
            y2={getFretY(i + 1)}
            stroke="#a8a29e"
            strokeWidth={1.5}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: STRING_COUNT }, (_, i) => (
          <line
            key={`string-${i}`}
            x1={getStringX(i)}
            y1={nutY}
            x2={getStringX(i)}
            y2={getFretY(FRET_COUNT)}
            stroke="#78716c"
            strokeWidth={i < 3 ? 1.8 : 1.2}
          />
        ))}

        {/* Finger dots */}
        {chord.frets.map((fret, i) => {
          if (fret <= 0) return null;
          const x = getStringX(i);
          const y = getFretY(fret - 1) + FRET_SPACING / 2;
          const finger = chord.fingers[i];
          const color = FINGER_COLORS[finger] || '#6366f1';

          return (
            <g key={`dot-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
              />
              {finger > 0 && (
                <text
                  x={x}
                  y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#fff"
                  fontFamily="Nunito, sans-serif"
                >
                  {finger}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
