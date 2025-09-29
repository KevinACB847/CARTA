/* =========================================================
   VIAJE — Planetarium 1:01–2:25  (JS Engine)
   Estilo: Jazz Noir Minimal | Capas: bgCanvas + fxCanvas
   Reloj único: t = audio.currentTime
   Cues seguros al seek + Heartbeat visual
   ========================================================= */

/* -----------------------------
   0) SELECTORES Y ESTADO GLOBAL
   ----------------------------- */
const stage     = document.querySelector('.stage');
const bgCanvas  = document.getElementById('bgCanvas');
const fxCanvas  = document.getElementById('fxCanvas');
const focEl     = document.querySelector('.foco-dorado');
const flashEl   = document.getElementById('v-flash');
const whisperEl = document.getElementById('v-whisper');
const btnStart  = document.getElementById('btnStart');
const audio     = document.querySelector('audio'); // <audio src="music/planetarium.mp3" id="audio" ...>

if (!stage || !bgCanvas || !fxCanvas || !btnStart || !audio) {
  console.warn('[viaje] Falta estructura mínima en el HTML. Revisa el snippet del CSS (bloque 8).');
}

const isCoarse = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -----------------------------
   1) RENDER CONFIG + DPR CAP
   ----------------------------- */
let bg = bgCanvas.getContext('2d', { alpha: false });
let fx = fxCanvas.getContext('2d', { alpha: true });

const DPR_CAP = isCoarse ? 1.5 : 2.0;
function getDPR(){ return Math.min(window.devicePixelRatio || 1, DPR_CAP); }

function resize() {
  const dpr = getDPR();
  const w = Math.floor(stage.clientWidth  * dpr);
  const h = Math.floor(stage.clientHeight * dpr);

  [bgCanvas, fxCanvas].forEach(cv => {
    cv.width  = w; cv.height = h;
    cv.style.width  = stage.clientWidth + 'px';
    cv.style.height = stage.clientHeight + 'px';
  });

  bg.setTransform(1,0,0,1,0,0);
  fx.setTransform(1,0,0,1,0,0);
  bg.scale(dpr, dpr);
  fx.scale(dpr, dpr);

  WORLD.w = stage.clientWidth;
  WORLD.h = stage.clientHeight;
}
window.addEventListener('resize', resize);

/* -----------------------------
   2) MUNDO Y PARÁMETROS
   ----------------------------- */
const WORLD = {
  w: stage.clientWidth,
  h: stage.clientHeight,
  t0: 61.0,          // tramo arranca en 1:01
  t1: 145.0,         // tramo termina en 2:25
  lastFrameMs: performance.now(),
  fpsAvg: 60,
  parallax: {x:0,y:0}, // -1..1
  drift: {x:0, y:0, t:0}, // cámara flotante
  breathing: {zoom:1, bright:1, roll:0},
  eventClock: {lastAt: 61.0}, // para heartbeat visual
  mobile: isCoarse
};

// Paleta para canvas
const COLORS = {
  midnight: '#0b0f1d',
  royal:    '#243b6b',
  gold:     'rgba(255,218,107,',
  lav:      'rgba(215,200,255,',
  ivory:    'rgba(242,239,233,'
};

// Densidades adaptativas
const DENSITY = {
  dust: prefersReduced ? 200 : (WORLD.mobile ? 600 : 1000),     // recomendado 400–800 móvil / 800–1200 desktop
  bokeh: prefersReduced ? 10 : 24,
  raysMax: prefersReduced ? 2 : 3,
  meteorsMax: 3
};

// Ajuste dinámico si baja FPS
const PERF = {
  window: 30,              // frames para media móvil
  minFps: WORLD.mobile ? 42 : 48,
  dustMin: WORLD.mobile ? 400 : 700
};

/* -----------------------------
   3) ESTRUCTURAS DE CAPAS
   ----------------------------- */
// 3.1 Fondo: gradiente + polvo + bokeh
const Dust = [];
const Bokeh = [];
let nebulaSeed = Math.random() * 1000; // glows/nebulosas suaves

