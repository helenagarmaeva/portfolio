import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args) {
      return type === 'webgl2' ? null : original.call(this,type,...args);
    };
  });
});

test('shelter links and language switch keep the selected language',async ({ page }) => {
  for (const [home,solok,shelter,title] of [
    ['index.html','solok.html','shelter.html','Дубовая Роща'],
    ['en.html','solok-en.html','shelter-en.html','Dubovaya Roshcha'],
  ]) {
    await page.goto(`./${home}`);
    await expect(page.locator('[data-project="4"]')).toHaveAttribute('href',new URL(shelter,page.url()).href);
    await page.locator('[data-project="4"]').click();
    await expect(page.getByRole('heading',{ name:title,exact:true })).toBeVisible();
    await page.goto(`./${solok}`);
    await expect(page.locator('.case-link--next')).toHaveAttribute('href',`./${shelter}`);
  }
  await page.goto('./shelter.html');
  await page.getByRole('link',{ name:'ENG',exact:true }).click();
  await expect(page).toHaveURL(/\/shelter-en.html$/);
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await page.getByRole('link',{ name:'RU',exact:true }).click();
  await expect(page).toHaveURL(/\/shelter.html$/);
});

test('calendar keeps January–December order and updates its counter with keyboard, buttons and wheel',async ({ page }) => {
  await page.goto('./shelter.html');
  const months=['January','February','March','April','May','June','July','August','Sept','October','November','December'];
  expect(await page.locator('.calendar-slide img').evaluateAll(images => images.map(img => img.getAttribute('src').split('/').pop().split('.')[0]))).toEqual(months);
  const track=page.locator('.calendar-track');
  const counter=page.locator('.calendar-counter');
  await track.scrollIntoViewIfNeeded();
  await track.focus();
  for (let i=1;i<=12;i++) {
    await expect(counter).toHaveText(`${String(i).padStart(2,'0')}/12`);
    await expect(page.locator('.calendar-slide.is-active')).toHaveAttribute('data-month',String(i));
    if (i<12) await track.press('ArrowRight');
  }
  await expect(page.locator('.calendar-next')).toBeDisabled();
  await track.press('Home');
  await expect(counter).toHaveText('01/12');
  await page.locator('.calendar-next').click();
  await expect(counter).toHaveText('02/12');
  await page.locator('.calendar-previous').click();
  await expect(counter).toHaveText('01/12');
  await track.hover();
  await page.mouse.wheel(0,120);
  await expect(counter).not.toHaveText('01/12');
  await track.focus();
  await track.press('Home');
  await expect(counter).toHaveText('01/12');
  const box=await track.boundingBox();
  await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height/2,{steps:8});
  await page.mouse.up();
  await expect(counter).toHaveText('02/12');
});

test('shelter media fits desktop and mobile without page overflow',async ({ page }) => {
  for (const width of [1440,390,320]) {
    await page.setViewportSize({ width,height:1000 });
    await page.goto('./shelter.html');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.case-hero-media').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1000);
    await expect(page.locator('.shelter-card')).toHaveCount(4);
    const cols=await page.locator('.shelter-cards').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(width>760 ? 2 : 1);
    const track=page.locator('.calendar-track');
    await track.scrollIntoViewIfNeeded();
    await track.evaluate(el => { el.scrollLeft=el.scrollWidth; });
    await expect(page.locator('.calendar-counter')).toHaveText('12/12');
    for (const img of await page.locator('img').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth>0)).toBe(true);
    }
  }
});

test('mobile calendar responds to a native swipe and reduced motion keeps navigation available',async ({ browser }) => {
  const context=await browser.newContext({ viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce' });
  const page=await context.newPage();
  await page.goto('./shelter-en.html');
  const track=page.locator('.calendar-track');
  await track.scrollIntoViewIfNeeded();
  const box=await track.boundingBox();
  const client=await context.newCDPSession(page);
  const y=Math.min(800,box.y+box.height/2);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:335,y}]});
  for (const x of [290,235,180,125,65]) {
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
    await page.waitForTimeout(35);
  }
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.calendar-counter')).not.toHaveText('01/12');
  await page.locator('.calendar-next').click();
  await expect.poll(async()=>Number((await page.locator('.calendar-counter').textContent()).slice(0,2))).toBeGreaterThan(2);
  await context.close();
});
