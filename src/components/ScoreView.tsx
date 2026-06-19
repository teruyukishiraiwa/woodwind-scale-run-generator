import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyScoreDirection,
  clefForInstrument,
  displayPitchForNotation,
  midiToVexflowKey,
  endEndpointIndexForPhrase,
  moveEndpointByScaleStep,
  startEndpointIndex,
  scoreDurationForPhrase,
  stemDirectionForScoreGroup,
  type EndpointSelection,
} from '../core/score';
import type { Direction, GeneratedPhrase, NotationPitchMode, RunSettings } from '../core/types';
import { labelDirection, t, type Language } from '../i18n';

interface ScoreViewProps {
  language: Language;
  phrase: GeneratedPhrase;
  settings: RunSettings;
  selectedEndpoint: EndpointSelection;
  onSelectEndpoint: (endpoint: EndpointSelection) => void;
  onSettingsChange: (settings: RunSettings) => void;
}

const DIRECTION_OPTIONS: Direction[] = ['ascending', 'descending', 'up-down', 'down-up'];
const NOTATION_PITCH_OPTIONS: NotationPitchMode[] = ['written', 'concert'];
const MAX_NOTES_PER_SYSTEM = 12;
const NOTE_SPACING = 48;
const STAVE_LEFT = 12;
const SYSTEM_HEIGHT = 128;
const ENDPOINT_HIT_WIDTH = 48;
const ENDPOINT_HIT_HEIGHT = 82;

interface EndpointHitPosition {
  left: number;
  top: number;
}

export function ScoreView({
  language,
  phrase,
  settings,
  selectedEndpoint,
  onSelectEndpoint,
  onSettingsChange,
}: ScoreViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const clef = clefForInstrument(settings.instrumentId);
  const rhythm = scoreDurationForPhrase(phrase);
  const systems = useMemo(() => chunkNotes(phrase.notes, MAX_NOTES_PER_SYSTEM), [phrase.notes]);
  const width = Math.max(620, systems.reduce((max, system) => Math.max(max, system.length), 1) * NOTE_SPACING + 170);
  const height = systems.length * SYSTEM_HEIGHT + 26;
  const [notePositions, setNotePositions] = useState<EndpointHitPosition[]>([]);
  const startHit = endpointHitStyle(notePositions[startEndpointIndex()]);
  const endHit = endpointHitStyle(notePositions[endEndpointIndexForPhrase(phrase)]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    let cancelled = false;
    element.innerHTML = '';
    setNotePositions([]);

    async function renderScore() {
      const vexflow = await import('vexflow');
      if (cancelled || !element) return;
      await waitForVexflowFonts();
      if (cancelled || !element) return;

      const { Accidental, Beam, Formatter, Renderer, Stave, StaveNote, Tuplet, Voice } = vexflow;

      element.innerHTML = '';
      const renderer = new Renderer(element, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont('Arial', 10);
      const nextNotePositions: EndpointHitPosition[] = [];

      systems.forEach((system, systemIndex) => {
        const y = 18 + systemIndex * 128;
        const stave = new Stave(STAVE_LEFT, y, width - 28);
        if (systemIndex === 0) {
          stave.addClef(clef).addTimeSignature(`${settings.timeSignatureNumerator}/${settings.timeSignatureDenominator}`);
        }
        stave.setContext(context).draw();

        const noteEntries = system.map((event, indexInSystem) => {
          const displayPitch = displayPitchForNotation(settings.instrumentId, event.pitch, settings.notationPitchMode);
          const note = new StaveNote({
            keys: [midiToVexflowKey(displayPitch)],
            duration: rhythm.duration,
            clef,
          });
          const accidental = accidentalForPitch(displayPitch);
          if (accidental) {
            note.addModifier(new Accidental(accidental), 0);
          }
          return { note, pitch: displayPitch, globalIndex: systemIndex * MAX_NOTES_PER_SYSTEM + indexInSystem };
        });
        const notes = noteEntries.map((entry) => entry.note);

        const voice = new Voice({
          numBeats: Math.max(1, notes.length),
          beatValue: durationToBeatValue(rhythm.duration),
        }).setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);
        const beams: Array<InstanceType<typeof Beam>> = [];
        const tuplets: Array<InstanceType<typeof Tuplet>> = [];

        if (notes.length >= 2 && rhythm.duration !== 'q') {
          const groups = beamGroups(noteEntries, rhythm.groupSize);
          groups.forEach((groupEntries) => {
            const group = groupEntries.map((entry) => entry.note);
            const groupPitches = groupEntries.map((entry) => entry.pitch);
            if (group.length >= 2) {
              const stemDirection = stemDirectionForScoreGroup(groupPitches, clef);
              group.forEach((note) => note.setStemDirection(stemDirection));
              beams.push(new Beam(group));
            }
            if (!rhythm.approximate && rhythm.tuplet > 1 && group.length === rhythm.tuplet) {
              tuplets.push(new Tuplet(group, {
                numNotes: rhythm.tuplet,
                notesOccupied: rhythm.notesOccupied,
                bracketed: true,
                ratioed: rhythm.tuplet > 3,
              }));
            }
          });
        }

        new Formatter().joinVoices([voice]).format([voice], width - 170);
        voice.draw(context, stave);
        beams.forEach((beam) => beam.setContext(context).draw());
        tuplets.forEach((tuplet) => tuplet.setContext(context).draw());

        noteEntries.forEach((entry) => {
          const position = positionForStaveNote(entry.note);
          nextNotePositions[entry.globalIndex] = {
            left: position.left + element.offsetLeft,
            top: position.top + element.offsetTop,
          };
        });
      });

      if (!cancelled) {
        setNotePositions(nextNotePositions);
      }
    }

    void renderScore();

    return () => {
      cancelled = true;
    };
  }, [
    clef,
    height,
    rhythm.duration,
    rhythm.groupSize,
    rhythm.notesOccupied,
    rhythm.tuplet,
    settings.instrumentId,
    settings.notationPitchMode,
    settings.timeSignatureDenominator,
    settings.timeSignatureNumerator,
    phrase.summary.correctedEndNote,
    phrase.notes.length,
    systems,
    width,
  ]);

  function moveSelectedEndpoint(step: -1 | 1) {
    onSettingsChange(moveEndpointByScaleStep(settings, selectedEndpoint, step));
  }

  return (
    <section className="score-view">
      <div className="score-toolbar">
        <div className="segmented" role="group" aria-label={t(language, 'runDirection')}>
          {DIRECTION_OPTIONS.map((direction) => (
            <button
              className={settings.direction === direction ? 'active' : ''}
              key={direction}
              type="button"
              onClick={() => onSettingsChange(applyScoreDirection(settings, direction))}
            >
              {labelDirection(language, direction)}
            </button>
          ))}
        </div>
        <div className="endpoint-tools">
          <span>{t(language, 'selectedEndpoint')}</span>
          <button
            className={selectedEndpoint === 'start' ? 'active' : ''}
            type="button"
            onClick={() => onSelectEndpoint('start')}
          >
            {t(language, 'startEndpoint')}
          </button>
          <button
            className={selectedEndpoint === 'end' ? 'active' : ''}
            type="button"
            onClick={() => onSelectEndpoint('end')}
          >
            {t(language, 'endEndpoint')}
          </button>
          <button className="icon-button light" type="button" onClick={() => moveSelectedEndpoint(1)} title={t(language, 'moveUp')}>
            <ChevronUp size={17} />
          </button>
          <button className="icon-button light" type="button" onClick={() => moveSelectedEndpoint(-1)} title={t(language, 'moveDown')}>
            <ChevronDown size={17} />
          </button>
        </div>
        <div className="endpoint-tools">
          <span>{t(language, 'notationPitch')}</span>
          {NOTATION_PITCH_OPTIONS.map((mode) => (
            <button
              className={settings.notationPitchMode === mode ? 'active' : ''}
              key={mode}
              type="button"
              onClick={() => onSettingsChange({ ...settings, notationPitchMode: mode })}
            >
              {t(language, mode)}
            </button>
          ))}
        </div>
      </div>
      <div className="score-canvas-wrap">
        <div
          ref={hostRef}
          className="score-canvas"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              moveSelectedEndpoint(1);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              moveSelectedEndpoint(-1);
            }
          }}
        />
        <button
          className={`score-endpoint-hit start ${selectedEndpoint === 'start' ? 'active' : ''}`}
          style={startHit}
          type="button"
          onClick={() => onSelectEndpoint('start')}
          title={t(language, 'startEndpoint')}
        />
        <button
          className={`score-endpoint-hit end ${selectedEndpoint === 'end' ? 'active' : ''}`}
          style={endHit}
          type="button"
          onClick={() => onSelectEndpoint('end')}
          title={t(language, 'endEndpoint')}
        />
      </div>
    </section>
  );
}

