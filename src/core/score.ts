import { buildCandidateNotes, getInstrument, getScale } from './music';
import { PPQ, type GeneratedPhrase, type NotationPitchMode, type RunSettings } from './types';

const VEXFLOW_NOTE_NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];

export type Clef = 'treble' | 'bass';
export type EndpointSelection = 'start' | 'end';
export type StemDirection = 1 | -1;

export const STEM_UP: StemDirection = 1;
export const STEM_DOWN: StemDirection = -1;

export function midiToVexflowKey(note: number): string {
  const pitchClass = ((note % 12) + 12) % 12;
  const octave = Math.floor(note / 12) - 1;
  return `${VEXFLOW_NOTE_NAMES[pitchClass]}/${octave}`;
}

export function clefForInstrument(instrumentId: string): Clef {
  return instrumentId === 'bassoon' || instrumentId === 'contrabassoon' ? 'bass' : 'treble';
}

export function writtenPitchOffsetForInstrument(instrumentId: string): number {
  return getInstrument(instrumentId).writtenPitchOffset;
}

export function displayPitchForNotation(
  instrumentId: string,
  soundingPitch: number,
  notationPitchMode: NotationPitchMode,
): number {
  return notationPitchMode === 'written'
    ? soundingPitch + writtenPitchOffsetForInstrument(instrumentId)
    : soundingPitch;
}

export function stemDirectionForScoreGroup(pitches: number[], clef: Clef): StemDirection {
  if (pitches.length === 0) return STEM_UP;

  const averagePitch = pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length;
  const middleLinePitch = clef === 'bass' ? 50 : 71;
  return averagePitch >= middleLinePitch ? STEM_DOWN : STEM_UP;
}

export interface ScoreRhythmInfo {
  duration: 'q' | '8' | '16' | '32' | '64';
  tuplet: number;
  groupSize: number;
  notesOccupied: number;
  approximate: boolean;
}

const DURATION_TICKS: Record<ScoreRhythmInfo['duration'], number> = {
  q: PPQ,
  8: PPQ / 2,
  16: PPQ / 4,
  32: PPQ / 8,
  64: PPQ / 16,
};

export function scoreRhythmForSettings(settings: RunSettings): ScoreRhythmInfo {
  const tuplet = Math.max(1, Math.min(9, Math.round(settings.tuplet)));
  const duration = subdivisionToVexflowDuration(settings.subdivision);
  return {
    duration,
    tuplet,
    groupSize: tuplet > 1 ? tuplet : normalBeamGroupSize(settings.subdivision),
    notesOccupied: 2,
    approximate: false,
  };
}

export function scoreDurationForPhrase(phrase: GeneratedPhrase): ScoreRhythmInfo {
  if (phrase.notes.length === 0) return scoreRhythmForSettings(phrase.settings);

  const stepTicks = phrase.totalTicks / phrase.notes.length;
  const normal = nearestNormalDuration(stepTicks);
  if (normal.error <= 1) {
    return {
      duration: normal.duration,
      tuplet: 1,
      groupSize: normalBeamGroupSize(durationToSubdivision(normal.duration)),
      notesOccupied: 1,
      approximate: false,
    };
  }

  const tuplet = nearestTupletDuration(stepTicks);
  if (tuplet.error <= 1 && isSimpleTuplet(tuplet.notesOccupied)) {
    return {
      duration: tuplet.duration,
      tuplet: tuplet.tuplet,
      groupSize: tuplet.tuplet,
      notesOccupied: tuplet.notesOccupied,
      approximate: false,
    };
  }

  return {
    duration: '16',
    tuplet: 1,
    groupSize: 4,
    notesOccupied: 1,
    approximate: true,
  };
}

function subdivisionToVexflowDuration(subdivision: number): ScoreRhythmInfo['duration'] {
  if (subdivision === 4) return 'q';
  if (subdivision === 8) return '8';
  if (subdivision === 16) return '16';
  if (subdivision === 32) return '32';
  return '64';
}

function durationToSubdivision(duration: ScoreRhythmInfo['duration']): number {
  if (duration === 'q') return 4;
  return Number(duration);
}

function nearestNormalDuration(stepTicks: number): { duration: ScoreRhythmInfo['duration']; error: number } {
  return (Object.entries(DURATION_TICKS) as Array<[ScoreRhythmInfo['duration'], number]>).reduce(
    (best, [duration, ticks]) => {
      const error = Math.abs(stepTicks - ticks);
      return error < best.error ? { duration, error } : best;
    },
    { duration: '16' as ScoreRhythmInfo['duration'], error: Number.POSITIVE_INFINITY },
  );
}

function nearestTupletDuration(stepTicks: number): {
  duration: ScoreRhythmInfo['duration'];
  tuplet: number;
  notesOccupied: number;
  error: number;
} {
  let best = {
    duration: '16' as ScoreRhythmInfo['duration'],
    tuplet: 3,
    notesOccupied: 2,
    error: Number.POSITIVE_INFINITY,
  };

  for (const [duration, baseTicks] of Object.entries(DURATION_TICKS) as Array<[ScoreRhythmInfo['duration'], number]>) {
    for (let tuplet = 2; tuplet <= 9; tuplet += 1) {
      for (let notesOccupied = 1; notesOccupied <= Math.max(2, tuplet - 1); notesOccupied += 1) {
        const ticks = (baseTicks * notesOccupied) / tuplet;
        const error = Math.abs(stepTicks - ticks);
        if (error < best.error) {
          best = { duration, tuplet, notesOccupied, error };
        }
      }
    }
  }

  return best;
}

function isSimpleTuplet(notesOccupied: number): boolean {
  return notesOccupied === 1 || notesOccupied === 2;
}

function normalBeamGroupSize(subdivision: number): number {
  if (subdivision <= 4) return 1;
  return Math.max(1, subdivision / 4);
}


export function startEndpointIndex(): number {
  return 0;
}

export function endEndpointIndexForPhrase(phrase: GeneratedPhrase): number {
  const index = phrase.notes.findIndex((note) => note.pitch === phrase.summary.correctedEndNote);
  return index >= 0 ? index : Math.max(0, phrase.notes.length - 1);
}

export function moveEndpointByScaleStep(
  settings: RunSettings,
  endpoint: EndpointSelection,
  step: -1 | 1,
): RunSettings {
  const scaleNotes = scaleNotesForSettings(settings);
  const current = endpoint === 'start' ? settings.startNote : settings.endNote;
  const currentIndex = nearestScaleIndex(scaleNotes, current);
  const nextIndex = Math.min(scaleNotes.length - 1, Math.max(0, currentIndex + step));
  const nextNote = scaleNotes[nextIndex];

  return endpoint === 'start'
    ? { ...settings, startNote: nextNote }
    : { ...settings, endNote: nextNote };
}

export function applyScoreDirection(settings: RunSettings, direction: RunSettings['direction']): RunSettings {
  return { ...settings, direction };
}

function scaleNotesForSettings(settings: RunSettings): number[] {
  return buildCandidateNotes(settings.keyRoot, getScale(settings.scaleId), 0, 127);
}

function nearestScaleIndex(notes: number[], target: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < notes.length; index += 1) {
    const distance = Math.abs(notes[index] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}
