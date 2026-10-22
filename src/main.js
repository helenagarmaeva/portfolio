import './style.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { content } from './content.js';
import { CursorPaint } from './cursor-paint.js';
import { ScrollReveals } from './reveals.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let smoothScroll;

function setupScrolling() {
  smoothScroll?.destroy();
  smoothScroll = null;
  if (!finePointer.matches || reducedMotion.matches) return;
  smoothScroll = new Lenis({
    autoRaf: true,
    smoothWheel: true,
    syncTouch: false,
    lerp: .085,
    wheelMultiplier: .9,
  });
}
setupScrolling();
finePointer.addEventListener('change', setupScrolling);
reducedMotion.addEventListener('change', setupScrolling);
document.querySelector('.scroll-cue').addEventListener('click', event => {
  event.preventDefault();
  if (location.hash !== '#cases') history.pushState(null, '', '#cases');
  const section = document.querySelector('#cases');
  const top = Math.round(section.getBoundingClientRect().top + scrollY);
  if (smoothScroll) smoothScroll.scrollTo(top, { duration: 1.3 });
  else window.scrollTo({ top, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
});
const backToTop = document.querySelector('.back-to-top');
function scrollToTop(event) {
  event.preventDefault();
  if (smoothScroll) smoothScroll.scrollTo(0, { duration: 1.3 });
  else window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}
backToTop.addEventListener('click', scrollToTop);

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function linkButton(button, value, { external = true } = {}) {
  const url = safeUrl(value);
  if (!url) return;
  const link = document.createElement('a');
  [...button.attributes].forEach(attribute => {
    if (attribute.name !== 'type') link.setAttribute(attribute.name, attribute.value);
  });
  link.href = url;
  if (external) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.append(...button.childNodes);
  button.replaceWith(link);
}

const portraitUrl = safeUrl(content.portrait);
if (portraitUrl) {
  const portrait = document.querySelector('#portrait');
  portrait.src = portraitUrl;
  portrait.alt = content.portraitAlt;
}
document.querySelectorAll('[data-contact]').forEach(button => {
  linkButton(button, content.contacts[button.dataset.contact]);
});
document.querySelectorAll('[data-project]').forEach((button, index) => {
  const project = content.projects[index];
  if (!project) return;
  button.querySelector('.project-name').textContent = project.title;
  button.querySelector('.project-description').textContent = project.description;
  const coverUrl = safeUrl(project.cover);
  if (coverUrl) {
    const cover = button.querySelector('.project-cover');
    const image = new Image();
    image.src = coverUrl;
    image.alt = project.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    cover.replaceChildren(image);
  }
  linkButton(button, project.url, { external: false });
});

const reveals = new ScrollReveals(reducedMotion);

const portraitFrame = document.querySelector('.portrait');
const portraitHeading = document.querySelector('#intro-title');
const portraitMotionAbort = new AbortController();
let portraitShift = 0;
let portraitMaxShift = 0;
function updatePortraitScroll() {
  portraitShift = reducedMotion.matches ? 0 : Math.min(portraitMaxShift, Math.max(0, scrollY) * .12);
  portraitFrame.style.setProperty('--portrait-shift', `${portraitShift}px`);
}
function measurePortraitScroll() {
  // Subtract the current translation to measure the original layout gap.
  portraitMaxShift = Math.max(0, portraitHeading.getBoundingClientRect().top - portraitFrame.getBoundingClientRect().bottom + portraitShift - 8);
  updatePortraitScroll();
}
window.addEventListener('scroll', updatePortraitScroll, { passive: true, signal: portraitMotionAbort.signal });
window.addEventListener('resize', measurePortraitScroll, { signal: portraitMotionAbort.signal });
reducedMotion.addEventListener('change', updatePortraitScroll, { signal: portraitMotionAbort.signal });
const portraitLayoutObserver = new ResizeObserver(measurePortraitScroll);
portraitLayoutObserver.observe(document.querySelector('.intro-layout'));
measurePortraitScroll();

const fluid = new CursorPaint(document.querySelector('.fluid-background'), { reducedMotion, portrait: document.querySelector('#portrait') });
fluid.start();
window.addEventListener('pagehide', () => fluid.pause());
window.addEventListener('pageshow', () => fluid.start());

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    backToTop.removeEventListener('click', scrollToTop);
    fluid.destroy();
    reveals.destroy();
    portraitMotionAbort.abort();
    portraitLayoutObserver.disconnect();
    portraitFrame.style.removeProperty('--portrait-shift');
    smoothScroll?.destroy();
  });
}
