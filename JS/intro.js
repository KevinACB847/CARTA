/**************************************************************
 * INTRO LA LA LAND — JS (Canvas Warp + DEV HUD + Beats 54–59s)
 * - RUSH 40–55s (escala por capas)
 * - BEATS 54–59s (14 destellos cerca del título)
 * - WARP 58.8–~60s (Canvas fluido ~1.2s)
 * - BOOM ~62s (flash + blackout) con guardia por tiempo real
 * - Tester de tiempo: ver y saltar a cualquier marca
 * - Clic = ráfaga | Mantener = lluvia
 **************************************************************/

/* ============================================================
   [A] AJUSTES RÁPIDOS
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

  // Texto se va entre 56–58s
  T_TEXTS_FADE_MS   : 56000,

  // Rush → Warp → Boom
  T_RUSH_START_MS   : 40000,
  T_WARP_START_MS   : 60000,  // 58.8s (Canvas warp ~1.2s)
  T_PREBOOM_MS      : 60000,  // 59.5s (tensión previa)
  T_BOOM_MS         : 61000,  // 62.0s (retrasado)

  // Beats sincronizados alrededor del título (54–59s)
  T_STAR_BEATS_START_MS : 54000, // inicio del patrón
  STAR_BEATS_COUNT      : 14,    // 14 “tu”
  STAR_BEATS_WINDOW_MS  : 6100,  // ~435 ms entre beats
  STAR_BEAT_DURATION_MS : 280,   // duración de cada destello

  // Rampa de luz del velo
  RAMP: [
    { t:    0, veil: 1.00 },
    { t: 2000, veil: 0.70 },
    { t: 5000, veil: 0.55 },
    { t:15000, veil: 0.35 },
    { t:35000, veil: 0.12 },
  ],

  // Estrellas DOM
  STAR_TOTAL : 160,
  STAR_FAR   : 0.42,
  STAR_MID   : 0.34,
  STAR_NEAR  : 0.24,

  // RUSH máximo
  RUSH_MAX_SCALE_NEAR : 2.4,
  RUSH_MAX_SCALE_MID  : 1.7,
  RUSH_MAX_SCALE_FAR  : 1.2,

  // Canvas WARP (fluido y natural, corto e intenso)
  WARP_DURATION_MS : 1200,  // ~1.2s
  WARP_PARTICLES   : 650,
  WARP_SPREAD      : 0.9,
  WARP_NOISE       : 0.18,
  WARP_TAIL        : 0.65,
  WARP_FADE        : 0.85,

  // Chispas (clic / mantener)
  SPARK_CLICK_MIN  : 10,
  SPARK_CLICK_MAX  : 16,
  SPARK_SIZE_MIN   : 4,
  SPARK_SIZE_MAX   : 12,
  SPARK_PRESS_EVERY: 75,

  // Audio
  AUDIO_VOLUME     : 0.85,
  AUDIO_FADE_STEPS : 6,
  AUDIO_FADE_DELAY : 28,

  // ====== DEV / TEST ======
  DEV_HUD        : true,   // ← pon false para ocultarlo
  DEV_START_AT_MS: null,   // ej: 56000 para arrancar cerca del final
};

/* Marca de build para confirmar que cargó este JS */
const __INTRO_BUILD__ = "fix-boom-beats-guard-002";
console.log("[IntroJS] Build:", __INTRO_BUILD__);

/* Flags runtime */
let beatsStarted = false;   // evita reprogramar beats varias veces
let boomGuarded  = false;   // evita ejecutar boom más de una vez

/* Mobile tuning */
(function tuneForMobile(){
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  if(isSmall){
    SETTINGS.STAR_TOTAL = 110;
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
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

/* Timers */
const timeouts = new Set(), intervals = new Set();
function setT(fn, ms){ const id=setTimeout(()=>{timeouts.delete(id); fn();}, ms); timeouts.add(id); return id; }
function setI(fn, ms){ const id=setInterval(fn, ms); intervals.add(id); return id; }
function clearAllTimers(){ timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); timeouts.clear(); intervals.clear(); }

/* DEV HUD helpers */
function fmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60); const r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }
function parseTimeToMs(txt){
  if(!txt) return 0;
  if(/^\d+(\.\d+)?$/.test(txt)) return Math.round(parseFloat(txt)*1000); // "57.5"
  const m=txt.split(':').map(Number);
  if(m.length===2) return (m[0]*60+m[1])*1000;
  if(m.length===3) return (m[0]*3600+m[1]*60+m[2])*1000;
  return 0;
}

