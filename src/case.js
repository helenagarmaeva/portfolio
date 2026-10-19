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

// Screen demos wait for mouse hover or an explicit tap / keyboard activation.
// All recordings pause off screen and share the existing cursor refraction.
const animations = [...document.querySelectorAll('[data-animated-media]')].map(frame => ({
  frame, video:frame.querySelector('video'), toggle:frame.querySelector('.video-toggle'),
  hoverOnly:frame.classList.contains('case-screen-media'), hovered:false,
  userPaused:false, manualPlayback:false, visible:false, hasPlayed:false,
}));
function updateToggle(item) {
  item.frame.classList.toggle('has-played',item.hasPlayed);
  item.toggle.setAttribute('aria-pressed',String(item.video.paused));
  item.toggle.setAttribute('aria-label',item.video.paused ? item.toggle.dataset.playLabel : item.toggle.dataset.pauseLabel);
}
const hoverControlled = item => item.hoverOnly && finePointer.matches;
const canPlay = item => item.visible && !document.hidden && !item.userPaused
  && (!reducedMotion.matches || item.manualPlayback)
  && (!item.hoverOnly || (finePointer.matches && item.hovered) || item.manualPlayback);
function applyPlayback(item) {
  if (canPlay(item)) item.video.play().catch(() => updateToggle(item));
  else item.video.pause();
  updateToggle(item);
}
function updatePlayback(item) {
  item.manualPlayback = false;
  applyPlayback(item);
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
    applyPlayback(item);
  },{ signal:abort.signal });
  for (const event of ['pointerenter','pointerleave']) item.frame.addEventListener(event,event => {
    if (event.pointerType==='touch') return;
    item.hovered = event.type==='pointerenter';
    if (!hoverControlled(item)) return;
    item.userPaused = false;
    updatePlayback(item);
  },{ signal:abort.signal });
  item.toggle.addEventListener('blur',() => {
    if (hoverControlled(item)) updatePlayback(item);
  },{ signal:abort.signal });
  for (const event of ['play','pause']) item.video.addEventListener(event,() => updateToggle(item),{ signal:abort.signal });
  item.video.addEventListener('playing',() => {
    item.hasPlayed = true;
    updateToggle(item);
  },{ signal:abort.signal });
  item.video.addEventListener('timeupdate',() => {
    // A media-query change can arrive while decoded frames are still queued.
    // Enforce automatic playback policy, while allowing an explicit Play.
    if (!item.video.paused && !canPlay(item)) item.video.pause();
  },{ signal:abort.signal });
  mediaObserver.observe(item.frame);
}
const updateAllPlayback = () => animations.forEach(updatePlayback);
document.addEventListener('visibilitychange',updateAllPlayback,{ signal:abort.signal });
reducedMotion.addEventListener('change',updateAllPlayback,{ signal:abort.signal });
finePointer.addEventListener('change',() => {
  for (const item of animations) item.hovered = item.frame.matches(':hover');
  updateAllPlayback();
},{ signal:abort.signal });
window.addEventListener('pagehide',() => { animations.forEach(item => item.video.pause()); fluid.pause(); },{ signal:abort.signal });
window.addEventListener('pageshow',() => { updateAllPlayback(); fluid.start(); },{ signal:abort.signal });

if (import.meta.hot) import.meta.hot.dispose(() => {
  abort.abort(); mediaObserver.disconnect();
  animations.forEach(item => item.video.pause());
  fluid.destroy(); reveals.destroy(); smoothScroll?.destroy();
});
