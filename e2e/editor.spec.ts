import { expect, test, type Page } from '@playwright/test';

async function openCleanEditor(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(1);
}

test.describe('desktop editor workflows', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'), 'Desktop-only workflow');
    await openCleanEditor(page);
  });

  test('renders the complete editor shell without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByText('Visually', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Elements' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uploads' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Layers' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit canvas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Page 1' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('registers and executes WebMCP tools through a browser host', async ({ page }) => {
    await page.addInitScript(() => {
      type BrowserTool = {
        name: string;
        execute: (input: Record<string, unknown>, options?: { signal: AbortSignal }) => unknown | Promise<unknown>;
      };
      const registered = new Map<string, BrowserTool>();
      Object.defineProperty(window, '__visuallyWebMcpTools', { configurable: true, value: registered });
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        value: {
          registerTool(tool: BrowserTool, options?: { signal?: AbortSignal }) {
            registered.set(tool.name, tool);
            options?.signal?.addEventListener('abort', () => registered.delete(tool.name), { once: true });
            return Promise.resolve();
          },
        },
      });
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-webmcp', 'ready');

    const catalog = await page.evaluate(() => {
      const tools = (window as unknown as { __visuallyWebMcpTools: Map<string, unknown> }).__visuallyWebMcpTools;
      return [...tools.keys()];
    });
    expect(catalog).toHaveLength(14);
    expect(catalog).toContain('visually_add_text');
    expect(catalog).toContain('visually_export_design');

    const call = (name: string, input: Record<string, unknown>) => page.evaluate(async ({ toolName, args }) => {
      type BrowserTool = { execute: (value: Record<string, unknown>, options: { signal: AbortSignal }) => unknown | Promise<unknown> };
      const tools = (window as unknown as { __visuallyWebMcpTools: Map<string, BrowserTool> }).__visuallyWebMcpTools;
      return tools.get(toolName)?.execute(args, { signal: new AbortController().signal });
    }, { toolName: name, args: input });

    const applied = await call('visually_apply_template', { templateId: 'aurora-summit' });
    expect(applied).toMatchObject({ ok: true });
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Aurora Summit');

    const added = await call('visually_add_text', { text: 'Created by browser agent', name: 'Agent layer' });
    expect(added).toMatchObject({ ok: true });
    await page.getByRole('button', { name: 'Layers' }).click();
    await expect(page.getByText('Agent layer', { exact: true }).first()).toBeVisible();

    const blockedDelete = await call('visually_delete_selection', { confirm: false });
    expect(blockedDelete).toMatchObject({ ok: false });
    await expect(page.getByText('Agent layer', { exact: true }).first()).toBeVisible();

    const exported = await call('visually_export_design', { format: 'svg' });
    expect(exported).toMatchObject({ ok: true, data: { format: 'svg' } });
  });

  test('adds text and supports undo, redo, duplicate, and delete shortcuts', async ({ page }) => {
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('button', { name: /Add text box/i }).click();
    await expect(page.getByText('Heading', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await page.keyboard.press('Control+z');
    await expect(page.getByText('Heading', { exact: true })).toBeHidden();
    await page.keyboard.press('Control+Shift+z');
    await page.getByRole('button', { name: 'Layers' }).click();
    const headingLayer = page.getByText('Heading', { exact: true }).first();
    await expect(headingLayer).toBeVisible();
    await headingLayer.click();

    await page.keyboard.press('Control+d');
    await expect(page.getByText('Heading copy', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.getByText('Heading copy', { exact: true })).toBeHidden();
  });

  test('applies templates and preserves undo history', async ({ page }) => {
    await page.getByRole('button', { name: /Sunday Editorial Social/i }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Sunday Editorial');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Untitled summer post');
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Sunday Editorial');
  });

  test('browses polished portrait and landscape template categories', async ({ page }) => {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(page.getByRole('img')).toHaveCount(18);
    await page.getByRole('button', { name: 'Presentation', exact: true }).click();
    await expect(page.getByText('Aurora Summit', { exact: true })).toBeVisible();
    await expect(page.getByText('Bloom Season Sale', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Aurora Summit.*Presentation/ }).click();
    await expect(page.getByText('1920 × 1080px')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Aurora Summit');
  });

  test('adds all core element types and exposes them in layers', async ({ page }) => {
    await page.getByRole('button', { name: 'Elements' }).click();
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await page.getByRole('button', { name: 'Add circle' }).click();
    await page.getByRole('button', { name: 'Add star' }).click();
    await page.getByRole('button', { name: /Add line/i }).click();
    await page.getByRole('button', { name: 'Layers' }).click();
    await expect(page.getByText('Rect', { exact: true })).toBeVisible();
    await expect(page.getByText('Circle', { exact: true })).toBeVisible();
    await expect(page.getByText('Star', { exact: true })).toBeVisible();
    await expect(page.getByText('Line', { exact: true }).first()).toBeVisible();
  });

  test('uploads a local image and makes it editable', async ({ page }) => {
    await page.getByRole('button', { name: 'Uploads' }).click();
    await page.locator('input[type="file"][accept*="image"]').setInputFiles({
      name: 'tiny.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>'),
    });
    await expect(page.getByText('tiny.svg', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('image', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duplicate' }).first()).toBeVisible();
  });

  test('fits portrait and landscape images without changing their orientation', async ({ page }) => {
    await page.getByRole('button', { name: 'Uploads' }).click();
    const input = page.locator('input[type="file"][accept*="image"]');
    await input.setInputFiles({
      name: 'portrait.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"><rect width="600" height="1200" fill="blue"/></svg>'),
    });
    await expect(page.getByText('portrait.svg', { exact: true }).first()).toBeVisible();
    const portraitWidth = Number(await page.getByLabel('Width').last().inputValue());
    const portraitHeight = Number(await page.getByLabel('Height').last().inputValue());
    expect(portraitHeight).toBeGreaterThan(portraitWidth);

    await input.setInputFiles({
      name: 'landscape.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="green"/></svg>'),
    });
    await expect(page.getByText('landscape.svg', { exact: true }).first()).toBeVisible();
    const landscapeWidth = Number(await page.getByLabel('Width').last().inputValue());
    const landscapeHeight = Number(await page.getByLabel('Height').last().inputValue());
    expect(landscapeWidth).toBeGreaterThan(landscapeHeight);
    await expect(page.getByRole('button', { name: 'Unlock ratio' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit entire image' })).toBeVisible();
  });

  test('generates an image through the browser-only AI adapter', async ({ page }) => {
    await page.route('https://api.openai.com/v1/images/generations', async (route) => {
      const request = route.request();
      expect(request.headers().authorization).toBe('Bearer e2e-session-key');
      expect(request.postDataJSON()).toMatchObject({ model: 'gpt-image-2', prompt: 'A violet paper bird' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: 'c3Zn' }] }) });
    });
    await page.getByRole('button', { name: 'Uploads' }).click();
    await page.getByRole('tab', { name: /Generate/i }).click();
    await page.getByPlaceholder(/paper-cut illustration/i).fill('A violet paper bird');
    await page.getByPlaceholder('Not saved').fill('e2e-session-key');
    await page.getByRole('button', { name: /Generate and add/i }).click();
    await expect(page.getByText('image', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duplicate' }).first()).toBeVisible();
  });

  test('manages multiple pages', async ({ page }) => {
    await page.getByRole('button', { name: 'Add page' }).click();
    await expect(page.getByRole('button', { name: 'Page 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Duplicate page' }).click();
    await expect(page.getByRole('button', { name: 'Page 3' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete page' }).click();
    await expect(page.getByRole('button', { name: 'Page 3' })).toBeHidden();
    await page.getByRole('button', { name: 'Page 1' }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Untitled summer post');
  });

  test('virtualizes all pages in a continuous canvas view', async ({ page }) => {
    await page.getByRole('button', { name: 'Add page' }).click();
    await page.getByRole('button', { name: 'Show all pages' }).click();
    await expect(page.getByRole('button', { name: 'Show one page' })).toBeVisible();
    await expect(page.locator('.virtual-canvas-page')).toHaveCount(2);
    await expect(page.locator('.virtual-canvas-page.is-active')).toHaveCount(1);
    await page.getByRole('button', { name: 'Page 1' }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Untitled summer post');
    await page.getByRole('button', { name: 'Show one page' }).click();
    await expect(page.locator('.virtual-canvas-page')).toHaveCount(1);
  });

  test('exports project JSON and a high-resolution PNG', async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByRole('button', { name: 'Export' }).click();
    const projectItem = page.getByRole('menuitem', { name: /Project JSON/ });
    await expect(projectItem).toBeVisible();
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      projectItem.click(),
    ]);
    expect(jsonDownload.suggestedFilename()).toBe('visually-project.json');

    await page.getByRole('button', { name: 'Export' }).click();
    const pngItem = page.getByRole('menuitem', { name: /PNG image/ });
    await expect(pngItem).toBeVisible();
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      pngItem.click(),
    ]);
    expect(pngDownload.suggestedFilename()).toBe('untitled-summer-post.png');
  });

  test('imports a valid project JSON file', async ({ page }) => {
    const project = {
      version: 1,
      pages: [{ name: 'Imported E2E', width: 640, height: 480, background: '#ffffff', elements: [] }],
    };
    await page.locator('input[type="file"][accept*="json"]').setInputFiles({
      name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Imported E2E');
    await expect(page.getByText('640 × 480px')).toBeVisible();
  });

  test('renames the design and keeps the canvas usable across zoom controls', async ({ page }) => {
    const name = page.getByRole('textbox', { name: 'Design name' });
    await name.fill('Campaign artwork');
    await expect(name).toHaveValue('Campaign artwork');
    const zoom = page.locator('.zoom-value');
    const before = await zoom.textContent();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoom).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Fit canvas' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('draws an editable vector path and exposes it in layers', async ({ page }) => {
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * .25, box!.y + box!.height * .3);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * .45, box!.y + box!.height * .48, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(page.getByText('Drawing', { exact: true }).first()).toBeVisible();
  });

  test('adds and edits a table', async ({ page }) => {
    await page.getByRole('button', { name: 'Tables', exact: true }).click();
    await page.getByRole('button', { name: '3 × 3' }).click();
    const firstCell = page.getByRole('textbox', { name: 'Cell 1, 1' });
    await expect(firstCell).toHaveValue('Column 1');
    await firstCell.fill('Campaign');
    await expect(firstCell).toHaveValue('Campaign');
    await firstCell.click();
    await page.getByRole('textbox', { name: 'Cell 2, 2' }).click({ modifiers: ['Shift'] });
    await page.getByRole('button', { name: 'Merge range' }).click();
    await expect(page.getByRole('textbox', { name: 'Cell 2, 2' })).toBeDisabled();
    await page.getByRole('button', { name: 'Split cell' }).click();
    await expect(page.getByRole('textbox', { name: 'Cell 2, 2' })).toBeEnabled();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(page.locator('.layer-row').getByText('3 × 3 table', { exact: true })).toBeVisible();
  });

  test('adds animation keyframes and controls the timeline', async ({ page }) => {
    await page.getByRole('button', { name: 'Elements', exact: true }).click();
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByRole('button', { name: 'Fade', exact: true }).click();
    await page.getByRole('button', { name: /Timeline/ }).click();
    await expect(page.getByRole('region', { name: 'Animation timeline' })).toBeVisible();
    await page.getByRole('button', { name: 'Play timeline' }).click();
    await expect(page.getByRole('button', { name: 'Pause timeline' })).toBeVisible();
  });

  test('offers the complete browser export matrix', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    for (const name of ['PNG image', 'JPEG image', 'WebP image', 'SVG vector', 'PDF document', 'Printable HTML', 'PowerPoint', 'Animated GIF', 'MP4 video', 'WebM video', 'Project JSON']) {
      await expect(page.getByRole('menuitem', { name: new RegExp(name) })).toBeVisible();
    }
  });
});

test.describe('mobile editor workflows', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile-only workflow');
    await openCleanEditor(page);
  });

  test('starts with tools collapsed and exposes the bottom dock', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Design', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeHidden();
    await expect(page.locator('canvas')).toBeVisible();
    const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
  });

  test('opens and closes the tool sheet with accessible controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close tools' })).toBeVisible();
    await page.getByRole('button', { name: 'Close tools' }).click();
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeHidden();
  });

  test('adds text from the mobile tool sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Text', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Text' })).toBeVisible();
    await page.getByRole('button', { name: /Add text box/i }).click();
    await expect(page.getByText('Heading', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close tools' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('keeps all primary touch controls at least 44px tall', async ({ page }) => {
    const sizes = await page.locator('.mobile-tool-dock button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(sizes).toHaveLength(5);
    for (const height of sizes) expect(height).toBeGreaterThanOrEqual(44);
  });

  test('keeps canvas and page controls recoverable after orientation-style resize', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit canvas' })).toBeVisible();
    await page.getByRole('button', { name: 'Fit canvas' }).click();
    await expect(page.getByRole('button', { name: 'Page 1' })).toBeVisible();
  });

  test('keeps advanced tools reachable in the mobile sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    for (const name of ['Draw', 'Tables', 'Media', 'Animations', 'Effects', 'Resize', 'Fonts']) {
      await expect(page.getByRole('dialog', { name: 'Sidebar' }).getByRole('button', { name, exact: true })).toBeVisible();
    }
  });
});
