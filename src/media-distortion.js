// Case-study images and video use the exact same paint field as the portrait.
// The DOM media remains the fallback for touch, reduced motion and lost WebGL.
const fragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uPaint;
uniform sampler2D uMedia;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform vec4 uUv;
uniform float uRadius;
uniform float uOpacity;
uniform float uRefractionStrength;
void main() {
  vec2 pixel = vUv*uViewport;
  vec2 local = pixel-uRect.xy;
  vec2 halfSize = uRect.zw*.5;
  float radius = min(uRadius,min(halfSize.x,halfSize.y));
  vec2 edge = abs(local-halfSize)-halfSize+radius;
  float distanceToEdge = length(max(edge,0.))+min(max(edge.x,edge.y),0.)-radius;
  float mask = 1.-smoothstep(-1.,0.,distanceToEdge);
  if (mask<=0.) discard;
  vec4 field = texture(uPaint,vUv);
  float weight = .5*(field.b+field.a);
  vec2 direction = (.5-field.rg)*2.*weight;
  vec2 displacement = clamp(direction*180.,vec2(-14.),vec2(14.))*uRefractionStrength;
  vec2 uv = uUv.xy+((local+displacement)/uRect.zw)*uUv.zw;
  vec2 fringe = direction*3./uRect.zw*uUv.zw*uRefractionStrength;
  vec4 center = texture(uMedia,uv);
  vec3 color = vec3(texture(uMedia,uv+fringe).r,center.g,texture(uMedia,uv-fringe).b);
  fragColor = vec4(color,center.a*mask*uOpacity);
}`;

export class MediaDistortion {
  constructor(paint) {
    this.paint = paint;
    this.gl = paint.gl;
    this.abort = new AbortController();
    this.items = [...document.querySelectorAll('img[data-distort], video[data-distort]')].map(element => ({
      element, frame: element.closest('[data-distort-frame]') || element,
      video: element instanceof HTMLVideoElement, ready: false, dirty: true,
    }));
    if (!this.items.length) return;
    this.program = paint.program(fragment);
    for (const item of this.items) {
      const gl = this.gl;
      item.texture = { texture: gl.createTexture() };
      gl.bindTexture(gl.TEXTURE_2D,item.texture.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,item.video ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
      const invalidate = () => { item.dirty = true; this.wake(item); };
      for (const event of item.video ? ['loadeddata','seeked','play','pause'] : ['load']) {
        item.element.addEventListener(event,invalidate,{ signal:this.abort.signal });
      }
      item.element.addEventListener('error',() => {
        item.ready = false; item.element.classList.remove('is-distorted-media');
        this.paint.render();
      },{ signal:this.abort.signal });
      if (item.video && item.element.requestVideoFrameCallback) {
        const nextFrame = () => {
          if (this.abort.signal.aborted) return;
          invalidate();
          item.callback = item.element.requestVideoFrameCallback(nextFrame);
        };
        item.callback = item.element.requestVideoFrameCallback(nextFrame);
      }
    }
  }

  eligible() {
    return Boolean(this.paint.gl && this.paint.finePointer.matches && !this.paint.reducedMotion.matches);
  }

  visible(item) {
    const rect = item.frame.getBoundingClientRect();
    return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;
  }

  wake(item) {
    if (!this.eligible() || !this.visible(item)) return;
    this.paint.lastMovement = performance.now();
    this.paint.start();
  }

  upload(item) {
    const { element, video } = item;
    const width = video ? element.videoWidth : element.naturalWidth;
    const height = video ? element.videoHeight : element.naturalHeight;
    if (!width || !height || (video && element.readyState<2)) return false;
    if (video && Math.max(width,height)>this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)) return false;
    try {
      let source = element;
      if (!video) {
        // Upload only the visible crop, not an entire very tall screenshot.
        // This keeps 15,000px pages sharp without exceeding texture limits.
        const frame = item.frame.getBoundingClientRect();
        const image = element.getBoundingClientRect();
        const renderedWidth = Math.max(image.width,image.height*width/height);
        const renderedHeight = Math.max(image.height,image.width*height/width);
        const position = getComputedStyle(element).objectPosition.split(' ').map(value => parseFloat(value)/100);
        const scaleX = width/renderedWidth, scaleY = height/renderedHeight;
        const left = (frame.left-image.left+(renderedWidth-image.width)*position[0])*scaleX;
        const top = (frame.top-image.top+(renderedHeight-image.height)*position[1])*scaleY;
        const x = Math.max(0,left-8*scaleX), y = Math.max(0,top-8*scaleY);
        const cropWidth = Math.min(width,left+frame.width*scaleX+8*scaleX)-x;
        const cropHeight = Math.min(height,top+frame.height*scaleY+8*scaleY)-y;
        const limit = Math.min(4096,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
        const scale = Math.min(1,limit/cropWidth,limit/cropHeight);
        source = document.createElement('canvas');
        source.width = Math.max(1,Math.round(cropWidth*scale));
        source.height = Math.max(1,Math.round(cropHeight*scale));
        source.getContext('2d').drawImage(element,x,y,cropWidth,cropHeight,0,0,source.width,source.height);
        item.crop = [x/width,(height-y-cropHeight)/height,cropWidth/width,cropHeight/height];
      }
      this.gl.bindTexture(this.gl.TEXTURE_2D,item.texture.texture);
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL,true);
      this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,source);
      if (!video) this.gl.generateMipmap(this.gl.TEXTURE_2D);
      item.ready = this.gl.getError()===this.gl.NO_ERROR;
      item.dirty = false;
      item.time = video ? element.currentTime : 0;
      return item.ready;
    } catch {
      // A cross-origin media source without CORS stays visible in the DOM.
      item.ready = false; item.dirty = false;
      return false;
    } finally {
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL,false);
    }
  }

  uniforms(item) {
    const rect = item.frame.getBoundingClientRect();
    const image = item.element.getBoundingClientRect();
    const style = getComputedStyle(item.element);
    const aspect = (item.video ? item.element.videoWidth : item.element.naturalWidth)/(item.video ? item.element.videoHeight : item.element.naturalHeight);
    const width = Math.max(image.width,image.height*aspect);
    const height = Math.max(image.height,image.width/aspect);
    const position = style.objectPosition.split(' ').map(value => parseFloat(value)/100);
    let opacity = 1;
    for (let parent=item.element; parent && parent!==document.body; parent=parent.parentElement) opacity *= parseFloat(getComputedStyle(parent).opacity);
    const uv = [
      (rect.left-image.left+(width-image.width)*position[0])/width,
      (image.bottom-rect.bottom+(height-image.height)*(1-position[1]))/height,
      rect.width/width,rect.height/height,
    ];
    if (item.crop) {
      uv[0] = (uv[0]-item.crop[0])/item.crop[2];
      uv[1] = (uv[1]-item.crop[1])/item.crop[3];
      uv[2] /= item.crop[2]; uv[3] /= item.crop[3];
    }
    return {
      uMedia:item.texture,
      uRect:[rect.left,innerHeight-rect.bottom,rect.width,rect.height],
      uUv:uv,
      uRadius:parseFloat(getComputedStyle(item.frame).borderTopLeftRadius)||0,
      uOpacity:opacity,
    };
  }

  render(values) {
    if (!this.items.length) return;
    const gl = this.gl, eligible = this.eligible();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    // Reuse the existing draw helper, VAO, viewport and paint texture.
    this.paint.programs.caseMedia = this.program;
    try {
      for (const item of this.items) {
        if (!eligible || !this.visible(item)) {
          item.element.classList.remove('is-distorted-media');
          continue;
        }
        if (item.dirty || (item.video && !item.element.requestVideoFrameCallback && item.element.currentTime!==item.time)) this.upload(item);
        if (item.ready) this.paint.draw('caseMedia',null,{ ...values,...this.uniforms(item) });
        item.element.classList.toggle('is-distorted-media',item.ready);
      }
    } finally {
      gl.disable(gl.BLEND);
    }
  }

  playing() {
    return this.eligible() && this.items.some(item => item.video && !item.element.paused && !item.element.ended && this.visible(item));
  }

  invalidate() {
    for (const item of this.items) item.dirty = true;
  }

  fallback() {
    for (const item of this.items) item.element.classList.remove('is-distorted-media');
  }

  destroy({ releaseTextures = true } = {}) {
    this.abort.abort(); this.fallback();
    for (const item of this.items) {
      if (item.callback!==undefined) item.element.cancelVideoFrameCallback(item.callback);
      if (releaseTextures) this.gl.deleteTexture(item.texture.texture);
    }
  }
}
