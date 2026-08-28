import { expect, test, type Page } from '@playwright/test';

async function openCleanEditor(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(1);
}

test.describe('judge-ready agent workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openCleanEditor(page);
  });

  test('creates five editable formats, exposes real tool receipts, and undoes the complete run', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'), 'Desktop judge workflow');
    const originalName = await page.getByRole('textbox', { name: 'Design name' }).inputValue();

    await page.getByRole('button', { name: 'Run judge demo' }).click();

    await expect(page.getByRole('heading', { name: 'Agent activity' })).toBeVisible();
    await expect(page.locator('.page-chip')).toHaveCount(5);
    await expect(page.getByText('visually_create_campaign', { exact: true })).toBeVisible();
    await expect(page.getByText('visually_apply_brand_update', { exact: true })).toBeVisible();
    await expect(page.getByText('visually_audit_design', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo agent changes' })).toBeEnabled();

    await page.getByRole('button', { name: 'Undo agent changes' }).click();
    await expect(page.locator('.page-chip')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue(originalName);
  });

  test('keeps judge demo and activity controls accessible on mobile', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'Mobile judge workflow');

    await expect(page.getByRole('button', { name: 'Run judge demo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agent activity' })).toBeVisible();
    await page.getByRole('button', { name: 'Run judge demo' }).click();

    await expect(page.getByRole('heading', { name: 'Agent activity' })).toBeVisible();
    await expect(page.locator('.page-chip')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Undo agent changes' })).toBeVisible();
  });
});
