/* =========================================================
   VIAJE — Planetarium 1:01–2:25 (JS, optimizado + corte)
   ========================================================= */
const stage     = document.querySelector('.stage');
const bgCanvas  = document.getElementById('bgCanvas');
const fxCanvas  = document.getElementById('fxCanvas');
const focEl     = document.querySelector('.foco-dorado');
const flashEl   = document.getElementById('v-flash');
const whisperEl = document.getElementById('v-whisper');
const btnStart  = document.getElementById('btnStart');
const audio     = document.getElementById('audio');

if(!stage||!bgCanvas||!fxCanvas||!btnStart||!audio){
  console.warn('[viaje] Falta estructura mínima en el HTML.');
}

const isCoarse = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- DPR dinámico y contextos ---------- */
let bg = bgCanvas.getContext('2d',{alpha:false});
let fx = fxCanvas.getContext('2d',{alpha:true});

// Cap de DPR: más bajo en móvil para fluidez
const BASE_DPR_CAP_DESKTOP = 1.6;
const BASE_DPR_CAP_MOBILE  = 1.0;
let dprCap = isCoarse ? BASE_DPR_CAP_MOBILE : BASE_DPR_CAP_DESKTOP;

function getDPR(){ return Math.min(window.devicePixelRatio||1, dprCap); }
function resize(){
  const dpr=getDPR();
  const w=Math.floor(stage.clientWidth * dpr);
  const h=Math.floor(stage.clientHeight* dpr);
  [bgCanvas,fxCanvas].forEach(cv=>{
    cv.width=w; cv.height=h;
    cv.style.width = stage.clientWidth+'px';
    cv.style.height= stage.clientHeight+'px';
  });
  bg.setTransform(1,0,0,1,0,0); fx.setTransform(1,0,0,1,0,0);
  bg.scale(dpr,dpr); fx.scale(dpr,dpr);
  WORLD.w=stage.clientWidth; WORLD.h=stage.clientHeight;
}
addEventListener('resize', resize);

/* ---------- Mundo y rendimiento ---------- */
const WORLD = {
  w: stage.clientWidth, h: stage.clientHeight,
  t0: 61.0, t1: 145.0,                    // 1:01 → 2:25
  lastFrameMs: performance.now(), fpsAvg: 60,
  parallax:{x:0,y:0}, drift:{x:0,y:0,t:0},
  eventClock:{lastAt:61.0},
  ended:false,
};

// Calidad dinámica
const QUALITY = { level: 2 }; // 2=alta, 1=media, 0=baja
let   RAY_STEP = 0.025;       // segmentación de curvas (↓ segmenta menos)
let   SHADOW_BLUR = 18;       // blur de notas (↓ menos costoso)

function setQuality(level){
  QUALITY.level = Math.max(0, Math.min(2, level));
  if (QUALITY.level === 2){ dprCap = isCoarse ? 1.0 : 1.6; RAY_STEP = 0.027; SHADOW_BLUR = 18; }
  if (QUALITY.level === 1){ dprCap = isCoarse ? 1.0 : 1.4; RAY_STEP = 0.035; SHADOW_BLUR = 10; }
  if (QUALITY.level === 0){ dprCap = 1.0;                 RAY_STEP = 0.050; SHADOW_BLUR = 0;  }
  resize();
}
function maybeAdjustQuality(){
  // baja calidad si el FPS medio cae sostenido
  if (WORLD.fpsAvg < 38 && QUALITY.level > 0) setQuality(QUALITY.level-1);
}

/* Densidades base (se podrán adelgazar en runtime) */
let DENSITY = {
  dust:  prefersReduced ? 200 : (isCoarse ? 500 : 900),
  bokeh: prefersReduced ?  8 : 18,
  raysMax: prefersReduced ? 2 : 3,
  meteorsMax: 3
};
const PERF = { minFps: isCoarse?42:50, dustMin: isCoarse?320:600 };

/* ---------- Datos de capas ---------- */
const Dust=[], Bokeh=[], Rays=[], Notes=[], Meteors=[];
let nebulaSeed = Math.random()*1000;
let rayGradient=null;

