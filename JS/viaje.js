/* =========================================================
   VIAJE — Planetarium ENHANCED (JS)
   Versión mejorada con efectos visuales espectaculares
   ========================================================= */
const stage     = document.querySelector('.stage');
const bgCanvas  = document.getElementById('bgCanvas');
const fxCanvas  = document.getElementById('fxCanvas');
const focEl     = document.querySelector('.foco-dorado');
const flashEl   = document.getElementById('v-flash');
const whisperEl = document.getElementById('v-whisper');
const btnStart  = document.getElementById('btnStart');
const audio     = document.getElementById('audio');
const noAudioMsg = document.getElementById('noAudioMsg');

if(!stage||!bgCanvas||!fxCanvas||!btnStart||!audio){
  console.error('[viaje] Falta estructura mínima en el HTML.');
}

const isCoarse = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let bg = bgCanvas.getContext('2d',{alpha:false});
let fx = fxCanvas.getContext('2d',{alpha:true});

const BASE_DPR_CAP_DESKTOP = 2.0;
const BASE_DPR_CAP_MOBILE  = 1.5;
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

const WORLD = {
  w: stage.clientWidth, h: stage.clientHeight,
  t0: 61.0, t1: 145.0,
  lastFrameMs: performance.now(), fpsAvg: 60,
  parallax:{x:0,y:0}, drift:{x:0,y:0,t:0},
  eventClock:{lastAt:61.0},
  ended:false,
  hasAudio: false
};

const QUALITY = { level: 2 };
let   RAY_STEP = 0.018;
let   SHADOW_BLUR = 28;
let   GLOW_INTENSITY = 1.4;

function setQuality(level){
  QUALITY.level = Math.max(0, Math.min(2, level));
  if (QUALITY.level === 2){ 
    dprCap = isCoarse ? 1.5 : 2.0; 
    RAY_STEP = 0.018; 
    SHADOW_BLUR = 28; 
    GLOW_INTENSITY = 1.4;
  }
  if (QUALITY.level === 1){ 
    dprCap = isCoarse ? 1.2 : 1.6; 
    RAY_STEP = 0.028; 
    SHADOW_BLUR = 18; 
    GLOW_INTENSITY = 1.2;
  }
  if (QUALITY.level === 0){ 
    dprCap = 1.0; 
    RAY_STEP = 0.045; 
    SHADOW_BLUR = 8; 
    GLOW_INTENSITY = 1.0;
  }
  resize();
}

function maybeAdjustQuality(){
  if (WORLD.fpsAvg < 35 && QUALITY.level > 0) setQuality(QUALITY.level-1);
}

let DENSITY = {
  dust:  prefersReduced ? 300 : (isCoarse ? 800 : 1400),
  bokeh: prefersReduced ? 12 : 28,
  raysMax: prefersReduced ? 2 : 4,
  meteorsMax: 4,
  particles: prefersReduced ? 0 : (isCoarse ? 20 : 40)
};

const PERF = { minFps: isCoarse?38:48, dustMin: isCoarse?500:900 };

const Dust=[], Bokeh=[], Rays=[], Notes=[], Meteors=[], Particles=[];
let nebulaSeed = Math.random()*1000;
let rayGradient=null;
let particleGradient=null;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=p=>Math.random()<p;