/* ============================================================
   [C] DOM + UI inyectada
   ============================================================ */
const audio=$("#musica"), btn=$("#playBtn"), titulo=$("#titulo"), escena=$("#escena"), dust=$("#dust"), consts=$("#constellations"), halo=$("#halo");

const hint=document.createElement("div"); hint.id="hint"; hint.textContent="mueve el mouse ✨ / toca la pantalla"; document.body.appendChild(hint);
const skipBtn=document.createElement("button"); skipBtn.id="skipBtn"; skipBtn.setAttribute("aria-label","Saltar al siguiente capítulo"); skipBtn.innerHTML="⭐ <span>Saltar</span>"; document.body.appendChild(skipBtn);
const flash=document.createElement("div"); flash.id="flash"; document.body.appendChild(flash);

/* Canvas para warp */
const warpCanvas=document.createElement("canvas"); warpCanvas.id="warpCanvas"; document.body.appendChild(warpCanvas);
let wctx=null;

/* DEV HUD */
let devHUD=null;
function mountDevHUD(){
  if(!SETTINGS.DEV_HUD) return;
  devHUD=document.createElement("div");
  devHUD.id="devHUD";
  devHUD.innerHTML=`
    <span class="sp">t=</span><span class="time" id="hudTime">00:00</span>
    <input id="hudInput" placeholder="mm:ss o s" />
    <button id="hudGo">Ir</button>
    <button id="hudMinus">-1s</button>
    <button id="hudPlus">+1s</button>
    <button id="hudReset">Inicio</button>
    <button id="hudHide">×</button>
  `;
  document.body.appendChild(devHUD);
  $("#hudHide").onclick=()=>{ devHUD.remove(); };
  $("#hudGo").onclick=()=> jumpTo(parseTimeToMs($("#hudInput").value||"0"));
  $("#hudMinus").onclick=()=> jumpRel(-1000);
  $("#hudPlus").onclick=()=> jumpRel(1000);
  $("#hudReset").onclick=()=> jumpTo(0);
}

/* ============================================================
   [D] ESTRELLAS / NEBULOSAS
   ============================================================ */
function createStars(total){
  const FAR=Math.floor(total*SETTINGS.STAR_FAR), MID=Math.floor(total*SETTINGS.STAR_MID), NEAR=total-FAR-MID;
  const mk=layer=>{
    const s=document.createElement("div");
    s.className=`star ${layer}`;
    const y=Math.random()*window.innerHeight, x=Math.random()*window.innerWidth;
    s.dataset.x=x.toFixed(2); s.dataset.y=y.toFixed(2);
    s.style.top=y+"px"; s.style.left=x+"px";
    s.style.animationDuration=(2+Math.random()*3)+"s";
    document.body.appendChild(s);
    setTimeout(()=>{ s.style.opacity=1; }, 900+Math.random()*1200);
  };
  for(let i=0;i<FAR;i++) mk("far");
  for(let i=0;i<MID;i++) mk("mid");
  for(let i=0;i<NEAR;i++) mk("near");
}

let sparkleTimer=null;
function startSparkle(){
  sparkleTimer=setI(()=>{
    const stars=$$(".star"); if(!stars.length) return;
    const n=4+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const s=stars[Math.floor(Math.random()*stars.length)];
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
      const n=document.createElement("div"); n.className=`nebula ${tone} ${pos}`; document.body.appendChild(n);
    });
  }
}
function showNebulas(){ ensureNebulas(); $$(".nebula").forEach((n,i)=> setT(()=> n.classList.add("visible"), 5000+i*1200)); }

