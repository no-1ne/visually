export function PanelHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
