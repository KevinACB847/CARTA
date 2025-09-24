/*************************
 * Intro La La Land (PC)
 * Timeline + interacciones
 *************************/

// --------- Helpers ---------
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
function setVeil(value){ document.documentElement.style.setProperty("--veil", String(value)); }

console.log("intro.js cargado ✅");

// --------- DOM refs ---------
const audio  = $("#musica");
const btn    = $("#playBtn");
const titulo = $("#titulo");
const escena = $("#escena");
const veil   = $("#veil");
const dust   = $("#dust");
const consts = $("#constellations");
const halo   = $("#halo");

// Sanity check
if(!audio || !btn || !titulo || !escena || !veil){
  console.error("Faltan elementos del DOM. Revisa IDs en index.html");
}

// ======================================================
//                  ESTRELLAS (base + sparkle)
// ======================================================
function createStars(count = 170){
  for(let i=0;i<count;i++){
    const s = document.createElement("div");
    s.className = "star";
    s.style.top  = (Math.random() * window.innerHeight) + "px";
    s.style.left = (Math.random() * window.innerWidth)  + "px";
    s.style.animationDuration = (2 + Math.random()*3) + "s";
    document.body.appendChild(s);
    // entrada con retardo aleatorio (sin pops)
    setTimeout(()=>{ s.style.opacity = 1; }, 1200 + Math.random()*1800);
  }
}

let sparkleTimer = null;
function startSparkle(){
  sparkleTimer = setInterval(()=>{
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

// ======================================================
//                     NEBULOSAS
// ======================================================
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
    setTimeout(()=> n.classList.add("visible"), 5000 + i*1200); // 5.0s, 6.2s, 7.4s
  });
}

