const TRAIL_VISIBILITY = .12;
const REFRACTION_STRENGTH = .35;

const vertex = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = .5 * (aPosition + 1.);
  gl_Position = vec4(aPosition, 0., 1.);
}`;

const header = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
`;

const shaders = {
  paint: `${header}
    uniform sampler2D uPrevious;
    uniform sampler2D uSmoothed;
    uniform vec2 uSize;
    uniform vec3 uFrom;
    uniform vec3 uTo;
    uniform vec2 uMomentum;
    uniform float uStep;

    vec2 gradient(vec2 cell) {
      float angle = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453) * 6.283185;
      return vec2(cos(angle), sin(angle));
    }
    vec3 gradientNoise(vec2 p) {
      vec2 cell = floor(p), f = fract(p);
      vec2 g00 = gradient(cell), g10 = gradient(cell + vec2(1., 0.));
      vec2 g01 = gradient(cell + vec2(0., 1.)), g11 = gradient(cell + vec2(1.));
      float n00 = dot(g00, f), n10 = dot(g10, f - vec2(1., 0.));
      float n01 = dot(g01, f - vec2(0., 1.)), n11 = dot(g11, f - vec2(1.));
      vec2 q = f*f*f*(f*(f*6.-15.)+10.);
      vec2 dq = 30.*f*f*(f*(f-2.)+1.);
      float crossTerm = n00 - n10 - n01 + n11;
      float value = n00 + q.x*(n10-n00) + q.y*(n01-n00) + q.x*q.y*crossTerm;
      vec2 derivative = mix(mix(g00,g10,q.x),mix(g01,g11,q.x),q.y);
      derivative += dq * vec2(n10-n00+q.y*crossTerm,n01-n00+q.x*crossTerm);
      return vec3(value, derivative);
    }

    void main() {
      vec2 pixel = vUv * uSize;
      vec2 segment = uTo.xy - uFrom.xy;
      float along = clamp(dot(pixel-uFrom.xy, segment) / max(dot(segment,segment), .0001), 0., 1.);
      float radius = mix(uFrom.z, uTo.z, along);
      float distanceToStroke = length(pixel-uFrom.xy-segment*along);
      float brush = radius > .001 ? 1.-smoothstep(0.,radius,distanceToStroke) : 0.;

      vec4 smoothed = texture(uSmoothed, vUv);
      vec2 backtrace = (.5-smoothed.rg)*25.;
      float activity = smoothed.b + smoothed.a;
      if (activity > .001) {
        vec2 domain = pixel*.02*(1.-smoothed.rg);
        vec3 noise = gradientNoise(domain);
        vec2 swirl = gradientNoise(pixel*.02*(2.-smoothed.rg*(.5+noise.x)+noise.yz*.1)).yz;
        backtrace += swirl*activity*3.;
      }
      vec4 previous = texture(uPrevious,vUv+backtrace/uSize*uStep);
      vec2 velocity = (previous.rg-.5)*pow(.975,uStep) + uMomentum*brush*uStep;
      vec2 masks = previous.ba;
      vec2 loss = max(masks*(1.-pow(vec2(.95,.8),vec2(uStep))),vec2(.004*uStep));
      masks = max(vec2(0.),masks-loss) + brush*uStep;
      fragColor = clamp(vec4(.5+velocity,masks),0.,1.);
    }
  `,

  copy: `${header}
    uniform sampler2D uTexture;
    void main() { fragColor = texture(uTexture,vUv); }
  `,

  blur: `${header}
    uniform sampler2D uTexture;
    uniform vec2 uDirection;
    void main() {
      vec4 value = texture(uTexture,vUv)*.227027;
      value += (texture(uTexture,vUv+uDirection*1.384615)+texture(uTexture,vUv-uDirection*1.384615))*.316216;
      value += (texture(uTexture,vUv+uDirection*3.230769)+texture(uTexture,vUv-uDirection*3.230769))*.070270;
      fragColor = value;
    }
  `,

  display: `${header}
    uniform sampler2D uPaint;
    uniform sampler2D uPortrait;
    uniform vec2 uViewport;
    uniform vec4 uPortraitRect;
    uniform vec4 uPortraitUv;
    uniform float uPortraitOpacity;
    uniform float uTrailVisibility;
    uniform float uRefractionStrength;
    vec3 toSrgb(vec3 linearColor) {
      return mix(12.92*linearColor,1.055*pow(linearColor,vec3(1./2.4))-.055,step(vec3(.0031308),linearColor));
    }
    vec3 toLinear(vec3 color) {
      return mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));
    }
    void main() {
      vec4 field = texture(uPaint,vUv);
      float weight = .5*(field.b+field.a);
      vec2 direction = (.5-field.rg)*2.*weight;
      // Screen-paint chromatic shading: hue follows the direction of motion,
      // while the two independently fading masks produce a soft glassy edge.
      float phase = (direction.x+direction.y)*40.;
      vec3 spectrum = sin(vec3(phase)+vec3(0.,1.,2.));
      float edge = 1.-smoothstep(-.9,.4,weight);
      float intensity = edge*max(abs(direction.x),abs(direction.y))*12.5;
      // The effect's light is computed in linear space and displayed in sRGB,
      // so the chromatic rim remains visible on the requested dark background.
      vec3 linearColor = max(spectrum*intensity,vec3(0.));
      // Compose the faint brush over the page background without tinting the photo.
      vec3 trailLinear = toLinear(clamp(toSrgb(linearColor),0.,1.)*uTrailVisibility);
      linearColor = trailLinear + toLinear(vec3(4./255.));
      if (uPortraitOpacity > 0.) {
        vec2 local = (vUv*uViewport-uPortraitRect.xy)/uPortraitRect.zw;
        float circle = 1.-smoothstep(1.-2./min(uPortraitRect.z,uPortraitRect.w),1.,length((local-.5)*2.));
        if (circle > 0.) {
          // Refract the original photo using the SAME advected cursor field.
          // Work in CSS pixels so the warp is consistent across DPR values.
          vec2 displacement = clamp(direction*180.,vec2(-14.),vec2(14.))*uRefractionStrength;
          vec2 uv = uPortraitUv.xy + (local+displacement/uPortraitRect.zw)*uPortraitUv.zw;
          vec2 fringe = direction*3./uPortraitRect.zw*uPortraitUv.zw*uRefractionStrength;
          vec3 photo = vec3(texture(uPortrait,uv+fringe).r,texture(uPortrait,uv).g,texture(uPortrait,uv-fringe).b);
          vec3 photoLinear = toLinear(photo);
          linearColor = mix(linearColor,photoLinear+trailLinear*.35,circle*uPortraitOpacity);
        }
      }
      vec3 color = toSrgb(linearColor);
      fragColor = vec4(clamp(color,0.,1.),1.);
    }
  `,
};

