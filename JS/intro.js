/**************************************************************
 * INTRO LA LA LAND — JS COMPLETO (Optimizado)
 * - RUSH 40–55s (escala por capas)
 * - WARP 56–58.5s (velocidad luz con estelas GPU-friendly)
 * - BOOM 59s (flash + colapso + blackout, sin redirección)
 * - Clic = ráfaga | Mantener = lluvia
 * - Hint, Skip, Limpieza y Accesibilidad
 **************************************************************/

/* ============================================================
   [A] AJUSTES RÁPIDOS (calibra intensidades aquí)
   ============================================================ */
const SETTINGS = {
  // Tiempos clave (ms)
  T_SHOW_TITLE_MS   : 7000,
  T_INTERACTIONS_MS : 10000,
  T_HALO_ON_MS      : 12000,
  T_DUST_MSG_MS     : 15000,
  T_WHISPERS_MS     : 18000,
  T_CONST_1_MS      : 22000,
  T_CONST_2_MS      : 30000,
  T_SHOOT_1_MS      : 29000,
  T_SHOOT_2_MS      : 44000,
  T_TEXTS_FADE_MS   : 50000,
  T_RUSH_START_MS   : 40000,
  T_WARP_START_MS   : 55500,  // empieza más tarde para evitar carga larga
  T_PREBOOM_MS      : 58800,
  T_BOOM_MS         : 59000,  // blackout

  // Rampa de luz del velo (ms → veil)
  RAMP: [
    { t:    0, veil: 1.00 },
    { t: 2000, veil: 0.70 },
    { t: 5000, veil: 0.55 },
    { t:15000, veil: 0.35 },
    { t:35000, veil: 0.12 },
  ],

  // Densidad de estrellas por capa (optimizado FPS)
  STAR_TOTAL : 160,   // ↓ antes 220
  STAR_FAR   : 0.42,
  STAR_MID   : 0.34,
  STAR_NEAR  : 0.24,

  // RUSH (máximos moderados → menos re-proyección)
  RUSH_MAX_SCALE_NEAR : 2.4,
  RUSH_MAX_SCALE_MID  : 1.7,
  RUSH_MAX_SCALE_FAR  : 1.2,

  // WARP (estelas + empuje radial)
  WARP_DURATION_MS : 2500,  // ↓ antes 4000 (más corto e intenso)
  WARP_LEN_BASE    : 30,    // px
  WARP_LEN_MAX     : 260,   // px (sube a 260/300 si quieres MÁS)
  WARP_PUSH_FACTOR : 0.50,  // 45% del tamaño mayor de la pantalla

  // Chispas (clic / mantener)
  SPARK_CLICK_MIN  : 8,
  SPARK_CLICK_MAX  : 14,
  SPARK_SIZE_MIN   : 4,
  SPARK_SIZE_MAX   : 12,
  SPARK_PRESS_EVERY: 80,    // ms entre chispas al mantener

  // Audio
  AUDIO_VOLUME     : 0.85,
  AUDIO_FADE_STEPS : 6,
  AUDIO_FADE_DELAY : 30,
};

/* Mobile tuning (pantallas chicas) */
(function tuneForMobile(){
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  if(isSmall){
    SETTINGS.STAR_TOTAL = 110;
    SETTINGS.WARP_LEN_MAX = 180;
    SETTINGS.RUSH_MAX_SCALE_NEAR = 2.0;
  }
})();

/* ============================================================
   [B] HELPERS / UTILIDADES
   ============================================================ */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;

function setVar(n, v){ root.style.setProperty(n, String(v)); }
function setVeil(v){ root.style.setProperty("--veil", String(v)); }
function clamp(n,a,b){ return Math.min(b, Math.max(a, n)); }
function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

/* Timers/Intervals tracking */
const timeouts = new Set();
const intervals = new Set();
function setT(fn, ms){ const id = setTimeout(()=>{timeouts.delete(id); fn();}, ms); timeouts.add(id); return id; }
function setI(fn, ms){ const id = setInterval(fn, ms); intervals.add(id); return id; }
function clearAllTimers(){ timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); timeouts.clear(); intervals.clear(); }

