export interface TableGrid<T> {
  rows: number;
  columns: number;
  cells: T[][];
}

export interface GridPosition { row: number; column: number }
export interface GridSelection { anchor: GridPosition; focus: GridPosition }
export interface GridRect { top: number; left: number; bottom: number; right: number }
export interface SpanningGridCell { rowSpan?: number; colSpan?: number }

const integer = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

export function createTableGrid<T>(rows: number, columns: number, factory: (position: GridPosition) => T): TableGrid<T> {
  const safeRows = integer(rows);
  const safeColumns = integer(columns);
  return {
    rows: safeRows,
    columns: safeColumns,
    cells: Array.from({ length: safeRows }, (_, row) =>
      Array.from({ length: safeColumns }, (_, column) => factory({ row, column }))),
  };
}

export function gridCell<T>(grid: TableGrid<T>, position: GridPosition): T | undefined {
  return grid.cells[position.row]?.[position.column];
}

export function setGridCell<T>(grid: TableGrid<T>, position: GridPosition, value: T): TableGrid<T> {
  if (position.row < 0 || position.row >= grid.rows || position.column < 0 || position.column >= grid.columns) return grid;
  const cells = grid.cells.map((row) => [...row]);
  cells[position.row][position.column] = value;
  return { ...grid, cells };
}

export function insertGridRow<T>(grid: TableGrid<T>, at: number, factory: (position: GridPosition) => T): TableGrid<T> {
  const index = Math.min(grid.rows, integer(at));
  const cells = grid.cells.map((row) => [...row]);
  cells.splice(index, 0, Array.from({ length: grid.columns }, (_, column) => factory({ row: index, column })));
  return { rows: grid.rows + 1, columns: grid.columns, cells };
}

export function insertGridColumn<T>(grid: TableGrid<T>, at: number, factory: (position: GridPosition) => T): TableGrid<T> {
  const index = Math.min(grid.columns, integer(at));
  const cells = grid.cells.map((row, rowIndex) => {
    const next = [...row];
    next.splice(index, 0, factory({ row: rowIndex, column: index }));
    return next;
  });
  return { rows: grid.rows, columns: grid.columns + 1, cells };
}

export function deleteGridRow<T>(grid: TableGrid<T>, at: number): TableGrid<T> {
  if (at < 0 || at >= grid.rows) return grid;
  return { rows: grid.rows - 1, columns: grid.columns, cells: grid.cells.filter((_, index) => index !== at).map((row) => [...row]) };
}

export function deleteGridColumn<T>(grid: TableGrid<T>, at: number): TableGrid<T> {
  if (at < 0 || at >= grid.columns) return grid;
  return { rows: grid.rows, columns: grid.columns - 1, cells: grid.cells.map((row) => row.filter((_, index) => index !== at)) };
}

export function normalizeGridSelection(selection: GridSelection, grid: Pick<TableGrid<unknown>, 'rows' | 'columns'>): GridRect {
  const rowMax = Math.max(0, grid.rows - 1);
  const columnMax = Math.max(0, grid.columns - 1);
  const clamp = (value: number, max: number) => Math.min(max, integer(value));
  const anchorRow = clamp(selection.anchor.row, rowMax);
  const focusRow = clamp(selection.focus.row, rowMax);
  const anchorColumn = clamp(selection.anchor.column, columnMax);
  const focusColumn = clamp(selection.focus.column, columnMax);
  return {
    top: Math.min(anchorRow, focusRow),
    left: Math.min(anchorColumn, focusColumn),
    bottom: Math.max(anchorRow, focusRow),
    right: Math.max(anchorColumn, focusColumn),
  };
}

export function mapGridSelection<T>(grid: TableGrid<T>, selection: GridSelection, map: (cell: T, position: GridPosition) => T): TableGrid<T> {
  const rect = normalizeGridSelection(selection, grid);
  return {
    ...grid,
    cells: grid.cells.map((row, rowIndex) => row.map((cell, columnIndex) =>
      rowIndex >= rect.top && rowIndex <= rect.bottom && columnIndex >= rect.left && columnIndex <= rect.right
        ? map(cell, { row: rowIndex, column: columnIndex })
        : cell)),
  };
}

export function parseDelimitedGrid(text: string): string[][] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((row) => row.split('\t'));
}

export function pasteGrid<T>(
  grid: TableGrid<T>,
  origin: GridPosition,
  values: readonly (readonly string[])[],
  convert: (text: string, previous: T | undefined, position: GridPosition) => T,
): TableGrid<T> {
  const requiredRows = Math.max(grid.rows, origin.row + values.length);
  const requiredColumns = Math.max(grid.columns, origin.column + Math.max(0, ...values.map((row) => row.length)));
  const cells = Array.from({ length: requiredRows }, (_, row) => Array.from({ length: requiredColumns }, (_, column) => {
    const source = values[row - origin.row]?.[column - origin.column];
    const previous = grid.cells[row]?.[column];
    if (source !== undefined) return convert(source, previous, { row, column });
    if (previous !== undefined) return previous;
    return convert('', undefined, { row, column });
  }));
  return { rows: requiredRows, columns: requiredColumns, cells };
}

