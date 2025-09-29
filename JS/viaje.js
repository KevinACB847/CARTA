/* =========================================================
   VIAJE — Planetarium 1:01–2:25 (JS)
   Motor time-driven sincronizado al audio
   ========================================================= */

/* Selectores */
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

/* Flags */
const isCoarse = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Contextos y DPR */
let bg = bgCanvas.getContext('2d',{alpha:false});
let fx = fxCanvas.getContext('2d',{alpha:true});
const DPR_CAP = isCoarse ? 1.5 : 2.0;
const getDPR = () => Math.min(window.devicePixelRatio||1, DPR_CAP);

/* Mundo */
const WORLD = {
  w: stage.clientWidth, h: stage.clientHeight,
  t0: 61.0, t1: 145.0,
  lastFrameMs: performance.now(),
  fpsAvg: 60,
  parallax: {x:0,y:0},
  drift: {x:0,y:0,t:0},
  eventClock: {lastAt: 61.0},
  mobile: isCoarse
};

/* Densidades y rendimiento */
const DENSITY = {
  dust:  prefersReduced ? 200 : (WORLD.mobile ? 600 : 1000),
  bokeh: prefersReduced ? 10  : 24,
  raysMax: prefersReduced ? 2 : 3,
  meteorsMax: 3
};
const PERF = { window:30, minFps: WORLD.mobile?42:48, dustMin: WORLD.mobile?400:700 };

/* Colores */
const COLORS = {
  midnight:'#0b0f1d',
  royal:'#243b6b',
  gold:'rgba(255,218,107,',
  lav:'rgba(215,200,255,',
  ivory:'rgba(242,239,233,'
};

/* Data de capas */
const Dust=[], Bokeh=[], Rays=[], Notes=[], Meteors=[];
let nebulaSeed = Math.random()*1000;
let rayGradient = null;

/* Utils */
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

/* Resize + DPR */
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

/* Inicialización de partículas/bokeh */
function initDust(){
  Dust.length=0;
  const n=DENSITY.dust;
  const R=Math.hypot(WORLD.w,WORLD.h)*.6;
  for(let i=0;i<n;i++){
    const r=Math.pow(Math.random(),.7)*R;
    const a=Math.random()*Math.PI*2;
    Dust.push({r,a,z:rand(.6,1.0),tw:rand(.3,1.0),sp:rand(.0004,.0011),size:rand(.9,2.2)});
  }
}
function initBokeh(){
  Bokeh.length=0; const n=DENSITY.bokeh;
  for(let i=0;i<n;i++){
    Bokeh.push({
      x:Math.random()*WORLD.w, y:Math.random()*WORLD.h,
      r:rand(24,120), s:rand(.06,.14), a:rand(.06,.22),
      dx:rand(-.08,.08), dy:rand(-.06,.06)
    });
  }
}

/* Rayos + Notas */
function makeRay(seedY,amp,k=0){
  const h=WORLD.h;
  const y0=lerp(h*.25,h*.75,seedY);
  const y1=y0 + amp*(k===0?1:(k%2===0?-1:1));
  const y2=y1 + amp*.6;
  const y3=lerp(h*.25,h*.75,seedY+.12);
  const x0=-WORLD.w*.2, x1=WORLD.w*.25, x2=WORLD.w*.65, x3=WORLD.w*1.15;
  return {p0:{x:x0,y:y0},p1:{x:x1,y:y1},p2:{x:x2,y:y2},p3:{x:x3,y:y3},width:1.4,glow:.75,born:audio.currentTime,notes:[]};
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
  Notes.push({ray,s:0,speed,size:rand(1.8,2.6),alive:true,hue:rand(0,1)});
  WORLD.eventClock.lastAt=audio.currentTime;
}

