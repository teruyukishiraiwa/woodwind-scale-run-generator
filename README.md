# Woodwind Scale Run Generator v1.0

Woodwind Scale Run Generator is a browser-based MIDI production helper for creating simple woodwind scale runs. It generates ascending, descending, and turn-around scale phrases between a selected start note and end note, then exports Standard MIDI Files for DAWs such as Logic Pro.

Created by Teruyuki Shiraiwa.

Live app: https://woodwind-scale-run-generator.pages.dev/

Website: https://teruyukishiraiwa.art/

![Woodwind Scale Run Generator interface](docs/screenshot-v1-0.png)

## Features

- Browser-only React + TypeScript + Vite application.
- Real-pitch MIDI generation with PPQ 960.
- Standard MIDI File Type 1 export.
- Optional Program Change export with UI program numbers 1-128 converted to MIDI bytes 0-127.
- Woodwind instruments: Piccolo, Flute, Oboe, Clarinet, Bassoon, Contrabassoon.
- General MIDI, BBCSO Pro, and Custom sound profiles.
- Editable BBCSO-oriented dynamics presets.
- Velocity and enabled CC lanes use direction-aware Natural / Inverted contours with Min / Max / Curve controls.
- VexFlow notation preview with Written / Concert pitch display.
- VexFlow music font readiness is handled before initial notation rendering.
- Piano roll preview.
- Tone.js browser playback using real woodwind samples (rendered from the FluidR3 GM soundfont) with browser-side preview volume control.
- English / Japanese UI display switch.
- Credits panel.

## v1.0 Status

This is the v1.0 public release. It is intended as a practical production aid for creating woodwind scale-run MIDI phrases with notation, piano-roll, and sample-based preview feedback.

The app does not provide full notation editing, MusicXML export, Web MIDI output, multi-instrument generation, or complete written-pitch key signature handling.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Test

```bash
npm test
```

## Preview Instrument Samples

The browser preview plays short woodwind samples stored in `public/samples/<instrument>/`.
These were rendered from the **FluidR3 GM** soundfont and ship with the app as small,
trimmed, normalized mono MP3s (one every minor third per instrument; Tone.js pitch-shifts
between them). Contrabassoon reuses the GM Bassoon patch rendered in its low range.

To regenerate the samples you need the local toolchain under `tools/` (git-ignored):

- `tools/fluidsynth/.../fluidsynth.exe` — FluidSynth portable build (Windows).
- `tools/FluidR3_GM_GS.sf2` — the FluidR3 GM soundfont.

Then run:

```bash
npm run render-samples
```

This re-renders `public/samples/` and regenerates `src/core/sampleManifest.ts`.

### Soundfont acknowledgement

Preview samples are derived from the **FluidR3 GM** soundfont by **Frank Wen**, distributed
under the **MIT License**. FluidR3 GM is free for personal and commercial use. The original
soundfont and its license/README are available from the FluidR3 GM project.

## Deployment

This repository is intended to be deployed with Cloudflare Pages using the Vite build:

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `20` or newer
