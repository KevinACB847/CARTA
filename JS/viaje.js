/* ===========================
   VIAJE — JS autónomo (más dinámico)
   =========================== */
(() => {
  const START = 61;   // 1:01
  const END   = 145;  // 2:25

  // DOM
  const audio   = document.getElementById('v-audio');
  const farL    = document.getElementById('v-layer-far');
  const midL    = document.getElementById('v-layer-mid');
  const nearL   = document.getElementById('v-layer-near');
  const cvs     = document.getElementById('v-constellations');
  const ctx     = cvs.getContext('2d');
  const whispersBox = document.getElementById('v-whispers');
  const sparklesBox = document.getElementById('v-sparkles');
  const playBtn = document.getElementById('v-play');

  // Estado
  let W=0, H=0, dpr=1;
  let rafId=null, lastRAF=0, active=false;
  let constellations=[], meteors=[];
  let drawConst=false, speedMult=1;
  let cues=[], lastPulseT=0;

  // Movimiento base (parallax + drift)
  let pointerX=0, pointerY=0;    // -0.5..0.5
  let t0 = performance.now();

  const WHISPERS = ["pequeño cosmos","tú y yo","promesa","destino","una señal","más cerca","late","sueño"];
  const rand=(a,b)=> a + Math.random()*(b-a);

  // ------- Init helpers -------
  function resize(){
    dpr = Math.max(1, devicePixelRatio || 1);
    W = cvs.width  = Math.floor(innerWidth * dpr);
    H = cvs.height = Math.floor(innerHeight * dpr);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height= innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function makeStars(container, count, sizeVar){
    const frag = document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const s = document.createElement('i');
      s.className='v-star';
      s.style.left = (Math.random()*100)+'%';
      s.style.top  = (Math.random()*100)+'%';
      s.style.setProperty('--s', sizeVar);
      s.style.setProperty('--tw', (1.8+Math.random()*2.2).toFixed(2)+'s');
      s.style.setProperty('--tw-min', (0.35+Math.random()*0.2).toFixed(2));
      s.style.setProperty('--tw-max', (0.75+Math.random()*0.2).toFixed(2));
      s.style.setProperty('--o', (0.55+Math.random()*0.35).toFixed(2));
      frag.appendChild(s);
    }
    container.appendChild(frag);
  }

  function buildSky(){
    makeStars(farL,  160, 'var(--v-star-far)');
    makeStars(midL,  120, 'var(--v-star-mid)');
    makeStars(nearL,  80, 'var(--v-star-near)');
  }

  // ------- Base motion: parallax + drift + breathing -------
  function setupParallaxAndDrift(){
    // parallax (puntero)
    function onMove(e){
      const p = e.touches ? e.touches[0] : e;
      pointerX = (p.clientX/innerWidth)  - .5;
      pointerY = (p.clientY/innerHeight) - .5;
    }
    addEventListener('mousemove', onMove, {passive:true});
    addEventListener('touchmove', onMove, {passive:true});
  }

  function applyLayerTransforms(timeMs){
    // Drift sinusoidal independiente por capa (no depende del puntero)
    const t = (timeMs - t0) / 1000;
    const df = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-far'))  || 7;
    const dm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-mid'))  || 12;
    const dn = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-near')) || 18;

    const af = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-drift-far'))  || 2;
    const am = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-drift-mid'))  || 4;
    const an = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-drift-near')) || 7;

    const fx = Math.sin(t/9.0)*af,  fy = Math.cos(t/11.0)*af;
    const mx = Math.sin(t/7.2)*am,  my = Math.cos(t/8.6)*am;
    const nx = Math.sin(t/5.5)*an,  ny = Math.cos(t/6.3)*an;

    farL.style.transform  = `translate3d(${pointerX*df + fx}px, ${pointerY*df + fy}px,0)`;
    midL.style.transform  = `translate3d(${pointerX*dm + mx}px, ${pointerY*dm + my}px,0)`;
    nearL.style.transform = `translate3d(${pointerX*dn + nx}px, ${pointerY*dn + ny}px,0)`;

    // Breathing global (zoom + brillo) — muy suave
    const breath = 0.01 + (Math.sin(t/6.0)+1)*0.005;          // 0.01..0.02
    const bright = 1.00 + (Math.sin(t/7.0)+1)*0.02;           // 1.00..1.04
    document.documentElement.style.setProperty('--v-zoom',   (1.00 + breath).toFixed(3));
    document.documentElement.style.setProperty('--v-bright', bright.toFixed(3));
  }

  // ------- whispers / sparkles / flashes -------
  function spawnWhisper(text){
    const w = document.createElement('div');
    w.className='v-whisper';
    w.textContent = text || WHISPERS[(Math.random()*WHISPERS.length)|0];
    w.style.left = (10+Math.random()*80) + '%';
    w.style.top  = (20+Math.random()*60) + '%';
    whispersBox.appendChild(w);
    w.addEventListener('animationend', ()=> w.remove());
  }

  function spawnSparkle(x,y){
    const sp = document.createElement('div');
    sp.className='v-sparkle';
    sp.style.left = x+'px'; sp.style.top = y+'px';
    sparklesBox.appendChild(sp);
    sp.addEventListener('animationend', ()=> sp.remove());
  }
  function cornerSparkles(){
    const pad=28;
    spawnSparkle(pad,pad);
    spawnSparkle(innerWidth-pad,pad);
    spawnSparkle(pad,innerHeight-pad);
    spawnSparkle(innerWidth-pad,innerHeight-pad);
  }
  addEventListener('click', e=>{
    const p=e.touches?e.touches[0]:e;
    spawnSparkle(p.clientX,p.clientY);
  }, {passive:true});

  function microFlash(){
    const el=document.createElement('div');
    el.className='v-flash'; document.body.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }

  // ------- constellations -------
  function buildConstellations(){
    const R = Math.min(innerWidth, innerHeight);
    const cfg = [
      { cx: innerWidth*0.25, cy: innerHeight*0.35, spread: R*0.25, n: 6 },
      { cx: innerWidth*0.62, cy: innerHeight*0.30, spread: R*0.22, n: 5 },
      { cx: innerWidth*0.45, cy: innerHeight*0.62, spread: R*0.28, n: 7 }
    ];
    const randPt=(cx,cy,s)=>[cx+(Math.random()-0.5)*s, cy+(Math.random()-0.5)*s];
    constellations = cfg.map(({cx,cy,spread,n})=>{
      const pts = Array.from({length:n}, ()=>randPt(cx,cy,spread));
      let segs=[], total=0;
      for(let i=0;i<pts.length-1;i++){
        const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
        const len=Math.hypot(x2-x1,y2-y1); segs.push({x1,y1,x2,y2,len}); total+=len;
      }
      return {segs, total, progress:0};
    });
  }

  function drawConstellations(dt){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    ctx.save();
    ctx.globalAlpha=.78; ctx.lineWidth=1.1; ctx.strokeStyle='rgba(200,210,255,0.72)';
    const speed = .72; // px/ms (más rápido que antes)
    for(const c of constellations){
      c.progress = Math.min(c.progress + speed*dt, c.total);
      let acc=0;
      for(const s of c.segs){
        const remain = c.progress - acc;
        if(remain<=0) break;
        const r = Math.min(1, remain/s.len);
        const x = s.x1 + (s.x2-s.x1)*r;
        const y = s.y1 + (s.y2-s.y1)*r;
        ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(x,y); ctx.stroke();
        acc += s.len;
      }
    }
    ctx.restore();
  }

  // ------- meteors (mini-fugaces) -------
  function spawnMeteor(o={}){
    const side = Math.random()<.5 ? 'L' : 'R';
    const y = rand(innerHeight*.15, innerHeight*.85);
    const dir = side==='L'?1:-1;
    const speed = o.speed || rand(480,700);
    const ang   = o.angle || (dir>0? rand(-.38,-.18): rand(.18,.38));
    const vx=Math.cos(ang)*speed*dir, vy=Math.sin(ang)*speed;
    const x0= side==='L' ? -40 : innerWidth+40;
    meteors.push({x:x0,y, vx,vy, life:.65, alpha:.95});
  }
  function spawnCrossMeteors(){ spawnMeteor({angle:-.28,speed:620}); spawnMeteor({angle:.28,speed:620}); }
  function spawnFanMeteors(){ for(let i=0;i<3;i++) spawnMeteor({angle:rand(-.36,-.18),speed:rand(520,700)}) }

  function drawMeteors(dt){
    const t=dt/1000;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const m of meteors){
      const x2=m.x + m.vx*t*.06, y2=m.y + m.vy*t*.06;
      ctx.strokeStyle=`rgba(255,255,255,${m.alpha})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(x2,y2); ctx.stroke();
      m.x += m.vx*t; m.y += m.vy*t; m.life -= t; m.alpha = Math.max(0, m.life*1.2);
    }
    ctx.restore();
    meteors = meteors.filter(m=> m.life>0 && m.x>-120 && m.x<innerWidth+120 && m.y>-120 && m.y<innerHeight+120);
  }

  // ------- velocidad estrellas -------
  function setStarSpeed(mult){
    speedMult = mult;
    document.querySelectorAll('.v-star').forEach(s=>{
      if(!s._base){ s._base = parseFloat(getComputedStyle(s).animationDuration) || 2.8; }
      const newDur = Math.max(1.2, s._base / speedMult);
      s.style.animationDuration = newDur + 's';
    });
  }

  // ------- Cues + Heartbeat (nunca >3s sin evento) -------
  function makeCues(){
    cues=[];
    const add=(t,fn)=> cues.push({t,fn,done:false});

    // Coreografía principal (marcas musicales)
    add(START + 0.5, ()=>{ drawConst=true; });
    add(START + 5,   ()=> spawnWhisper());            // 1:06
    add(START + 11,  ()=> microFlash());              // 1:12
    add(START + 17,  ()=> spawnWhisper());            // 1:18
    add(START + 23,  ()=> spawnMeteor());             // 1:24
    add(START + 27,  ()=> { spawnMeteor(); setStarSpeed(1.07);} ); // 1:28

    add(START + 35,  ()=> cornerSparkles());          // 1:36
    add(START + 41,  ()=> spawnWhisper());            // 1:42
    add(START + 47,  ()=> microFlash());              // 1:48
    add(START + 49,  ()=> setStarSpeed(1.16));        // 1:50
    add(START + 55,  ()=> spawnCrossMeteors());       // 1:56

    add(START + 63,  ()=> { document.body.classList.add('v-ramp-1'); microFlash(); }); // 2:04
    add(START + 69,  ()=> spawnWhisper());            // 2:10
    add(START + 75,  ()=> cornerSparkles());          // 2:16
    add(START + 77,  ()=> spawnFanMeteors());         // 2:18
    add(START + 79,  ()=> document.body.classList.add('v-preclimax'));                // 2:20
    add(START + 82,  ()=> microFlash());              // 2:23
  }

  function runCues(t){
    for(const c of cues){ if(!c.done && t>=c.t){ try{c.fn();}catch(e){console.warn(e)} c.done=true; lastPulseT=t; } }
    // Heartbeat: si pasaron >3.2s sin nada, lanzamos un mini evento
    const span = t - lastPulseT;
    const progress = Math.min(1, (t-START) / (END-START)); // 0 → 1
    const maxGap = 3.2 - 1.0*progress; // se acelera un poco hacia el final
    if(span >= maxGap){
      // Elegir evento suave aleatorio
      const r = Math.random();
      if(r < 0.34) spawnWhisper();
      else if(r < 0.68) spawnMeteor({speed: rand(480,620)});
      else microFlash();
      lastPulseT = t;
    }
  }

  // ------- RAF loop -------
  function raf(){
    const now=performance.now(); const dt= lastRAF? (now-lastRAF):16.6; lastRAF=now;
    applyLayerTransforms(now);
    if(drawConst) drawConstellations(dt); else ctx.clearRect(0,0,innerWidth,innerHeight);
    if(meteors.length) drawMeteors(dt);
    rafId = requestAnimationFrame(raf);
  }

  // ------- start -------
  function start(){
    if(active) return;
    resize(); buildSky(); buildConstellations(); setupParallaxAndDrift(); makeCues();
    document.body.classList.add('v-active');
    audio.addEventListener('timeupdate', onTimeUpdate);
    addEventListener('resize', onResize);
    lastRAF=performance.now(); raf(); active=true;

    // Adaptar si el usuario cae tarde
    if(audio.currentTime>=START+49) setStarSpeed(1.16);
    else if(audio.currentTime>=START+27) setStarSpeed(1.07);
    lastPulseT = audio.currentTime || 0;
    runCues(audio.currentTime || 0);
  }

  function onTimeUpdate(){ runCues(audio.currentTime || 0); }
  function onResize(){ resize(); buildConstellations(); }

  // Botón: inicia desde 1:01
  document.addEventListener('DOMContentLoaded', ()=>{
    resize();
    playBtn?.addEventListener('click', async ()=>{
      try{ audio.currentTime = START; await audio.play(); }catch(e){}
      start();
    });
  });

})();

