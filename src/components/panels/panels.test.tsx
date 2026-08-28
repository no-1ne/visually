import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextToolbar } from '@/components/context-toolbar';
import { PageStrip } from '@/components/page-strip';
import { useEditorStore } from '@/store/editor-store';
import { useUploadStore } from '@/store/upload-store';
import type { DesignDocument, ShapeElement, TextElement } from '@/types';
import { ElementsPanel } from './elements-panel';
import { LayersPanel } from './layers-panel';
import { PropertiesPanel } from './properties-panel';
import { TemplatesPanel } from './templates-panel';
import { TextPanel } from './text-panel';
import { UploadsPanel } from './uploads-panel';

const textElement = (): TextElement => ({
  id: 'text-1', type: 'text', name: 'Editable title', text: 'Original', x: 10, y: 20,
  width: 300, height: 100, rotation: 0, opacity: 1, fontSize: 40, fontFamily: 'Manrope',
  fontStyle: 'normal', fill: '#111111', align: 'left', letterSpacing: 0, lineHeight: 1.2,
});

const shapeElement = (): ShapeElement => ({
  id: 'shape-1', type: 'shape', name: 'Purple card', shape: 'rect', x: 20, y: 30,
  width: 200, height: 200, rotation: 0, opacity: 1, fill: '#7657ff', cornerRadius: 16,
});

const page = (): DesignDocument => ({
  name: 'Test page', width: 1080, height: 1080, background: '#ffffff',
  elements: [textElement(), shapeElement()],
});

function SelectedPropertiesHarness() {
  const selectedId = useEditorStore((store) => store.selectedIds[0]);
  const element = useEditorStore((store) => store.pages[store.activePageIndex].elements.find((item) => item.id === selectedId));
  return element ? <PropertiesPanel element={element} /> : null;
}

function stubImageDimensions(sequence: Array<{ width: number; height: number }>) {
  let index = 0;
  vi.stubGlobal('Image', class {
    naturalWidth = 0;
    naturalHeight = 0;
    width = 0;
    height = 0;
    decoding = 'auto';
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_value: string) {
      const dimensions = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      this.naturalWidth = dimensions.width;
      this.naturalHeight = dimensions.height;
      queueMicrotask(() => this.onload?.());
    }
  });
}

