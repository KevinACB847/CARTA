/* ===========================
   La La Land — Epílogo (JS)
   =========================== */
(() => {
  const $ = s => document.querySelector(s);
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

  // TIMELINE (segundos desde 0). Coloca aquí tus rutas exactas.
  const PLAN = [
    { start:340, dur:4,  type:'black' },

    { start:344, dur:14, src:'IMG/01-terraza-luces.jpg',
      textTop:'Nuestro pequeño cine.', dir:'kb-up-right', breathe:true },

    { start:358, dur:12, src:'IMG/02-manos-pizza.jpg',
      textBottom:'Donde fuimos nosotros.', dir:'kb-zoom-in', breathe:true },

    { start:370, dur:12, src:'IMG/03-bus-ventana.jpg', dir:'kb-up-left' },

    { start:382, dur:12, src:'IMG/04-espejos-beso.jpg', dir:'kb-down-right', flare:true },

    { start:394, dur:12, src:'IMG/05-invernadero-beso.jpg', dir:'kb-zoom-in' },

    { start:406, dur:10, src:'IMG/06-beso-mejilla-jean.jpg',
      textBottom:'Por los planes que soñamos.', dir:'kb-down-left' },

    // Video con fallback (MP4 → WEBM si lo subes)
    { start:416, dur:14, video:['IMG/07-video-vangogh.mp4','IMG/07-video-vangogh.webm'],
      textBottom:'Contigo todo fue posible.' },

    { start:430, dur:14, src:'IMG/08-cafe-balcon.jpg', dir:'kb-up-right' },

    { start:444, dur:16, src:'IMG/09-selfie-celeste.jpg',
      textTop:'Feliz cumpleaños, amor.', textBottom:'Para ti, que eres mi estrella ✨', dir:'kb-zoom-in' }
  ];

  // PLAY/PAUSE + salto a 5:40
  let jumped=false;
  playBtn.addEventListener('click', ()=>{
    if(audio.paused){
      audio.play().then(()=>{
        if(!jumped){ audio.currentTime=340; jumped=true; }
        playBtn.textContent='⏸'; stage.classList.add('beam');
      }).catch(()=>{ playBtn.textContent='▶︎'; });
    }else{
      audio.pause(); playBtn.textContent='▶︎';
    }
  });

  // VIDEO móvil
  vid.setAttribute('playsinline',''); vid.muted=true; vid.preload='auto';
  vid.addEventListener('error', e => console.error('Error VIDEO:', vid.src, e));

  // Precarga imágenes
  PLAN.forEach(it => { if(it.src){ const p=new Image(); p.src=it.src; } });

  // BOKEH generador
  function spawnBokeh(n=6){
    bokeh.innerHTML='';
    const rect = bokeh.getBoundingClientRect();
    for(let i=0;i<n;i++){
      const d = document.createElement('div');
      d.className='bokeh-dot';
      d.style.left = Math.random()*rect.width +'px';
      d.style.top  = (rect.height + Math.random()*60) +'px';
      d.style.animationDuration = (8+Math.random()*4)+'s';
      d.style.opacity = 0;
      bokeh.appendChild(d);
      requestAnimationFrame(()=>{ d.style.opacity = .9; });
    }
  }

  // Utilidades
  function clearTexts(){ tTop.textContent=''; tBottom.textContent=''; }
  function makeFlare(){
    const f=document.createElement('div'); f.className='flare';
    screen.appendChild(f); f.addEventListener('animationend',()=>f.remove(),{once:true});
  }
  function applyEffects(it){
    // respiración del proyector en olas
    stage.classList.toggle('breathe', !!it.breathe);
    // Ken Burns direccional
    img.classList.remove('kb-zoom-in','kb-up-left','kb-up-right','kb-down-left','kb-down-right');
    if(it.dir && img.classList.contains('show')) img.classList.add(it.dir);
    if(it.flare) makeFlare();
    // bokeh suave sólo en algunas (no en todas)
    if(it.breathe || it.video) spawnBokeh(8); else bokeh.innerHTML='';
  }

  async function setVideoSource(list){
    const sources = Array.isArray(list) ? list : [list];
    for(const src of sources){
      try{
        if(vid.src !== new URL(src, location.href).href) vid.src = src;
        vid.currentTime = 0;
        await vid.play();
        return true;
      }catch(e){
        console.warn('No se pudo reproducir', src, e);
      }
    }
    return false;
  }

  async function showItem(it){
    tTop.textContent = it.textTop || '';
    tBottom.textContent = it.textBottom || '';

    // Fondo blur-fill con la misma fuente (para profundidad)
    if(it.src){ bgFill.style.backgroundImage = `url(${it.src})`; }
    if(it.video){ bgFill.style.backgroundImage = ''; }

    if(it.type==='black'){
      img.classList.remove('show'); vid.classList.remove('show'); clearTexts(); bokeh.innerHTML=''; return;
    }

    if(it.video){
      img.classList.remove('show'); vid.classList.remove('show'); vid.pause();
      const ok = await setVideoSource(it.video);
      if(ok){ vid.classList.add('show'); }
      else { console.error('Video no disponible.'); clearTexts(); }
    }else if(it.src){
      vid.pause(); vid.classList.remove('show');
      img.src = it.src; img.classList.add('show');
    }
    applyEffects(it);
  }

  // Loop
  let currentIndex=-1, rafId=null;
  function step(){
    const now = audio.currentTime;
    const i = PLAN.findIndex(it => now >= it.start-0.05 && now < it.start+it.dur);
    if(i!==-1 && i!==currentIndex){ currentIndex=i; showItem(PLAN[i]); }
    rafId = requestAnimationFrame(step);
  }

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ cancelAnimationFrame(rafId); rafId=null; }
    else if(!rafId){ rafId = requestAnimationFrame(step); }
  });
  audio.addEventListener('loadedmetadata', ()=>{ rafId = requestAnimationFrame(step); });
})();


  audio.addEventListener('loadedmetadata', () => {
    rafId = requestAnimationFrame(step);
  });
})();

