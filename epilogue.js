/* ===========================
   La La Land — Epílogo (JS)
   Sin dependencias, GPU-friendly
   =========================== */

(() => {
  // ---------- Helpers ----------
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const stage = $('#stage');
  const screen = $('#screen');
  const img = $('#frame');
  const vid = $('#clip');
  const grain = $('#grain');
  const projector = $('#projector');
  const tTop = $('#text-top');
  const tBottom = $('#text-bottom');
  const playBtn = $('#play');
  const audio = $('#song');

  // ---- CONFIG: rutas y timeline (segundos desde inicio del audio) ----
  // Tramo 5:40 → 7:40  (120 s)
  // Nota del video: dura 14 s; primeros 2 s en negro y luego aparecen estrellas.
  const PLAN = [
    { start: 340, dur: 4,   type: 'black' },

    { start: 344, dur: 14,  src: 'IMG/01-terraza-luces.jpg',
      textTop: 'Nuestro pequeño cine.', kb: true, breathe: true },

    { start: 358, dur: 12,  src: 'IMG/02-manos-pizza.jpg',
      textBottom: 'Donde fuimos nosotros.', kb: true, breathe: true },

    { start: 370, dur: 12,  src: 'IMG/03-bus-ventana.jpg',
      kb: true },

    { start: 382, dur: 12,  src: 'IMG/04-espejos-beso.jpg',
      kb: true, flare: true },

    { start: 394, dur: 12,  src: 'IMG/05-invernadero-beso.jpg',
      kb: true },

    { start: 406, dur: 10,  src: 'IMG/06-beso-mejilla-jean.jpg',
      textBottom: 'Por los planes que soñamos.', kb: true },

    { start: 416, dur: 14,  video: 'IMG/07-video-vangogh.mp4',
      textBottom: 'Contigo todo fue posible.' },

    { start: 430, dur: 14,  src: 'IMG/08-cafe-balcon.jpg' },

    { start: 444, dur: 16,  src: 'IMG/09-selfie-celeste.jpg',
      textTop: 'Feliz cumpleaños, amor.',
      textBottom: 'Para ti, que eres mi estrella ✨' }
  ];

  const AUDIO_SRC = 'music/epilogue.mp3';

  // ---------- Setup ----------
  audio.src = AUDIO_SRC;
  // Botón play/pause
  playBtn.addEventListener('click', () => {
    audio.paused ? audio.play() : audio.pause();
  });
  audio.addEventListener('play',  () => { playBtn.textContent = '⏸'; stage.classList.add('beam'); });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶︎'; });

  // Video config
  vid.setAttribute('playsinline', '');
  vid.muted = true; // ¡Muy importante para móviles!

  // Preload de imágenes
  PLAN.forEach(it => { if (it.src) { const p = new Image(); p.src = it.src; } });

  // ---------- Render ----------
  let currentIndex = -1;
  let rafId = null;

  function clearTexts(){
    tTop.textContent = ''; tBottom.textContent = '';
  }

  function makeFlare(){
    const f = document.createElement('div');
    f.className = 'flare';
    screen.appendChild(f);
    f.addEventListener('animationend', () => f.remove(), { once:true });
  }

  function applyEffects(it){
    // limpia estados
    stage.classList.remove('breathe', 'weave');
    img.classList.remove('kb');

    if (it.breathe) stage.classList.add('breathe');
    if (it.kb && img.classList.contains('show')) img.classList.add('kb');
    // Tejido del proyector en olas más vivas (opcional):
    // if (it.breathe) screen.classList.add('weave'); else screen.classList.remove('weave');

    if (it.flare) makeFlare();
  }

  function showItem(it){
    // Textos
    tTop.textContent = it.textTop || '';
    tBottom.textContent = it.textBottom || '';

    if (it.type === 'black'){
      img.classList.remove('show'); vid.classList.remove('show');
      clearTexts();
      return;
    }

    if (it.video){
      // Mostrar video
      img.classList.remove('show');
      if (vid.src !== it.video) vid.src = it.video;
      vid.currentTime = 0;
      vid.classList.add('show');
      // Reproducir sin sonido; en iOS requiere que el audio (pista principal) esté ya en play
      vid.play().catch(()=>{ /* algunos móviles bloquean; no es crítico */ });
    } else if (it.src){
      // Mostrar imagen
      vid.pause();
      vid.classList.remove('show');
      img.src = it.src;
      img.classList.add('show');
    }

    // Efectos suaves
    applyEffects(it);
  }

  function step(){
    const now = audio.currentTime;
    const i = PLAN.findIndex((it) => now >= it.start - 0.05 && now < (it.start + it.dur));
    if (i !== -1 && i !== currentIndex){
      currentIndex = i;
      showItem(PLAN[i]);
    }
    rafId = requestAnimationFrame(step);
  }

  // Opcional: pausa el bucle cuando la pestaña no está visible (ahorra batería)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!rafId) { rafId = requestAnimationFrame(step); }
  });

  // Iniciar cuando el audio esté listo
  audio.addEventListener('loadedmetadata', () => {
    // Empieza en 5:40 si quieres probar solo el tramo final:
    // audio.currentTime = 340; 
    rafId = requestAnimationFrame(step);
  });

  // Tap: corazoncito/estrella flotante (bonito y liviano)
  screen.addEventListener('pointerdown', (e) => {
    const s = document.createElement('div');
    s.textContent = '✦';
    s.style.position = 'absolute';
    const rect = screen.getBoundingClientRect();
    s.style.left = (e.clientX - rect.left - 8) + 'px';
    s.style.top  = (e.clientY - rect.top  - 8) + 'px';
    s.style.fontSize = '24px';
    s.style.opacity = '0.9';
    s.style.transition = 'transform 1.2s ease, opacity 1.2s ease';
    s.style.transform = 'translateY(0)';
    s.style.pointerEvents = 'none';
    s.style.zIndex = '7';
    screen.appendChild(s);
    requestAnimationFrame(() => {
      s.style.transform = 'translateY(-60px)';
      s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 1300);
  });

  // Autoplay en móvil: requiere gesto previo; si no hay sonido al cargar,
  // el usuario puede tocar el botón ▶︎ para iniciar.
})();
