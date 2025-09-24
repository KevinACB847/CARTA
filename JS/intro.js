/*************************
 * Intro La La Land (PC)
 * Timeline + interacciones + Rush + Boom
 *************************/

// ========================
// Helpers
// ========================
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement; // <html>
function setVeil(value){ root.style.setProperty("--veil", String(value)); }
function setVar(name, val){ root.style.setProperty(name, String(val)); }
function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }
function easeInQuad(t){ return t*t; }
function easeInCubic(t){ return t*t*t; }
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

// ========================
// DOM refs (existentes)
// ========================
const audio  = $("#musica");
const btn    = $("#playBtn");
const titulo = $("#titulo");
const escena = $("#escena");
const dust   = $("#dust");
const consts = $("#constellations");
const halo   = $("#halo");

// Sanity check
if(!audio || !btn || !titulo || !escena){
  console.error("Faltan elementos del DOM. Revisa IDs en index.html");
}

// ========================
// Elementos UI creados por JS
// ========================
const hint = document.createElement("div");
hint.id = "hint";
hint.textContent = "mueve el mouse ✨ / toca la pantalla";
document.body.appendChild(hint);

const skipBtn = document.createElement("button");
skipBtn.id = "skipBtn";
skipBtn.setAttribute("aria-label","Saltar al siguiente capítulo");
skipBtn.innerHTML = "⭐ <span>SaltAR</span>";
document.body.appendChild(skipBtn);

const flash = document.createElement("div");
flash.id = "flash";
document.body.appendChild(flash);

// ========================
// Configuración temporal
// ========================
const T_RAMP = [ // rampa de luz como antes
  { t:   0, veil: 1.00 },
  { t:2000, veil: 0.70 },
  { t:5000, veil: 0.55 },
  { t:15000, veil: 0.35 },
  { t:35000, veil: 0.12 }
];

// Coreografía original (reutilizada)
const T_SHOW_TITLE_MS     = 7000;
const T_INTERACTIONS_MS   = 10000; // parallax
const T_HALO_ON_MS        = 12000;
const T_DUST_MSG_MS       = 15000;
const T_WHISPERS_MS       = 18000;
const T_CONST_1_MS        = 22000;
const T_CONST_2_MS        = 30000;
const T_SHOOT_1_MS        = 29000;
const T_SHOOT_2_MS        = 44000;
const T_TEXTS_FADE_MS     = 50000;

// Nuevos tiempos (rush/boom/skip/hint)
const T_HINT_IN_MS        = 15000;
const T_HINT_OUT_MS       = 22000;
const T_SKIP_VISIBLE_MS   = 35000;
const T_RUSH_START_MS     = 40000;
const T_PREBOOM_MS        = 58800;
const T_BOOM_MS           = 59000;

// ========================
// Timers & cleanup
// ========================
const timeouts = new Set();
const intervals = new Set();
function setT(fn, ms){
  const id = setTimeout(()=>{ timeouts.delete(id); fn(); }, ms);
  timeouts.add(id); return id;
}
function setI(fn, ms){
  const id = setInterval(fn, ms);
  intervals.add(id); return id;
}
function clearAllTimers(){
  timeouts.forEach(id => clearTimeout(id));
  intervals.forEach(id => clearInterval(id));
  timeouts.clear(); intervals.clear();
}

// ========================
// Estrellas (capas + sparkle)
// ========================
function createStars(count = 220){
  // Distribución por profundidad
  const FAR_PCT  = 0.40;  // 40%
  const MID_PCT  = 0.35;  // 35%
  const NEAR_PCT = 0.25;  // 25%

  const farCount  = Math.floor(count * FAR_PCT);
  const midCount  = Math.floor(count * MID_PCT);
  const nearCount = count - farCount - midCount;

  function createOne(layer){
    const s = document.createElement("div");
    s.className = `star ${layer}`;
    s.style.top  = (Math.random() * window.innerHeight) + "px";
    s.style.left = (Math.random() * window.innerWidth)  + "px";
    s.style.animationDuration = (2 + Math.random()*3) + "s";
    document.body.appendChild(s);
    // entrada sin pops
    setTimeout(()=>{ s.style.opacity = 1; }, 1200 + Math.random()*1800);
  }

  for(let i=0;i<farCount;i++)  createOne("far");
  for(let i=0;i<midCount;i++)  createOne("mid");
  for(let i=0;i<nearCount;i++) createOne("near");
}

