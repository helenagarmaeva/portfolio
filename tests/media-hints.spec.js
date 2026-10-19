import {test,expect} from '@playwright/test';

async function withoutGpu(context) {
  await context.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
  });
}
for(const slug of ['delta','solok','cosmospray'])test(`${slug}: touch play hint disappears after playback and stays hidden on pause`,async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await withoutGpu(context);
  const page=await context.newPage();
  for(const suffix of ['', '-en']){
    await page.goto(`./${slug}${suffix}.html`);
    const frame=page.locator('.case-screen-media').first();await frame.scrollIntoViewIfNeeded();
    const video=frame.locator('video'),toggle=frame.locator('.video-toggle');
    await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
    await expect.poll(()=>toggle.evaluate(b=>getComputedStyle(b,'::after').opacity)).toBe('1');
    await toggle.tap();await expect.poll(()=>video.evaluate(v=>!v.paused&&v.currentTime>.1)).toBe(true);
    await expect.poll(()=>toggle.evaluate(b=>getComputedStyle(b,'::after').opacity)).toBe('0');
    await toggle.tap();await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(true);
    expect(await toggle.evaluate(b=>getComputedStyle(b,'::after').opacity)).toBe('0');
  }
  await context.close();
});

test('desktop videos keep the play hint hidden',async({page})=>{
  await withoutGpu(page);await page.goto('./delta.html');
  const toggle=page.locator('.case-screen-media .video-toggle').first();
  expect(await toggle.evaluate(b=>getComputedStyle(b,'::after').content)).toBe('none');
});