/* Meteoros (fugaces) */
function spawnMeteor(opts={}){
  const side=chance(.5)?'L':'R';
  const x=opts.x ?? (side==='L'? rand(-WORLD.w*.1,WORLD.w*.25) : rand(WORLD.w*.75,WORLD.w*1.1));
  const y=opts.y ?? rand(WORLD.h*.1, WORLD.h*.8);
  const ang=opts.ang ?? (side==='L'? rand(-.28,-.18) : rand(Math.PI-(-.28), Math.PI-(-.18)));
  const spd=opts.spd ?? rand(420,620);
  const life=opts.life ?? rand(.45,.75);
  Meteors.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life,age:0,w:rand(1.4,1.8)});
  if(Meteors.length>DENSITY.meteorsMax) Meteors.shift();
  WORLD.eventClock.lastAt=audio.currentTime;
}

/* Flash + Susurros */
let whisperQueue=["PROMESA","SIEMPRE","CLARO"];
function flash(ms=120){
  if(!flashEl) return;
  flashEl.classList.add('is-on');
  setTimeout(()=>flashEl.classList.remove('is-on'), ms);
  WORLD.eventClock.lastAt=audio.currentTime;
}
function showWhisper(text,dur=1400){
  if(!whisperEl) return;
  whisperEl.textContent = text || whisperQueue.shift() || "";
  whisperEl.classList.add('show');
  setTimeout(()=> whisperEl.classList.remove('show'), dur);
  WORLD.eventClock.lastAt=audio.currentTime;
}

/* Botón Iniciar → siempre arranca en 1:01 */
btnStart?.addEventListener('click', startAt61);
async function startAt61(){
  const SEEK=61.0; document.body.classList.add('v-active');
  const forceSeek=()=>{try{audio.currentTime=SEEK}catch{}};

  if(audio.readyState>=1) forceSeek();
  else audio.addEventListener('loadedmetadata', forceSeek, { once:true });

  // Safari/iOS puede ignorar seek antes de play → doble intento
  forceSeek();
  try{
    const p=audio.play();
    audio.addEventListener('play', ()=>{ if(audio.currentTime<SEEK-.2) forceSeek(); }, { once:true });
    await p;
  }catch(e){ console.warn('Play bloqueado:', e); }

  WORLD.eventClock.lastAt=SEEK;
  loop();
}

/* Interacción (ornamental) */
stage.addEventListener('pointermove', (e)=>{
  const r=stage.getBoundingClientRect();
  const nx=((e.clientX-r.left)/r.width)*2-1;
  const ny=((e.clientY-r.top)/r.height)*2-1;
  WORLD.parallax.x=clamp(nx,-1,1);
  WORLD.parallax.y=clamp(ny,-1,1);
  document.body.classList.add('v-boost-stars');
  clearTimeout(window.__boost_t);
  window.__boost_t=setTimeout(()=>document.body.classList.remove('v-boost-stars'), 400);
});
stage.addEventListener('pointerdown', (e)=>{
  const el=document.createElement('div');
  el.className='tap-note';
  el.style.left=e.clientX+'px'; el.style.top=e.clientY+'px';
  stage.appendChild(el); setTimeout(()=>el.remove(), 1300);
});

/* Cues deterministas (seek-seguros)
   1:06, 1:12, 1:24, 1:28, 1:40, 1:42, 1:48, 1:50, 1:56, 2:04, 2:18, 2:20, 2:23 */
