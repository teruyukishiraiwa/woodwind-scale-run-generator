import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { generatePhrase } from './generator';
import {
  STEM_DOWN,
  STEM_UP,
  applyScoreDirection,
  clefForInstrument,
  displayPitchForNotation,
  midiToVexflowKey,
  endEndpointIndexForPhrase,
  moveEndpointByScaleStep,
  scoreRhythmForSettings,
  scoreDurationForPhrase,
  startEndpointIndex,
  stemDirectionForScoreGroup,
  writtenPitchOffsetForInstrument,
} from './score';
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

describe('score utilities', () => {
  it('converts MIDI note numbers to VexFlow keys', () => {
    expect(midiToVexflowKey(60)).toBe('c/4');
    expect(midiToVexflowKey(61)).toBe('c#/4');
    expect(midiToVexflowKey(70)).toBe('bb/4');
  });

  it('selects a clef from the instrument', () => {
    expect(clefForInstrument('flute')).toBe('treble');
    expect(clefForInstrument('clarinet')).toBe('treble');
    expect(clefForInstrument('bassoon')).toBe('bass');
    expect(clefForInstrument('contrabassoon')).toBe('bass');
  });

  it('uses standard written-pitch offsets for notation display', () => {
    expect(writtenPitchOffsetForInstrument('piccolo')).toBe(-12);
    expect(writtenPitchOffsetForInstrument('flute')).toBe(0);
    expect(writtenPitchOffsetForInstrument('oboe')).toBe(0);
    expect(writtenPitchOffsetForInstrument('clarinet')).toBe(2);
    expect(writtenPitchOffsetForInstrument('bassoon')).toBe(0);
    expect(writtenPitchOffsetForInstrument('contrabassoon')).toBe(12);
  });

  it('converts sounding pitch to written pitch only for notation display', () => {
    expect(displayPitchForNotation('clarinet', 60, 'written')).toBe(62);
    expect(displayPitchForNotation('piccolo', 84, 'written')).toBe(72);
    expect(displayPitchForNotation('contrabassoon', 36, 'written')).toBe(48);
    expect(displayPitchForNotation('clarinet', 60, 'concert')).toBe(60);
  });

  it('chooses a stable stem direction for beamed score groups', () => {
    expect(stemDirectionForScoreGroup([60, 62, 64, 65], 'treble')).toBe(STEM_UP);
    expect(stemDirectionForScoreGroup([72, 74, 76, 77], 'treble')).toBe(STEM_DOWN);
    expect(stemDirectionForScoreGroup([43, 45, 47, 48], 'bass')).toBe(STEM_UP);
    expect(stemDirectionForScoreGroup([52, 53, 55, 57], 'bass')).toBe(STEM_DOWN);
  });

  it('moves the selected endpoint by scale step', () => {
    const movedStart = moveEndpointByScaleStep(settings({ keyRoot: 0, scaleId: 'major', startNote: 60 }), 'start', 1);
    const movedEnd = moveEndpointByScaleStep(settings({ keyRoot: 0, scaleId: 'major', endNote: 67 }), 'end', -1);

    expect(movedStart.startNote).toBe(62);
    expect(movedEnd.endNote).toBe(65);
  });

  it('applies score direction changes to RunSettings', () => {
    expect(applyScoreDirection(settings(), 'down-up').direction).toBe('down-up');
  });

  it('identifies endpoint indices for one-way and turn-around runs', () => {
    const ascending = generatePhrase(settings({ direction: 'ascending' }));
    const descending = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'descending' }));
    const upDown = generatePhrase(settings({ direction: 'up-down' }));
    const downUp = generatePhrase(settings({ startNote: 67, endNote: 60, direction: 'down-up' }));

    expect(startEndpointIndex()).toBe(0);
    expect(endEndpointIndexForPhrase(ascending)).toBe(ascending.notes.length - 1);
    expect(endEndpointIndexForPhrase(descending)).toBe(descending.notes.length - 1);
    expect(endEndpointIndexForPhrase(upDown)).toBe(4);
    expect(endEndpointIndexForPhrase(downUp)).toBe(4);
  });

  it('derives VexFlow rhythm information from subdivision and tuplet settings', () => {
    expect(scoreRhythmForSettings(settings({ subdivision: 16, tuplet: 1 }))).toMatchObject({
      duration: '16',
      tuplet: 1,
      groupSize: 4,
    });
    expect(scoreRhythmForSettings(settings({ subdivision: 8, tuplet: 3 }))).toMatchObject({
      duration: '8',
      tuplet: 3,
      groupSize: 3,
      notesOccupied: 2,
    });
    expect(scoreRhythmForSettings(settings({ subdivision: 16, tuplet: 7 }))).toMatchObject({
      duration: '16',
      tuplet: 7,
      groupSize: 7,
      notesOccupied: 2,
    });
  });

  it('derives VexFlow rhythm information from generated note timing', () => {
    const quintuplet = generatePhrase(settings({ startNote: 60, endNote: 67, direction: 'ascending', phraseLength: 1, phraseLengthUnit: 'beats' }));
    const sixteenths = generatePhrase(settings({ startNote: 60, endNote: 65, direction: 'ascending', phraseLength: 1, phraseLengthUnit: 'beats' }));

    expect(scoreDurationForPhrase(quintuplet)).toMatchObject({
      duration: '8',
      tuplet: 5,
      notesOccupied: 2,
      approximate: false,
    });
    expect(scoreDurationForPhrase(sixteenths)).toMatchObject({
      duration: '16',
      tuplet: 1,
      groupSize: 4,
      approximate: false,
    });
  });

  it('falls back for complex approximate score tuplets', () => {
    const initialLikeRun = generatePhrase(settings({
      startNote: 60,
      endNote: 84,
      direction: 'ascending',
      phraseLength: 1,
      phraseLengthUnit: 'bars',
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    }));

    expect(initialLikeRun.notes).toHaveLength(15);
    expect(scoreDurationForPhrase(initialLikeRun)).toMatchObject({
      duration: '16',
      tuplet: 1,
      groupSize: 4,
      notesOccupied: 1,
      approximate: true,
    });
  });
});
