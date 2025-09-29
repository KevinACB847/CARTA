/* ===========================================================
   VIAJE — La La Land (1:01–2:25)
   Motor visual autónomo para el “viaje” de Planetarium.
   Requiere en el HTML:
     - <audio id="v-audio" src="music/planetarium.mp3">
     - <div id="v-layer-far|mid|near">  (capas de estrellas)
     - <div id="v-glows">               (contenedor de nebulosas)
     - <canvas id="v-constellations">   (constelaciones + fugaces)
     - <div id="v-whispers">            (textos)
     - <div id="v-sparkles">            (chispas en tap/click)
     - <button id="v-play">             (botón iniciar)
   =========================================================== */

(() => {
  // ----------------- CONSTANTES DE TIEMPO (seg) -----------------
  const START = 61;  // 1:01
  const END   = 145; // 2:25

  // ----------------- REFERENCIAS DOM -----------------
  const audio   = document.getElementById('v-audio');
  const farL    = document.getElementById('v-layer-far');
  const midL    = document.getElementById('v-layer-mid');
  const nearL   = document.getElementById('v-layer-near');
  const glowsCt = document.getElementById('v-glows');
  const cvs     = document.getElementById('v-constellations');
  const ctx     = cvs.getContext('2d');
  const whispersBox = document.getElementById('v-whispers');
  const sparklesBox = document.getElementById('v-sparkles');
  const playBtn = document.getElementById('v-play');

  // ----------------- ESTADO -----------------
  let W=0, H=0, dpr=1;
  let rafId=null, lastRAF=0, active=false;
  let cues=[], lastCueTime=-1;
  let lastPulseMs=0;            // heartbeat en ms
  let baseSpeed = 1.00;         // velocidad global estrellas (var CSS --v-speed)
  let boostTO=null;

  // Parallax + drift + breathing
  let pointerX=0, pointerY=0;   // -0.5..0.5
  let lastPX=0, lastPY=0, lastMoveT=0;
  let t0 = performance.now();

  // Constellations + meteors
  let constellations=[];        // [{nodes:[{x,y}], edges:[{a,b,cpx,cpy,len}], progress:0,totalLen:...}]
  let meteors=[];

  // Texto
  const WHISPERS = ["pequeño cosmos","tú y yo","promesa","destino","una señal","más cerca","late","sueño"];

  // ----------------- UTILIDADES -----------------
  const rand=(a,b)=> a + Math.random()*(b-a);
  const clamp=(v,a,b)=> Math.max(a, Math.min(b,v));
  const rootStyle = document.documentElement.style;

  function setCSSVar(k, v){ rootStyle.setProperty(k, v); }
  function getNumVar(k, fallback=0){
    const v = getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // ----------------- TAMAÑO / DENSIDAD -----------------
  function resize(){
    dpr = Math.max(1, devicePixelRatio || 1);
    W = cvs.width  = Math.floor(innerWidth * dpr);
    H = cvs.height = Math.floor(innerHeight * dpr);
    cvs.style.width = innerWidth + 'px';
    cvs.style.height= innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ----------------- STARFIELD (DOM) -----------------
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
    // Densidad alta para que “llene” sin saturar
    makeStars(farL,  200, 'var(--v-star-far)');
    makeStars(midL,  150, 'var(--v-star-mid)');
    makeStars(nearL, 110, 'var(--v-star-near)');
  }

  // ----------------- GLOWS (ATMÓSFERA) -----------------
  const glowEls=[];
  function buildGlows(){
    glowsCt.innerHTML='';
    for(let i=0;i<3;i++){
      const g = document.createElement('div');
      g.className = 'v-glow';
      glowsCt.appendChild(g);
      glowEls.push(g);
    }
  }
  function moveGlows(t){
    // órbitas suaves (en píxeles)
    const r1=0.28, r2=0.22, r3=0.26; // fracciones del viewport
    const cx=innerWidth*0.5, cy=innerHeight*0.55;
    const x1=cx + Math.cos(t/12)*r1*innerWidth;
    const y1=cy + Math.sin(t/10)*r1*innerHeight;
    const x2=cx + Math.cos(t/9 + 1.3)*r2*innerWidth;
    const y2=cy + Math.sin(t/8 + 0.6)*r2*innerHeight;
    const x3=cx + Math.cos(t/7 - 0.7)*r3*innerWidth;
    const y3=cy + Math.sin(t/11- 0.4)*r3*innerHeight;
    if(glowEls[0]){ glowEls[0].style.left = x1+'px'; glowEls[0].style.top  = y1+'px'; }
    if(glowEls[1]){ glowEls[1].style.left = x2+'px'; glowEls[1].style.top  = y2+'px'; }
    if(glowEls[2]){ glowEls[2].style.left = x3+'px'; glowEls[2].style.top  = y3+'px'; }
  }

  // ----------------- PARALLAX + DRIFT + BREATHING -----------------
  function setupParallax(){
    function onMove(e){
      const p = e.touches ? e.touches[0] : e;
      const nx = (p.clientX/innerWidth)  - .5;
      const ny = (p.clientY/innerHeight) - .5;
      const now = performance.now();
      const vx = (nx - lastPX) / Math.max(0.016,(now-lastMoveT)/1000);
      const vy = (ny - lastPY) / Math.max(0.016,(now-lastMoveT)/1000);
      lastPX=nx; lastPY=ny; lastMoveT=now;
      pointerX = nx; pointerY = ny;

      // Boost visual si mueves rápido el mouse
      if(Math.hypot(vx,vy) > 1.8) boostStars(1.28, 800);
    }
    addEventListener('mousemove', onMove, {passive:true});
    addEventListener('touchmove', onMove, {passive:true});
  }

  function applyBaseMotion(now){
    const t = (now - t0)/1000;

    const df = getNumVar('--v-depth-far',7);
    const dm = getNumVar('--v-depth-mid',12);
    const dn = getNumVar('--v-depth-near',18);
    const af = getNumVar('--v-drift-far',8);
    const am = getNumVar('--v-drift-mid',14);
    const an = getNumVar('--v-drift-near',22);

    const fx = Math.sin(t/9.0)*af,  fy = Math.cos(t/11.0)*af;
    const mx = Math.sin(t/7.2)*am,  my = Math.cos(t/8.6)*am;
    const nx = Math.sin(t/5.5)*an,  ny = Math.cos(t/6.3)*an;

    farL.style.transform  = `translate3d(${pointerX*df + fx}px, ${pointerY*df + fy}px,0)`;
    midL.style.transform  = `translate3d(${pointerX*dm + mx}px, ${pointerY*dm + my}px,0)`;
    nearL.style.transform = `translate3d(${pointerX*dn + nx}px, ${pointerY*dn + ny}px,0)`;

    // breathing (zoom + bright) + roll
    const breath = 0.012 + (Math.sin(t/6.0)+1)*0.006;  // 0.012..0.024
    const bright = 1.00 + (Math.sin(t/7.0)+1)*0.022;   // 1.00..1.044
    const roll   = (Math.sin(t/8.5))*0.45;             // -0.45..0.45 deg
    setCSSVar('--v-zoom',  (1.00+breath).toFixed(3));
    setCSSVar('--v-bright', bright.toFixed(3));
    setCSSVar('--v-roll',   roll.toFixed(2)+'deg');

    moveGlows(t);
  }

  // ----------------- MICRO-EVENTOS VISUALES -----------------
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
    el.className='v-flash';
    document.body.appendChild(el);
    el.addEventListener('animationend', ()=> el.remove());
  }

  // ----------------- CONSTELACIONES “BONITAS” -----------------
  function buildConstellations(){
    // 3 grupos de puntos; luego conectamos con MST en cada grupo
    const groups = [
      { cx: innerWidth*0.26, cy: innerHeight*0.34, spread: Math.min(innerWidth,innerHeight)*0.25, n: 6 },
      { cx: innerWidth*0.62, cy: innerHeight*0.30, spread: Math.min(innerWidth,innerHeight)*0.22, n: 5 },
      { cx: innerWidth*0.45, cy: innerHeight*0.62, spread: Math.min(innerWidth,innerHeight)*0.28, n: 7 },
    ];

    const randPt=(g)=>({ x: g.cx+(Math.random()-0.5)*g.spread,
                          y: g.cy+(Math.random()-0.5)*g.spread });

    constellations = groups.map(g=>{
      const nodes = Array.from({length:g.n}, ()=> randPt(g));
      const edges = mstEdges(nodes).map(([i,j])=>{
        const a=nodes[i], b=nodes[j];
        // control point para arco (perpendicular al segmento, 10–18% del largo)
        const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
        const nx=-dy/len, ny=dx/len; // normal
        const off = len*rand(0.10,0.18) * (Math.random()<.5?1:-1);
        const cpx = (a.x+b.x)/2 + nx*off;
        const cpy = (a.y+b.y)/2 + ny*off;
        return {a, b, cpx, cpy, len};
      });
      const totalLen = edges.reduce((s,e)=>s+e.len,0);
      return {nodes, edges, progress:0, totalLen};
    });
  }

  // Minimum Spanning Tree (Prim) → retorna pares de índices
  function mstEdges(nodes){
    const n=nodes.length, used=Array(n).fill(false);
    const edges=[];
    let inSet=[0]; used[0]=true;

    while(inSet.length<n){
      let best={i:-1,j:-1,d:Infinity};
      for(const i of inSet){
        for(let j=0;j<n;j++){
          if(used[j]) continue;
          const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
          const d=dx*dx+dy*dy;
          if(d<best.d){ best={i,j,d}; }
        }
      }
      used[best.j]=true;
      inSet.push(best.j);
      edges.push([best.i, best.j]);
    }
    return edges;
  }

  function drawConstellations(dt){
    // fondo canvas
    ctx.clearRect(0,0,innerWidth,innerHeight);

    // estilo del “glow” base de los arcos
    ctx.lineJoin='round';
    const thin = 1.2;
    const fat  = 3.4;

    for(const C of constellations){
      // avanza el trazado (rápido)
      C.progress = Math.min(C.progress + 1.20*dt, C.totalLen);

      let acc=0;
      for(const e of C.edges){
        const remain = C.progress - acc;
        const r = clamp(remain/e.len, 0, 1);

        if(r<=0){ acc += e.len; continue; }

        // arco parcial: t de 0..r (aprox lineal a longitud)
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        if(r<1){
          const t=r;
          // Interpolación de curva cuadrática parcial (aprox)
          const qx = (1-t)*(1-t)*e.a.x + 2*(1-t)*t*e.cpx + t*t*e.b.x;
          const qy = (1-t)*(1-t)*e.a.y + 2*(1-t)*t*e.cpy + t*t*e.b.y;
          ctx.quadraticCurveTo(e.cpx, e.cpy, qx, qy);
        } else {
          ctx.quadraticCurveTo(e.cpx, e.cpy, e.b.x, e.b.y);
        }

        // Glow grueso + trazo fino nítido
        ctx.strokeStyle = 'rgba(180,195,255,0.25)';
        ctx.lineWidth = fat;
        ctx.stroke();

        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--v-const-stroke').trim() || 'rgba(200,210,255,0.78)';
        ctx.lineWidth = thin;
        ctx.stroke();

        // Nodo que “se alcanza”: pequeño blink
        if(r>=1){
          drawNode(e.b.x, e.b.y);
        } else if(acc===0){ // primer nodo del primer segmento
          drawNode(e.a.x, e.a.y);
        }

        acc += e.len;
      }
    }
  }

  function drawNode(x,y){
    ctx.save();
    // halo
    const g=ctx.createRadialGradient(x,y,0, x,y,8);
    g.addColorStop(0,'rgba(255,255,255,.50)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
    // núcleo
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(x,y,1.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ----------------- METEOROS (FUGACES) -----------------
  function spawnMeteor(o={}){
    const side = Math.random()<.5 ? 'L' : 'R';
    const y = rand(innerHeight*.12, innerHeight*.88);
    const dir = side==='L'?1:-1;
    const speed = o.speed || rand(580,760);
    const ang   = o.angle || (dir>0? rand(-.34,-.20): rand(.20,.34));
    const vx=Math.cos(ang)*speed*dir, vy=Math.sin(ang)*speed;
    const x0= side==='L' ? -60 : innerWidth+60;
    meteors.push({x:x0,y, vx,vy, life:.9, alpha:1});
  }
  function spawnCrossMeteors(){ spawnMeteor({angle:-.28,speed:720}); spawnMeteor({angle:.28,speed:720}); }
  function spawnFanMeteors(){ for(let i=0;i<3;i++) spawnMeteor({angle:rand(-.32,-.18),speed:rand(600,760)}) }

  function drawMeteors(dt){
    const t=dt/1000;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const m of meteors){
      const trailX = m.x - m.vx*t*0.10;
      const trailY = m.y - m.vy*t*0.10;

      // Trazo con gradiente (cola)
      const grad = ctx.createLinearGradient(trailX,trailY, m.x,m.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,'+m.alpha.toFixed(2)+')');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(trailX, trailY); ctx.lineTo(m.x, m.y); ctx.stroke();

      // física simple
      m.x += m.vx*t; m.y += m.vy*t; m.life -= t;
      m.alpha = Math.max(0, m.life*1.1);
    }
    ctx.restore();

    meteors = meteors.filter(m=> m.life>0 && m.x>-160 && m.x<innerWidth+160 && m.y>-160 && m.y<innerHeight+160);
  }

  // ----------------- VELOCIDAD DE ESTRELLAS / BOOST -----------------
  function setStarSpeed(mult){
    baseSpeed = mult;
    setCSSVar('--v-speed', String(mult));
  }
  function boostStars(mult=1.25, ms=700){
    document.body.classList.add('v-boost-stars');
    setCSSVar('--v-speed', String(mult));
    clearTimeout(boostTO);
    boostTO = setTimeout(()=>{
      document.body.classList.remove('v-boost-stars');
      setCSSVar('--v-speed', String(baseSpeed));
    }, ms);
  }

  // ----------------- CUES MUSICALES + HEARTBEAT -----------------
  function makeCues(){
    cues = [];
    const add=(t,fn)=> cues.push({t,fn,done:false});

    // Entrada viaje + primeros pulsos
    add(START + 0.4, ()=>{ drawKick(); });
    add(START + 11,  ()=> microFlash());                 // 1:12
    add(START + 23,  ()=> spawnMeteor());                // 1:24
    add(START + 27,  ()=> { spawnMeteor(); setStarSpeed(1.10);} ); // 1:28

    // Medio
    add(START + 41,  ()=> spawnWhisper());               // 1:42
    add(START + 47,  ()=> microFlash());                 // 1:48
    add(START + 49,  ()=> setStarSpeed(1.18));           // 1:50
    add(START + 55,  ()=> spawnCrossMeteors());          // 1:56

    // Rampa
    add(START + 63,  ()=> { document.body.classList.add('v-ramp-1'); microFlash(); }); // 2:04
    add(START + 75,  ()=> spawnFanMeteors());            // 2:18
    add(START + 79,  ()=> document.body.classList.add('v-preclimax'));                 // 2:20
    add(START + 82,  ()=> microFlash());                 // 2:23
  }

  function drawKick(){
    // Arranque visual “lleno”
    spawnWhisper();
    spawnMeteor();
    microFlash();
  }

  function runCues(t){
    for(const c of cues){
      if(!c.done && t>=c.t){ try{ c.fn(); }catch(e){ console.warn(e); } c.done=true; lastCueTime = t; }
    }
  }

  // Heartbeat: dispara algo cada ~2.4s → ~1.6s (se acelera al final)
  function heartbeat(nowMs){
    if(!lastPulseMs) lastPulseMs = nowMs;
    const ct = audio.currentTime || START;
    const progress = clamp((ct-START)/(END-START), 0, 1);
    const gap = 2400 - 800*progress; // ms
    if(nowMs - lastPulseMs >= gap){
      const r = Math.random();
      if(r < 0.33) spawnWhisper();
      else if(r < 0.72) spawnMeteor();
      else microFlash();
      lastPulseMs = nowMs;
    }
  }

  // ----------------- RAF -----------------
  let drawConst = false;
  function raf(){
    const now=performance.now();
    const dt = lastRAF ? (now - lastRAF) : 16.6;
    lastRAF = now;

    applyBaseMotion(now);

    // canvas
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    drawConstellations(dt);
    ctx.restore();

    if(meteors.length) drawMeteors(dt);

    // cues + heartbeat
    runCues(audio.currentTime || 0);
    heartbeat(now);

    rafId = requestAnimationFrame(raf);
  }

  // ----------------- START / BOOT -----------------
  function start(){
    if(active) return;
    resize();
    buildSky();
    buildGlows();
    buildConstellations();
    setupParallax();
    makeCues();

    document.body.classList.add('v-active');
    setStarSpeed(1.00);

    addEventListener('resize', onResize);
    audio.addEventListener('timeupdate', onTimeUpdate);

    lastRAF=performance.now();
    raf(); active=true;

    // Kick inicial para que ya se note vida
    drawKick();
  }

  function onResize(){ resize(); buildConstellations(); }
  function onTimeUpdate(){ /* cues se gestionan en raf leyendo currentTime */ }

  // Botón: inicia desde 1:01
  document.addEventListener('DOMContentLoaded', ()=>{
    resize();
    playBtn?.addEventListener('click', async ()=>{
      try{ audio.currentTime = START; await audio.play(); }catch(e){}
      start();
    });
  });

  // API opcional para pruebas en consola
  window.Viaje = {
    start,
    setSpeed: setStarSpeed,
    spark: (x,y)=>spawnSparkle(x||innerWidth/2,y||innerHeight/2),
    whisper: (t)=>spawnWhisper(t),
    meteor: ()=>spawnMeteor(),
    flash: ()=>microFlash()
  };
})();