const cues = [
  {t:66,  once:false, hit:(t)=>{ if(t<86) showWhisper("PROMESA",1200); }},
  {t:72,  once:true,  hit:()=> heartbeatKick(true)},
  {t:84,  once:true,  hit:()=> spawnMeteor({ang:-.22, spd:520})},  // fugaz diagonal
  {t:88,  once:true,  hit:()=> { document.body.classList.add('v-boost-stars'); setTimeout(()=>document.body.classList.remove('v-boost-stars'),700); }},
  {t:100, once:true,  hit:()=> bokehIn=1 },                         // bokeh in
  {t:102, once:true,  hit:()=> flash(120) },                        // micro-flash
  {t:108, once:true,  hit:()=> flash(110) },                        // micro-flash
  {t:110, once:true,  hit:()=> Rays.forEach(r=> r.glow=.95) },      // ampliar rayos
  {t:116, once:true,  hit:()=> {                                   // doble cruce
      spawnMeteor({ang:-.21, spd:600});
      setTimeout(()=>spawnMeteor({ang:Math.PI-(-.21), spd:600}), 60);
    }},
  {t:124, once:false, hit:()=> { document.body.classList.add('v-ramp-1'); showWhisper("CLARO",1200); }}, // ramp
  {t:138, once:true,  hit:()=> shootFanNotes() },                    // abanico triple
  {t:140, once:false, hit:()=> document.body.classList.add('v-preclimax') }, // preclímax
  {t:143, once:true,  hit:()=> flash(120) }                          // flash final
];
cues.forEach(c=>c._last=-Infinity);
function evalCues(t){
  for(const c of cues){
    if(Math.abs(t - c.t) <= 0.10){
      if(c.once && (t - c._last) < 2.0) continue;
      c.hit(t); c._last=t; WORLD.eventClock.lastAt=t;
    }
  }
  if(t>=124) document.body.classList.add('v-ramp-1'); else document.body.classList.remove('v-ramp-1');
  if(t>=140) document.body.classList.add('v-preclimax'); else document.body.classList.remove('v-preclimax');
}

/* Heartbeat (eventos suaves si hay “silencio” visual) */
function heartbeatPeriod(t){
  const u=clamp((t - WORLD.t0)/(WORLD.t1 - WORLD.t0), 0, 1);
  return lerp(2.4, 1.6, u);
}
function heartbeatKick(gentle=false){
  if(gentle || chance(.55)){
    if(Rays.length){ const r=Rays[Math.floor(Math.random()*Rays.length)]; spawnNote(r, rand(.08,.11)); }
    else { spawnMeteor({ spd:rand(420,520), life:rand(.4,.6) }); }
  } else {
    spawnMeteor();
  }
}
function heartbeat(t){
  const p=heartbeatPeriod(t);
  if((t - WORLD.eventClock.lastAt) >= p){
    heartbeatKick(); WORLD.eventClock.lastAt = t;
  }
}

/* Bokeh y fondo */
let bokehIn=0;
function updateBokeh(dt){
  if(bokehIn>0) bokehIn=clamp(bokehIn + dt*.35, 0, 1);
  for(const b of Bokeh){
    b.x += b.dx*dt*60; b.y += b.dy*dt*60;
    if(b.x < -b.r) b.x += WORLD.w + b.r*2;
    if(b.x > WORLD.w + b.r) b.x -= WORLD.w + b.r*2;
    if(b.y < -b.r) b.y += WORLD.h + b.r*2;
    if(b.y > WORLD.h + b.r) b.y -= WORLD.h + b.r*2;
  }
}
function drawBackground(t,dt){
  const {w,h}=WORLD, cam=camOffset();

  // Degradado base
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

  // Polvo dorado en espiral (swirl horario)
  bg.save();
  bg.translate(w*.5 + cam.x*.35, h*.42 + cam.y*.30);
  bg.globalCompositeOperation='lighter';
  for(const p of Dust){
    p.a += p.sp * dt * 60;
    const x=Math.cos(p.a) * p.r * .66;
    const y=Math.sin(p.a) * p.r * .40;
    const tw=(Math.sin(t*2.2 + p.r*.01)*.5+.5)*p.tw;
    const alpha=(.06 + .06*p.z) * (.60 + .40*tw);
    bg.fillStyle=`${COLORS.gold}${alpha.toFixed(3)})`;
    bg.fillRect(x,y,p.size,p.size);
  }
  bg.restore();

  // Bokeh (entra a 1:40)
  if(bokehIn>0){
    bg.save(); bg.globalCompositeOperation='screen';
    for(const b of Bokeh){
      const grad=bg.createRadialGradient(b.x+cam.x*.15,b.y+cam.y*.15,b.r*.25,b.x+cam.x*.15,b.y+cam.y*.15,b.r);
      grad.addColorStop(0,`rgba(242,239,233,${(.06*b.a*bokehIn).toFixed(3)})`);
      grad.addColorStop(1,'rgba(36,59,107,0)');
      bg.fillStyle=grad; bg.beginPath(); bg.arc(b.x,b.y,b.r,0,Math.PI*2); bg.fill();
    }
    bg.restore();
  }
}

