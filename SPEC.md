# Woodwind Scale Run Generator β1.1 Specification

This document describes the public β1.1 build of Woodwind Scale Run Generator. β1.1 is a practical browser-based production helper and remains open to further workflow, notation, and UI refinement before a future stable release.

## 1. Purpose and Non-Purpose

### Purpose

v1.1 is a browser-only production helper for quickly generating woodwind run phrases as MIDI files for DAWs such as Logic Pro. It focuses on ascending, descending, and turn-around runs for orchestral woodwinds.

The primary target sound library is Spitfire BBC Symphony Orchestra Professional, but the generation engine is sound-source independent. BBCSO behavior is represented as editable presets rather than hard-coded engine behavior.

### Non-Purpose

v1.1 is not a full sequencer, notation editor, orchestration assistant, or BBCSO sound emulator. It does not attempt to reproduce BBCSO audio in the browser. It generates practical MIDI phrase material that can be imported into a DAW and assigned to the user's chosen instrument patch.

## 2. UI Parameters

The UI must expose at least the following parameters:

- Instrument: Piccolo, Flute, Oboe, Clarinet, Bassoon, Contrabassoon.
- Sound profile: General MIDI, BBCSO Pro, Custom.
- Preset: neutral default, BBCSO Short Run, BBCSO Legato/Fast Run.
- Key: chromatic root from C to B.
- Mode / scale: Major, Natural Minor, Harmonic Minor, Melodic Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Chromatic.
- Tempo in BPM.
- Time signature numerator and denominator.
- Phrase length as bars or beats.
- Direction: ascending, descending, ascending to descending, descending to ascending.
- Start real MIDI note.
- End real MIDI note.
- Gate percentage.
- MIDI channel displayed as 1..16 and converted internally to 0..15.
- Program Change enabled/disabled, default disabled. The UI Program value is 1..128 and is converted to a MIDI Program Change byte 0..127 on export.
- Velocity minimum, maximum, curve type, and direction-aware dynamic contour mode.
- CC Lane A enabled/disabled, CC number, minimum, maximum, curve type.
- CC Lane B enabled/disabled, CC number, minimum, maximum, curve type.
- CC density in points per beat, default 4, maximum 16.
- UI display language: English or Japanese.
- Release label: β1.1 / Beta 1.1.
- Credits panel for creator attribution.
- Preview volume, Play / Stop.
- Export MIDI.

Tempo, phrase length, start note, and end note are controlled with slider plus numeric input controls in the main workflow. Start and end note sliders are bounded by the selected instrument's practical real-pitch MIDI range.

Pitch generation, preview, piano roll, and MIDI export use real-sounding MIDI note numbers. The score view can display either written pitch or concert pitch, with written pitch enabled by default.

Language selection is UI-only in v1.1. It changes labels, buttons, option names, and user-facing errors, but it does not change generated MIDI data or engine settings.

The main workflow is automatically synchronized: changing any valid setting regenerates the phrase used by notation, piano roll, preview, and MIDI export. Direction-aware dynamics use a Natural contour by default and can be inverted without changing the generated pitch path. Velocity, CC, Gate, channel, and Program Change remain available as advanced controls.

In the automatic v1.1 workflow, subdivision and tuplet settings are retained for compatibility and score-rhythm utilities, but they do not determine the generated note count. The scale path itself determines the number of notes.

The Credits panel is UI-only. It displays creator attribution for Teruyuki Shiraiwa and does not affect generation, preview, or MIDI export behavior.

## 3. Internal Data Structures

The core engine uses typed, serializable data:

- `RunSettings`: all user-controlled generation settings, including score notation pitch mode and dynamic contour mode.
- `InstrumentProfile`: woodwind instrument name, practical real-pitch MIDI range, and written-pitch display offset.
- `ScaleDefinition`: scale name and pitch-class intervals.
- `DynamicCurveSettings`: min, max, curve shape, and legacy base/peak fields retained for compatibility.
- `CcLaneSettings`: enabled state, CC number, range, curve shape, and a legacy peak field retained for compatibility.
- `NoteEvent`: pitch, start tick, duration tick, velocity, and generated position index.
- `CcEvent`: tick, controller number, and value.
- `GeneratedPhrase`: settings snapshot, PPQ, total ticks, candidate pitch list, notes, CC events, and summary metadata.

