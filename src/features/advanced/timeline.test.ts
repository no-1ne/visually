import { describe, expect, it, vi } from 'vitest';
import {
  TimelinePlayback,
  activeClipsAt,
  eventsBetween,
  frameToTime,
  normalizeTimelineRange,
  snapTimelineTime,
  sourceTimeForClip,
  timeToFrame,
  type FrameScheduler,
} from './timeline';

function fakeScheduler() {
  let now = 0;
  let nextHandle = 1;
  const callbacks = new Map<number, (time: number) => void>();
  const scheduler: FrameScheduler = {
    now: () => now,
    request: (callback) => { const handle = nextHandle++; callbacks.set(handle, callback); return handle; },
    cancel: (handle) => { callbacks.delete(handle); },
  };
  return {
    scheduler,
    advance(milliseconds: number) {
      now += milliseconds;
      const queued = [...callbacks.values()];
      callbacks.clear();
      queued.forEach((callback) => callback(now));
    },
    pending: () => callbacks.size,
  };
}

describe('timeline math', () => {
  it('converts frames and snaps to the closest eligible target', () => {
    expect(timeToFrame(1.02, 30)).toBe(31);
    expect(frameToTime(15, 30)).toBe(0.5);
    expect(snapTimelineTime(1.04, 30, [1.039], 0.02)).toBe(1.039);
    expect(snapTimelineTime(1.04, 30, [2], 0.02)).toBeCloseTo(1.0333, 3);
  });

  it('normalizes selection ranges and resolves clips at the playhead', () => {
    expect(normalizeTimelineRange({ start: 9, end: -2 }, 5)).toEqual({ start: 0, end: 5 });
    const clips = [
      { id: 'a', start: 0, duration: 2 },
      { id: 'b', start: 1, duration: 3, enabled: false },
      { id: 'c', start: 2, duration: 2, sourceStart: 4, playbackRate: 2 },
    ];
    expect(activeClipsAt(clips, 1)).toEqual([clips[0]]);
    expect(activeClipsAt(clips, 2)).toEqual([clips[2]]);
    expect(sourceTimeForClip(clips[2], 2.5)).toBe(5);
  });

  it('collects chronological events across a loop boundary', () => {
    const events = [
      { id: 'one', time: 1, value: 1 },
      { id: 'nine', time: 9, value: 9 },
      { id: 'zero', time: 0, value: 0 },
    ];
    expect(eventsBetween(events, 8, 2, 10).map((event) => event.id)).toEqual(['nine', 'zero', 'one']);
    expect(eventsBetween(events, 0, 5).map((event) => event.id)).toEqual(['one']);
  });
});

describe('TimelinePlayback', () => {
  it('plays, emits frames, pauses, seeks, and resumes from an injected clock', () => {
    const clock = fakeScheduler();
    const playback = new TimelinePlayback(clock.scheduler, 2);
    const listener = vi.fn();
    playback.subscribe(listener);
    playback.play();
    expect(clock.pending()).toBe(1);
    clock.advance(500);
    expect(playback.state.time).toBe(0.5);
    playback.pause();
    expect(playback.state.playing).toBe(false);
    playback.seek(1.5);
    playback.play();
    clock.advance(600);
    expect(playback.state).toMatchObject({ time: 2, playing: false });
    expect(listener).toHaveBeenCalled();
    playback.destroy();
  });

  it('wraps loop playback and reacts to duration changes', () => {
    const clock = fakeScheduler();
    const playback = new TimelinePlayback(clock.scheduler, 2, true);
    playback.play();
    clock.advance(2500);
    expect(playback.state.time).toBe(0.5);
    playback.setDuration(0.25);
    expect(playback.state.time).toBe(0.25);
    playback.setLoop(false);
    playback.destroy();
    expect(clock.pending()).toBe(0);
  });
});
