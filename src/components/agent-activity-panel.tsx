import { useEffect, useState } from 'react';
import {
  BotIcon, CheckCircle2Icon, ChevronRightIcon, CircleAlertIcon, HistoryIcon, PlayIcon, SparklesIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { canUndoAgentChanges, runJudgeDemo, undoAgentChanges } from '@/features/judge-demo/run-judge-demo';
import { useAgentActivityStore } from '@/store/agent-activity-store';
import { useEditorStore } from '@/store/editor-store';

export function AgentActivityControls() {
  const isOpen = useAgentActivityStore((state) => state.isOpen);
  const activities = useAgentActivityStore((state) => state.activities);
  const setOpen = useAgentActivityStore((state) => state.setOpen);
  // These subscriptions make undo eligibility react to both agent and human history changes.
  useEditorStore((state) => state.past.length);
  useEditorStore((state) => state.pages);
  const canUndo = canUndoAgentChanges();
  const [webMcpStatus, setWebMcpStatus] = useState(() => document.documentElement.dataset.webmcp ?? 'unsupported');

  useEffect(() => {
    const handleStatus = (event: Event) => setWebMcpStatus(String((event as CustomEvent).detail));
    document.addEventListener('visually:webmcp-status', handleStatus);
    return () => document.removeEventListener('visually:webmcp-status', handleStatus);
  }, []);

  const webMcpReady = webMcpStatus === 'ready';
  const statusLabel = webMcpReady ? 'WebMCP ready'
    : webMcpStatus === 'registering' ? 'Connecting WebMCP'
      : webMcpStatus === 'error' ? 'WebMCP unavailable' : 'Guided demo';

  return <>
    <Button
      variant="outline"
      className="judge-demo-button border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
      onClick={() => void runJudgeDemo()}
      aria-label="Run judge demo"
    >
      <SparklesIcon /> <span className="hidden md:inline">Judge demo</span><PlayIcon className="hidden md:block" />
    </Button>
    <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Agent activity" className="relative">
      <BotIcon />
      {activities.length > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-emerald-500" />}
    </Button>

    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="agent-activity-sheet w-[min(430px,calc(100vw-12px))] sm:max-w-[430px]" aria-label="Agent activity">
        <SheetHeader className="border-b bg-gradient-to-br from-violet-50 to-white pr-12">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white"><BotIcon className="size-4" /></span>
            <Badge variant="outline" className={webMcpReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-violet-200 bg-violet-50 text-violet-700'}><span className={`size-1.5 rounded-full ${webMcpReady ? 'bg-emerald-500' : 'bg-violet-500'}`} /> {statusLabel}</Badge>
          </div>
          <SheetTitle>Agent activity</SheetTitle>
          <SheetDescription>Structured calls, receipts, and every editable element the agent touched.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activities.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-muted/25 p-7 text-center">
            <div><BotIcon className="mx-auto mb-3 size-7 text-violet-500" /><p className="text-sm font-semibold">No calls yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Run the judge demo to turn one brief into a coordinated, editable campaign.</p><Button className="mt-4" onClick={() => void runJudgeDemo()}><SparklesIcon /> Run judge demo</Button></div>
          </div> : <ol className="space-y-3" aria-label="WebMCP call receipts">
            {activities.map((activity, index) => <li key={activity.id} className="agent-activity-card relative rounded-2xl border bg-card p-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full ${activity.status === 'undone' ? 'bg-muted text-muted-foreground' : activity.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {activity.status === 'undone' ? <HistoryIcon className="size-3.5" /> : activity.status === 'error' ? <CircleAlertIcon className="size-3.5" /> : <CheckCircle2Icon className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold leading-tight">{activity.title}</p><span className="text-[10px] text-muted-foreground">{index === 0 ? 'now' : `+${index}s`}</span></div>
                  <code className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium text-violet-600">{activity.tool}</code>
                </div>
              </div>
              <div className="ml-10 mt-3 rounded-xl bg-muted/45 p-2.5">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Call</p>
                <code className="block whitespace-normal break-words text-[10px] leading-relaxed text-foreground/75">{activity.input}</code>
              </div>
              <div className={`ml-10 mt-2 flex gap-2 rounded-xl border p-2.5 text-[10px] leading-relaxed ${activity.status === 'error' ? 'border-red-100 bg-red-50/60 text-red-900' : 'border-emerald-100 bg-emerald-50/60 text-emerald-900'}`}>
                <ChevronRightIcon className="mt-0.5 size-3 shrink-0" /><span><b>Receipt:</b> {activity.receipt}</span>
              </div>
              <div className="ml-10 mt-2 flex flex-wrap gap-1">
                {activity.affected.map((item) => <Badge key={item} variant="secondary" className="h-5 px-1.5 text-[9px]">{item}</Badge>)}
              </div>
              {activity.readOnly && <span className="absolute right-3.5 top-10 text-[9px] font-medium text-muted-foreground">read-only</span>}
            </li>)}
          </ol>}
        </div>

        {activities.length > 0 && <div className="border-t bg-background p-4">
          <Button variant="outline" className="w-full" disabled={!canUndo} onClick={undoAgentChanges} aria-label="Undo agent changes">
            <HistoryIcon /> Undo agent changes
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">{canUndo ? 'Reverts the complete agent run in one click.' : 'Undo is unavailable after the document changes.'}</p>
        </div>}
      </SheetContent>
    </Sheet>
  </>;
}