/* ============================================================
   [C] REFERENCIAS DOM
   ============================================================ */
const audio  = $("#musica");
const btn    = $("#playBtn");
const titulo = $("#titulo");
const escena = $("#escena");
const dust   = $("#dust");
const consts = $("#constellations");
const halo   = $("#halo");

if(!audio || !btn || !titulo || !escena){
  console.error("Faltan elementos del DOM requeridos (audio/btn/titulo/escena)");
}

/* UI inyectada: hint, skip, flash */
const hint = document.createElement("div");
hint.id = "hint";
hint.textContent = "mueve el mouse ✨ / toca la pantalla";
document.body.appendChild(hint);

const skipBtn = document.createElement("button");
skipBtn.id = "skipBtn";
skipBtn.setAttribute("aria-label","Saltar al siguiente capítulo");
skipBtn.innerHTML = "⭐ <span>Saltar</span>";
document.body.appendChild(skipBtn);

const flash = document.createElement("div");
flash.id = "flash";
document.body.appendChild(flash);

/* ============================================================
   [D] ESTRELLAS / NEBULOSAS / CAPAS
   ============================================================ */
function createStars(total = SETTINGS.STAR_TOTAL){
  const FAR  = Math.floor(total * SETTINGS.STAR_FAR);
  const MID  = Math.floor(total * SETTINGS.STAR_MID);
  const NEAR = total - FAR - MID;

  const mk = layer=>{
    const s = document.createElement("div");
    s.className = `star ${layer}`;

    // Posición inicial (guardamos en dataset para usar en warp SIN reflow)
    const y = Math.random() * window.innerHeight;
    const x = Math.random() * window.innerWidth;
    s.dataset.x = x.toFixed(2);
    s.dataset.y = y.toFixed(2);
    s.style.top  = y + "px";
    s.style.left = x + "px";

    // twinkle sólo opacidad
    s.style.animationDuration = (2 + Math.random()*3) + "s";

    document.body.appendChild(s);
    setTimeout(()=>{ s.style.opacity = 1; }, 900 + Math.random()*1200);
  };

  for(let i=0;i<FAR;i++)  mk("far");
  for(let i=0;i<MID;i++)  mk("mid");
  for(let i=0;i<NEAR;i++) mk("near");
}

let sparkleTimer=null;
function startSparkle(){
  sparkleTimer = setI(()=>{
    const stars = $$(".star"); if(!stars.length) return;
    const n = 4 + Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const s = stars[Math.floor(Math.random()*stars.length)];
      if(!s) continue;
      s.classList.add("sparkle");
      setTimeout(()=> s.classList.remove("sparkle"), 650);
    }
  }, 3800);
}
function stopSparkle(){ if(sparkleTimer){ clearInterval(sparkleTimer); intervals.delete(sparkleTimer); sparkleTimer=null; } }

function ensureNebulas(){
  if(!$$(".nebula").length){
    [["blue","pos-1"],["pink","pos-2"],["gold","pos-3"]].forEach(([tone,pos])=>{
      const n = document.createElement("div");
      n.className = `nebula ${tone} ${pos}`;
      document.body.appendChild(n);
    });
  }
}
function showNebulas(){
  ensureNebulas();
  $$(".nebula").forEach((n,i)=> setT(()=> n.classList.add("visible"), 5000 + i*1200));
}

