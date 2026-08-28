import { ChevronDownIcon, ChevronUpIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/store/editor-store';
import { useToolStore } from '@/store/tool-store';

export function TimelineBar() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const updatePage = useEditorStore((state) => state.updatePage);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const open = useToolStore((state) => state.timelineOpen);
  const setOpen = useToolStore((state) => state.setTimelineOpen);
  const time = useToolStore((state) => state.currentTime);
  const setTime = useToolStore((state) => state.setCurrentTime);
  const playing = useToolStore((state) => state.playing);
  const setPlaying = useToolStore((state) => state.setPlaying);
  const duration = Math.max(.1, page.metadata?.duration ?? 5);
  const tracks = page.elements.filter((element) => element.animation?.enabled || element.type === 'audio' || element.type === 'video');
  return <section className={`timeline-bar ${open ? 'is-open' : ''}`} aria-label="Animation timeline">
    <button className="timeline-handle" onClick={() => setOpen(!open)}>{open ? <ChevronDownIcon /> : <ChevronUpIcon />}Timeline</button>
    {open && <div className="timeline-content">
      <div className="timeline-controls">
        <Button size="icon-sm" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause timeline' : 'Play timeline'}>{playing ? <PauseIcon /> : <PlayIcon />}</Button>
        <Button size="icon-sm" variant="ghost" onClick={() => { setPlaying(false); setTime(0); }} aria-label="Restart timeline"><RotateCcwIcon /></Button>
        <span className="text-xs tabular-nums">{time.toFixed(2)}s</span>
        <label className="ml-auto flex items-center gap-2 text-xs">Duration<Input className="h-7 w-20" type="number" min="0.1" step="0.1" value={duration} onChange={(event) => updatePage({ metadata: { ...page.metadata, duration: Math.max(.1, Number(event.target.value)) } })} /></label>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-ruler" onClick={(event) => setTime(event.nativeEvent.offsetX / event.currentTarget.clientWidth * duration)}>{Array.from({ length: Math.ceil(duration) + 1 }, (_, index) => <span key={index} style={{ left: `${index / duration * 100}%` }}>{index}s</span>)}<i style={{ left: `${time / duration * 100}%` }} /></div>
        {(tracks.length ? tracks : page.elements.slice(0, 4)).map((element) => {
          const mediaStart = element.type === 'audio' || element.type === 'video' ? element.trimStart ?? 0 : element.animation?.delay ?? 0;
          const mediaEnd = element.type === 'audio' || element.type === 'video' ? element.trimEnd ?? element.duration ?? duration : mediaStart + (element.animation?.duration ?? 1);
          return <button key={element.id} className={`timeline-track ${selectedIds.includes(element.id) ? 'is-selected' : ''}`} onClick={() => setSelectedIds([element.id])}><span>{element.name}</span><b style={{ left: `${mediaStart / duration * 100}%`, width: `${Math.max(.5, mediaEnd - mediaStart) / duration * 100}%` }} /></button>;
        })}
      </div>
    </div>}
  </section>;
}
