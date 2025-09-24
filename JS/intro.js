/*************************
 * Intro La La Land (PC)
 * Timeline coreografiado
 *************************/

// --------- Selectores base ---------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const audio   = $("#musica");
const btn     = $("#playBtn");
const titulo  = $("#titulo");
const escena  = $("#escena");
const veil    = $("#veil");              // velo global (oscurecimiento)
const dust    = $("#dust");              // polvo estelar
const consts  = $("#constellations");    // contenedor de constelaciones

// --------- Utilidades ---------
function setVeil(value){ // value: 1 (negro total) -> 0 (sin velo)
  document.documentElement.style.setProperty("--veil", String(value));
}
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

// --------- Estrellas (divs, PC) ---------
function createStars(count = 160){
  for(let i=0;i<count;i++){
    const s = document.createElement("div");
    s.className = "star";
    s.style.top  = (Math.random()*window.innerHeight) + "px";
    s.style.left = (Math.random()*window.innerWidth) + "px";
    s.style.animationDuration = (2 + Math.random()*3) + "s";
    // ocultas al inicio; luego haremos fade-in escalonado
    document.body.appendChild(s);
    setTimeout(() => { s.style.opacity = 1; }, 1200 + Math.random()*1800); // entrada no brusca
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
  }, 3800); // ritmo suave (~pulso)
}

// --------- Nebulosas ---------
function showNebulas(){
  // Si no existen en el HTML, crea las 3 capas
  let nebulas = $$(".nebula");
  if(!nebulas.length){
    [["blue","pos-1"],["pink","pos-2"],["gold","pos-3"]].forEach(([tone,pos])=>{
      const n = document.createElement("div");
      n.className = `nebula ${tone} ${pos}`;
      document.body.appendChild(n);
    });
    nebulas = $$(".nebula");
  }
  // Fade-in escalonado (sin pops)
  nebulas.forEach((n,i)=>{
    setTimeout(()=> n.classList.add("visible"), 5000 + i*1200); // 5.0s, 6.2s, 7.4s aprox
  });
}

// --------- Estrellas fugaces (PC) ---------
function shootingStar(afterMs){
  setTimeout(()=>{
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = (Math.random()*window.innerWidth) + "px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

// --------- Constelaciones (líneas finas) ---------
function drawConstellation({top, left, length, angleDeg, life=3800}){
  const line = document.createElement("div");
  line.className = "const-line";
  line.style.top = top + "px";
  line.style.left = left + "px";
  line.style.width = length + "px";
  line.style.transform = `rotate(${angleDeg}deg) scaleX(0)`; // empieza sin dibujar
  consts.appendChild(line);
  // animar “dibujo”
  requestAnimationFrame(()=> line.classList.add("draw"));
  // desvanecer y quitar
  setTimeout(()=> line.classList.add("fade"), life);
  setTimeout(()=> line.remove(), life + 2200);
}

// --------- Polvo estelar ---------
function activateDust(){
  if(dust) dust.classList.add("visible");
}

// --------- Textos ---------
function showTitle(){
  titulo.classList.add("show"); // fade-in + zoom lento (CSS)
}
function showSceneMsg(){
  escena.textContent = "🌌 Nuestro viaje comienza...";
  escena.classList.add("show");
}
function fadeOutTexts(){
  // Se pidió que se vaya también el título junto al mensaje
  titulo.classList.add("fade-out");
  escena.classList.add("fade-out");
}

// --------- Rampa de luz global (oscuro -> luminoso) ---------
async function rampBrightness(){
  // 0–2s noche cerrada (se mantiene en 1.0)
  setVeil(1.0);
  await wait(2000);
  // 2–5s sube muy poco la luz
  setVeil(0.70);
  await wait(3000);
  // 5–15s otra subida leve
  setVeil(0.55);
  await wait(10000);
  // 15–35s baja más el velo (más luz)
  setVeil(0.35);
  await wait(20000);
  // 35–60s llega al brillo destino
  setVeil(0.12);
}

// --------- Timeline principal ---------
async function startTimeline(){
  // Estrellas base
  createStars(170);
  startSparkle();

  // Nebulosas + Título
  showNebulas();
  setTimeout(showTitle, 7000);   // 7.0–11.0s

  // Polvo estelar y mensaje secundario (15s)
  setTimeout(activateDust, 15000);
  setTimeout(showSceneMsg, 15000);

  // Constelaciones A y B (22–38s aprox.)
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

  // Estrellas fugaces pequeñas (29–45s)
  shootingStar(29000);
  shootingStar(44000);

  // Despedida de textos (50–53s)
  setTimeout(fadeOutTexts, 50000);
}

// --------- Play handler ---------
btn.addEventListener("click", async ()=>{
  audio.load();
  audio.volume = 0.85;

  try{
    await audio.play();
    btn.style.display = "none";

    // Rampa de luz global (en paralelo)
    rampBrightness();

    // Coreografía visual
    startTimeline();

  }catch(err){
    console.error("Error al reproducir audio:", err);
  }
});

// --------- Limpieza por si cambias de página ---------
window.addEventListener("beforeunload", ()=>{
  if(sparkleTimer) clearInterval(sparkleTimer);
});


