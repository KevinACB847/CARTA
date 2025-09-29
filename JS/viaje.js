/* ===========================
   VIAJE — JS autónomo (1:01–2:25)
   =========================== */
(() => {
  const START = 61;   // 1:01
  const END   = 145;  // 2:25

  // DOM refs
  const audio   = document.getElementById('v-audio');
  const root    = document.getElementById('v-root');
  const sky     = document.getElementById('v-sky');
  const farL    = document.getElementById('v-layer-far');
  const midL    = document.getElementById('v-layer-mid');
  const nearL   = document.getElementById('v-layer-near');
  const cvs     = document.getElementById('v-constellations');
  const ctx     = cvs.getContext('2d');
  const whispersBox = document.getElementById('v-whispers');
  const sparklesBox = document.getElementById('v-sparkles');
  const playBtn = document.getElementById('v-play');

  // state
  let W=0, H=0, dpr=1;
  let rafId=null, last=0, active=false;
  let constellations=[], meteors=[];
  let drawConst=false, speedMult=1;
  let cues=[];

  const WHISPERS = ["pequeño cosmos","tú y yo","promesa","destino","una señal","más cerca","late","sueño"];

  // ------------ utils ------------
  const rand=(a,b)=> a + Math.random()*(b-a);

  function resize(){
    dpr = Math.max(1, devicePixelRatio || 1);
    W = cvs.width  = Math.floor(innerWidth * dpr);
    H = cvs.height = Math.floor(innerHeight * dpr);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height= innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ------------ starfield ------------
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
    makeStars(farL,  120, 'var(--v-star-far)');
    makeStars(midL,   90, 'var(--v-star-mid)');
    makeStars(nearL,  60, 'var(--v-star-near)');
  }

  // ------------ parallax ------------
  function setupParallax(){
    function onMove(e){
      const p = e.touches ? e.touches[0] : e;
      const nx = (p.clientX/innerWidth)  - .5;
      const ny = (p.clientY/innerHeight) - .5;
      const df = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-far'))  || 7;
      const dm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-mid'))  || 12;
      const dn = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-depth-near')) || 18;
      farL.style.transform  = `translate3d(${nx*df}px, ${ny*df}px,0)`;
      midL.style.transform  = `translate3d(${nx*dm}px, ${ny*dm}px,0)`;
      nearL.style.transform = `translate3d(${nx*dn}px, ${ny*dn}px,0)`;
    }
    addEventListener('mousemove', onMove, {passive:true});
    addEventListener('touchmove', onMove, {passive:true});
  }

  // ------------ whispers ------------
  function spawnWhisper(text){
    const w = document.createElement('div');
    w.className='v-whisper';
    w.textContent = text || WHISPERS[(Math.random()*WHISPERS.length)|0];
    w.style.left = (10+Math.random()*80) + '%';
    w.style.top  = (20+Math.random()*60) + '%';
    whispersBox.appendChild(w);
    w.addEventListener('animationend', ()=> w.remove());
  }

  // ------------ sparkles ------------
  function setupSparkles(){
    function onTap(e){
      const p = e.touches ? e.touches[0] : e;
      spawnSparkle(p.clientX, p.clientY);
    }
    addEventListener('click', onTap);
    addEventListener('touchstart', onTap, {passive:true});
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

  // ------------ flashes / ramps ------------
  function microFlash(){
    const el=document.createElement('div');
    el.className='v-flash'; document.body.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }

  // ------------ constellations ------------
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
    ctx.globalAlpha=.75; ctx.lineWidth=1.1; ctx.strokeStyle='rgba(200,210,255,0.7)';
    const speed = .6; // px/ms
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

  // ------------ meteors ------------
  function spawnMeteor(o={}){
    const side = Math.random()<.5 ? 'L' : 'R';
    const y = rand(innerHeight*.15, innerHeight*.85);
    const dir = side==='L'?1:-1;
    const speed = o.speed || rand(420,620);
    const ang   = o.angle || (dir>0? rand(-.4,-.2): rand(.2,.4));
    const vx=Math.cos(ang)*speed*dir, vy=Math.sin(ang)*speed;
    const x0= side==='L' ? -40 : innerWidth+40;
    meteors.push({x:x0,y, vx,vy, life:.6, alpha:.9});
  }
  function spawnCrossMeteors(){ spawnMeteor({angle:-.28,speed:560}); spawnMeteor({angle:.28,speed:560}); }
  function spawnFanMeteors(){ for(let i=0;i<3;i++) spawnMeteor({angle:rand(-.35,-.18),speed:rand(460,620)}) }
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
    meteors = meteors.filter(m=> m.life>0 && m.x>-80 && m.x<innerWidth+80 && m.y>-80 && m.y<innerHeight+80);
  }

  // ------------ star speed ------------
  function setStarSpeed(mult){
    speedMult = mult;
    document.querySelectorAll('.v-star').forEach(s=>{
      if(!s._base){ s._base = parseFloat(getComputedStyle(s).animationDuration) || 2.8; }
      const newDur = Math.max(1.4, s._base / speedMult);
      s.style.animationDuration = newDur + 's';
    });
  }

  // ------------ cues ------------
  function makeCues(){
    cues=[];
    const add=(t,fn)=> cues.push({t,fn,done:false});

    // coreografía (solo viaje)
    add(START + 0.5, ()=>{ drawConst=true; });
    add(START + 5,   ()=> spawnWhisper());            // 1:06
    add(START + 11,  ()=> microFlash());              // 1:12
    add(START + 17,  ()=> spawnWhisper());            // 1:18 (refuerzo)
    add(START + 23,  ()=> spawnMeteor());             // 1:24
    add(START + 27,  ()=> { spawnMeteor(); setStarSpeed(1.05);} ); // ~1:28

    add(START + 35,  ()=> cornerSparkles());          // 1:36
    add(START + 41,  ()=> spawnWhisper());            // 1:42
    add(START + 47,  ()=> microFlash());              // 1:48
    add(START + 49,  ()=> setStarSpeed(1.13));        // ~1:50 (+13% total)
    add(START + 51,  ()=> microFlash());              // 1:52
    add(START + 55,  ()=> spawnCrossMeteors());       // 1:56

    add(START + 63,  ()=> { document.body.classList.add('v-ramp-1'); microFlash(); }); // 2:04
    add(START + 69,  ()=> spawnWhisper());            // 2:10
    add(START + 75,  ()=> cornerSparkles());          // 2:16
    add(START + 77,  ()=> spawnFanMeteors());         // 2:18
    add(START + 79,  ()=> document.body.classList.add('v-preclimax'));                // 2:20
    add(START + 82,  ()=> microFlash());              // 2:23

    add(END, ()=> { /* aquí no cortamos; el clímax lo hará después */ });
  }

  function runCues(t){
    for(const c of cues){ if(!c.done && t>=c.t){ try{c.fn();}catch(e){console.warn(e)} c.done=true; } }
  }

  // ------------ RAF loop ------------
  function raf(){
    const now=performance.now(); const dt= last? (now-last):16.6; last=now;
    if(drawConst) drawConstellations(dt); else ctx.clearRect(0,0,innerWidth,innerHeight);
    if(meteors.length) drawMeteors(dt);
    // document.getElementById('v-t')?.textContent = (audio.currentTime||0).toFixed(1); // debug
    rafId = requestAnimationFrame(raf);
  }

  // ------------ start/boot ------------
  function start(){
    if(active) return;
    resize(); buildSky(); buildConstellations(); setupParallax(); setupSparkles(); makeCues();
    document.body.classList.add('v-active');
    audio.addEventListener('timeupdate', onTimeUpdate);
    addEventListener('resize', onResize);
    last=performance.now(); raf(); active=true;

    // si el usuario adelantó, adaptar
    if(audio.currentTime>=START+49) setStarSpeed(1.13);
    else if(audio.currentTime>=START+27) setStarSpeed(1.05);
    runCues(audio.currentTime||0);
  }

  function onTimeUpdate(){ runCues(audio.currentTime||0); }
  function onResize(){ resize(); buildConstellations(); }

  // botón Play → inicia viaje en 1:01
  document.addEventListener('DOMContentLoaded', ()=>{
    resize();
    playBtn?.addEventListener('click', async ()=>{
      try{ audio.currentTime = START; await audio.play(); }catch(e){}
      start();
    });
  });

})();