/* Fugaces */
function shootingStar(afterMs){
  setT(()=>{
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = (Math.random()*window.innerWidth) + "px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

/* Constelaciones */
function drawConstellation({top, left, length, angleDeg, life=3800}){
  const line = document.createElement("div");
  line.className = "const-line";
  line.style.top = top + "px";
  line.style.left = left + "px";
  line.style.width = length + "px";
  line.style.transform = `rotate(${angleDeg}deg) scaleX(0)`;
  consts.appendChild(line);
  requestAnimationFrame(()=> line.classList.add("draw"));
  setTimeout(()=> line.classList.add("fade"), life);
  setTimeout(()=> line.remove(), life + 2200);
}

/* Polvo */
function activateDust(){ if(dust) dust.classList.add("visible"); }

/* ============================================================
   [E] TEXTOS / HALO
   ============================================================ */
function showTitle(){  titulo.classList.add("show"); }
function showSceneMsg(){ escena.textContent = "🌌 Nuestro viaje comienza..."; escena.classList.add("show"); }
function fadeOutTexts(){ titulo.classList.add("fade-out"); escena.classList.add("fade-out"); const w=$("#whisper"); if(w) w.classList.add("hide"); }

function startHalo(){
  if(!halo) return;
  halo.classList.add("on");
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 28000);
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 40000);
}

/* Susurros */
const WHISPERS = ["Cierra los ojos…","Respira conmigo…","Quédate aquí un momento…"];
let whisperTimer=null;
function startWhispers(){
  let w = $("#whisper"); if(!w){ w=document.createElement("span"); w.id="whisper"; escena.appendChild(w); }
  let idx=0;
  const showNext = ()=>{
    if(!w) return;
    w.classList.remove("show"); w.classList.add("hide");
    setTimeout(()=>{ w.textContent = WHISPERS[idx%WHISPERS.length]; idx++; w.classList.remove("hide"); w.classList.add("show"); }, 400);
  };
  showNext(); whisperTimer=setI(showNext, 9000);
}
function stopWhispers(){ if(whisperTimer){ clearInterval(whisperTimer); intervals.delete(whisperTimer); whisperTimer=null; } const w=$("#whisper"); if(w) w.classList.add("hide"); }

/* ============================================================
   [F] INTERACCIÓN: PARALLAX + CHISPAS
   ============================================================ */
/* Parallax nebulosas */
let parallaxActive=false, targetX=0, targetY=0, px=0, py=0;
const easeParallax=0.06;
function onMouseMove(e){
  if(!parallaxActive) return;
  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  targetX=(e.clientX-cx)/cx; targetY=(e.clientY-cy)/cy;
}
function parallaxLoop(){
  if(parallaxActive){
    px += (targetX-px)*easeParallax;
    py += (targetY-py)*easeParallax;
    const layers=$$(".nebula");
    layers.forEach((n,i)=>{
      const strength=(i+1)*6;
      n.style.transform=`translate(${-px*strength}px, ${-py*strength}px)`;
    });
  }
  requestAnimationFrame(parallaxLoop);
}
window.addEventListener("mousemove", onMouseMove);
parallaxLoop();

/* Clic/Presión: ráfaga + lluvia */
function spawnSpark(x,y,big=false){
  const p=document.createElement("div");
  p.className="spark-pop";
  const size = (big ? SETTINGS.SPARK_SIZE_MIN+2 : SETTINGS.SPARK_SIZE_MIN) + Math.random()*(SETTINGS.SPARK_SIZE_MAX - SETTINGS.SPARK_SIZE_MIN);
  p.style.width=size+"px"; p.style.height=size+"px";
  p.style.left=(x + (Math.random()*14-7))+"px";
  p.style.top =(y + (Math.random()*14-7))+"px";
  document.body.appendChild(p);
  setTimeout(()=> p.remove(), 820);
}
function burst(x,y){
  const n = SETTINGS.SPARK_CLICK_MIN + Math.floor(Math.random()*(SETTINGS.SPARK_CLICK_MAX - SETTINGS.SPARK_CLICK_MIN + 1));
  for(let i=0;i<n;i++) setTimeout(()=> spawnSpark(x,y,true), i*18);
}
let pressInterval=null;
function onMouseDown(e){
  burst(e.clientX, e.clientY);
  if(pressInterval) clearInterval(pressInterval);
  pressInterval = setInterval(()=> spawnSpark(e.clientX,e.clientY,false), SETTINGS.SPARK_PRESS_EVERY);
}
function onMouseUp(){ if(pressInterval){ clearInterval(pressInterval); pressInterval=null; } }
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener("click", e=> burst(e.clientX, e.clientY)); // click suelto

/* ============================================================
   [G] RAMP / HINT / SKIP
   ============================================================ */
function rampBrightness(){ SETTINGS.RAMP.forEach(step=> setT(()=> setVeil(step.veil), step.t)); }

function scheduleHint(){
  setT(()=> hint.classList.add("show"), SETTINGS.T_DUST_MSG_MS);
  setT(()=> hint.classList.remove("show"), SETTINGS.T_DUST_MSG_MS + 7000); // ~15–22s
}
function scheduleSkip(){
  setT(()=>{
    root.classList.add("skip-visible");
    skipBtn.addEventListener("click", onSkip);
  }, 35000);
}
function onSkip(){ doBoom(true); }

/* ============================================================
   [H] RUSH (40–55s): escala por capas
   ============================================================ */
let rushRAF=null;
function startRush(){
  root.classList.add("rush");
  const DURATION = Math.max(1, (SETTINGS.T_WARP_START_MS - SETTINGS.T_RUSH_START_MS));
  const t0 = performance.now();

  // inicial
  setVar("--rush-scale-near", 1);
  setVar("--rush-scale-mid",  1);
  setVar("--rush-scale-far",  1);
  setVar("--rush-opacity",    0.95);

  function step(now){
    const t = clamp((now - t0) / DURATION, 0, 1);
    const e = easeInOutCubic(t);

    setVar("--rush-scale-near", (1 + e*(SETTINGS.RUSH_MAX_SCALE_NEAR - 1)).toFixed(3));
    setVar("--rush-scale-mid",  (1 + e*(SETTINGS.RUSH_MAX_SCALE_MID  - 1)).toFixed(3));
    setVar("--rush-scale-far",  (1 + e*(SETTINGS.RUSH_MAX_SCALE_FAR  - 1)).toFixed(3));
    setVar("--rush-opacity",    (0.95 + e*0.05).toFixed(3));
    setVar("--rush-translate",  `${(e*6)|0}px`);

    // micro-boost visual al final del rush
    if (t > 0.85) {
      setVar("--rush-opacity", (0.98 + (t-0.85)*0.2).toFixed(3));
    }

    if(t < 1) rushRAF = requestAnimationFrame(step);
    else rushRAF = null;
  }
  rushRAF = requestAnimationFrame(step);
}

/* ============================================================
   [I] WARP (56–58.5s): estelas + empuje radial (sin reflow)
   ============================================================ */
let warpRAF=null;
function startWarp(){
  const stars = Array.from($$(".star"));
  if(!stars.length) return;

  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;

  // Prepara meta con datos ya guardados (dataset → sin reflow)
  const meta = stars.map(s=>{
    const x = parseFloat(s.dataset.x || 0);
    const y = parseFloat(s.dataset.y || 0);
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    s.classList.add("no-twinkle", "streak");
    s.style.height = SETTINGS.WARP_LEN_BASE + "px";
    // setear rotación 1 vez; luego sólo translate3d + height
    s.style.transform = `translate3d(0,0,0) rotate(${angle}rad)`;
    return { el:s, dx, dy, dist };
  });

  const t0 = performance.now();
  const D = SETTINGS.WARP_DURATION_MS;

  function tick(now){
    const t = Math.min(1, (now - t0) / D);
    const e = easeOutCubic(t);

    const push = Math.max(window.innerWidth, window.innerHeight) * SETTINGS.WARP_PUSH_FACTOR;
    const len  = SETTINGS.WARP_LEN_BASE + e * (SETTINGS.WARP_LEN_MAX - SETTINGS.WARP_LEN_BASE);

    for(const m of meta){
      const nx = m.dx / m.dist;
      const ny = m.dy / m.dist;
      const tx = nx * e * push;
      const ty = ny * e * push;
      // sólo actualizamos translate3d y height (barato para GPU)
      m.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) ${m.el.style.transform.replace(/.*rotate/,'rotate')}`;
      m.el.style.height = `${len}px`;
    }

    if(t < 1) warpRAF = requestAnimationFrame(tick);
    else warpRAF = null;
  }

  if(warpRAF) cancelAnimationFrame(warpRAF);
  warpRAF = requestAnimationFrame(tick);
}

/* Suave preparación visual antes del boom */
function preBoom(){ root.classList.add("preboom"); }

/* ============================================================
   [J] BOOM (59s): flash + viñeta + blackout (sin redirección)
   ============================================================ */
let boomDone=false;
async function doBoom(fromSkip=false){
  if(boomDone) return; boomDone=true;

  // detener efectos en curso
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  stopSparkle(); stopWhispers();

  // Fade de audio
  try{
    const startVol = audio.volume;
    for(let i=0;i<=SETTINGS.AUDIO_FADE_STEPS;i++){
      const f = 1 - (i/SETTINGS.AUDIO_FADE_STEPS);
      audio.volume = clamp(startVol * f, 0, 1);
      // eslint-disable-next-line no-await-in-loop
      await wait(SETTINGS.AUDIO_FADE_DELAY);
    }
    audio.pause();
  }catch{}

  // Flash + colapso + blackout
  setVar("--flash-opacity", 1);
  setTimeout(()=> setVar("--flash-opacity", 0), parseInt(getComputedStyle(root).getPropertyValue("--flash-duration")) || 120);
  root.classList.add("boom");

  // Nos quedamos en negro. Cuando exista lalaland.html:
  // window.location.href = "lalaland.html";
}

/* ============================================================
   [K] TIMELINE PRINCIPAL
   ============================================================ */
function startTimeline(){
  createStars(SETTINGS.STAR_TOTAL);
  startSparkle();

  showNebulas();
  setT(showTitle, SETTINGS.T_SHOW_TITLE_MS);

  setT(()=>{ parallaxActive=true; }, SETTINGS.T_INTERACTIONS_MS);
  setT(startHalo, SETTINGS.T_HALO_ON_MS);

  setT(activateDust, SETTINGS.T_DUST_MSG_MS);
  setT(showSceneMsg, SETTINGS.T_DUST_MSG_MS);
  setT(startWhispers, SETTINGS.T_WHISPERS_MS);

  setT(()=> drawConstellation({
    top: window.innerHeight*0.28, left: window.innerWidth*0.18,
    length: window.innerWidth*0.22, angleDeg: 12
  }), SETTINGS.T_CONST_1_MS);

  setT(()=> drawConstellation({
    top: window.innerHeight*0.62, left: window.innerWidth*0.58,
    length: window.innerWidth*0.18, angleDeg: -18
  }), SETTINGS.T_CONST_2_MS);

  shootingStar(SETTINGS.T_SHOOT_1_MS);
  shootingStar(SETTINGS.T_SHOOT_2_MS);

  scheduleHint();
  scheduleSkip();

  setT(()=>{ fadeOutTexts(); stopWhispers(); }, SETTINGS.T_TEXTS_FADE_MS);

  // Rush + Warp + Boom
  setT(startRush, SETTINGS.T_RUSH_START_MS);
  setT(startWarp, SETTINGS.T_WARP_START_MS);
  setT(preBoom,   SETTINGS.T_PREBOOM_MS);
  setT(()=> doBoom(false), SETTINGS.T_BOOM_MS);
}

/* ============================================================
   [L] PLAY HANDLER + TECLADO + LIMPIEZA
   ============================================================ */
btn.addEventListener("click", async ()=>{
  audio.load();
  audio.volume = SETTINGS.AUDIO_VOLUME;
  try{
    await audio.play();
    btn.style.display = "none";
    // Rampa de luz y timeline
    SETTINGS.RAMP.forEach(step=> setT(()=> setVeil(step.veil), step.t));
    startTimeline();
  }catch(err){
    console.error("Audio bloqueado", err);
    alert("Toca de nuevo para iniciar el audio ✨");
  }
});

/* Teclado: Space/Enter → iniciar; S → saltar (si visible) */
window.addEventListener("keydown", (e)=>{
  if((e.code==="Space" || e.code==="Enter") && btn.style.display!=="none"){
    btn.click();
  }
  if(e.code==="KeyS" && root.classList.contains("skip-visible")){
    onSkip();
  }
});

/* Limpieza al salir/recargar */
window.addEventListener("beforeunload", ()=>{
  clearAllTimers();
  if(rushRAF) cancelAnimationFrame(rushRAF);
  if(warpRAF) cancelAnimationFrame(warpRAF);
  stopWhispers();
  stopSparkle();
});


