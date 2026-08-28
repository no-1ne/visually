import { describe, expect, it } from 'vitest';
import {
  mediaPlaybackDuration,
  mediaTrimFfmpegArgs,
  normalizeMediaTrim,
  playbackTimeToSourceTime,
  sourceTimeToPlaybackTime,
  splitMediaTrim,
  trimmedSourceDuration,
  validateMediaTrim,
} from './media-trim';

describe('media trim metadata', () => {
  it('normalizes ranges, speed, volume, and defaults', () => {
    expect(normalizeMediaTrim({ sourceDuration: 10, trimStart: -2, trimEnd: 20, playbackRate: 0, volume: 2 })).toEqual({
      sourceDuration: 10,
      trimStart: 0,
      trimEnd: 10,
      playbackRate: 0.05,
      volume: 1,
      muted: false,
      loop: false,
    });
  });

  it('maps between source and playback time with rate and looping', () => {
    const trim = { sourceDuration: 20, trimStart: 4, trimEnd: 12, playbackRate: 2, loop: true };
    expect(trimmedSourceDuration(trim)).toBe(8);
    expect(mediaPlaybackDuration(trim)).toBe(4);
    expect(playbackTimeToSourceTime(trim, 5)).toBe(6);
    expect(sourceTimeToPlaybackTime(trim, 10)).toBe(3);
  });

  it('splits valid trim ranges in source-time coordinates', () => {
    const split = splitMediaTrim({ sourceDuration: 10, trimStart: 2, trimEnd: 8, playbackRate: 2 }, 1);
    expect(split?.[0].trimEnd).toBe(4);
    expect(split?.[1].trimStart).toBe(4);
    expect(splitMediaTrim({ sourceDuration: 10 }, 0)).toBeNull();
  });

  it('validates raw metadata before normalization', () => {
    expect(validateMediaTrim({ sourceDuration: 0, trimStart: 2, trimEnd: 1, playbackRate: -1, volume: 4 })).toEqual({
      valid: false,
      issues: ['invalid-duration', 'empty-range', 'invalid-rate', 'invalid-volume'],
    });
    expect(validateMediaTrim({ sourceDuration: 3 })).toEqual({ valid: true, issues: [] });
  });

  it('produces ffmpeg arguments for client-side trim exports', () => {
    expect(mediaTrimFfmpegArgs({ sourceDuration: 10, trimStart: 1, trimEnd: 5, playbackRate: 2, volume: 0.5 })).toEqual([
      '-ss', '1.000', '-t', '4.000', '-filter:v', 'setpts=0.500000*PTS', '-filter:a', 'volume=0.500',
    ]);
    expect(mediaTrimFfmpegArgs({ sourceDuration: 2, muted: true })).toContain('-an');
  });
});
