import type { InstrumentProfile, ScaleDefinition } from './types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const INSTRUMENTS: InstrumentProfile[] = [
  { id: 'piccolo', name: 'Piccolo', lowest: 74, highest: 108, gmProgram: 72, writtenPitchOffset: -12 },
  { id: 'flute', name: 'Flute', lowest: 60, highest: 98, gmProgram: 73, writtenPitchOffset: 0 },
  { id: 'oboe', name: 'Oboe', lowest: 58, highest: 93, gmProgram: 68, writtenPitchOffset: 0 },
  { id: 'clarinet', name: 'Clarinet', lowest: 52, highest: 96, gmProgram: 71, writtenPitchOffset: 2 },
  { id: 'bassoon', name: 'Bassoon', lowest: 34, highest: 76, gmProgram: 70, writtenPitchOffset: 0 },
  { id: 'contrabassoon', name: 'Contrabassoon', lowest: 22, highest: 58, gmProgram: 70, writtenPitchOffset: 12 },
];

export const SCALES: ScaleDefinition[] = [
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'natural-minor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonic-minor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic-minor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export function midiNoteName(note: number): string {
  const pitchClass = ((note % 12) + 12) % 12;
  const octave = Math.floor(note / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}


export function buildCandidateNotes(
  keyRoot: number,
  scale: ScaleDefinition,
  lowest: number,
  highest: number,
): number[] {
  const allowed = new Set(scale.intervals.map((interval) => (keyRoot + interval) % 12));
  const start = Math.max(0, Math.min(127, Math.floor(Math.min(lowest, highest))));
  const end = Math.max(0, Math.min(127, Math.floor(Math.max(lowest, highest))));
  const notes: number[] = [];

  for (let note = start; note <= end; note += 1) {
    if (allowed.has(note % 12)) {
      notes.push(note);
    }
  }

  return notes;
}

export function getInstrument(id: string): InstrumentProfile {
  return INSTRUMENTS.find((instrument) => instrument.id === id) ?? INSTRUMENTS[1];
}

export function getScale(id: string): ScaleDefinition {
  return SCALES.find((scale) => scale.id === id) ?? SCALES[0];
}

export function gmProgramByteToProgramNumber(gmProgram: number): number {
  return Math.min(128, Math.max(1, Math.round(gmProgram) + 1));
}