function chunkNotes<T>(notes: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < notes.length; index += size) {
    chunks.push(notes.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function endpointHitStyle(position: EndpointHitPosition | undefined): CSSProperties {
  if (!position) {
    return { display: 'none' };
  }

  return {
    left: position.left,
    top: position.top,
  };
}

function positionForStaveNote(note: { getAbsoluteX: () => number; getBoundingBox?: () => { getX?: () => number; getY?: () => number; getW?: () => number; getH?: () => number; x?: number; y?: number; w?: number; h?: number }; getYs?: () => number[] }): EndpointHitPosition {
  const absoluteX = note.getAbsoluteX();
  const ys = note.getYs?.() ?? [];
  const fallbackY = ys.length > 0 ? ys.reduce((sum, y) => sum + y, 0) / ys.length : 58;

  try {
    const box = note.getBoundingBox?.();
    const x = box ? readBoxNumber(box, 'x', 'getX', absoluteX) : absoluteX;
    const y = box ? readBoxNumber(box, 'y', 'getY', fallbackY) : fallbackY;
    const w = box ? readBoxNumber(box, 'w', 'getW', 0) : 0;
    const h = box ? readBoxNumber(box, 'h', 'getH', 0) : 0;
    return {
      left: x + w / 2 - ENDPOINT_HIT_WIDTH / 2,
      top: y + h / 2 - ENDPOINT_HIT_HEIGHT / 2,
    };
  } catch {
    return {
      left: absoluteX - ENDPOINT_HIT_WIDTH / 2,
      top: fallbackY - ENDPOINT_HIT_HEIGHT / 2,
    };
  }
}

function readBoxNumber(
  box: { [key: string]: unknown },
  property: string,
  getter: string,
  fallback: number,
): number {
  const direct = box[property];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

  const method = box[getter];
  if (typeof method === 'function') {
    const value = method.call(box);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return fallback;
}

function accidentalForPitch(pitch: number): string | null {
  const pitchClass = ((pitch % 12) + 12) % 12;
  if ([1, 6].includes(pitchClass)) return '#';
  if ([3, 8, 10].includes(pitchClass)) return 'b';
  return null;
}

function durationToBeatValue(duration: 'q' | '8' | '16' | '32' | '64'): number {
  if (duration === 'q') return 4;
  return Number(duration);
}

function beamGroups<T>(notes: T[], groupSize: number): T[][] {
  return chunkNotes(notes, Math.max(1, groupSize));
}

async function waitForVexflowFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  try {
    await document.fonts.load('64px Bravura');
  } catch {
    // Fall back to rendering if the browser cannot explicitly load Bravura.
  }

  await document.fonts.ready;
}
