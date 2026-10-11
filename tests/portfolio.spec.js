import { test, expect } from '@playwright/test';

test('first screen, fixed language switch and exact custom cursor', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Гармаева Елена' })).toBeVisible();
  await expect(page.locator('.intro-copy > .reveal').first()).toHaveCSS('opacity', '1');
  const hero = await page.locator('.hero').boundingBox();
  expect(hero.height).toBe(1000);
  await page.mouse.move(800, 600);
  const cursor = page.locator('.cursor-ring');
  await expect(cursor).toHaveCSS('width', '20px');
  await expect(cursor).toHaveCSS('height', '20px');
  await expect(cursor).toHaveCSS('border-top-width', '1px');
  await expect(cursor).toHaveCSS('border-top-color', 'rgb(231, 231, 231)');
  await expect(cursor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('body')).toHaveCSS('cursor', 'none');
  await expect.poll(async () => (await cursor.boundingBox()).x).toBe(790);
  const language = page.getByRole('button', { name: 'ENG' });
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
    const button = page.locator(`[data-contact="${name.toLowerCase()}"]`);
    await expect(button).toHaveCSS('font-size', '20px');
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '0');
    await button.hover();
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '1');
    await expect.poll(() => button.locator('.link-arrow').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m12)).toBeCloseTo(-Math.SQRT1_2, 4);
    await expect.poll(async () => button.locator('.roll-label').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-15);
    if (await button.evaluate(el => el.tagName === 'A')) {
      await expect(button).toHaveAttribute('target', '_blank');
      await expect(button).toHaveAttribute('rel', 'noopener noreferrer');
    } else {
      const url = page.url();
      await button.click();
      expect(page.url()).toBe(url);
    }
    await page.mouse.move(30, 30);
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '0');
  }
  await expect(page.getByRole('link', { name: 'Telegram', exact: true })).toHaveAttribute('href', 'https://t.me/hgrmv');
  await expect(page.getByRole('link', { name: 'LinkedIn', exact: true })).toHaveAttribute('href', 'https://www.linkedin.com/in/helena-garmaeva/');
  const email = page.getByRole('link', { name: 'lenputka@gmail.com' });
  await expect(email).toHaveCSS('font-size', '20px');
  await expect(email).toHaveAttribute('href', 'mailto:lenputka@gmail.com');
  await email.hover();
  await expect.poll(() => email.evaluate(el => new DOMMatrix(getComputedStyle(el, '::after').transform).m11)).toBe(1);
  const cv = page.getByRole('link', { name: 'CV', exact: true });
  await expect(cv).toHaveAttribute('href', new URL('./ResumeEG.pdf', page.url()).href);
  const pdf = await page.request.get(await cv.getAttribute('href'));
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
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
  await expect.poll(() => page.locator('#cases').evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(0, 0);
  expect((await page.locator('.hero').boundingBox()).y + (await page.locator('.hero').boundingBox()).height).toBeLessThanOrEqual(1);
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

test('cases replay after leaving the reveal area on every return', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('./');
  const project = page.locator('.project').first();
  const letter = project.locator('.reveal-letter').first();
  await page.mouse.wheel(0, 1400);
  await expect(project).toHaveClass(/is-visible/);
  await expect.poll(() => letter.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBe(0);
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.mouse.wheel(0, -2000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    // Leave only 15px of the card visible below the observer's 20px inset.
    // Previously this exit never reset the card, even after a later return.
    await page.evaluate(() => {
      const top = document.querySelector('.project').getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top - innerHeight + 15, behavior: 'instant' });
    });
    await expect(project).not.toHaveClass(/is-visible/);
    await expect.poll(() => letter.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-100);
    await page.mouse.wheel(0, 1200);
    await expect(project).toHaveClass(/is-visible/);
    const positions = await letter.evaluate(el => new Promise(resolve => {
      const values = [];
      const started = performance.now();
      const sample = now => {
        values.push(new DOMMatrix(getComputedStyle(el).transform).m42);
        if (now - started >= 1450) resolve(values);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    expect(positions.some(value => value < -1)).toBe(true);
    expect(Math.abs(positions.at(-1))).toBeLessThan(.01);
  }
});

test('text reveals move through masks and reflow without losing words', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('./');
  const originalBio = await page.locator('.bio p .sr-only').allTextContents();
  const headingLetter = page.locator('#cases-title .reveal-letter').first();
  expect(await headingLetter.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeGreaterThan(20);
  await page.getByRole('link', { name: 'Перейти к кейсам' }).click();
  await expect(page.locator('#cases-title')).toHaveClass(/is-visible/);
  const motion = await headingLetter.evaluate(el => new Promise(resolve => {
    const positions = [];
    const started = performance.now();
    const sample = now => {
      positions.push(new DOMMatrix(getComputedStyle(el).transform).m42);
      if (now - started > 900) resolve(positions);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(motion.some(value => value > 1 && value < 40)).toBe(true);
  // Image/font readiness and smooth scrolling can shift the reveal start.
  // Check completion separately from the captured intermediate movement.
  await expect.poll(() => headingLetter.evaluate(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m42))).toBeLessThan(.01);
  await expect.poll(() => page.locator('.project-description').first().locator('.reveal-line').allTextContents()).toEqual(['Web, В2В, E-com, Graphic design']);
  await page.setViewportSize({ width: 840, height: 1000 });
  await page.mouse.wheel(0, -1600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('.bio')).toHaveClass(/is-visible/);
  await expect.poll(() => page.locator('.bio p').evaluateAll(elements => elements.map(element =>
    [...element.querySelectorAll('.reveal-line')].map(line => line.textContent).join(' ')
  ))).toEqual(originalBio);
  await expect.poll(() => page.locator('.bio .reveal-line').evaluateAll(lines =>
    lines.every(line => line.scrollWidth <= line.clientWidth + 1)
  )).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.bio p').first()).toHaveText(originalBio[0]);
  await expect(page.locator('.bio .reveal-line')).toHaveCount(0);
  // A short case list must still occupy a full screen on a tall display.
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.getByRole('link', { name: 'Перейти к кейсам' }).click();
  await expect.poll(() => page.locator('#cases').evaluate(el => el.getBoundingClientRect().top)).toBe(0);
  expect((await page.locator('#cases').boundingBox()).height).toBeGreaterThanOrEqual(1800);
});

test('darkened covers zoom smoothly inside a fixed borderless frame on hover', async ({ page }) => {
  await page.goto('./');
  for (const cover of await page.locator('.project-cover').all()) {
    await cover.scrollIntoViewIfNeeded();
    await expect(cover).toHaveCSS('clip-path', 'inset(0px round 16px)');
    const image = cover.locator('img');
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveCSS('filter', 'brightness(0.75)');
    await expect(cover).toHaveCSS('border-top-width', '0px');
    await expect(cover).toHaveCSS('transform', 'none');
    const bounds = await cover.boundingBox();
    await cover.hover({ position: { x: bounds.width * .85, y: bounds.height * .25 } });
    await expect.poll(() => image.evaluate(img => new DOMMatrix(getComputedStyle(img).transform).m11)).toBeCloseTo(1.05, 4);
    await expect(cover).toHaveCSS('transform', 'none');
    await expect(cover).toHaveCSS('border-top-width', '0px');
    await page.mouse.move(20, 20);
    await expect(image).toHaveCSS('transform', 'none');
  }
});

test('long project captions wrap without clipping or duplicated subtitle lines on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('./');
  await page.getByRole('link', { name: 'Перейти к кейсам' }).tap();
  const descriptions = ['Web, В2В, E-com, Graphic design', 'Web, В2В, Dashboard', 'Web, В2С, E-com, Graphic design', 'Illustration, Graphic design'];
  const firstDescription = page.locator('.project-description').first();
  await expect.poll(() => firstDescription.locator('.reveal-line').allTextContents().then(lines => lines.join(' '))).toBe(descriptions[0]);
  expect(await firstDescription.locator('.reveal-line').count()).toBeGreaterThan(1);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.locator('.project-description').evaluateAll(elements => elements.map(el =>
      [...el.querySelectorAll('.reveal-line')].map(line => line.textContent).join(' ')
    ))).toEqual(descriptions);
    expect(await page.locator('.project-name, .project-name .reveal-word-mask, .project-description .reveal-line').evaluateAll(elements =>
      elements.every(el => el.scrollWidth <= el.clientWidth + 1)
    )).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await context.close();
});

test('WebGL keeps a flat black background and paints a fading chromatic cursor trail', async ({ page }) => {
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
      const x = Math.floor(350 / innerWidth * el.width);
      const y = Math.floor((1 - 750 / innerHeight) * el.height);
      // The Lusion-style brush shades the edges, so sample the painted region
      // rather than assuming the centre is an opaque coloured smoke plume.
      const height = Math.floor(160 / innerHeight * el.height);
      const width = Math.floor(900 / innerWidth * el.width);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(x, y - Math.floor(height / 2), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let brightest = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        brightest = Math.max(brightest, pixels[i] + pixels[i + 1] + pixels[i + 2]);
      }
      resolve(brightest);
    });
  }));
  const before = await brightness();
  expect(before).toBe(0);
  await page.mouse.move(400, 750);
  await page.mouse.move(1100, 750, { steps: 24 });
  await expect.poll(brightness).toBeGreaterThan(before + 18);
  await page.waitForTimeout(4500);
  // Resume one frame without adding a brush stroke after the idle clear.
  await page.mouse.move(1101, 751);
  await expect.poll(brightness).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1150));
  await page.mouse.move(350, 700);
  await page.mouse.move(1000, 700, { steps: 24 });
  await expect(canvas).toHaveAttribute('data-motion', 'active');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds.y).toBe(0);
  expect(canvasBounds.height).toBe(1000);
  expect(errors).toEqual([]);
});

