import { test, expect } from '@playwright/test';

test('first screen, fixed language switch and exact custom cursor', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Гармаева Елена' })).toBeVisible();
  await expect(page.locator('.intro-copy > .reveal').first()).toHaveCSS('opacity', '1');
  const hero = await page.locator('.hero').boundingBox();
  expect(hero.height).toBe(1000);
  await page.mouse.move(800, 600);
  const cursor = page.locator('.cursor-ring');
  await expect(cursor).toHaveCSS('width', '16px');
  await expect(cursor).toHaveCSS('height', '16px');
  await expect(cursor).toHaveCSS('border-top-width', '1px');
  await expect(cursor).toHaveCSS('border-top-color', 'rgb(113, 113, 113)');
  await expect(cursor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('body')).toHaveCSS('cursor', 'none');
  await expect.poll(async () => (await cursor.boundingBox()).x).toBe(792);
  const language = page.getByRole('button', { name: 'Язык сайта — русский' });
  const before = await language.boundingBox();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(async () => (await language.boundingBox()).y).toBe(before.y);
  await language.hover();
  await expect(language).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('contact arrows, rolling text, email underline and keyboard focus', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.contacts')).toHaveCSS('opacity', '1');
  for (const name of ['CV', 'Telegram', 'LinkedIn']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '0');
    await button.hover();
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '1');
    await expect.poll(async () => button.locator('.roll-label').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-20);
    const url = page.url();
    await button.click();
    expect(page.url()).toBe(url);
    await page.mouse.move(30, 30);
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '0');
  }
  const email = page.getByRole('link', { name: 'helenagarm@gmail.com' });
  await expect(email).toHaveAttribute('href', 'mailto:helenagarm@gmail.com');
  await email.hover();
  await expect.poll(() => email.evaluate(el => new DOMMatrix(getComputedStyle(el, '::after').transform).m11)).toBe(1);
  const cv = page.getByRole('button', { name: 'CV', exact: true });
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(cv).toBeFocused();
  await expect(cv.locator('.link-arrow')).toHaveCSS('opacity', '1');
});

test('case navigation, scroll reveal and project arrows', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.project').first()).toHaveCSS('opacity', '0');
  await page.getByRole('link', { name: 'Перейти к кейсам' }).click();
  await expect(page).toHaveURL(/#cases$/);
  const first = page.locator('.project').first();
  await expect(first).toHaveCSS('opacity', '1');
  await first.locator('.project-button').hover();
  await expect(first.locator('.link-arrow')).toHaveCSS('opacity', '1');
  await expect.poll(() => first.locator('.project-name').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(36);
  await page.locator('.project').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.project').last()).toHaveCSS('opacity', '1');
});

test('wheel scroll progresses smoothly instead of jumping', async ({ page }) => {
  // Isolate input timing from software GPU rendering in headless Chromium.
  // The separate WebGL test verifies fluid rendering during scrolling.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveClass(/lenis/);
  await page.mouse.move(50, 500);
  const trajectory = page.evaluate(() => new Promise(resolve => {
    const positions = [];
    function sample() {
      positions.push(scrollY);
      if (positions.length === 22) resolve(positions);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  await page.mouse.wheel(0, 600);
  const positions = await trajectory;
  expect(Math.max(...positions)).toBeGreaterThan(150);
  const intermediate = new Set(positions.filter(value => value > 0 && value < Math.max(...positions) - 5));
  expect(intermediate.size).toBeGreaterThan(3);
});

test('WebGL draws a fluid trail behind text and also over the cases background', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const canvas = page.locator('.fluid-background');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
  const brightness = () => canvas.evaluate(el => new Promise(resolve => {
    requestAnimationFrame(() => {
      const gl = el.getContext('webgl2');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const x = Math.floor(900 / innerWidth * el.width);
      const y = Math.floor((1 - 750 / innerHeight) * el.height);
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      resolve(pixel[0] + pixel[1] + pixel[2]);
    });
  }));
  const before = await brightness();
  await page.mouse.move(400, 750);
  await page.mouse.move(1100, 750, { steps: 24 });
  await expect.poll(brightness).toBeGreaterThan(before + 18);
  await page.evaluate(() => window.scrollTo(0, 1150));
  await page.mouse.move(350, 700);
  await page.mouse.move(1000, 700, { steps: 24 });
  await expect(canvas).toHaveAttribute('data-motion', 'active');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds.y).toBe(0);
  expect(canvasBounds.height).toBe(1000);
  expect(errors).toEqual([]);
});

test('mobile layout keeps native touch scrolling and usable contacts', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('.bio')).toHaveCSS('opacity', '1');
  await expect(page.locator('.contacts')).toHaveCSS('opacity', '1');
  await expect(page.locator('.cursor-ring')).toHaveCSS('display', 'none');
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const hero = await page.locator('.hero').boundingBox();
  expect(hero.height).toBeGreaterThanOrEqual(844);
  await expect(page.getByRole('button', { name: 'Telegram', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Перейти к кейсам' }).tap();
  await expect(page.locator('.project').first()).toHaveCSS('opacity', '1');
  expect(await page.locator('.project-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  await context.close();
});

test('reduced motion disables the simulation and never hides content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.project').last()).toHaveCSS('opacity', '1');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  const cv = page.getByRole('button', { name: 'CV', exact: true });
  await cv.hover();
  await expect(cv.locator('.link-arrow')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-motion', 'active');
});

test('content and hover affordances remain usable without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('./');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-renderer', 'css');
  await expect(page.getByRole('heading', { name: 'Гармаева Елена' })).toBeVisible();
  const cv = page.getByRole('button', { name: 'CV', exact: true });
  await cv.hover();
  await expect(cv.locator('.link-arrow')).toHaveCSS('opacity', '1');
});
