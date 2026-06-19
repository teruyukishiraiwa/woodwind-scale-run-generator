import { PPQ, type RunSettings } from './types';

export function beatsPerBar(settings: RunSettings): number {
  return settings.timeSignatureNumerator * (4 / settings.timeSignatureDenominator);
}

export function totalTicksForPhrase(settings: RunSettings): number {
  const beats =
    settings.phraseLengthUnit === 'bars'
      ? settings.phraseLength * beatsPerBar(settings)
      : settings.phraseLength;
  return Math.max(1, Math.round(beats * PPQ));
}

export function rawStepTicks(settings: RunSettings): number {
  const noteValueTicks = PPQ * (4 / settings.subdivision);
  const tuplet = Math.max(1, settings.tuplet);
  const notesOccupied = tuplet > 1 ? 2 : 1;
  return (noteValueTicks * notesOccupied) / tuplet;
}


export function evenTickBoundaries(totalTicks: number, stepCount: number): number[] {
  const safeTotal = Math.max(1, Math.round(totalTicks));
  const safeSteps = Math.max(1, Math.round(stepCount));
  const boundaries: number[] = [];

  for (let index = 0; index <= safeSteps; index += 1) {
    boundaries.push(Math.round((index * safeTotal) / safeSteps));
  }

  boundaries[0] = 0;
  boundaries[boundaries.length - 1] = safeTotal;
  return boundaries;
}

