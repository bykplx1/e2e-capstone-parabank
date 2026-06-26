import { expect, test } from '@playwright/test';

test('ParaBank home page loads and shows the expected title', async ({ page }) => {
  await page.goto('/parabank/index.htm');
  await expect(page).toHaveTitle('ParaBank | Welcome | Online Banking');
});
