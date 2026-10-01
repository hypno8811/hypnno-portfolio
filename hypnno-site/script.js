const worksSection = document.querySelector('.works');
const works = [...document.querySelectorAll('.work')];
const focus = document.getElementById('focus');
const closeBtn = document.getElementById('focus-close');
const focusTitle = document.getElementById('focus-title');
const focusType = document.getElementById('focus-type');
const focusDescription = document.getElementById('focus-description');
const focusLink = document.getElementById('focus-link');
const focusPlay = document.getElementById('focus-play');
const smearWrap = document.querySelector('.smear-wrap');

let activeWork = null;
let activeUrl = '';
let focusBusy = false;
let activeOrigin = null;
let activePlaceholder = null;
let activeMoveAnimation = null;



// Stronger pointer bounce: still minimal, but now the loose covers visibly react
// with spring inertia instead of following the cursor by only a few pixels.
const motion = works.map((work, index) => ({
  work,
  depth: 11 + (index % 3) * 5 + index * 1.25,
  x: 0,
  y: 0,
  r: 0,
  vx: 0,
  vy: 0,
  vr: 0,
  tx: 0,
  ty: 0,
  tr: 0
}));

function setMotionTargets(nx, ny) {
  motion.forEach((state, index) => {
    const alternate = index % 2 === 0 ? 1 : -1;
    state.tx = nx * state.depth;
    state.ty = ny * state.depth * .68;
    state.tr = nx * alternate * Math.min(1.35, state.depth * .055);
  });
}

window.addEventListener('pointermove', (event) => {
  if (document.body.classList.contains('focus-open')) return;
  const nx = event.clientX / innerWidth * 2 - 1;
  const ny = event.clientY / innerHeight * 2 - 1;
  setMotionTargets(nx, ny);
}, { passive: true });

window.addEventListener('pointerleave', () => {
  setMotionTargets(0, 0);
}, { passive: true });

window.addEventListener('blur', () => {
  setMotionTargets(0, 0);
});

function animateMotion() {
  for (const state of motion) {
    if (state.work.classList.contains('is-floating')) continue;

    const spring = .105;
    const damping = .76;
    state.vx = (state.vx + (state.tx - state.x) * spring) * damping;
    state.vy = (state.vy + (state.ty - state.y) * spring) * damping;
    state.vr = (state.vr + (state.tr - state.r) * spring) * damping;
    state.x += state.vx;
    state.y += state.vy;
    state.r += state.vr;

    state.work.style.setProperty('--mx', `${state.x.toFixed(2)}px`);
    state.work.style.setProperty('--my', `${state.y.toFixed(2)}px`);
    state.work.style.setProperty('--mr', `${state.r.toFixed(3)}deg`);
  }

  requestAnimationFrame(animateMotion);
}
animateMotion();

function targetRectFor(sourceRect) {
  const vw = innerWidth;
  const vh = innerHeight;
  const mobile = vw <= 900;
  const maxW = mobile ? vw * .78 : vw * .36;
  const maxH = mobile ? vh * .54 : vh * .72;
  const ratio = sourceRect.width / sourceRect.height;

  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }

  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height
  };
}

function rectKeyframes(from, to) {
  return [
    {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`
    },
    {
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${to.width}px`,
      height: `${to.height}px`
    }
  ];
}

