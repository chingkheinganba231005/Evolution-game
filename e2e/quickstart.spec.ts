import { test, expect } from '@playwright/test';

test.describe('Creature Evolution Lab core flow', () => {
  test('quick start runs generations, shows a champion, and persists', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Design the ancestor/i })).toBeVisible();

    // Quick Start begins an experiment and navigates to the lab.
    await page.getByRole('button', { name: /Quick Start/i }).click();
    await expect(page).toHaveURL(/#\/lab/);

    // The viewport is present.
    await expect(page.getByLabel('Creature simulation viewport')).toBeVisible();

    // Wait for evolution to complete at least two generations.
    await expect(page.locator('text=/gen [2-9]/')).toBeVisible({ timeout: 60_000 });

    // A champion fitness appears in the toolbar.
    await expect(page.locator('text=/best -?\\d/')).toBeVisible({ timeout: 60_000 });

    // Fitness chart tab renders (default) — switch to Champion tab to inspect.
    await page.getByRole('tab', { name: 'Champion' }).click();
    await expect(page.getByText('Fitness', { exact: false }).first()).toBeVisible();

    // Save the experiment.
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);

    // Reload and confirm the experiment is restored on the dashboard.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Your experiments/i })).toBeVisible();
    await expect(page.getByText('Quick Start').first()).toBeVisible({ timeout: 15_000 });
  });

  test('learn page renders educational content', async ({ page }) => {
    await page.goto('/#/learn');
    await expect(page.getByRole('heading', { name: /How evolution works here/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Genomes' })).toBeVisible();
  });
});