test('cursor refracts photo pixels, restores them, and follows the photo on scroll', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const canvas = page.locator('.fluid-background');
  await expect(canvas).toHaveAttribute('data-portrait', 'webgl');
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('#portrait')).toHaveCSS('opacity', '0');
  const bounds = await page.locator('.portrait').boundingBox();
  const readPhoto = () => canvas.evaluate((el, bounds) => new Promise(resolve => {
    requestAnimationFrame(() => {
      const gl = el.getContext('webgl2');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const scaleX = el.width / innerWidth, scaleY = el.height / innerHeight;
      const width = Math.floor(bounds.width * scaleX), height = Math.floor(bounds.height * scaleY);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(Math.floor(bounds.x * scaleX), Math.floor((innerHeight - bounds.y - bounds.height) * scaleY), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      resolve(Array.from(pixels));
    });
  }), bounds);
  await page.mouse.move(20, 20);
  const before = await readPhoto();
  expect(Math.max(...before.filter((_, index) => index % 4 !== 3))).toBeGreaterThan(100);
  await page.mouse.move(bounds.x - 15, bounds.y + bounds.height / 2);
  await page.mouse.move(bounds.x + bounds.width + 15, bounds.y + bounds.height / 2, { steps: 12 });
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height / 2 + 12, { steps: 8 });
  // An additive glow cannot darken originally bright pixels. This verifies
  // that the photograph itself is refracted instead of merely tinted.
  await expect.poll(async () => {
    const painted = await readPhoto();
    let darker = 0;
    for (let i = 0; i < before.length; i += 4) {
      const original = before[i] + before[i + 1] + before[i + 2];
      if (original > 150 && original - painted[i] - painted[i + 1] - painted[i + 2] > 40) darker++;
    }
    return darker;
  }).toBeGreaterThan(5);
  await page.waitForTimeout(4500);
  await page.mouse.move(bounds.x + 21, bounds.y + bounds.height / 2 + 13);
  await expect.poll(readPhoto).toEqual(before);
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: 'instant' }));
  await expect.poll(async () => (await readPhoto()).filter((_, index) => index % 4 !== 3).every(value => value === 0)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('.portrait')).toHaveCSS('opacity', '1');
  await expect.poll(readPhoto).toEqual(before);
  const recovered = await canvas.evaluate(el => new Promise(resolve => {
    const extension = el.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context recovery test requires WEBGL_lose_context');
    el.addEventListener('webglcontextlost', () => requestAnimationFrame(() => {
      const originalVisible = getComputedStyle(document.querySelector('#portrait')).opacity === '1';
      extension.restoreContext();
      resolve(originalVisible);
    }), { once: true });
    extension.loseContext();
  }));
  expect(recovered).toBe(true);
  await expect(canvas).toHaveAttribute('data-portrait', 'webgl');
  await page.mouse.move(20, 20);
  await expect.poll(readPhoto).toEqual(before);
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
  const email = page.getByRole('link', { name: 'lenputka@gmail.com' });
  await expect(email).toHaveCSS('font-size', '20px');
  expect(await email.evaluate(el => new DOMMatrix(getComputedStyle(el, '::after').transform).m11)).toBe(1);
  expect(await email.evaluate(el => getComputedStyle(el, '::after').height)).toBe('0.5px');
  for (const name of ['CV', 'Telegram', 'LinkedIn']) {
    const button = page.locator(`[data-contact="${name.toLowerCase()}"]`);
    await expect(button).toHaveCSS('font-size', '20px');
    await expect(button.locator('.link-arrow')).toHaveCSS('opacity', '1');
  }
  await expect(page.locator('#portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-portrait', 'image');
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const hero = await page.locator('.hero').boundingBox();
  expect(hero.height).toBeGreaterThanOrEqual(844);
  await expect(page.locator('[data-contact="telegram"]')).toBeVisible();
  await page.getByRole('link', { name: 'Перейти к кейсам' }).tap();
  await expect(page.locator('.project').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.project').first().locator('.link-arrow')).toHaveCSS('opacity', '1');
  await expect.poll(() => page.locator('#cases').evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(0, 0);
  expect(await page.locator('.project-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  await context.close();
});

test('mobile text moves through masks on repeated scroll and reflows at narrow widths', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('./');
  const originalBio = await page.locator('.bio p .sr-only').allTextContents();
  expect(originalBio).toHaveLength(2);
  const project = page.locator('.project').first();
  const headingLetter = page.locator('#cases-title .reveal-letter').first();
  const projectLetter = project.locator('.reveal-letter').first();
  const bioLine = page.locator('.bio .reveal-line').first();
  const sampleMotion = locator => locator.evaluate(el => new Promise(resolve => {
    const values = [];
    const started = performance.now();
    const sample = now => {
      values.push(new DOMMatrix(getComputedStyle(el).transform).m42);
      if (now - started >= 1500) resolve(values);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  for (let repeat = 0; repeat < 2; repeat++) {
    await expect(project).not.toHaveClass(/is-visible/);
    expect(await headingLetter.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeGreaterThan(20);
    expect(await projectLetter.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-100);
    await page.evaluate(() => window.scrollTo({ top: document.querySelector('#cases').offsetTop, behavior: 'instant' }));
    await expect(project).toHaveClass(/is-visible/);
    const [headingMotion, projectMotion] = await Promise.all([sampleMotion(headingLetter), sampleMotion(projectLetter)]);
    expect(headingMotion.some(value => value > 1 && value < 40)).toBe(true);
    expect(projectMotion.some(value => value < -1)).toBe(true);
    expect(Math.abs(headingMotion.at(-1))).toBeLessThan(.01);
    expect(Math.abs(projectMotion.at(-1))).toBeLessThan(.01);
    await expect(page.locator('.bio')).not.toHaveClass(/is-visible/);
    expect(await bioLine.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeGreaterThan(20);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('.bio')).toHaveClass(/is-visible/);
    const bioMotion = await sampleMotion(bioLine);
    expect(bioMotion.some(value => value > 1)).toBe(true);
    expect(Math.abs(bioMotion.at(-1))).toBeLessThan(.01);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => page.locator('.bio p').evaluateAll(elements => elements.map(element =>
    [...element.querySelectorAll('.reveal-line')].map(line => line.textContent).join(' ')
  ))).toEqual(originalBio);
  expect(await page.locator('.bio .reveal-line').evaluateAll(lines => lines.every(line => line.scrollWidth <= line.clientWidth + 1))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.bio .reveal-line')).toHaveCount(0);
  await expect(page.locator('.bio p').first()).toHaveText(originalBio[0]);
  await expect(project).toHaveCSS('opacity', '1');
  await context.close();
});

test('reduced motion disables the simulation and never hides content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-portrait', 'image');
  await expect(page.locator('#portrait')).toHaveCSS('opacity', '1');
  await expect(page.locator('.project').last()).toHaveCSS('opacity', '1');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  const cv = page.getByRole('link', { name: 'CV', exact: true });
  await cv.hover();
  await expect(cv.locator('.link-arrow')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-motion', 'active');
  await expect(page.locator('.fluid-background')).toHaveAttribute('data-portrait', 'webgl');
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
  await expect(page.locator('#portrait')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', { name: 'Гармаева Елена' })).toBeVisible();
  const cv = page.getByRole('link', { name: 'CV', exact: true });
  await cv.hover();
  await expect(cv.locator('.link-arrow')).toHaveCSS('opacity', '1');
});


test('touch devices keep all four supplied covers intact', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('./');
  for (const cover of await page.locator('.project-cover').all()) {
    await cover.scrollIntoViewIfNeeded();
    await expect.poll(() => cover.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await cover.tap();
    await expect(cover).toHaveCSS('border-top-width', '0px');
    await expect(cover.locator('img')).toHaveCSS('transform', 'none');
    await expect(cover.locator('img')).toHaveCSS('filter', 'brightness(0.75)');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
