import { describe, expect, it } from 'vitest';
import {
  createTableGrid,
  deleteGridColumn,
  deleteGridRow,
  findGridSpanAnchor,
  gridCell,
  insertGridColumn,
  insertGridRow,
  isCoveredGridCell,
  mapGridSelection,
  mergeGridCells,
  normalizeGridSelection,
  parseDelimitedGrid,
  pasteGrid,
  serializeGrid,
  setGridCell,
  splitGridCell,
  resizeGridTrack,
} from './table-grid';

type TestGridCell = { text: string; rowSpan?: number; colSpan?: number };

describe('table grid editing', () => {
  it('creates and immutably edits cells', () => {
    const grid = createTableGrid(2, 2, ({ row, column }) => `${row}:${column}`);
    const changed = setGridCell(grid, { row: 0, column: 1 }, 'changed');
    expect(gridCell(changed, { row: 0, column: 1 })).toBe('changed');
    expect(gridCell(grid, { row: 0, column: 1 })).toBe('0:1');
    expect(setGridCell(grid, { row: 9, column: 9 }, 'no')).toBe(grid);
  });

  it('inserts and deletes rows and columns', () => {
    const grid = createTableGrid(2, 2, () => 'old');
    const withRow = insertGridRow(grid, 1, ({ column }) => `r${column}`);
    expect(withRow.cells[1]).toEqual(['r0', 'r1']);
    const withColumn = insertGridColumn(withRow, 1, ({ row }) => `c${row}`);
    expect(withColumn.cells.map((row) => row[1])).toEqual(['c0', 'c1', 'c2']);
    expect(deleteGridRow(withColumn, 1).rows).toBe(2);
    expect(deleteGridColumn(withColumn, 1).columns).toBe(2);
  });

  it('normalizes reverse selections and maps only selected cells', () => {
    const grid = createTableGrid(3, 3, ({ row, column }) => row * 3 + column);
    const selection = { anchor: { row: 2, column: 2 }, focus: { row: 1, column: 0 } };
    expect(normalizeGridSelection(selection, grid)).toEqual({ top: 1, left: 0, bottom: 2, right: 2 });
    const mapped = mapGridSelection(grid, selection, (value) => value * 10);
    expect(mapped.cells).toEqual([[0, 1, 2], [30, 40, 50], [60, 70, 80]]);
  });

  it('parses, pastes, grows, and serializes tabular clipboard data', () => {
    const values = parseDelimitedGrid('A\tB\r\nC\tD');
    const grid = createTableGrid(1, 1, () => 'old');
    const pasted = pasteGrid(grid, { row: 1, column: 1 }, values, (text) => text);
    expect(pasted).toMatchObject({ rows: 3, columns: 3 });
    expect(pasted.cells[2][2]).toBe('D');
    expect(serializeGrid(pasted)).toContain('A\tB');
    expect(serializeGrid(createTableGrid(1, 1, () => 'two\nlines'))).toBe('two lines');
  });

  it('merges and losslessly splits a rectangular cell selection', () => {
    const grid = createTableGrid<TestGridCell>(3, 3, ({ row, column }) => ({ text: `${row}:${column}` }));
    const merged = mergeGridCells(grid, { anchor: { row: 0, column: 0 }, focus: { row: 1, column: 1 } });
    expect(merged).not.toBe(grid);
    expect(merged.cells[0][0]).toMatchObject({ rowSpan: 2, colSpan: 2 });
    expect(isCoveredGridCell(merged.cells[1][1])).toBe(true);
    expect(findGridSpanAnchor(merged, { row: 1, column: 1 })).toEqual({ row: 0, column: 0 });
    expect(grid.cells[1][1]).toEqual({ text: '1:1' });

    const split = splitGridCell(merged, { row: 1, column: 1 });
    expect(split.cells[0][0]).toEqual({ text: '0:0' });
    expect(split.cells[1][1]).toEqual({ text: '1:1' });
  });

  it('rejects a merge that cuts through an existing span', () => {
    const grid = createTableGrid<TestGridCell>(3, 3, ({ row, column }) => ({ text: `${row}:${column}` }));
    const merged = mergeGridCells(grid, { anchor: { row: 0, column: 0 }, focus: { row: 1, column: 1 } });
    const invalid = mergeGridCells(merged, { anchor: { row: 1, column: 1 }, focus: { row: 2, column: 2 } });
    expect(invalid).toBe(merged);
    expect(mergeGridCells(grid, { anchor: { row: 1, column: 1 }, focus: { row: 1, column: 1 } })).toBe(grid);
  });

  it('resizes adjacent tracks while preserving the total and minimum', () => {
    expect(resizeGridTrack([100, 100, 100], 0, 140)).toEqual([140, 60, 100]);
    expect(resizeGridTrack([100, 100, 100], 2, 180)).toEqual([100, 24, 176]);
    expect(resizeGridTrack([100, 100], 0, 999, 40)).toEqual([160, 40]);
    expect(resizeGridTrack([100], 0, 50)).toEqual([100]);
  });
});