/** Directional screen-paint brush with advected momentum, curl and two decay
 * masks. The background is a constant #040404; only pointer input paints it. */
export class CursorPaint {
  constructor(canvas, { reducedMotion, portrait }) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.portrait = portrait;
    this.portraitFrame = portrait?.closest('.portrait');
    this.finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    this.programs = {};
    this.targets = [];
    this.frame = null;
    this.pointer = null;
    this.previousPointer = null;
    this.previousRadius = 0;
    this.momentum = [0, 0];
    this.lastMovement = performance.now();
    this.destroyed = false;
    this.abort = new AbortController();

    try {
      this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!this.gl) throw new Error('WebGL 2 is unavailable');
      this.initialize();
    } catch { this.release(); this.gl = null; this.fallback(); }

    const options = { passive: true, signal: this.abort.signal };
    window.addEventListener('pointermove', event => {
      if (!this.gl || reducedMotion.matches || event.pointerType === 'touch') return;
      this.pointer = { x: event.clientX / innerWidth, y: 1-event.clientY / innerHeight };
      if (!this.previousPointer) this.previousPointer = { ...this.pointer };
      this.lastMovement = performance.now();
      this.start();
    }, options);
    document.documentElement.addEventListener('pointerleave', () => this.resetPointer(), options);
    window.addEventListener('blur', () => this.resetPointer(), options);
    window.addEventListener('resize', () => this.resize(), options);
    window.addEventListener('scroll', () => {
      // The shared canvas is fixed; the portrait must follow its DOM frame,
      // including while the cursor is idle and during reveal transitions.
      if (!this.gl || !this.portraitReady) return;
      this.lastMovement = performance.now();
      this.start();
    }, options);
    document.addEventListener('visibilitychange', () => document.hidden ? this.pause() : this.start(), { signal: this.abort.signal });
    reducedMotion.addEventListener('change', () => {
      this.pause(); this.clear(); this.syncPortrait(); this.start();
    }, { signal: this.abort.signal });
    this.finePointer.addEventListener('change', () => {
      this.pause(); this.clear(); this.syncPortrait(); this.start();
    }, { signal: this.abort.signal });
    portrait?.addEventListener('load', () => this.uploadPortrait(), { signal: this.abort.signal });
    portrait?.addEventListener('error', () => {
      this.portraitReady = false; this.syncPortrait(); this.render();
    }, { signal: this.abort.signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.pause(); this.gl = null; this.fallback();
    }, { signal: this.abort.signal });
    canvas.addEventListener('webglcontextrestored', () => {
      try {
        this.gl = canvas.getContext('webgl2');
        this.targets = []; this.programs = {}; this.initialize(); this.start();
      } catch { this.gl = null; this.fallback(); }
    }, { signal: this.abort.signal });
  }

  initialize() {
    const gl = this.gl;
    this.paint = null;
    for (const [name, source] of Object.entries(shaders)) this.programs[name] = this.program(source);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    this.portraitReady = false;
    this.portraitTexture = { texture: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D,this.portraitTexture.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    this.canvas.dataset.renderer = 'webgl';
    document.documentElement.classList.remove('background-fallback');
    this.resize();
    this.uploadPortrait();
  }

  uploadPortrait() {
    const gl = this.gl, image = this.portrait;
    if (this.destroyed || !gl || !image?.complete || !image.naturalWidth) return;
    this.portraitReady = false;
    try {
      if (Math.max(image.naturalWidth,image.naturalHeight)>gl.getParameter(gl.MAX_TEXTURE_SIZE)) return;
      gl.bindTexture(gl.TEXTURE_2D,this.portraitTexture.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      this.portraitReady = gl.getError()===gl.NO_ERROR;
    } catch {
      // A future remote image without CORS stays a normal visible <img>.
      this.portraitReady = false;
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      this.syncPortrait();
    }
    this.lastMovement = performance.now(); this.start();
  }

  syncPortrait() {
    this.portraitActive = Boolean(this.gl && this.portraitReady && this.finePointer.matches && !this.reducedMotion.matches);
    this.portraitFrame?.classList.toggle('is-distorted',this.portraitActive);
    this.canvas.dataset.portrait = this.portraitActive ? 'webgl' : 'image';
  }

  portraitUniforms() {
    const empty = { uPortraitRect:[0,0,1,1],uPortraitUv:[0,0,1,1],uPortraitOpacity:0 };
    if (!this.portraitActive) return empty;
    const frame = this.portraitFrame.getBoundingClientRect();
    if (!frame.width || frame.bottom<=0 || frame.top>=innerHeight) return empty;
    const image = this.portrait.getBoundingClientRect();
    const aspect = this.portrait.naturalWidth/this.portrait.naturalHeight;
    const width = Math.max(image.width,image.height*aspect);
    const height = Math.max(image.height,image.width/aspect);
    const position = getComputedStyle(this.portrait).objectPosition.split(' ').map(value=>parseFloat(value)/100);
    return {
      uPortraitRect:[frame.left,innerHeight-frame.bottom,frame.width,frame.height],
      uPortraitUv:[
        (frame.left-image.left+(width-image.width)*position[0])/width,
        (image.bottom-frame.bottom+(height-image.height)*(1-position[1]))/height,
        frame.width/width,frame.height/height,
      ],
      uPortraitOpacity:parseFloat(getComputedStyle(this.portraitFrame).opacity),
    };
  }

  program(source) {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error);
      }
      return shader;
    };
    const v = compile(gl.VERTEX_SHADER,vertex), f = compile(gl.FRAGMENT_SHADER,source);
    const program = gl.createProgram();
    gl.attachShader(program,v); gl.attachShader(program,f);
    gl.bindAttribLocation(program,0,'aPosition'); gl.linkProgram(program);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(error);
    }
    const uniforms = {};
    for (let i=0; i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS); i++) {
      const name = gl.getActiveUniform(program,i).name;
      uniforms[name] = gl.getUniformLocation(program,name);
    }
    return { program, uniforms };
  }

  target(width, height) {
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    const target = {texture, framebuffer, width, height};
    this.targets.push(target);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete paint buffer');
    return target;
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(devicePixelRatio || 1,1.5);
    const width = Math.min(2400,Math.round(innerWidth*dpr));
    const height = Math.min(1800,Math.round(innerHeight*dpr));
    if (width===this.canvas.width && height===this.canvas.height && this.paint) return;
    this.canvas.width=width; this.canvas.height=height;
    this.releaseTargets();
    const w = Math.max(32,Math.round(width/4)), h = Math.max(32,Math.round(height/4));
    this.paint={read:this.target(w,h),write:this.target(w,h)};
    this.low=this.target(Math.max(16,Math.round(w/2)),Math.max(16,Math.round(h/2)));
    this.blur=this.target(this.low.width,this.low.height);
    this.clear(); this.render();
  }

  clear() {
    if (!this.gl) return;
    const gl = this.gl;
    for (const target of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
      gl.clearColor(.5,.5,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.resetPointer();
  }

  resetPointer() {
    this.pointer=null; this.previousPointer=null; this.previousRadius=0; this.momentum=[0,0];
  }

  draw(name, target, values) {
    const gl=this.gl, {program,uniforms}=this.programs[name];
    gl.useProgram(program);
    let unit=0;
    for (const [name,value] of Object.entries(values)) {
      const location=uniforms[name];
      if (location===undefined || location===null) continue;
      if (value?.texture) {
        gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,value.texture); gl.uniform1i(location,unit++);
      } else if (Array.isArray(value)) {
        if (value.length===2) gl.uniform2f(location,...value);
        else if (value.length===3) gl.uniform3f(location,...value);
        else if (value.length===4) gl.uniform4f(location,...value);
      } else gl.uniform1f(location,value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer || null);
    gl.viewport(0,0,target?.width || this.canvas.width,target?.height || this.canvas.height);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES,0,3);
  }

  update(dt) {
    const {width:w,height:h}=this.paint.read;
    const point=this.pointer || {x:0,y:0}, previous=this.previousPointer || point;
    const dx=point.x-previous.x, dy=point.y-previous.y;
    const distance=Math.hypot(dx*innerWidth,dy*innerHeight);
    const continuous=distance<Math.max(innerWidth,innerHeight)*.5;
    const radius=continuous ? Math.min(distance/100,1)*Math.max(40,innerWidth/20)*h/innerHeight : 0;
    const fromRadius=continuous ? this.previousRadius : 0;
    const step=dt*60, inertia=Math.pow(.8,step);
    this.momentum[0]=this.momentum[0]*inertia+(continuous?dx*w*dt*.8:0);
    this.momentum[1]=this.momentum[1]*inertia+(continuous?dy*h*dt*.8:0);
    this.draw('paint',this.paint.write,{
      uPrevious:this.paint.read,uSmoothed:this.low,uSize:[w,h],
      uFrom:[previous.x*w,previous.y*h,fromRadius],uTo:[point.x*w,point.y*h,radius],
      uMomentum:this.momentum,uStep:step,
    });
    [this.paint.read,this.paint.write]=[this.paint.write,this.paint.read];
    this.draw('copy',this.low,{uTexture:this.paint.read});
    this.draw('blur',this.blur,{uTexture:this.low,uDirection:[2/this.low.width,0]});
    this.draw('blur',this.low,{uTexture:this.blur,uDirection:[0,2/this.low.height]});
    this.previousPointer={...point}; this.previousRadius=radius;
  }

  render() {
    if (this.gl && this.paint) this.draw('display',null,{
      uPaint:this.paint.read,uPortrait:this.portraitTexture,uViewport:[innerWidth,innerHeight],uTrailVisibility:TRAIL_VISIBILITY,uRefractionStrength:REFRACTION_STRENGTH,...this.portraitUniforms(),
    });
  }

  tick(timestamp) {
    this.frame=null;
    if (this.destroyed || !this.gl || document.hidden) return;
    const dt=Math.min(.033,Math.max(.001,(timestamp-this.previousTime)/1000));
    this.previousTime=timestamp;
    if (timestamp-this.lastMovement>4000) { this.clear(); this.render(); return; }
    this.update(dt); this.render();
    this.frame=requestAnimationFrame(time=>this.tick(time));
  }

  start() {
    if (this.destroyed || !this.gl || document.hidden) return;
    this.canvas.dataset.motion=this.reducedMotion.matches?'reduced':'active';
    if (this.reducedMotion.matches) { this.render(); return; }
    if (this.frame) return;
    this.previousTime=performance.now(); this.render();
    this.frame=requestAnimationFrame(time=>this.tick(time));
  }

  pause() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame=null; this.resetPointer();
  }

  releaseTargets() {
    if (!this.gl) return;
    for (const target of this.targets) {
      this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.framebuffer);
    }
    this.targets=[];
  }

  release() {
    if (!this.gl) return;
    this.releaseTargets();
    for (const {program} of Object.values(this.programs)) this.gl.deleteProgram(program);
    this.gl.deleteTexture(this.portraitTexture?.texture);
    this.gl.deleteBuffer(this.buffer); this.gl.deleteVertexArray(this.vao);
  }

  fallback() {
    this.portraitReady = false; this.syncPortrait();
    this.canvas.dataset.renderer='css'; document.documentElement.classList.add('background-fallback');
  }

  destroy() {
    this.destroyed=true; this.pause(); this.abort.abort(); this.release();
    this.portraitFrame?.classList.remove('is-distorted');
  }
}
