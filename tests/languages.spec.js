import { test, expect } from '@playwright/test';

const englishTitles = [
  'TPK COSMOSPRAY',
  'Delta Security',
  'Solok Cosmetics',
  'Dubovaya Roshcha dog shelter',
];

test('language links navigate both ways and English stays English after reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'ENG', exact: true }).click();
  await expect(page).toHaveURL(/\/en\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Helena Garmaeva — product designer');
  await expect(page.getByRole('heading', { name: 'Helena Garmaeva', exact: true })).toBeVisible();
  await expect(page.locator('#portrait')).toHaveAttribute('alt', 'Helena Garmaeva');
  await expect(page.locator('.project-name .sr-only')).toHaveText(englishTitles);
  await page.reload();
  await expect(page.locator('.project-name .sr-only')).toHaveText(englishTitles);
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  expect(await page.locator('[aria-label], img[alt]').evaluateAll(elements =>
    elements.map(el => el.getAttribute('aria-label') || el.getAttribute('alt')).join(' ')
  )).not.toMatch(/[А-Яа-яЁё]/);
  const cv = page.getByRole('link', { name: 'CV', exact: true });
  await expect(cv).toHaveAttribute('href', new URL('./HelenagrmvCVEng.pdf', page.url()).href);
  expect((await page.request.get(await cv.getAttribute('href'))).ok()).toBe(true);
  await page.getByRole('link', { name: 'Go to case studies' }).click();
  await expect.poll(() => page.locator('#cases').evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(0, 0);
  for (const cover of await page.locator('.project-cover').all()) {
    await cover.scrollIntoViewIfNeeded();
    await expect.poll(() => cover.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: 'Елена Гармаева', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'CV', exact: true })).toHaveAttribute('href', new URL('./HelenagrmvCV.pdf', page.url()).href);
});

test('English text and case reveals fit narrow touch screens', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('./en.html');
  await expect(page.locator('.contacts')).toHaveCSS('opacity', '1');
  await expect(page.locator('.cursor-ring')).toHaveCount(0);
  const originalBio = await page.locator('.bio p .sr-only').allTextContents();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.locator('.bio p').evaluateAll(elements => elements.map(el =>
      [...el.querySelectorAll('.reveal-line')].map(line => line.textContent).join(' ')
    ))).toEqual(originalBio);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.bio .reveal-line, .project-name, .project-description .reveal-line').evaluateAll(elements =>
      elements.every(el => el.scrollWidth <= el.clientWidth + 1)
    )).toBe(true);
  }
  const project = page.locator('.project').first();
  await expect(project).not.toHaveClass(/is-visible/);
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.getByRole('link', { name: 'Go to case studies' }).tap();
    await expect(project).toHaveClass(/is-visible/);
    await expect.poll(() => project.locator('.reveal-letter').first().evaluate(el =>
      new DOMMatrix(getComputedStyle(el).transform).m42
    )).toBe(0);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(project).toHaveClass(/is-visible/);
    expect(await project.locator('.reveal-letter').first().evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBe(0);
  }
  await page.getByRole('link', { name: 'RU', exact: true }).tap();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await context.close();
});

test('both language pages and their navigation work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('./');
  await page.getByRole('link', { name: 'ENG', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Helena Garmaeva', exact: true })).toBeVisible();
  await expect(page.locator('.project-name')).toHaveText(englishTitles);
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await context.close();
});