// ======================================================
//                   ESTRELLAS FUGACES
// ======================================================
function shootingStar(afterMs){
  setTimeout(()=>{
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = (Math.random()*window.innerWidth) + "px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

// ======================================================
//                   CONSTELACIONES
// ======================================================
function drawConstellation({top, left, length, angleDeg, life=3800}){
  const line = document.createElement("div");
  line.className = "const-line";
  line.style.top = top + "px";
  line.style.left = left + "px";
  line.style.width = length + "px";
  line.style.transform = `rotate(${angleDeg}deg) scaleX(0)`;
  consts.appendChild(line);
  requestAnimationFrame(()=> line.classList.add("draw")); // anima
  setTimeout(()=> line.classList.add("fade"), life);
  setTimeout(()=> line.remove(), life + 2200);
}

// ======================================================
//                      POLVO ESTELAR
// ======================================================
function activateDust(){ if(dust) dust.classList.add("visible"); }

// ======================================================
//                       TEXTOS
// ======================================================
function showTitle(){  titulo.classList.add("show"); }
function showSceneMsg(){
  escena.textContent = "🌌 Nuestro viaje comienza...";
  escena.classList.add("show");
}
function fadeOutTexts(){
  // Se pidió que ambos se vayan juntos
  titulo.classList.add("fade-out");
  escena.classList.add("fade-out");
  const w = $("#whisper");
  if(w){ w.classList.add("hide"); }
}

// ======================================================
//              Rampa de luz (overlay global)
// ======================================================
async function rampBrightness(){
  setVeil(1.0);           // 0–2s noche cerrada
  await wait(2000);
  setVeil(0.70);          // 2–5s
  await wait(3000);
  setVeil(0.55);          // 5–15s
  await wait(10000);
  setVeil(0.35);          // 15–35s
  await wait(20000);
  setVeil(0.12);          // 35–60s
}

// ======================================================
//            INTERACCIONES (PC)
//  - Parallax suave de nebulosas
//  - Destellos por click
//  - Susurros rotativos 18–48s
//  - Halo central que “respira” (boosts)
// ======================================================

// ---------- Parallax (nebulosas siguen al mouse) ----------
let parallaxActive = false;
let targetX = 0, targetY = 0;
let px = 0, py = 0;           // valores suavizados
const ease = 0.06;            // inercia

function onMouseMove(e){
  if(!parallaxActive) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  // Normalizamos a rango [-1, 1]
  targetX = (e.clientX - cx) / cx;
  targetY = (e.clientY - cy) / cy;
}
function parallaxLoop(){
  if(parallaxActive){
    // LERP suave
    px += (targetX - px) * ease;
    py += (targetY - py) * ease;

    const layers = $$(".nebula");
    layers.forEach((n, i)=>{
      const strength = (i+1) * 6; // 6, 12, 18 px máx aprox
      const tx = -px * strength;
      const ty = -py * strength;
      // Nota: esto sobrescribe transform de la animación.
      // Si prefieres mantener float/pulse + parallax juntos, podemos migrar a CSS vars.
      n.style.transform = `translate(${tx}px, ${ty}px)`;
    });
  }
  requestAnimationFrame(parallaxLoop);
}
window.addEventListener("mousemove", onMouseMove);
parallaxLoop();

// ---------- Destellos por click ----------
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

// ---------- Susurros rotativos ----------
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
  whisperTimer = setInterval(showNext, 9000);
}
function stopWhispers(){
  if(whisperTimer){ clearInterval(whisperTimer); whisperTimer = null; }
  const w = $("#whisper");
  if(w){ w.classList.add("hide"); }
}

// ---------- Halo respirando con boosts ----------
function startHalo(){
  if(!halo) return;
  halo.classList.add("on");                // activa pulso lento
  // Boosts sutiles (28s y 40s aprox)
  setTimeout(()=>{
    halo.classList.add("boost");
    setTimeout(()=> halo.classList.remove("boost"), 1200);
  }, 28000);
  setTimeout(()=>{
    halo.classList.add("boost");
    setTimeout(()=> halo.classList.remove("boost"), 1200);
  }, 40000);
}

// ======================================================
//                 TIMELINE PRINCIPAL
// ======================================================
async function startTimeline(){
  // Estrellas base + sparkle
  createStars(170);
  startSparkle();

  // Nebulosas + Título
  showNebulas();
  setTimeout(showTitle, 7000);    // 7–11s

  // Activar interacciones en los tiempos acordados
  setTimeout(()=> { parallaxActive = true; }, 10000); // 10s
  setTimeout(startHalo, 12000);                       // 12s

  // Polvo + mensaje + susurros (15s)
  setTimeout(activateDust, 15000);
  setTimeout(showSceneMsg, 15000);
  setTimeout(startWhispers, 18000);                   // 18s

  // Constelaciones (22–38s)
  setTimeout(()=>{
    drawConstellation({
      top: window.innerHeight*0.28,
      left: window.innerWidth*0.18,
      length: window.innerWidth*0.22,
      angleDeg: 12
    });
  }, 22000);
  setTimeout(()=>{
    drawConstellation({
      top: window.innerHeight*0.62,
      left: window.innerWidth*0.58,
      length: window.innerWidth*0.18,
      angleDeg: -18
    });
  }, 30000);

  // Estrellas fugaces pequeñas (29–44s)
  shootingStar(29000);
  shootingStar(44000);

  // Habilitar destello por click desde 15s
  setTimeout(enableClickSpark, 15000);

  // Despedida de textos (50–53s)
  setTimeout(()=>{
    fadeOutTexts();
    stopWhispers();
  }, 50000);
}

// ======================================================
//                     PLAY HANDLER
// ======================================================
btn.addEventListener("click", async ()=>{
  console.log("CLICK en botón ▶");
  audio.load();
  audio.volume = 0.85;

  try{
    await audio.play();
    console.log("Audio reproduciéndose ✅");
    btn.style.display = "none";
    rampBrightness();   // rampa de luz en paralelo
    startTimeline();    // coreografía visual
  }catch(err){
    console.error("Audio bloqueado ❌", err);
    // Fallback: intenta reanudar tras una mínima interacción adicional
    // (algunos navegadores necesitan otro gesto de usuario)
    alert("Toca de nuevo para iniciar el audio ✨");
  }
});

// También permite pulsar SPACE/ENTER para iniciar (accesibilidad)
window.addEventListener("keydown", (e)=>{
  if(e.code === "Space" || e.code === "Enter"){
    btn.click();
  }
});

// ======================================================
//                    LIMPIEZA
// ======================================================
window.addEventListener("beforeunload", ()=>{
  if(sparkleTimer) clearInterval(sparkleTimer);
  if(whisperTimer) clearInterval(whisperTimer);
  disableClickSpark();
});


