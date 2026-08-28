export interface TimelineRange {
  start: number;
  end: number;
}

export interface TimelineClipLike {
  id: string;
  start: number;
  duration: number;
  sourceStart?: number;
  playbackRate?: number;
  enabled?: boolean;
}

export interface TimelineEvent<T = unknown> {
  id: string;
  time: number;
  value: T;
}

export interface FrameScheduler {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

const finite = (value: number | undefined, fallback = 0) => value !== undefined && Number.isFinite(value) ? value : fallback;

export function clampTimelineTime(time: number, duration: number): number {
  return Math.min(Math.max(0, finite(duration)), Math.max(0, finite(time)));
}

export function timeToFrame(time: number, fps: number, mode: 'floor' | 'round' | 'ceil' = 'round'): number {
  const safeFps = Math.max(0.001, finite(fps, 30));
  return Math.max(0, Math[mode](Math.max(0, finite(time)) * safeFps));
}

export function frameToTime(frame: number, fps: number): number {
  return Math.max(0, finite(frame)) / Math.max(0.001, finite(fps, 30));
}

export function snapTimelineTime(time: number, fps: number, candidates: readonly number[] = [], threshold = 0.08): number {
  const frameTime = frameToTime(timeToFrame(time, fps), fps);
  let result = frameTime;
  let nearest = Math.abs(time - frameTime);
  for (const candidate of candidates) {
    const distance = Math.abs(time - candidate);
    if (distance < nearest && distance <= Math.max(0, threshold)) {
      result = candidate;
      nearest = distance;
    }
  }
  return Math.max(0, result);
}

export function normalizeTimelineRange(range: TimelineRange, duration = Number.POSITIVE_INFINITY): TimelineRange {
  const start = clampTimelineTime(Math.min(range.start, range.end), duration);
  const end = clampTimelineTime(Math.max(range.start, range.end), duration);
  return { start, end };
}

export function activeClipsAt<T extends TimelineClipLike>(clips: readonly T[], time: number): T[] {
  return clips.filter((clip) => {
    const duration = Math.max(0, finite(clip.duration));
    return clip.enabled !== false && time >= clip.start && time < clip.start + duration;
  });
}

export function sourceTimeForClip(clip: TimelineClipLike, timelineTime: number): number {
  const elapsed = clampTimelineTime(timelineTime - clip.start, clip.duration);
  return Math.max(0, finite(clip.sourceStart)) + elapsed * Math.max(0.001, finite(clip.playbackRate, 1));
}

/** Returns events crossed in (from, to], including a wrapped loop interval. */
export function eventsBetween<T>(
  events: readonly TimelineEvent<T>[],
  from: number,
  to: number,
  loopDuration?: number,
): TimelineEvent<T>[] {
  const ordered = [...events].sort((a, b) => a.time - b.time);
  if (!loopDuration || to >= from) return ordered.filter((event) => event.time > from && event.time <= to);
  return ordered.filter((event) => event.time > from && event.time <= loopDuration)
    .concat(ordered.filter((event) => event.time >= 0 && event.time <= to));
}

export interface PlaybackSnapshot {
  time: number;
  playing: boolean;
  duration: number;
  loop: boolean;
}

export class TimelinePlayback {
  private handle: number | null = null;
  private anchorClock = 0;
  private anchorTime = 0;
  private snapshot: PlaybackSnapshot;
  private listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  constructor(private readonly scheduler: FrameScheduler, duration: number, loop = false) {
    this.snapshot = { time: 0, playing: false, duration: Math.max(0, duration), loop };
  }

  get state(): PlaybackSnapshot {
    return { ...this.snapshot };
  }

  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(): void {
    if (this.snapshot.playing || this.snapshot.duration === 0) return;
    if (this.snapshot.time >= this.snapshot.duration) this.snapshot.time = 0;
    this.anchorClock = this.scheduler.now();
    this.anchorTime = this.snapshot.time;
    this.snapshot.playing = true;
    this.emit();
    this.handle = this.scheduler.request(this.tick);
  }

  pause(): void {
    if (!this.snapshot.playing) return;
    this.update(this.scheduler.now());
    this.snapshot.playing = false;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
    this.emit();
  }

  seek(time: number): void {
    this.snapshot.time = clampTimelineTime(time, this.snapshot.duration);
    this.anchorTime = this.snapshot.time;
    this.anchorClock = this.scheduler.now();
    this.emit();
  }

  setLoop(loop: boolean): void {
    this.snapshot.loop = loop;
    this.emit();
  }

  setDuration(duration: number): void {
    this.snapshot.duration = Math.max(0, finite(duration));
    this.snapshot.time = clampTimelineTime(this.snapshot.time, this.snapshot.duration);
    this.anchorTime = this.snapshot.time;
    this.anchorClock = this.scheduler.now();
    if (this.snapshot.duration === 0) this.pause();
    this.emit();
  }

  destroy(): void {
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
    this.snapshot.playing = false;
    this.listeners.clear();
  }

  private tick = (clockTime: number) => {
    this.handle = null;
    this.update(clockTime);
    this.emit();
    if (this.snapshot.playing) this.handle = this.scheduler.request(this.tick);
  };

  private update(clockTime: number): void {
    if (!this.snapshot.playing) return;
    const elapsed = Math.max(0, clockTime - this.anchorClock) / 1000;
    const next = this.anchorTime + elapsed;
    if (next < this.snapshot.duration) {
      this.snapshot.time = next;
    } else if (this.snapshot.loop && this.snapshot.duration > 0) {
      this.snapshot.time = next % this.snapshot.duration;
    } else {
      this.snapshot.time = this.snapshot.duration;
      this.snapshot.playing = false;
    }
  }

  private emit(): void {
    const value = this.state;
    for (const listener of this.listeners) listener(value);
  }
}
