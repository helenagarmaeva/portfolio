/** Two image planes follow the pointer at different depths inside each cover. */
export class ProjectParallax {
  constructor(reducedMotion) {
    this.reducedMotion = reducedMotion;
    this.finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    this.abort = new AbortController();
    this.items = [...document.querySelectorAll('.project-cover[data-parallax]')].map(cover => ({
      cover, scene: cover.querySelector('.project-scene'),
      current: [0, 0, 0], target: [0, 0, 0],
    })).filter(item => item.scene);
    const options = { signal: this.abort.signal };
    for (const item of this.items) {
      item.cover.addEventListener('pointerenter', event => {
        if (!this.enabled || event.pointerType === 'touch') return;
        item.cover.classList.add('is-parallax-active');
        this.move(item, event);
      }, options);
      item.cover.addEventListener('pointermove', event => {
        if (this.enabled && event.pointerType !== 'touch') this.move(item, event);
      }, options);
      item.cover.addEventListener('pointerleave', () => {
        item.target = [0, 0, 0];
        this.start();
      }, options);
    }
    this.finePointer.addEventListener('change', () => this.reset(), options);
    reducedMotion.addEventListener('change', () => this.reset(), options);
    window.addEventListener('blur', () => this.reset(), options);
    window.addEventListener('resize', () => this.reset(), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); }, options);
  }

  get enabled() { return this.finePointer.matches && !this.reducedMotion.matches; }

  move(item, event) {
    const bounds = item.cover.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const clamp = value => Math.max(-1, Math.min(1, value));
    item.target = [clamp((event.clientX - bounds.left) / bounds.width * 2 - 1), clamp((event.clientY - bounds.top) / bounds.height * 2 - 1), 1];
    this.start();
  }

  render(item) {
    item.cover.style.setProperty('--parallax-x', item.current[0]);
    item.cover.style.setProperty('--parallax-y', item.current[1]);
    item.cover.style.setProperty('--parallax-hover', item.current[2]);
  }

  start() {
    if (this.frame || !this.enabled || !this.items.length) return;
    this.previousTime = performance.now();
    this.frame = requestAnimationFrame(time => this.tick(time));
  }

  tick(time) {
    this.frame = null;
    const ease = 1 - Math.exp(-Math.min(50, time - this.previousTime) / 75);
    this.previousTime = time;
    let moving = false;
    for (const item of this.items) {
      for (let axis = 0; axis < 3; axis++) {
        const distance = item.target[axis] - item.current[axis];
        item.current[axis] = Math.abs(distance) < .001 ? item.target[axis] : item.current[axis] + distance * ease;
        if (item.current[axis] !== item.target[axis]) moving = true;
      }
      this.render(item);
      if (!item.current[2] && !item.target[2]) item.cover.classList.remove('is-parallax-active');
    }
    if (moving) this.frame = requestAnimationFrame(timestamp => this.tick(timestamp));
  }

  reset() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const item of this.items) {
      item.current = [0, 0, 0]; item.target = [0, 0, 0];
      this.render(item);
      item.cover.classList.remove('is-parallax-active');
    }
  }

  destroy() { this.abort.abort(); this.reset(); }
}
