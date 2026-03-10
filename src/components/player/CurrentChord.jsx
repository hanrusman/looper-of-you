import { AnimatePresence, motion } from 'framer-motion';
import ChordDiagram from '../chord/ChordDiagram';
import { CHORD_LIBRARY } from '../../data/chords';

export default function CurrentChord({ chordName }) {
  const chord = CHORD_LIBRARY[chordName];

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={chordName || 'empty'}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          {chord ? (
            <ChordDiagram chord={chord} size="lg" />
          ) : (
            <div className="text-gray-400 text-xl font-semibold">
              Druk op play
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {chord && (
        <p className="text-sm text-gray-500 mt-1">{chord.fullName}</p>
      )}
    </div>
  );
}