// 3.2 FX: rayos + notas + fugaces
const Rays = [];
const Notes = [];
const Meteors = [];

// 3.3 Caches
let rayGradient = null;     // reutilizar gradiente de rayos
let meteorGradient = null;  // colas de fugaces

/* -----------------------------
   4) UTILIDADES
   ----------------------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

function easeInOutCubic(t){
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}

function rand(a,b){ return a + Math.random()*(b-a); }

function chance(p){ return Math.random() < p; }

function now(){ return performance.now(); }

/* Coordenadas con parallax/ drift */
function camOffset() {
  const px = WORLD.parallax.x * 10; // parallax leve
  const py = WORLD.parallax.y * 8;
  const dx = Math.sin(WORLD.drift.t * 0.13) * 10;
  const dy = Math.cos(WORLD.drift.t * 0.17) * 8;
  return { x: px + dx, y: py + dy };
}

/* -----------------------------
   5) INICIALIZACIÓN PARTÍCULAS
   ----------------------------- */
function initDust() {
  Dust.length = 0;
  const n = DENSITY.dust;
  const cx = WORLD.w * 0.5, cy = WORLD.h * 0.42;
  const R = Math.hypot(WORLD.w, WORLD.h) * 0.6;
  for (let i=0;i<n;i++){
    const r = Math.pow(Math.random(), 0.7) * R;
    const a = Math.random() * Math.PI*2;
    Dust.push({
      r, a,
      z: rand(0.6, 1.0), // profundidad: afecta brillo
      tw: rand(0.3, 1.0), // twinkle
      sp: rand(0.0004, 0.0011), // swirl speed
      size: rand(0.6, 1.8)
    });
  }
}

function initBokeh() {
  Bokeh.length = 0;
  const n = DENSITY.bokeh;
  for (let i=0;i<n;i++){
    Bokeh.push({
      x: Math.random()*WORLD.w,
      y: Math.random()*WORLD.h,
      r: rand(24, 120),
      s: rand(0.06, 0.14),   // soft edge
      a: rand(0.06, 0.22),   // alpha base
      dx: rand(-0.08, 0.08),
      dy: rand(-0.06, 0.06)
    });
  }
}

/* -----------------------------
   6) RAYOS CURVOS + NOTAS
   ----------------------------- */
function makeRay(seedY, amp, k=0){
  // Curva cúbica izquierda→derecha con ondulación suave
  const h = WORLD.h;
  const y0 = lerp(h*0.25, h*0.75, seedY);
  const y1 = y0 + amp * (k===0 ? 1 : (k%2===0? -1 : 1));
  const y2 = y1 + amp*0.6;
  const y3 = lerp(h*0.25, h*0.75, seedY + 0.12);

  const x0 = -WORLD.w*0.2;
  const x1 = WORLD.w * 0.25;
  const x2 = WORLD.w * 0.65;
  const x3 = WORLD.w * 1.15;

  return {
    p0:{x:x0,y:y0}, p1:{x:x1,y:y1}, p2:{x:x2,y:y2}, p3:{x:x3,y:y3},
    width: 1.4, glow: 0.75, born: audio.currentTime, notes: []
  };
}

function bezier(p0,p1,p2,p3,t){
  const it=1-t;
  const x = it*it*it*p0.x + 3*it*it*t*p1.x + 3*it*t*t*p2.x + t*t*t*p3.x;
  const y = it*it*it*p0.y + 3*it*it*t*p1.y + 3*it*t*t*p2.y + t*t*t*p3.y;
  return {x,y};
}

function bezierTangent(p0,p1,p2,p3,t){
  const it=1-t;
  const x = -3*it*it*p0.x + 3*(it*it - 2*it*t)*p1.x + 3*(2*it*t - t*t)*p2.x + 3*t*t*p3.x;
  const y = -3*it*it*p0.y + 3*(it*it - 2*it*t)*p1.y + 3*(2*it*t - t*t)*p2.y + 3*t*t*p3.y;
  return {x,y};
}

