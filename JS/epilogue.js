/* =====================================
   La La Land — Epílogo (JS COMPLETO)
   Cine-look + Wind-down desde 6:35
   ===================================== */
(() => {
  const $ = s => document.querySelector(s);

  // Nodos
  const stage = $('#stage');
  const screen = $('#screen');
  const bgFill = $('#bg-fill');
  const img = $('#frame');
  const vid = $('#clip');
  const bokeh = $('#bokeh');
  const tTop = $('#text-top');
  const tBottom = $('#text-bottom');
  const playBtn = $('#play');
  const audio = $('#song');

  // ====== PLAN (5:40 → 7:40) ======
  const PLAN = [
    { start: 340, dur: 4, type: 'black',
      vig:.38, tint:'transparent', tintOp:0, bokeh:0, spotX:'50%', spotY:'50%' },

    { start: 344, dur: 14, src: 'IMG/01-terraza-luces.jpg',
      textTop: 'Nuestro pequeño cine.',
      dir:'kb-down-right', vig:.42,
      tint:'rgba(255,220,170,1)', tintOp:.16,
      blurStart:2, bokeh:10, spotX:'55%', spotY:'40%', breathe:true },

    { start: 358, dur: 12, src: 'IMG/02-manos-pizza.jpg',
      textBottom: 'Donde fuimos nosotros.',
      dir:'kb-zoom-in', vig:.38,
      tint:'rgba(255,210,150,1)', tintOp:.12,
      blurStart:1, bokeh:8, spotX:'50%', spotY:'48%', breathe:true },

    { start: 370, dur: 12, src: 'IMG/03-bus-ventana.jpg',
      dir:'kb-up-left', vig:.45,
      tint:'rgba(130,170,255,1)', tintOp:.12,
      blurStart:3, bokeh:4, spotX:'60%', spotY:'35%' },

    { start: 382, dur: 12, src: 'IMG/04-espejos-beso.jpg',
      dir:'kb-up-right', vig:.40,
      tint:'rgba(255,235,200,1)', tintOp:.10,
      blurStart:2, bokeh:12, spotX:'52%', spotY:'42%', flare:true },

    /* ------- MODO WIND-DOWN inicia ~6:35 (395s) ------- */

    // 5) Invernadero — transición a despedida (zoom out)
    { start: 394, dur: 12, src: 'IMG/05-invernadero-beso.jpg',
      dir:'kb-out-zoom',
      vig:.40, tint:'rgba(235,240,255,1)', tintOp:.06,
      blurStart:1, bokeh:5, spotX:'50%', spotY:'46%' },

    // 6) Beso mejilla — más calmo
    { start: 406, dur: 10, src: 'IMG/06-beso-mejilla-jean.jpg',
      textBottom: 'Por los planes que soñamos.',
      dir:'kb-out-left',
      vig:.44, tint:'rgba(240,245,255,1)', tintOp:.06,
      blurStart:1, bokeh:4, spotX:'48%', spotY:'52%' },

    // 7) Video Van Gogh — estrellas se apagan suave
    { start: 416, dur: 14,
      video: ['IMG/07-video-vangogh.mp4','IMG/07-video-vangogh.webm'],
      textBottom: 'Contigo todo fue posible.',
      vig:.34, tint:'transparent', tintOp:0,
      blurStart:0, bokeh:6, spotX:'50%', spotY:'45%' },

    // 8) Café balcón — último respiro
    { start: 430, dur: 14, src: 'IMG/08-cafe-balcon.jpg',
      dir:'kb-out-right',
      vig:.48, tint:'rgba(255,225,195,1)', tintOp:.12,
      blurStart:2, bokeh:4, spotX:'52%', spotY:'46%' },

    // 9) Selfie celeste — créditos y fade a negro
    { start: 444, dur: 16, src: 'IMG/09-selfie-celeste.jpg',
      textTop: 'Feliz cumpleaños, amor.',
      textBottom: 'Para ti, que eres mi estrella ✨',
      dir:'kb-out-zoom',
      vig:.50, tint:'rgba(245,235,220,1)', tintOp:.10,
      blurStart:0, bokeh:2, spotX:'50%', spotY:'50%' }
  ];

  // ====== Reproductor ======
  let jumped = false;
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        if (!jumped) { audio.currentTime = 340; jumped = true; } // saltar a 5:40
        playBtn.textContent = '⏸';
        stage.classList.add('beam'); // proyector encendido
      }).catch(() => { playBtn.textContent = '▶︎'; });
    } else {
      audio.pause(); playBtn.textContent = '▶︎';
    }
  });

  // Video listo para móvil
  vid.setAttribute('playsinline', '');
  vid.muted = true;
  vid.preload = 'auto';
  vid.addEventListener('error', e => console.error('Error VIDEO:', vid.src, e));

  // Preload imágenes
  PLAN.forEach(it => { if (it.src) { const p = new Image(); p.src = it.src; } });

  // ====== Bokeh ======
  function spawnBokeh(n = 6){
    bokeh.innerHTML = '';
    const rect = bokeh.getBoundingClientRect();
    for (let i = 0; i < n; i++){
      const d = document.createElement('div');
      d.className = 'bokeh-dot';
      d.style.left = Math.random()*rect.width + 'px';
      d.style.top  = (rect.height + Math.random()*60) + 'px';
      d.style.animationDuration = (8 + Math.random()*4) + 's';
      bokeh.appendChild(d);
      requestAnimationFrame(()=>{ d.style.opacity = .9; });
    }
  }

  // ====== Utilidades visuales ======
  function setVars(it){
    const root = document.documentElement.style;
    root.setProperty('--vig', String(it.vig ?? .35));
    root.setProperty('--tint-color', it.tint || 'transparent');
    root.setProperty('--tint-op', String(it.tintOp ?? 0));
    root.setProperty('--spot-x', it.spotX || '50%');
    root.setProperty('--spot-y', it.spotY || '50%');
  }

  function flare(){
    const f = document.createElement('div');
    f.className = 'flare';
    screen.appendChild(f);
    f.addEventListener('animationend', () => f.remove(), { once:true });
  }

  function clearTexts(){ tTop.textContent=''; tBottom.textContent=''; }

  function applyKenBurns(dir){
    // limpia todas las KB previas pero conserva el id
    img.className = 'show';
    if (dir) img.classList.add(dir);
  }

  async function setVideoSource(list){
    const sources = Array.isArray(list) ? list : [list];
    for (const src of sources){
      try{
        if (vid.src !== new URL(src, location.href).href) vid.src = src;
        vid.currentTime = 0;
        await vid.play();
        return true;
      }catch(e){ /* intenta siguiente */ }
    }
    return false;
  }

  // ====== Wind-down helpers ======
  function setWinddown(on = true){
    stage.classList.toggle('winddown', on);
    const root = document.documentElement.style;
    root.setProperty('--sat', on ? '0.92' : '1'); // baja un poco la saturación
  }
  function fadeToBlack(progress){ // 0..1
    document.documentElement.style.setProperty('--curtain', String(Math.max(0, Math.min(1, progress))));
  }

  // ====== Mostrar item ======
  async function showItem(it){
    // textos
    tTop.textContent = it.textTop || '';
    tBottom.textContent = it.textBottom || '';

    // grading y foco proyector
    setVars(it);

    // fondo blur (si hay imagen)
    if (it.src) bgFill.style.backgroundImage = `url(${it.src})`;
    else bgFill.style.backgroundImage = '';

    // bokeh
    if (it.bokeh) spawnBokeh(it.bokeh); else bokeh.innerHTML = '';

    // respiración del proyector
    stage.classList.toggle('breathe', !!it.breathe);

    if (it.type === 'black'){
      img.classList.remove('show'); vid.classList.remove('show');
      clearTexts(); return;
    }

    const blurStart = (it.blurStart ?? 0) + 'px';

    if (it.video){
      img.classList.remove('show'); vid.classList.remove('show'); vid.pause();
      const ok = await setVideoSource(it.video);
      if (ok) vid.classList.add('show'); else clearTexts();
    } else if (it.src){
      vid.pause(); vid.classList.remove('show');
      img.style.setProperty('--blur', blurStart);
      img.src = it.src;
      img.classList.add('show');
      // rack focus
      requestAnimationFrame(()=>{ img.style.setProperty('--blur', '0px'); });
      // Ken Burns
      requestAnimationFrame(()=> applyKenBurns(it.dir));
    }

    if (it.flare) flare();
  }

  // ====== Loop ======
  let currentIndex = -1, rafId = null;
  function step(){
    const now = audio.currentTime;

    // Activa wind-down desde 6:35 (395s)
    if (now >= 395 && !stage.classList.contains('winddown')) setWinddown(true);

    // Fundido final: 7:24 (444s) → 7:40 (460s)
    if (now >= 444){
      const p = Math.min(1, (now - 444) / 16);
      fadeToBlack(p);
    } else {
      fadeToBlack(0);
    }

    // Selección de escena
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


