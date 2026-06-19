import { clamp, clampInt, dynamicContourValueAt } from './curves';
import { DEFAULT_SETTINGS } from './defaults';
import { buildCandidateNotes, getScale } from './music';
import { evenTickBoundaries, totalTicksForPhrase } from './time';
import { PPQ, type CcEvent, type Direction, type GeneratedPhrase, type NoteEvent, type RunSettings } from './types';

interface CorrectedEndpoints {
  startNote: number;
  endNote: number;
}

export function sanitizeSettings(settings: RunSettings): RunSettings {
  const startNote = clampInt(settings.startNote ?? settings.lowestNote, 0, 127);
  const endNote = clampInt(settings.endNote ?? settings.highestNote, 0, 127);
  const lowest = clampInt(Math.min(settings.lowestNote, settings.highestNote, startNote, endNote), 0, 127);
  const highest = clampInt(Math.max(settings.lowestNote, settings.highestNote, startNote, endNote), 0, 127);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    keyRoot: clampInt(settings.keyRoot, 0, 11),
    tempo: clampInt(settings.tempo, 20, 300),
    timeSignatureNumerator: clampInt(settings.timeSignatureNumerator, 1, 16),
    timeSignatureDenominator: [2, 4, 8, 16].includes(settings.timeSignatureDenominator)
      ? settings.timeSignatureDenominator
      : 4,
    phraseLength: Math.max(0.25, settings.phraseLength),
    notationPitchMode: settings.notationPitchMode === 'concert' ? 'concert' : 'written',
    dynamicContourMode: settings.dynamicContourMode === 'inverted' ? 'inverted' : 'natural',
    subdivision: [4, 8, 16, 32, 64].includes(settings.subdivision) ? settings.subdivision : 16,
    tuplet: clampInt(settings.tuplet, 1, 9),
    startNote,
    endNote,
    lowestNote: lowest,
    highestNote: highest,
    gatePercent: clamp(settings.gatePercent, 1, 150),
    seed: Math.trunc(settings.seed) || 1,
    midiChannel: clampInt(settings.midiChannel, 1, 16),
    programNumber: clampInt(settings.programNumber, 1, 128),
    velocity: {
      ...settings.velocity,
      base: clampInt(settings.velocity.base, 1, 127),
      min: clampInt(settings.velocity.min, 1, 127),
      max: clampInt(settings.velocity.max, 1, 127),
      peakPosition: clampInt(settings.velocity.peakPosition, 5, 95),
    },
    ccLaneA: sanitizeCcLane(settings.ccLaneA),
    ccLaneB: sanitizeCcLane(settings.ccLaneB),
    ccDensityPerBeat: clampInt(settings.ccDensityPerBeat, 1, 16),
  };
}

function sanitizeCcLane(lane: RunSettings['ccLaneA']): RunSettings['ccLaneA'] {
  return {
    ...lane,
    controller: clampInt(lane.controller, 0, 127),
    min: clampInt(lane.min, 0, 127),
    max: clampInt(lane.max, 0, 127),
    peakPosition: clampInt(lane.peakPosition, 5, 95),
  };
}

function isAscendingDirection(direction: Direction): boolean {
  return direction === 'ascending' || direction === 'up-down';
}

function scaleNotesAcrossMidiRange(settings: RunSettings): number[] {
  return buildCandidateNotes(settings.keyRoot, getScale(settings.scaleId), 0, 127);
}

function nearestAtOrAbove(notes: number[], target: number): number | null {
  return notes.find((note) => note >= target) ?? null;
}

function nearestAtOrBelow(notes: number[], target: number): number | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    if (notes[index] <= target) return notes[index];
  }
  return null;
}

export function correctEndpoints(settings: RunSettings): CorrectedEndpoints {
  const allScaleNotes = scaleNotesAcrossMidiRange(settings);
  const ascending = isAscendingDirection(settings.direction);
  const startNote = ascending
    ? nearestAtOrAbove(allScaleNotes, settings.startNote)
    : nearestAtOrBelow(allScaleNotes, settings.startNote);
  const endNote = ascending
    ? nearestAtOrBelow(allScaleNotes, settings.endNote)
    : nearestAtOrAbove(allScaleNotes, settings.endNote);

  if (startNote === null || endNote === null) {
    throw new Error('No notes are available in the selected key, scale, and range.');
  }

  if (ascending && startNote >= endNote) {
    throw new Error('Ascending runs require the start note to be below the end note after scale correction.');
  }

  if (!ascending && startNote <= endNote) {
    throw new Error('Descending runs require the start note to be above the end note after scale correction.');
  }

  return { startNote, endNote };
}

