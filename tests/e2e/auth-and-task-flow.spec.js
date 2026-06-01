import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

function uniqueEmail() {
  return `phase07-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

test('registers, signs in, loads tasks, and passes baseline accessibility checks', async ({ page }) => {
  const email = uniqueEmail();
  const password = 'PhaseStrong!1234';

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Task Manager')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register and sign in' }).click();

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current tasks' })).toBeVisible();
  await expect(page.getByText('No tasks in this view')).toBeVisible();

  const analysis = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze();

  expect(analysis.violations).toEqual([]);
});