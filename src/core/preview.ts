import * as Tone from 'tone';
import { PPQ, type GeneratedPhrase } from './types';

let synth: Tone.PolySynth | null = null;

interface PreviewOptions {
  volume?: number;
}

function ensureSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005,
        decay: 0.08,
        sustain: 0.45,
        release: 0.12,
      },
    }).toDestination();
  }
  return synth;
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
  const player = ensureSynth();
  const previewVolume = Math.min(1, Math.max(0, options.volume ?? 0.8));

  stopPreview();
  Tone.Transport.bpm.value = phrase.settings.tempo;

  for (const note of phrase.notes) {
    const startSeconds = (note.startTick / PPQ) * (60 / phrase.settings.tempo);
    const durationSeconds = Math.max(0.02, (note.durationTicks / PPQ) * (60 / phrase.settings.tempo));
    const velocity = Math.min(1, Math.max(0.001, (note.velocity / 127) * ccFactorAtTick(phrase, note.startTick) * previewVolume));
    const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency();

    Tone.Transport.scheduleOnce((time) => {
      player.triggerAttackRelease(frequency, durationSeconds, time, velocity);
    }, startSeconds);
  }

  const endSeconds = ((phrase.totalTicks + PPQ / 2) / PPQ) * (60 / phrase.settings.tempo);
  Tone.Transport.scheduleOnce(() => {
    stopPreview();
  }, endSeconds);

  Tone.Transport.start();
}

export function stopPreview(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  synth?.releaseAll();
}