export function buildScaleRunPitches(settings: RunSettings): { pitches: number[]; endpoints: CorrectedEndpoints } {
  const endpoints = correctEndpoints(settings);
  const low = Math.min(endpoints.startNote, endpoints.endNote);
  const high = Math.max(endpoints.startNote, endpoints.endNote);
  const ascendingPitches = buildCandidateNotes(settings.keyRoot, getScale(settings.scaleId), low, high);

  if (ascendingPitches.length < 2) {
    throw new Error('No notes are available in the selected key, scale, and range.');
  }

  const oneWay = isAscendingDirection(settings.direction)
    ? ascendingPitches
    : [...ascendingPitches].reverse();

  if (settings.direction === 'ascending' || settings.direction === 'descending') {
    return { pitches: oneWay, endpoints };
  }

  return {
    pitches: [...oneWay, ...oneWay.slice(0, -1).reverse()],
    endpoints,
  };
}

export function generatePhrase(input: RunSettings): GeneratedPhrase {
  const settings = sanitizeSettings(input);
  const totalTicks = totalTicksForPhrase(settings);
  const { pitches: scalePathPitches, endpoints } = buildScaleRunPitches(settings);
  const boundaries = evenTickBoundaries(totalTicks, scalePathPitches.length);
  const rhythmGridCount = scalePathPitches.length;
  const runPitches = scalePathPitches;
  const notes: NoteEvent[] = [];

  for (let step = 0; step < runPitches.length; step += 1) {
    const startTick = boundaries[step];
    const nextTick = boundaries[step + 1];
    const stepTicks = Math.max(1, nextTick - startTick);
    const position = runPitches.length <= 1 ? 0 : step / (runPitches.length - 1);

    notes.push({
      pitch: runPitches[step],
      startTick,
      durationTicks: Math.max(1, Math.round(stepTicks * (settings.gatePercent / 100))),
      velocity: dynamicContourValueAt(position, settings.direction, settings.dynamicContourMode, settings.velocity, 1, 127),
      candidateIndex: step,
    });
  }

  const ccEvents = generateCcEvents(settings);
  const pitches = notes.map((note) => note.pitch);

  return {
    settings: {
      ...settings,
      lowestNote: Math.min(endpoints.startNote, endpoints.endNote),
      highestNote: Math.max(endpoints.startNote, endpoints.endNote),
    },
    ppq: PPQ,
    totalTicks,
    candidateNotes: runPitches,
    notes,
    ccEvents,
    summary: {
      noteCount: notes.length,
      minPitch: Math.min(...pitches),
      maxPitch: Math.max(...pitches),
      scaleDegreeCount: runPitches.length,
      rhythmGridCount,
      actualSpanSemitones: Math.max(...pitches) - Math.min(...pitches),
      correctedStartNote: endpoints.startNote,
      correctedEndNote: endpoints.endNote,
      seed: settings.seed,
    },
  };
}

export function generateCcEvents(settings: RunSettings): CcEvent[] {
  const totalTicks = totalTicksForPhrase(settings);
  const density = clampInt(settings.ccDensityPerBeat, 1, 16);
  const spacing = PPQ / density;
  const events: CcEvent[] = [];

  for (const lane of [settings.ccLaneA, settings.ccLaneB]) {
    if (!lane.enabled) continue;

    const points = Math.max(1, Math.ceil(totalTicks / spacing));
    for (let point = 0; point <= points; point += 1) {
      const tick = point === points ? totalTicks : Math.min(totalTicks, Math.round(point * spacing));
      const position = totalTicks === 0 ? 0 : tick / totalTicks;
      events.push({
        tick,
        controller: lane.controller,
        value: dynamicContourValueAt(
          position,
          settings.direction,
          settings.dynamicContourMode,
          {
            base: lane.min,
            min: lane.min,
            max: lane.max,
            peakPosition: lane.peakPosition,
            curve: lane.curve,
          },
          0,
          127,
        ),
      });
    }
  }

  return events.sort((a, b) => a.tick - b.tick || a.controller - b.controller);
}