Internal values are clamped to MIDI-safe ranges:

- Notes: 0..127.
- Velocity: 1..127.
- CC values: 0..127.
- UI channel: 1..16.
- MIDI channel: 0..15.
- Program Change UI value: 1..128.
- Program Change MIDI byte: 0..127.

## 4. MIDI Time Model

- Internal timing is tick-based.
- PPQ is fixed at 960.
- Tempo is represented as BPM in the UI and written as MIDI Set Tempo meta events.
- Phrase length can be specified in bars or beats.
- Bar length is derived from the time signature.
- The generated scale path note count determines the number of note slots.
- Note slots are evenly distributed across the requested phrase length.
- If the phrase length does not divide evenly into ticks, cumulative rounding is used.
- The final phrase endpoint must match the requested phrase length in ticks.
- Note duration is `stepTick * Gate%`.
- Note duration is clamped to avoid negative or zero length.
- Note On/Off ordering must avoid invalid negative durations.
- Overlap is allowed only by intentional Gate values above 100%, and still must not produce invalid note lengths.

## 5. Pitch Generation Algorithm

1. Build a pitch-class set from key and mode.
2. Correct the requested start and end notes to nearby notes in the selected scale:
   - Ascending and ascending to descending: start is corrected upward, end is corrected downward.
   - Descending and descending to ascending: start is corrected downward, end is corrected upward.
3. Validate direction:
   - Ascending and ascending to descending require corrected start below corrected end.
   - Descending and descending to ascending require corrected start above corrected end.
4. Build the scale notes between corrected start and corrected end.
5. Generate pitches:
   - Ascending: corrected start to corrected end.
   - Descending: corrected start to corrected end.
   - Ascending to descending: corrected start to corrected end, then back to corrected start without repeating the turn note.
   - Descending to ascending: corrected start to corrected end, then back to corrected start without repeating the turn note.
6. Emit every pitch in the generated scale path.
7. Build tick boundaries from `evenTickBoundaries(totalTicks, scalePathCount)`.
8. Do not add repeated endpoint notes, range-edge bounces, or skipped notes to satisfy a separate rhythm grid.

If the corrected endpoints cannot form a valid interval in the selected direction, generation fails with a user-facing error.

## 6. Velocity and CC Curve Generation

Velocity and CC curves are direction-aware dynamics contours and do not depend on pitch.

- Velocity values are 1..127.
- CC values are 0..127.
- Curve types are Linear, Ease In, Ease Out, and S-Curve.
- The UI exposes Min, Max, and Curve for Velocity and each enabled CC lane.
- Natural contour is the default:
  - Ascending rises from start to end.
  - Descending falls from start to end.
  - Ascending to descending rises to the turn note and falls back to the final start note.
  - Descending to ascending falls to the turn note and rises back to the final start note.
- Inverted contour reverses the Natural contour.
- Velocity is generated per note.
- CC events include an initial value at tick 0 and follow the same direction-aware contour.
- CC events are emitted at the configured density.
- Default CC density is 4 points per beat.
- Maximum CC density is 16 points per beat.

Legacy `base` and `peakPosition` fields remain in serialized settings for compatibility, but the beta 1.1 automatic workflow does not expose or use them for contour placement.

## 7. BBCSO Pro Presets

BBCSO defaults:

- CC1 = Dynamics.
- CC11 = Expression.

These are editable defaults, not fixed values.

### BBCSO Short Run

- Velocity is the primary expression source.
- CC1 is disabled or used as weak support.
- CC11 controls broad volume shape.
- Gate target range: 45..70%.

### BBCSO Legato/Fast Run

- Velocity is fixed or narrow range.
- CC1 is the primary expression source.
- CC11 is used for fine volume shaping.
- Gate target range: 100..108%.

## 8. MIDI Output Specification

MIDI export is Standard MIDI File Type 1.

- Header:
  - Format: 1.
  - Tracks: 2.
  - PPQ: 960.
- Track 0:
  - Track Name.
  - Tempo.
  - Time Signature.
  - End of Track.
- Track 1:
  - Instrument Name.
  - Optional Program Change, default off. UI program numbers are 1..128 and are written as MIDI bytes 0..127.
  - CC events.
  - Note On events.
  - Explicit Note Off events.
  - End of Track.

