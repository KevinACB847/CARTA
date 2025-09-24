/*************************
 * Intro La La Land (PC)
 * Timeline + interacciones + Rush + Boom (sin redirección)
 *************************/

// =============== Helpers ===============
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
function setVeil(v){ root.style.setProperty("--veil", String(v)); }
function setVar(n, v){ root.style.setProperty(n, String(v)); }
function clamp(n,a,b){ return Math.min(b, Math.max(a,n)); }
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

// =============== DOM refs ===============
const audio  = $("#musica");
const btn    = $("#playBtn");
const titulo = $("#titulo");
const escena = $("#escena");
const dust   = $("#dust");
const consts = $("#constellations");
const halo   = $("#halo");

if(!audio || !btn || !titulo || !escena){ console.error("Faltan elementos del DOM"); }

// =============== UI creados por JS ===============
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

// =============== Tiempos ===============
const T_SHOW_TITLE_MS     = 7000;
const T_INTERACTIONS_MS   = 10000;
const T_HALO_ON_MS        = 12000;
const T_DUST_MSG_MS       = 15000;
const T_WHISPERS_MS       = 18000;
const T_CONST_1_MS        = 22000;
const T_CONST_2_MS        = 30000;
const T_SHOOT_1_MS        = 29000;
const T_SHOOT_2_MS        = 44000;
const T_TEXTS_FADE_MS     = 50000;

const T_HINT_IN_MS        = 15000;
const T_HINT_OUT_MS       = 22000;
const T_SKIP_VISIBLE_MS   = 35000;
const T_RUSH_START_MS     = 40000;
const T_PREBOOM_MS        = 58800;
const T_BOOM_MS           = 59000;

const T_RAMP = [
  { t:   0, veil: 1.00 },
  { t:2000, veil: 0.70 },
  { t:5000, veil: 0.55 },
  { t:15000, veil: 0.35 },
  { t:35000, veil: 0.12 }
];

// =============== Timers cleanup ===============
const timeouts = new Set(), intervals = new Set();
function setT(fn, ms){ const id=setTimeout(()=>{timeouts.delete(id); fn();}, ms); timeouts.add(id); return id; }
function setI(fn, ms){ const id=setInterval(fn, ms); intervals.add(id); return id; }
function clearAllTimers(){ timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); timeouts.clear(); intervals.clear(); }

// =============== Estrellas ===============
function createStars(count = 220){
  const FAR_PCT=0.40, MID_PCT=0.35, NEAR_PCT=0.25;
  const farCount=Math.floor(count*FAR_PCT), midCount=Math.floor(count*MID_PCT), nearCount=count-farCount-midCount;
  const mk = layer=>{
    const s=document.createElement("div");
    s.className = `star ${layer}`;
    s.style.top  = (Math.random()*window.innerHeight) + "px";
    s.style.left = (Math.random()*window.innerWidth)  + "px";
    s.style.animationDuration = (2 + Math.random()*3) + "s";
    document.body.appendChild(s);
    setTimeout(()=>{ s.style.opacity = 1; }, 1200 + Math.random()*1800);
  };
  for(let i=0;i<farCount;i++) mk("far");
  for(let i=0;i<midCount;i++) mk("mid");
  for(let i=0;i<nearCount;i++) mk("near");
}

let sparkleTimer=null;
function startSparkle(){
  sparkleTimer=setI(()=>{
    const stars=$$(".star"); if(!stars.length) return;
    const n=4+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const s = stars[Math.floor(Math.random()*stars.length)];
      if(!s) continue;
      s.classList.add("sparkle");
      setTimeout(()=> s.classList.remove("sparkle"), 650);
    }
  }, 3800);
}
function stopSparkle(){ if(sparkleTimer){ clearInterval(sparkleTimer); intervals.delete(sparkleTimer); sparkleTimer=null; } }

// =============== Nebulosas ===============
function ensureNebulas(){
  if(!$$(".nebula").length){
    [["blue","pos-1"],["pink","pos-2"],["gold","pos-3"]].forEach(([tone,pos])=>{
      const n=document.createElement("div"); n.className=`nebula ${tone} ${pos}`; document.body.appendChild(n);
    });
  }
}
function showNebulas(){
  ensureNebulas();
  $$(".nebula").forEach((n,i)=> setT(()=> n.classList.add("visible"), 5000 + i*1200));
}