describe('editor panels', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().reset();
    useUploadStore.getState().reset();
  });

  it('applies an editable template from the catalogue', async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);
    await user.click(screen.getByRole('button', { name: /Sunday Editorial.*Social/i }));
    expect(useEditorStore.getState().pages[0].name).toBe('Sunday Editorial');
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it('renders faithful template previews and filters the expanded catalogue', async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);
    expect(screen.getAllByRole('img')).toHaveLength(18);
    await user.click(screen.getByRole('button', { name: /^Presentation$/ }));
    expect(screen.getByText('Aurora Summit')).toBeVisible();
    expect(screen.queryByText('Bloom Season Sale')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^All$/ }));
    await user.type(screen.getByLabelText('Search templates'), 'vows');
    expect(screen.getByText('Modern Vows')).toBeVisible();
    expect(screen.queryByText('Aurora Summit')).not.toBeInTheDocument();
  });

  it('adds each text preset and selects the newest element', async () => {
    const user = userEvent.setup();
    render(<TextPanel />);
    const initial = useEditorStore.getState().pages[0].elements.length;
    await user.click(screen.getByRole('button', { name: /Add text box/i }));
    await user.click(screen.getByRole('button', { name: 'Add a subheading' }));
    await user.click(screen.getByRole('button', { name: 'Add a little bit of body text' }));
    const store = useEditorStore.getState();
    expect(store.pages[0].elements).toHaveLength(initial + 3);
    expect(store.pages[0].elements.at(-1)).toMatchObject({ type: 'text', fontSize: 28 });
    expect(store.selectedIds).toEqual([store.pages[0].elements.at(-1)!.id]);
  });

  it('adds shape and line element types from accessible controls', async () => {
    const user = userEvent.setup();
    render(<ElementsPanel />);
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add star' }));
    await user.click(screen.getByRole('button', { name: /Add line/i }));
    const added = useEditorStore.getState().pages[0].elements.slice(-4);
    expect(added.map((element) => element.type)).toEqual(['shape', 'shape', 'shape', 'line']);
    expect(added.filter((element) => element.type === 'shape').map((element) => element.shape)).toEqual(['rect', 'circle', 'star']);
  });

  it('uploads an image file through the local upload panel', async () => {
    stubImageDimensions([{ width: 1600, height: 900 }]);
    const user = userEvent.setup();
    const { container } = render(<UploadsPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(input, file);
    await waitFor(() => expect(useEditorStore.getState().pages[0].elements.at(-1)).toMatchObject({
      type: 'image', name: 'photo.png', cornerRadius: 20, objectFit: 'contain', aspectLocked: true,
      intrinsicWidth: 1600, intrinsicHeight: 900,
    }));
    const image = useEditorStore.getState().pages[0].elements.at(-1) as Extract<ReturnType<typeof useEditorStore.getState>['pages'][number]['elements'][number], { type: 'image' }>;
    expect(image.src).toMatch(/^data:image\/png;base64,/);
    expect(image.width / image.height).toBeCloseTo(16 / 9);
    expect(useUploadStore.getState().tasks[0]).toMatchObject({ name: 'photo.png', status: 'local' });
  });

  it('generates an image directly through the browser AI adapter', async () => {
    const user = userEvent.setup();
    stubImageDimensions([{ width: 1024, height: 1024 }]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: 'generated-data' }] }), { status: 200 })));
    render(<UploadsPanel />);
    await user.click(screen.getByRole('tab', { name: /Generate/i }));
    await user.type(screen.getByPlaceholderText(/paper-cut illustration/i), 'A violet paper bird');
    await user.type(screen.getByPlaceholderText('Not saved'), 'session-key');
    await user.click(screen.getByRole('button', { name: /Generate and add/i }));
    await waitFor(() => expect(useEditorStore.getState().pages[0].elements.at(-1)).toMatchObject({
      type: 'image', name: 'A violet paper bird', src: 'data:image/png;base64,generated-data',
    }));
  });

  it('selects and controls layers', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject([page()]);
    render(<LayersPanel />);
    await user.click(screen.getByText('Editable title'));
    expect(useEditorStore.getState().selectedIds).toEqual(['text-1']);
    const visibilityButtons = screen.getAllByRole('button', { name: 'Toggle visibility' });
    await user.click(visibilityButtons[1]);
    expect(useEditorStore.getState().pages[0].elements[0].hidden).toBe(true);
    const lockButtons = screen.getAllByRole('button', { name: 'Toggle lock' });
    await user.click(lockButtons[1]);
    expect(useEditorStore.getState().pages[0].elements[0].locked).toBe(true);
  });

  it('edits text content, font, size, fill, and opacity properties', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject([page()]);
    useEditorStore.getState().setSelectedIds(['text-1']);
    render(<SelectedPropertiesHarness />);
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Updated title');
    await user.selectOptions(screen.getByLabelText('Font family'), 'DM Sans');
    const size = screen.getByLabelText('Font size');
    await user.clear(size);
    await user.type(size, '64');
    const color = screen.getByLabelText('Text color') as HTMLInputElement;
    fireEvent.change(color, { target: { value: '#ff0000' } });
    const updated = useEditorStore.getState().pages[0].elements[0] as TextElement;
    expect(updated).toMatchObject({ text: 'Updated title', fontFamily: 'DM Sans', fontSize: 64, fill: '#ff0000' });
  });

  it('enables, bends, reverses, and disables a curved text path', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject([page()]);
    useEditorStore.getState().setSelectedIds(['text-1']);
    render(<SelectedPropertiesHarness />);
    await user.selectOptions(screen.getByLabelText('Text path'), 'arc');
    const bend = screen.getByLabelText('Arc bend');
    fireEvent.change(bend, { target: { value: '-45' } });
    await user.click(screen.getByRole('button', { name: 'Reverse path' }));
    expect(useEditorStore.getState().pages[0].elements[0]).toMatchObject({
      textPath: { enabled: true, type: 'arc', bend: -45, reverse: true },
    });
    await user.selectOptions(screen.getByLabelText('Text path'), 'straight');
    expect((useEditorStore.getState().pages[0].elements[0] as TextElement).textPath).toBeUndefined();
  });

  it('duplicates, locks, and deletes through the property actions', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject([page()]);
    useEditorStore.getState().setSelectedIds(['text-1']);
    render(<SelectedPropertiesHarness />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(useEditorStore.getState().pages[0].elements).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    const selectedCopyId = useEditorStore.getState().selectedIds[0];
    expect(useEditorStore.getState().pages[0].elements.find((element) => element.id === selectedCopyId)?.locked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useEditorStore.getState().pages[0].elements.some((element) => element.id === selectedCopyId)).toBe(true);
  });

  it('edits page background from the page toolbar', () => {
    const { container } = render(<ContextToolbar />);
    const color = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(color, { target: { value: '#123456' } });
    expect(useEditorStore.getState().pages[0].background).toBe('#123456');
  });

  it('renders contextual element actions when selected', () => {
    useEditorStore.getState().loadProject([page()]);
    useEditorStore.getState().setSelectedIds(['shape-1']);
    render(<ContextToolbar />);
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('manages pages through the page strip', async () => {
    const user = userEvent.setup();
    render(<PageStrip />);
    await user.click(screen.getByRole('button', { name: 'Add page' }));
    expect(useEditorStore.getState().pages).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Duplicate page' }));
    expect(useEditorStore.getState().pages).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Delete page' }));
    expect(useEditorStore.getState().pages).toHaveLength(2);
  });
});
