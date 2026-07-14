export const PPQ = 960;

export type SoundProfile = 'general-midi' | 'bbcso-pro' | 'custom';
export type Direction = 'ascending' | 'descending' | 'up-down' | 'down-up';
export type CurveType = 'linear' | 'ease-in' | 'ease-out' | 's-curve';
export type PhraseLengthUnit = 'bars' | 'beats';
export type NotationPitchMode = 'written' | 'concert';
export type DynamicContourMode = 'natural' | 'inverted';

export interface InstrumentProfile {
  id: string;
  name: string;
  lowest: number;
  highest: number;
  gmProgram?: number;
  writtenPitchOffset: number;
}

export interface ScaleDefinition {
  id: string;
  name: string;
  intervals: number[];
}

export interface DynamicCurveSettings {
  base: number;
  min: number;
  max: number;
  peakPosition: number;
  curve: CurveType;
}

export interface CcLaneSettings {
  enabled: boolean;
  controller: number;
  min: number;
  max: number;
  peakPosition: number;
  curve: CurveType;
}

export interface RunSettings {
  instrumentId: string;
  soundProfile: SoundProfile;
  presetId: string;
  keyRoot: number;
  scaleId: string;
  tempo: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  phraseLength: number;
  phraseLengthUnit: PhraseLengthUnit;
  notationPitchMode: NotationPitchMode;
  dynamicContourMode: DynamicContourMode;
  subdivision: number;
  tuplet: number;
  direction: Direction;
  startNote: number;
  endNote: number;
  lowestNote: number;
  highestNote: number;
  gatePercent: number;
  midiChannel: number;
  programChangeEnabled: boolean;
  programNumber: number;
  velocity: DynamicCurveSettings;
  ccLaneA: CcLaneSettings;
  ccLaneB: CcLaneSettings;
  ccDensityPerBeat: number;
}

export interface NoteEvent {
  pitch: number;
  startTick: number;
  durationTicks: number;
  velocity: number;
  candidateIndex: number;
}

export interface CcEvent {
  tick: number;
  controller: number;
  value: number;
}

export interface GeneratedPhrase {
  settings: RunSettings;
  ppq: number;
  totalTicks: number;
  candidateNotes: number[];
  notes: NoteEvent[];
  ccEvents: CcEvent[];
  summary: {
    noteCount: number;
    minPitch: number;
    maxPitch: number;
    scaleDegreeCount: number;
    rhythmGridCount: number;
    actualSpanSemitones: number;
    correctedStartNote: number;
    correctedEndNote: number;
  };
}

export interface PresetDefinition {
  id: string;
  name: string;
  soundProfile: SoundProfile;
  patch: Partial<RunSettings>;
}
