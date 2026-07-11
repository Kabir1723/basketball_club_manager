/* =========================================================================
   ferrofluid.js — vanilla WebGL port of the React Bits <Ferrofluid /> component
   (rewritten from ogl + React to plain WebGL, no extra dependency, same
   approach as the old galaxy.js it replaces).
   Renders a full-viewport, click-through molten-glass background tinted to
   the club's hyped black/blaze-orange/buzzer-yellow palette. The site is
   dark-mode only now, so this is always on — no light-mode branch, no
   toggle to sync with.
   Perf notes (mobile-first):
     - internal render resolution is scaled down and upscaled via CSS,
       since the effect is a soft glowing blob anyway (cheap trick, big win)
     - devicePixelRatio is capped harder on small/coarse-pointer screens
     - mouse-follow spike is skipped entirely on touch devices (coarse
       pointer), since dragging a finger across it fights page scroll
     - rendering pauses whenever the tab is hidden
   ========================================================================= */

(function (window, document) {
  'use strict';

  var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var CONFIG = {
    colors: ['#ff4b1f', '#ffd23f', '#170d08'],
    speed: 0.42,
    scale: 1.35,
    turbulence: 0.85,
    fluidity: 0.16,
    rimWidth: 0.22,
    sharpness: 3,
    shimmer: 0.85,
    glow: 2.1,
    flowDirection: 'up',
    opacity: 0.6,
    mouseInteraction: !isCoarsePointer,
    mouseStrength: 0.9,
    mouseRadius: 0.32,
    mouseDampening: 0.15,
    dprCap: isMobile ? 1.0 : 1.5,
    resolutionScale: isMobile ? 0.6 : 0.85
  };

  var MAX_COLORS = 8;

  function hexToRGB(hex) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    c = (c + '000000').slice(0, 6);
    return [
      parseInt(c.slice(0, 2), 16) / 255,
      parseInt(c.slice(2, 4), 16) / 255,
      parseInt(c.slice(4, 6), 16) / 255
    ];
  }

  function prepColors(input) {
    var base = (input && input.length ? input : ['#a855f7', '#d8b4fe', '#1a0b2e']).slice(0, MAX_COLORS);
    var count = base.length;
    var arr = [];
    for (var i = 0; i < MAX_COLORS; i++) {
      arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
    }
    return { arr: arr, count: count };
  }

  function flowVec(d) {
    switch (d) {
      case 'up': return [0, 1];
      case 'down': return [0, -1];
      case 'left': return [-1, 0];
      case 'right': return [1, 0];
      default: return [0, -1];
    }
  }

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
    'uniform vec3  iResolution;',
    'uniform vec2  iMouse;',
    'uniform float iTime;',
    'uniform vec3  uColor0;',
    'uniform vec3  uColor1;',
    'uniform vec3  uColor2;',
    'uniform vec3  uColor3;',
    'uniform vec3  uColor4;',
    'uniform vec3  uColor5;',
    'uniform vec3  uColor6;',
    'uniform vec3  uColor7;',
    'uniform int   uColorCount;',
    'uniform vec2  uFlow;',
    'uniform float uSpeed;',
    'uniform float uScale;',
    'uniform float uTurbulence;',
    'uniform float uFluidity;',
    'uniform float uRimWidth;',
    'uniform float uSharpness;',
    'uniform float uShimmer;',
    'uniform float uGlow;',
    'uniform float uOpacity;',
    'uniform float uMouseEnabled;',
    'uniform float uMouseStrength;',
    'uniform float uMouseRadius;',
    'varying vec2 vUv;',
    '#define PI 3.14159265',
    'vec3 palette(float h) {',
    '  int count = uColorCount;',
    '  if (count < 1) count = 1;',
    '  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));',
    '  if (idx <= 0) return uColor0;',
    '  if (idx == 1) return uColor1;',
    '  if (idx == 2) return uColor2;',
    '  if (idx == 3) return uColor3;',
    '  if (idx == 4) return uColor4;',
    '  if (idx == 5) return uColor5;',
    '  if (idx == 6) return uColor6;',
    '  return uColor7;',
    '}',
    'float hash(vec3 p3) {',
    '  p3 = fract(p3 * 0.1031);',
    '  p3 += dot(p3, p3.zyx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float smin(float a, float b, float k) {',
    '  float r = exp2(-a / k) + exp2(-b / k);',
    '  return -k * log2(r);',
    '}',
    'float sinlerp(float a, float b, float w) {',
    '  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);',
    '}',
    'float vn(vec2 p, float s, float seed) {',
    '  vec2 cellp = floor(p / s);',
    '  vec2 relp = mod(p, s);',
    '  float g1 = hash(vec3(cellp, seed));',
    '  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));',
    '  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));',
    '  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));',
    '  float bx = sinlerp(g1, g2, relp.x / s);',
    '  float tx = sinlerp(g4, g3, relp.x / s);',
    '  return sinlerp(bx, tx, relp.y / s);',
    '}',
    'float dbn(vec2 p, float s, float seed) {',
    '  float o = s / 2.0;',
    '  float n0 = vn(p, s, seed);',
    '  float n1 = vn(p + vec2(o, o), s, seed + 0.1);',
    '  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);',
    '  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);',
    '  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);',
    '  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;',
    '}',
    'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
    '  float ref = 700.0 / max(uScale, 0.05);',
    '  vec2 p = fragCoord / iResolution.y * ref;',
    '  float spd = 200.0 * uSpeed;',
    '  float t = iTime;',
    '  vec2 dir = uFlow;',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;',
    '  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;',
    '  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);',
    '  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);',
    '  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));',
    '  float mGlow = 0.0;',
    '  if (uMouseEnabled > 0.5) {',
    '    vec2 mp = iMouse / iResolution.y * ref;',
    '    float md = length(p - mp) / ref;',
    '    float rr = max(uMouseRadius, 0.02);',
    '    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;',
    '  }',
    '  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;',
    '  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);',
    '  ltn = pow(ltn, uSharpness) * uGlow;',
    '  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);',
    '  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);',
    '  vec3 col = palette(h);',
    '  vec3 outc = col * ltn;',
    '  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);',
    '  fragColor = vec4(outc, a * uOpacity);',
    '}',
    'void main() {',
    '  vec4 color;',
    '  mainImage(color, vUv * iResolution.xy);',
    '  gl_FragColor = color;',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Ferrofluid shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function Ferrofluid(canvas, opts) {
    var cfg = Object.assign({}, CONFIG, opts || {});
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
              canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) { console.warn('Ferrofluid: WebGL not supported'); return null; }

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
      console.error('Ferrofluid program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    // full-viewport triangle (covers NDC space with one triangle, no rect needed)
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
      'iResolution', 'iMouse', 'iTime',
      'uColor0', 'uColor1', 'uColor2', 'uColor3', 'uColor4', 'uColor5', 'uColor6', 'uColor7', 'uColorCount',
      'uFlow', 'uSpeed', 'uScale', 'uTurbulence', 'uFluidity', 'uRimWidth', 'uSharpness', 'uShimmer',
      'uGlow', 'uOpacity', 'uMouseEnabled', 'uMouseStrength', 'uMouseRadius'
    ].forEach(function (name) { U[name] = gl.getUniformLocation(program, name); });

    var colorData = prepColors(cfg.colors);
    var colorNames = ['uColor0', 'uColor1', 'uColor2', 'uColor3', 'uColor4', 'uColor5', 'uColor6', 'uColor7'];
    colorNames.forEach(function (name, i) { gl.uniform3fv(U[name], colorData.arr[i]); });
    gl.uniform1i(U.uColorCount, colorData.count);

    gl.uniform2fv(U.uFlow, flowVec(cfg.flowDirection));
    gl.uniform1f(U.uSpeed, cfg.speed);
    gl.uniform1f(U.uScale, cfg.scale);
    gl.uniform1f(U.uTurbulence, cfg.turbulence);
    gl.uniform1f(U.uFluidity, cfg.fluidity);
    gl.uniform1f(U.uRimWidth, cfg.rimWidth);
    gl.uniform1f(U.uSharpness, cfg.sharpness);
    gl.uniform1f(U.uShimmer, cfg.shimmer);
    gl.uniform1f(U.uGlow, cfg.glow);
    gl.uniform1f(U.uOpacity, cfg.opacity);
    gl.uniform1i(U.uMouseEnabled, cfg.mouseInteraction ? 1 : 0);
    gl.uniform1f(U.uMouseStrength, cfg.mouseStrength);
    gl.uniform1f(U.uMouseRadius, cfg.mouseRadius);

    var dpr = 1;
    var mouseTarget = [0, 0];
    var mouseCurrent = [0, 0];
    var lastFrameTime = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap) * cfg.resolutionScale;
      var w = window.innerWidth, h = window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(U.iResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    }

    function onPointerMove(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) * dpr;
      var y = (rect.height - (e.clientY - rect.top)) * dpr;
      mouseTarget[0] = x;
      mouseTarget[1] = y;
    }

    window.addEventListener('resize', resize, { passive: true });
    if (cfg.mouseInteraction) window.addEventListener('pointermove', onPointerMove, { passive: true });
    resize();

    var running = false;
    var rafId = null;
    var start = null;

    function frame(t) {
      rafId = requestAnimationFrame(frame);
      if (!running) return;
      if (!start) start = t;
      var elapsed = (t - start) * 0.001;

      if (!lastFrameTime) lastFrameTime = t;
      var dt = (t - lastFrameTime) / 1000;
      lastFrameTime = t;
      var tau = Math.max(1e-4, cfg.mouseDampening);
      var factor = Math.min(1, 1 - Math.exp(-dt / tau));
      mouseCurrent[0] += (mouseTarget[0] - mouseCurrent[0]) * factor;
      mouseCurrent[1] += (mouseTarget[1] - mouseCurrent[1]) * factor;

      gl.uniform1f(U.iTime, elapsed);
      gl.uniform2f(U.iMouse, mouseCurrent[0], mouseCurrent[1]);

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
        lastFrameTime = 0;
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return {
      start: function () { running = true; start = null; lastFrameTime = 0; },
      stop: function () { running = false; },
      dispose: function () {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        if (cfg.mouseInteraction) window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }

  function boot() {
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'ferro-bg';
    document.body.insertBefore(canvas, document.body.firstChild);

    var instance = Ferrofluid(canvas, {});
    if (!instance) return;

    // dark mode only now — no toggle to sync with, just run
    instance.start();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window, document);
