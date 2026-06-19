import {
  Activity,
  Download,
  FileMusic,
  Gauge,
  Info,
  KeyboardMusic,
  Languages,
  ListMusic,
  Piano,
  Play,
  Route,
  SlidersHorizontal,
  Square,
  Volume2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, PRESETS } from './core/defaults';
import { generatePhrase } from './core/generator';
import { downloadMidi } from './core/midi';
import { getInstrument, gmProgramByteToProgramNumber, INSTRUMENTS, midiNoteName, NOTE_NAMES, SCALES } from './core/music';
import { playPhrase, stopPreview } from './core/preview';
import { type EndpointSelection } from './core/score';
import { PPQ, type CcLaneSettings, type CurveType, type DynamicContourMode, type DynamicCurveSettings, type GeneratedPhrase, type RunSettings } from './core/types';
import { CreditsDialog } from './components/CreditsDialog';
import { ScoreView } from './components/ScoreView';
import appMarkUrl from './assets/icons/app-mark.png';
import bassoonIconUrl from './assets/icons/bassoon.png';
import clarinetIconUrl from './assets/icons/clarinet.png';
import contrabassoonIconUrl from './assets/icons/contrabassoon.png';
import fluteIconUrl from './assets/icons/flute.png';
import oboeIconUrl from './assets/icons/oboe.png';
import piccoloIconUrl from './assets/icons/piccolo.png';
import {
  getInitialLanguage,
  labelCurve,
  labelDirection,
  labelInstrument,
  labelPreset,
  labelScale,
  labelSoundProfile,
  LANGUAGES,
  setStoredLanguage,
  t,
  type Language,
} from './i18n';

const CURVE_IDS: CurveType[] = ['linear', 'ease-in', 'ease-out', 's-curve'];
const PREVIEW_VOLUME_STORAGE_KEY = 'woodwind-preview-volume';
const INSTRUMENT_ICON_URLS: Record<string, string> = {
  piccolo: piccoloIconUrl,
  flute: fluteIconUrl,
  oboe: oboeIconUrl,
  clarinet: clarinetIconUrl,
  bassoon: bassoonIconUrl,
  contrabassoon: contrabassoonIconUrl,
};

function patchSettings(settings: RunSettings, patch: Partial<RunSettings>): RunSettings {
  return {
    ...settings,
    ...patch,
    velocity: patch.velocity ? { ...settings.velocity, ...patch.velocity } : settings.velocity,
    ccLaneA: patch.ccLaneA ? { ...settings.ccLaneA, ...patch.ccLaneA } : settings.ccLaneA,
    ccLaneB: patch.ccLaneB ? { ...settings.ccLaneB, ...patch.ccLaneB } : settings.ccLaneB,
  };
}

function numberValue(value: string): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getInitialPreviewVolume(): number {
  if (typeof window === 'undefined') return 80;

  try {
    const stored = window.localStorage.getItem(PREVIEW_VOLUME_STORAGE_KEY);
    return stored === null ? 80 : clampNumber(numberValue(stored), 0, 100);
  } catch {
    return 80;
  }
}

function setStoredPreviewVolume(volume: number): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_VOLUME_STORAGE_KEY, String(volume));
    }
  } catch {
    // Preview volume still works for the current session when storage is unavailable.
  }
}

