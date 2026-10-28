import entries from '../narration.json';

export const FPS = 30;
export const narration = entries;
export type NarrationStep = (typeof entries)[number];
export const durationInFrames = Math.round(entries[entries.length - 1].endTime * FPS);
export const getStepAtFrame = (frame: number): NarrationStep =>
  entries.find((step) => frame >= step.startTime * FPS && frame < step.endTime * FPS)
  ?? (frame < 0 ? entries[0] : entries[entries.length - 1]);
export const stepFrames = (index: number) =>
  Math.round((entries[index].endTime - entries[index].startTime) * FPS);
export const formatTime = (frame: number) => {
  const seconds = Math.floor(frame / FPS);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
