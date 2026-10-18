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

test('Solok has two desktop columns, three demos, and a single column on mobile', async ({ page }) => {
  for (const path of ['solok.html', 'solok-en.html']) {
    for (const width of [1440, 320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`./${path}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.case-hero-media').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(900);
      await expect(page.locator('.case-screen-item')).toHaveCount(3);
      const charts = await page.locator('.solok-research-grid .case-media').evaluateAll(elements => elements.map(el => {
        const { width, height } = el.getBoundingClientRect();
        return { width, height };
      }));
      expect(charts[0].width).toBe(charts[1].width);
      expect(charts[0].height).toBe(charts[1].height);
      const geometry = await page.locator('.case-screen-item').evaluateAll(elements => elements.map(el => {
        const { left, top, width } = el.getBoundingClientRect();
        return { left, top, width };
      }));
      if (width > 760) {
        expect(geometry[0].top).toBe(geometry[1].top);
        expect(geometry[2].top).toBeGreaterThan(geometry[0].top);
        expect(geometry[1].left).toBeGreaterThan(geometry[0].left);
        expect(geometry[2].width).toBeCloseTo(geometry[0].width, 0);
        expect(geometry[2].left + geometry[2].width / 2).toBeCloseTo(width / 2, 0);
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

test('Solok materials load and all three desktop demos play only on interaction', async ({ page }) => {
  const failures = [];
  page.on('response', response => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto('./solok.html');
  await expect(page.locator('[data-solok-slot], .solok-draft-note')).toHaveCount(0);
  await expect(page.locator('.solok-prototype-note, [src*="SolokCart"]')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/прототип|корзин/i);
  await expect(page.locator('.solok-mobile-grid img').nth(1)).toHaveAttribute('src', './solok/mobile-builder.png');
  await expect(page.locator('.solok-mobile-grid figcaption').nth(1).locator('.reveal-text')).toHaveText('Конструктор скраба');
  const hero = page.locator('.case-hero-media video');
  await expect.poll(() => hero.evaluate(el => !el.paused && el.videoWidth === 1600)).toBe(true);
  await hero.evaluate(el => { el.currentTime = el.duration - .15; });
  await expect.poll(() => hero.evaluate(el => !el.paused && el.currentTime < 1)).toBe(true);
  for (const image of await page.locator('.solok-image-item img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth >= 780)).toBe(true);
  }
  const demos = page.locator('.case-screen-media');
  for (const demo of await demos.all()) {
    await demo.scrollIntoViewIfNeeded();
    const video = demo.locator('video');
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    await demo.hover();
    await expect.poll(() => video.evaluate(el => !el.paused && el.videoWidth === 1280)).toBe(true);
    await page.mouse.move(0, 0);
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  }
  expect(failures).toEqual([]);
});

test('Solok mobile demos start paused and toggle by tapping in both languages', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  for (const path of ['solok.html', 'solok-en.html']) {
    await page.goto(`./${path}`);
    const hero = page.locator('.case-hero-media video');
    await expect.poll(() => hero.evaluate(el => el.currentSrc.endsWith('/SolokMain-cursor-mobile-60.mp4') && el.videoWidth === 960)).toBe(true);
    const demos = page.locator('.case-screen-media');
    for (const demo of await demos.all()) {
      await demo.scrollIntoViewIfNeeded();
      const video = demo.locator('video');
      await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
      await demo.locator('.video-toggle').tap();
      await expect.poll(() => video.evaluate(el => !el.paused)).toBe(true);
      await demo.locator('.video-toggle').tap();
      await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    }
  }
  await context.close();
});
