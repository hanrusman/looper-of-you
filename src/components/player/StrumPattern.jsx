import { motion } from 'framer-motion';

function DownArrow() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
      <path d="M10 2v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 14l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UpArrow() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
      <path d="M10 22V6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 10L10 4 4 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestDash() {
  return (
    <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
      <path d="M4 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function StrumPattern({ pattern, currentSubdivision, animated = true }) {
  if (!pattern || pattern.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      {pattern.map((token, idx) => {
        const isActive = animated && idx === currentSubdivision;
        const isPast = animated && idx < currentSubdivision;

        let colorClass = 'text-gray-300'; // future
        if (isActive) {
          colorClass = token === 'D' ? 'text-emerald-500' : token === 'U' ? 'text-blue-500' : 'text-gray-400';
        } else if (isPast) {
          colorClass = token === 'D' ? 'text-emerald-300' : token === 'U' ? 'text-blue-300' : 'text-gray-200';
        } else if (!animated) {
          // Preview mode: all visible
          colorClass = token === 'D' ? 'text-emerald-400' : token === 'U' ? 'text-blue-400' : 'text-gray-300';
        }

        return (
          <motion.div
            key={idx}
            className={`flex items-center justify-center ${colorClass} transition-colors duration-100`}
            animate={
              animated
                ? {
                    scale: isActive ? 1.4 : 1,
                    opacity: isActive ? 1 : isPast ? 0.5 : 0.7,
                  }
                : {}
            }
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {token === 'D' && <DownArrow />}
            {token === 'U' && <UpArrow />}
            {token === '-' && <RestDash />}
          </motion.div>
        );
      })}
    </div>
  );
}
