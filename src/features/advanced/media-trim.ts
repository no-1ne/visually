export interface MediaTrimMetadata {
  sourceDuration: number;
  trimStart: number;
  trimEnd: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
}

export type MediaTrimInput = Partial<MediaTrimMetadata> & Pick<MediaTrimMetadata, 'sourceDuration'>;

const finite = (value: number | undefined, fallback = 0) => value !== undefined && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function normalizeMediaTrim(input: MediaTrimInput): MediaTrimMetadata {
  const sourceDuration = Math.max(0, finite(input.sourceDuration));
  const trimStart = clamp(finite(input.trimStart), 0, sourceDuration);
  const trimEnd = clamp(finite(input.trimEnd, sourceDuration), trimStart, sourceDuration);
  return {
    sourceDuration,
    trimStart,
    trimEnd,
    playbackRate: clamp(finite(input.playbackRate, 1), 0.05, 16),
    volume: clamp(finite(input.volume, 1), 0, 1),
    muted: input.muted ?? false,
    loop: input.loop ?? false,
  };
}

export function trimmedSourceDuration(trim: MediaTrimInput): number {
  const normalized = normalizeMediaTrim(trim);
  return normalized.trimEnd - normalized.trimStart;
}

export function mediaPlaybackDuration(trim: MediaTrimInput): number {
  const normalized = normalizeMediaTrim(trim);
  return (normalized.trimEnd - normalized.trimStart) / normalized.playbackRate;
}

export function playbackTimeToSourceTime(trim: MediaTrimInput, playbackTime: number): number {
  const normalized = normalizeMediaTrim(trim);
  const duration = mediaPlaybackDuration(normalized);
  let time = Math.max(0, finite(playbackTime));
  if (normalized.loop && duration > 0) time %= duration;
  else time = Math.min(time, duration);
  return normalized.trimStart + time * normalized.playbackRate;
}

export function sourceTimeToPlaybackTime(trim: MediaTrimInput, sourceTime: number): number {
  const normalized = normalizeMediaTrim(trim);
  const time = clamp(finite(sourceTime), normalized.trimStart, normalized.trimEnd);
  return (time - normalized.trimStart) / normalized.playbackRate;
}

export function splitMediaTrim(trim: MediaTrimInput, playbackTime: number): [MediaTrimMetadata, MediaTrimMetadata] | null {
  const normalized = normalizeMediaTrim(trim);
  const sourceSplit = playbackTimeToSourceTime({ ...normalized, loop: false }, playbackTime);
  if (sourceSplit <= normalized.trimStart || sourceSplit >= normalized.trimEnd) return null;
  return [
    { ...normalized, trimEnd: sourceSplit, loop: false },
    { ...normalized, trimStart: sourceSplit, loop: false },
  ];
}

export interface MediaTrimValidation {
  valid: boolean;
  issues: Array<'invalid-duration' | 'empty-range' | 'invalid-rate' | 'invalid-volume'>;
}

export function validateMediaTrim(input: MediaTrimInput): MediaTrimValidation {
  const issues: MediaTrimValidation['issues'] = [];
  if (!Number.isFinite(input.sourceDuration) || input.sourceDuration <= 0) issues.push('invalid-duration');
  if ((input.trimEnd ?? input.sourceDuration) <= (input.trimStart ?? 0)) issues.push('empty-range');
  if (input.playbackRate !== undefined && (!Number.isFinite(input.playbackRate) || input.playbackRate <= 0)) issues.push('invalid-rate');
  if (input.volume !== undefined && (!Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1)) issues.push('invalid-volume');
  return { valid: issues.length === 0, issues };
}

/** Values can be passed directly to the existing ffmpeg client when client-side exporting. */
export function mediaTrimFfmpegArgs(input: MediaTrimInput): string[] {
  const trim = normalizeMediaTrim(input);
  const args = ['-ss', trim.trimStart.toFixed(3), '-t', trimmedSourceDuration(trim).toFixed(3)];
  if (trim.playbackRate !== 1) args.push('-filter:v', `setpts=${(1 / trim.playbackRate).toFixed(6)}*PTS`);
  if (trim.muted || trim.volume === 0) args.push('-an');
  else if (trim.volume !== 1) args.push('-filter:a', `volume=${trim.volume.toFixed(3)}`);
  return args;
}
