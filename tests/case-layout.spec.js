import { test, expect } from '@playwright/test';

for (const [width,height] of [[1440,900],[1280,720]]) {
  test(`case hero frames keep their size throughout a cold load at ${width}px`,async ({ browser }) => {
    for (const path of ['cosmospray.html','cosmospray-en.html','delta.html','delta-en.html','solok.html','solok-en.html','shelter.html','shelter-en.html']) {
      const context=await browser.newContext({ viewport:{width,height} });
      const page=await context.newPage();
      // Hold the scripts and fonts long enough to observe the CSS-only frame,
      // then verify neither reveals nor the loaded font resizes the media.
      await page.route(/\.(js|woff2)(\?.*)?$/,async route => {
        await new Promise(resolve=>setTimeout(resolve,350));
        await route.continue();
      });
      await page.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args) {
          return type==='webgl2' ? null : original.call(this,type,...args);
        };
        window.heroSamples=[];
        function sample() {
          const media=document.querySelector('.case-hero-media');
          const slot=document.querySelector('.case-hero-media-slot');
          if (media && slot && getComputedStyle(slot).containerType==='size') {
            const {width,height,top,bottom}=media.getBoundingClientRect();
            window.heroSamples.push({width,height,top,bottom});
          }
          window.heroSampleFrame=requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      await page.goto(`./${path}`);
      await page.evaluate(()=>document.fonts.ready);
      await expect(page.locator('html')).toHaveClass(/motion-ready/);
      await expect.poll(()=>page.evaluate(()=>window.heroSamples.length)).toBeGreaterThan(8);
      const samples=await page.evaluate(()=>{
        cancelAnimationFrame(window.heroSampleFrame);
        return window.heroSamples;
      });
      expect(samples.length,path).toBeGreaterThan(3);
      for (const metric of ['width','height','top']) {
        const values=samples.map(sample=>sample[metric]);
        expect(Math.max(...values)-Math.min(...values),`${path}: ${metric}`).toBeLessThan(1);
      }
      expect(samples[0].width).toBeGreaterThan(200);
      expect(samples[0].bottom).toBeLessThanOrEqual(height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await context.close();
    }
  });
}
