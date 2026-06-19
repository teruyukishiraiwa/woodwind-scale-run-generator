import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { generatePhrase, sanitizeSettings } from './generator';
import { writeMidiFile } from './midi';
import { buildCandidateNotes, gmProgramByteToProgramNumber, getScale } from './music';
import { evenTickBoundaries, rawStepTicks, totalTicksForPhrase } from './time';
import type { RunSettings } from './types';

function settings(patch: Partial<RunSettings> = {}): RunSettings {
  return {
    ...DEFAULT_SETTINGS,
    startNote: 60,
    endNote: 67,
    lowestNote: 60,
    highestNote: 67,
    ...patch,
    velocity: patch.velocity ? { ...DEFAULT_SETTINGS.velocity, ...patch.velocity } : DEFAULT_SETTINGS.velocity,
    ccLaneA: patch.ccLaneA ? { ...DEFAULT_SETTINGS.ccLaneA, ...patch.ccLaneA } : DEFAULT_SETTINGS.ccLaneA,
    ccLaneB: patch.ccLaneB ? { ...DEFAULT_SETTINGS.ccLaneB, ...patch.ccLaneB } : DEFAULT_SETTINGS.ccLaneB,
  };
}

function pitchesOf(input: RunSettings): number[] {
  return generatePhrase(input).notes.map((note) => note.pitch);
}

function containsByteSequence(bytes: number[], sequence: number[]): boolean {
  return bytes.some((_, index) => sequence.every((value, offset) => bytes[index + offset] === value));
}

