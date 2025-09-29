/* ===========================
   VIAJE — JS autónomo (dinámico)
   =========================== */
(() => {
  const START = 61;   // 1:01
  const END   = 145;  // 2:25

  // DOM
  const audio   = document.getElementById('v-audio');
  const farL    = document.getElementById('v-layer-far');
  const midL    = document.getElementById('v-layer-mid');
  const nearL   = document.getElementById('v-layer-near');
  const glows   = document.getElementById('v-glows');
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
  let cues=[], lastPulseT=0, lastPulseMs=0, pulseGapMs=2200; // heartbeat
  let pointerX=0, pointerY=0, lastPX=0, lastPY=0, lastMoveT=0, boostTO=null;

  // helpers
  const WHISPERS = ["pequeño cosmos","tú y yo","promesa","destino","una señal","más cerca","late","sueño"];
  const rand=(a,b)=> a + Math.random()*(b-a);
  const clamp=(v,a,b)=> Math.max(a, Math.min(b,v));

  // ------- Tamaño / base -------
  function resize(){
    dpr = Math.max(1, devicePixelRatio || 1);
    W = cvs.width  = Math.floor(innerWidth * dpr);
    H = cvs.height = Math.floor(innerHeight * dpr);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height= innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ------- Estrellas -------
  function makeStars(container, count, sizeVar){
    const frag = document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const s = document.createElement('i');
      s.className='v-star';
      s.style.left = (Math.random()*100)+'%';
      s.style.top  = (Math.random()*100)+'%';
      s.style.setProperty('--s', sizeVar);
      s.style.setProperty('--tw', (1.6+Math.random()*2.2).toFixed(2)+'s');
      s.style.setProperty('--tw-min', (0.35+Math.random()*0.2).toFixed(2));
      s.style.setProperty('--tw-max', (0.85+Math.random()*0.1).toFixed(2));
      s.style.setProperty('--o', (0.6+Math.random()*0.35).toFixed(2));
      frag.appendChild(s);
    }
    container.appendChild(frag);
  }
  function buildSky(){
    makeStars(farL,  200, 'var(--v-star-far)');
    makeStars(midL,  150, 'var(--v-star-mid)');
    makeStars(nearL, 110, 'var(--v-star-near)');
  }

  // ------- Glows / nebulosas -------
  const glowEls=[];
  function buildGlows(){
    glows.innerHTML='';
    for(let i=0;i<3;i++){
      const g=document.createElement('div');
      g.className='v-glow';
      glows.appendChild(g);
      glowEls.push(g);
    }
  }
  function moveGlows(t){
    // órbitas suaves
    const r1=28, r2=22, r3=26; // vmin
    const cx=innerWidth*0.5, cy=innerHeight*0.55;
    const x1=cx + Math.cos(t/12)*r1*innerWidth/100;
    const y1=cy + Math.sin(t/10)*r1*innerHeight/100;
    const x2=cx + Math.cos(t/9 + 1.3)*r2*innerWidth/100;
    const y2=cy + Math.sin(t/8 + 0.6)*r2*innerHeight/100;
    const x3=cx + Math.cos(t/7 - 0.7)*r3*innerWidth/100;
    const y3=cy + Math.sin(t/11- 0.4)*r3*innerHeight/100;
    glowEls[0].style.left = x1+'px'; glowEls[0].style.top  = y1+'px';
    glowEls[1].style.left = x2+'px'; glowEls[1].style.top  = y2+'px';
    glowEls[2].style.left = x3+'px'; glowEls[2].style.top  = y3+'px';
  }

  // ------- Parallax + drift + breathing + roll -------
  let t0=performance.now();
  function setupParallax(){
    function onMove(e){
      const p = e.touches ? e.touches[0] : e;
      const nx = (p.clientX/innerWidth)  - .5;
      const ny = (p.clientY/innerHeight) - .5;
      const now = performance.now();
      const vx = (nx - lastPX) / Math.max(0.016,(now-lastMoveT)/1000);
      const vy = (ny - lastPY) / Math.max(0.016,(now-lastMoveT)/1000);
      lastPX=nx; lastPY=ny; lastMoveT=now;

      // boost si mueves rápido
      const vmag = Math.hypot(vx,vy);
      if(vmag > 1.8) boostStars(1.28, 800);

      pointerX = nx; pointerY = ny;
    }
    addEventListener('mousemove', onMove, {passive:true});
    addEventListener('touchmove', onMove, {passive:true});
  }

  function applyBaseMotion(now){
    const t = (now - t0)/1000;

    const depth = (k)=> parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)) || 0;
    const df=depth('--v-depth-far'), dm=depth('--v-depth-mid'), dn=depth('--v-depth-near');
    const af=depth('--v-drift-far'), am=depth('--v-drift-mid'), an=depth('--v-drift-near');

    const fx = Math.sin(t/9.0)*af,  fy = Math.cos(t/11.0)*af;
    const mx = Math.sin(t/7.2)*am,  my = Math.cos(t/8.6)*am;
    const nx = Math.sin(t/5.5)*an,  ny = Math.cos(t/6.3)*an;

    farL.style.transform  = `translate3d(${pointerX*df + fx}px, ${pointerY*df + fy}px,0)`;
    midL.style.transform  = `translate3d(${pointerX*dm + mx}px, ${pointerY*dm + my}px,0)`;
    nearL.style.transform = `translate3d(${pointerX*dn + nx}px, ${pointerY*dn + ny}px,0)`;

    // breathing (zoom/bright) y roll (cámara)
    const breath = 0.012 + (Math.sin(t/6.0)+1)*0.006;      // 0.012..0.024
    const bright = 1.00 + (Math.sin(t/7.0)+1)*0.022;       // 1.00..1.044
    const roll   = (Math.sin(t/8.5))*0.45;                 // -0.45..0.45 deg
    document.documentElement.style.setProperty('--v-zoom',  (1.00+breath).toFixed(3));
    document.documentElement.style.setProperty('--v-bright', bright.toFixed(3));
    document.documentElement.style.setProperty('--v-roll',   roll.toFixed(2)+'deg');

    // glows
    moveGlows(t);
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
  addEventListener('click', e=>{
    const p=e.touches?e.touches[0]:e;
    spawnSparkle(p.clientX,p.clientY);
  }, {passive:true});

  function microFlash(){
    const el=document.createElement('div');
    el.className='v-flash'; document.body.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }

  // ------- constelaciones -------
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
    ctx.globalAlpha=.9; ctx.lineWidth=1.4; ctx.strokeStyle='rgba(200,210,255,0.78)';
    const speed = 1.20; // px/ms (más rápido)
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

  // ------- meteors -------
  function spawnMeteor(o={}){
    const side = Math.random()<.5 ? 'L' : 'R';
    const y = rand(innerHeight*.12, innerHeight*.88);
    const dir = side==='L'?1:-1;
    const speed = o.speed || rand(540,760);
    const ang   = o.angle || (dir>0? rand(-.36,-.20): rand(.20,.36));
    const vx=Math.cos(ang)*speed*dir, vy=Math.sin(ang)*speed;
    const x0= side==='L' ? -60 : innerWidth+60;
    meteors.push({x:x0,y, vx,vy, life:.85, alpha:1});
  }
  function spawnCrossMeteors(){ spawnMeteor({angle:-.28,speed:700}); spawnMeteor({angle:.28,speed:700}); }
  function spawnFanMeteors(){ for(let i=0;i<3;i++) spawnMeteor({angle:rand(-.34,-.18),speed:rand(580,760)}) }
  function drawMeteors(dt){
    const t=dt/1000;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const m of meteors){
      const x2=m.x + m.vx*t*.08, y2=m.y + m.vy*t*.08;
      ctx.strokeStyle=`rgba(255,255,255,${m.alpha})`; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(x2,y2); ctx.stroke();
      m.x += m.vx*t; m.y += m.vy*t; m.life -= t;
      m.alpha = Math.max(0, m.life*1.1);
    }
    ctx.restore();
    meteors = meteors.filter(m=> m.life>0 && m.x>-160 && m.x<innerWidth+160 && m.y>-160 && m.y<innerHeight+160);
  }

  // ------- velocidad estrellas / boost -------
  function setStarSpeed(mult){
    speedMult = mult;
    document.querySelectorAll('.v-star').forEach(s=>{
      if(!s._base){ s._base = parseFloat(getComputedStyle(s).animationDuration) || 2.4; }
      const newDur = Math.max(1.0, s._base / speedMult);
      s.style.animationDuration = newDur + 's';
    });
  }
  function boostStars(mult=1.25, ms=700){
    setStarSpeed(mult);
    clearTimeout(boostTO);
    boostTO = setTimeout(()=> setStarSpeed(mult>1.16?1.16:1.07), ms);
  }

  // ------- cues + heartbeat (siempre hay algo) -------
  function makeCues(){
    cues=[];
    const add=(t,fn)=> cues.push({t,fn,done:false});
    // Señales musicales (lo gordo)
    add(START + 0.4, ()=>{ drawConst=true; spawnWhisper(); spawnMeteor(); });
    add(START + 11,  ()=> microFlash());                 // 1:12
    add(START + 23,  ()=> spawnMeteor());                // 1:24
    add(START + 27,  ()=> { spawnMeteor(); setStarSpeed(1.10);} ); // 1:28
    add(START + 41,  ()=> spawnWhisper());               // 1:42
    add(START + 47,  ()=> microFlash());                 // 1:48
    add(START + 49,  ()=> setStarSpeed(1.18));           // 1:50
    add(START + 55,  ()=> spawnCrossMeteors());          // 1:56
    add(START + 63,  ()=> { document.body.classList.add('v-ramp-1'); microFlash(); }); // 2:04
    add(START + 75,  ()=> spawnFanMeteors());            // 2:18
    add(START + 79,  ()=> document.body.classList.add('v-preclimax'));                 // 2:20
    add(START + 82,  ()=> microFlash());                 // 2:23
  }
  function runCues(t){
    for(const c of cues){ if(!c.done && t>=c.t){ try{c.fn();}catch(e){console.warn(e)} c.done=true; lastPulseT=t; } }
  }

  // Heartbeat independiente del audio (cada ~2–3 s dispara algo)
  function heartbeat(nowMs){
    if(!lastPulseMs) lastPulseMs = nowMs;
    const progress = clamp((audio.currentTime-START)/(END-START), 0, 1);
    const targetGap = 2400 - 800*progress; // 2.4s → 1.6s
    pulseGapMs = targetGap;
    if(nowMs - lastPulseMs >= pulseGapMs){
      const r = Math.random();
      if(r < 0.33) spawnWhisper();
      else if(r < 0.72) spawnMeteor();
      else microFlash();
      lastPulseMs = nowMs;
    }
  }

  // ------- RAF -------
  function raf(){
    const now=performance.now(); const dt= lastRAF? (now-lastRAF):16.6; lastRAF=now;
    applyBaseMotion(now);
    if(drawConst) drawConstellations(dt); else ctx.clearRect(0,0,innerWidth,innerHeight);
    if(meteors.length) drawMeteors(dt);
    heartbeat(now);
    rafId = requestAnimationFrame(raf);
  }

  // ------- start -------
  function start(){
    if(active) return;
    resize(); buildSky(); buildGlows(); buildConstellations(); setupParallax(); makeCues();
    document.body.classList.add('v-active');
    audio.addEventListener('timeupdate', onTimeUpdate);
    addEventListener('resize', onResize);
    lastRAF=performance.now(); raf(); active=true;

    // Adaptar si el usuario cae tarde
    if(audio.currentTime>=START+49) setStarSpeed(1.18);
    else if(audio.currentTime>=START+27) setStarSpeed(1.10);

    // Kick de arranque para que ya se note
    spawnMeteor(); spawnWhisper(); microFlash();
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