// =============== Fugaces ===============
function shootingStar(afterMs){
  setT(()=>{
    const s=document.createElement("div");
    s.className="shooting-star";
    s.style.left=(Math.random()*window.innerWidth)+"px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

// =============== Constelaciones ===============
function drawConstellation({top, left, length, angleDeg, life=3800}){
  const line=document.createElement("div");
  line.className="const-line";
  line.style.top=top+"px"; line.style.left=left+"px"; line.style.width=length+"px";
  line.style.transform=`rotate(${angleDeg}deg) scaleX(0)`;
  consts.appendChild(line);
  requestAnimationFrame(()=> line.classList.add("draw"));
  setTimeout(()=> line.classList.add("fade"), life);
  setTimeout(()=> line.remove(), life+2200);
}

// =============== Polvo ===============
function activateDust(){ if(dust) dust.classList.add("visible"); }

// =============== Textos ===============
function showTitle(){  titulo.classList.add("show"); }
function showSceneMsg(){ escena.textContent="🌌 Nuestro viaje comienza..."; escena.classList.add("show"); }
function fadeOutTexts(){ titulo.classList.add("fade-out"); escena.classList.add("fade-out"); const w=$("#whisper"); if(w) w.classList.add("hide"); }

// =============== Rampa de luz ===============
function rampBrightness(){ T_RAMP.forEach(step=> setT(()=> setVeil(step.veil), step.t)); }

// =============== Parallax Nebulosas ===============
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

// =============== CHISPAS (clic y mantener) ===============
function spawnSpark(x,y,big=false){
  const p=document.createElement("div");
  p.className="spark-pop";
  const size = big ? (6+Math.random()*8) : (4+Math.random()*6); // 4–12px
  p.style.width=size+"px"; p.style.height=size+"px";
  p.style.left=(x + (Math.random()*14-7))+"px";
  p.style.top =(y + (Math.random()*14-7))+"px";
  document.body.appendChild(p);
  setTimeout(()=> p.remove(), 820);
}
function burst(x,y){
  const n=12+Math.floor(Math.random()*6); // 12–18
  for(let i=0;i<n;i++) setTimeout(()=> spawnSpark(x,y,true), i*18);
}
let pressInterval=null;
function onMouseDown(e){
  burst(e.clientX, e.clientY);
  if(pressInterval) clearInterval(pressInterval);
  pressInterval=setInterval(()=> spawnSpark(e.clientX,e.clientY,false), 60);
}
function onMouseUp(){ if(pressInterval){ clearInterval(pressInterval); pressInterval=null; } }
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener("click", e=> burst(e.clientX, e.clientY)); // click suelto

// =============== Susurros ===============
const WHISPERS=["Cierra los ojos…","Respira conmigo…","Quédate aquí un momento…"];
let whisperTimer=null;
function startWhispers(){
  let w=$("#whisper");
  if(!w){ w=document.createElement("span"); w.id="whisper"; escena.appendChild(w); }
  let idx=0;
  const showNext=()=>{
    if(!w) return;
    w.classList.remove("show"); w.classList.add("hide");
    setTimeout(()=>{ w.textContent=WHISPERS[idx%WHISPERS.length]; idx++; w.classList.remove("hide"); w.classList.add("show"); }, 400);
  };
  showNext(); whisperTimer=setI(showNext, 9000);
}
function stopWhispers(){ if(whisperTimer){ clearInterval(whisperTimer); intervals.delete(whisperTimer); whisperTimer=null; } const w=$("#whisper"); if(w) w.classList.add("hide"); }

// =============== Halo ===============
function startHalo(){
  if(!halo) return;
  halo.classList.add("on");
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 28000);
  setT(()=>{ halo.classList.add("boost"); setTimeout(()=> halo.classList.remove("boost"), 1200); }, 40000);
}

// =============== Hint & Skip ===============
function scheduleHint(){ setT(()=> hint.classList.add("show"), T_HINT_IN_MS); setT(()=> hint.classList.remove("show"), T_HINT_OUT_MS); }
function scheduleSkip(){ setT(()=>{ root.classList.add("skip-visible"); skipBtn.addEventListener("click", onSkip); }, T_SKIP_VISIBLE_MS); }
function onSkip(){ doBoom(true); }

// =============== Rush 40–59s ===============
let rushRAF=null;
function startRush(){
  root.classList.add("rush");
  const DURATION=Math.max(1, T_BOOM_MS - T_RUSH_START_MS);
  const t0=performance.now();
  setVar("--rush-scale-near",1); setVar("--rush-scale-mid",1); setVar("--rush-scale-far",1); setVar("--rush-opacity",0.95);
  const step=now=>{
    const t=clamp((now-t0)/DURATION,0,1), e=easeInOutCubic(t);
    setVar("--rush-scale-near", (1 + e*1.8).toFixed(3));
    setVar("--rush-scale-mid",  (1 + e*1.0).toFixed(3));
    setVar("--rush-scale-far",  (1 + e*0.3).toFixed(3));
    setVar("--rush-opacity",    (0.95 + e*0.05).toFixed(3));
    setVar("--rush-translate",  `${(e*6)|0}px`);
    if(t<1) rushRAF=requestAnimationFrame(step); else rushRAF=null;
  };
  rushRAF=requestAnimationFrame(step);
}
function preBoom(){ root.classList.add("preboom"); }

// =============== BOOM (sin redirección) ===============
let boomDone=false;
async function doBoom(fromSkip=false){
  if(boomDone) return; boomDone=true;
  window.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mouseup", onMouseUp);
  stopSparkle(); stopWhispers();

  try{
    const startVol=audio.volume, steps=6;
    for(let i=0;i<=steps;i++){ audio.volume = clamp(startVol*(1-i/steps),0,1); await wait(30); }
    audio.pause();
  }catch{}

  setVar("--flash-opacity", 1);
  setTimeout(()=> setVar("--flash-opacity", 0), 120);
  root.classList.add("boom");

  // nos quedamos en negro. cuando exista lalaland.html, sustituye por:
  // window.location.href = "lalaland.html";
}

// =============== Timeline principal ===============
function startTimeline(){
  createStars(220); startSparkle();
  showNebulas(); setT(showTitle, T_SHOW_TITLE_MS);
  setT(()=>{ parallaxActive=true; }, T_INTERACTIONS_MS);
  setT(startHalo, T_HALO_ON_MS);
  setT(activateDust, T_DUST_MSG_MS);
  setT(showSceneMsg, T_DUST_MSG_MS);
  setT(startWhispers, T_WHISPERS_MS);
  setT(()=> drawConstellation({ top:window.innerHeight*0.28, left:window.innerWidth*0.18, length:window.innerWidth*0.22, angleDeg:12 }), T_CONST_1_MS);
  setT(()=> drawConstellation({ top:window.innerHeight*0.62, left:window.innerWidth*0.58, length:window.innerWidth*0.18, angleDeg:-18 }), T_CONST_2_MS);
  shootingStar(T_SHOOT_1_MS); shootingStar(T_SHOOT_2_MS);
  scheduleHint(); scheduleSkip();
  setT(()=>{ fadeOutTexts(); stopWhispers(); }, T_TEXTS_FADE_MS);
  setT(startRush, T_RUSH_START_MS);
  setT(preBoom,   T_PREBOOM_MS);
  setT(()=> doBoom(false), T_BOOM_MS);
}

// =============== Play handler ===============
btn.addEventListener("click", async ()=>{
  audio.load(); audio.volume = 0.85;
  try{
    await audio.play();
    btn.style.display="none";
    rampBrightness();
    startTimeline();
  }catch(err){
    console.error("Audio bloqueado", err);
    alert("Toca de nuevo para iniciar el audio ✨");
  }
});
window.addEventListener("keydown", (e)=>{
  if((e.code==="Space" || e.code==="Enter") && btn.style.display!=="none"){ btn.click(); }
  if(e.code==="KeyS" && root.classList.contains("skip-visible")) onSkip();
});

// =============== Limpieza ===============
window.addEventListener("beforeunload", ()=>{
  clearAllTimers(); if(rushRAF) cancelAnimationFrame(rushRAF);
  stopWhispers(); stopSparkle();
});


