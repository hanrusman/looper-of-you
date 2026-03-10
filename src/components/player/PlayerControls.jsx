import IconButton from '../ui/IconButton';
import BeatIndicator from './BeatIndicator';
import StrumPattern from './StrumPattern';
import usePlayerStore from '../../store/playerStore';

function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

export default function PlayerControls() {
  const { isPlaying, play, pause, stop, bpm, adjustTempo, currentBeat, beatsPerChord, syncMode, strumPattern, strumSubdivision, syncOffset, adjustSyncOffset } =
    usePlayerStore();

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm border-t border-gray-200">
      {strumPattern ? (
        <StrumPattern pattern={strumPattern} currentSubdivision={strumSubdivision} />
      ) : (
        <BeatIndicator currentBeat={currentBeat} beatsPerChord={beatsPerChord} />
      )}

      <div className="flex items-center gap-4">
        <IconButton onClick={stop} size="sm">
          <StopIcon />
        </IconButton>

        <IconButton
          onClick={isPlaying ? pause : play}
          active={isPlaying}
          size="lg"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>

        {syncMode ? (
          /* In sync mode: show BPM + fine-tune offset controls */
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-500 font-semibold">BPM</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjustTempo(bpm - 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
                >
                  -
                </button>
                <span className="text-sm font-bold text-gray-600 w-8 text-center">
                  {bpm}
                </span>
                <button
                  onClick={() => adjustTempo(bpm + 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-500 font-semibold">SYNC</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjustSyncOffset(-0.25)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
                >
                  -
                </button>
                <span className={`text-sm font-bold w-12 text-center ${syncOffset !== 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {syncOffset >= 0 ? '+' : ''}{syncOffset.toFixed(1)}s
                </span>
                <button
                  onClick={() => adjustSyncOffset(0.25)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Timer mode: show adjustable tempo controls */
          <div className="flex flex-col items-center min-w-[80px]">
            <span className="text-xs text-gray-500 font-semibold">TEMPO</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustTempo(bpm - 5)}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
              >
                -
              </button>
              <span className="text-lg font-bold text-primary w-10 text-center">
                {bpm}
              </span>
              <button
                onClick={() => adjustTempo(bpm + 5)}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm active:scale-90 transition-transform"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
