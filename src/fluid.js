const vertex = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}`;

const header = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
`;

const fragments = {
  clear: `${header}
    uniform sampler2D uTexture;
    uniform float uValue;
    void main() { fragColor = texture(uTexture, vUv) * uValue; }
  `,

  splat: `${header}
    uniform sampler2D uTarget;
    uniform vec2 uPoint;
    uniform vec3 uColor;
    uniform float uAspect;
    uniform float uRadius;
    void main() {
      vec2 p = vUv - uPoint;
      p.x *= uAspect;
      vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
      fragColor = vec4(texture(uTarget, vUv).rgb + splat, 1.);
    }
  `,

  advection: `${header}
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uVelocityTexel;
    uniform vec2 uSourceTexel;
    uniform float uDt;
    uniform float uDecay;
    vec4 bilerp(sampler2D source, vec2 point, vec2 texel) {
      vec2 position = point / texel - .5;
      vec2 base = floor(position);
      vec2 weight = fract(position);
      vec4 a = texture(source, (base + vec2(.5, .5)) * texel);
      vec4 b = texture(source, (base + vec2(1.5, .5)) * texel);
      vec4 c = texture(source, (base + vec2(.5, 1.5)) * texel);
      vec4 d = texture(source, (base + vec2(1.5, 1.5)) * texel);
      return mix(mix(a, b, weight.x), mix(c, d, weight.x), weight.y);
    }
    void main() {
      vec2 velocity = bilerp(uVelocity, vUv, uVelocityTexel).xy;
      vec2 point = vUv - uDt * velocity * uVelocityTexel;
      fragColor = uDecay * bilerp(uSource, point, uSourceTexel);
    }
  `,

  curl: `${header}
    uniform sampler2D uVelocity;
    uniform vec2 uTexel;
    void main() {
      float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.)).y;
      float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.)).y;
      float b = texture(uVelocity, vUv - vec2(0., uTexel.y)).x;
      float t = texture(uVelocity, vUv + vec2(0., uTexel.y)).x;
      fragColor = vec4(.5 * (r - l - t + b), 0., 0., 1.);
    }
  `,

  vorticity: `${header}
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform vec2 uTexel;
    uniform float uDt;
    void main() {
      float l = texture(uCurl, vUv - vec2(uTexel.x, 0.)).r;
      float r = texture(uCurl, vUv + vec2(uTexel.x, 0.)).r;
      float b = texture(uCurl, vUv - vec2(0., uTexel.y)).r;
      float t = texture(uCurl, vUv + vec2(0., uTexel.y)).r;
      float c = texture(uCurl, vUv).r;
      vec2 force = .5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
      force /= length(force) + .0001;
      force *= 18. * c;
      force.y *= -1.;
      vec2 velocity = texture(uVelocity, vUv).xy;
      fragColor = vec4(clamp(velocity + force * uDt, -600., 600.), 0., 1.);
    }
  `,

  divergence: `${header}
    uniform sampler2D uVelocity;
    uniform vec2 uTexel;
    void main() {
      float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.)).x;
      float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.)).x;
      float b = texture(uVelocity, vUv - vec2(0., uTexel.y)).y;
      float t = texture(uVelocity, vUv + vec2(0., uTexel.y)).y;
      vec2 c = texture(uVelocity, vUv).xy;
      if (vUv.x - uTexel.x < 0.) l = -c.x;
      if (vUv.x + uTexel.x > 1.) r = -c.x;
      if (vUv.y - uTexel.y < 0.) b = -c.y;
      if (vUv.y + uTexel.y > 1.) t = -c.y;
      fragColor = vec4(.5 * (r - l + t - b), 0., 0., 1.);
    }
  `,

  pressure: `${header}
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 uTexel;
    void main() {
      float l = texture(uPressure, vUv - vec2(uTexel.x, 0.)).r;
      float r = texture(uPressure, vUv + vec2(uTexel.x, 0.)).r;
      float b = texture(uPressure, vUv - vec2(0., uTexel.y)).r;
      float t = texture(uPressure, vUv + vec2(0., uTexel.y)).r;
      float divergence = texture(uDivergence, vUv).r;
      fragColor = vec4((l + r + b + t - divergence) * .25, 0., 0., 1.);
    }
  `,

  gradient: `${header}
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    uniform vec2 uTexel;
    void main() {
      float l = texture(uPressure, vUv - vec2(uTexel.x, 0.)).r;
      float r = texture(uPressure, vUv + vec2(uTexel.x, 0.)).r;
      float b = texture(uPressure, vUv - vec2(0., uTexel.y)).r;
      float t = texture(uPressure, vUv + vec2(0., uTexel.y)).r;
      vec2 velocity = texture(uVelocity, vUv).xy - vec2(r - l, t - b);
      fragColor = vec4(velocity, 0., 1.);
    }
  `,

  display: `${header}
    uniform sampler2D uDye;
    uniform sampler2D uVelocity;
    uniform vec2 uDyeTexel;
    uniform float uAspect;
    uniform float uTime;
    uniform float uScroll;
    void main() {
      vec3 dye = texture(uDye, vUv).rgb;
      vec2 flow = texture(uVelocity, vUv).xy;
      float l = texture(uDye, vUv - vec2(uDyeTexel.x * 2., 0.)).r;
      float r = texture(uDye, vUv + vec2(uDyeTexel.x * 2., 0.)).r;
      float b = texture(uDye, vUv - vec2(0., uDyeTexel.y * 2.)).r;
      float t = texture(uDye, vUv + vec2(0., uDyeTexel.y * 2.)).r;
      vec2 p = vec2(vUv.x * uAspect, vUv.y - uScroll * .25);
      // Both the fluid velocity and the dye gradient refract the background.
      p += flow * .0025 + vec2(r - l, t - b) * .22;
      float bend = .20 * sin(p.x * 2.4 + p.y * .9 + uTime * .09)
                 + .13 * sin(p.y * 3.1 - p.x * .8 - uTime * .06);
      float phase = (p.y + p.x * .55 + bend) * 36.;
      float stripe = smoothstep(.45, .75, sin(phase));
      float ribbon = .45 + .55 * smoothstep(-.6, .9, sin(p.x * 2. - p.y));
      vec3 purple = vec3(.38, .19, .65);
      vec3 background = vec3(.03137) + purple * stripe * ribbon * .105;
      float ink = 1. - exp(-max(dye.r, 0.) * 1.35);
      float edge = clamp(length(vec2(r - l, t - b)) * 2.5, 0., .8);
      vec3 color = background + vec3(.34, .16, .62) * ink * .65;
      color += vec3(.45, .30, .72) * edge * ink * .38;
      fragColor = vec4(color, 1.);
    }
  `,
};

