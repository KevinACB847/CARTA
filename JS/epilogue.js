/* ===========================
   La La Land — Epílogo (JS)
   Sin dependencias, GPU-friendly
   =========================== */

(() => {
  const $  = s => document.querySelector(s);

  const stage = $('#stage');
  const screen = $('#screen');
  const img = $('#frame');
  const vid = $('#clip');
  const tTop = $('#text-top');
  const tBottom = $('#text-bottom');
  const playBtn = $('#play');
  const audio = $('#song');

  // Timeline (segundos desde inicio del audio)
  // Tramo real: 5:40 → 7:40
  const PLAN = [
    { start: 340, dur: 4,  type: 'black' },

    { start: 344, dur: 14, src: 'IMG/01-terraza-luces.jpg',
      textTop: 'Nuestro pequeño cine.', kb: true, breathe: true },

    { start: 358, dur: 12, src: 'IMG/02-manos-pizza.jpg',
      textBottom: 'Donde fuimos nosotros.', kb: true, breathe: true },

    { start: 370, dur: 12, src: 'IMG/03-bus-ventana.jpg', kb: true },

    { start: 382, dur: 12, src: 'IMG/04-espejos-beso.jpg', kb: true, flare: true },

    { start: 394, dur: 12, src: 'IMG/05-invernadero-beso.jpg', kb: true },

    { start: 406, dur: 10, src: 'IMG/06-beso-mejilla-jean.jpg',
      textBottom: 'Por los planes que soñamos.', kb: true },

    { start: 416, dur: 14, video: 'IMG/07-video-vangogh.mp4',
      textBottom: 'Contigo todo fue posible.' },

    { start: 430, dur: 14, src: 'IMG/08-cafe-balcon.jpg' },

    { start: 444, dur: 16, src: 'IMG/09-selfie-celeste.jpg',
      textTop: 'Feliz cumpleaños, amor.',
      textBottom: 'Para ti, que eres mi estrella ✨' }
  ];

  // ------- Play/Pause + salto a 5:40 -------
  let jumped = false;

  // iOS/Android exigen interacción para iniciar audio, por eso el botón:
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        if (!jumped) { audio.currentTime = 340; jumped = true; }
        playBtn.textContent = '⏸';
        stage.classList.add('beam'); // enciende el “proyector”
      }).catch(() => {
        // Si falla el autoplay, pide un segundo toque
        playBtn.textContent = '▶︎';
      });
    } else {
      audio.pause();
      playBtn.textContent = '▶︎';
    }
  });

  // Video: listo para móvil
  vid.setAttribute('playsinline', '');
  vid.muted = true;

  // Pre-carga imágenes
  PLAN.forEach(it => { if (it.src) { const p = new Image(); p.src = it.src; } });

  // ------- Render loop -------
  let currentIndex = -1;
  let rafId = null;

  function clearTexts(){ tTop.textContent=''; tBottom.textContent=''; }

  function makeFlare(){
    const f = document.createElement('div');
    f.className = 'flare';
    screen.appendChild(f);
    f.addEventListener('animationend', () => f.remove(), { once:true });
  }

  function applyEffects(it){
    stage.classList.remove('breathe');
    img.classList.remove('kb');

    if (it.breathe) stage.classList.add('breathe');
    // Añade Ken Burns sólo si hay imagen visible
    if (it.kb && img.classList.contains('show')) img.classList.add('kb');

    if (it.flare) makeFlare();
  }

  function showItem(it){
    tTop.textContent = it.textTop || '';
    tBottom.textContent = it.textBottom || '';

    if (it.type === 'black'){
      img.classList.remove('show'); vid.classList.remove('show');
      clearTexts(); return;
    }

    if (it.video){
      img.classList.remove('show');
      if (vid.src !== it.video) vid.src = it.video;
      vid.currentTime = 0;
      vid.classList.add('show');
      vid.play().catch(()=>{});
    } else if (it.src){
      vid.pause(); vid.classList.remove('show');
      img.src = it.src;
      img.classList.add('show');
    }
    applyEffects(it);
  }

  function step(){
    const now = audio.currentTime;
    const i = PLAN.findIndex(it => now >= it.start - 0.05 && now < (it.start + it.dur));
    if (i !== -1 && i !== currentIndex){
      currentIndex = i;
      showItem(PLAN[i]);
    }
    rafId = requestAnimationFrame(step);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!rafId) { rafId = requestAnimationFrame(step); }
  });

  audio.addEventListener('loadedmetadata', () => {
    rafId = requestAnimationFrame(step);
  });
})();

