import type { CurveType, Direction, SoundProfile } from './core/types';

export type Language = 'en' | 'ja';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

export const STORAGE_KEY = 'woodwind-run-language';

const en = {
  appEyebrow: 'Scale run MIDI builder',
  appTitle: 'Woodwind Scale Run Generator',
  releaseLabel: 'v1.0',
  play: 'Play',
  stop: 'Stop',
  exportMidi: 'Export MIDI',
  language: 'Language',
  source: 'Source',
  instrument: 'Instrument',
  soundProfile: 'Sound profile',
  preset: 'Preset',
  key: 'Key',
  modeScale: 'Mode / scale',
  phrase: 'Scale run',
  tempo: 'Tempo',
  beatsBar: 'Beats/bar',
  beatUnit: 'Beat unit',
  length: 'Length',
  lengthUnit: 'Length unit',
  direction: 'Direction',
  runDirection: 'Run direction',
  rangeAndMidi: 'Run endpoints',
  startNote: 'Start note',
  endNote: 'End note',
  gatePercent: 'Gate %',
  midiChannel: 'MIDI channel',
  programChange: 'Program Change',
  program: 'Program',
  dynamics: 'Dynamics',
  dynamicContour: 'Dynamic contour',
  naturalContour: 'Natural',
  invertedContour: 'Inverted',
  previewVolume: 'Preview volume',
  velocity: 'Velocity',
  min: 'Min',
  max: 'Max',
  curve: 'Curve',
  ccLaneA: 'CC Lane A',
  ccLaneB: 'CC Lane B',
  enabled: 'Enabled',
  cc: 'CC',
  ccDensityBeat: 'CC density / beat',
  generatedPhrase: 'Generated Scale Run',
  notation: 'Notation',
  notationPitch: 'Notation pitch',
  written: 'Written',
  concert: 'Concert',
  pianoRoll: 'Piano Roll',
  selectedEndpoint: 'Selected endpoint',
  moveUp: 'Move up',
  moveDown: 'Move down',
  startEndpoint: 'Start endpoint',
  endEndpoint: 'End endpoint',
  ticks: 'Ticks',
  scaleNotes: 'Scale notes',
  autoDivision: 'Auto division',
  actualSpan: 'Actual span',
  correctedStart: 'Corrected start',
  correctedEnd: 'Corrected end',
  generatedNotePreview: 'Generated note preview',
  velocityShort: 'velocity',
  realPitchMidiOutput: 'Real pitch MIDI output',
  generationFailed: 'Generation failed.',
  previewFailed: 'Preview failed.',
  noGeneratedPhrase: 'Adjust the start/end notes or direction to generate a scale run.',
  advancedMidi: 'Advanced MIDI',
  noAvailableNotes: 'No notes are available in the selected key, scale, and range.',
  ascendingOrderError: 'Ascending runs require the start note to be below the end note after scale correction.',
  descendingOrderError: 'Descending runs require the start note to be above the end note after scale correction.',
  bars: 'Bars',
  beats: 'Beats',
  generalMidi: 'General MIDI',
  bbcsoPro: 'BBCSO Pro',
  custom: 'Custom',
  customPreset: 'Custom',
  ascending: 'Ascending',
  descending: 'Descending',
  upDown: 'Ascending to descending',
  downUp: 'Descending to ascending',
  strict: 'Strict',
  natural: 'Natural',
  linear: 'Linear',
  easeIn: 'Ease In',
  easeOut: 'Ease Out',
  sCurve: 'S-Curve',
  piccolo: 'Piccolo',
  flute: 'Flute',
  oboe: 'Oboe',
  clarinet: 'Clarinet',
  bassoon: 'Bassoon',
  contrabassoon: 'Contrabassoon',
  major: 'Major',
  naturalMinor: 'Natural Minor',
  harmonicMinor: 'Harmonic Minor',
  melodicMinor: 'Melodic Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  chromatic: 'Chromatic',
  neutral: 'Neutral',
  bbcsoShortRun: 'BBCSO Short Run',
  bbcsoLegatoFastRun: 'BBCSO Legato/Fast Run',
  credits: 'Credits',
  closeCredits: 'Close credits',
  creditsEyebrow: 'Woodwind Scale Run Generator',
  creditsDescription: 'Creative direction and authorship credit for this browser-based MIDI production tool.',
  createdBy: 'Created by',
  officialWebsite: 'Official website',
} as const;

export type TranslationKey = keyof typeof en;