function spawnNote(ray, speed=rand(0.08,0.12)){
  Notes.push({
    ray, s: 0, speed, size: rand(1.8,2.6), alive:true, hue: rand(0,1)
  });
  WORLD.eventClock.lastAt = audio.currentTime;
}

/* -----------------------------
   7) FUGACES (METEOROS)
   ----------------------------- */
function spawnMeteor(opts={}){
  const side = chance(0.5) ? 'L' : 'R';
  const x = opts.x ?? (side==='L' ? rand(-WORLD.w*0.1, WORLD.w*0.25) : rand(WORLD.w*0.75, WORLD.w*1.1));
  const y = opts.y ?? rand(WORLD.h*0.1, WORLD.h*0.8);
  const ang = opts.ang ?? (side==='L' ? rand(-0.28,-0.18) : rand(Math.PI-(-0.28), Math.PI-(-0.18))); // diagonales
  const spd = opts.spd ?? rand(420, 620);
  const life = opts.life ?? rand(0.45, 0.75);
  Meteors.push({ x, y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, life, age:0, w: rand(1.4,1.8) });
  if (Meteors.length > DENSITY.meteorsMax) Meteors.shift();
  WORLD.eventClock.lastAt = audio.currentTime;
}

/* -----------------------------
   8) FLASH & SUSURROS
   ----------------------------- */
let whisperQueue = ["SIEMPRE","TÚ Y YO","EN CASA"];
function flash(ms=120){
  if (!flashEl) return;
  flashEl.classList.add('is-on');
  setTimeout(()=>flashEl.classList.remove('is-on'), ms);
  WORLD.eventClock.lastAt = audio.currentTime;
}
function showWhisper(text, dur=1400){
  if (!whisperEl) return;
  whisperEl.textContent = text || whisperQueue.shift() || "";
  whisperEl.classList.add('show');
  setTimeout(()=> whisperEl.classList.remove('show'), dur);
  WORLD.eventClock.lastAt = audio.currentTime;
}

/* -----------------------------
   9) BOTÓN INICIAR / AUTOPLAY
   ----------------------------- */
btnStart?.addEventListener('click', async () => {
  try{
    await audio.play();
    document.body.classList.add('v-active');
    loop();
  }catch(e){
    console.warn('No se pudo reproducir el audio aún:', e);
  }
});

/* -----------------------------
   10) INTERACCIÓN (NO ROMPE MÚSICA)
   ----------------------------- */
stage.addEventListener('pointermove', (e)=>{
  const r = stage.getBoundingClientRect();
  const nx = ((e.clientX - r.left)/r.width )*2 - 1;
  const ny = ((e.clientY - r.top )/r.height)*2 - 1;
  WORLD.parallax.x = clamp(nx, -1, 1);
  WORLD.parallax.y = clamp(ny, -1, 1);

  // Boost leve
  document.body.classList.add('v-boost-stars');
  clearTimeout(window.__boost_t);
  window.__boost_t = setTimeout(()=>document.body.classList.remove('v-boost-stars'), 400);
});

stage.addEventListener('pointerdown', (e)=>{
  // Nota/estrellita decorativa
  const el = document.createElement('div');
  el.className = 'tap-note';
  el.style.left = e.clientX + 'px';
  el.style.top  = e.clientY + 'px';
  stage.appendChild(el);
  setTimeout(()=> el.remove(), 1300);
});

/* -----------------------------
   11) CUES (SEEK-SEGUROS)
   ----------------------------- */
