import { test, expect } from '@playwright/test';

async function withoutGpu(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args) {
      return type==='webgl2' ? null : original.call(this,type,...args);
    };
  });
}

test('Delta case is linked from both home pages and switches language in place', async ({ page }) => {
  await withoutGpu(page);
  for (const [home, destination, title] of [
    ['./','delta.html','ДельтаБезопасность'],
    ['./en.html','delta-en.html','Delta Security'],
  ]) {
    await page.goto(home);
    const project = page.locator('[data-project="2"]');
    await expect(project).toHaveAttribute('href',new URL(destination,page.url()).href);
    await expect(project).not.toHaveAttribute('target','_blank');
    await project.click();
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    await expect(page.getByRole('heading',{ name:title, exact:true })).toBeVisible();
  }
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await page.getByRole('link',{ name:'RU',exact:true }).click();
  await expect(page).toHaveURL(/\/delta\.html$/);
  await page.getByRole('link',{ name:'ENG',exact:true }).click();
  await expect(page).toHaveURL(/\/delta-en\.html$/);
  await page.getByRole('link',{ name:'Back to case studies',exact:true }).click();
  await expect(page).toHaveURL(/\/en\.html#cases$/);
});

test('case header and video fit the viewport, with aligned fixed navigation', async ({ browser }) => {
  for (const path of ['delta.html','delta-en.html']) for (const [width,height] of [[1440,900],[1280,720],[320,640]]) {
    const context = await browser.newContext({ viewport:{width,height},isMobile:width===320,hasTouch:width===320 });
    const page = await context.newPage();
    await withoutGpu(page);
    await page.goto(`./${path}`);
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('.case-hero-media').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height);
    expect(await page.locator('.case-hero-media').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.case-back .reveal-letter').evaluateAll(letters => new Set(letters.map(el => el.offsetTop)).size)).toBe(1);
    const fixed = await page.evaluate(() => {
      const language = document.querySelector('.language-button').getBoundingClientRect();
      const top = document.querySelector('.back-to-top').getBoundingClientRect();
      return { centerDifference:(language.left+language.right-top.left-top.right)/2,bottomGap:innerHeight-top.bottom };
    });
    expect(Math.abs(fixed.centerDifference)).toBeLessThan(1);
    expect(fixed.bottomGap).toBe(width <= 760 ? 36 : 48);
    await context.close();
  }
});

test('case back and project arrows point in the requested directions; top arrow returns to the start', async ({ page }) => {
  await withoutGpu(page);
  await page.goto('./delta.html');
  const back = page.locator('.case-back .case-link');
  await back.hover();
  await expect(back.locator('svg')).toHaveCSS('opacity','1');
  await expect.poll(() => back.locator('svg').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11)).toBeCloseTo(-1,4);
  for (const [selector,direction] of [['.case-pagination .case-link--back',-1],['.case-pagination .case-link--next',1]]) {
    const link = page.locator(selector);
    await link.hover();
    await expect(link.locator('svg')).toHaveCSS('opacity','1');
    await expect.poll(() => link.locator('svg').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11)).toBeCloseTo(direction,4);
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  await page.getByRole('link',{ name:'Наверх',exact:true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('all original screenshots load, crop from the top and remain eligible for refraction', async ({ page }) => {
  await page.goto('./delta.html');
  const images = page.locator('.case-comparison-item img');
  await expect(images).toHaveCount(4);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth>0)).toBe(true);
    await expect(image).toHaveClass(/is-distorted-media/);
    await expect(image).toHaveCSS('object-position','50% 0%');
    const ratio = await image.evaluate(el => { const r=el.getBoundingClientRect(); return r.width/r.height; });
    expect(ratio).toBeCloseTo(1200/760,2);
  }
  expect(await images.first().evaluate(el => el.naturalHeight)).toBe(15174);
  const uiKit = page.locator('.case-system-media img');
  await uiKit.scrollIntoViewIfNeeded();
  await expect(uiKit).toHaveClass(/is-distorted-media/);
  expect(await uiKit.evaluate(el => { const r=el.getBoundingClientRect(); return r.width/r.height; })).toBeCloseTo(794/566,2);
  await page.locator('.case-screens-grid').scrollIntoViewIfNeeded();
  for (const video of await page.locator('.case-screens-grid video').all()) {
    await expect(video).toHaveClass(/is-distorted-media/);
    await video.locator('..').locator('..').hover();
    await expect.poll(() => video.evaluate(el => !el.paused && el.readyState>=2)).toBe(true);
  }
  expect(await page.locator('canvas').evaluate(el => el.getContext('webgl2').getError())).toBe(0);
});

test('real case video refracts, restores, pauses and survives WebGL context loss', async ({ page }) => {
  await page.goto('./delta.html');
  const canvas = page.locator('.fluid-background');
  const video = page.locator('.case-hero-media video');
  await expect(canvas).toHaveAttribute('data-renderer','webgl');
  await expect(video).toHaveClass(/is-distorted-media/);
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
  await page.locator('.case-hero-media .video-toggle').click({position:{x:12,y:12}});
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await expect(page.locator('.case-hero-media')).toHaveCSS('opacity','1');
  // Wait for the sought frame to be presented and uploaded, not just decoded.
  await video.evaluate(el => new Promise(resolve => {
    const presented = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
    if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(presented);
    else el.addEventListener('seeked',presented,{once:true});
    el.currentTime=2;
  }));
  await expect.poll(() => video.evaluate(el => !el.seeking && el.readyState>=2)).toBe(true);
  const sample = () => page.evaluate(() => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const rect = document.querySelector('.case-hero-media').getBoundingClientRect();
    const x = Math.round(rect.left+rect.width*.55), y = Math.round(innerHeight-(rect.top+rect.height*.62));
    gl.drawArrays(gl.TRIANGLES,0,3);
    const bytes = new Uint8Array(150*100*4);
    gl.readPixels(x,y,150,100,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    return [...bytes];
  });
  const original = await sample();
  const rect = await page.locator('.case-hero-media').boundingBox();
  await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height*.5);
  for (let i=0; i<12; i++) {
    await page.mouse.move(rect.x+rect.width*(.42+i*.025),rect.y+rect.height*.53);
    await page.waitForTimeout(16);
  }
  const distorted = await sample();
  let darker = 0;
  for (let i=0; i<original.length; i+=4) if (original[i]+original[i+1]+original[i+2]-distorted[i]-distorted[i+1]-distorted[i+2]>25) darker++;
  expect(darker).toBeGreaterThan(10);
  await page.waitForTimeout(4300);
  const restored = await sample();
  expect(restored.reduce((sum,value,index) => sum+Math.abs(value-original[index]),0)).toBe(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(video).not.toHaveClass(/is-distorted-media/);
  await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(video).toHaveClass(/is-distorted-media/);
  await canvas.evaluate(el => {
    window.caseLoss = el.getContext('webgl2').getExtension('WEBGL_lose_context');
    window.caseLoss.loseContext();
  });
  await expect(video).not.toHaveClass(/is-distorted-media/);
  await page.evaluate(() => window.caseLoss.restoreContext());
  await expect(video).toHaveClass(/is-distorted-media/);
});

test('screen demos play on desktop hover, pause on exit and resume without restarting', async ({ page }) => {
  await withoutGpu(page);
  await page.goto('./delta.html');
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator('.case-hero-media video');
  await expect(hero.locator('source')).toHaveAttribute('src','./delta/DeltaMain-smooth.mp4');
  const sections = page.locator('.case-body > .case-section > .reveal > h2 > .sr-only');
  await expect(sections).toHaveText(['Редизайн','Экраны','Дизайн-система']);
  const frames = page.locator('.case-screen-item');
  await expect(frames.locator('figcaption .sr-only')).toHaveText(['Гибкая визуализация','Модальные окна','Карточка физ.лиц']);
  for (const [i,name] of ['DeltaData','DeltaModal','DeltaToggle'].entries()) {
    await expect(frames.nth(i).locator('source')).toHaveAttribute('src',`./delta/${name}-smooth.mp4`);
  }
  await expect.poll(() => hero.evaluate(el => el.paused)).toBe(false);
  await expect.poll(() => frames.locator('video').evaluateAll(elements => elements.every(el => el.paused))).toBe(true);
  await frames.first().scrollIntoViewIfNeeded();
  await expect.poll(() => hero.evaluate(el => el.paused)).toBe(true);
  await expect.poll(() => frames.locator('video').evaluateAll(elements => elements.every(el => el.paused && el.currentTime===0))).toBe(true);
  for (const frame of await frames.all()) {
    const video = frame.locator('video');
    await frame.locator('.case-screen-media').hover();
    await expect.poll(() => video.evaluate(el => !el.paused && el.currentTime>0 && el.readyState>=2)).toBe(true);
    await expect(video).not.toHaveClass(/is-distorted-media/);
    await expect.poll(() => frames.locator('video').evaluateAll(elements => elements.filter(el => !el.paused).length)).toBe(1);
    await page.mouse.move(20,200);
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
    const stoppedAt = await video.evaluate(el => el.currentTime);
    await page.waitForTimeout(150);
    expect(await video.evaluate(el => el.currentTime)).toBe(stoppedAt);
    await frame.locator('.case-screen-media').hover();
    await expect.poll(() => video.evaluate(el => !el.paused && el.currentTime)).toBeGreaterThan(stoppedAt);
    await page.mouse.move(20,200);
  }
  const positions = await frames.evaluateAll(elements => elements.map(el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  expect(Math.abs(positions[0].y-positions[1].y)).toBeLessThan(1);
  expect(positions[0].x+positions[0].width).toBeLessThan(positions[1].x);
  expect(positions[2].y).toBeGreaterThan(positions[0].y+positions[0].height);
  expect(positions[2].width).toBeCloseTo(positions[0].width,1);
  expect(positions[2].x+positions[2].width/2).toBeCloseTo((positions[0].x+positions[1].x+positions[1].width)/2,1);
  const keyboardToggle = frames.first().locator('.video-toggle');
  await keyboardToggle.focus();
  await keyboardToggle.press('Enter');
  await expect.poll(() => frames.first().locator('video').evaluate(el => el.paused)).toBe(false);
  await keyboardToggle.press('Tab');
  await expect.poll(() => frames.first().locator('video').evaluate(el => el.paused)).toBe(true);
  await frames.first().locator('.case-screen-media').hover();
  await expect.poll(() => frames.first().locator('video').evaluate(el => el.paused)).toBe(false);
  await page.locator('.case-system-media').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('video').evaluateAll(elements => elements.every(el => el.paused))).toBe(true);
  await page.mouse.move(20,200);
  await frames.first().scrollIntoViewIfNeeded();
  await expect.poll(() => frames.locator('video').evaluateAll(elements => elements.every(el => el.paused))).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await frames.first().locator('.case-screen-media').hover();
  await expect.poll(() => page.locator('video').evaluateAll(elements => elements.every(el => el.paused))).toBe(true);
  await expect(frames.locator('.is-distorted-media')).toHaveCount(0);
  const firstVideo = frames.first().locator('video');
  await firstVideo.evaluate(el => { el.currentTime=0; });
  await expect.poll(() => firstVideo.evaluate(el => !el.seeking)).toBe(true);
  await frames.first().locator('.video-toggle').click();
  await expect.poll(() => firstVideo.evaluate(el => !el.paused && el.currentTime)).toBeGreaterThan(.3);
  await page.mouse.move(20,200);
  await expect.poll(() => firstVideo.evaluate(el => el.paused)).toBe(true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('./delta-en.html');
  await frames.first().scrollIntoViewIfNeeded();
  await expect.poll(() => frames.locator('video').evaluateAll(elements => elements.every(el => el.paused))).toBe(true);
  await frames.first().locator('.case-screen-media').hover();
  await expect.poll(() => firstVideo.evaluate(el => !el.paused && el.currentTime>0)).toBe(true);
  await page.mouse.move(20,200);
  await expect.poll(() => firstVideo.evaluate(el => el.paused)).toBe(true);
});

test('updated English content and mobile animation fallbacks keep the new layout readable', async ({ browser }) => {
  for (const [path,captions] of [
    ['delta.html',['Гибкая визуализация','Модальные окна','Карточка физ.лиц']],
    ['delta-en.html',['Flexible visualization','Modal dialogs','Individual profile']],
  ]) {
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page = await context.newPage();
    await page.goto(`./${path}`);
    await page.evaluate(() => document.fonts.ready);
    const heroToggle = page.locator('.case-hero-media .video-toggle');
    const heroVideo = page.locator('.case-hero-media video');
    await expect.poll(() => heroVideo.evaluate(el => el.paused)).toBe(false);
    await heroToggle.tap();
    await expect.poll(() => heroVideo.evaluate(el => el.paused)).toBe(true);
    await heroToggle.tap();
    await expect.poll(() => heroVideo.evaluate(el => el.paused)).toBe(false);
    const frames = page.locator('.case-screen-item');
    await expect(frames.locator('figcaption .sr-only')).toHaveText(captions);
    for (const frame of await frames.all()) {
      await frame.scrollIntoViewIfNeeded();
      const video = frame.locator('video');
      await expect.poll(() => video.evaluate(el => !el.paused && el.readyState>=2)).toBe(true);
      await expect(video).not.toHaveClass(/is-distorted-media/);
      expect(await video.evaluate(el => el.controls)).toBe(false);
      await frame.locator('.video-toggle').tap();
      await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
      await frame.locator('.video-toggle').tap();
      await expect.poll(() => video.evaluate(el => el.paused)).toBe(false);
      expect(await video.evaluate(el => el.videoWidth)).toBeGreaterThan(900);
      expect(await frame.locator('figcaption').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(844);
    }
    const positions = await frames.evaluateAll(elements => elements.map(el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};}));
    expect(positions[0].x).toBe(positions[2].x);
    expect(positions[0].y+positions[0].height).toBeLessThan(positions[1].y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    if (path==='delta-en.html') expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
    await context.close();
  }
});

test('case text and media reveal only once, including after returning and reflowing', async ({ page }) => {
  await withoutGpu(page);
  for (const path of ['delta.html','delta-en.html']) {
    await page.goto(`./${path}`);
    await page.evaluate(() => document.fonts.ready);
    const elements = page.locator('[data-reveal]');
    const redesign = page.locator('#redesign-title').locator('..');
    await expect(redesign).not.toHaveClass(/is-visible/);
    for (const element of await elements.all()) {
      await element.scrollIntoViewIfNeeded();
      await expect(element).toHaveClass(/is-visible/);
    }
    await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
    await expect.poll(() => elements.evaluateAll(els => els.every(el => el.classList.contains('is-visible')))).toBe(true);
    await page.setViewportSize({width:1280,height:720});
    await expect.poll(() => elements.evaluateAll(els => els.every(el => el.classList.contains('is-instant')))).toBe(true);
    await page.evaluate(() => scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    expect(await elements.evaluateAll(els => els.every(el => getComputedStyle(el).opacity==='1'))).toBe(true);
    expect(await page.locator('.reveal-letter,.reveal-line').evaluateAll(els => els.every(el => new DOMMatrix(getComputedStyle(el).transform).m42===0))).toBe(true);
    await page.setViewportSize({width:1440,height:1000});
  }
});
