/* =========================================
   VIAJE MÁGICO — JS (1:01–2:25)
   - Reutiliza el <audio> existente (id="score" si lo tienes, o el primer <audio>)
   - No hace nada hasta que llames: window.Viaje.start()
   - Añade/usa body.phase--viaje y respeta tu intro (no crea otro audio)
   ========================================= */

(function () {
  const PHASE_START = 61;   // 1:01
  const PHASE_END   = 145;  // 2:25 (preparado para clímax)
  const WHISPERS = ["pequeño cosmos", "tú y yo", "promesa", "destino", "una señal", "más cerca", "late", "sueño"];

  // ---- estado ----
  let audio, rafId = null, lastTs = 0, active = false;
  let sky, layerFar, layerMid, layerNear;
  let canvas, ctx, W=0, H=0;
  let whispersBox, sparklesBox;
  let meteors = [];
  let constellations = [];
  let drawConst = false;
  let speedMult = 1.0;
  let cues = [];
  let onMoveHandler, onClickHandler, timeUpdateHandler, resizeHandler;

  // ===== util =====
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const rand = (a,b)=> a + Math.random()*(b-a);

  function getAudio() {
    return qs('#score') || qs('audio');
  }

  function ensureDom() {
    sky = qs('#sky') || (()=>{ const d=document.createElement('div'); d.id='sky'; document.body.appendChild(d); return d; })();
    layerFar  = qs('#layer-far')  || (()=>{ const d=document.createElement('div'); d.className='layer far';  d.id='layer-far';  sky.appendChild(d); return d; })();
    layerMid  = qs('#layer-mid')  || (()=>{ const d=document.createElement('div'); d.className='layer mid';  d.id='layer-mid';  sky.appendChild(d); return d; })();
    layerNear = qs('#layer-near') || (()=>{ const d=document.createElement('div'); d.className='layer near'; d.id='layer-near'; sky.appendChild(d); return d; })();

    canvas = qs('#constellations') || (()=>{ const c=document.createElement('canvas'); c.id='constellations'; sky.appendChild(c); return c; })();
    ctx = canvas.getContext('2d');

    whispersBox = qs('#whispers') || (()=>{ const d=document.createElement('div'); d.id='whispers'; sky.appendChild(d); return d; })();
    sparklesBox = qs('#sparkles') || (()=>{ const d=document.createElement('div'); d.id='sparkles'; document.body.appendChild(d); return d; })();
  }

  function resize() {
    const dpr = Math.max(1, devicePixelRatio || 1);
    W = canvas.width  = Math.floor(innerWidth * dpr);
    H = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ===== parallax =====
  function setupParallax() {
    let tx=0, ty=0;
    onMoveHandler = (e)=>{
      const p = e.touches ? e.touches[0] : e;
      const nx = (p.clientX / innerWidth)  - .5;
      const ny = (p.clientY / innerHeight) - .5;
      const df = parseFloat(getComputedStyle(document.body).getPropertyValue('--vj-depth-far'))  || 7;
      const dm = parseFloat(getComputedStyle(document.body).getPropertyValue('--vj-depth-mid'))  || 12;
      const dn = parseFloat(getComputedStyle(document.body).getPropertyValue('--vj-depth-near')) || 18;
      layerFar.style.transform  = `translate3d(${nx*df}px, ${ny*df}px, 0)`;
      layerMid.style.transform  = `translate3d(${nx*dm}px, ${ny*dm}px, 0)`;
      layerNear.style.transform = `translate3d(${nx*dn}px, ${ny*dn}px, 0)`;
    };
    addEventListener('mousemove', onMoveHandler, {passive:true});
    addEventListener('touchmove', onMoveHandler, {passive:true});
  }

  // ===== sparkles (tap/click) =====
  function setupSparkles(){
    onClickHandler = (e)=>{
      const p = e.touches ? e.touches[0] : e;
      spawnSparkle(p.clientX, p.clientY);
    };
    addEventListener('click', onClickHandler);
    addEventListener('touchstart', onClickHandler, {passive:true});
  }
  function spawnSparkle(x,y){
    const sp = document.createElement('div');
    sp.className='sparkle';
    sp.style.left = x+'px';
    sp.style.top  = y+'px';
    sparklesBox.appendChild(sp);
    sp.addEventListener('animationend', ()=> sp.remove());
  }
  function cornerSparkles(){
    const pad = 28;
    spawnSparkle(pad, pad);
    spawnSparkle(innerWidth-pad, pad);
    spawnSparkle(pad, innerHeight-pad);
    spawnSparkle(innerWidth-pad, innerHeight-pad);
  }

  // ===== constelaciones (canvas) =====
  function buildConstellations(){
    const R = Math.min(innerWidth, innerHeight);
    const cfg = [
      { cx: innerWidth*0.25, cy: innerHeight*0.35, spread: R*0.25, n: 6 },
      { cx: innerWidth*0.62, cy: innerHeight*0.30, spread: R*0.22, n: 5 },
      { cx: innerWidth*0.45, cy: innerHeight*0.62, spread: R*0.28, n: 7 }
    ];
    const randPt = (cx,cy,s)=> [cx+(Math.random()-0.5)*s, cy+(Math.random()-0.5)*s];
    constellations = cfg.map(({cx,cy,spread,n})=>{
      const pts = Array.from({length:n}, ()=>randPt(cx,cy,spread));
      // precomputar longitudes
      let segs = [];
      let total = 0;
      for(let i=0;i<pts.length-1;i++){
        const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
        const len = Math.hypot(x2-x1,y2-y1);
        segs.push({x1,y1,x2,y2,len});
        total += len;
      }
      return { pts, segs, progress: 0, total };
    });
  }

  function drawConstellations(dt){
    // fondo limpio (no trail)
    ctx.clearRect(0,0,innerWidth,innerHeight);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(200,210,255,0.7)';

    const speed = 0.6; // px/ms
    constellations.forEach(c=>{
      c.progress = Math.min(c.progress + speed*dt, c.total);
      let acc = 0;
      for(const s of c.segs){
        const remain = c.progress - acc;
        if(remain <= 0) break;
        const r = Math.min(1, remain/s.len);
        const x = s.x1 + (s.x2 - s.x1)*r;
        const y = s.y1 + (s.y2 - s.y1)*r;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(x, y);
        ctx.stroke();
        acc += s.len;
      }
    });
    ctx.restore();
  }

  // ===== meteors (mini-fugaces) en canvas =====
  function spawnMeteor(opts={}){
    const side = Math.random() < 0.5 ? 'L' : 'R';
    const y = rand(innerHeight*0.15, innerHeight*0.85);
    const dir = side==='L' ? 1 : -1;
    const speed = opts.speed || rand(420, 620); // px/s
    const ang   = opts.angle || (dir>0? rand(-0.4,-0.2): rand(0.2,0.4)); // radianes
    const vx = Math.cos(ang) * speed * dir;
    const vy = Math.sin(ang) * speed;
    const x0 = side==='L' ? -40 : innerWidth+40;
    meteors.push({x: x0, y, vx, vy, life: 0.6, alpha: 0.9});
  }
  function spawnCrossMeteors(){
    spawnMeteor({angle: -0.28, speed: 560});
    spawnMeteor({angle:  0.28, speed: 560});
  }
  function spawnFanMeteors(){
    for(let i=0;i<3;i++) spawnMeteor({angle: rand(-0.35, -0.18), speed: rand(460,620)});
  }
  function drawMeteors(dt){
    const t = dt/1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    meteors.forEach(m=>{
      const x2 = m.x + m.vx*t*0.06;
      const y2 = m.y + m.vy*t*0.06;
      ctx.strokeStyle = `rgba(255,255,255,${m.alpha})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      m.x += m.vx*t;
      m.y += m.vy*t;
      m.life -= t;
      m.alpha = Math.max(0, m.life*1.2);
    });
    ctx.restore();
    meteors = meteors.filter(m=> m.life>0 && m.x>-80 && m.x<innerWidth+80 && m.y>-80 && m.y<innerHeight+80);
  }

  // ===== whispers =====
  function spawnWhisper(text){
    const w = document.createElement('div');
    w.className = 'whisper';
    w.textContent = text || WHISPERS[(Math.random()*WHISPERS.length)|0];
    w.style.left = (10 + Math.random()*80) + '%';
    w.style.top  = (20 + Math.random()*60) + '%';
    whispersBox.appendChild(w);
    w.addEventListener('animationend', ()=> w.remove());
  }

  // ===== flashes / ramps =====
  function microFlash(){
    const el = document.createElement('div');
    el.className = 'vj-flash';
    document.body.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }
  function blinkConstellations(){
    canvas.classList.add('vj-blink');
    setTimeout(()=> canvas.classList.remove('vj-blink'), 520);
  }

  // ===== velocidad estrellas =====
  function setStarSpeed(mult){
    speedMult = mult;
    qsa('.star').forEach(s=>{
      const cs = getComputedStyle(s);
      // duración base desde computed (s)
      let base = parseFloat(cs.animationDuration) || 2.8;
      if(!s._baseTw) s._baseTw = base;
      const newDur = Math.max(1.4, s._baseTw / speedMult);
      s.style.animationDuration = newDur + 's';
    });
  }

  // ===== cues temporales =====
  function makeCues(){
    // Limpia
    cues = [];

    // util para añadir cue "una sola vez"
    const once = (absT, fn)=> cues.push({t: absT, fn, done:false});

    // ---- coreografía (sensación + ritmo) ----
    // Entrada viaje
    once(PHASE_START + 0.5, ()=>{ drawConst = true; });         // empezar constelaciones
    once(PHASE_START + 5,   ()=> spawnWhisper());               // 1:06
    once(PHASE_START + 11,  ()=> microFlash());                 // 1:12
    once(PHASE_START + 17,  ()=> blinkConstellations());        // 1:18 (trazo/realce)
    once(PHASE_START + 23,  ()=> spawnMeteor());                // 1:24
    once(PHASE_START + 27,  ()=> spawnMeteor());                // 1:28/1:30 (ver abajo +5%)

    // primer escalón velocidad (~1:28)
    once(PHASE_START + 27,  ()=> setStarSpeed(1.05));

    once(PHASE_START + 35,  ()=> cornerSparkles());             // 1:36
    once(PHASE_START + 41,  ()=> spawnWhisper());               // 1:42
    once(PHASE_START + 47,  ()=> microFlash());                 // 1:48

    // segundo escalón velocidad (~1:50)
    once(PHASE_START + 49,  ()=> setStarSpeed(1.13));           // total ~+13%

    once(PHASE_START + 51,  ()=> microFlash());                 // 1:52
    once(PHASE_START + 55,  ()=> spawnCrossMeteors());          // 1:56

    // borde del clímax
    once(PHASE_START + 63,  ()=> { document.body.classList.add('body-ramp-1'); microFlash(); }); // 2:04
    once(PHASE_START + 69,  ()=> spawnWhisper());               // 2:10
    once(PHASE_START + 75,  ()=> cornerSparkles());             // 2:16 (eco)
    once(PHASE_START + 77,  ()=> spawnFanMeteors());            // 2:18 (abanico)
    once(PHASE_START + 79,  ()=> { document.body.classList.add('vj-preclimax'); });              // 2:20
    once(PHASE_START + 82,  ()=> microFlash());                 // 2:23

    // cierre del viaje (no cortamos música; dejamos listo el blackout del clímax)
    once(PHASE_END, ()=> {
      // aquí NO hacemos blackout; solo dejamos la escena preparada
      // (tu módulo del clímax hará el flash/blackout exacto y el salto de escena)
    });
  }

  function runCues(t){
    for(const c of cues){
      if(!c.done && t >= c.t){ try{ c.fn(); }catch(e){ console.warn(e);} c.done = true; }
    }
  }

  // ===== bucle de animación =====
  function raf(){
    const now = performance.now();
    const dt = lastTs ? (now - lastTs) : 16.6;
    lastTs = now;

    // canvas
    if(drawConst){
      drawConstellations(dt);
    } else {
      ctx.clearRect(0,0,innerWidth,innerHeight);
    }
    if(meteors.length) drawMeteors(dt);

    rafId = requestAnimationFrame(raf);
  }

  // ===== API =====
  function start() {
    if(active) return;
    audio = getAudio();
    if(!audio){ console.warn('[Viaje] No se encontró <audio>.'); }

    ensureDom();
    resize();
    buildConstellations();
    setupParallax();
    setupSparkles();
    makeCues();

    // activamos estado visual del viaje
    document.body.classList.add('phase--viaje');

    // listeners
    timeUpdateHandler = ()=> { if(audio) runCues(audio.currentTime); };
    resizeHandler = ()=> { resize(); buildConstellations(); };
    audio && audio.addEventListener('timeupdate', timeUpdateHandler);
    addEventListener('resize', resizeHandler);

    // si entramos tarde (seek), aplicar catch-up básico
    if(audio && audio.currentTime){
      // ajustar velocidad acorde al momento
      if(audio.currentTime >= PHASE_START + 49)      setStarSpeed(1.13);
      else if(audio.currentTime >= PHASE_START + 27) setStarSpeed(1.05);
      runCues(audio.currentTime);
    }

    lastTs = performance.now();
    raf();
    active = true;
  }

  function stop() {
    if(!active) return;
    cancelAnimationFrame(rafId); rafId=null;
    removeEventListener('mousemove', onMoveHandler);
    removeEventListener('touchmove', onMoveHandler);
    removeEventListener('click', onClickHandler);
    removeEventListener('touchstart', onClickHandler);
    removeEventListener('resize', resizeHandler);
    audio && audio.removeEventListener('timeupdate', timeUpdateHandler);
    // limpiar visual suave (dejamos el sky; tu intro decide qué hacer con él)
    document.body.classList.remove('phase--viaje','body-ramp-1','body-ramp-2','vj-preclimax');
    meteors = [];
    drawConst = false;
    active = false;
  }

  // auto-arranque solo si ya existe la clase (útil para pruebas visuales)
  function maybeAutoStart(){
    if(document.body.classList.contains('phase--viaje')) start();
  }

  // expone API
  window.Viaje = window.Viaje || {};
  window.Viaje.start = start;
  window.Viaje.stop  = stop;
  window.Viaje.isActive = ()=> active;

  // intento de autostart si el body ya viene con la clase (testing)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', maybeAutoStart);
  } else {
    maybeAutoStart();
  }

})();