/*
Marcadores:
1:06, 1:12, 1:24, 1:28, 1:42, 1:48, 1:50, 1:56, 2:04, 2:18, 2:20, 2:23
(Tramo inicia 1:01; fin 2:25)
*/
const cues = [
  {t: 66,  once:false, hit:(t)=> { // susurro inicial (~1:06)
      if (t<86) showWhisper("PROMESA", 1200);
    }},
  {t: 72,  once:true,  hit:()=> {/* latido leve: meteoro suave o nota */ heartbeatKick(true); }},
  {t: 84,  once:true,  hit:()=> { spawnMeteor({ ang: -0.22, spd: 520 }); }},  // 1:24 fugaz diagonal
  {t: 88,  once:true,  hit:()=> { // 1:28 nervio: + brillo momentáneo
      document.body.classList.add('v-boost-stars'); setTimeout(()=>document.body.classList.remove('v-boost-stars'), 700);
    }},
  {t: 100, once:true,  hit:()=> { bokehIn = 1; }}, // 1:40 aparece bokeh
  {t: 102, once:true,  hit:()=> flash(120)},       // 1:42 micro-flash
  {t: 108, once:true,  hit:()=> flash(110)},       // 1:48 micro-flash
  {t: 110, once:true,  hit:()=> { // 1:50 ampliar rayos
      Rays.forEach(r=> r.glow = 0.95);
    }},
  {t: 112, once:true,  hit:()=> { /* buffer hacia 1:56 */ }},
  {t: 116, once:true,  hit:()=> { // 1:56 doble cruce
      spawnMeteor({ ang:-0.21, spd:600 });
      setTimeout(()=>spawnMeteor({ ang:Math.PI-(-0.21), spd:600 }), 60);
    }},
  {t: 124, once:false, hit:(t)=> { // 2:04 ramp-1 + susurro claro
      document.body.classList.add('v-ramp-1');
      showWhisper("CLARO", 1200);
    }},
  {t: 138, once:true,  hit:()=> { // 2:18 abanico triple de notas-luz
      shootFanNotes();
    }},
  {t: 140, once:false, hit:()=> { // 2:20 preclímax (estado)
      document.body.classList.add('v-preclimax');
    }},
  {t: 143, once:true,  hit:()=> flash(120)}        // 2:23 flash preparación
];

// Gestión de ejecución (para evitar spam por seek)
cues.forEach(c => c._last = -Infinity);

function evalCues(t, dt){
  for (const c of cues){
    // Ventana suave de disparo (±100 ms)
    if (Math.abs(t - c.t) <= 0.10){
      if (c.once && (t - c._last) < 2.0) continue; // ya se disparó en ventana reciente
      c.hit(t);
      c._last = t;
      WORLD.eventClock.lastAt = t;
    }
  }
  // Estados deterministas por tiempo (seek-friendly)
  if (t >= 124) document.body.classList.add('v-ramp-1'); else document.body.classList.remove('v-ramp-1');
  if (t >= 140) document.body.classList.add('v-preclimax'); else document.body.classList.remove('v-preclimax');
}

/* -----------------------------
   12) HEARTBEAT VISUAL
   ----------------------------- */
function heartbeatPeriod(t){
  const u = clamp((t - WORLD.t0) / (WORLD.t1 - WORLD.t0), 0, 1);
  return lerp(2.4, 1.6, u); // al final más seguido
}
function heartbeatKick(gentle=false){
  if (gentle || chance(0.55)) {
    // nota en algún rayo (si existe), si no meteoro suave
    if (Rays.length){
      const r = Rays[Math.floor(Math.random()*Rays.length)];
      spawnNote(r, rand(0.08,0.11));
    } else {
      spawnMeteor({ spd: rand(420,520), life: rand(0.4,0.6) });
    }
  } else {
    spawnMeteor();
  }
}
function heartbeat(t){
  const p = heartbeatPeriod(t);
  if ((t - WORLD.eventClock.lastAt) >= p){
    heartbeatKick();
    WORLD.eventClock.lastAt = t;
  }
}

/* -----------------------------
   13) BOKEH / FOCO / BREATHING
   ----------------------------- */