/* ---------- Utilidades ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=p=>Math.random()<p;
function easeInOutCubic(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function camOffset(){
  const px=WORLD.parallax.x*10, py=WORLD.parallax.y*8;
  const dx=Math.sin(WORLD.drift.t*.13)*10, dy=Math.cos(WORLD.drift.t*.17)*8;
  return {x:px+dx,y:py+dy};
}

/* ---------- Inicialización ---------- */
function initDust(){
  Dust.length=0;
  const n=DENSITY.dust;
  const R=Math.hypot(WORLD.w,WORLD.h)*.6;
  for(let i=0;i<n;i++){
    const r=Math.pow(Math.random(),.7)*R;
    const a=Math.random()*Math.PI*2;
    Dust.push({r,a,z:rand(.6,1.0),tw:rand(.3,1.0),sp:rand(.0004,.0011),size:rand(.9,2.0)});
  }
}
function initBokeh(){
  Bokeh.length=0; const n=DENSITY.bokeh;
  for(let i=0;i<n;i++){
    Bokeh.push({x:Math.random()*WORLD.w,y:Math.random()*WORLD.h,r:rand(24,110),s:rand(.06,.12),a:rand(.06,.18),dx:rand(-.06,.06),dy:rand(-.05,.05)});
  }
}

/* ---------- Rayos + Notas ---------- */
function makeRay(seedY,amp,k=0){
  const h= WORLD.h;
  const y0=lerp(h*.25,h*.75,seedY);
  const y1=y0 + amp*(k===0?1:(k%2===0?-1:1));
  const y2=y1 + amp*.6;
  const y3=lerp(h*.25,h*.75,seedY+.12);
  const x0=-WORLD.w*.2, x1=WORLD.w*.25, x2=WORLD.w*.65, x3=WORLD.w*1.15;
  return {p0:{x:x0,y:y0},p1:{x:x1,y:y1},p2:{x:x2,y:y2},p3:{x:x3,y:y3},width:1.3,glow:.75,notes:[]};
}
function bezier(p0,p1,p2,p3,t){const it=1-t;return{
  x:it*it*it*p0.x+3*it*it*t*p1.x+3*it*t*t*p2.x+t*t*t*p3.x,
  y:it*it*it*p0.y+3*it*it*t*p1.y+3*it*t*t*p2.y+t*t*t*p3.y
}}
function bezierTangent(p0,p1,p2,p3,t){const it=1-t;return{
  x:-3*it*it*p0.x+3*(it*it-2*it*t)*p1.x+3*(2*it*t-t*t)*p2.x+3*t*t*p3.x,
  y:-3*it*it*p0.y+3*(it*it-2*it*t)*p1.y+3*(2*it*t-t*t)*p2.y+3*t*t*p3.y
}}
function spawnNote(ray,speed=rand(.08,.12)){
  if (WORLD.ended) return;
  Notes.push({ray,s:0,speed,size:rand(1.7,2.3),alive:true});
  WORLD.eventClock.lastAt=currentTime();
}

/* ---------- Meteors (fugaces) ---------- */
function spawnMeteor(opts={}){
  if (WORLD.ended) return;
  const side=chance(.5)?'L':'R';
  const x=opts.x ?? (side==='L'? rand(-WORLD.w*.1,WORLD.w*.25) : rand(WORLD.w*.75,WORLD.w*1.1));
  const y=opts.y ?? rand(WORLD.h*.1, WORLD.h*.8);
  const ang=opts.ang ?? (side==='L'? rand(-.28,-.18) : rand(Math.PI-(-.28), Math.PI-(-.18)));
  const spd=opts.spd ?? rand(420,600);
  const life=opts.life ?? rand(.45,.70);
  Meteors.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life,age:0,w:rand(1.3,1.7)});
  if(Meteors.length>DENSITY.meteorsMax) Meteors.shift();
  WORLD.eventClock.lastAt=currentTime();
}

/* ---------- Flash + Susurros ---------- */
let whisperQueue=["PROMESA","SIEMPRE","CLARO"];
function flash(ms=110){
  if(!flashEl || WORLD.ended) return;
  flashEl.classList.add('is-on');
  setTimeout(()=>flashEl.classList.remove('is-on'), ms);
  WORLD.eventClock.lastAt=currentTime();
}
function showWhisper(text,dur=1200){
  if(!whisperEl || WORLD.ended) return;
  whisperEl.textContent = text || whisperQueue.shift() || "";
  whisperEl.classList.add('show');
  setTimeout(()=> whisperEl.classList.remove('show'), dur);
  WORLD.eventClock.lastAt=currentTime();
}

