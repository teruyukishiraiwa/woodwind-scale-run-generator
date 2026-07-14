import * as Tone from 'tone';
import { SAMPLE_NOTES } from './sampleManifest';
import { PPQ, type GeneratedPhrase } from './types';

interface PreviewOptions {
  volume?: number;
}

interface SamplerEntry {
  sampler: Tone.Sampler;
  loaded: Promise<void>;
}

const samplers = new Map<string, SamplerEntry>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sampleBaseUrl(instrumentId: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}samples/${instrumentId}/`;
}

function getSamplerEntry(instrumentId: string): SamplerEntry {
  const existing = samplers.get(instrumentId);
  if (existing) return existing;

  const notes = SAMPLE_NOTES[instrumentId] ?? SAMPLE_NOTES.flute;
  const urls = Object.fromEntries(notes.map((note) => [note, `${note}.mp3`]));

  let markLoaded: () => void = () => {};
  const loaded = new Promise<void>((resolve) => {
    markLoaded = resolve;
  });

  const sampler = new Tone.Sampler({
    urls,
    baseUrl: sampleBaseUrl(instrumentId),
    attack: 0.006,
    release: 0.3,
    onload: () => markLoaded(),
  }).toDestination();

  const entry: SamplerEntry = { sampler, loaded };
  samplers.set(instrumentId, entry);
  return entry;
}

/** Warm up an instrument's samples so the first Play has no load delay. */
export function preloadInstrument(instrumentId: string): void {
  getSamplerEntry(instrumentId);
}

function ccFactorAtTick(phrase: GeneratedPhrase, tick: number): number {
  const activeControllers = new Set(phrase.ccEvents.map((event) => event.controller));
  if (activeControllers.size === 0) return 1;

  const values = Array.from(activeControllers).map((controller) => {
    let value = 96;
    for (const event of phrase.ccEvents) {
      if (event.controller === controller && event.tick <= tick) {
        value = event.value;
      }
    }
    return value / 127;
  });

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0.18, Math.min(1, average));
}

export async function playPhrase(phrase: GeneratedPhrase, options: PreviewOptions = {}): Promise<void> {
  await Tone.start();
  const entry = getSamplerEntry(phrase.settings.instrumentId);
  await entry.loaded;

  const previewVolume = clamp(options.volume ?? 0.8, 0, 1);
  stopPreview();

  const transport = Tone.getTransport();
  transport.bpm.value = phrase.settings.tempo;

  for (const note of phrase.notes) {
    const startSeconds = (note.startTick / PPQ) * (60 / phrase.settings.tempo);
    const durationSeconds = Math.max(0.05, (note.durationTicks / PPQ) * (60 / phrase.settings.tempo));
    const velocity = clamp((note.velocity / 127) * ccFactorAtTick(phrase, note.startTick) * previewVolume, 0.001, 1);
    const frequency = Tone.Frequency(note.pitch, 'midi').toNote();

    transport.scheduleOnce((time) => {
      entry.sampler.triggerAttackRelease(frequency, durationSeconds, time, velocity);
    }, startSeconds);
  }

  const endSeconds = ((phrase.totalTicks + PPQ) / PPQ) * (60 / phrase.settings.tempo);
  transport.scheduleOnce(() => {
    stopPreview();
  }, endSeconds);

  transport.start();
}

export function stopPreview(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  for (const { sampler } of samplers.values()) {
    sampler.releaseAll();
  }
}
