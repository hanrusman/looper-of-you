// Chord library for beginner guitar chords
// frets: array of 6 values (low E to high e)
//   -1 = muted (X), 0 = open, 1+ = fret number
// fingers: which finger (0 = none, 1 = index, 2 = middle, 3 = ring, 4 = pinky)

export const CHORD_LIBRARY = {
  'Em': {
    name: 'Em',
    fullName: 'E mineur',
    frets:   [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
  },
  'Am': {
    name: 'Am',
    fullName: 'A mineur',
    frets:   [-1, 0, 2, 2, 1, 0],
    fingers: [0,  0, 2, 3, 1, 0],
  },
  'C': {
    name: 'C',
    fullName: 'C majeur',
    frets:   [-1, 3, 2, 0, 1, 0],
    fingers: [0,  3, 2, 0, 1, 0],
  },
  'G': {
    name: 'G',
    fullName: 'G majeur',
    frets:   [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, 0, 0, 0, 3],
  },
  'D': {
    name: 'D',
    fullName: 'D majeur',
    frets:   [-1, -1, 0, 2, 3, 2],
    fingers: [0,  0,  0, 1, 3, 2],
  },
  'E': {
    name: 'E',
    fullName: 'E majeur',
    frets:   [0, 2, 2, 1, 0, 0],
    fingers: [0, 2, 3, 1, 0, 0],
  },
  'A': {
    name: 'A',
    fullName: 'A majeur',
    frets:   [-1, 0, 2, 2, 2, 0],
    fingers: [0,  0, 1, 2, 3, 0],
  },
  'Dm': {
    name: 'Dm',
    fullName: 'D mineur',
    frets:   [-1, -1, 0, 2, 3, 1],
    fingers: [0,  0,  0, 2, 3, 1],
  },
  'F': {
    name: 'F',
    fullName: 'F majeur (simpel)',
    frets:   [-1, -1, 3, 2, 1, 1],
    fingers: [0,  0,  3, 2, 1, 1],
  },
};

export const FINGER_COLORS = {
  1: '#3b82f6', // blue - index
  2: '#22c55e', // green - middle
  3: '#f97316', // orange - ring
  4: '#ef4444', // red - pinky
};
