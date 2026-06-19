import { getInstrument } from './music';
import type { GeneratedPhrase, RunSettings } from './types';

interface MidiEvent {
  tick: number;
  order: number;
  bytes: number[];
}

function textBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function uint16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function vlq(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes = [];

  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  for (;;) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }

  return bytes;
}

function metaEvent(type: number, payload: number[]): number[] {
  return [0xff, type, ...vlq(payload.length), ...payload];
}

function trackName(name: string): MidiEvent {
  return { tick: 0, order: 0, bytes: metaEvent(0x03, textBytes(name)) };
}

function instrumentName(name: string): MidiEvent {
  return { tick: 0, order: 0, bytes: metaEvent(0x04, textBytes(name)) };
}

function tempoEvent(bpm: number): MidiEvent {
  const microsecondsPerQuarter = Math.round(60_000_000 / bpm);
  return {
    tick: 0,
    order: 1,
    bytes: metaEvent(0x51, [
      (microsecondsPerQuarter >> 16) & 0xff,
      (microsecondsPerQuarter >> 8) & 0xff,
      microsecondsPerQuarter & 0xff,
    ]),
  };
}

function denominatorPower(denominator: number): number {
  return Math.max(0, Math.round(Math.log2(denominator)));
}

function timeSignatureEvent(settings: RunSettings): MidiEvent {
  return {
    tick: 0,
    order: 2,
    bytes: metaEvent(0x58, [
      settings.timeSignatureNumerator & 0xff,
      denominatorPower(settings.timeSignatureDenominator) & 0xff,
      24,
      8,
    ]),
  };
}

function endOfTrack(tick: number): MidiEvent {
  return { tick, order: 99, bytes: metaEvent(0x2f, []) };
}

function buildTrack(events: MidiEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data: number[] = [];
  let previousTick = 0;

  for (const event of sorted) {
    const delta = Math.max(0, event.tick - previousTick);
    data.push(...vlq(delta), ...event.bytes);
    previousTick = event.tick;
  }

  return [...textBytes('MTrk'), ...uint32(data.length), ...data];
}

export function writeMidiFile(phrase: GeneratedPhrase): Uint8Array {
  const { settings } = phrase;
  const instrument = getInstrument(settings.instrumentId);
  const channel = Math.min(15, Math.max(0, settings.midiChannel - 1));
  const track0 = buildTrack([
    trackName('Woodwind Run Phrase'),
    tempoEvent(settings.tempo),
    timeSignatureEvent(settings),
    endOfTrack(0),
  ]);
  const track1Events: MidiEvent[] = [
    instrumentName(instrument.name),
  ];

  if (settings.programChangeEnabled) {
    track1Events.push({
      tick: 0,
      order: 1,
      bytes: [0xc0 | channel, Math.min(127, Math.max(0, settings.programNumber - 1))],
    });
  }

  for (const event of phrase.ccEvents) {
    track1Events.push({
      tick: event.tick,
      order: 2,
      bytes: [0xb0 | channel, event.controller & 0x7f, event.value & 0x7f],
    });
  }

  for (const note of phrase.notes) {
    track1Events.push({
      tick: note.startTick,
      order: 4,
      bytes: [0x90 | channel, note.pitch & 0x7f, note.velocity & 0x7f],
    });
    track1Events.push({
      tick: note.startTick + note.durationTicks,
      order: 3,
      bytes: [0x80 | channel, note.pitch & 0x7f, 0],
    });
  }

  const latestNoteOff = phrase.notes.reduce(
    (latest, note) => Math.max(latest, note.startTick + note.durationTicks),
    phrase.totalTicks,
  );
  track1Events.push(endOfTrack(latestNoteOff));

  const track1 = buildTrack(track1Events);
  const header = [
    ...textBytes('MThd'),
    ...uint32(6),
    ...uint16(1),
    ...uint16(2),
    ...uint16(phrase.ppq),
  ];

  return new Uint8Array([...header, ...track0, ...track1]);
}

export function downloadMidi(phrase: GeneratedPhrase): void {
  const bytes = writeMidiFile(phrase);
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'woodwind-scale-run.mid';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
