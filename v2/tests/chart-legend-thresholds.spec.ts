import { test, expect } from '@playwright/test';

const data = [
  { day: '2026-10-01', region: 'east', model: 'SavingsPlan', cost: 10 },
  { day: '2026-10-01', region: 'east', model: 'OnDemand', cost: 30 },
  { day: '2026-10-02', region: 'east', model: 'SavingsPlan', cost: 50 },
  { day: '2026-10-02', region: 'east', model: 'OnDemand', cost: 25 },
  { day: '2026-10-03', region: 'east', model: 'SavingsPlan', cost: 7 },
  { day: '2026-10-03', region: 'east', model: 'OnDemand', cost: 20 },
];
const chartState = {
  showStatus: 'maximized', timeColumn: 'day', valueColumns: ['cost'], groupColumns: ['region', 'model'],
  bucketSize: 'day', showCount: false, valueAgg: 'sum',
  thresholds: [{ name: 'Commitment', value: 40, color: '#f59e0b' }, { name: 'High', value: 60, color: '#ef4444' }],
};

async function openChart(page: any, state = {}) {
  await page.goto('/?' + new URLSearchParams({ data: JSON.stringify(data), option: JSON.stringify({
    maxPane: 'table', globalRule: { chartState: { ...chartState, ...state } },
  }) }));
  await expect(page.locator('.time-series-chart canvas').first()).toBeVisible();
}

test('legend defaults, column picker, hover hide and uncluttered tooltip', async ({ page }) => {
  await openChart(page);
  const legend = page.locator('.value-legend').first();
  const headers = legend.locator('table').first().locator('th');
  await expect(headers).toHaveText(['', '', 'model', 'Max', 'Last']);
  await expect(legend.locator('tbody tr').first()).toContainText('SavingsPlan');
  await expect(legend.locator('tbody tr').first()).toContainText('50');
  await expect(legend.locator('tbody tr').first()).toContainText('7');
  await expect(page.getByRole('table', { name: 'Thresholds' })).toContainText('Commitment');
  await expect(page.getByRole('table', { name: 'Thresholds' })).toContainText('60');

  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await page.getByLabel('Increase', { exact: true }).check();
  await page.getByLabel('region', { exact: true }).check();
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await expect(headers).toHaveText(['', '', 'region', 'model', 'Max', 'Last', 'Increase']);
  await expect(legend.locator('tbody tr').first().locator('td').last()).toHaveText('40');

  await headers.filter({ hasText: /^Last$/ }).hover();
  await page.locator('.legend-filter-popover .hide-column-btn').click();
  await expect(headers).toHaveText(['', '', 'region', 'model', 'Max', 'Increase']);
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await page.getByLabel('Last', { exact: true }).check();
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await expect(headers).toHaveText(['', '', 'region', 'model', 'Max', 'Last', 'Increase']);

  await expect(page.locator('.legend-column-picker')).not.toBeVisible();
  const canvas = page.locator('.time-series-chart canvas').first();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.time-series-html-tooltip')).toBeVisible();
  await expect(page.locator('.time-series-html-tooltip')).not.toContainText('east');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/treedoc-threshold-legend.png', fullPage: true });
});

test('legend endpoints use the selected range', async ({ page }) => {
  await openChart(page, {
    timeSelectionStart: new Date(2026, 9, 2).getTime(), timeSelectionEnd: new Date(2026, 9, 3).getTime(),
    timeSelectionColumn: 'day', legendColumns: ['group:1', 'max', 'last', 'increase'],
  });
  const row = page.locator('.value-legend').first().locator('tbody tr').filter({ hasText: 'SavingsPlan' });
  await expect(row.locator('td').last()).toHaveText('0');
});


test('thresholds follow dates and suppress incompatible units', async ({ page }) => {
  await openChart(page, { thresholds: [
    { name: 'Active', value: 40, color: '#f59e0b', start: '2026-10-02', end: '2026-10-04', valueColumn: 'cost', bucketSize: 'day', valueAgg: 'sum' },
    { name: 'Expired', value: 30, color: 'red', end: '2026-09-01' },
    { name: 'Wrong metric', value: 40, color: 'red', valueColumn: 'quantity' },
    { name: 'Wrong bucket', value: 40, color: 'red', bucketSize: 'hour' },
  ] });
  const thresholds = page.getByRole('table', { name: 'Thresholds' });
  await expect(thresholds.locator('tbody tr')).toHaveCount(1);
  await expect(thresholds).toContainText('Active');
});

