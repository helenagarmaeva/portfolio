import './style.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { content } from './content.js';
import { CursorPaint } from './cursor-paint.js';
import { ScrollReveals } from './reveals.js';
import { ProjectParallax } from './project-parallax.js';

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
const cursor = document.querySelector('.cursor-ring');
let cursorX = -100;
let cursorY = -100;
let pointerFrame;

function updateCursorMode() {
  document.documentElement.classList.toggle('has-custom-cursor', finePointer.matches);
  cursor.classList.remove('is-visible');
}
updateCursorMode();
finePointer.addEventListener('change', updateCursorMode);

// Pointer position is applied once per animation frame, without a slow lerp.
window.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || event.pointerType === 'touch') return;
  cursorX = event.clientX;
  cursorY = event.clientY;
  cursor.classList.add('is-visible');
  if (!pointerFrame) {
    pointerFrame = requestAnimationFrame(() => {
      cursor.style.transform = `translate3d(${cursorX - 10}px, ${cursorY - 10}px, 0)`;
      pointerFrame = null;
    });
  }
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
window.addEventListener('blur', () => cursor.classList.remove('is-visible'));
window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') cursor.classList.remove('is-visible');
}, { passive: true });

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function linkButton(button, value) {
  const url = safeUrl(value);
  if (!url) return;
  const link = document.createElement('a');
  [...button.attributes].forEach(attribute => {
    if (attribute.name !== 'type') link.setAttribute(attribute.name, attribute.value);
  });
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(...button.childNodes);
  button.replaceWith(link);
}

const portraitUrl = safeUrl(content.portrait);
if (portraitUrl) {
  const portrait = document.querySelector('#portrait');
  portrait.src = portraitUrl;
  portrait.alt = 'Елена Гармаева';
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
    const foregroundUrl = safeUrl(project.foreground);
    cover.style.setProperty('--source-ratio', project.sourceRatio || 1.68);
    if (project.foregroundMotion) cover.style.setProperty('--foreground-motion', `${project.foregroundMotion}px`);
    const scene = document.createElement('span');
    scene.className = 'project-scene';
    const layerImages = [];
    for (const [plane, url] of [['background', coverUrl], ['foreground', foregroundUrl]]) {
      if (!url) continue;
      const layer = document.createElement('span');
      layer.className = `project-layer project-${plane}`;
      const media = document.createElement('span');
      media.className = 'project-media';
      if (plane === 'foreground' && project.foregroundClip) media.style.clipPath = project.foregroundClip;
      const image = new Image();
      image.src = url;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      media.append(image); layer.append(media); scene.append(layer);
      layerImages.push(image);
    }
    // The supplied photograph is the idle/touch/failure view. Its clipped
    // pixels form the foreground, so lettering and illustrations stay exact.
    const original = document.createElement('span');
    original.className = 'project-original';
    const media = document.createElement('span');
    media.className = 'project-media';
    const image = new Image();
    image.src = foregroundUrl || coverUrl;
    image.alt = project.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image); original.append(media);
    cover.replaceChildren(scene, original);
    // Lazy loading should not decode all offscreen layers eagerly.
    const loaded = image => new Promise((resolve, reject) => {
      if (image.complete) return image.naturalWidth ? resolve() : reject();
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
    }).then(() => image.decode());
    Promise.all(layerImages.map(loaded)).then(() => cover.classList.add('layers-ready')).catch(() => {});
    if (foregroundUrl) { cover.classList.add('has-parallax'); cover.dataset.parallax = ''; }
  }
  linkButton(button, project.url);
});

const reveals = new ScrollReveals(reducedMotion);
const parallax = new ProjectParallax(reducedMotion);

const fluid = new CursorPaint(document.querySelector('.fluid-background'), { reducedMotion, portrait: document.querySelector('#portrait') });
fluid.start();
window.addEventListener('pagehide', () => fluid.pause());
window.addEventListener('pageshow', () => fluid.start());

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    fluid.destroy();
    reveals.destroy();
    parallax.destroy();
    smoothScroll?.destroy();
  });
}