const ja: Record<TranslationKey, string> = {
  appEyebrow: 'スケールランMIDI作成',
  appTitle: '木管スケールラン生成',
  releaseLabel: 'v1.0',
  play: '再生',
  stop: '停止',
  exportMidi: 'MIDI書き出し',
  language: '表示言語',
  source: '音源/素材',
  instrument: '楽器',
  soundProfile: '音源プロファイル',
  preset: 'プリセット',
  key: '調',
  modeScale: 'モード/スケール',
  phrase: 'スケールラン',
  tempo: 'テンポ',
  beatsBar: '拍/小節',
  beatUnit: '拍の単位',
  length: '長さ',
  lengthUnit: '長さの単位',
  direction: '方向',
  runDirection: 'ラン方向',
  rangeAndMidi: '開始/終了音',
  startNote: '開始音',
  endNote: '終了音',
  gatePercent: 'Gate %',
  midiChannel: 'MIDIチャンネル',
  programChange: 'Program Change',
  program: 'プログラム',
  dynamics: 'ダイナミクス',
  dynamicContour: 'ダイナミクス輪郭',
  naturalContour: '自然',
  invertedContour: '反転',
  previewVolume: 'プレビュー音量',
  velocity: 'Velocity',
  min: '最小',
  max: '最大',
  curve: 'カーブ',
  ccLaneA: 'CC Lane A',
  ccLaneB: 'CC Lane B',
  enabled: '有効',
  cc: 'CC',
  ccDensityBeat: 'CC密度/拍',
  generatedPhrase: '生成結果',
  notation: '譜面',
  notationPitch: '譜面ピッチ',
  written: '移調譜',
  concert: '実音',
  pianoRoll: 'ピアノロール',
  selectedEndpoint: '選択中の端点',
  moveUp: '上へ移動',
  moveDown: '下へ移動',
  startEndpoint: '開始端点',
  endEndpoint: '終了端点',
  ticks: 'Tick数',
  scaleNotes: 'スケール音数',
  autoDivision: '自動分割',
  actualSpan: '実使用音域',
  correctedStart: '補正後開始音',
  correctedEnd: '補正後終了音',
  generatedNotePreview: '生成ノートのプレビュー',
  velocityShort: 'velocity',
  realPitchMidiOutput: '実音MIDI出力',
  generationFailed: '生成に失敗しました。',
  previewFailed: 'プレビューに失敗しました。',
  noGeneratedPhrase: '開始音/終了音またはラン方向を調整してください。',
  advancedMidi: '詳細MIDI',
  noAvailableNotes: '選択した調、スケール、音域に使用可能な音がありません。',
  ascendingOrderError: '上行ランでは、スケール補正後の開始音が終了音より低い必要があります。',
  descendingOrderError: '下行ランでは、スケール補正後の開始音が終了音より高い必要があります。',
  bars: '小節',
  beats: '拍',
  generalMidi: 'General MIDI',
  bbcsoPro: 'BBCSO Pro',
  custom: 'Custom',
  customPreset: 'カスタム',
  ascending: '上行',
  descending: '下行',
  upDown: '上行から下行',
  downUp: '下行から上行',
  strict: '厳密',
  natural: '自然',
  linear: 'Linear',
  easeIn: 'Ease In',
  easeOut: 'Ease Out',
  sCurve: 'S-Curve',
  piccolo: 'ピッコロ',
  flute: 'フルート',
  oboe: 'オーボエ',
  clarinet: 'クラリネット',
  bassoon: 'ファゴット',
  contrabassoon: 'コントラファゴット',
  major: 'メジャー',
  naturalMinor: 'ナチュラルマイナー',
  harmonicMinor: 'ハーモニックマイナー',
  melodicMinor: 'メロディックマイナー',
  dorian: 'ドリアン',
  phrygian: 'フリジアン',
  lydian: 'リディアン',
  mixolydian: 'ミクソリディアン',
  locrian: 'ロクリアン',
  chromatic: 'クロマチック',
  neutral: 'ニュートラル',
  bbcsoShortRun: 'BBCSO Short Run',
  bbcsoLegatoFastRun: 'BBCSO Legato/Fast Run',
  credits: 'クレジット',
  closeCredits: 'クレジットを閉じる',
  creditsEyebrow: 'Woodwind Scale Run Generator',
  creditsDescription: 'このブラウザベースMIDI制作ツールの制作クレジットです。',
  createdBy: '制作',
  officialWebsite: '公式サイト',
};

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  ja,
};

export function t(language: Language, key: TranslationKey): string {
  return translations[language][key];
}

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'en' || value === 'ja';
}

export function resolveInitialLanguage(stored: string | null | undefined, _browserLanguage: string | null | undefined): Language {
  if (isLanguage(stored)) {
    return stored;
  }

  return 'en';
}

export function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }

  return resolveInitialLanguage(readStoredLanguage(), window.navigator.language);
}

export function setStoredLanguage(language: Language): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  } catch {
    // Language selection still works for the current session when storage is unavailable.
  }
}

function readStoredLanguage(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(STORAGE_KEY);
    }
  } catch {
    return null;
  }

  return null;
}

export function labelInstrument(language: Language, id: string): string {
  return labelFromMap(language, id, {
    piccolo: 'piccolo',
    flute: 'flute',
    oboe: 'oboe',
    clarinet: 'clarinet',
    bassoon: 'bassoon',
    contrabassoon: 'contrabassoon',
  });
}

export function labelScale(language: Language, id: string): string {
  return labelFromMap(language, id, {
    major: 'major',
    'natural-minor': 'naturalMinor',
    'harmonic-minor': 'harmonicMinor',
    'melodic-minor': 'melodicMinor',
    dorian: 'dorian',
    phrygian: 'phrygian',
    lydian: 'lydian',
    mixolydian: 'mixolydian',
    locrian: 'locrian',
    chromatic: 'chromatic',
  });
}

export function labelPreset(language: Language, id: string): string {
  return labelFromMap(language, id, {
    neutral: 'neutral',
    'bbcso-short-run': 'bbcsoShortRun',
    'bbcso-legato-fast-run': 'bbcsoLegatoFastRun',
  });
}

export function labelSoundProfile(language: Language, id: SoundProfile): string {
  return labelFromMap(language, id, {
    'general-midi': 'generalMidi',
    'bbcso-pro': 'bbcsoPro',
    custom: 'custom',
  });
}

export function labelDirection(language: Language, id: Direction): string {
  return labelFromMap(language, id, {
    ascending: 'ascending',
    descending: 'descending',
    'up-down': 'upDown',
    'down-up': 'downUp',
  });
}

export function labelCurve(language: Language, id: CurveType): string {
  return labelFromMap(language, id, {
    linear: 'linear',
    'ease-in': 'easeIn',
    'ease-out': 'easeOut',
    's-curve': 'sCurve',
  });
}

function labelFromMap(language: Language, id: string, map: Record<string, TranslationKey>): string {
  const key = map[id];
  return key ? t(language, key) : id;
}