function autoDivisionLabel(language: Language, phrase: GeneratedPhrase): string {
  const beats = phrase.totalTicks / phrase.ppq;
  const roundedBeats = Number.isInteger(beats) ? String(beats) : beats.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${phrase.summary.noteCount} / ${roundedBeats} ${t(language, 'beats')}`;
}

function localizedError(language: Language, caught: unknown, fallbackKey: 'generationFailed' | 'previewFailed'): string {
  if (caught instanceof Error && caught.message.includes('No notes are available')) {
    return t(language, 'noAvailableNotes');
  }
  if (caught instanceof Error && caught.message.includes('Ascending runs require')) {
    return t(language, 'ascendingOrderError');
  }
  if (caught instanceof Error && caught.message.includes('Descending runs require')) {
    return t(language, 'descendingOrderError');
  }

  return t(language, fallbackKey);
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const [settings, setSettings] = useState<RunSettings>(DEFAULT_SETTINGS);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(() => getInitialPreviewVolume());
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointSelection>('start');
  const stopTimerRef = useRef<number | null>(null);

  const instrument = useMemo(() => getInstrument(settings.instrumentId), [settings.instrumentId]);
  const generated = useMemo(() => {
    try {
      return { phrase: generatePhrase(settings), error: null as unknown };
    } catch (caught) {
      return { phrase: null, error: caught };
    }
  }, [settings]);
  const phrase = generated.phrase;
  const generationError = generated.error ? localizedError(language, generated.error, 'generationFailed') : null;
  const visibleError = previewError ?? generationError;

  function update<K extends keyof RunSettings>(key: K, value: RunSettings[K]) {
    setPreviewError(null);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
  }

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];
    setPreviewError(null);
    setSettings((current) => patchSettings({ ...current, presetId }, preset.patch));
  }

  function applyInstrument(instrumentId: string) {
    const nextInstrument = getInstrument(instrumentId);
    setPreviewError(null);
    setSettings((current) => ({
      ...current,
      instrumentId,
      startNote: nextInstrument.lowest,
      endNote: Math.min(nextInstrument.highest, nextInstrument.lowest + 24),
      lowestNote: nextInstrument.lowest,
      highestNote: Math.min(nextInstrument.highest, nextInstrument.lowest + 24),
      programNumber: nextInstrument.gmProgram !== undefined
        ? gmProgramByteToProgramNumber(nextInstrument.gmProgram)
        : current.programNumber,
    }));
  }

  function applyScoreSettings(nextSettings: RunSettings) {
    setPreviewError(null);
    setSettings(nextSettings);
  }

  async function play() {
    if (!phrase) return;
    try {
      setIsPlaying(true);
      await playPhrase(phrase, { volume: previewVolume / 100 });
      if (stopTimerRef.current !== null) {
        window.clearTimeout(stopTimerRef.current);
      }
      const durationMs = ((phrase.totalTicks / phrase.ppq) * (60 / phrase.settings.tempo) + 0.75) * 1000;
      stopTimerRef.current = window.setTimeout(() => {
        setIsPlaying(false);
        stopTimerRef.current = null;
      }, durationMs);
    } catch (caught) {
      setPreviewError(localizedError(language, caught, 'previewFailed'));
      setIsPlaying(false);
    }
  }

  function stop() {
    stopPreview();
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setIsPlaying(false);
  }

  function changePreviewVolume(volume: number) {
    const nextVolume = clampNumber(volume, 0, 100);
    setPreviewVolume(nextVolume);
    setStoredPreviewVolume(nextVolume);
  }

  return (
    <main className="app-shell" lang={language}>
      <header className="topbar">
        <div className="brand-lockup">
          <BrandIcon />
          <div>
            <p className="eyebrow">{t(language, 'appEyebrow')}</p>
            <h1>{t(language, 'appTitle')}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <label className="language-field">
            <span>
              <Languages size={13} aria-hidden="true" />
              {t(language, 'language')}
            </span>
            <select value={language} onChange={(event) => changeLanguage(event.target.value as Language)}>
              {LANGUAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="language-field preview-volume-field">
            <span>
              <Volume2 size={13} aria-hidden="true" />
              {t(language, 'previewVolume')}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={previewVolume}
              onChange={(event) => changePreviewVolume(numberValue(event.target.value))}
            />
          </label>
          <button className="button tertiary" type="button" onClick={() => setCreditsOpen(true)}>
            <Info size={16} />
            {t(language, 'credits')}
          </button>
          <button className="button primary" type="button" onClick={isPlaying ? stop : play} disabled={!phrase}>
            {isPlaying ? <Square size={16} /> : <Play size={16} />}
            {isPlaying ? t(language, 'stop') : t(language, 'play')}
          </button>
          <button className="button secondary" type="button" onClick={() => phrase && downloadMidi(phrase)} disabled={!phrase}>
            <Download size={16} />
            {t(language, 'exportMidi')}
          </button>
        </div>
      </header>

      {visibleError ? <div className="error-banner">{visibleError}</div> : null}

      <section className="workspace">
        <section className="panel settings-panel">
          <SectionHeading icon={<KeyboardMusic size={17} />} label={t(language, 'source')} />
          <div className="field-grid">
            <SelectField
              label={t(language, 'instrument')}
              value={settings.instrumentId}
              onChange={applyInstrument}
              options={INSTRUMENTS.map((item) => ({ value: item.id, label: labelInstrument(language, item.id) }))}
            />
            <SelectField
              label={t(language, 'soundProfile')}
              value={settings.soundProfile}
              onChange={(value) => update('soundProfile', value as RunSettings['soundProfile'])}
              options={(['general-midi', 'bbcso-pro', 'custom'] as const).map((id) => ({
                value: id,
                label: labelSoundProfile(language, id),
              }))}
            />
            <SelectField
              label={t(language, 'preset')}
              value={settings.presetId}
              onChange={applyPreset}
              options={PRESETS.map((item) => ({ value: item.id, label: labelPreset(language, item.id) }))}
            />
            <SelectField
              label={t(language, 'key')}
              value={String(settings.keyRoot)}
              onChange={(value) => update('keyRoot', numberValue(value))}
              options={NOTE_NAMES.map((name, index) => ({ value: String(index), label: name }))}
            />
            <SelectField
              label={t(language, 'modeScale')}
              value={settings.scaleId}
              onChange={(value) => update('scaleId', value)}
              options={SCALES.map((scale) => ({ value: scale.id, label: labelScale(language, scale.id) }))}
            />
          </div>

          <SectionHeading icon={<Gauge size={17} />} label={t(language, 'phrase')} />
          <div className="field-grid">
            <SliderNumberField label={t(language, 'tempo')} value={settings.tempo} min={20} max={300} onChange={(value) => update('tempo', value)} />
            <NumberField label={t(language, 'beatsBar')} value={settings.timeSignatureNumerator} min={1} max={16} onChange={(value) => update('timeSignatureNumerator', value)} />
            <SelectField
              label={t(language, 'beatUnit')}
              value={String(settings.timeSignatureDenominator)}
              onChange={(value) => update('timeSignatureDenominator', numberValue(value))}
              options={[2, 4, 8, 16].map((value) => ({ value: String(value), label: `${value}` }))}
            />
            <SliderNumberField label={t(language, 'length')} value={settings.phraseLength} min={0.25} max={64} step={0.25} onChange={(value) => update('phraseLength', value)} />
            <SelectField
              label={t(language, 'lengthUnit')}
              value={settings.phraseLengthUnit}
              onChange={(value) => update('phraseLengthUnit', value as RunSettings['phraseLengthUnit'])}
              options={[
                { value: 'bars', label: t(language, 'bars') },
                { value: 'beats', label: t(language, 'beats') },
              ]}
            />
            <SelectField
              label={t(language, 'runDirection')}
              value={settings.direction}
              onChange={(value) => update('direction', value as RunSettings['direction'])}
              options={(['ascending', 'descending', 'up-down', 'down-up'] as const).map((id) => ({
                value: id,
                label: labelDirection(language, id),
              }))}
            />
            <SelectField
              label={t(language, 'dynamicContour')}
              value={settings.dynamicContourMode}
              onChange={(value) => update('dynamicContourMode', value as DynamicContourMode)}
              options={[
                { value: 'natural', label: t(language, 'naturalContour') },
                { value: 'inverted', label: t(language, 'invertedContour') },
              ]}
            />
          </div>

          <SectionHeading icon={<Route size={17} />} label={t(language, 'rangeAndMidi')} />
          <div className="field-grid">
            <NoteSliderField label={t(language, 'startNote')} value={settings.startNote} min={instrument.lowest} max={instrument.highest} onChange={(value) => update('startNote', value)} />
            <NoteSliderField label={t(language, 'endNote')} value={settings.endNote} min={instrument.lowest} max={instrument.highest} onChange={(value) => update('endNote', value)} />
          </div>

          <details className="settings-details">
            <summary>
              <Volume2 size={16} aria-hidden="true" />
              {t(language, 'dynamics')}
            </summary>
            <div className="details-body">
              <DynamicEditor language={language} value={settings.velocity} onChange={(velocity) => update('velocity', velocity)} />
              <CcLaneEditor language={language} title={t(language, 'ccLaneA')} value={settings.ccLaneA} onChange={(ccLaneA) => update('ccLaneA', ccLaneA)} />
              <CcLaneEditor language={language} title={t(language, 'ccLaneB')} value={settings.ccLaneB} onChange={(ccLaneB) => update('ccLaneB', ccLaneB)} />
              <NumberField label={t(language, 'ccDensityBeat')} value={settings.ccDensityPerBeat} min={1} max={16} onChange={(value) => update('ccDensityPerBeat', value)} />
            </div>
          </details>

          <details className="settings-details">
            <summary>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t(language, 'advancedMidi')}
            </summary>
            <div className="details-body">
              <div className="field-grid">
                <NumberField label={t(language, 'gatePercent')} value={settings.gatePercent} min={1} max={150} onChange={(value) => update('gatePercent', value)} />
                <NumberField label={t(language, 'midiChannel')} value={settings.midiChannel} min={1} max={16} onChange={(value) => update('midiChannel', value)} />
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={settings.programChangeEnabled}
                    onChange={(event) => update('programChangeEnabled', event.target.checked)}
                  />
                  {t(language, 'programChange')}
                </label>
                <NumberField label={t(language, 'program')} value={settings.programNumber} min={1} max={128} onChange={(value) => update('programNumber', value)} />
              </div>
            </div>
          </details>
        </section>

        <section className="panel result-panel">
          <SectionHeading icon={<FileMusic size={17} />} label={t(language, 'generatedPhrase')} />
          {phrase ? (
            <>
              <div className="summary-grid">
                <Metric label={t(language, 'scaleNotes')} value={String(phrase.summary.noteCount)} />
                <Metric label={t(language, 'autoDivision')} value={autoDivisionLabel(language, phrase)} />
                <Metric label={t(language, 'correctedStart')} value={midiNoteName(phrase.summary.correctedStartNote)} />
                <Metric label={t(language, 'correctedEnd')} value={midiNoteName(phrase.summary.correctedEndNote)} />
                <Metric label={t(language, 'actualSpan')} value={`${midiNoteName(phrase.summary.minPitch)} - ${midiNoteName(phrase.summary.maxPitch)}`} />
                <Metric label={t(language, 'ticks')} value={String(phrase.totalTicks)} />
              </div>

              <ViewHeading icon={<ListMusic size={16} />} label={t(language, 'notation')} />
              <ScoreView
                language={language}
                phrase={phrase}
                settings={phrase.settings}
                selectedEndpoint={selectedEndpoint}
                onSelectEndpoint={setSelectedEndpoint}
                onSettingsChange={applyScoreSettings}
              />

              <ViewHeading icon={<Piano size={16} />} label={t(language, 'pianoRoll')} />
              <div className="piano-roll" aria-label={t(language, 'generatedNotePreview')}>
                {phrase.notes.map((note, index) => {
                  const left = `${(note.startTick / phrase.totalTicks) * 100}%`;
                  const width = `${Math.max(0.8, (note.durationTicks / phrase.totalTicks) * 100)}%`;
                  const pitchSpan = Math.max(1, phrase.summary.maxPitch - phrase.summary.minPitch);
                  const bottom = `${((note.pitch - phrase.summary.minPitch) / pitchSpan) * 88}%`;
                  return (
                    <span
                      className="note-block"
                      key={`${note.startTick}-${note.pitch}-${index}`}
                      style={{ left, width, bottom, opacity: 0.35 + (note.velocity / 127) * 0.65 }}
                      title={`${midiNoteName(note.pitch)} ${t(language, 'velocityShort')} ${note.velocity}`}
                    />
                  );
                })}
              </div>

              <div className="note-list">
                {phrase.notes.slice(0, 48).map((note, index) => (
                  <div className="note-row" key={`${note.startTick}-${note.pitch}-${index}`}>
                    <span>{index + 1}</span>
                    <strong>{midiNoteName(note.pitch)}</strong>
                    <span>{note.startTick}t</span>
                    <span>{note.durationTicks}t</span>
                    <span>v{note.velocity}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-result">{t(language, 'noGeneratedPhrase')}</div>
          )}
        </section>
      </section>

      <footer className="statusbar">
        <span className="statusbar-inner">
          <span className="status-item status-instrument">
            <InstrumentIcon instrumentId={instrument.id} label={labelInstrument(language, instrument.id)} />
            <span>{labelInstrument(language, instrument.id)}</span>
          </span>
          <span className="status-item">
            <Activity size={14} aria-hidden="true" />
            {t(language, 'realPitchMidiOutput')}
          </span>
          <span className="status-item">PPQ {PPQ}</span>
          <span className="status-item">SMF Type 1</span>
          <span className="status-item release-status">{t(language, 'releaseLabel')}</span>
        </span>
      </footer>
      <CreditsDialog language={language} open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </main>
  );
}

function BrandIcon() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img className="brand-image" src={appMarkUrl} alt="" />
    </span>
  );
}

function InstrumentIcon({ instrumentId, label }: { instrumentId: string; label: string }) {
  return <img className="instrument-status-icon" src={INSTRUMENT_ICON_URLS[instrumentId] ?? fluteIconUrl} alt="" aria-hidden="true" title={label} />;
}

function SectionHeading({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <h2 className="section-heading">
      <span className="heading-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </h2>
  );
}

function ViewHeading({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <h3 className="view-heading">
      <span className="heading-icon small" aria-hidden="true">
        {icon}
      </span>
      {label}
    </h3>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(clampNumber(numberValue(event.target.value), min, max))}
      />
    </label>
  );
}

function SliderNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueText?: string;
}) {
  const safeValue = clampNumber(value, min, max);
  const applyValue = (next: string) => onChange(clampNumber(numberValue(next), min, max));

  return (
    <label className="field slider-field">
      <span>{label}</span>
      <div className="slider-value-row">
        <input
          type="range"
          value={safeValue}
          min={min}
          max={max}
          step={step}
          onChange={(event) => applyValue(event.target.value)}
        />
        <input
          className="slider-number"
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => applyValue(event.target.value)}
        />
        {valueText ? <em>{valueText}</em> : null}
      </div>
    </label>
  );
}

function NoteSliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <SliderNumberField
      label={label}
      value={value}
      min={min}
      max={max}
      onChange={(next) => onChange(Math.round(next))}
      valueText={midiNoteName(value)}
    />
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function DynamicEditor({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: DynamicCurveSettings;
  onChange: (value: DynamicCurveSettings) => void;
}) {
  return (
    <div className="subpanel">
      <h3>{t(language, 'velocity')}</h3>
      <div className="field-grid compact">
        <NumberField label={t(language, 'min')} value={value.min} min={1} max={127} onChange={(min) => onChange({ ...value, min })} />
        <NumberField label={t(language, 'max')} value={value.max} min={1} max={127} onChange={(max) => onChange({ ...value, max })} />
        <SelectField
          label={t(language, 'curve')}
          value={value.curve}
          onChange={(curve) => onChange({ ...value, curve: curve as CurveType })}
          options={CURVE_IDS.map((curve) => ({ value: curve, label: labelCurve(language, curve) }))}
        />
      </div>
    </div>
  );
}

function CcLaneEditor({
  language,
  title,
  value,
  onChange,
}: {
  language: Language;
  title: string;
  value: CcLaneSettings;
  onChange: (value: CcLaneSettings) => void;
}) {
  return (
    <div className="subpanel">
      <div className="subpanel-heading">
        <h3>{title}</h3>
        <label className="check-field inline">
          <input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />
          {t(language, 'enabled')}
        </label>
      </div>
      <div className="field-grid compact">
        <NumberField label={t(language, 'cc')} value={value.controller} min={0} max={127} onChange={(controller) => onChange({ ...value, controller })} />
        <NumberField label={t(language, 'min')} value={value.min} min={0} max={127} onChange={(min) => onChange({ ...value, min })} />
        <NumberField label={t(language, 'max')} value={value.max} min={0} max={127} onChange={(max) => onChange({ ...value, max })} />
        <SelectField
          label={t(language, 'curve')}
          value={value.curve}
          onChange={(curve) => onChange({ ...value, curve: curve as CurveType })}
          options={CURVE_IDS.map((curve) => ({ value: curve, label: labelCurve(language, curve) }))}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