/* Foco y breathing */
function updateFocusAndBreathing(t,dt){
  // Apertura del foco 1:01–1:20
  const openU=clamp((t-61)/19, 0, 1);
  const scaleY=lerp(1,1.22,easeInOutCubic(openU));
  const transY=lerp(0,6,openU);
  if(focEl){
    focEl.style.transform=`translateY(${transY}vh) scaleY(${scaleY})`;
    focEl.style.opacity=String(lerp(.80,.98,openU));
  }

  // Respiración global (zoom + brillo + roll)
  const u=clamp((t-WORLD.t0)/(WORLD.t1-WORLD.t0),0,1);
  const breath=Math.sin(t*.55)*.5+.5;
  const roll=Math.sin(t*.18)*.4;
  const baseZoom=lerp(1.000,1.024,breath) * lerp(1.0,1.03,u*.6);
  const baseBright=lerp(1.00,1.044,breath) * lerp(1.00,1.03,u*.6);
  document.documentElement.style.setProperty('--v-zoom',   baseZoom.toFixed(3));
  document.documentElement.style.setProperty('--v-bright', baseBright.toFixed(3));
  document.documentElement.style.setProperty('--v-roll',   roll.toFixed(3)+'deg');
}

/* Gradiente de rayos (reutilizado) */
function ensureRayGradient(){
  if(rayGradient) return rayGradient;
  const g=fx.createLinearGradient(0,0,WORLD.w,0);
  g.addColorStop(0,'rgba(36,59,107,0)');
  g.addColorStop(.25,'rgba(215,200,255,.22)');
  g.addColorStop(.55,'rgba(255,218,107,.38)');
  g.addColorStop(.75,'rgba(242,239,233,.30)');
  g.addColorStop(1,'rgba(36,59,107,0)');
  rayGradient=g; return g;
}

/* Actualización/dibujo de rayos y notas */
function updateRays(t,dt){
  // Introducción de rayos (1:20–1:40)
  if(t>=80 && Rays.length===0){ Rays.push(makeRay(.32,WORLD.h*.10,0)); Rays.push(makeRay(.56,WORLD.h*.12,1)); }
  if(t>=90 && Rays.length===2 && DENSITY.raysMax>=3){ Rays.push(makeRay(.44,WORLD.h*.14,2)); }

  // Notas que viajan por los rayos
  if(Rays.length && (Notes.length<Rays.length*4) && chance(.03*dt*60)){
    const r=Rays[Math.floor(Math.random()*Rays.length)];
    spawnNote(r, rand(.08,.12));
  }

  // Avance y limpieza
  for(const n of Notes){ n.s += n.speed*dt*.18; if(n.s>=1) n.alive=false; }
  for(let i=Notes.length-1;i>=0;i--) if(!Notes[i].alive) Notes.splice(i,1);
}
function drawRaysAndNotes(t,dt){
  const cam=camOffset();
  fx.save(); fx.translate(cam.x*.2, cam.y*.2);

  if(Rays.length){
    fx.globalCompositeOperation='lighter';
    fx.lineCap='round'; fx.lineJoin='round';
    const g=ensureRayGradient();

    // Rayos
    for(const r of Rays){
      fx.strokeStyle=g; fx.lineWidth=r.width;
      fx.beginPath();
      for(let s=0;s<=1;s+=.025){
        const p=bezier(r.p0,r.p1,r.p2,r.p3,s);
        if(s===0) fx.moveTo(p.x,p.y); else fx.lineTo(p.x,p.y);
      }
      fx.stroke();
    }

    // Notas-luz
    for(const n of Notes){
      const p=bezier(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
      const q=bezierTangent(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
      const ang=Math.atan2(q.y,q.x), tail=14;

      fx.beginPath();
      fx.moveTo(p.x-Math.cos(ang)*tail, p.y-Math.sin(ang)*tail);
      fx.lineTo(p.x,p.y);
      fx.strokeStyle='rgba(255,218,107,.65)';
      fx.lineWidth=1.4; fx.stroke();

      fx.beginPath();
      fx.arc(p.x,p.y,n.size,0,Math.PI*2);
      fx.fillStyle='rgba(255,218,107,.92)';
      fx.shadowBlur=22; fx.shadowColor='rgba(215,200,255,.65)';
      fx.fill(); fx.shadowBlur=0;
    }
  }
  fx.restore();
}

/* Meteors */
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
    const k=m.age/m.life;
    const alpha=clamp(.6 - k*.6, 0, .6);
    const len=120*(1 - k*.2);
    const ang=Math.atan2(m.vy,m.vx);
    const ax=m.x - Math.cos(ang)*len;
    const ay=m.y - Math.sin(ang)*len;

    const grad=fx.createLinearGradient(ax,ay,m.x,m.y);
    grad.addColorStop(0,'rgba(215,200,255,0)');
    grad.addColorStop(.35,`rgba(215,200,255,${(.35*alpha).toFixed(3)})`);
    grad.addColorStop(.8, `rgba(255,218,107,${(.85*alpha).toFixed(3)})`);
    grad.addColorStop(1,'rgba(255,218,107,0)');
    fx.strokeStyle=grad; fx.lineWidth=m.w;
    fx.beginPath(); fx.moveTo(ax,ay); fx.lineTo(m.x,m.y); fx.stroke();

    fx.beginPath();
    fx.arc(m.x,m.y,1.4+(1.4*alpha),0,Math.PI*2);
    fx.fillStyle=`rgba(255,218,107,${.9*alpha})`;
    fx.fill();
  }
  fx.restore();
}

