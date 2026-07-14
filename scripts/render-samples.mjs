// Renders real woodwind preview samples from the FluidR3 GM soundfont (MIT,
// Frank Wen) using a local portable FluidSynth, then encodes trimmed mono MP3s
// into public/samples/<instrument>/ and writes src/core/sampleManifest.ts.
//
// One-time/dev tooling. Run: node scripts/render-samples.mjs [--test]
// Requires the local toolchain under tools/ (see README "Preview samples").

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import wavefilePkg from 'wavefile';
import lamejsPkg from '@breezystack/lamejs';

const { WaveFile } = wavefilePkg;
const lamejs = lamejsPkg.Mp3Encoder ? lamejsPkg : lamejsPkg.default ?? lamejsPkg;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLUIDSYNTH = resolve(
  ROOT,
  'tools/fluidsynth/fluidsynth-v2.5.5-win10-x64-cpp11/bin/fluidsynth.exe',
);
const SOUNDFONT = resolve(ROOT, 'tools/FluidR3_GM_GS.sf2');
const TMP = resolve(ROOT, 'tools/tmp');
const OUT_DIR = resolve(ROOT, 'public/samples');
const MANIFEST = resolve(ROOT, 'src/core/sampleManifest.ts');

// GM melodic program byte (0-based) + practical range, mirrored from src/core/music.ts.
// Contrabassoon has no dedicated GM voice, so it reuses the Bassoon patch (70)
// rendered down in its own low range.
const INSTRUMENTS = [
  { id: 'piccolo', program: 72, lowest: 74, highest: 108 },
  { id: 'flute', program: 73, lowest: 60, highest: 98 },
  { id: 'oboe', program: 68, lowest: 58, highest: 93 },
  { id: 'clarinet', program: 71, lowest: 52, highest: 96 },
  { id: 'bassoon', program: 70, lowest: 34, highest: 76 },
  { id: 'contrabassoon', program: 70, lowest: 22, highest: 58 },
];

