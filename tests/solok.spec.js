import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
});

test('Solok links preserve the language from home, Delta, and the language switch', async ({ page }) => {
  for (const [home, delta, destination] of [
    ['index.html', 'delta.html', 'solok.html'],
    ['en.html', 'delta-en.html', 'solok-en.html'],
  ]) {
    await page.goto(`./${home}`);
    const project = page.locator('[data-project="3"]');
    await expect(project).toHaveAttribute('href', new URL(destination, page.url()).href);
    await project.click();
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    await expect(page.getByRole('heading', { name: 'Solok Cosmetics', exact: true })).toBeVisible();
    await page.goto(`./${delta}`);
    await page.locator('.case-link--next').click();
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
  }
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(/\/solok\.html$/);
  await page.getByRole('link', { name: 'ENG', exact: true }).click();
  await expect(page).toHaveURL(/\/solok-en\.html$/);
  await page.locator('.case-back a').click();
  await expect(page).toHaveURL(/\/en\.html#cases$/);
});

test('Solok has two desktop columns, four demos, and a single column on mobile', async ({ page }) => {
  for (const path of ['solok.html', 'solok-en.html']) {
    for (const width of [1440, 320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`./${path}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.case-hero-media').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(900);
      await expect(page.locator('.case-screen-item')).toHaveCount(4);
      const geometry = await page.locator('.case-screen-item').evaluateAll(elements => elements.map(el => {
        const { left, top, width } = el.getBoundingClientRect();
        return { left, top, width };
      }));
      if (width > 760) {
        expect(geometry[0].top).toBe(geometry[1].top);
        expect(geometry[2].top).toBe(geometry[3].top);
        expect(geometry[1].left).toBeGreaterThan(geometry[0].left);
        expect(geometry[2].left).toBe(geometry[0].left);
      } else {
        expect(new Set(geometry.map(r => r.left)).size).toBe(1);
        for (let i = 1; i < geometry.length; i++) expect(geometry[i].top).toBeGreaterThan(geometry[i - 1].top);
      }
    }
  }
});

test('Solok reuses one-time reveals when scrolling back or resizing', async ({ page }) => {
  await page.goto('./solok.html');
  const research = page.locator('#research-title').locator('..');
  await research.scrollIntoViewIfNeeded();
  await expect(research).toHaveClass(/is-visible/);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(research).toHaveClass(/is-visible/);
  await expect(research).toHaveCSS('opacity', '1');
});
