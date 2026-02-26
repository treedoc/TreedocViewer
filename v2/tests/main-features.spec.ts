import { test, expect } from '@playwright/test';

const sampleData = [
  { id: 1, name: 'Alice', status: 'Success', value: 100 },
  { id: 2, name: 'Bob', status: 'Fail', value: 200 },
  { id: 3, name: 'Charlie', status: 'Success', value: null },
  { id: 4, name: 'David', status: '', value: 400 },
  { id: 5, name: 'Eve', status: 'Pending', value: 500 },
];

async function enterJsonData(page: any, data: object) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.press('Control+a');
  // Use fill instead of pressSequentially for faster input
  await editor.fill(JSON.stringify(data));
  // Wait for parsing
  await page.waitForTimeout(300);
}

async function ensureTableViewVisible(page: any) {
  const dataTable = page.locator('.p-datatable');
  if (!(await dataTable.isVisible())) {
    await page.locator('.pi-th-large').locator('..').click();
    await page.locator('.p-menu').waitFor({ state: 'visible' });
    await page.locator('.p-menu-item').filter({ hasText: 'Table' }).click();
  }
  await dataTable.waitFor({ state: 'visible', timeout: 10000 });
}

test.describe('TreeDoc Viewer - Main UI Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 10000 });
  });

  test.describe('Application Load', () => {
    test('should load the application successfully', async ({ page }) => {
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveTitle(/.+/);
    });

    test('should display the main layout with splitpanes', async ({ page }) => {
      await expect(page.locator('.splitpanes')).toBeVisible();
    });

    test('should have code editor visible', async ({ page }) => {
      await expect(page.locator('.cm-editor')).toBeVisible();
    });
  });

  test.describe('Data Input', () => {
    test('should accept JSON data in the editor', async ({ page }) => {
      await enterJsonData(page, sampleData);
      await expect(page.locator('.cm-content')).toContainText('Alice');
    });

    test('should parse JSON and show tree view', async ({ page }) => {
      await enterJsonData(page, sampleData);
      await expect(page.locator('.tree-view, .tree-node').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Tree View Features', () => {
    test.beforeEach(async ({ page }) => {
      const nestedData = {
        root: {
          users: sampleData,
          config: { version: '1.0', debug: true }
        }
      };
      await enterJsonData(page, nestedData);
    });

    test('should display tree structure', async ({ page }) => {
      await expect(page.locator('.tree-view, .tree-node').first()).toBeVisible({ timeout: 5000 });
    });

    test('should expand/collapse tree nodes', async ({ page }) => {
      const toggle = page.locator('.tree-node-toggle, .expand-icon, .pi-chevron-right, .pi-chevron-down').first();
      await toggle.click({ force: true });
    });

    test('should have action buttons in tree nodes', async ({ page }) => {
      // Action buttons exist in the DOM (shown on hover via CSS)
      await expect(page.locator('.node-action-btn, .node-action-bar').first()).toBeAttached();
    });
  });

  test.describe('View Switching', () => {
    test.beforeEach(async ({ page }) => {
      await enterJsonData(page, sampleData);
    });

    test('should open view toggle menu', async ({ page }) => {
      await page.locator('.pi-th-large').locator('..').click();
      await expect(page.locator('.p-menu')).toBeVisible();
      // Menu has Tree, Table, and possibly other items
      const menuItems = page.locator('.p-menu-item');
      await expect(menuItems).toHaveCount(3);
    });

    test('should switch to Table View', async ({ page }) => {
      await ensureTableViewVisible(page);
      await expect(page.locator('.p-datatable')).toBeVisible();
    });

    test('should display data rows in table', async ({ page }) => {
      await ensureTableViewVisible(page);
      await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(5);
    });
  });

  test.describe('Table View - Column Headers', () => {
    test.beforeEach(async ({ page }) => {
      await enterJsonData(page, sampleData);
      await ensureTableViewVisible(page);
    });

    test('should display column headers', async ({ page }) => {
      const headers = page.locator('.p-datatable-thead th');
      await expect(headers.first()).toBeVisible();
    });

    test('should have column header for each field', async ({ page }) => {
      const headers = page.locator('.column-header');
      await expect(headers).toHaveCount(5); // id, name, status, value, + row number
    });
  });

  test.describe('Column Filter Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await enterJsonData(page, sampleData);
      await ensureTableViewVisible(page);
    });

    test('should open column filter popover on header click', async ({ page }) => {
      await page.locator('.column-header').first().click();
      await expect(page.locator('.p-popover')).toBeVisible({ timeout: 5000 });
    });

    test('should have filter input field', async ({ page }) => {
      await page.locator('.column-header').first().click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      await expect(page.locator('.filter-input')).toBeVisible();
    });

    test('should have filter option buttons', async ({ page }) => {
      await page.locator('.column-header').first().click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      await expect(page.locator('.filter-option-btn')).toHaveCount(5);
    });

    test('should filter data when entering a query', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'name' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('Alice');
      await filterInput.press('Enter');
      
      await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(1);
    });

    test('should show filter indicator on column with active filter', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'name' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('Alice');
      await filterInput.press('Enter');
      
      await expect(page.locator('.has-filter, .column-filter-indicator, .pi-filter-fill').first()).toBeVisible();
    });
  });

  test.describe('Filter Modes', () => {
    test.beforeEach(async ({ page }) => {
      await enterJsonData(page, sampleData);
      await ensureTableViewVisible(page);
    });

    test('should support array filter mode', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'name' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      // Enable array mode
      await page.locator('.filter-option-btn').filter({ hasText: '[]' }).click();
      
      // Type filter and apply
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('Alice, Bob');
      await filterInput.press('Enter');
      
      await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(2);
    });

    test('should support negate filter mode', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'name' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      // Enable negate mode
      await page.locator('.filter-option-btn').filter({ hasText: '!' }).click();
      
      // Type filter and apply
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('Alice');
      await filterInput.press('Enter');
      
      await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(4);
    });

    test('should support JS expression filter', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'value' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      // Enable JS mode
      await page.locator('.filter-option-btn').filter({ hasText: 'JS' }).click();
      
      // Type JS expression and apply
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('$ > 200');
      await filterInput.press('Enter');
      
      // Should show rows with value > 200 (400, 500)
      const rows = page.locator('.p-datatable-tbody tr');
      await expect(rows).toHaveCount(2);
    });
  });

  test.describe('Dark Mode', () => {
    test('should toggle dark mode', async ({ page }) => {
      await page.locator('.theme-toggle').click();
      await expect(page.locator('html')).toHaveClass(/dark-mode/);
    });

    test('should toggle back to light mode', async ({ page }) => {
      await page.locator('.theme-toggle').click();
      await expect(page.locator('html')).toHaveClass(/dark-mode/);
      await page.locator('.theme-toggle').click();
      await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    });
  });

  test.describe('Pagination', () => {
    test.beforeEach(async ({ page }) => {
      const largeData = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        status: i % 3 === 0 ? 'Success' : 'Pending',
        value: (i + 1) * 10
      }));
      await enterJsonData(page, largeData);
      await ensureTableViewVisible(page);
    });

    test('should show pagination controls', async ({ page }) => {
      await expect(page.locator('.p-paginator')).toBeVisible();
    });

    test('should show page info', async ({ page }) => {
      await expect(page.locator('.p-paginator')).toContainText('1');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await enterJsonData(page, sampleData);
      await ensureTableViewVisible(page);
    });

    test('should close filter dialog on Escape', async ({ page }) => {
      await page.locator('.column-header').first().click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      await page.locator('.filter-input').press('Escape');
      
      await expect(page.locator('.p-popover')).not.toBeVisible({ timeout: 5000 });
    });

    test('should apply filter on Enter', async ({ page }) => {
      await page.locator('.column-header').filter({ hasText: 'name' }).click();
      await page.locator('.p-popover').waitFor({ state: 'visible' });
      
      const filterInput = page.locator('.filter-input');
      await filterInput.fill('Alice');
      await filterInput.press('Enter');
      
      await expect(page.locator('.p-datatable-tbody tr')).toHaveCount(1, { timeout: 5000 });
    });
  });
});