const STEP = 3; // semitones between sampled notes (minor third)
const PPQ = 480;
const SOUND_TICKS = 1536; // 1.6s at 120bpm
const TAIL_TICKS = 960; // 1.0s release/decay capture
const RENDER_VELOCITY = 100;
const MP3_KBPS = 96;
const TRIM_THRESHOLD = 0.012; // fraction of full scale

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function noteName(midi) {
  return `${FLAT_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function sampledNotes(inst) {
  const notes = [];
  for (let m = inst.lowest; m <= inst.highest; m += STEP) notes.push(m);
  if (notes[notes.length - 1] !== inst.highest) notes.push(inst.highest);
  return notes;
}

function vlq(value) {
  const bytes = [value & 0x7f];
  let v = Math.floor(value / 128);
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  return bytes;
}

function buildSmf(program, pitch) {
  const track = [
    ...vlq(0), 0xc0, program & 0x7f,
    ...vlq(0), 0x90, pitch & 0x7f, RENDER_VELOCITY,
    ...vlq(SOUND_TICKS), 0x80, pitch & 0x7f, 0,
    ...vlq(TAIL_TICKS), 0xff, 0x2f, 0x00,
  ];
  const len = track.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];
  return Buffer.from([...header, ...trackHeader, ...track]);
}

function renderWav(midPath, wavPath) {
  execFileSync(
    FLUIDSYNTH,
    ['-ni', '-q', '-R', '0', '-C', '0', '-g', '0.7', '-T', 'wav', '-F', wavPath, '-r', '44100', SOUNDFONT, midPath],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

function toMonoInt16(wavBuf) {
  const wav = new WaveFile(wavBuf);
  wav.toBitDepth('16');
  const sampleRate = wav.fmt.sampleRate;
  const channels = wav.fmt.numChannels;
  const samples = wav.getSamples(false, Int16Array);
  if (channels === 1) return { sampleRate, data: samples };
  const left = samples[0];
  const right = samples[1];
  const mono = new Int16Array(left.length);
  for (let i = 0; i < left.length; i += 1) mono[i] = (left[i] + right[i]) >> 1;
  return { sampleRate, data: mono };
}

function trim(data) {
  const threshold = TRIM_THRESHOLD * 32768;
  let start = 0;
  while (start < data.length && Math.abs(data[start]) < threshold) start += 1;
  let end = data.length - 1;
  while (end > start && Math.abs(data[end]) < threshold) end -= 1;
  start = Math.max(0, start - 96); // tiny pre-roll so the attack is intact
  end = Math.min(data.length - 1, end + 480); // keep a short natural tail
  return data.subarray(start, end + 1);
}

function normalize(data, targetPeak = 0.72) {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
  }
  if (peak === 0) return data;
  // Cap the boost so near-silent tails don't lift the noise floor too far.
  const gain = Math.min(8, (targetPeak * 32767) / peak);
  if (gain <= 1.01) return data;
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * gain)));
  }
  return out;
}

// Guarantee both ends sit at a zero crossing so successive notes don't click.
function applyFades(data, sampleRate, fadeInMs = 5, fadeOutMs = 32) {
  const fadeIn = Math.min(data.length, Math.round((sampleRate * fadeInMs) / 1000));
  const fadeOut = Math.min(data.length, Math.round((sampleRate * fadeOutMs) / 1000));
  for (let i = 0; i < fadeIn; i += 1) {
    data[i] = Math.round(data[i] * (i / fadeIn));
  }
  for (let i = 0; i < fadeOut; i += 1) {
    const idx = data.length - 1 - i;
    data[idx] = Math.round(data[idx] * (i / fadeOut));
  }
  return data;
}

function encodeMp3(data, sampleRate) {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunks = [];
  const block = 1152;
  for (let i = 0; i < data.length; i += block) {
    const slice = data.subarray(i, i + block);
    const buf = encoder.encodeBuffer(slice);
    if (buf.length > 0) chunks.push(Buffer.from(buf));
  }
  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(Buffer.from(flush));
  return Buffer.concat(chunks);
}

function main() {
  const testOnly = process.argv.includes('--test');
  mkdirSync(TMP, { recursive: true });
  const manifest = {};
  let total = 0;
  let bytes = 0;

  const instruments = testOnly ? [{ id: 'flute', program: 73, lowest: 69, highest: 69 }] : INSTRUMENTS;

  for (const inst of instruments) {
    const dir = resolve(OUT_DIR, inst.id);
    mkdirSync(dir, { recursive: true });
    const notes = sampledNotes(inst);
    manifest[inst.id] = notes.map(noteName);

    for (const pitch of notes) {
      const name = noteName(pitch);
      const midPath = resolve(TMP, 'note.mid');
      const wavPath = resolve(TMP, 'note.wav');
      writeFileSync(midPath, buildSmf(inst.program, pitch));
      renderWav(midPath, wavPath);
      const { sampleRate, data } = toMonoInt16(readFileSync(wavPath));
      const mp3 = encodeMp3(applyFades(normalize(trim(data)), sampleRate), sampleRate);
      writeFileSync(resolve(dir, `${name}.mp3`), mp3);
      total += 1;
      bytes += mp3.length;
      process.stdout.write(`  ${inst.id}/${name}.mp3 (${(mp3.length / 1024).toFixed(1)} KB)\n`);
    }
  }

  if (!testOnly) {
    const body =
      '// AUTO-GENERATED by scripts/render-samples.mjs — do not edit by hand.\n' +
      '// Sampled note names per instrument for the FluidR3 GM preview sampler.\n\n' +
      `export const SAMPLE_NOTES: Record<string, string[]> = ${JSON.stringify(manifest, null, 2)};\n`;
    writeFileSync(MANIFEST, body);
    process.stdout.write(`\nWrote manifest: ${MANIFEST}\n`);
  }

  rmSync(TMP, { recursive: true, force: true });
  process.stdout.write(`\nDone: ${total} samples, ${(bytes / 1024 / 1024).toFixed(2)} MB total\n`);
}

main();