let bokehIn = 0; // 0..1
function updateBokeh(dt){
  if (bokehIn > 0) bokehIn = clamp(bokehIn + dt*0.35, 0, 1);
  for (const b of Bokeh){
    b.x += b.dx * dt * 60;
    b.y += b.dy * dt * 60;
    if (b.x < -b.r) b.x += WORLD.w + b.r*2;
    if (b.x > WORLD.w + b.r) b.x -= WORLD.w + b.r*2;
    if (b.y < -b.r) b.y += WORLD.h + b.r*2;
    if (b.y > WORLD.h + b.r) b.y -= WORLD.h + b.r*2;
  }
}

function drawBackground(t, dt){
  const {w,h} = WORLD;
  const cam = camOffset();

  // Fondo gradiente profundo + nebula leve
  const g = bg.createLinearGradient(0,0,0,h);
  g.addColorStop(0.0, '#0b0f1d'); // midnight
  g.addColorStop(0.55,'#0b1224');
  g.addColorStop(1.0, '#0b0f1d');
  bg.fillStyle = g;
  bg.fillRect(0,0,w,h);

  // Nebulosas suaves (pocas, grandes)
  nebulaSeed += dt*0.05;
  for (let i=0;i<3;i++){
    const nx = (Math.sin(nebulaSeed*0.7 + i*1.7)*0.5+0.5)*w;
    const ny = (Math.cos(nebulaSeed*0.6 + i*2.1)*0.5+0.5)*h*0.9;
    const r  = lerp(260, 420, (i+1)/3);
    const grad = bg.createRadialGradient(nx+cam.x*0.3,ny+cam.y*0.25, r*0.1, nx+cam.x*0.3,ny+cam.y*0.25, r);
    grad.addColorStop(0, 'rgba(36,59,107,0.28)');   // royal
    grad.addColorStop(1, 'rgba(11,15,29,0.0)');     // midnight 0
    bg.globalCompositeOperation = 'source-over';
    bg.fillStyle = grad;
    bg.beginPath(); bg.arc(nx,ny,r,0,Math.PI*2); bg.fill();
  }

  // Polvo dorado en espiral (swirl horario)
  bg.save();
  bg.translate(w*0.5 + cam.x*0.35, h*0.42 + cam.y*0.30);
  bg.globalCompositeOperation = 'lighter';
  for (const p of Dust){
    p.a += p.sp * dt * 60; // swirl
    const x = Math.cos(p.a) * p.r * 0.66;
    const y = Math.sin(p.a) * p.r * 0.40;
    const tw = (Math.sin(t*2.2 + p.r*0.01) * 0.5 + 0.5) * p.tw;
    const alpha = (0.045 + 0.055*p.z) * (0.65 + 0.35*tw);
    bg.fillStyle = `${COLORS.gold}${alpha.toFixed(3)})`;
    bg.fillRect(x, y, p.size, p.size);
  }
  bg.restore();

  // Bokeh (aparece 1:40)
  if (bokehIn > 0){
    bg.save();
    bg.globalCompositeOperation = 'screen';
    for (const b of Bokeh){
      const grad = bg.createRadialGradient(b.x+cam.x*0.15, b.y+cam.y*0.15, b.r*0.25, b.x+cam.x*0.15, b.y+cam.y*0.15, b.r);
      grad.addColorStop(0, `rgba(242,239,233,${0.06*b.a*bokehIn})`); // ivory
      grad.addColorStop(1, `rgba(36,59,107,0)`); // royal 0
      bg.fillStyle = grad;
      bg.beginPath(); bg.arc(b.x, b.y, b.r, 0, Math.PI*2); bg.fill();
    }
    bg.restore();
  }
}