Note events are written using the selected MIDI channel after converting UI channel 1..16 to MIDI channel 0..15. Output notes are real MIDI pitch numbers.

MIDI metadata such as Track Name, Instrument Name, and the default download filename remains stable English in v1.1, regardless of the selected UI language.

## 9. Tone.js Preview Specification

Preview playback uses Tone.js inside the browser.

- Browser audio starts only in response to the user's Play action.
- v1.1 preview does not emulate BBCSO tone.
- Preview is for checking pitch, rhythm, and approximate dynamics.
- A simple synth is acceptable.
- Velocity and active CC curves should be reflected in approximate playback loudness when possible.
- Stop cancels scheduled playback and silences active notes.

## 10. Score View Specification

The UI includes a VexFlow-based notation view in addition to the piano roll.

- The score view renders the generated scale run as readable staff notation for visual confirmation.
- VexFlow music fonts are loaded before the first score render so initial page load uses stable Bravura glyph metrics.
- Piccolo, Flute, Oboe, and Clarinet use treble clef by default.
- Bassoon and Contrabassoon use bass clef by default.
- The score view has a Notation Pitch mode:
  - Written: default.
  - Concert: displays the real MIDI pitch.
- Written display uses fixed v1.1 offsets:
  - Piccolo: -12 semitones.
  - Flute: 0.
  - Oboe: 0.
  - Bb Clarinet: +2 semitones.
  - Bassoon: 0.
  - Contrabassoon: +12 semitones.
- Notation pitch mode changes score display only. MIDI export, Tone.js preview, generated notes, piano roll, and summary real-pitch values remain unchanged.
- The score view follows generated `NoteEvent` tick timing as the source of truth.
- Normal divisions use natural beam groups.
- Automatic divisions that require tuplets display tuplet numbers/brackets with beamed groups when possible.
- The score view can edit only:
  - Start note.
  - End note.
  - Run direction.
- Selecting the first or last endpoint in the score highlights the selected endpoint.
- The selected endpoint can be moved by scale step using score controls or keyboard arrows.
- Score changes immediately regenerate the phrase and keep notation, piano roll, preview, and MIDI export synchronized.
- The score view is not a full notation editor.

## 11. Test Strategy

Vitest covers the generation core and MIDI writer:

- The automatic generator uses no randomness; identical settings produce identical generated notes.
- Candidate notes remain inside key, scale, and pitch range.
- Ascending runs output every scale note from corrected start to corrected end.
- Descending runs output every scale note from corrected start to corrected end.
- Start/end based scale runs contain no repeated turn note and no range-edge bounce.
- Direction/order errors are reported instead of silently swapping endpoints.
- Scale-path based tick boundaries end exactly at the requested phrase length.
- Subdivision and tuplet settings do not change the generated note count in the automatic v1.1 workflow.
- The full scale path is distributed across the selected length.
- MIDI notes convert to VexFlow keys for notation rendering.
- Written/concert notation pitch conversion uses the selected instrument's offset and does not change generated notes or MIDI output.
- Instrument profiles select the expected clef.
- Score endpoint controls move start/end notes by scale step.
- Score direction controls update `RunSettings.direction`.
- Gate never produces negative or zero note durations.
- Velocity and CC values are clamped to valid MIDI ranges.
- MIDI output starts with `MThd`.
- MIDI output is Type 1 with two tracks and PPQ 960.

The final implementation must pass `npm run build`.

## 12. Public β1.1 Deployment

The β1.1 public build is intended for GitHub and Cloudflare Pages.

- GitHub repository: `teruyukishiraiwa/woodwind-scale-run-generator`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Cloudflare Pages framework preset: Vite.
- Required Node.js version: 20 or newer.
- Cloudflare Pages headers are provided through `public/_headers`, which Vite copies into `dist/_headers`.
- Deployment metadata and UI release labeling use β1.1 / Beta 1.1, while MIDI file contents and MIDI metadata remain stable and do not include beta labeling.

## 13. Features Excluded from β1.1

- Direct external MIDI sending through the Web MIDI API.
- Drag-based per-note editing.
- Full notation editing.
- MusicXML export.
- Score printing.
- Simultaneous multi-instrument generation.
- Automatic keyswitch output.
- Full preset persistence through IndexedDB.
- Complete written-pitch key signature and enharmonic spelling support.
- Full professional notation engraving.
