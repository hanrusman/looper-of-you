import { motion } from 'framer-motion';

export default function BeatIndicator({ currentBeat, beatsPerChord }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: beatsPerChord }, (_, i) => (
        <motion.div
          key={i}
          className="w-3.5 h-3.5 rounded-full"
          animate={{
            backgroundColor: i === currentBeat ? '#6366f1' : '#e2e8f0',
            scale: i === currentBeat ? 1.3 : 1,
          }}
          transition={{ duration: 0.1 }}
        />
      ))}
    </div>
  );
}