/** Small, self-contained incompressible fluid simulation. No image copies,
 * remote shaders, dependencies, or per-frame CPU pixel manipulation. */
export class FluidBackground {
  constructor(canvas, { reducedMotion }) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.points = [];
    this.lastPointer = null;
    this.frame = null;
    this.previousTime = 0;
    this.time = 0;
    this.destroyed = false;
    this.targets = [];
    this.programs = {};
    this.abort = new AbortController();
    this.onMotionChange = () => {
      this.points.length = 0;
      this.lastPointer = null;
      this.resetFields();
      this.pause();
      this.start();
    };
    this.reducedMotion.addEventListener('change', this.onMotionChange);

    try {
      this.gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      });
      if (!this.gl || !this.gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('Float render targets are unavailable');
      }
      this.initialize();
      canvas.dataset.renderer = 'webgl';
    } catch {
      this.releaseResources();
      this.gl = null;
      this.fallback();
    }

    const options = { passive: true, signal: this.abort.signal };
    window.addEventListener('pointermove', event => this.onPointer(event), options);
    document.documentElement.addEventListener('pointerleave', () => { this.lastPointer = null; }, options);
    window.addEventListener('blur', () => { this.lastPointer = null; }, options);
    window.addEventListener('resize', () => this.resize(), options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(); else this.start();
    }, { signal: this.abort.signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.pause();
      this.gl = null;
      this.fallback();
    }, { signal: this.abort.signal });
    canvas.addEventListener('webglcontextrestored', () => {
      if (this.destroyed) return;
      try {
        this.gl = canvas.getContext('webgl2');
        this.targets = [];
        this.programs = {};
        this.initialize();
        canvas.dataset.renderer = 'webgl';
        document.documentElement.classList.remove('background-fallback');
        this.start();
      } catch { this.gl = null; this.fallback(); }
    }, { signal: this.abort.signal });
  }

  initialize() {
    const gl = this.gl;
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('Float render targets are unavailable');
    }
    this.velocity = null;
    this.dye = null;
    for (const [name, source] of Object.entries(fragments)) {
      this.programs[name] = this.program(source);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.resize();
  }

  program(fragment) {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const v = compile(gl.VERTEX_SHADER, vertex);
    const f = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message);
    }
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const uniform = gl.getActiveUniform(program, i);
      uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }
    return { program, uniforms };
  }

  target(width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // RGBA16F is linearly filterable in WebGL 2; interpolation also keeps the
    // low-resolution velocity field from producing jagged background refraction.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const target = { texture, framebuffer, width, height };
    this.targets.push(target);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete fluid framebuffer');
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return target;
  }

  pair(width, height) {
    return {
      read: this.target(width, height),
      write: this.target(width, height),
      swap() { [this.read, this.write] = [this.write, this.read]; },
    };
  }

  resize() {
    if (!this.gl) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.min(Math.round(innerWidth * ratio), 2400);
    const height = Math.min(Math.round(innerHeight * ratio), 1800);
    if (this.canvas.width === width && this.canvas.height === height && this.velocity) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.aspect = width / height;
    this.releaseTargets();
    const resolution = (longSide) => this.aspect >= 1
      ? [longSide, Math.max(64, Math.round(longSide / this.aspect))]
      : [Math.max(64, Math.round(longSide * this.aspect)), longSide];
    const [vw, vh] = resolution(192);
    const [dw, dh] = resolution(512);
    this.velocity = this.pair(vw, vh);
    this.dye = this.pair(dw, dh);
    this.pressure = this.pair(vw, vh);
    this.curl = this.target(vw, vh);
    this.divergence = this.target(vw, vh);
    this.velocityTexel = [1 / vw, 1 / vh];
    this.dyeTexel = [1 / dw, 1 / dh];
    this.points.length = 0;
    this.lastPointer = null;
    this.render();
  }

  onPointer(event) {
    if (!this.gl || this.reducedMotion.matches || event.pointerType === 'touch' || document.hidden) return;
    const x = event.clientX / innerWidth;
    const y = 1 - event.clientY / innerHeight;
    if (!this.lastPointer) {
      this.lastPointer = { x, y };
      return;
    }
    const dx = x - this.lastPointer.x;
    const dy = y - this.lastPointer.y;
    const distance = Math.hypot(dx * this.aspect, dy);
    if (distance > .5) { this.lastPointer = { x, y }; return; }
    const count = Math.min(20, Math.max(1, Math.ceil(distance / .012)));
    for (let step = 1; step <= count; step++) {
      const t = step / count;
      this.points.push({
        x: this.lastPointer.x + dx * t,
        y: this.lastPointer.y + dy * t,
        dx: Math.max(-.15, Math.min(.15, dx)) * 2200,
        dy: Math.max(-.15, Math.min(.15, dy)) * 2200,
      });
    }
    // Bound input work even when a high-frequency mouse runs faster than rAF.
    if (this.points.length > 80) this.points.splice(0, this.points.length - 80);
    this.lastPointer = { x, y };
  }

  draw(name, target, values) {
    const gl = this.gl;
    const program = this.programs[name];
    gl.useProgram(program.program);
    let unit = 0;
    for (const [name, value] of Object.entries(values)) {
      const location = program.uniforms[name];
      if (location === undefined || location === null) continue;
      if (value?.texture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, value.texture);
        gl.uniform1i(location, unit++);
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2f(location, ...value);
        if (value.length === 3) gl.uniform3f(location, ...value);
      } else { gl.uniform1f(location, value); }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer || null);
    gl.viewport(0, 0, target?.width || this.canvas.width, target?.height || this.canvas.height);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  inject(point) {
    const shared = { uPoint: [point.x, point.y], uAspect: this.aspect, uRadius: .00065 };
    this.draw('splat', this.velocity.write, {
      ...shared, uTarget: this.velocity.read, uColor: [point.dx, point.dy, 0],
    });
    this.velocity.swap();
    this.draw('splat', this.dye.write, {
      ...shared, uTarget: this.dye.read, uColor: [.32, .16, .45],
    });
    this.dye.swap();
  }

  simulate(dt) {
    const texel = this.velocityTexel;
    this.draw('advection', this.velocity.write, {
      uVelocity: this.velocity.read, uSource: this.velocity.read,
      uVelocityTexel: texel, uSourceTexel: texel, uDt: dt,
      uDecay: Math.pow(.985, dt * 60),
    });
    this.velocity.swap();
    this.draw('curl', this.curl, { uVelocity: this.velocity.read, uTexel: texel });
    this.draw('vorticity', this.velocity.write, {
      uVelocity: this.velocity.read, uCurl: this.curl, uTexel: texel, uDt: dt,
    });
    this.velocity.swap();
    this.draw('divergence', this.divergence, { uVelocity: this.velocity.read, uTexel: texel });
    this.draw('clear', this.pressure.write, { uTexture: this.pressure.read, uValue: .8 });
    this.pressure.swap();
    for (let i = 0; i < 12; i++) {
      this.draw('pressure', this.pressure.write, {
        uPressure: this.pressure.read, uDivergence: this.divergence, uTexel: texel,
      });
      this.pressure.swap();
    }
    this.draw('gradient', this.velocity.write, {
      uPressure: this.pressure.read, uVelocity: this.velocity.read, uTexel: texel,
    });
    this.velocity.swap();
    this.draw('advection', this.dye.write, {
      uVelocity: this.velocity.read, uSource: this.dye.read,
      uVelocityTexel: texel, uSourceTexel: this.dyeTexel, uDt: dt,
      uDecay: Math.pow(.966, dt * 60),
    });
    this.dye.swap();
  }

  render() {
    if (!this.gl || !this.dye) return;
    this.draw('display', null, {
      uDye: this.dye.read, uVelocity: this.velocity.read,
      uDyeTexel: this.dyeTexel, uAspect: this.aspect,
      uTime: this.reducedMotion.matches ? 0 : this.time,
      uScroll: scrollY / Math.max(innerHeight, 1),
    });
  }

  tick(timestamp) {
    this.frame = null;
    if (this.destroyed || !this.gl || document.hidden) return;
    const dt = Math.min(Math.max((timestamp - this.previousTime) / 1000 || .016, .001), .033);
    this.previousTime = timestamp;
    this.time += dt;
    // Limit costly injection passes while preserving a continuous interpolated path.
    const points = this.points.splice(0);
    const stride = Math.max(1, Math.ceil(points.length / 12));
    for (let i = 0; i < points.length; i += stride) this.inject(points[i]);
    if (points.length && (points.length - 1) % stride) this.inject(points[points.length - 1]);
    this.simulate(dt);
    this.render();
    this.frame = requestAnimationFrame(time => this.tick(time));
  }

  start() {
    if (this.destroyed || !this.gl || this.frame || document.hidden) return;
    this.canvas.dataset.motion = this.reducedMotion.matches ? 'reduced' : 'active';
    if (this.reducedMotion.matches) { this.render(); return; }
    this.previousTime = performance.now();
    this.frame = requestAnimationFrame(time => this.tick(time));
  }

  pause() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.lastPointer = null;
    this.points.length = 0;
  }

  resetFields() {
    if (!this.gl) return;
    const gl = this.gl;
    for (const target of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.time = 0;
  }

  releaseTargets() {
    if (!this.gl) return;
    for (const target of this.targets) {
      this.gl.deleteTexture(target.texture);
      this.gl.deleteFramebuffer(target.framebuffer);
    }
    this.targets = [];
  }

  releaseResources() {
    if (!this.gl) return;
    this.releaseTargets();
    for (const value of Object.values(this.programs)) this.gl.deleteProgram(value.program);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
  }

  fallback() {
    this.canvas.dataset.renderer = 'css';
    document.documentElement.classList.add('background-fallback');
  }

  destroy() {
    this.destroyed = true;
    this.pause();
    this.abort.abort();
    this.reducedMotion.removeEventListener('change', this.onMotionChange);
    this.releaseResources();
  }
}