/* Foco dorado elíptico (abre 10%→25%) y breathing global */
function updateFocusAndBreathing(t, dt){
  // A) 1:01–1:20 “Toma de aire”: apertura del foco
  const openU = clamp((t - 61) / (19), 0, 1); // 0..1 de 1:01 a 1:20
  const scaleY = lerp(1.0, 1.22, easeInOutCubic(openU));
  const transY = lerp(0, 6, openU);
  if (focEl){
    focEl.style.transform = `translateY(${transY}vh) scaleY(${scaleY})`;
    focEl.style.opacity = String(lerp(0.80, 0.98, openU));
  }

  // Breathing: zoom + brillo + roll (pequeño)
  const u = clamp((t - WORLD.t0)/(WORLD.t1 - WORLD.t0), 0, 1);
  const breath = Math.sin(t * 0.55) * 0.5 + 0.5; // 0..1
  const roll = Math.sin(t * 0.18) * 0.4;         // ±0.4°
  const baseZoom = lerp(1.000, 1.024, breath) * lerp(1.0, 1.03, u*0.6);
  const baseBright = lerp(1.00, 1.044, breath) * lerp(1.00, 1.03, u*0.6);

  document.documentElement.style.setProperty('--v-zoom',   baseZoom.toFixed(3));
  document.documentElement.style.setProperty('--v-bright', baseBright.toFixed(3));
  document.documentElement.style.setProperty('--v-roll',   roll.toFixed(3) + 'deg');

  // Preclímax 2:20–2:25 acelera hacia los tokens del estado .v-preclimax
}

/* -----------------------------
   14) DIBUJO RAYOS + NOTAS
   ----------------------------- */
function ensureRayGradient(){
  if (rayGradient) return rayGradient;
  const g = fx.createLinearGradient(0,0, WORLD.w, 0);
  g.addColorStop(0.00, 'rgba(36,59,107,0.0)');      // royal 0
  g.addColorStop(0.25, 'rgba(215,200,255,0.22)');   // lav
  g.addColorStop(0.55, 'rgba(255,218,107,0.38)');   // gold
  g.addColorStop(0.75, 'rgba(242,239,233,0.30)');   // ivory
  g.addColorStop(1.00, 'rgba(36,59,107,0.0)');
  rayGradient = g;
  return g;
}
function ensureMeteorGradient(){
  if (meteorGradient) return meteorGradient;
  const g = fx.createLinearGradient(0,0, 1,0);
  g.addColorStop(0.0,  'rgba(242,239,233,0.0)');
  g.addColorStop(0.35, 'rgba(215,200,255,0.35)');
  g.addColorStop(0.75, 'rgba(255,218,107,0.85)');
  g.addColorStop(1.0,  'rgba(255,218,107,0.0)');
  meteorGradient = g;
  return g;
}

function updateRays(t, dt){
  // Introducción de rayos en 1:20–1:40 (2–3 rayos)
  if (t >= 80 && Rays.length === 0){ // 1:20
    Rays.push(makeRay(0.32, WORLD.h*0.10, 0));
    Rays.push(makeRay(0.56, WORLD.h*0.12, 1));
  }
  if (t >= 90 && Rays.length === 2 && DENSITY.raysMax>=3){ // 1:30 (sutil)
    Rays.push(makeRay(0.44, WORLD.h*0.14, 2));
  }

  // Notas que viajan por esos rayos (cadencia suave)
  if (Rays.length && (Notes.length < Rays.length*4)) {
    if (chance(0.03 * dt * 60)) {
      const r = Rays[Math.floor(Math.random()*Rays.length)];
      spawnNote(r, rand(0.08,0.12));
    }
  }

  // Actualizar notas
  for (const n of Notes){
    n.s += n.speed * dt * 0.18; // velocidad temporal
    if (n.s >= 1) n.alive = false;
  }
  // Purga
  for (let i=Notes.length-1;i>=0;i--) if (!Notes[i].alive) Notes.splice(i,1);
}