function applyRect(element, rect) {
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function snapshotRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function resetWorkMotion(work) {
  const state = motion.find(item => item.work === work);
  if (!state) return;
  state.x = state.y = state.r = 0;
  state.vx = state.vy = state.vr = 0;
  state.tx = state.ty = state.tr = 0;
  work.style.setProperty('--mx', '0px');
  work.style.setProperty('--my', '0px');
  work.style.setProperty('--mr', '0deg');
}

async function moveActualWork(work, from, to, duration = 820) {
  if (activeMoveAnimation) {
    activeMoveAnimation.cancel();
    activeMoveAnimation = null;
  }

  const animation = work.animate(rectKeyframes(from, to), {
    duration,
    easing: 'cubic-bezier(.2,.72,.16,1)',
    fill: 'forwards'
  });

  activeMoveAnimation = animation;

  try {
    await animation.finished;
  } catch (_) {
    return false;
  }

  // Preserve the exact final geometry as inline styles, then remove the WAAPI
  // fill layer. This prevents the finished animation from fighting the card's
  // normal absolute positioning when it is placed back in .works.
  applyRect(work, to);
  animation.cancel();

  if (activeMoveAnimation === animation) {
    activeMoveAnimation = null;
  }

  return true;
}

async function openFocus(work) {
  if (focusBusy || activeWork) return;
  focusBusy = true;
  activeWork = work;

  const img = work.querySelector('img');

  // Capture the exact on-screen position first, including the current mouse bounce.
  // Then measure the card's neutral home position without hover/bounce transforms.
  // The close animation targets that neutral position so removing inline styles cannot
  // create the small end-of-animation jump that was visible in the recording.
  const sourceRect = img.getBoundingClientRect();
  work.classList.add('is-measuring');
  resetWorkMotion(work);
  const homeRect = img.getBoundingClientRect();
  work.classList.remove('is-measuring');

  const targetRect = targetRectFor(homeRect);
  const { title, type, description, link, linkLabel } = work.dataset;

  activeOrigin = snapshotRect(homeRect);
  activeUrl = link || '';
  activePlaceholder = document.createComment('hypnno-work-origin');
  work.parentNode.insertBefore(activePlaceholder, work);

  focusTitle.textContent = title;
  focusType.textContent = type;
  focusDescription.textContent = description;
  focusLink.href = link;
  focusLink.textContent = `${linkLabel || 'OPEN'} ↗`;
  smearWrap.dataset.ghost = title;

  resetWorkMotion(work);
  work.classList.add('is-selected', 'is-floating');
  applyRect(work, sourceRect);
  document.body.appendChild(work);

  worksSection.classList.add('is-muted');
  document.body.classList.add('focus-open');
  focus.classList.remove('is-closing');
  focus.classList.add('is-open');
  focus.setAttribute('aria-hidden', 'false');

  shaderPulse(1);
  await moveActualWork(work, sourceRect, targetRect, 840);
  focusBusy = false;
}

async function closeFocus() {
  if (!activeWork || focusBusy) return;
  focusBusy = true;
  const work = activeWork;
  const currentRect = work.getBoundingClientRect();

  focus.classList.add('is-closing');
  shaderPulse(-1);

  // The same physical card now travels from its centered rect all the way back
  // to its measured home rect. No teleport, no cloned replacement.
  const returnedHome = await moveActualWork(work, snapshotRect(currentRect), activeOrigin, 840);
  if (!returnedHome) {
    focusBusy = false;
    return;
  }

  if (activePlaceholder?.parentNode) {
    activePlaceholder.parentNode.insertBefore(work, activePlaceholder);
    activePlaceholder.remove();
  }

  work.classList.remove('is-floating', 'is-selected');
  work.removeAttribute('style');
  resetWorkMotion(work);

  focus.classList.remove('is-open', 'is-closing');
  focus.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('focus-open');
  worksSection.classList.remove('is-muted');

  activeWork = null;
  activeOrigin = null;
  activePlaceholder = null;
  activeMoveAnimation = null;
  activeUrl = '';
  focusBusy = false;
}

works.forEach(work => work.addEventListener('click', () => {
  if (work.classList.contains('is-floating')) return;
  openFocus(work);
}));
closeBtn.addEventListener('click', closeFocus);
focus.addEventListener('click', (event) => {
  if (event.target === focus || event.target.classList.contains('focus-dim')) closeFocus();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeWork) closeFocus();
});
focusPlay.addEventListener('click', () => {
  if (activeUrl) window.open(activeUrl, '_blank', 'noopener,noreferrer');
});

// --- Real WebGL transition layer ---
// The shader is intentionally monochrome and restrained. It only appears during the transition.
const shaderCanvas = document.getElementById('transition-shader');
const gl = shaderCanvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
let shaderState = { progress: 0, target: 0, direction: 1, raf: 0, start: 0 };

if (gl) {
  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main(){
      vUv = aPosition * .5 + .5;
      gl_Position = vec4(aPosition,0.,1.);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform float uProgress;
    uniform float uTime;
    uniform vec2 uResolution;

    float hash(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
    }

    void main(){
      vec2 uv = vUv;
      float p = smoothstep(0.,1.,uProgress);
      float columns = noise(vec2(floor(uv.x * 58.0), uTime * .22));
      float streak = pow(columns, 2.5) * p;
      float sweep = smoothstep(-.08, .55, p - uv.y * .7 + streak * .32);
      float grain = noise(uv * vec2(13., 90.) + vec2(0., uTime * 1.4));
      float alpha = (sweep * .26 + streak * .16 * grain) * (1.0 - smoothstep(.76,1.,p) * .55);
      gl_FragColor = vec4(vec3(0.0), alpha);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uProgress = gl.getUniformLocation(program, 'uProgress');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uResolution = gl.getUniformLocation(program, 'uResolution');

  function resizeShader() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    shaderCanvas.width = Math.floor(innerWidth * dpr);
    shaderCanvas.height = Math.floor(innerHeight * dpr);
    gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
  }
  resizeShader();
  window.addEventListener('resize', resizeShader, { passive: true });

  function renderShader(now) {
    const elapsed = now - shaderState.start;
    const duration = 820;
    const t = Math.min(1, elapsed / duration);
    const curve = 1 - Math.pow(1 - t, 3);
    const p = shaderState.direction > 0 ? curve : 1 - curve;
    shaderCanvas.style.opacity = `${Math.sin(Math.PI * t) * .95}`;
    gl.uniform1f(uProgress, p);
    gl.uniform1f(uTime, now * .001);
    gl.uniform2f(uResolution, shaderCanvas.width, shaderCanvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (t < 1) shaderState.raf = requestAnimationFrame(renderShader);
    else shaderCanvas.style.opacity = '0';
  }

  window.shaderPulse = function(direction = 1) {
    cancelAnimationFrame(shaderState.raf);
    shaderState.direction = direction;
    shaderState.start = performance.now();
    shaderState.raf = requestAnimationFrame(renderShader);
  };
} else {
  window.shaderPulse = () => {};
}