/* ---------- Botón Iniciar: arranca en 1:01 ---------- */
btnStart?.addEventListener('click', startAt61);
async function startAt61(){
  const SEEK=61.0;
  document.body.classList.add('v-active');
  const forceSeek=()=>{try{audio.currentTime=SEEK}catch{}};
  if(audio.readyState>=1) forceSeek(); else audio.addEventListener('loadedmetadata', forceSeek, { once:true });
  forceSeek();
  try{
    const p=audio.play();
    audio.addEventListener('play', ()=>{ if(audio.currentTime<SEEK-.2) forceSeek(); }, { once:true });
    await p;
  }catch(e){ console.warn('Play bloqueado:', e); }
  WORLD.eventClock.lastAt=SEEK;
  loop();
}

/* ---------- Interacción ---------- */
stage.addEventListener('pointermove', (e)=>{
  const r=stage.getBoundingClientRect();
  WORLD.parallax.x=clamp(((e.clientX-r.left)/r.width)*2-1,-1,1);
  WORLD.parallax.y=clamp(((e.clientY-r.top )/r.height)*2-1,-1,1);
  document.body.classList.add('v-boost-stars');
  clearTimeout(window.__boost_t);
  window.__boost_t=setTimeout(()=>document.body.classList.remove('v-boost-stars'), 350);
});
stage.addEventListener('pointerdown', (e)=>{
  if (WORLD.ended) return;
  const el=document.createElement('div');
  el.className='tap-note'; el.style.left=e.clientX+'px'; el.style.top=e.clientY+'px';
  stage.appendChild(el); setTimeout(()=>el.remove(),1200);
});

/* ---------- Cues (seek-seguros) ---------- */
const cues = [
  {t:66,  once:false, hit:(t)=>{ if(t<86) showWhisper("PROMESA",1100); }},
  {t:72,  once:true,  hit:()=> heartbeatKick(true)},
  {t:84,  once:true,  hit:()=> spawnMeteor({ang:-.22, spd:520})},
  {t:88,  once:true,  hit:()=> { document.body.classList.add('v-boost-stars'); setTimeout(()=>document.body.classList.remove('v-boost-stars'),650); }},
  {t:100, once:true,  hit:()=> bokehIn=1 },
  {t:102, once:true,  hit:()=> flash(110) },
  {t:108, once:true,  hit:()=> flash(100) },
  {t:110, once:true,  hit:()=> Rays.forEach(r=> r.glow=.95) },
  {t:116, once:true,  hit:()=> { spawnMeteor({ang:-.21,spd:590}); setTimeout(()=>spawnMeteor({ang:Math.PI-(-.21),spd:590}), 60); }},
  {t:124, once:false, hit:()=> { document.body.classList.add('v-ramp-1'); showWhisper("CLARO",1100); }},
  {t:138, once:true,  hit:()=> shootFanNotes() },
  {t:140, once:false, hit:()=> document.body.classList.add('v-preclimax') },
  {t:143, once:true,  hit:()=> flash(110) } // preparación al corte
];
cues.forEach(c=>c._last=-Infinity);

function evalCues(t){
  if (WORLD.ended) return;
  for(const c of cues){
    if(Math.abs(t - c.t) <= 0.10){
      if(c.once && (t - c._last) < 2.0) continue;
      c.hit(t); c._last=t; WORLD.eventClock.lastAt=t;
    }
  }
  if(t>=124) document.body.classList.add('v-ramp-1'); else document.body.classList.remove('v-ramp-1');
  if(t>=140) document.body.classList.add('v-preclimax'); else document.body.classList.remove('v-preclimax');
}

/* ---------- Heartbeat (no spawnea cerca del fin) ---------- */
function heartbeatPeriod(t){
  const u=clamp((t - WORLD.t0)/(WORLD.t1 - WORLD.t0), 0, 1);
  return lerp(2.4, 1.6, u);
}
function heartbeatKick(gentle=false){
  const t=currentTime();
  if (t >= WORLD.t1 - 2.0) return; // sin spawns en la recta final
  if(gentle || chance(.55)){
    if(Rays.length){ const r=Rays[Math.floor(Math.random()*Rays.length)]; spawnNote(r, rand(.08,.11)); }
    else { spawnMeteor({ spd:rand(410,500), life:rand(.4,.6) }); }
  } else {
    spawnMeteor();
  }
}
function heartbeat(t){
  if (WORLD.ended) return;
  const p=heartbeatPeriod(t);
  if((t - WORLD.eventClock.lastAt) >= p){
    heartbeatKick(); WORLD.eventClock.lastAt = t;
  }
}
const currentTime = () => audio.currentTime || 0;

