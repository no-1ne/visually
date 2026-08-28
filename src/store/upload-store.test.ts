import { beforeEach, describe, expect, it } from 'vitest';
import { useUploadStore, type UploadTask } from './upload-store';

const task = (id: string): UploadTask => ({ id, name: `${id}.png`, size: 10, progress: 0, status: 'local' });

describe('upload task store', () => {
  beforeEach(() => useUploadStore.getState().reset());

  it('adds, updates, and removes tasks', () => {
    useUploadStore.getState().addTask(task('one'));
    useUploadStore.getState().updateTask('one', { progress: 80, status: 'uploading' });
    expect(useUploadStore.getState().tasks[0]).toMatchObject({ id: 'one', progress: 80, status: 'uploading' });
    useUploadStore.getState().removeTask('one');
    expect(useUploadStore.getState().tasks).toEqual([]);
  });

  it('keeps only the twelve most recent tasks', () => {
    for (let index = 0; index < 15; index += 1) useUploadStore.getState().addTask(task(String(index)));
    expect(useUploadStore.getState().tasks).toHaveLength(12);
    expect(useUploadStore.getState().tasks[0].id).toBe('14');
    expect(useUploadStore.getState().tasks.at(-1)?.id).toBe('3');
  });

  it('updates only the matching task and ignores removal of an unknown task', () => {
    useUploadStore.getState().addTask(task('one'));
    useUploadStore.getState().addTask(task('two'));
    useUploadStore.getState().updateTask('one', { status: 'complete', progress: 100 });
    expect(useUploadStore.getState().tasks).toEqual([
      task('two'),
      { ...task('one'), status: 'complete', progress: 100 },
    ]);
    useUploadStore.getState().removeTask('missing');
    expect(useUploadStore.getState().tasks).toHaveLength(2);
    useUploadStore.getState().reset();
    expect(useUploadStore.getState().tasks).toEqual([]);
  });
});
