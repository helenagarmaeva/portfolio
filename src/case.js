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

// Preserve the recording's aspect ratio and fit the complete header and video
// into the first viewport, including after a font load or orientation change.
const hero = document.querySelector('.case-hero');
const videoFrame = document.querySelector('.case-hero-media');
function fitHeroVideo() {
  const height = parseFloat(getComputedStyle(hero).minHeight);
  const top = videoFrame.getBoundingClientRect().top-hero.getBoundingClientRect().top;
  const available = Math.max(96,Math.floor(height-top-parseFloat(getComputedStyle(hero).paddingBottom)));
  const value = `${available}px`;
  if (videoFrame.style.getPropertyValue('--hero-video-height')!==value) videoFrame.style.setProperty('--hero-video-height',value);
}
const heroObserver = new ResizeObserver(fitHeroVideo);
heroObserver.observe(document.querySelector('.case-heading'));
heroObserver.observe(document.querySelector('.case-back'));
window.addEventListener('resize',fitHeroVideo,{ signal:abort.signal });
document.fonts.ready.then(fitHeroVideo);
fitHeroVideo();

const video = document.querySelector('video');
const toggle = document.querySelector('.video-toggle');
let userPaused = false;
let visible = false;
video.controls = false;
toggle.hidden = false;
function updateToggle() {
  toggle.setAttribute('aria-pressed',String(video.paused));
  toggle.setAttribute('aria-label',video.paused ? toggle.dataset.playLabel : toggle.dataset.pauseLabel);
}
function updatePlayback() {
  if (visible && !document.hidden && !reducedMotion.matches && !userPaused) video.play().catch(updateToggle);
  else video.pause();
  updateToggle();
}
toggle.addEventListener('click',() => {
  userPaused = !video.paused;
  if (video.paused) video.play().catch(updateToggle);
  else video.pause();
  updateToggle();
},{ signal:abort.signal });
for (const event of ['play','pause']) video.addEventListener(event,updateToggle,{ signal:abort.signal });
const videoObserver = new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  updatePlayback();
});
videoObserver.observe(videoFrame);
document.addEventListener('visibilitychange',updatePlayback,{ signal:abort.signal });
reducedMotion.addEventListener('change',updatePlayback,{ signal:abort.signal });
window.addEventListener('pagehide',() => { video.pause(); fluid.pause(); },{ signal:abort.signal });
window.addEventListener('pageshow',() => { updatePlayback(); fluid.start(); },{ signal:abort.signal });

if (import.meta.hot) import.meta.hot.dispose(() => {
  abort.abort(); heroObserver.disconnect(); videoObserver.disconnect();
  video.pause(); fluid.destroy(); reveals.destroy(); smoothScroll?.destroy();
});
