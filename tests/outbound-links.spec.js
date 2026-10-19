import {test,expect} from '@playwright/test';

test('case website buttons do not disclose the portfolio in headers or document.referrer',async({browser})=>{
  const context=await browser.newContext({reducedMotion:'reduce'});
  const requests=[];
  // Fulfil locally so the test does not generate visits to the client websites.
  await context.route(/^https:\/\/(cosmospray\.com|solokcosmetics\.ru)\//,async route=>{
    requests.push({url:route.request().url(),headers:await route.request().allHeaders()});
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Destination</title>'});
  });
  const page=await context.newPage();
  for(const [file,url]of [
    ['cosmospray.html','https://cosmospray.com/'],['cosmospray-en.html','https://cosmospray.com/'],
    ['solok.html','https://solokcosmetics.ru/'],['solok-en.html','https://solokcosmetics.ru/'],
  ]){
    await page.goto(`./${file}`);
    const [destination]=await Promise.all([context.waitForEvent('page'),page.locator('.case-website-link').click()]);
    await destination.waitForURL(url,{waitUntil:'domcontentloaded'});
    expect(requests.at(-1).url).toBe(url);
    expect(requests.at(-1).headers.referer).toBeUndefined();
    expect(await destination.evaluate(()=>document.referrer)).toBe('');
    expect(await destination.evaluate(()=>window.opener===null)).toBe(true);
    await destination.close();
  }
  expect(requests).toHaveLength(4);
  await context.close();
});