function drawRaysAndNotes(t, dt){
  const cam = camOffset();
  fx.save();
  fx.translate(cam.x*0.2, cam.y*0.2);

  // Rayos
  if (Rays.length){
    fx.globalCompositeOperation = 'lighter';
    fx.lineCap = 'round';
    fx.lineJoin = 'round';
    const g = ensureRayGradient();
    for (const r of Rays){
      fx.strokeStyle = g;
      fx.lineWidth = r.width;
      fx.beginPath();
      for (let s=0; s<=1; s+=0.025){
        const p = bezier(r.p0,r.p1,r.p2,r.p3, s);
        if (s===0) fx.moveTo(p.x,p.y); else fx.lineTo(p.x,p.y);
      }
      fx.stroke();
    }

    // Notas-luz
    for (const n of Notes){
      const p = bezier(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3, n.s);
      const q = bezierTangent(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3, n.s);
      const ang = Math.atan2(q.y, q.x);
      const tail = 14;
      fx.beginPath();
      fx.moveTo(p.x - Math.cos(ang)*tail, p.y - Math.sin(ang)*tail);
      fx.lineTo(p.x, p.y);
      fx.strokeStyle = `rgba(255,218,107,0.65)`;
      fx.lineWidth = 1.4;
      fx.stroke();

      fx.beginPath();
      fx.arc(p.x, p.y, n.size, 0, Math.PI*2);
      fx.fillStyle = `rgba(255,218,107,0.92)`;
      fx.shadowBlur = 22;
      fx.shadowColor = 'rgba(215,200,255,0.65)';
      fx.fill();
      fx.shadowBlur = 0;
    }
  }

  fx.restore();
}

/* -----------------------------
   15) METEOROS (FUGACES)
   ----------------------------- */
function updateMeteors(dt){
  for (const m of Meteors){
    m.age += dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }
  for (let i=Meteors.length-1;i>=0;i--){
    const m = Meteors[i];
    if (m.age > m.life || m.x<-200 || m.x>WORLD.w+200 || m.y<-200 || m.y>WORLD.h+200){
      Meteors.splice(i,1);
    }
  }
}

function drawMeteors(){
  if (!Meteors.length) return;
  const cam = camOffset();
  fx.save();
  fx.translate(cam.x*0.1, cam.y*0.1);
  fx.globalCompositeOperation = 'lighter';
  fx.lineCap = 'round';

  for (const m of Meteors){
    const k = m.age / m.life;
    const alpha = clamp( (0.6 - k*0.6), 0, 0.6);
    const len = 120 * (1 - k*0.2);
    const ax = m.x - Math.cos(Math.atan2(m.vy, m.vx))*len;
    const ay = m.y - Math.sin(Math.atan2(m.vy, m.vx))*len;

    // cola
    const grad = fx.createLinearGradient(ax,ay, m.x,m.y);
    grad.addColorStop(0.0, 'rgba(215,200,255,0.00)');
    grad.addColorStop(0.35,'rgba(215,200,255,'+(0.35*alpha).toFixed(3)+')');
    grad.addColorStop(0.80,'rgba(255,218,107,'+(0.85*alpha).toFixed(3)+')');
    grad.addColorStop(1.0, 'rgba(255,218,107,0.0)');
    fx.strokeStyle = grad;
    fx.lineWidth = m.w;
    fx.beginPath();
    fx.moveTo(ax, ay);
    fx.lineTo(m.x, m.y);
    fx.stroke();

    // cabeza
    fx.beginPath();
    fx.arc(m.x, m.y, 1.4 + (1.4*alpha), 0, Math.PI*2);
    fx.fillStyle = `rgba(255,218,107,${0.9*alpha})`;
    fx.fill();
  }
  fx.restore();
}

/* -----------------------------
   16) CÁMARA (DRIFT)
   ----------------------------- */
function updateDrift(dt){
  WORLD.drift.t += dt * lerp(1.0, 1.15, clamp((audio.currentTime - WORLD.t0)/(WORLD.t1 - WORLD.t0),0,1));
}

/* -----------------------------
   17) FAN NOTES (2:18)
   ----------------------------- */
function shootFanNotes(){
  if (!Rays.length){
    // si aún no hay rayos, crea uno temporal
    Rays.push(makeRay(0.44, WORLD.h*0.14, 2));
  }
  const base = Rays[Math.floor(Math.random()*Rays.length)];
  for (let i=0;i<3;i++){
    spawnNote(base, rand(0.10,0.14));
  }
}

