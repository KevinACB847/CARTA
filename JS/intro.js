const audio = document.getElementById("musica");
const titulo = document.getElementById("titulo");
const escenaDiv = document.getElementById("escena");
const playBtn = document.getElementById("playBtn");
const starCanvas = document.getElementById("starCanvas");
const ctx = starCanvas.getContext("2d");

// Ajustar canvas
function resizeCanvas() {
  starCanvas.width = window.innerWidth;
  starCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Detectar móvil
const isMobile = window.innerWidth < 768;

// Crear estrellas en PC
function createStarDivs() {
  for (let i = 0; i < 120; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.top = Math.random() * window.innerHeight + "px";
    star.style.left = Math.random() * window.innerWidth + "px";
    star.style.animationDuration = (2 + Math.random()*3) + "s";
    document.body.appendChild(star);
    // fade-in de cada estrella con delay
    setTimeout(() => { star.style.opacity = 1; }, 1000 + Math.random()*2000);
  }
}

// Estrellas móviles con canvas
let stars = [];
function initCanvasStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      r: Math.random() * 1.5,
      o: Math.random()
    });
  }
}
function drawStars() {
  ctx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  ctx.fillStyle = "white";
  for (let s of stars) {
    ctx.globalAlpha = s.o;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
    s.o += (Math.random()-0.5)*0.05;
    if (s.o < 0.1) s.o = 0.1;
    if (s.o > 1) s.o = 1;
  }
  requestAnimationFrame(drawStars);
}

// Mostrar nebulosas poco a poco
function fadeInNebulas() {
  document.querySelectorAll(".nebula").forEach((nebula, i) => {
    setTimeout(() => { nebula.style.opacity = 1; }, 2000 + i*1000);
  });
}

// Play
playBtn.addEventListener("click", () => {
  audio.load();
  audio.volume = 0.8;
  audio.play().then(() => {
    playBtn.style.display = "none";

    // 1) Estrellas
    if (isMobile) {
      initCanvasStars();
      drawStars();
    } else {
      createStarDivs();
    }

    // 2) Nebulosas
    fadeInNebulas();

    // 3) Título
    setTimeout(() => {
      titulo.style.opacity = 1;
      titulo.style.transform = "scale(1)";
    }, 3000);
  }).catch(err => console.error("Error audio:", err));
});

// Estrellas fugaces en PC
function shootingStar(delay) {
  if (isMobile) return;
  setTimeout(() => {
    const s = document.createElement("div");
    s.className = "shooting-star";
    s.style.left = Math.random()*window.innerWidth + "px";
    document.body.appendChild(s);
    setTimeout(()=>s.remove(), 2500);
  }, delay);
}
shootingStar(10000);
shootingStar(25000);
shootingStar(45000);

// Texto secundario según la música
audio.addEventListener("timeupdate", () => {
  const t = audio.currentTime;
  if (t >= 15 && t < 50) {
    escenaDiv.style.opacity = 1;
    escenaDiv.textContent = "🌌 Nuestro viaje comienza...";
  } else {
    escenaDiv.style.opacity = 0;
  }
});



