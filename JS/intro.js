// === Referencias ===
const audio     = document.getElementById("musica");
const titulo    = document.getElementById("titulo");
const escenaDiv = document.getElementById("escena");
const playBtn   = document.getElementById("playBtn");
const starCanvas= document.getElementById("starCanvas");
const ctx       = starCanvas.getContext("2d");

// === Utilidades ===
const isMobile = window.matchMedia("(max-width: 768px)").matches;

// Ajusta canvas a pantalla
function resizeCanvas(){
  starCanvas.width  = window.innerWidth;
  starCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Crea nebulosas por defecto si no existen en el HTML
function ensureNebulas(){
  let nebulas = document.querySelectorAll(".nebula");
  if(nebulas.length === 0){
    const specs = [
      ["blue","pos-1"],
      ["pink","pos-2"],
      ["gold","pos-3"]
    ];
    specs.forEach(([tone,pos])=>{
      const n = document.createElement("div");
      n.className = `nebula ${tone} ${pos}`;
      document.body.appendChild(n);
    });
  }
}
ensureNebulas();

// === Estrellas en PC (divs) ===
function createStarDivs(count=140){
  for(let i=0;i<count;i++){
    const star = document.createElement("div");
    star.className = "star";
    star.style.top  = (Math.random()*window.innerHeight)+"px";
    star.style.left = (Math.random()*window.innerWidth)+"px";
    star.style.animationDuration = (2+Math.random()*3)+"s";
    document.body.appendChild(star);
    // Aparecen con retardo aleatorio (no todas de golpe)
    setTimeout(()=>{ star.style.opacity = 1; }, 800 + Math.random()*1600);
  }
}

// Destellos “rítmicos” en algunas estrellas (PC)
let sparkleTimerPC = null;
function startSparklePC(){
  const all = () => document.querySelectorAll(".star");
  sparkleTimerPC = setInterval(()=>{
    const stars = all();
    if(stars.length===0) return;
    // Elegimos 4-6 estrellas random
    const n = 4 + Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const s = stars[Math.floor(Math.random()*stars.length)];
      if(!s) continue;
      s.classList.add("sparkle");
      setTimeout(()=> s.classList.remove("sparkle"), 600);
    }
  }, 3800); // ~pulso regular
}

// === Estrellas en móvil (canvas) ===
let stars = [];
function initCanvasStars(count = isMobile ? 90 : 70){
  stars = [];
  for(let i=0;i<count;i++){
    stars.push({
      x: Math.random()*starCanvas.width,
      y: Math.random()*starCanvas.height,
      r: Math.random()*1.6 + 0.4,
      o: Math.random()*0.9 + 0.1,
      v: (Math.random()*0.04)+0.01 // velocidad de “twinkle”
    });
  }
}

let rafId = null;
function drawStars(){
  ctx.clearRect(0,0,starCanvas.width, starCanvas.height);
  for(const s of stars){
    // twinkle
    s.o += (Math.random()-0.5)*s.v;
    if(s.o<0.12) s.o = 0.12;
    if(s.o>1.0)  s.o = 1.0;

    ctx.globalAlpha = s.o;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  rafId = requestAnimationFrame(drawStars);
}

let sparkleTimerCanvas = null;
function startSparkleCanvas(){
  sparkleTimerCanvas = setInterval(()=>{
    if(stars.length===0) return;
    // Destella 5-7 estrellas
    const n = 5 + Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      const idx = Math.floor(Math.random()*stars.length);
      const s = stars[idx];
      const oldR = s.r, oldO = s.o;
      s.r = oldR*1.9;
      s.o = 1.0;
      setTimeout(()=>{
        s.r = oldR;
        s.o = oldO;
      }, 520);
    }
  }, 3800);
}

// === Nebulosas: fade-in escalonado ===
function fadeInNebulas(){
  const nebulas = document.querySelectorAll(".nebula");
  nebulas.forEach((neb,i)=>{
    // Pequeño “stagger” y delay de animación para variedad
    neb.style.animationDelay = `${i*1.2}s, ${i*0.6}s`; // float, pulse
    setTimeout(()=>{ neb.style.opacity = 1; }, 1400 + i*900);
  });
}

// === Estrella fugaz (solo PC para cuidar performance móvil) ===
function shootingStar(afterMs){
  if(isMobile) return;
  setTimeout(()=>{
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = (Math.random()*window.innerWidth)+"px";
    document.body.appendChild(s);
    setTimeout(()=> s.remove(), 2100);
  }, afterMs);
}

// === Secuencia al presionar play ===
playBtn.addEventListener("click", ()=>{
  // Música
  audio.load();
  audio.volume = 0.85;
  audio.play().then(()=>{
    playBtn.style.display = "none";

    // Estrellas
    if(isMobile){
      initCanvasStars();
      drawStars();
      startSparkleCanvas();
    }else{
      createStarDivs(150);
      startSparklePC();
    }

    // Nebulosas, luego Título
    fadeInNebulas();
    setTimeout(()=>{
      titulo.style.opacity  = 1;
      titulo.style.transform= "scale(1)";
    }, 2600);

    // Estrellas fugaces (PC)
    shootingStar(6500);
    shootingStar(16000);
    shootingStar(29500);
    shootingStar(43000);
  }).catch(err=>{
    console.error("Error al reproducir audio:", err);
  });
});

// === Texto sincronizado con la música ===
audio.addEventListener("timeupdate", ()=>{
  const t = audio.currentTime;
  if(t >= 15 && t < 50){
    if(escenaDiv.textContent !== "🌌 Nuestro viaje comienza..."){
      escenaDiv.textContent = "🌌 Nuestro viaje comienza...";
    }
    escenaDiv.style.opacity = 1;
  }else{
    escenaDiv.style.opacity = 0;
  }
});

// (Opcional) Cuando termine el audio, por ahora no redirigimos.
// audio.addEventListener("ended", ()=>{ /* luego podemos hacer fade-out o redirigir */ });

// === Limpieza al salir (por si cambias de vistaSPA, etc.) ===
window.addEventListener("beforeunload", ()=>{
  if(rafId) cancelAnimationFrame(rafId);
  if(sparkleTimerPC) clearInterval(sparkleTimerPC);
  if(sparkleTimerCanvas) clearInterval(sparkleTimerCanvas);
});


