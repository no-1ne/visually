import { useMemo, useState } from 'react';
import { CombineIcon, SplitSquareHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  isCoveredGridCell,
  mergeGridCells,
  resizeGridTrack,
  splitGridCell,
  type GridPosition,
  type GridSelection,
} from '@/features/advanced/table-grid';
import type { EditorElement, TableElement } from '@/types';

interface TablePropertiesProps {
  element: TableElement;
  patch: (changes: Partial<EditorElement>) => void;
}

const sliderValue = (value: number | readonly number[]) => Number(Array.isArray(value) ? value[0] : value);
const equalPosition = (first: GridPosition, second: GridPosition) => first.row === second.row && first.column === second.column;

export function TableProperties({ element, patch }: TablePropertiesProps) {
  const [selection, setSelection] = useState<GridSelection>({
    anchor: { row: 0, column: 0 },
    focus: { row: 0, column: 0 },
  });
  const columnWidths = useMemo(
    () => element.columnWidths?.length === element.columns
      ? element.columnWidths
      : Array.from({ length: element.columns }, () => element.width / Math.max(1, element.columns)),
    [element.columnWidths, element.columns, element.width],
  );
  const rowHeights = useMemo(
    () => element.rowHeights?.length === element.rows
      ? element.rowHeights
      : Array.from({ length: element.rows }, () => element.height / Math.max(1, element.rows)),
    [element.height, element.rowHeights, element.rows],
  );
  const selectCell = (position: GridPosition, extend: boolean) => {
    setSelection((current) => extend ? { ...current, focus: position } : { anchor: position, focus: position });
  };
  const merge = () => {
    const next = mergeGridCells({ rows: element.rows, columns: element.columns, cells: element.cells }, selection);
    if (next.cells !== element.cells) patch({ cells: next.cells } as Partial<TableElement>);
  };
  const split = () => {
    const next = splitGridCell({ rows: element.rows, columns: element.columns, cells: element.cells }, selection.focus);
    if (next.cells !== element.cells) patch({ cells: next.cells } as Partial<TableElement>);
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      <label className="field-label">Border<input className="color-input mt-1" type="color" value={element.borderColor ?? '#c9cbd4'} onChange={(event) => patch({ borderColor: event.target.value } as Partial<TableElement>)} /></label>
      <label className="field-label">Weight<Input className="mt-1" type="number" min="0" value={element.borderWidth ?? 1} onChange={(event) => patch({ borderWidth: Number(event.target.value) } as Partial<TableElement>)} /></label>
    </div>

    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold">Cells</p>
        <p className="text-[10px] text-muted-foreground">Shift-click to extend</p>
      </div>
      <div className="max-h-56 space-y-1 overflow-auto">
        {element.cells.map((row, rowIndex) => <div key={rowIndex} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${element.columns},minmax(72px,1fr))` }}>
          {row.map((cell, columnIndex) => {
            const position = { row: rowIndex, column: columnIndex };
            const selected = equalPosition(selection.anchor, position) || equalPosition(selection.focus, position);
            const covered = isCoveredGridCell(cell);
            return <Input
              key={cell.id}
              aria-label={`Cell ${rowIndex + 1}, ${columnIndex + 1}`}
              aria-pressed={selected}
              className={selected ? 'ring-2 ring-primary/60' : undefined}
              disabled={covered}
              placeholder={covered ? 'Merged' : undefined}
              value={covered ? '' : cell.text}
              onClick={(event) => selectCell(position, event.shiftKey)}
              onChange={(event) => {
                const cells = structuredClone(element.cells);
                cells[rowIndex][columnIndex].text = event.target.value;
                patch({ cells } as Partial<TableElement>);
              }}
            />;
          })}
        </div>)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={merge}><CombineIcon />Merge range</Button>
        <Button size="sm" variant="outline" onClick={split}><SplitSquareHorizontalIcon />Split cell</Button>
      </div>
    </div>

    <div className="rounded-xl border p-3">
      <p className="mb-3 text-[11px] font-semibold">Drag column widths</p>
      <div className="space-y-3">{columnWidths.map((width, index) => <label className="block text-[10px] text-muted-foreground" key={`column-${index}`}>
        Column {index + 1} <span className="float-right tabular-nums">{Math.round(width)}px</span>
        <Slider
          className="mt-2"
          aria-label={`Column ${index + 1} width`}
          min={24}
          max={Math.max(24, width + (columnWidths[index === columnWidths.length - 1 ? index - 1 : index + 1] ?? 0) - 24)}
          value={[width]}
          disabled={columnWidths.length < 2}
          onValueChange={(value) => patch({ columnWidths: resizeGridTrack(columnWidths, index, sliderValue(value)) } as Partial<TableElement>)}
        />
      </label>)}</div>
    </div>

    <div className="rounded-xl border p-3">
      <p className="mb-3 text-[11px] font-semibold">Drag row heights</p>
      <div className="space-y-3">{rowHeights.map((height, index) => <label className="block text-[10px] text-muted-foreground" key={`row-${index}`}>
        Row {index + 1} <span className="float-right tabular-nums">{Math.round(height)}px</span>
        <Slider
          className="mt-2"
          aria-label={`Row ${index + 1} height`}
          min={24}
          max={Math.max(24, height + (rowHeights[index === rowHeights.length - 1 ? index - 1 : index + 1] ?? 0) - 24)}
          value={[height]}
          disabled={rowHeights.length < 2}
          onValueChange={(value) => patch({ rowHeights: resizeGridTrack(rowHeights, index, sliderValue(value)) } as Partial<TableElement>)}
        />
      </label>)}</div>
    </div>
  </div>;
}
