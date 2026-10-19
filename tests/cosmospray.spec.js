import { test, expect } from '@playwright/test';

async function withoutGpu(target) {
  await target.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
  });
}
test.beforeEach(async ({page})=>withoutGpu(page));

test('COSMOSPRAY opens from home and neighboring cases in the selected language',async ({page})=>{
  for(const [home,destination,title,suffix] of [
    ['index.html','cosmospray.html','ТПК КОСМОСПРЭЙ',''],
    ['en.html','cosmospray-en.html','TPK COSMOSPRAY','-en'],
  ]){
    await page.goto(`./${home}`);
    const link=page.locator('[data-project="1"]');
    await expect(link).toHaveAttribute('href',new URL(destination,page.url()).href);
    await link.click();await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
    for(const neighbor of ['delta','shelter']){
      await page.goto(`./${neighbor}${suffix}.html`);
      await expect(page.locator('.case-pagination .case-link--back')).toHaveAttribute('href',`./${destination}`);
    }
  }
  await page.goto('./cosmospray.html');await page.getByRole('link',{name:'ENG',exact:true}).click();
  await expect(page).toHaveURL(/\/cosmospray-en\.html$/);
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await page.locator('.case-back a').click();await expect(page).toHaveURL(/\/en\.html#cases$/);
});

test('case sections, comparison frames and original diagrams fit desktop and mobile',async ({page})=>{
  for(const file of ['cosmospray.html','cosmospray-en.html'])for(const width of [1440,1280,390,320]){
    await page.setViewportSize({width,height:900});await page.goto(`./${file}`);await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.case-hero-media').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(900);
    await expect(page.locator('.case-body > .case-section')).toHaveCount(6);
    await expect(page.locator('.case-comparison-item')).toHaveCount(4);
    await expect(page.locator('.case-screens-grid > .case-screen-item')).toHaveCount(3);
    await expect(page.locator('.cosmospray-mobile-grid > figure')).toHaveCount(4);
    const columns=await page.locator('.case-summary').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width>760?3:1);
    const frames=await page.locator('.case-comparison-item .case-media').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.width/r.height;}));
    for(const ratio of frames)expect(ratio).toBeCloseTo(1440/1000,2);
  }
  for(const [selector,width,height] of [
    ['img[src="./UFCosmospray.png"]',2750,1517],
    ['img[src="./UIKitCosmospray.png"]',2406,1982],
  ]){
    const image=page.locator(selector);await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth)).toBe(width);
    expect(await image.evaluate(i=>i.naturalHeight)).toBe(height);
    const ratio=await image.evaluate(i=>{const r=i.getBoundingClientRect();return r.width/r.height;});
    expect(ratio).toBeCloseTo(width/height,2);
  }
});

test('main video loops and desktop screen demos play only during hover',async ({page})=>{
  await page.goto('./cosmospray.html');
  const main=page.locator('.case-hero-media video');
  await expect.poll(()=>main.evaluate(v=>!v.paused&&v.videoWidth===1600&&v.duration>5)).toBe(true);
  await main.evaluate(v=>{v.currentTime=v.duration-.12;});
  await expect.poll(()=>main.evaluate(v=>!v.paused&&v.currentTime<1)).toBe(true);
  for(const frame of await page.locator('.case-screen-media').all()){
    await frame.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
    const video=frame.locator('video');await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
    await frame.hover();await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>.15&&v.videoWidth===1280)).toBe(true);
    await page.mouse.move(0,0);await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
    const time=await video.evaluate(v=>v.currentTime);await frame.hover();
    await expect.poll(()=>video.evaluate((v,t)=>!v.paused&&v.currentTime>t,time)).toBe(true);
  }
  await expect(page.locator('video[controls]')).toHaveCount(0);
});

test('mobile screen videos begin paused and toggle with a tap in both languages',async ({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await withoutGpu(context);
  const page=await context.newPage();
  for(const file of ['cosmospray.html','cosmospray-en.html']){
    await page.goto(`./${file}`);
    await expect.poll(()=>page.locator('.case-hero-media video').evaluate(v=>v.videoWidth)).toBe(960);
    for(const frame of await page.locator('.case-screen-media').all()){
      await frame.scrollIntoViewIfNeeded();const video=frame.locator('video');const toggle=frame.locator('.video-toggle');
      await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
      await toggle.click();await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>.1)).toBe(true);
      await toggle.click();await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
    }
  }
  await context.close();
});
