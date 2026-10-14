/**
 * Soft "fluid" glow rendered behind the page with a single fragment shader.
 * A few blurred brown blobs orbit slowly and follow scroll position,
 * mixed over the pale gold base colour. Falls back to a CSS gradient when
 * WebGL is unavailable.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform vec2 uMouse;      // pointer position, 0..1 with origin bottom-left
uniform float uFollow;    // 0 = idle drift, 1 = glow locked to the pointer
uniform vec3 uBase;
uniform vec3 uGlow;
uniform float uStrength; // how far the glow can pull the base toward uGlow (0..1)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float blob(vec2 uv, vec2 c, float r) {
  float d = length(uv - c);
  return exp(-(d * d) / (r * r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  uv.x *= aspect;

  float t = uTime * 0.06;
  float s = uScroll;

  // Blob centres wander on Lissajous paths and shift as the page scrolls.
  vec2 c1 = vec2(aspect * (0.5 + 0.18 * sin(t * 1.3 + s * 2.1)), 0.05 + 0.25 * sin(t * 0.9 + s * 3.0));
  vec2 c2 = vec2(aspect * (0.35 + 0.2 * cos(t * 0.8 + s * 1.7)), 0.3 + 0.35 * sin(t * 0.7 + s * 2.4 + 1.3));
  vec2 c3 = vec2(aspect * (0.68 + 0.16 * sin(t * 1.1 + 2.0 - s * 1.5)), 0.55 + 0.3 * cos(t * 0.6 + s * 1.9));

  // The main glow is pulled toward the cursor; the others trail loosely behind it.
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  vec2 idle = c1;
  c1 = mix(idle, m, uFollow);
  c2 = mix(c2, m + (c2 - idle) * 0.35, uFollow * 0.35);
  c3 = mix(c3, m + (c3 - idle) * 0.35, uFollow * 0.2);

  float pulse = 0.55 + 0.45 * sin(s * 6.2831 * 0.75 - 1.2);
  float f = blob(uv, c1, 0.50) * 0.95
          + blob(uv, c2, 0.36) * 0.55 * pulse
          + blob(uv, c3, 0.31) * 0.40 * (1.0 - pulse * 0.6);
  f = clamp(f, 0.0, 1.0);
  f = smoothstep(0.0, 1.0, f) * uStrength;

  vec3 col = mix(uBase, uGlow, f);

  // Fine grain keeps the gradient from banding.
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.025;

  gl_FragColor = vec4(col, 1.0);
}
`;

const hexToVec3 = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export function initFluid(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });

  if (!gl) {
    canvas.style.background =
      'radial-gradient(60% 50% at 50% 100%, rgb(245 247 250 / .6), transparent 70%), var(--bg)';
    canvas.classList.add('is-ready');
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u('uRes');
  const uTime = u('uTime');
  const uScroll = u('uScroll');
  const uMouse = u('uMouse');
  const uFollow = u('uFollow');
  // Keep in sync with --bg / --ink in style.css. Strength is capped so brown
  // text stays readable where it overlaps the brown glow.
  gl.uniform3fv(u('uBase'), hexToVec3('#f4e7b5'));
  gl.uniform3fv(u('uGlow'), hexToVec3('#f5f7fa'));
  gl.uniform1f(u('uStrength'), 0.65);

  // Render at reduced resolution — the image is a blur, so nobody can tell,
  // and it keeps the GPU cost tiny.
  const SCALE = 0.35;
  const resize = () => {
    const w = Math.max(1, Math.round(window.innerWidth * SCALE));
    const h = Math.max(1, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };
  resize();
  window.addEventListener('resize', resize);

  // Visitors who prefer reduced motion get a still glow.
  const paused = reduceMotion;
  let elapsed = 8; // start mid-motion so the first frame isn't static-looking
  let last = performance.now();
  let scrollTarget = 0;
  let scrollEased = 0;
  let raf = 0;

  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollTarget = window.scrollY / max;
  };
  readScroll();
  window.addEventListener('scroll', readScroll, { passive: true });

  // Pointer tracking: the glow eases toward the cursor, and eases back to its
  // idle drift when the pointer leaves the window. Touch input is ignored so
  // the glow doesn't jump around while scrolling on phones.
  const mouseTarget = { x: 0.5, y: 0.5 };
  const mouse = { x: 0.5, y: 0.5 };
  let followTarget = 0;
  let follow = 0;
  const followEnabled = !reduceMotion;

  if (followEnabled) {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        mouseTarget.x = e.clientX / window.innerWidth;
        mouseTarget.y = 1 - e.clientY / window.innerHeight;
        if (followTarget === 0) {
          // Entering fresh: start from the cursor so the glow doesn't sweep in from the old spot.
          if (follow < 0.05) {
            mouse.x = mouseTarget.x;
            mouse.y = mouseTarget.y;
          }
          followTarget = 1;
        }
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => (followTarget = 0));
    window.addEventListener('blur', () => (followTarget = 0));
  }

  const draw = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) elapsed += dt;
    scrollEased += (scrollTarget - scrollEased) * Math.min(1, dt * 3);
    // Frame-rate-independent easing: the glow lags the cursor slightly, like it's floating.
    if (!paused) {
      const k = 1 - Math.exp(-dt * 2.5);
      mouse.x += (mouseTarget.x - mouse.x) * k;
      mouse.y += (mouseTarget.y - mouse.y) * k;
      follow += (followTarget - follow) * (1 - Math.exp(-dt * 1.5));
    }
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uScroll, scrollEased);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uFollow, follow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(draw);
  };

  raf = requestAnimationFrame((now) => {
    last = now;
    draw(now);
    canvas.classList.add('is-ready');
  });

  // Stop rendering entirely while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else {
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }
  });
}