test('pie legend supports hide and restore without changing slices', async ({ page }) => {
  await openChart(page, { showPieCharts: true });
  const headers = page.locator('.pie-legend th');
  await expect(headers).toHaveText(['', '', 'model', 'cost']);
  await headers.filter({ hasText: /^cost$/ }).hover();
  await page.locator('.legend-filter-popover .hide-column-btn').click();
  await expect(headers).toHaveText(['', '', 'model']);
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'cost', exact: true }).check();
  await expect(headers).toHaveText(['', '', 'model', 'cost']);
});

test('threshold editor adds, updates, validates and removes entries', async ({ page }) => {
  await openChart(page);
  const settings = page.getByRole('button', { name: 'Legend settings', exact: true });
  await settings.click();
  await page.getByRole('button', { name: 'Add threshold', exact: true }).click();
  await page.getByLabel('Threshold 3 name', { exact: true }).fill('Target');
  await page.getByLabel('Threshold 3 value', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Change color for threshold 3', exact: true }).click();
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill('00aa44');
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).press('Escape');
  await expect(page.locator('.chart-color-picker')).not.toBeVisible();
  await page.getByRole('button', { name: 'Apply thresholds', exact: true }).click();
  const thresholds = page.getByRole('table', { name: 'Thresholds' });
  await expect(thresholds.locator('tbody tr')).toHaveCount(3);
  await expect(thresholds).toContainText('Target');
  await expect(page.getByRole('button', { name: 'Change color for Target', exact: true })).toHaveCSS('background-color', 'rgb(0, 170, 68)');
  await settings.click();
  await page.getByLabel('Threshold 3 name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Apply thresholds', exact: true }).click();
  await expect(page.locator('.legend-settings [role=alert]')).toContainText('Each threshold needs');
  await page.getByLabel('Threshold 3 name', { exact: true }).fill('New target');
  await page.getByLabel('Threshold 3 value', { exact: true }).fill('57');
  await page.getByRole('button', { name: 'Apply thresholds', exact: true }).click();
  await expect(thresholds).toContainText('New target');
  await expect(thresholds).toContainText('57');
  await settings.click();
  await page.getByRole('button', { name: 'Remove threshold 3', exact: true }).click();
  await page.getByRole('button', { name: 'Apply thresholds', exact: true }).click();
  await expect(thresholds.locator('tbody tr')).toHaveCount(2);
});

test('series and threshold swatches open color pickers and update immediately', async ({ page }) => {
  await openChart(page);
  const series = page.getByRole('button', { name: 'Change color for cost | east | SavingsPlan', exact: true });
  await series.click();
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill('123abc');
  await expect(series).toHaveCSS('background-color', 'rgb(18, 58, 188)');
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).press('Escape');
  await expect(page.locator('.chart-color-picker')).not.toBeVisible();
  const threshold = page.getByRole('button', { name: 'Change color for Commitment', exact: true });
  await threshold.click();
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill('ff00aa');
  await expect(threshold).toHaveCSS('background-color', 'rgb(255, 0, 170)');
  await page.getByRole('textbox', { name: 'Hex color', exact: true }).press('Escape');
  await expect(page.locator('.chart-color-picker')).not.toBeVisible();
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change color for threshold 1', exact: true })).toHaveCSS('background-color', 'rgb(255, 0, 170)');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/treedoc-legend-settings.png', fullPage: true });
});

test('bar chart fills available category width', async ({ page }) => {
  await openChart(page, { barChart: true });
  // Inspect rendered pixels: two wide colored bars around the middle bucket.
  const widths = await page.locator('.time-series-chart canvas').first().evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const y = Math.floor(canvas.height * 0.75);
    const runs: number[] = [];
    let run = 0;
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const [r, g, b] = image.data.slice(i, i + 3);
      const colored = g > r + 25 && b > r + 25; // Teal series, excluding gray grids and amber thresholds.
      if (colored) run++;
      else if (run) { runs.push(run); run = 0; }
    }
    return runs;
  });
  expect(Math.max(...widths)).toBeGreaterThan(30);
  await page.screenshot({ path: '/tmp/treedoc-wide-bars.png', fullPage: true });
});

