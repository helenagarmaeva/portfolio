import './case.js';
import './shelter.css';

const track = document.querySelector('.calendar-track');
const slides = [...track.querySelectorAll('.calendar-slide')];
const counter = document.querySelector('.calendar-counter');
const previous = document.querySelector('.calendar-previous');
const next = document.querySelector('.calendar-next');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const abort = new AbortController();
const options = { signal:abort.signal };
let current = 0;
let frame;
let drag;

function position(index) {
  return slides[index].offsetLeft + slides[index].offsetWidth / 2 - track.clientWidth / 2;
}
function goTo(index) {
  index = Math.max(0, Math.min(slides.length - 1, index));
  track.scrollTo({ left:position(index), behavior:reducedMotion.matches ? 'instant' : 'smooth' });
}
function update() {
  frame = undefined;
  let nearest = 0;
  for (let i = 1; i < slides.length; i++) {
    if (Math.abs(position(i) - track.scrollLeft) < Math.abs(position(nearest) - track.scrollLeft)) nearest = i;
  }
  current = nearest;
  slides.forEach((slide,index) => slide.classList.toggle('is-active',index === current));
  const text = `${String(current + 1).padStart(2,'0')}/12`;
  if (counter.value !== text) counter.value = text;
  previous.disabled = current === 0;
  next.disabled = current === slides.length - 1;
}
track.addEventListener('scroll',() => {
  if (!frame) frame = requestAnimationFrame(update);
},{ ...options, passive:true });
previous.addEventListener('click',() => goTo(current - 1),options);
next.addEventListener('click',() => goTo(current + 1),options);
track.addEventListener('keydown',event => {
  const destinations = { ArrowLeft:current - 1, ArrowRight:current + 1, Home:0, End:slides.length - 1 };
  if (!(event.key in destinations)) return;
  event.preventDefault();
  goTo(destinations[event.key]);
},options);
// Vertical wheels can browse the calendar too. At either end normal page
// scrolling resumes; trackpads and touch retain native horizontal scrolling.
track.addEventListener('wheel',event => {
  if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1);
  const max = track.scrollWidth - track.clientWidth;
  if ((delta < 0 && track.scrollLeft <= 1) || (delta > 0 && track.scrollLeft >= max - 1)) return;
  event.preventDefault();
  track.scrollBy({ left:delta, behavior:'instant' });
},{ ...options, passive:false });
// Touch uses native momentum and snapping; mouse users can also grab a card.
track.addEventListener('pointerdown',event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  drag = { id:event.pointerId, start:event.clientX, left:track.scrollLeft, moved:false };
},options);
track.addEventListener('pointermove',event => {
  if (!drag || event.pointerId !== drag.id) return;
  const distance = event.clientX - drag.start;
  if (!drag.moved && Math.abs(distance) < 5) return;
  drag.moved = true;
  track.setPointerCapture(event.pointerId);
  track.classList.add('is-dragging');
  track.scrollLeft = drag.left - distance;
},options);
function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const moved = drag.moved;
  drag = undefined;
  if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  track.classList.remove('is-dragging');
  if (moved) {
    update();
    goTo(current);
  } else {
    const slide = event.target.closest('.calendar-slide');
    if (slide) goTo(slides.indexOf(slide));
  }
}
window.addEventListener('pointerup',endDrag,options);
window.addEventListener('pointercancel',endDrag,options);
track.addEventListener('dragstart',event => event.preventDefault(),options);
let resizeFrame;
window.addEventListener('resize',() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    track.scrollTo({ left:position(current), behavior:'instant' });
    update();
  });
},options);
update();
if (import.meta.hot) import.meta.hot.dispose(() => {
  abort.abort();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(resizeFrame);
});