/* ---------- Bokeh / Fondo ---------- */
let bokehIn=0;
function updateBokeh(dt){
  if (WORLD.ended) return;
  if (bokehIn>0) bokehIn=clamp(bokehIn + dt*.35, 0, 1);
  for(const b of Bokeh){
    b.x+=b.dx*dt*60; b.y+=b.dy*dt*60;
    if(b.x<-b.r) b.x+=WORLD.w+b.r*2; if(b.x>WORLD.w+b.r) b.x-=WORLD.w+b.r*2;
    if(b.y<-b.r) b.y+=WORLD.h+b.r*2; if(b.y>WORLD.h+b.r) b.y-=WORLD.h+b.r*2;
  }
}
function drawBackground(t,dt){
  const {w,h}=WORLD, cam=camOffset();
  const g=bg.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#0b0f1d'); g.addColorStop(.55,'#0b1224'); g.addColorStop(1,'#0b0f1d');
  bg.fillStyle=g; bg.fillRect(0,0,w,h);

  // Nebulosas suaves
  nebulaSeed+=dt*.05;
  for(let i=0;i<3;i++){
    const nx=(Math.sin(nebulaSeed*.7+i*1.7)*.5+.5)*w;
    const ny=(Math.cos(nebulaSeed*.6+i*2.1)*.5+.5)*h*.9;
    const r=lerp(260,420,(i+1)/3);
    const grad=bg.createRadialGradient(nx+cam.x*.3, ny+cam.y*.25, r*.1, nx+cam.x*.3, ny+cam.y*.25, r);
    grad.addColorStop(0,'rgba(36,59,107,.28)'); grad.addColorStop(1,'rgba(11,15,29,0)');
    bg.globalCompositeOperation='source-over';
    bg.fillStyle=grad; bg.beginPath(); bg.arc(nx,ny,r,0,Math.PI*2); bg.fill();
  }

  // Polvo en espiral (con 'lighter' sólo aquí)
  bg.save(); bg.translate(w*.5+cam.x*.35, h*.42+cam.y*.30); bg.globalCompositeOperation='lighter';
  for(const p of Dust){
    p.a+=p.sp*dt*60;
    const x=Math.cos(p.a)*p.r*.66, y=Math.sin(p.a)*p.r*.40;
    const tw=(Math.sin(t*2.1 + p.r*.01)*.5+.5)*p.tw;
    const alpha=(.055+.055*p.z)*( .60 + .40*tw );
    bg.fillStyle=`rgba(255,218,107,${alpha.toFixed(3)})`;
    bg.fillRect(x,y,p.size,p.size);
  }
  bg.restore();

  // Bokeh
  if (bokehIn>0){
    bg.save(); bg.globalCompositeOperation='screen';
    for(const b of Bokeh){
      const grad=bg.createRadialGradient(b.x+cam.x*.15,b.y+cam.y*.15,b.r*.25,b.x+cam.x*.15,b.y+cam.y*.15,b.r);
      grad.addColorStop(0,`rgba(242,239,233,${(.05*b.a*bokehIn).toFixed(3)})`);
      grad.addColorStop(1,'rgba(36,59,107,0)');
      bg.fillStyle=grad; bg.beginPath(); bg.arc(b.x,b.y,b.r,0,Math.PI*2); bg.fill();
    }
    bg.restore();
  }
}

/* ---------- Foco + breathing + fade final ---------- */
function updateFocusAndBreathing(t,dt){
  // Apertura del foco 1:01–1:20
  const openU=clamp((t-61)/19,0,1);
  const scaleY=lerp(1,1.22,easeInOutCubic(openU));
  const transY=lerp(0,6,openU);
  if(focEl){focEl.style.transform=`translateY(${transY}vh) scaleY(${scaleY})`;focEl.style.opacity=String(lerp(.80,.98,openU));}

  // Respiración
  const u=clamp((t-WORLD.t0)/(WORLD.t1-WORLD.t0),0,1);
  const breath=Math.sin(t*.55)*.5+.5;
  const roll=Math.sin(t*.18)*.4;
  let baseZoom=lerp(1.000,1.024,breath)*lerp(1.0,1.03,u*.6);
  let baseBright=lerp(1.00,1.040,breath)*lerp(1.00,1.03,u*.6);

  // Fade a negro 2:23 → 2:25
  if (t >= 143){
    const k = clamp((t - 143) / 2.0, 0, 1); // 0..1 en 2s
    baseBright *= (1 - k);
    if (k >= 1) {
      document.body.classList.add('v-end');
      WORLD.ended = true;
    }
  }
  document.documentElement.style.setProperty('--v-zoom',   baseZoom.toFixed(3));
  document.documentElement.style.setProperty('--v-bright', baseBright.toFixed(3));
  document.documentElement.style.setProperty('--v-roll',   roll.toFixed(3)+'deg');
}