/* -----------------------------
   18) BUCLE PRINCIPAL
   ----------------------------- */
function loop(){
  const tNow = performance.now();
  const dt = Math.min(0.05, (tNow - WORLD.lastFrameMs)/1000); // cap dt
  WORLD.lastFrameMs = tNow;

  // FPS medio para adaptaciones
  const fpsInst = 1/dt;
  WORLD.fpsAvg = WORLD.fpsAvg*0.9 + fpsInst*0.1;

  // Ajuste de densidad si cae el FPS de forma sostenida
  if (!prefersReduced && Dust.length > PERF.dustMin && WORLD.fpsAvg < PERF.minFps){
    for (let i=0;i<10;i++) Dust.pop();
  }

  const t = audio.currentTime || 0;

  // Limpia canvases
  bg.clearRect(0,0,WORLD.w,WORLD.h);
  fx.clearRect(0,0,WORLD.w,WORLD.h);

  // Estados de tiempo
  evalCues(t, dt);
  heartbeat(t);

  // Updates
  updateDrift(dt);
  updateBokeh(dt);
  updateRays(t, dt);
  updateMeteors(dt);
  updateFocusAndBreathing(t, dt);

  // Draws
  drawBackground(t, dt);
  drawRaysAndNotes(t, dt);
  drawMeteors();

  // Continúa
  if (!audio.paused && !audio.ended){
    requestAnimationFrame(loop);
  } else {
    // si pausas o termina, mantenemos último frame (no recursivo)
  }
}

/* -----------------------------
   19) ARRANQUE
   ----------------------------- */
function boot(){
  resize();
  initDust();
  initBokeh();

  // Si el usuario hace seek antes de iniciar, no rompemos nada.
  audio.addEventListener('seeked', ()=>{
    // re-sincronizar heartbeat para no disparar de golpe tras seek
    WORLD.eventClock.lastAt = audio.currentTime;
  });

  // (Opcional dev) saltos con teclado: comentar en entrega final
  // window.addEventListener('keydown', (e)=>{
  //   if (e.key === 'ArrowRight'){ audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); }
  //   if (e.key === 'ArrowLeft'){  audio.currentTime = Math.max(0, audio.currentTime - 5); }
  // });

  // Autoplay si el navegador lo permite por interacción previa
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible' && document.body.classList.contains('v-active') && audio.paused){
      audio.play().catch(()=>{ /* ignore */ });
    }
  });
}

boot();

/* =========================================================
   NOTAS DE INTEGRACIÓN
   - HTML esperado (mínimo):
     <audio id="audio" src="music/planetarium.mp3" preload="auto"></audio>
     <div class="stage v-vignette">
       <canvas id="bgCanvas"></canvas>
       <div class="foco-dorado"></div>
       <canvas id="fxCanvas"></canvas>
       <div class="grain-overlay"></div>
       <div class="flash" id="v-flash"></div>
       <div class="v-whisper" id="v-whisper" aria-live="polite"></div>
       <div class="ui"><button class="btn-start" id="btnStart">Iniciar</button></div>
     </div>

   - Clases de estado que el JS aplica:
     .v-active (al iniciar)
     .v-ramp-1 (≈ 2:04)
     .v-preclimax (2:20–2:25)
     .v-boost-stars (boost temporal por puntero)

   - Rendimiento:
     * Cap DPR 1.5 (móvil) / 2.0 (desktop)
     * Densidades adaptativas si FPS < ~45–48
     * 'lighter' sólo al dibujar luz (rayos/notas/fugaces)

   - Seek seguro:
     * Las cues se evalúan por ventana temporal ±100ms en cada frame
     * Estados (ramp/preclimax) se recalculan de forma determinista por t

   - Accesibilidad:
     * Respeta prefers-reduced-motion: baja densidades y animaciones
========================================================= */

