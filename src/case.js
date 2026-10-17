import './style.css';
import './case.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { CursorPaint } from './cursor-paint.js';
import { ScrollReveals } from './reveals.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const abort = new AbortController();
let smoothScroll;
function setupScrolling() {
  smoothScroll?.destroy();
  smoothScroll = !reducedMotion.matches && finePointer.matches
    ? new Lenis({ autoRaf:true, smoothWheel:true, syncTouch:false, lerp:.085, wheelMultiplier:.9 })
    : null;
}
setupScrolling();
finePointer.addEventListener('change',setupScrolling,{ signal:abort.signal });
reducedMotion.addEventListener('change',setupScrolling,{ signal:abort.signal });
document.querySelector('.back-to-top').addEventListener('click',event => {
  event.preventDefault();
  if (smoothScroll) smoothScroll.scrollTo(0,{ duration:1.3 });
  else window.scrollTo({ top:0, behavior:reducedMotion.matches ? 'instant' : 'smooth' });
},{ signal:abort.signal });

const reveals = new ScrollReveals(reducedMotion);
const fluid = new CursorPaint(document.querySelector('.fluid-background'),{ reducedMotion });
fluid.start();

// Preserve the animation's aspect ratio and fit the complete header and media
// into the first viewport, including after a font load or orientation change.
const hero = document.querySelector('.case-hero');
const heroMedia = document.querySelector('.case-hero-media');
function fitHeroMedia() {
  const height = parseFloat(getComputedStyle(hero).minHeight);
  const top = heroMedia.getBoundingClientRect().top-hero.getBoundingClientRect().top;
  const available = Math.max(96,Math.floor(height-top-parseFloat(getComputedStyle(hero).paddingBottom)));
  const value = `${available}px`;
  if (heroMedia.style.getPropertyValue('--hero-media-height')!==value) heroMedia.style.setProperty('--hero-media-height',value);
}
const heroObserver = new ResizeObserver(fitHeroMedia);
heroObserver.observe(document.querySelector('.case-heading'));
heroObserver.observe(document.querySelector('.case-back'));
window.addEventListener('resize',fitHeroMedia,{ signal:abort.signal });
document.fonts.ready.then(fitHeroMedia);
fitHeroMedia();

// Each animation plays only while on screen. GIF recordings are served as
// lightweight video loops so their moving frames can share cursor refraction.
const animations = [...document.querySelectorAll('[data-animated-media]')].map(frame => ({
  frame, video:frame.querySelector('video'), toggle:frame.querySelector('.video-toggle'),
  userPaused:false, manualPlayback:false, visible:false,
}));
function updateToggle(item) {
  item.toggle.setAttribute('aria-pressed',String(item.video.paused));
  item.toggle.setAttribute('aria-label',item.video.paused ? item.toggle.dataset.playLabel : item.toggle.dataset.pauseLabel);
}
function updatePlayback(item) {
  item.manualPlayback = false;
  if (item.visible && !document.hidden && !reducedMotion.matches && !item.userPaused) item.video.play().catch(() => updateToggle(item));
  else item.video.pause();
  updateToggle(item);
}
const mediaObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const item = animations.find(item => item.frame===entry.target);
    item.visible = entry.isIntersecting;
    updatePlayback(item);
  }
});
for (const item of animations) {
  item.video.controls = false;
  item.toggle.hidden = false;
  item.toggle.addEventListener('click',() => {
    item.manualPlayback = item.video.paused;
    item.userPaused = !item.video.paused;
    if (item.video.paused) item.video.play().catch(() => updateToggle(item));
    else item.video.pause();
    updateToggle(item);
  },{ signal:abort.signal });
  for (const event of ['play','pause']) item.video.addEventListener(event,() => updateToggle(item),{ signal:abort.signal });
  item.video.addEventListener('timeupdate',() => {
    // A media-query change can arrive while decoded frames are still queued.
    // Enforce automatic playback policy, while allowing an explicit Play.
    if (!item.video.paused && (!item.visible || document.hidden || item.userPaused || (reducedMotion.matches && !item.manualPlayback))) item.video.pause();
  },{ signal:abort.signal });
  mediaObserver.observe(item.frame);
}
const updateAllPlayback = () => animations.forEach(updatePlayback);
document.addEventListener('visibilitychange',updateAllPlayback,{ signal:abort.signal });
reducedMotion.addEventListener('change',updateAllPlayback,{ signal:abort.signal });
window.addEventListener('pagehide',() => { animations.forEach(item => item.video.pause()); fluid.pause(); },{ signal:abort.signal });
window.addEventListener('pageshow',() => { updateAllPlayback(); fluid.start(); },{ signal:abort.signal });

if (import.meta.hot) import.meta.hot.dispose(() => {
  abort.abort(); heroObserver.disconnect(); mediaObserver.disconnect();
  animations.forEach(item => item.video.pause());
  fluid.destroy(); reveals.destroy(); smoothScroll?.destroy();
});
