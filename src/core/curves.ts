import type { CurveType, Direction, DynamicContourMode, DynamicCurveSettings } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function shapeProgress(progress: number, curve: CurveType): number {
  const t = clamp(progress, 0, 1);
  switch (curve) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 's-curve':
      return t * t * (3 - 2 * t);
    case 'linear':
    default:
      return t;
  }
}

export function dynamicContourValueAt(
  position: number,
  direction: Direction,
  contourMode: DynamicContourMode,
  settings: DynamicCurveSettings,
  midiMin: number,
  midiMax: number,
): number {
  const min = clamp(Math.min(settings.min, settings.max), midiMin, midiMax);
  const max = clamp(Math.max(settings.min, settings.max), midiMin, midiMax);
  const x = clamp(position, 0, 1);
  const natural = naturalContourProgress(x, direction);
  const progress = contourMode === 'inverted' ? 1 - natural : natural;
  const shaped = shapeProgress(progress, settings.curve);

  return clampInt(min + (max - min) * shaped, midiMin, midiMax);
}

function naturalContourProgress(position: number, direction: Direction): number {
  switch (direction) {
    case 'descending':
      return 1 - position;
    case 'down-up':
      return Math.abs((position * 2) - 1);
    case 'up-down':
      return 1 - Math.abs((position * 2) - 1);
    case 'ascending':
    default:
      return position;
  }
}