function easeInOutCubic(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function easeOutQuart(t){return 1-Math.pow(1-t,4)}
function easeInOutQuint(t){return t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2}

function camOffset(){
  const px=WORLD.parallax.x*14, py=WORLD.parallax.y*11;
  const dx=Math.sin(WORLD.drift.t*.15)*12, dy=Math.cos(WORLD.drift.t*.19)*10;
  return {x:px+dx,y:py+dy};
}

function initDust(){
  Dust.length=0;
  const n=DENSITY.dust;
  const R=Math.hypot(WORLD.w,WORLD.h)*.65;
  for(let i=0;i<n;i++){
    const r=Math.pow(Math.random(),.65)*R;
    const a=Math.random()*Math.PI*2;
    const hue=rand(35,55);
    Dust.push({
      r,a,z:rand(.5,1.0),
      tw:rand(.2,1.0),
      sp:rand(.0003,.0013),
      size:rand(.8,2.4),
      hue,
      bright:rand(.7,1.3)
    });
  }
}

function initBokeh(){
  Bokeh.length=0; 
  const n=DENSITY.bokeh;
  for(let i=0;i<n;i++){
    const hue=chance(.5)?45:chance(.5)?270:190;
    Bokeh.push({
      x:Math.random()*WORLD.w,
      y:Math.random()*WORLD.h,
      r:rand(30,140),
      s:rand(.04,.14),
      a:rand(.08,.28),
      dx:rand(-.08,.08),
      dy:rand(-.06,.06),
      hue,
      pulse:Math.random()*Math.PI*2
    });
  }
}

function initParticles(){
  if(prefersReduced) return;
  Particles.length=0;
  const n=DENSITY.particles;
  for(let i=0;i<n;i++){
    Particles.push({
      x:Math.random()*WORLD.w,
      y:Math.random()*WORLD.h,
      vx:rand(-.3,.3),
      vy:rand(-.3,.3),
      size:rand(.5,1.8),
      alpha:rand(.3,.8),
      hue:rand(30,60)
    });
  }
}

function makeRay(seedY,amp,k=0){
  const h= WORLD.h;
  const y0=lerp(h*.22,h*.78,seedY);
  const y1=y0 + amp*(k===0?1:(k%2===0?-1:1));
  const y2=y1 + amp*.65;
  const y3=lerp(h*.22,h*.78,seedY+.15);
  const x0=-WORLD.w*.25, x1=WORLD.w*.28, x2=WORLD.w*.68, x3=WORLD.w*1.2;
  return {
    p0:{x:x0,y:y0},p1:{x:x1,y:y1},p2:{x:x2,y:y2},p3:{x:x3,y:y3},
    width:1.8,glow:1.0,notes:[],
    colorShift:Math.random()
  };
}

function bezier(p0,p1,p2,p3,t){
  const it=1-t;
  return{
    x:it*it*it*p0.x+3*it*it*t*p1.x+3*it*t*t*p2.x+t*t*t*p3.x,
    y:it*it*it*p0.y+3*it*it*t*p1.y+3*it*t*t*p2.y+t*t*t*p3.y
  }
}

function bezierTangent(p0,p1,p2,p3,t){
  const it=1-t;
  return{
    x:-3*it*it*p0.x+3*(it*it-2*it*t)*p1.x+3*(2*it*t-t*t)*p2.x+3*t*t*p3.x,
    y:-3*it*it*p0.y+3*(it*it-2*it*t)*p1.y+3*(2*it*t-t*t)*p2.y+3*t*t*p3.y
  }
}

function spawnNote(ray,speed=rand(.09,.14)){
  if (WORLD.ended) return;
  Notes.push({
    ray,s:0,speed,
    size:rand(2.2,3.0),
    alive:true,
    hue:rand(40,55),
    pulse:Math.random()*Math.PI*2
  });
  WORLD.eventClock.lastAt=currentTime();
}

function spawnMeteor(opts={}){
  if (WORLD.ended) return;
  const side=chance(.5)?'L':'R';
  const x=opts.x ?? (side==='L'? rand(-WORLD.w*.15,WORLD.w*.3) : rand(WORLD.w*.7,WORLD.w*1.15));
  const y=opts.y ?? rand(WORLD.h*.08, WORLD.h*.85);
  const ang=opts.ang ?? (side==='L'? rand(-.3,-.15) : rand(Math.PI-(-.3), Math.PI-(-.15)));
  const spd=opts.spd ?? rand(450,650);
  const life=opts.life ?? rand(.5,.8);
  const hue=opts.hue ?? (chance(.6)?45:chance(.5)?270:190);
  Meteors.push({
    x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
    life,age:0,w:rand(1.5,2.2),hue,
    trail:[]
  });
  if(Meteors.length>DENSITY.meteorsMax) Meteors.shift();
  WORLD.eventClock.lastAt=currentTime();
}

let whisperQueue=["PROMESA","SIEMPRE","CLARO","BRILLANTE","INFINITO"];

function flash(ms=120){
  if(!flashEl || WORLD.ended) return;
  flashEl.classList.add('is-on');
  setTimeout(()=>flashEl.classList.remove('is-on'), ms);
  WORLD.eventClock.lastAt=currentTime();
}

function showWhisper(text,dur=1400){
  if(!whisperEl || WORLD.ended) return;
  whisperEl.textContent = text || whisperQueue.shift() || "";
  whisperEl.classList.add('show');
  setTimeout(()=> whisperEl.classList.remove('show'), dur);
  WORLD.eventClock.lastAt=currentTime();
}

btnStart?.addEventListener('click', startAt61);

async function startAt61(){
  const SEEK=61.0;
  document.body.classList.add('v-active');
  
  if(!WORLD.hasAudio){
    console.warn('Iniciando sin audio');
    WORLD.startTime = performance.now();
    loop();
    return;
  }
  
  const forceSeek=()=>{try{audio.currentTime=SEEK}catch{}};
  if(audio.readyState>=1) forceSeek(); 
  else audio.addEventListener('loadedmetadata', forceSeek, { once:true });
  forceSeek();
  
  try{
    const p=audio.play();
    audio.addEventListener('play', ()=>{ 
      if(audio.currentTime<SEEK-.2) forceSeek(); 
    }, { once:true });
    await p;
  }catch(e){ console.warn('Play bloqueado:', e); }
  
  WORLD.eventClock.lastAt=SEEK;
  loop();
}

stage.addEventListener('pointermove', (e)=>{
  const r=stage.getBoundingClientRect();
  WORLD.parallax.x=clamp(((e.clientX-r.left)/r.width)*2-1,-1,1);
  WORLD.parallax.y=clamp(((e.clientY-r.top )/r.height)*2-1,-1,1);
  document.body.classList.add('v-boost-stars');
  clearTimeout(window.__boost_t);
  window.__boost_t=setTimeout(()=>document.body.classList.remove('v-boost-stars'), 400);
});

stage.addEventListener('pointerdown', (e)=>{
  if (WORLD.ended) return;
  const el=document.createElement('div');
  el.className='tap-note'; 
  el.style.left=e.clientX+'px'; 
  el.style.top=e.clientY+'px';
  stage.appendChild(el); 
  setTimeout(()=>el.remove(),1400);
  
  // Spawn particles extra
  if(!prefersReduced){
    for(let i=0;i<5;i++){
      setTimeout(()=>{
        if(Particles.length < DENSITY.particles*2){
          Particles.push({
            x:e.clientX,y:e.clientY,
            vx:rand(-2,2),vy:rand(-3,-1),
            size:rand(1,2.5),alpha:rand(.6,1),
            hue:rand(35,55),life:rand(.8,1.5),age:0
          });
        }
      }, i*30);
    }
  }
});

const cues = [
  {t:66,  once:false, hit:(t)=>{ if(t<86) showWhisper("PROMESA",1300); }},
  {t:72,  once:true,  hit:()=> heartbeatKick(true)},
  {t:78,  once:true,  hit:()=> spawnMeteor({hue:270})},
  {t:84,  once:true,  hit:()=> spawnMeteor({ang:-.24, spd:560, hue:45})},
  {t:88,  once:true,  hit:()=> { 
    document.body.classList.add('v-boost-stars'); 
    setTimeout(()=>document.body.classList.remove('v-boost-stars'),700); 
  }},
  {t:96,  once:true,  hit:()=> showWhisper("SIEMPRE",1200)},
  {t:100, once:true,  hit:()=> bokehIn=1 },
  {t:102, once:true,  hit:()=> flash(130) },
  {t:108, once:true,  hit:()=> flash(120) },
  {t:110, once:true,  hit:()=> Rays.forEach(r=> r.glow=1.3) },
  {t:116, once:true,  hit:()=> { 
    spawnMeteor({ang:-.22,spd:620,hue:190}); 
    setTimeout(()=>spawnMeteor({ang:Math.PI-(-.22),spd:620,hue:270}), 80); 
  }},
  {t:124, once:false, hit:()=> { 
    document.body.classList.add('v-ramp-1'); 
    showWhisper("CLARO",1300); 
  }},
  {t:132, once:true, hit:()=> flash(110)},
  {t:138, once:true,  hit:()=> shootFanNotes() },
  {t:140, once:false, hit:()=> document.body.classList.add('v-preclimax') },
  {t:143, once:true,  hit:()=> flash(140) }
];
cues.forEach(c=>c._last=-Infinity);

function evalCues(t){
  if (WORLD.ended) return;
  for(const c of cues){
    if(Math.abs(t - c.t) <= 0.12){
      if(c.once && (t - c._last) < 2.0) continue;
      c.hit(t); c._last=t; WORLD.eventClock.lastAt=t;
    }
  }
  if(t>=124) document.body.classList.add('v-ramp-1'); 
  else document.body.classList.remove('v-ramp-1');
  if(t>=140) document.body.classList.add('v-preclimax'); 
  else document.body.classList.remove('v-preclimax');
}

function heartbeatPeriod(t){
  const u=clamp((t - WORLD.t0)/(WORLD.t1 - WORLD.t0), 0, 1);
  return lerp(2.2, 1.4, u);
}

function heartbeatKick(gentle=false){
  const t=currentTime();
  if (t >= WORLD.t1 - 2.0) return;
  if(gentle || chance(.6)){
    if(Rays.length){ 
      const r=Rays[Math.floor(Math.random()*Rays.length)]; 
      spawnNote(r, rand(.09,.13)); 
    }
    else { spawnMeteor({ spd:rand(440,520), life:rand(.45,.65) }); }
  } else {
    spawnMeteor();
  }
}

function heartbeat(t){
  if (WORLD.ended) return;
  const p=heartbeatPeriod(t);
  if((t - WORLD.eventClock.lastAt) >= p){
    heartbeatKick(); 
    WORLD.eventClock.lastAt = t;
  }
}

const currentTime = () => {
  if(WORLD.hasAudio) return audio.currentTime || 0;
  if(!WORLD.startTime) WORLD.startTime = performance.now();
  return WORLD.t0 + (performance.now() - WORLD.startTime)/1000;
};

let bokehIn=0;

function updateBokeh(dt){
  if (WORLD.ended) return;
  if (bokehIn>0) bokehIn=clamp(bokehIn + dt*.4, 0, 1);
  for(const b of Bokeh){
    b.x+=b.dx*dt*60; b.y+=b.dy*dt*60;
    b.pulse += dt*1.5;
    if(b.x<-b.r) b.x+=WORLD.w+b.r*2; 
    if(b.x>WORLD.w+b.r) b.x-=WORLD.w+b.r*2;
    if(b.y<-b.r) b.y+=WORLD.h+b.r*2; 
    if(b.y>WORLD.h+b.r) b.y-=WORLD.h+b.r*2;
  }
}

function updateParticles(dt){
  if(prefersReduced) return;
  for(const p of Particles){
    if(p.life !== undefined){
      p.age += dt;
      if(p.age > p.life){ p.alpha = 0; continue; }
      p.alpha = (1 - p.age/p.life) * .8;
    }
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    if(p.x<0||p.x>WORLD.w||p.y<0||p.y>WORLD.h) p.alpha = 0;
  }
  for(let i=Particles.length-1;i>=0;i--){
    if(Particles[i].alpha <= 0) Particles.splice(i,1);
  }
}

function drawBackground(t,dt){
  const {w,h}=WORLD, cam=camOffset();
  
  // Gradiente de fondo más profundo y dinámico
  const g=bg.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#000000');
  g.addColorStop(.25,'#050814'); 
  g.addColorStop(.5,'#0a0f1f'); 
  g.addColorStop(.75,'#050814'); 
  g.addColorStop(1,'#000000');
  bg.fillStyle=g; 
  bg.fillRect(0,0,w,h);

  // Nebulosas más vibrantes y coloridas
  nebulaSeed+=dt*.06;
  const nebulas = [
    {hue:220, sat:60, light:25, size:1.0},
    {hue:280, sat:70, light:30, size:0.85},
    {hue:45, sat:65, light:28, size:0.9}
  ];
  
  for(let i=0;i<nebulas.length;i++){
    const neb = nebulas[i];
    const nx=(Math.sin(nebulaSeed*.6+i*1.9)*.5+.5)*w;
    const ny=(Math.cos(nebulaSeed*.5+i*2.3)*.5+.5)*h;
    const r=lerp(300,500,neb.size);
    const grad=bg.createRadialGradient(nx+cam.x*.25, ny+cam.y*.2, r*.05, nx+cam.x*.25, ny+cam.y*.2, r);
    grad.addColorStop(0,`hsla(${neb.hue},${neb.sat}%,${neb.light}%,.35)`);
    grad.addColorStop(.5,`hsla(${neb.hue},${neb.sat}%,${neb.light*.7}%,.18)`);
    grad.addColorStop(1,'rgba(5,8,20,0)');
    bg.globalCompositeOperation='screen';
    bg.fillStyle=grad; 
    bg.beginPath(); 
    bg.arc(nx,ny,r,0,Math.PI*2); 
    bg.fill();
  }

  // Polvo estelar más brillante y colorido
  bg.save(); 
  bg.translate(w*.5+cam.x*.4, h*.45+cam.y*.35); 
  bg.globalCompositeOperation='lighter';
  
  for(const p of Dust){
    p.a+=p.sp*dt*60;
    const x=Math.cos(p.a)*p.r*.7, y=Math.sin(p.a)*p.r*.42;
    const tw=(Math.sin(t*2.3 + p.r*.008)*.5+.5)*p.tw;
    const baseAlpha=(.08+.08*p.z)*(.65 + .35*tw);
    const alpha = baseAlpha * p.bright;
    
    bg.fillStyle=`hsla(${p.hue},85%,65%,${alpha.toFixed(3)})`;
    const sz = p.size * (1 + tw*.2);
    bg.fillRect(x-sz/2,y-sz/2,sz,sz);
    
    // Glow extra para polvo más grande
    if(p.size > 1.8 && !prefersReduced){
      bg.fillStyle=`hsla(${p.hue},90%,75%,${(alpha*.3).toFixed(3)})`;
      bg.fillRect(x-sz,y-sz,sz*2,sz*2);
    }
  }
  bg.restore();

  // Bokeh mejorado con pulso
  if (bokehIn>0){
    bg.save(); 
    bg.globalCompositeOperation='screen';
    for(const b of Bokeh){
      const pulseFactor = Math.sin(b.pulse)*.15 + .85;
      const rad = b.r * pulseFactor;
      const grad=bg.createRadialGradient(
        b.x+cam.x*.12,b.y+cam.y*.12,rad*.2,
        b.x+cam.x*.12,b.y+cam.y*.12,rad
      );
      grad.addColorStop(0,`hsla(${b.hue},75%,70%,${(.08*b.a*bokehIn*pulseFactor).toFixed(3)})`);
      grad.addColorStop(.6,`hsla(${b.hue},65%,55%,${(.04*b.a*bokehIn*pulseFactor).toFixed(3)})`);
      grad.addColorStop(1,'rgba(5,8,20,0)');
      bg.fillStyle=grad; 
      bg.beginPath(); 
      bg.arc(b.x,b.y,rad,0,Math.PI*2); 
      bg.fill();
    }
    bg.restore();
  }
  
  // Partículas flotantes
  if(!prefersReduced && Particles.length){
    bg.save();
    bg.globalCompositeOperation='lighter';
    for(const p of Particles){
      if(p.alpha <= 0) continue;
      bg.fillStyle=`hsla(${p.hue},80%,70%,${(p.alpha*.6).toFixed(3)})`;
      bg.beginPath();
      bg.arc(p.x+cam.x*.08, p.y+cam.y*.08, p.size, 0, Math.PI*2);
      bg.fill();
    }
    bg.restore();
  }
}

function updateFocusAndBreathing(t,dt){
  // Apertura del foco 1:01–1:22
  const openU=clamp((t-61)/21,0,1);
  const scaleY=lerp(1,1.28,easeInOutCubic(openU));
  const transY=lerp(0,8,easeOutQuart(openU));
  if(focEl){
    focEl.style.transform=`translateY(${transY}vh) scaleY(${scaleY})`;
    focEl.style.opacity=String(lerp(.75,1.05,openU));
  }

  // Respiración mejorada
  const u=clamp((t-WORLD.t0)/(WORLD.t1-WORLD.t0),0,1);
  const breath=Math.sin(t*.6)*.5+.5;
  const roll=Math.sin(t*.2)*.5;
  let baseZoom=lerp(1.000,1.032,breath)*lerp(1.0,1.04,u*.65);
  let baseBright=lerp(1.08,1.12,breath)*lerp(1.08,1.15,u*.7);

  // Fade a negro 2:23 → 2:25
  if (t >= 143){
    const k = clamp((t - 143) / 2.0, 0, 1);
    baseBright *= (1 - k*.95);
    if (k >= .98) {
      document.body.classList.add('v-end');
      WORLD.ended = true;
    }
  }
  
  document.documentElement.style.setProperty('--v-zoom',   baseZoom.toFixed(4));
  document.documentElement.style.setProperty('--v-bright', baseBright.toFixed(4));
  document.documentElement.style.setProperty('--v-roll',   roll.toFixed(3)+'deg');
}

function ensureRayGradient(){
  if (rayGradient) return rayGradient;
  const g=fx.createLinearGradient(0,0,WORLD.w,0);
  g.addColorStop(0,'rgba(30,58,138,0)');
  g.addColorStop(.15,'rgba(168,85,247,.15)');
  g.addColorStop(.35,'rgba(196,181,253,.35)');
  g.addColorStop(.55,'rgba(251,191,36,.55)');
  g.addColorStop(.75,'rgba(254,243,199,.40)');
  g.addColorStop(.9,'rgba(6,182,212,.20)');
  g.addColorStop(1,'rgba(30,58,138,0)');
  rayGradient=g; 
  return g;
}

function updateRays(t,dt){
  if (WORLD.ended) return;
  if(t>=80 && Rays.length===0){ 
    Rays.push(makeRay(.30,WORLD.h*.11,0)); 
    Rays.push(makeRay(.58,WORLD.h*.13,1)); 
  }
  if(t>=90 && Rays.length===2 && DENSITY.raysMax>=3){ 
    Rays.push(makeRay(.44,WORLD.h*.15,2)); 
  }
  if(t>=110 && Rays.length===3 && DENSITY.raysMax>=4){
    Rays.push(makeRay(.66,WORLD.h*.12,3));
  }

  const spawnRate = QUALITY.level===0 ? .022 : QUALITY.level===1 ? .032 : .038;
  if(Rays.length && (Notes.length<Rays.length*5) && chance(spawnRate*dt*60)){
    const r=Rays[Math.floor(Math.random()*Rays.length)]; 
    spawnNote(r, rand(.09,.14));
  }

  for(const n of Notes){ 
    n.s += n.speed*dt*.2; 
    n.pulse += dt*3;
    if(n.s>=1) n.alive=false; 
  }
  for(let i=Notes.length-1;i>=0;i--) {
    if(!Notes[i].alive) Notes.splice(i,1);
  }
}

function drawRaysAndNotes(t,dt){
  if (!Rays.length && !Notes.length) return;
  const cam=camOffset();
  fx.save(); 
  fx.translate(cam.x*.25, cam.y*.25);
  fx.globalCompositeOperation='lighter';
  fx.lineCap='round'; 
  fx.lineJoin='round';

  const g=ensureRayGradient();
  
  // Dibujar rayos con más grosor y glow
  for(const r of Rays){
    fx.strokeStyle=g; 
    fx.lineWidth=r.width * r.glow * GLOW_INTENSITY; 
    fx.shadowBlur = SHADOW_BLUR * r.glow;
    fx.shadowColor = 'rgba(251,191,36,.4)';
    fx.beginPath();
    for(let s=0;s<=1;s+=RAY_STEP){
      const p=bezier(r.p0,r.p1,r.p2,r.p3,s);
      if(s===0) fx.moveTo(p.x,p.y); else fx.lineTo(p.x,p.y);
    }
    fx.stroke();
    fx.shadowBlur = 0;
  }

  // Dibujar notas con efecto de pulso y trail
  for(const n of Notes){
    const p=bezier(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
    const q=bezierTangent(n.ray.p0,n.ray.p1,n.ray.p2,n.ray.p3,n.s);
    const ang=Math.atan2(q.y,q.x);
    const tail=18;
    const pulseFactor = Math.sin(n.pulse)*.2 + .8;
    
    // Trail
    fx.beginPath();
    fx.moveTo(p.x-Math.cos(ang)*tail, p.y-Math.sin(ang)*tail);
    fx.lineTo(p.x,p.y);
    fx.strokeStyle=`hsla(${n.hue},90%,65%,.75)`;
    fx.lineWidth=2; 
    fx.stroke();

    // Núcleo con glow
    const sz = n.size * pulseFactor;
    fx.beginPath();
    fx.arc(p.x,p.y,sz,0,Math.PI*2);
    fx.fillStyle=`hsla(${n.hue},95%,75%,.95)`;
    if (SHADOW_BLUR>0){ 
      fx.shadowBlur=SHADOW_BLUR*1.2; 
      fx.shadowColor=`hsla(${n.hue},90%,70%,.7)`; 
    }
    fx.fill(); 
    fx.shadowBlur=0;
    
    // Halo exterior
    fx.beginPath();
    fx.arc(p.x,p.y,sz*1.8,0,Math.PI*2);
    fx.fillStyle=`hsla(${n.hue},85%,70%,.25)`;
    fx.fill();
  }
  fx.restore();
}

function updateMeteors(dt){
  for(const m of Meteors){ 
    m.age+=dt; 
    m.x+=m.vx*dt; 
    m.y+=m.vy*dt;
    
    // Trail effect
    if(m.trail.length < 15){
      m.trail.push({x:m.x, y:m.y});
    } else {
      m.trail.shift();
      m.trail.push({x:m.x, y:m.y});
    }
  }
  for(let i=Meteors.length-1;i>=0;i--){
    const m=Meteors[i];
    if(m.age>m.life || m.x<-300 || m.x>WORLD.w+300 || m.y<-300 || m.y>WORLD.h+300){
      Meteors.splice(i,1);
    }
  }
}

function drawMeteors(){
  if(!Meteors.length) return;
  const cam=camOffset();
  fx.save(); 
  fx.translate(cam.x*.15, cam.y*.15);
  fx.globalCompositeOperation='lighter'; 
  fx.lineCap='round';
  
  for(const m of Meteors){
    const k=m.age/m.life;
    const alpha=clamp(.7 - k*.7, 0, .7);
    const len=140*(1 - k*.25);
    const ang=Math.atan2(m.vy,m.vx);
    const ax=m.x-Math.cos(ang)*len;
    const ay=m.y-Math.sin(ang)*len;
    
    // Trail con gradiente colorido
    const grad=fx.createLinearGradient(ax,ay,m.x,m.y);
    grad.addColorStop(0,`hsla(${m.hue},70%,60%,0)`);
    grad.addColorStop(.25,`hsla(${m.hue},80%,65%,${(.25*alpha).toFixed(3)})`);
    grad.addColorStop(.6,`hsla(${m.hue},90%,70%,${(.65*alpha).toFixed(3)})`);
    grad.addColorStop(1,`hsla(${m.hue},95%,75%,0)`);
    
    fx.strokeStyle=grad; 
    fx.lineWidth=m.w*1.3;
    fx.beginPath(); 
    fx.moveTo(ax,ay); 
    fx.lineTo(m.x,m.y); 
    fx.stroke();

    // Núcleo brillante
    fx.beginPath();
    const coreSize = 2.2 + (2.2*alpha);
    fx.arc(m.x,m.y,coreSize,0,Math.PI*2);
    fx.fillStyle=`hsla(${m.hue},100%,85%,${.95*alpha})`;
    fx.shadowBlur = 20;
    fx.shadowColor = `hsla(${m.hue},90%,75%,${.8*alpha})`;
    fx.fill();
    fx.shadowBlur = 0;
    
    // Halo
    fx.beginPath();
    fx.arc(m.x,m.y,coreSize*2.5,0,Math.PI*2);
    fx.fillStyle=`hsla(${m.hue},85%,75%,${.2*alpha})`;
    fx.fill();
  }
  fx.restore();
}

function updateDrift(dt){
  const u=clamp((currentTime() - WORLD.t0)/(WORLD.t1 - WORLD.t0),0,1);
  WORLD.drift.t += dt * lerp(1.0,1.18,u);
}

function shootFanNotes(){
  if(!Rays.length) Rays.push(makeRay(.44, WORLD.h*.15, 2));
  const base=Rays[Math.floor(Math.random()*Rays.length)];
  for(let i=0;i<4;i++){
    setTimeout(()=> spawnNote(base, rand(.11,.16)), i*60);
  }
}

function loop(){
  const now=performance.now();
  const dt=Math.min(.05, (now - WORLD.lastFrameMs)/1000);
  WORLD.lastFrameMs = now;

  const fps=1/dt; 
  WORLD.fpsAvg = WORLD.fpsAvg*.92 + fps*.08;
  
  if(!prefersReduced && Dust.length>PERF.dustMin && WORLD.fpsAvg<PERF.minFps){
    for(let i=0;i<15;i++) Dust.pop();
  }
  maybeAdjustQuality();

  const t=currentTime();

  if(document.body.classList.contains('v-active') && WORLD.hasAudio && t < WORLD.t0 - .05){
    audio.currentTime = WORLD.t0;
  }

  if (t >= WORLD.t1 && !WORLD.ended){
    document.body.classList.add('v-end');
    WORLD.ended = true;
  }

  bg.clearRect(0,0,WORLD.w,WORLD.h);
  fx.clearRect(0,0,WORLD.w,WORLD.h);

  if (!WORLD.ended){
    evalCues(t);
    heartbeat(t);
    updateDrift(dt);
    updateBokeh(dt);
    updateRays(t,dt);
    updateMeteors(dt);
    updateParticles(dt);
  }

  updateFocusAndBreathing(t,dt);

  drawBackground(t,dt);
  drawRaysAndNotes(t,dt);
  drawMeteors();

  const endedAndBlack = document.body.classList.contains('v-end') && 
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-bright')) <= 0.05;
  
  if (!endedAndBlack){
    requestAnimationFrame(loop);
  } else {
    bg.clearRect(0,0,WORLD.w,WORLD.h);
    fx.clearRect(0,0,WORLD.w,WORLD.h);
  }
}

function boot(){
  setQuality( isCoarse ? 1 : 2 );
  resize(); 
  initDust(); 
  initBokeh();
  initParticles();

  audio.addEventListener('error', ()=>{
    console.warn('No se pudo cargar el audio');
    WORLD.hasAudio = false;
    if(noAudioMsg) noAudioMsg.classList.remove('hidden');
  });

  audio.addEventListener('canplaythrough', ()=>{
    WORLD.hasAudio = true;
    if(noAudioMsg) noAudioMsg.classList.add('hidden');
  }, { once: true });

  audio.addEventListener('seeked', ()=>{ 
    WORLD.eventClock.lastAt = currentTime(); 
  });

  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && 
       document.body.classList.contains('v-active') && 
       audio.paused && !WORLD.ended && WORLD.hasAudio){
      audio.play().catch(()=>{});
    }
  });
}

// INICIAR AL CARGAR
boot();