/* ---------- Dibujar Rayos + Notas ---------- */
function ensureRayGradient(){
  if (rayGradient) return rayGradient;
  const g=fx.createLinearGradient(0,0,WORLD.w,0);
  g.addColorStop(0,'rgba(36,59,107,0)');
  g.addColorStop(.25,'rgba(215,200,255,.22)');
  g.addColorStop(.55,'rgba(255,218,107,.36)');
  g.addColorStop(.75,'rgba(242,239,233,.28)');
  g.addColorStop(1,'rgba(36,59,107,0)');
  rayGradient=g; return g;
}
function updateRays(t,dt){
  if (WORLD.ended) return;
  if(t>=80 && Rays.length===0){ Rays.push(makeRay(.32,WORLD.h*.10,0)); Rays.push(makeRay(.56,WORLD.h*.12,1)); }
  if(t>=90 && Rays.length===2 && DENSITY.raysMax>=3){ Rays.push(makeRay(.44,WORLD.h*.14,2)); }

  const spawnRate = QUALITY.level===0 ? .02 : QUALITY.level===1 ? .026 : .03;
  if(Rays.length && (Notes.length<Rays.length*4) && chance(spawnRate*dt*60)){
    const r=Rays[Math.floor(Math.random()*Rays.length)]; spawnNote(r, rand(.08,.12));
  }

  for(const n of Notes){ n.s += n.speed*dt*.18; if(n.s>=1) n.alive=false; }
  for(let i=Notes.length-1;i>=0;i--) if(!Notes[i].alive) Notes.splice(i,1);
}
function drawRaysAndNotes(t,dt){
  if (!Rays.length && !Notes.length) return;
  const cam=camOffset();
  fx.save(); fx.translate(cam.x*.2, cam.y*.2);
  fx.globalCompositeOperation='lighter';
  fx.lineCap='round'; fx.lineJoin='round';

  const g=ensureRayGradient();
  for(const r of Rays){
    fx.strokeStyle=g; fx.lineWidth=r.width; fx.beginPath();
    for(let s=0;s<=1;s+=RAY_STEP){
      const p=bezier(r.p0,r.p1,r.p2,r.p3,s);
      if(s===0) fx.moveTo(p.x,p.y); else fx.lineTo(p.x,p.y);
    }
    fx.stroke();
  }

  for(const n of Notes){
    const p=bezier(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
    const q=bezierTangent(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
    const ang=Math.atan2(q.y,q.x), tail=12;
    fx.beginPath();
    fx.moveTo(p.x-Math.cos(ang)*tail, p.y-Math.sin(ang)*tail);
    fx.lineTo(p.x,p.y);
    fx.strokeStyle='rgba(255,218,107,.60)';
    fx.lineWidth=1.3; fx.stroke();

    fx.beginPath();
    fx.arc(p.x,p.y,n.size,0,Math.PI*2);
    fx.fillStyle='rgba(255,218,107,.88)';
    if (SHADOW_BLUR>0){ fx.shadowBlur=SHADOW_BLUR; fx.shadowColor='rgba(215,200,255,.55)'; }
    fx.fill(); fx.shadowBlur=0;
  }
  fx.restore();
}

/* ---------- Meteors ---------- */
function updateMeteors(dt){
  for(const m of Meteors){ m.age+=dt; m.x+=m.vx*dt; m.y+=m.vy*dt; }
  for(let i=Meteors.length-1;i>=0;i--){
    const m=Meteors[i];
    if(m.age>m.life || m.x<-200 || m.x>WORLD.w+200 || m.y<-200 || m.y>WORLD.h+200){
      Meteors.splice(i,1);
    }
  }
}
function drawMeteors(){
  if(!Meteors.length) return;
  const cam=camOffset();
  fx.save(); fx.translate(cam.x*.1, cam.y*.1);
  fx.globalCompositeOperation='lighter'; fx.lineCap='round';
  for(const m of Meteors){
    const k=m.age/m.life, alpha=clamp(.55 - k*.55, 0, .55), len=110*(1 - k*.2);
    const ang=Math.atan2(m.vy,m.vx), ax=m.x-Math.cos(ang)*len, ay=m.y-Math.sin(ang)*len;
    const grad=fx.createLinearGradient(ax,ay,m.x,m.y);
    grad.addColorStop(0,'rgba(215,200,255,0)');
    grad.addColorStop(.35,`rgba(215,200,255,${(.32*alpha).toFixed(3)})`);
    grad.addColorStop(.8, `rgba(255,218,107,${(.80*alpha).toFixed(3)})`);
    grad.addColorStop(1,'rgba(255,218,107,0)');
    fx.strokeStyle=grad; fx.lineWidth=m.w;
    fx.beginPath(); fx.moveTo(ax,ay); fx.lineTo(m.x,m.y); fx.stroke();

    fx.beginPath();
    fx.arc(m.x,m.y,1.3+(1.3*alpha),0,Math.PI*2);
    fx.fillStyle=`rgba(255,218,107,${.85*alpha})`;
    fx.fill();
  }
  fx.restore();
}

/* ---------- Drift ---------- */
function updateDrift(dt){
  const u=clamp((currentTime() - WORLD.t0)/(WORLD.t1 - WORLD.t0),0,1);
  WORLD.drift.t += dt * lerp(1.0,1.12,u);
}

/* ---------- Abanico 2:18 ---------- */
function shootFanNotes(){
  if(!Rays.length) Rays.push(makeRay(.44, WORLD.h*.14, 2));
  const base=Rays[Math.floor(Math.random()*Rays.length)];
  for(let i=0;i<3;i++) spawnNote(base, rand(.10,.14));
}

/* ---------- Loop ---------- */
function loop(){
  const now=performance.now();
  const dt=Math.min(.05, (now - WORLD.lastFrameMs)/1000);
  WORLD.lastFrameMs = now;

  // FPS medio + calidad dinámica
  const fps=1/dt; WORLD.fpsAvg = WORLD.fpsAvg*.9 + fps*.1;
  if(!prefersReduced && Dust.length>PERF.dustMin && WORLD.fpsAvg<PERF.minFps){
    for(let i=0;i<10;i++) Dust.pop(); // adelgazar polvo
  }
  maybeAdjustQuality();

  const t=currentTime();

  // Guardias de tiempo
  if(document.body.classList.contains('v-active') && t < WORLD.t0 - .05){
    audio.currentTime = WORLD.t0;
  }

  // Fin duro: al llegar a 2:25, marcar fin y detener en cuanto acabe fade
  if (t >= WORLD.t1 && !WORLD.ended){
    document.body.classList.add('v-end'); // por si el fade no llegó a 1
    WORLD.ended = true;
  }

  // Limpiar
  bg.clearRect(0,0,WORLD.w,WORLD.h);
  fx.clearRect(0,0,WORLD.w,WORLD.h);

  // Estados/tiempo (sólo si no acabó)
  if (!WORLD.ended){
    evalCues(t);
    heartbeat(t);
    updateDrift(dt);
    updateBokeh(dt);
    updateRays(t,dt);
    updateMeteors(dt);
  }

  updateFocusAndBreathing(t,dt); // hace el fade a negro de 2:23→2:25

  // Draw
  drawBackground(t,dt);
  drawRaysAndNotes(t,dt);
  drawMeteors();

  // Si ya terminó y el brillo es negro, paramos el loop
  const endedAndBlack = document.body.classList.contains('v-end') && parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-bright')) <= 0.02;
  if (!endedAndBlack){
    requestAnimationFrame(loop);
  } else {
    // Limpieza final: negro total
    bg.clearRect(0,0,WORLD.w,WORLD.h);
    fx.clearRect(0,0,WORLD.w,WORLD.h);
  }
}

/* ---------- Boot ---------- */
function boot(){
  setQuality( isCoarse ? 1 : 2 ); // arranque sensato
  resize(); initDust(); initBokeh();

  audio.addEventListener('seeked', ()=>{ WORLD.eventClock.lastAt = currentTime(); });

  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && document.body.classList.contains('v-active') && audio.paused && !WORLD.ended){
      audio.play().catch(()=>{});
    }
  });
}
boot();