/* Drift */
function updateDrift(dt){
  const u=clamp((audio.currentTime - WORLD.t0)/(WORLD.t1 - WORLD.t0), 0, 1);
  WORLD.drift.t += dt * lerp(1.0, 1.15, u);
}

/* Abanico triple (2:18) */
function shootFanNotes(){
  if(!Rays.length) Rays.push(makeRay(.44, WORLD.h*.14, 2));
  const base=Rays[Math.floor(Math.random()*Rays.length)];
  for(let i=0;i<3;i++) spawnNote(base, rand(.10,.14));
}

/* Bucle principal */
function loop(){
  const now=performance.now();
  const dt=Math.min(.05, (now - WORLD.lastFrameMs)/1000);
  WORLD.lastFrameMs = now;

  // FPS medio para adaptación de densidad
  const fps=1/dt; WORLD.fpsAvg = WORLD.fpsAvg*.9 + fps*.1;
  if(!prefersReduced && Dust.length>PERF.dustMin && WORLD.fpsAvg<PERF.minFps){
    for(let i=0;i<10;i++) Dust.pop(); // reduce carga si cae FPS
  }

  const t=audio.currentTime || 0;

  // Guardia: nunca permitir < 1:01 una vez activo
  if(document.body.classList.contains('v-active') && t < WORLD.t0 - .05){
    audio.currentTime = WORLD.t0;
  }

  // Limpiar canvas
  bg.clearRect(0,0,WORLD.w,WORLD.h);
  fx.clearRect(0,0,WORLD.w,WORLD.h);

  // Estados/tiempo
  evalCues(t);
  heartbeat(t);

  // Updates
  updateDrift(dt);
  updateBokeh(dt);
  updateRays(t,dt);
  updateMeteors(dt);
  updateFocusAndBreathing(t,dt);

  // Draws
  drawBackground(t,dt);
  drawRaysAndNotes(t,dt);
  drawMeteors();

  // Siempre seguimos dibujando (aunque el audio se pause/bloquee)
  requestAnimationFrame(loop);
}

/* Boot */
function boot(){
  resize(); initDust(); initBokeh();

  // Seek seguro
  audio.addEventListener('seeked', ()=>{
    WORLD.eventClock.lastAt = audio.currentTime;
  });

  // Recuperar reproducción al volver a la pestaña
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && document.body.classList.contains('v-active') && audio.paused){
      audio.play().catch(()=>{ /* ignorar */ });
    }
  });
}
boot();