describe('generatePhrase', () => {
  it('uses a one-based General MIDI program number in UI settings', () => {
    expect(DEFAULT_SETTINGS.programNumber).toBe(74);
    expect(gmProgramByteToProgramNumber(73)).toBe(74);
  });

  it('defaults notation pitch display to written pitch', () => {
    expect(DEFAULT_SETTINGS.notationPitchMode).toBe('written');
    expect(generatePhrase(settings()).settings.notationPitchMode).toBe('written');
  });

  it('defaults dynamic contour mode to natural', () => {
    expect(DEFAULT_SETTINGS.dynamicContourMode).toBe('natural');
    expect(generatePhrase(settings()).settings.dynamicContourMode).toBe('natural');
  });

  it('regenerates the same notes from the same settings', () => {
    const input = settings({ seed: 2345, direction: 'up-down' });
    const first = generatePhrase(input);
    const second = generatePhrase(input);

    expect(second.notes).toEqual(first.notes);
  });

  it('generates C major C4 to G4 as a simple ascending scale run', () => {
    expect(pitchesOf(settings({ keyRoot: 0, scaleId: 'major', startNote: 60, endNote: 67, direction: 'ascending', phraseLength: 4, phraseLengthUnit: 'beats' }))).toEqual([
      60, 62, 64, 65, 67,
    ]);
  });

  it('generates C major G4 to C4 as a simple descending scale run', () => {
    expect(pitchesOf(settings({ keyRoot: 0, scaleId: 'major', startNote: 67, endNote: 60, direction: 'descending', phraseLength: 4, phraseLengthUnit: 'beats' }))).toEqual([
      67, 65, 64, 62, 60,
    ]);
  });

  it('generates ascending-descending without repeating the turn note', () => {
    expect(pitchesOf(settings({ keyRoot: 0, scaleId: 'major', startNote: 60, endNote: 67, direction: 'up-down', phraseLength: 4, phraseLengthUnit: 'beats' }))).toEqual([
      60, 62, 64, 65, 67, 65, 64, 62, 60,
    ]);
  });

  it('generates descending-ascending without repeating the turn note', () => {
    expect(pitchesOf(settings({ keyRoot: 0, scaleId: 'major', startNote: 67, endNote: 60, direction: 'down-up', phraseLength: 4, phraseLengthUnit: 'beats' }))).toEqual([
      67, 65, 64, 62, 60, 62, 64, 65, 67,
    ]);
  });

  it('uses every scale path note even when the legacy rhythm grid would be longer', () => {
    const phrase = generatePhrase(settings({ startNote: 60, endNote: 67, direction: 'ascending', phraseLength: 2, phraseLengthUnit: 'beats', subdivision: 16, tuplet: 3 }));

    expect(phrase.summary.rhythmGridCount).toBe(5);
    expect(phrase.notes.map((note) => note.pitch)).toEqual([60, 62, 64, 65, 67]);
  });

  it('uses every scale path note even when the legacy rhythm grid would be shorter', () => {
    const phrase = generatePhrase(settings({ startNote: 60, endNote: 84, direction: 'ascending', phraseLength: 1, phraseLengthUnit: 'beats', subdivision: 8, tuplet: 1 }));

    expect(phrase.summary.rhythmGridCount).toBe(15);
    expect(phrase.notes.map((note) => note.pitch)).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]);
  });

  it('does not let subdivision or tuplet settings change the generated scale path', () => {
    const base = pitchesOf(settings({ startNote: 60, endNote: 72, direction: 'ascending', subdivision: 8, tuplet: 1 }));
    const altered = pitchesOf(settings({ startNote: 60, endNote: 72, direction: 'ascending', subdivision: 64, tuplet: 9 }));

    expect(altered).toEqual(base);
  });

  it('does not let notation pitch mode change generated notes or MIDI output', () => {
    const written = generatePhrase(settings({ notationPitchMode: 'written', instrumentId: 'clarinet' }));
    const concert = generatePhrase(settings({ notationPitchMode: 'concert', instrumentId: 'clarinet' }));

    expect(concert.notes).toEqual(written.notes);
    expect(Array.from(writeMidiFile(concert))).toEqual(Array.from(writeMidiFile(written)));
  });

  it('corrects non-scale endpoints toward the selected scale and direction', () => {
    const phrase = generatePhrase(settings({ keyRoot: 0, scaleId: 'major', startNote: 61, endNote: 68, direction: 'ascending' }));

    expect(phrase.summary.correctedStartNote).toBe(62);
    expect(phrase.summary.correctedEndNote).toBe(67);
    expect(phrase.notes.map((note) => note.pitch)).toEqual([62, 64, 65, 67]);
  });

  it('throws when start and end order does not match an ascending direction', () => {
    expect(() => generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'ascending' }))).toThrow(/Ascending runs require/);
  });

  it('throws when start and end order does not match a descending direction', () => {
    expect(() => generatePhrase(settings({ startNote: 60, endNote: 67, direction: 'descending' }))).toThrow(/Descending runs require/);
  });

  it('keeps generated notes inside the selected scale interval', () => {
    const input = settings({ keyRoot: 2, scaleId: 'dorian', startNote: 62, endNote: 86, direction: 'ascending' });
    const phrase = generatePhrase(input);
    const expected = buildCandidateNotes(input.keyRoot, getScale(input.scaleId), 62, 86);

    expect(phrase.candidateNotes).toEqual(expected);
    expect(phrase.notes.every((note) => expected.includes(note.pitch))).toBe(true);
  });

  it('uses scale-note-count boundaries and ends exactly at the requested phrase length', () => {
    const phrase = generatePhrase(
      settings({
        phraseLength: 1,
        phraseLengthUnit: 'bars',
        timeSignatureNumerator: 5,
        timeSignatureDenominator: 8,
        startNote: 60,
        endNote: 67,
        direction: 'ascending',
      }),
    );
    const boundaries = evenTickBoundaries(totalTicksForPhrase(phrase.settings), phrase.summary.noteCount);

    expect(phrase.totalTicks).toBe(2400);
    expect(boundaries.at(-1)).toBe(phrase.totalTicks);
    expect(phrase.notes.map((note) => note.startTick)).toEqual(boundaries.slice(0, phrase.notes.length));
    expect(phrase.notes.at(-1)!.startTick + phrase.notes.at(-1)!.durationTicks).toBeLessThanOrEqual(phrase.totalTicks + Math.ceil((boundaries[1] - boundaries[0]) * 0.5));
  });

  it('calculates tuplets as notes in the time of two base note values for legacy manual grids', () => {
    expect(rawStepTicks(settings({ subdivision: 16, tuplet: 3 }))).toBe(160);
    expect(rawStepTicks(settings({ subdivision: 8, tuplet: 5 }))).toBe(192);
  });

  it('never emits non-positive note durations', () => {
    const phrase = generatePhrase(settings({ gatePercent: -200 }));

    expect(phrase.notes.every((note) => note.durationTicks > 0)).toBe(true);
  });

  it('clamps velocity and CC values and peak positions', () => {
    const sanitized = sanitizeSettings(
      settings({
        velocity: { base: 999, min: -1, max: 999, peakPosition: 0, curve: 'linear' },
        ccLaneA: { enabled: true, controller: 222, min: -50, max: 222, peakPosition: 100, curve: 'linear' },
      }),
    );
    const phrase = generatePhrase(sanitized);

    expect(sanitized.velocity.peakPosition).toBe(5);
    expect(sanitized.ccLaneA.peakPosition).toBe(95);
    expect(phrase.notes.every((note) => note.velocity >= 1 && note.velocity <= 127)).toBe(true);
    expect(phrase.ccEvents.every((event) => event.value >= 0 && event.value <= 127)).toBe(true);
  });


  it('applies natural and inverted contours to ascending runs', () => {
    const natural = generatePhrase(settings({ direction: 'ascending', dynamicContourMode: 'natural', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const inverted = generatePhrase(settings({ direction: 'ascending', dynamicContourMode: 'inverted', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));

    expect(natural.notes.at(0)!.velocity).toBeLessThan(natural.notes.at(-1)!.velocity);
    expect(inverted.notes.at(0)!.velocity).toBeGreaterThan(inverted.notes.at(-1)!.velocity);
  });

  it('applies natural and inverted contours to descending runs', () => {
    const natural = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'descending', dynamicContourMode: 'natural', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const inverted = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'descending', dynamicContourMode: 'inverted', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));

    expect(natural.notes.at(0)!.velocity).toBeGreaterThan(natural.notes.at(-1)!.velocity);
    expect(inverted.notes.at(0)!.velocity).toBeLessThan(inverted.notes.at(-1)!.velocity);
  });

  it('peaks at the turn note for ascending-descending natural contour and dips when inverted', () => {
    const natural = generatePhrase(settings({ direction: 'up-down', dynamicContourMode: 'natural', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const inverted = generatePhrase(settings({ direction: 'up-down', dynamicContourMode: 'inverted', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const turnIndex = natural.notes.findIndex((note) => note.pitch === natural.summary.correctedEndNote);

    expect(natural.notes[turnIndex].velocity).toBe(Math.max(...natural.notes.map((note) => note.velocity)));
    expect(inverted.notes[turnIndex].velocity).toBe(Math.min(...inverted.notes.map((note) => note.velocity)));
  });

  it('dips at the turn note for descending-ascending natural contour and peaks when inverted', () => {
    const natural = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'down-up', dynamicContourMode: 'natural', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const inverted = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'down-up', dynamicContourMode: 'inverted', velocity: { base: 40, min: 40, max: 100, peakPosition: 50, curve: 'linear' } }));
    const turnIndex = natural.notes.findIndex((note) => note.pitch === natural.summary.correctedEndNote);

    expect(natural.notes[turnIndex].velocity).toBe(Math.min(...natural.notes.map((note) => note.velocity)));
    expect(inverted.notes[turnIndex].velocity).toBe(Math.max(...inverted.notes.map((note) => note.velocity)));
  });

  it('applies dynamic contour to enabled CC lanes without changing the pitch path', () => {
    const natural = generatePhrase(settings({
      direction: 'ascending',
      dynamicContourMode: 'natural',
      ccLaneA: { enabled: true, controller: 1, min: 20, max: 100, peakPosition: 50, curve: 'linear' },
    }));
    const inverted = generatePhrase(settings({
      direction: 'ascending',
      dynamicContourMode: 'inverted',
      ccLaneA: { enabled: true, controller: 1, min: 20, max: 100, peakPosition: 50, curve: 'linear' },
    }));

    expect(inverted.notes.map((note) => note.pitch)).toEqual(natural.notes.map((note) => note.pitch));
    expect(inverted.notes.map((note) => note.startTick)).toEqual(natural.notes.map((note) => note.startTick));
    expect(natural.ccEvents[0].value).toBeLessThan(natural.ccEvents.at(-1)!.value);
    expect(inverted.ccEvents[0].value).toBeGreaterThan(inverted.ccEvents.at(-1)!.value);
  });
});

describe('writeMidiFile', () => {
  it('writes a Standard MIDI File Type 1 with two tracks and PPQ 960', () => {
    const phrase = generatePhrase(settings());
    const bytes = writeMidiFile(phrase);

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(1);
    expect(bytes[10]).toBe(0);
    expect(bytes[11]).toBe(2);
    expect(bytes[12]).toBe(3);
    expect(bytes[13]).toBe(192);
  });

  it('writes Program Change with a zero-based MIDI program byte', () => {
    const phrase = generatePhrase(settings({
      instrumentId: 'flute',
      programChangeEnabled: true,
      programNumber: 74,
      midiChannel: 1,
    }));
    const bytes = Array.from(writeMidiFile(phrase));

    expect(containsByteSequence(bytes, [0xc0, 73])).toBe(true);
  });
});
