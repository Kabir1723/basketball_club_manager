/* =========================================================================
   galaxy.js — vanilla WebGL port of the React Bits <Galaxy /> component
   (rewritten from ogl + React to plain WebGL, no extra dependency — same
   approach used for ferrofluid.js). Renders a full-viewport, click-through
   field of drifting spark/glint points, hue-shifted into the club's blaze-
   orange / buzzer-yellow palette so it reads as arena light and confetti
   rather than a literal night sky. Sits on top of the ferrofluid glow.
   Perf notes (mobile-first): internal resolution capped, mouse repulsion
   skipped on touch devices, rendering pauses when the tab is hidden.
   ========================================================================= */

(function (window, document) {
  'use strict';

  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var CONFIG = {
    density: isMobile ? 0.9 : 1.4,
    hueShift: 25,          // rotates the base palette toward blaze-orange / gold
    saturation: 0.85,
    glowIntensity: 0.42,
    twinkleIntensity: 0.6,
    starSpeed: 0.35,
    speed: 0.45,
    rotationSpeed: 0.035,
    mouseInteraction: !isCoarsePointer,
    mouseRepulsion: !isCoarsePointer,
    repulsionStrength: 1.6,
    autoCenterRepulsion: 0,
    focal: [0.5, 0.42],
    rotation: [1.0, 0.0],
    opacity: 0.55,
    dprCap: isMobile ? 1.0 : 1.5,
    resolutionScale: isMobile ? 0.65 : 0.9
  };

  var VERT = [
    'attribute vec2 uv;',
    'attribute vec2 position;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform float uTime;',
    'uniform vec3  uResolution;',
    'uniform vec2  uFocal;',
    'uniform vec2  uRotation;',
    'uniform float uStarSpeed;',
    'uniform float uDensity;',
    'uniform float uHueShift;',
    'uniform float uSpeed;',
    'uniform vec2  uMouse;',
    'uniform float uGlowIntensity;',
    'uniform float uSaturation;',
    'uniform bool  uMouseRepulsion;',
    'uniform float uTwinkleIntensity;',
    'uniform float uRotationSpeed;',
    'uniform float uRepulsionStrength;',
    'uniform float uMouseActiveFactor;',
    'uniform float uAutoCenterRepulsion;',
    'uniform float uOpacity;',
    'varying vec2 vUv;',
    '#define NUM_LAYER 4.0',
    '#define STAR_COLOR_CUTOFF 0.2',
    '#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)',
    '#define PERIOD 3.0',
    'float Hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }',
    'float tris(float x) {',
    '  float t = fract(x);',
    '  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));',
    '}',
    'float trisn(float x) {',
    '  float t = fract(x);',
    '  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;',
    '}',
    'vec3 hsv2rgb(vec3 c) {',
    '  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
    '  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',
    'float Star(vec2 uv, float flare) {',
    '  float d = length(uv);',
    '  float m = (0.05 * uGlowIntensity) / d;',
    '  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
    '  m += rays * flare * uGlowIntensity;',
    '  uv *= MAT45;',
    '  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
    '  m += rays * 0.3 * flare * uGlowIntensity;',
    '  m *= smoothstep(1.0, 0.2, d);',
    '  return m;',
    '}',
    'vec3 StarLayer(vec2 uv) {',
    '  vec3 col = vec3(0.0);',
    '  vec2 gv = fract(uv) - 0.5;',
    '  vec2 id = floor(uv);',
    '  for (int y = -1; y <= 1; y++) {',
    '    for (int x = -1; x <= 1; x++) {',
    '      vec2 offset = vec2(float(x), float(y));',
    '      vec2 si = id + vec2(float(x), float(y));',
    '      float seed = Hash21(si);',
    '      float size = fract(seed * 345.32);',
    '      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));',
    '      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;',
    '      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;',
    '      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;',
    '      float grn = min(red, blu) * seed;',
    '      vec3 base = vec3(red, grn, blu);',
    '      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;',
    '      hue = fract(hue + uHueShift / 360.0);',
    '      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;',
    '      float val = max(max(base.r, base.g), base.b);',
    '      base = hsv2rgb(vec3(hue, sat, val));',
    '      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;',
    '      float star = Star(gv - offset - pad, flareSize);',
    '      vec3 color = base;',
    '      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;',
    '      twinkle = mix(1.0, twinkle, uTwinkleIntensity);',
    '      star *= twinkle;',
    '      col += star * size * color;',
    '    }',
    '  }',
    '  return col;',
    '}',
    'void main() {',
    '  vec2 focalPx = uFocal * uResolution.xy;',
    '  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;',
    '  vec2 mouseNorm = uMouse - vec2(0.5);',
    '  if (uAutoCenterRepulsion > 0.0) {',
    '    vec2 centerUV = vec2(0.0, 0.0);',
    '    float centerDist = length(uv - centerUV);',
    '    vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));',
    '    uv += repulsion * 0.05;',
    '  } else if (uMouseRepulsion) {',
    '    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;',
    '    float mouseDist = length(uv - mousePosUV);',
    '    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));',
    '    uv += repulsion * 0.05 * uMouseActiveFactor;',
    '  } else {',
    '    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;',
    '    uv += mouseOffset;',
    '  }',
    '  float autoRotAngle = uTime * uRotationSpeed;',
    '  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));',
    '  uv = autoRot * uv;',
    '  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;',
    '  vec3 col = vec3(0.0);',
    '  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {',
    '    float depth = fract(i + uStarSpeed * uSpeed);',
    '    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);',
    '    float fade = depth * smoothstep(1.0, 0.9, depth);',
    '    col += StarLayer(uv * scale + i * 453.32) * fade;',
    '  }',
    '  float alpha = length(col);',
    '  alpha = smoothstep(0.0, 0.3, alpha);',
    '  alpha = min(alpha, 1.0) * uOpacity;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Galaxy shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function Galaxy(canvas, opts) {
    var cfg = Object.assign({}, CONFIG, opts || {});
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
              canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) { console.warn('Galaxy: WebGL not supported'); return null; }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Galaxy program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    var positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    var uvs = new Float32Array([0, 0, 2, 0, 0, 2]);

    var posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    var uvLoc = gl.getAttribLocation(program, 'uv');
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    [
      'uTime', 'uResolution', 'uFocal', 'uRotation', 'uStarSpeed', 'uDensity', 'uHueShift', 'uSpeed',
      'uMouse', 'uGlowIntensity', 'uSaturation', 'uMouseRepulsion', 'uTwinkleIntensity', 'uRotationSpeed',
      'uRepulsionStrength', 'uMouseActiveFactor', 'uAutoCenterRepulsion', 'uOpacity'
    ].forEach(function (name) { U[name] = gl.getUniformLocation(program, name); });

    gl.uniform2fv(U.uFocal, cfg.focal);
    gl.uniform2fv(U.uRotation, cfg.rotation);
    gl.uniform1f(U.uStarSpeed, cfg.starSpeed);
    gl.uniform1f(U.uDensity, cfg.density);
    gl.uniform1f(U.uHueShift, cfg.hueShift);
    gl.uniform1f(U.uSpeed, cfg.speed);
    gl.uniform1f(U.uGlowIntensity, cfg.glowIntensity);
    gl.uniform1f(U.uSaturation, cfg.saturation);
    gl.uniform1i(U.uMouseRepulsion, cfg.mouseRepulsion ? 1 : 0);
    gl.uniform1f(U.uTwinkleIntensity, cfg.twinkleIntensity);
    gl.uniform1f(U.uRotationSpeed, cfg.rotationSpeed);
    gl.uniform1f(U.uRepulsionStrength, cfg.repulsionStrength);
    gl.uniform1f(U.uAutoCenterRepulsion, cfg.autoCenterRepulsion);
    gl.uniform1f(U.uOpacity, cfg.opacity);

    var dpr = 1;
    var mouseTarget = [0.5, 0.5];
    var mouseCurrent = [0.5, 0.5];
    var activeTarget = 0.0;
    var activeCurrent = 0.0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap) * cfg.resolutionScale;
      var w = window.innerWidth, h = window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(U.uResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    }

    function onPointerMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouseTarget[0] = (e.clientX - rect.left) / rect.width;
      mouseTarget[1] = 1.0 - (e.clientY - rect.top) / rect.height;
      activeTarget = 1.0;
    }
    function onPointerLeave() { activeTarget = 0.0; }

    window.addEventListener('resize', resize, { passive: true });
    if (cfg.mouseInteraction) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }
    resize();

    var running = false;
    var rafId = null;
    var start = null;

    function frame(t) {
      rafId = requestAnimationFrame(frame);
      if (!running) return;
      if (!start) start = t;
      var elapsed = (t - start) * 0.001;

      var lerp = 0.05;
      mouseCurrent[0] += (mouseTarget[0] - mouseCurrent[0]) * lerp;
      mouseCurrent[1] += (mouseTarget[1] - mouseCurrent[1]) * lerp;
      activeCurrent += (activeTarget - activeCurrent) * lerp;

      gl.uniform1f(U.uTime, elapsed);
      gl.uniform1f(U.uStarSpeed, (elapsed * cfg.starSpeed) / 10.0);
      gl.uniform2f(U.uMouse, mouseCurrent[0], mouseCurrent[1]);
      gl.uniform1f(U.uMouseActiveFactor, activeCurrent);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    rafId = requestAnimationFrame(frame);

    function onVisibilityChange() {
      if (document.hidden) {
        running = false;
      } else {
        running = true;
        start = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return {
      start: function () { running = true; start = null; },
      stop: function () { running = false; },
      dispose: function () {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        if (cfg.mouseInteraction) {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerleave', onPointerLeave);
        }
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }

  function boot() {
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'galaxy-bg';
    var ferro = document.getElementById('ferro-bg');
    if (ferro && ferro.parentNode) {
      ferro.parentNode.insertBefore(canvas, ferro.nextSibling);
    } else {
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    var instance = Galaxy(canvas, {});
    if (!instance) return;
    instance.start();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window, document);
