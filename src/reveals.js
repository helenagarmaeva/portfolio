// Lusion's reveal rhythm: staggered rotating letters, masked lines, and
// project covers entering from opposite sides. All text stays accessible.
export class ScrollReveals {
  constructor(reducedMotion) {
    this.reducedMotion = reducedMotion;
    this.originals = new Map();
    this.scrambles = new Map();
    this.abort = new AbortController();
    this.elements = [...document.querySelectorAll('[data-reveal]')];
    document.querySelectorAll('h1, h2, .role, .bio p, .project-name, .project-description, .contacts .contact-label, .contacts .roll-label, .scroll-cue .roll-label').forEach(element => {
      this.originals.set(element, element.textContent.trim());
    });
    this.width = innerWidth;
    this.scrollPosition = scrollY;
    this.direction = 1;
    const options = { signal: this.abort.signal };
    window.addEventListener('scroll', () => {
      if (scrollY === this.scrollPosition) return;
      this.direction = scrollY > this.scrollPosition ? 1 : -1;
      this.scrollPosition = scrollY;
      if (this.direction < 0) {
        // Finish any running reveal as soon as scrolling reverses.
        this.elements.forEach(element => {
          if (!element.classList.contains('is-visible')) return;
          element.classList.add('is-instant');
          if (element.matches('.project')) this.stopScramble(element);
        });
      }
    }, { ...options, passive: true });
    reducedMotion.addEventListener('change', () => this.setup(), options);
    window.addEventListener('resize', () => {
      if (this.width === innerWidth) return;
      this.width = innerWidth;
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.setup());
    }, options);
    this.setup();
    document.fonts?.ready.then(() => { if (!this.abort.signal.aborted) this.setup(); });
  }

  accessibleVisual(element, text) {
    const accessible = document.createElement('span');
    accessible.className = 'sr-only';
    accessible.textContent = text;
    const visual = document.createElement('span');
    visual.className = 'reveal-text';
    visual.setAttribute('aria-hidden', 'true');
    element.replaceChildren(accessible, visual);
    return visual;
  }

  letters(element, text) {
    const visual = this.accessibleVisual(element, text);
    const project = element.matches('.project-name');
    let index = 0;
    const count = text.replace(/\s/g, '').length;
    const cue = element.closest('.scroll-cue');
    if (cue) cue.style.setProperty('--cue-letter-stagger', `${Math.max(0, count - 1) * 1000 / 30}ms`);
    text.split(/(\s+)/).forEach(word => {
      if (/^\s+$/.test(word)) { visual.append(document.createTextNode(word)); return; }
      const mask = document.createElement('span');
      mask.className = 'reveal-word-mask';
      for (const character of word) {
        const letter = document.createElement('span');
        letter.className = 'reveal-letter';
        letter.textContent = character;
        // Project captions follow the reference's centre-weighted wave.
        const delay = project
          ? (1 + Math.cos(Math.PI / 2 + index / Math.max(1, count - 1) * Math.PI)) * 62.5
          : index * 1000 / 30;
        letter.style.setProperty('--letter-delay', `${delay}ms`);
        mask.append(letter);
        index++;
      }
      visual.append(mask);
    });
  }

  lines(element, text) {
    const visual = this.accessibleVisual(element, text);
    const words = text.split(/\s+/).map(word => {
      const span = document.createElement('span');
      span.textContent = word;
      // Measure whole words; a hyphenated word must not span two measured lines.
      span.style.whiteSpace = 'nowrap';
      return span;
    });
    words.forEach((word, index) => {
      if (index) visual.append(document.createTextNode(' '));
      visual.append(word);
    });
    const lines = [];
    let previousTop;
    for (const word of words) {
      const top = word.offsetTop;
      if (previousTop === undefined || Math.abs(top - previousTop) > 2) {
        lines.push([]);
        previousTop = top;
      }
      lines.at(-1).push(word.textContent);
    }
    visual.replaceChildren();
    lines.forEach((wordsInLine, index) => {
      const mask = document.createElement('span');
      mask.className = 'reveal-line-mask';
      const line = document.createElement('span');
      line.className = 'reveal-line';
      line.textContent = wordsInLine.join(' ');
      line.dataset.revealText = line.textContent;
      line.style.setProperty('--line-delay', `${index * 50}ms`);
      mask.append(line);
      visual.append(mask);
    });
  }

  scramble(project) {
    const element = project.querySelector('.project-description');
    const lines = [...element.querySelectorAll('.reveal-line')];
    const text = this.originals.get(element);
    if (!lines.length || !text) return;
    this.stopScramble(project);
    const started = performance.now();
    const update = now => {
      const revealed = Math.floor((now - started) / 1000 * 40);
      const stable = Math.max(0, revealed - 5);
      if (stable >= text.length) {
        this.stopScramble(project);
        return;
      }
      let offset = 0;
      for (const line of lines) {
        const original = line.dataset.revealText;
        const lineStable = Math.max(0, stable - offset);
        const lineRevealed = Math.max(0, revealed - offset);
        const randomPart = [...original.slice(lineStable, lineRevealed)].map(character =>
          character === ' ' ? ' ' : String.fromCharCode(33 + Math.floor(Math.random() * 93))
        ).join('');
        line.textContent = original.slice(0, lineStable) + randomPart;
        offset += original.length + 1;
      }
      this.scrambles.set(project, requestAnimationFrame(update));
    };
    this.scrambles.set(project, requestAnimationFrame(update));
  }

  stopScramble(project) {
    cancelAnimationFrame(this.scrambles.get(project));
    this.scrambles.delete(project);
    const element = project.querySelector('.project-description');
    element?.querySelectorAll('.reveal-line').forEach(line => { line.textContent = line.dataset.revealText; });
  }

  setup() {
    this.observer?.disconnect();
    // Restart all parts of the cue together when fonts or line breaks change.
    const cue = document.querySelector('.scroll-cue');
    cue?.classList.remove('is-visible');
    for (const project of this.scrambles.keys()) this.stopScramble(project);
    // Restore before measuring, so a resized paragraph gets new line breaks.
    this.originals.forEach((text, element) => { element.textContent = text; });
    if (this.reducedMotion.matches || !('IntersectionObserver' in window)) {
      document.documentElement.classList.remove('motion-ready');
      this.elements.forEach(element => element.classList.add('is-visible'));
      return;
    }
    this.originals.forEach((text, element) => {
      if (element.matches('h1, h2, .project-name, .contacts .contact-label, .contacts .roll-label, .scroll-cue .roll-label')) this.letters(element, text);
      else this.lines(element, text);
    });
    document.documentElement.classList.add('motion-ready');
    if (cue) void cue.offsetWidth;
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;
        if (entry.isIntersecting) {
          const firstAppearance = !element.classList.contains('is-visible');
          if (firstAppearance) element.classList.toggle('is-instant', this.direction < 0);
          element.classList.add('is-visible');
          if (firstAppearance && element.matches('.project') && this.direction > 0) this.scramble(element);
        } else {
          // Reset at the observer boundary, including its bottom inset.
          // There is no second callback when an already non-intersecting
          // card subsequently passes the physical viewport boundary.
          element.classList.remove('is-visible', 'is-instant');
          if (element.matches('.project')) this.stopScramble(element);
        }
      }
    }, { threshold: [0, .12], rootMargin: '0px 0px -20px 0px' });
    this.elements.forEach(element => this.observer.observe(element));
  }

  destroy() {
    this.abort.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    for (const project of this.scrambles.keys()) this.stopScramble(project);
    this.originals.forEach((text, element) => { element.textContent = text; });
    this.elements.forEach(element => element.classList.remove('is-instant'));
    document.documentElement.classList.remove('motion-ready');
  }
}