test('threshold visibility can be toggled from legend and settings while preserving entries', async ({ page }) => {
  await openChart(page);
  const thresholds = page.getByRole('table', { name: 'Thresholds' });
  await thresholds.getByRole('button', { name: 'Hide threshold Commitment', exact: true }).click();
  await expect(thresholds.getByRole('button', { name: 'Show threshold Commitment', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await thresholds.getByRole('button', { name: 'Hide threshold High', exact: true }).click();
  await expect(thresholds.locator('tbody tr')).toHaveCount(2);
  await expect(thresholds.locator('tbody tr.hidden')).toHaveCount(2);
  await page.getByRole('button', { name: 'Legend settings', exact: true }).click();
  await page.getByRole('button', { name: 'Show threshold 1', exact: true }).click();
  await page.getByRole('button', { name: 'Apply thresholds', exact: true }).click();
  await expect(thresholds.getByRole('button', { name: 'Hide threshold Commitment', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(thresholds.locator('tbody tr.hidden')).toHaveCount(1);
  await thresholds.getByRole('button', { name: 'Show threshold High', exact: true }).click();
  await expect(thresholds.locator('tbody tr.hidden')).toHaveCount(0);
});

for (const barChart of [false, true]) {
  test(`${barChart ? 'bars' : 'line points'} keep rendered colors in sync through edits, hover and zoom`, async ({ page }) => {
    await openChart(page, { barChart });
    const canvas = page.locator('.time-series-chart canvas').first();
    const swatch = page.getByRole('button', { name: 'Change color for cost | east | SavingsPlan', exact: true });
    const otherSwatch = page.getByRole('button', { name: 'Change color for cost | east | OnDemand', exact: true });
    const originalOtherColor = await otherSwatch.evaluate(element => getComputedStyle(element).backgroundColor);
    for (const color of ['123abc', 'a12543']) {
      await swatch.click();
      await page.getByRole('textbox', { name: 'Hex color', exact: true }).fill(color);
      await page.getByRole('textbox', { name: 'Hex color', exact: true }).press('Escape');
      await expect.poll(() => renderedSeriesColors(canvas, 'value:cost:east | SavingsPlan')).toEqual({
        border: `#${color}`, elements: [barChart ? `#${color}66` : `#${color}`],
      });
    }
    // Zoom to the final day, reversing the two series' Max ranking.
    const selection = await canvas.evaluate((element: any) => {
      const chart = element.__vueParentComponent.exposed.chart.value;
      const x = chart.scales.x;
      const bounds = element.getBoundingClientRect();
      const time = new Date(2026, 9, 3).getTime();
      return { left: bounds.left + x.getPixelForValue(time - 3600000),
        right: bounds.left + x.getPixelForValue(time + 3600000), y: bounds.top + chart.chartArea.top + 30 };
    });
    await page.mouse.move(selection.left, selection.y);
    await page.mouse.down();
    await page.mouse.move(selection.right, selection.y);
    await page.mouse.up();
    await expect(page.locator('.persistent-selection')).toBeVisible();
    await expect(otherSwatch).toHaveCSS('background-color', originalOtherColor);
    await expect(swatch).toHaveCSS('background-color', 'rgb(161, 37, 67)');
    await expect.poll(() => renderedSeriesColors(canvas, 'value:cost:east | SavingsPlan')).toEqual({
      border: '#a12543', elements: ['#a12543' + (barChart ? '66' : '')],
    });
    // Pointer hover must not reintroduce cached colors.
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect.poll(() => renderedSeriesColors(canvas, 'value:cost:east | SavingsPlan')).toEqual({
      border: '#a12543', elements: ['#a12543' + (barChart ? '66' : '')],
    });
    await page.getByRole('button', { name: 'Cancel selection', exact: true }).click();
    await expect(otherSwatch).toHaveCSS('background-color', originalOtherColor);
    await page.getByRole('switch', { name: 'Toggle bar chart', exact: true }).click();
    await expect.poll(() => renderedSeriesColors(canvas, 'value:cost:east | SavingsPlan')).toEqual({
      border: '#a12543', elements: ['#a12543' + (barChart ? '' : '66')],
    });
  });
}

async function renderedSeriesColors(canvas: any, key: string) {
  return canvas.evaluate((element: any, seriesKey: string) => {
    const chart = element.__vueParentComponent.exposed.chart.value;
    const index = chart.data.datasets.findIndex((dataset: any) => dataset.seriesKey === seriesKey);
    const meta = chart.getDatasetMeta(index);
    return { border: chart.data.datasets[index].borderColor,
      elements: [...new Set(meta.data.map((point: any) => point.options.backgroundColor))] };
  }, key);
}