let sparkleTimer = null;
function startSparkle(){
  sparkleTimer = setI(()=>{
    const stars = $$(".star");
    if(!stars.length) return;
    const n = 4 + Math.floor(Math.random()*3); // 4-6 estrellas
    for(let i=0;i<n;i++){
      const s = stars[Math.floor(Math.random()*stars.length)];
      if(!s) continue;
      s.classList.add("sparkle");
      setTimeout(()=> s.classList.remove("sparkle"), 650);
    }
  }, 3800);
}
function stopSparkle(){ if(sparkleTimer){ clearInterval(sparkleTimer); intervals.delete(sparkleTimer); sparkleTimer=null; } }

// ========================
// Nebulosas
// ========================
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
  $$(".nebula").forEach((n,i)=>{
    setT(()=> n.classList.add("visible"), 5000 + i*1200); // 5.0s, 6.2s, 7.4s
  });
}

// ========================
// Fugaces
// ========================
function shootingStar(afterMs){
  setT(()=>{
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = (Math.random()*window.innerWidth) + "px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

// ========================
// Constelaciones
// ========================
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

// ========================
// Polvo estelar
// ========================
function activateDust(){ if(dust) dust.classList.add("visible"); }

// ========================
// Textos
// ========================
function showTitle(){  titulo.classList.add("show"); }
function showSceneMsg(){
  escena.textContent = "🌌 Nuestro viaje comienza...";
  escena.classList.add("show");
}
function fadeOutTexts(){
  titulo.classList.add("fade-out");
  escena.classList.add("fade-out");
  const w = $("#whisper");
  if(w){ w.classList.add("hide"); }
}

// ========================
// Rampa de luz
// ========================
async function rampBrightness(){
  for(let i=0;i<T_RAMP.length;i++){
    const step = T_RAMP[i];
    setT(()=> setVeil(step.veil), step.t);
  }
}

// ========================
// Interacciones: Parallax
// ========================
let parallaxActive = false;
let targetX = 0, targetY = 0;
let px = 0, py = 0;
const easeParallax = 0.06;

function onMouseMove(e){
  if(!parallaxActive) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  targetX = (e.clientX - cx) / cx;
  targetY = (e.clientY - cy) / cy;
}
function parallaxLoop(){
  if(parallaxActive){
    px += (targetX - px) * easeParallax;
    py += (targetY - py) * easeParallax;

    const layers = $$(".nebula");
    layers.forEach((n, i)=>{
      const strength = (i+1) * 6; // 6, 12, 18 px aprox
      const tx = -px * strength;
      const ty = -py * strength;
      n.style.transform = `translate(${tx}px, ${ty}px)`;
    });
  }
  requestAnimationFrame(parallaxLoop);
}
window.addEventListener("mousemove", onMouseMove);
parallaxLoop();

// ========================
// Click spark
// ========================
let lastSparkTs = 0;
function onClickSpark(e){
  const now = performance.now();
  if(now - lastSparkTs < 300) return; // throttle
  lastSparkTs = now;

  const p = document.createElement("div");
  p.className = "spark-pop";
  p.style.left = e.clientX + "px";
  p.style.top  = e.clientY + "px";
  document.body.appendChild(p);
  setTimeout(()=> p.remove(), 820);
}
function enableClickSpark(){ window.addEventListener("click", onClickSpark); }
function disableClickSpark(){ window.removeEventListener("click", onClickSpark); }

// ========================
// Susurros
// ========================
const WHISPERS = [
  "Cierra los ojos…",
  "Respira conmigo…",
  "Quédate aquí un momento…"
];
let whisperTimer = null;
function startWhispers(){
  let w = $("#whisper");
  if(!w){
    w = document.createElement("span");
    w.id = "whisper";
    escena.appendChild(w);
  }
  let idx = 0;
  function showNext(){
    if(!w) return;
    w.classList.remove("show");
    w.classList.add("hide");
    setTimeout(()=>{
      w.textContent = WHISPERS[idx % WHISPERS.length];
      idx++;
      w.classList.remove("hide");
      w.classList.add("show");
    }, 400);
  }
  showNext();
  whisperTimer = setI(showNext, 9000);
}
function stopWhispers(){
  if(whisperTimer){ clearInterval(whisperTimer); intervals.delete(whisperTimer); whisperTimer = null; }
  const w = $("#whisper");
  if(w){ w.classList.add("hide"); }
}

// ========================
// Halo respirando con boosts
// ========================
function startHalo(){
  if(!halo) return;
  halo.classList.add("on");
  // Boosts sutiles
  setT(()=>{
    halo.classList.add("boost");
    setTimeout(()=> halo.classList.remove("boost"), 1200);
  }, 28000);
  setT(()=>{
    halo.classList.add("boost");
    setTimeout(()=> halo.classList.remove("boost"), 1200);
  }, 40000);
}

// ========================
// HINT (15–22s)
// ========================
function scheduleHint(){
  setT(()=> hint.classList.add("show"), T_HINT_IN_MS);
  setT(()=> hint.classList.remove("show"), T_HINT_OUT_MS);
}

// ========================
// SKIP (desde 35s)
// ========================
function scheduleSkip(){
  setT(()=>{
    root.classList.add("skip-visible");
    skipBtn.addEventListener("click", onSkip);
  }, T_SKIP_VISIBLE_MS);
}
function onSkip(){
  // Simula el mismo final que a los 59s
  doBoom(true);
}

// ========================
// RUSH 40–59s (estrellas acercándose)
// ========================
let rushRAF = null;
function startRush(){
  root.classList.add("rush");
  const DURATION = Math.max(1, T_BOOM_MS - T_RUSH_START_MS); // 19,000 ms aprox
  const t0 = performance.now();

  // Iniciales
  setVar("--rush-scale-near", 1);
  setVar("--rush-scale-mid",  1);
  setVar("--rush-scale-far",  1);
  setVar("--rush-opacity",    0.95);

  function step(now){
    const elapsed = now - t0;
    const t = clamp(elapsed / DURATION, 0, 1);         // 0→1
    const e = easeInOutCubic(t);                       // easing suave

    // Escalados objetivo (puedes ajustar los máximos)
    const near = 1 + e * 1.8;   // 1 → 2.8
    const mid  = 1 + e * 1.0;   // 1 → 2.0
    const far  = 1 + e * 0.3;   // 1 → 1.3

    setVar("--rush-scale-near", near.toFixed(3));
    setVar("--rush-scale-mid",  mid.toFixed(3));
    setVar("--rush-scale-far",  far.toFixed(3));

    // Sutil incremento de densidad/claridad (opcional)
    const op = 0.95 + e * 0.05; // 0.95 → 1.0
    setVar("--rush-opacity", op.toFixed(3));

    // Micro-traslación radial (cosmética)
    const warp = (e * 6) | 0; // 0→~6px
    setVar("--rush-translate", `${warp}px`);

    if(t < 1){
      rushRAF = requestAnimationFrame(step);
    }else{
      rushRAF = null;
    }
  }
  rushRAF = requestAnimationFrame(step);
}

function preBoom(){
  // leve preparación visual (blur a near)
  root.classList.add("preboom");
}

// ========================
// BOOM 59s (flash + collapse + fade + hook)
// ========================
let boomDone = false;
async function doBoom(fromSkip=false){
  if(boomDone) return;
  boomDone = true;

  // Parar interacciones menores
  disableClickSpark();
  stopSparkle();
  stopWhispers();

  // Pequeño fade de volumen (200ms)
  try{
    const startVol = audio.volume;
    const steps = 6;
    for(let i=0;i<=steps;i++){
      const f = 1 - (i/steps);
      audio.volume = clamp(startVol * f, 0, 1);
      // eslint-disable-next-line no-await-in-loop
      await wait(30);
    }
    audio.pause();
  }catch{}

  // Flash
  setVar("--flash-opacity", 1);
  setTimeout(()=> setVar("--flash-opacity", 0), 120); // coincide con --flash-duration

  // Colapso viñeta + apagado general
  root.classList.add("boom");

  // Navegar a la siguiente escena (pequeña espera para ver el efecto)
  setTimeout(()=>{
    // Hook a lalaland.html
    window.location.href = "lalaland.html";
  }, fromSkip ? 220 : 260); // casi igual en ambos casos
}

// ========================
// Timeline principal
// ========================
async function startTimeline(){
  // Estrellas base + sparkle
  createStars(220);
  startSparkle();

  // Nebulosas + Título
  showNebulas();
  setT(showTitle, T_SHOW_TITLE_MS);

  // Activar interacciones en los tiempos acordados
  setT(()=> { parallaxActive = true; }, T_INTERACTIONS_MS);
  setT(startHalo, T_HALO_ON_MS);

  // Polvo + mensaje + susurros
  setT(activateDust, T_DUST_MSG_MS);
  setT(showSceneMsg, T_DUST_MSG_MS);
  setT(startWhispers, T_WHISPERS_MS);

  // Constelaciones
  setT(()=>{
    drawConstellation({
      top: window.innerHeight*0.28,
      left: window.innerWidth*0.18,
      length: window.innerWidth*0.22,
      angleDeg: 12
    });
  }, T_CONST_1_MS);

  setT(()=>{
    drawConstellation({
      top: window.innerHeight*0.62,
      left: window.innerWidth*0.58,
      length: window.innerWidth*0.18,
      angleDeg: -18
    });
  }, T_CONST_2_MS);

  // Fugaces
  shootingStar(T_SHOOT_1_MS);
  shootingStar(T_SHOOT_2_MS);

  // Hints & Skip
  scheduleHint();
  scheduleSkip();

  // Destello por click desde 15s
  setT(enableClickSpark, T_DUST_MSG_MS);

  // Despedida de textos (50–53s)
  setT(()=>{
    fadeOutTexts();
    stopWhispers();
  }, T_TEXTS_FADE_MS);

  // Rush 40–59s
  setT(startRush, T_RUSH_START_MS);
  setT(preBoom,   T_PREBOOM_MS);
  setT(()=> doBoom(false), T_BOOM_MS);
}

// ========================
// Play handler
// ========================
btn.addEventListener("click", async ()=>{
  audio.load();
  audio.volume = 0.85;

  try{
    await audio.play();
    btn.style.display = "none";
    rampBrightness();   // rampa de luz en paralelo
    startTimeline();    // coreografía visual
  }catch(err){
    console.error("Audio bloqueado ❌", err);
    alert("Toca de nuevo para iniciar el audio ✨");
  }
});

// Teclas de accesibilidad: Space/Enter para iniciar, Esc para Skip (opcional)
window.addEventListener("keydown", (e)=>{
  if(e.code === "Space" || e.code === "Enter"){
    if(btn.style.display !== "none") btn.click();
  }
  // Acceso rápido al skip con "KeyS" si ya es visible
  if(e.code === "KeyS" && root.classList.contains("skip-visible")){
    onSkip();
  }
});

// ========================
// Limpieza
// ========================
window.addEventListener("beforeunload", ()=>{
  clearAllTimers();
  if(rushRAF) cancelAnimationFrame(rushRAF);
  disableClickSpark();
  stopWhispers();
  stopSparkle();
});