export function serializeGrid<T>(grid: TableGrid<T>, stringify: (cell: T) => string = String): string {
  return grid.cells.map((row) => row.map((cell) => stringify(cell).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}

export function isCoveredGridCell(cell: SpanningGridCell | undefined): boolean {
  return cell?.rowSpan === 0 || cell?.colSpan === 0;
}

export function findGridSpanAnchor<T extends SpanningGridCell>(grid: TableGrid<T>, position: GridPosition): GridPosition | undefined {
  if (!grid.cells[position.row]?.[position.column]) return undefined;
  for (let row = position.row; row >= 0; row -= 1) {
    for (let column = position.column; column >= 0; column -= 1) {
      const cell = grid.cells[row]?.[column];
      if (!cell || isCoveredGridCell(cell)) continue;
      const rowSpan = Math.max(1, cell.rowSpan ?? 1);
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      if (row + rowSpan > position.row && column + colSpan > position.column) return { row, column };
    }
  }
  return position;
}

function spanRect(cell: SpanningGridCell, position: GridPosition): GridRect {
  return {
    top: position.row,
    left: position.column,
    bottom: position.row + Math.max(1, cell.rowSpan ?? 1) - 1,
    right: position.column + Math.max(1, cell.colSpan ?? 1) - 1,
  };
}

function intersects(first: GridRect, second: GridRect) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function contains(outer: GridRect, inner: GridRect) {
  return outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom;
}

/** Merges a rectangular selection into its top-left cell without discarding covered cell data. */
export function mergeGridCells<T extends SpanningGridCell>(grid: TableGrid<T>, selection: GridSelection): TableGrid<T> {
  if (!grid.rows || !grid.columns) return grid;
  const selectionRect = normalizeGridSelection(selection, grid);
  if (selectionRect.top === selectionRect.bottom && selectionRect.left === selectionRect.right) return grid;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const cell = grid.cells[row]?.[column];
      if (!cell || isCoveredGridCell(cell)) continue;
      const existing = spanRect(cell, { row, column });
      if (intersects(selectionRect, existing) && !contains(selectionRect, existing)) return grid;
    }
  }

  const cells = grid.cells.map((row) => row.map((cell) => ({ ...cell })));
  cells[selectionRect.top][selectionRect.left] = {
    ...cells[selectionRect.top][selectionRect.left],
    rowSpan: selectionRect.bottom - selectionRect.top + 1,
    colSpan: selectionRect.right - selectionRect.left + 1,
  };
  for (let row = selectionRect.top; row <= selectionRect.bottom; row += 1) {
    for (let column = selectionRect.left; column <= selectionRect.right; column += 1) {
      if (row === selectionRect.top && column === selectionRect.left) continue;
      cells[row][column] = { ...cells[row][column], rowSpan: 0, colSpan: 0 };
    }
  }
  return { ...grid, cells };
}

/** Restores every cell in the merged range containing `position`. */
export function splitGridCell<T extends SpanningGridCell>(grid: TableGrid<T>, position: GridPosition): TableGrid<T> {
  const anchor = findGridSpanAnchor(grid, position);
  if (!anchor) return grid;
  const anchorCell = grid.cells[anchor.row]?.[anchor.column];
  if (!anchorCell) return grid;
  const rowSpan = Math.max(1, anchorCell.rowSpan ?? 1);
  const colSpan = Math.max(1, anchorCell.colSpan ?? 1);
  if (rowSpan === 1 && colSpan === 1) return grid;

  const cells = grid.cells.map((row) => row.map((cell) => ({ ...cell })));
  for (let row = anchor.row; row < Math.min(grid.rows, anchor.row + rowSpan); row += 1) {
    for (let column = anchor.column; column < Math.min(grid.columns, anchor.column + colSpan); column += 1) {
      const restored = { ...cells[row][column] } as Partial<T>;
      delete restored.rowSpan;
      delete restored.colSpan;
      cells[row][column] = restored as T;
    }
  }
  return { ...grid, cells };
}

/** Resizes one track and its neighbor while preserving the table's total size. */
export function resizeGridTrack(tracks: readonly number[], index: number, nextSize: number, minimum = 24): number[] {
  if (tracks.length < 2 || index < 0 || index >= tracks.length || !Number.isFinite(nextSize)) return [...tracks];
  const neighbor = index === tracks.length - 1 ? index - 1 : index + 1;
  const pairTotal = Math.max(0, tracks[index]) + Math.max(0, tracks[neighbor]);
  const safeMinimum = Math.min(Math.max(1, minimum), pairTotal / 2);
  const size = Math.min(pairTotal - safeMinimum, Math.max(safeMinimum, nextSize));
  const result = tracks.map((track) => Math.max(0, track));
  result[index] = size;
  result[neighbor] = pairTotal - size;
  return result;
}