function shootingStar(afterMs){
  setT(()=>{
    const s=document.createElement("div");
    s.className="shooting-star";
    s.style.left=(Math.random()*window.innerWidth)+"px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

function drawConstellation({top,left,length,angleDeg,life=3800}){
  const line=document.createElement("div");
  line.className="const-line";
  line.style.top=top+"px"; line.style.left=left+"px"; line.style.width=length+"px";
  line.style.transform=`rotate(${angleDeg}deg) scaleX(0)`;
  consts.appendChild(line);
  requestAnimationFrame(()=> line.classList.add("draw"));
  setTimeout(()=> line.classList.add("fade"), life);
  setTimeout(()=> line.remove(), life+2200);
}

function activateDust(){ dust?.classList.add("visible"); }

/* ============================================================
   [E] TEXTOS / HALO / SUSURROS
   ============================================================ */
function showTitle(){ titulo.classList.add("show"); }
function showSceneMsg(){ escena.textContent="🌌 Nuestro viaje comienza..."; escena.classList.add("show"); }
function fadeOutTexts(){ titulo.classList.add("fade-out"); escena.classList.add("fade-out"); const w=$("#whisper"); if(w) w.classList.add("hide"); }

function startHalo(){
  if(!halo) return;
  halo.classList.add("on");
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 28000);
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 40000);
}

const WHISPERS=["Cierra los ojos…","Respira conmigo…","Quédate aquí un momento…"];
let whisperTimer=null;
function startWhispers(){
  let w=$("#whisper"); if(!w){ w=document.createElement("span"); w.id="whisper"; escena.appendChild(w); }
  let idx=0;
  const showNext=()=>{
    if(!w) return;
    w.classList.remove("show"); w.classList.add("hide");
    setTimeout(()=>{ w.textContent=WHISPERS[idx%WHISPERS.length]; idx++; w.classList.remove("hide"); w.classList.add("show"); }, 400);
  };
  showNext(); whisperTimer=setI(showNext, 9000);
}
function stopWhispers(){ if(whisperTimer){ clearInterval(whisperTimer); intervals.delete(whisperTimer); whisperTimer=null; } const w=$("#whisper"); if(w) w.classList.add("hide"); }

/* ============================================================
   [F] INTERACCIÓN: PARALLAX + CHISPAS
   ============================================================ */
let parallaxActive=false, targetX=0, targetY=0, px=0, py=0;
const easeParallax=0.06;
function onMouseMove(e){
  if(!parallaxActive) return;
  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  targetX=(e.clientX-cx)/cx; targetY=(e.clientY-cy)/cy;
}
function parallaxLoop(){
  if(parallaxActive){
    px+=(targetX-px)*easeParallax; py+=(targetY-py)*easeParallax;
    const layers=$$(".nebula");
    layers.forEach((n,i)=>{
      const s=(i+1)*6; n.style.transform=`translate(${-px*s}px, ${-py*s}px)`;
    });
  }
  requestAnimationFrame(parallaxLoop);
}
window.addEventListener("mousemove", onMouseMove); parallaxLoop();

function spawnSpark(x,y,big=false){
  const p=document.createElement("div"); p.className="spark-pop";
  const size=(big?SETTINGS.SPARK_SIZE_MIN+2:SETTINGS.SPARK_SIZE_MIN)+Math.random()*(SETTINGS.SPARK_SIZE_MAX-SETTINGS.SPARK_SIZE_MIN);
  p.style.width=size+"px"; p.style.height=size+"px";
  p.style.left=(x+(Math.random()*14-7))+"px"; p.style.top =(y+(Math.random()*14-7))+"px";
  document.body.appendChild(p); setTimeout(()=> p.remove(), 820);
}
function burst(x,y){ const n=SETTINGS.SPARK_CLICK_MIN+Math.floor(Math.random()*(SETTINGS.SPARK_CLICK_MAX-SETTINGS.SPARK_CLICK_MIN+1)); for(let i=0;i<n;i++) setTimeout(()=> spawnSpark(x,y,true), i*18); }
let pressInterval=null;
function onMouseDown(e){ burst(e.clientX,e.clientY); if(pressInterval) clearInterval(pressInterval); pressInterval=setInterval(()=> spawnSpark(e.clientX,e.clientY,false), SETTINGS.SPARK_PRESS_EVERY); }
function onMouseUp(){ if(pressInterval){ clearInterval(pressInterval); pressInterval=null; } }
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener("click", e=> burst(e.clientX,e.clientY));

/* ============================================================
   [G] RAMP / HINT / SKIP
   ============================================================ */
function rampBrightness(){ SETTINGS.RAMP.forEach(step=> setT(()=> setVeil(step.veil), step.t)); }
function scheduleHint(){ setT(()=> hint.classList.add("show"), SETTINGS.T_DUST_MSG_MS); setT(()=> hint.classList.remove("show"), SETTINGS.T_DUST_MSG_MS+7000); }
function scheduleSkip(){ setT(()=>{ root.classList.add("skip-visible"); skipBtn.addEventListener("click", onSkip); }, 35000); }
function onSkip(){ doBoom(true); }

/* ============================================================
   [H] RUSH (40–55s)
   ============================================================ */
let rushRAF=null;
function startRush(){
  root.classList.add("rush");
  const D=Math.max(1,(SETTINGS.T_WARP_START_MS-SETTINGS.T_RUSH_START_MS));
  const t0=performance.now();
  setVar("--rush-scale-near",1); setVar("--rush-scale-mid",1); setVar("--rush-scale-far",1); setVar("--rush-opacity",0.95);
  const step=now=>{
    const t=clamp((now-t0)/D,0,1), e=easeInOutCubic(t);
    setVar("--rush-scale-near",(1+e*(SETTINGS.RUSH_MAX_SCALE_NEAR-1)).toFixed(3));
    setVar("--rush-scale-mid", (1+e*(SETTINGS.RUSH_MAX_SCALE_MID -1)).toFixed(3));
    setVar("--rush-scale-far", (1+e*(SETTINGS.RUSH_MAX_SCALE_FAR -1)).toFixed(3));
    setVar("--rush-opacity",   (0.95+e*0.05).toFixed(3));
    if(t<1) rushRAF=requestAnimationFrame(step); else rushRAF=null;
  };
  rushRAF=requestAnimationFrame(step);
}

/* ============================================================
   [I] BEATS 54–59s (14 destellos uno por uno)
   ============================================================ */
function getStarsAroundTitle(padding = 140){
  const stars = $$(".star");
  const titleEl = $("#titulo") || $("#center");
  if(!titleEl || !stars.length) return [];

  const r = titleEl.getBoundingClientRect();
  const area = {
    left  : r.left  - padding,
    right : r.right + padding,
    top   : r.top   - padding,
    bottom: r.bottom+ padding
  };

  const list = [];
  stars.forEach(s=>{
    const x = parseFloat(s.dataset.x || s.style.left);
    const y = parseFloat(s.dataset.y || s.style.top);
    if(isNaN(x) || isNaN(y)) return;
    if(x>=area.left && x<=area.right && y>=area.top && y<=area.bottom){
      list.push(s);
    }
  });

  // ordena por proximidad al centro del título
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;
  list.sort((a,b)=>{
    const ax=parseFloat(a.dataset.x), ay=parseFloat(a.dataset.y);
    const bx=parseFloat(b.dataset.x), by=parseFloat(b.dataset.y);
    const da=(ax-cx)*(ax-cx)+(ay-cy)*(ay-cy);
    const db=(bx-cx)*(bx-cx)+(by-cy)*(by-cy);
    return da - db;
  });

  return list;
}
function beatPulse(star, duration){
  if(!star) return;
  // Refuerzo inline por si el CSS anterior sigue cacheado
  const prevBox = star.style.boxShadow;
  const prevTrf = star.style.transform;
  const prevOp  = star.style.opacity;

  star.classList.add("beat");
  star.style.boxShadow =
    "0 0 16px #fff, 0 0 36px rgba(147,197,253,.95), 0 0 70px rgba(147,197,253,.66)";
  star.style.transform = "scale(2.8)";
  star.style.opacity   = "1";

  setTimeout(()=>{
    star.classList.remove("beat");
    star.style.boxShadow = prevBox;
    star.style.transform = prevTrf;
    star.style.opacity   = prevOp;
  }, duration);
}
function scheduleStarBeats(offsetMs){
  const list = getStarsAroundTitle(140);
  if(!list.length) return;
  beatsStarted = true; // marca que ya programamos beats

  const N = SETTINGS.STAR_BEATS_COUNT;
  const windowMs = SETTINGS.STAR_BEATS_WINDOW_MS;
  const step = windowMs / N; // ≈ 435 ms
  const used = new Set();

  for(let i=0; i<N; i++){
    const tAbs = SETTINGS.T_STAR_BEATS_START_MS + Math.round(i*step);
    scheduleAt(tAbs, offsetMs, ()=>{
      let idx = i % list.length;
      let hops = 0;
      while(used.has(idx) && hops < list.length){ idx = (idx+1) % list.length; hops++; }
      used.add(idx);
      beatPulse(list[idx], SETTINGS.STAR_BEAT_DURATION_MS);
    });
  }
}

/* ============================================================
   [J] WARP CANVAS (58.8–~60s, ~1.2s)
   ============================================================ */
let warpRAF=null, warpStartTime=0, particles=[];
function prepareCanvas(){
  const dpr=window.devicePixelRatio||1;
  warpCanvas.width = Math.floor(window.innerWidth*dpr);
  warpCanvas.height= Math.floor(window.innerHeight*dpr);
  warpCanvas.style.width=window.innerWidth+"px";
  warpCanvas.style.height=window.innerHeight+"px";
  wctx=warpCanvas.getContext("2d");
  wctx.setTransform(dpr,0,0,dpr,0,0);
  wctx.globalCompositeOperation="lighter";
}
function startWarpCanvas(){
  prepareCanvas();
  warpCanvas.style.display="block";
  // suaviza: apaga un poco las estrellas DOM
  $$(".star").forEach(s=> s.style.opacity=0.15);

  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  const N=SETTINGS.WARP_PARTICLES;
  particles=new Array(N).fill(0).map(()=> {
    const a=Math.random()*Math.PI*2;
    const r=(Math.random()**0.9)*Math.min(cx,cy)*SETTINGS.WARP_SPREAD;
    const x=cx + Math.cos(a)*r;
    const y=cy + Math.sin(a)*r;
    const speed= (0.9+Math.random()*0.6) * Math.max(window.innerWidth, window.innerHeight)/SETTINGS.WARP_DURATION_MS; // px/ms
    const noise=(Math.random()*2-1)*SETTINGS.WARP_NOISE; // curvita leve
    return {x,y,a,speed,noise};
  });

  warpStartTime=performance.now();
  const tail=SETTINGS.WARP_TAIL, fade=SETTINGS.WARP_FADE;

  const tick=(now)=>{
    const t=clamp((now-warpStartTime)/SETTINGS.WARP_DURATION_MS,0,1);
    const e=easeOutCubic(t);
    wctx.clearRect(0,0,warpCanvas.width, warpCanvas.height);

    for(const p of particles){
      const ang = p.a + (e-0.5)*p.noise;
      const vx = Math.cos(ang), vy = Math.sin(ang);
      const dist = e * p.speed * SETTINGS.WARP_DURATION_MS * 0.8;
      const x2 = p.x + vx*dist;
      const y2 = p.y + vy*dist;

      const x1 = x2 - vx*dist*tail;
      const y1 = y2 - vy*dist*tail;

      const grad=wctx.createLinearGradient(x1,y1,x2,y2);
      grad.addColorStop(0, `rgba(180,200,255,0.00)`);
      grad.addColorStop(0.4,`rgba(190,210,255,${0.22*fade})`);
      grad.addColorStop(1, `rgba(255,255,255,${0.60*fade})`);

      wctx.strokeStyle=grad;
      wctx.lineWidth=1.6;
      wctx.beginPath(); wctx.moveTo(x1,y1); wctx.lineTo(x2,y2); wctx.stroke();
    }

    if(t<1) warpRAF=requestAnimationFrame(tick);
    else{ warpRAF=null; }
  };
  warpRAF=requestAnimationFrame(tick);
}
function stopWarpCanvas(){
  warpCanvas.style.display="none";
  wctx && wctx.clearRect(0,0,warpCanvas.width, warpCanvas.height);
  $$(".star").forEach(s=> s.style.opacity=""); // restaurar
}

/* ============================================================
   [K] BOOM
   ============================================================ */
let boomDone=false;
async function doBoom(fromSkip=false){
  if(boomDone) return; boomDone=true;

  // limpiar efectos
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  stopSparkle(); stopWhispers();

  if(warpRAF) cancelAnimationFrame(warpRAF);
  stopWarpCanvas();

  // Fade audio
  try{
    const startVol=audio.volume;
    for(let i=0;i<=SETTINGS.AUDIO_FADE_STEPS;i++){
      const f=1-(i/SETTINGS.AUDIO_FADE_STEPS);
      audio.volume=clamp(startVol*f,0,1);
      await wait(SETTINGS.AUDIO_FADE_DELAY);
    }
    audio.pause();
  }catch{}

  // Flash + colapso
  setVar("--flash-opacity", 1);
  setTimeout(()=> setVar("--flash-opacity", 0), parseInt(getComputedStyle(root).getPropertyValue("--flash-duration")) || 140);
  root.classList.add("boom");

  // Queda en negro. (Cuando exista la segunda escena)
  // window.location.href = "lalaland.html";
}

/* ============================================================
   [K2] GUARDIA POR TIEMPO REAL (beats + boom exactos)
   ============================================================ */
function onAudioTick(){
  const ms = (audio.currentTime * 1000) | 0;

  // Si no programamos beats (o saltaste con HUD), lánzalos al pasar 54s
  if(!beatsStarted && ms >= SETTINGS.T_STAR_BEATS_START_MS - 50){
    beatsStarted = true;
    const offset = ms; // alinea a la posición actual
    scheduleStarBeats(offset);
  }

  // BOOM exacto a partir del reloj real del audio
  if(!boomGuarded && ms >= SETTINGS.T_BOOM_MS - 15){
    boomGuarded = true;
    doBoom(false);
  }
}

/* ============================================================
   [L] SCHEDULER con OFFSET (para DEV HUD)
   ============================================================ */
function scheduleAt(absMs, offsetMs, fn){ const delay=absMs-offsetMs; if(delay<=0){ try{fn();}catch{} return; } setT(fn, delay); }

function rampWithOffset(offsetMs){ SETTINGS.RAMP.forEach(step=> scheduleAt(step.t, offsetMs, ()=> setVeil(step.veil))); }

function resetVisuals(){
  clearAllTimers();
  if(rushRAF) cancelAnimationFrame(rushRAF);
  if(warpRAF) cancelAnimationFrame(warpRAF);
  stopWarpCanvas();

  $$(".star, .shooting-star, .const-line, .spark-pop").forEach(n=> n.remove());
  $("#dust")?.classList.remove("visible");
  $("#halo")?.classList.remove("on","boost");
  document.documentElement.classList.remove("rush","boom","skip-visible");
  setVar("--flash-opacity", 0);
  if(titulo){ titulo.classList.remove("show","fade-out"); }
  if(escena){
    escena.classList.remove("show","fade-out");
    const w=$("#whisper"); if(w) w.remove();
    escena.textContent="";
  }
  setVeil(1);
  stopWhispers(); stopSparkle();
  beatsStarted=false; boomGuarded=false;
}

function startTimelineWithOffset(offsetMs){
  // Base
  createStars(SETTINGS.STAR_TOTAL);
  startSparkle();
  showNebulas();

  scheduleAt(SETTINGS.T_SHOW_TITLE_MS, offsetMs, showTitle);
  scheduleAt(SETTINGS.T_INTERACTIONS_MS, offsetMs, ()=>{ parallaxActive=true; });
  scheduleAt(SETTINGS.T_HALO_ON_MS, offsetMs, startHalo);
  scheduleAt(SETTINGS.T_DUST_MSG_MS, offsetMs, activateDust);
  scheduleAt(SETTINGS.T_DUST_MSG_MS, offsetMs, showSceneMsg);
  scheduleAt(SETTINGS.T_WHISPERS_MS, offsetMs, startWhispers);

  scheduleAt(SETTINGS.T_CONST_1_MS, offsetMs, ()=> drawConstellation({
    top: window.innerHeight*0.28, left: window.innerWidth*0.18,
    length: window.innerWidth*0.22, angleDeg:12
  }));
  scheduleAt(SETTINGS.T_CONST_2_MS, offsetMs, ()=> drawConstellation({
    top: window.innerHeight*0.62, left: window.innerWidth*0.58,
    length: window.innerWidth*0.18, angleDeg:-18
  }));

  scheduleAt(SETTINGS.T_SHOOT_1_MS, offsetMs, ()=> shootingStar(0));
  scheduleAt(SETTINGS.T_SHOOT_2_MS, offsetMs, ()=> shootingStar(0));

  // Beats 54–59s (luces cerca del título)
  scheduleStarBeats(offsetMs);

  // Despedida de textos
  scheduleAt(SETTINGS.T_TEXTS_FADE_MS, offsetMs, ()=>{ fadeOutTexts(); stopWhispers(); });

  // Rush + Warp + Boom
  scheduleAt(SETTINGS.T_RUSH_START_MS, offsetMs, startRush);
  scheduleAt(SETTINGS.T_WARP_START_MS, offsetMs, startWarpCanvas);
  scheduleAt(SETTINGS.T_PREBOOM_MS, offsetMs, ()=> root.classList.add("preboom"));
  scheduleAt(SETTINGS.T_BOOM_MS, offsetMs, ()=> doBoom(false));

  // Rampa con offset
  rampWithOffset(offsetMs);

  // UI
  scheduleHint();
  scheduleSkip();
}

/* Saltar a tiempo (DEV) */
function jumpTo(ms){
  resetVisuals();
  try{ audio.currentTime = Math.max(0, ms/1000); }catch{}
  startTimelineWithOffset(ms);
}
function jumpRel(delta){ const ms=Math.max(0, (audio.currentTime*1000|0) + delta); jumpTo(ms); }

/* ============================================================
   [M] TIMELINE NORMAL + PLAY + HUD
   ============================================================ */
function startTimeline(){ startTimelineWithOffset(0); }

btn.addEventListener("click", async ()=>{
  audio.load(); audio.volume=SETTINGS.AUDIO_VOLUME;
  try{
    await audio.play(); btn.style.display="none";
    // Guardia por tiempo real (beats y boom exactos)
    audio.removeEventListener("timeupdate", onAudioTick);
    audio.addEventListener("timeupdate", onAudioTick);

    rampBrightness();
    mountDevHUD();
    if(SETTINGS.DEV_START_AT_MS!=null){ jumpTo(SETTINGS.DEV_START_AT_MS); }
    else{ startTimeline(); }
    if(SETTINGS.DEV_HUD){
      setI(()=>{ const t=$("#hudTime"); if(t) t.textContent=fmt(audio.currentTime*1000); }, 200);
    }
  }catch(err){
    console.error("Audio bloqueado", err);
    alert("Toca de nuevo para iniciar el audio ✨");
  }
});

window.addEventListener("keydown",(e)=>{
  if((e.code==="Space"||e.code==="Enter") && btn.style.display!=="none"){ btn.click(); }
  if(e.code==="KeyS" && root.classList.contains("skip-visible")) onSkip();
});

/* Limpieza */
window.addEventListener("beforeunload", ()=>{
  clearAllTimers();
  if(rushRAF) cancelAnimationFrame(rushRAF);
  if(warpRAF) cancelAnimationFrame(warpRAF);
  stopWhispers();
  stopSparkle();
});

