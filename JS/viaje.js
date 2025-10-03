/* =========================================================
   VIAJE — Galaxia Espiral COMPLETA
   ========================================================= */

const stage = document.querySelector('.stage');
const bgCanvas = document.getElementById('bgCanvas');
const fxCanvas = document.getElementById('fxCanvas');
const flashEl = document.getElementById('v-flash');
const whisperEl = document.getElementById('v-whisper');
const btnStart = document.getElementById('btnStart');
const audio = document.getElementById('audio');
const noAudioMsg = document.getElementById('noAudioMsg');

if(!stage||!bgCanvas||!fxCanvas||!btnStart||!audio){
  console.error('[viaje] Elementos HTML faltantes');
}

const isCoarse = matchMedia('(pointer:coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

let bg = bgCanvas.getContext('2d',{alpha:false});
let fx = fxCanvas.getContext('2d',{alpha:true});

function getDPR(){return Math.min(window.devicePixelRatio||1, isCoarse?1.5:2)}

function resize(){
  const dpr=getDPR();
  const w=Math.floor(stage.clientWidth*dpr);
  const h=Math.floor(stage.clientHeight*dpr);
  [bgCanvas,fxCanvas].forEach(cv=>{
    cv.width=w;cv.height=h;
    cv.style.width=stage.clientWidth+'px';
    cv.style.height=stage.clientHeight+'px';
  });
  bg.setTransform(1,0,0,1,0,0);fx.setTransform(1,0,0,1,0,0);
  bg.scale(dpr,dpr);fx.scale(dpr,dpr);
  WORLD.w=stage.clientWidth;WORLD.h=stage.clientHeight;
  WORLD.cx=WORLD.w/2;WORLD.cy=WORLD.h/2;
}

addEventListener('resize',resize);

const WORLD = {
  w: stage.clientWidth,
  h: stage.clientHeight,
  cx: stage.clientWidth / 2,
  cy: stage.clientHeight / 2,
  t0: 61.0,          // punto de entrada
  t1: 239.0,         // ← antes 145  (3:59 exactos)
  rotation: 0,
  parallax: { x: 0, y: 0 },
  ended: false,
  hasAudio: false,
  startTime: null
};
// Galaxia espiral
const Galaxy={
  arms:[],
  stars:[],
  dust:[],
  numArms:4,
  armSeparation:Math.PI*2/4
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=p=>Math.random()<p;

// Inicializar galaxia espiral
function initGalaxy(){
  Galaxy.arms=[];
  Galaxy.stars=[];
  Galaxy.dust=[];
  
  const numStarsPerArm=prefersReduced?150:(isCoarse?300:500);
  const numDust=prefersReduced?200:(isCoarse?400:800);
  
  // Crear brazos espirales
  for(let arm=0;arm<Galaxy.numArms;arm++){
    const armData={
      angle:arm*Galaxy.armSeparation,
      stars:[],
      color:{h:rand(180,240),s:rand(70,90),l:rand(50,70)}
    };
    
    for(let i=0;i<numStarsPerArm;i++){
      const t=i/numStarsPerArm;
      const spiralTightness=3;
      const radius=t*Math.min(WORLD.w,WORLD.h)*0.45;
      const angle=armData.angle+t*spiralTightness*Math.PI*2;
      
      // Dispersión perpendicular al brazo
      const spread=rand(-25,25)*(1-t*0.5);
      const px=Math.cos(angle)*radius+Math.cos(angle+Math.PI/2)*spread;
      const py=Math.sin(angle)*radius+Math.sin(angle+Math.PI/2)*spread;
      
      const star={
        x:px,y:py,
        baseX:px,baseY:py,
        radius,angle,
        size:rand(0.5,2.5)*(1-t*0.3),
        brightness:rand(0.6,1),
        speed:rand(0.0003,0.0008)*(1-t*0.4),
        hue:armData.color.h+rand(-20,20),
        sat:armData.color.s+rand(-10,10),
        light:armData.color.l+rand(-15,15),
        pulse:Math.random()*Math.PI*2,
        pulseSpeed:rand(0.5,2),
        depth:rand(0.3,1)
      };
      
      armData.stars.push(star);
      Galaxy.stars.push(star);
    }
    
    Galaxy.arms.push(armData);
  }
  
  // Polvo interestelar
  for(let i=0;i<numDust;i++){
    const angle=Math.random()*Math.PI*2;
    const radius=Math.pow(Math.random(),0.7)*Math.min(WORLD.w,WORLD.h)*0.5;
    
    Galaxy.dust.push({
      x:Math.cos(angle)*radius,
      y:Math.sin(angle)*radius,
      size:rand(1,3),
      alpha:rand(0.1,0.4),
      hue:rand(200,280),
      speed:rand(0.0001,0.0004)
    });
  }
}

// Actualizar rotación de galaxia
function updateGalaxy(dt){
  if(WORLD.ended)return;
  
  const speedMult=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rotation-speed'))||1;
  WORLD.rotation+=dt*0.08*speedMult;
  
  // Actualizar estrellas
  for(const star of Galaxy.stars){
    star.pulse+=dt*star.pulseSpeed;
    star.angle+=star.speed*dt*60;
    
    // Posición orbital
    star.x=Math.cos(star.angle)*star.radius;
    star.y=Math.sin(star.angle)*star.radius;
  }
  
  // Actualizar polvo
  for(const d of Galaxy.dust){
    const angle=Math.atan2(d.y,d.x);
    const radius=Math.hypot(d.x,d.y);
    const newAngle=angle+d.speed*dt*60;
    d.x=Math.cos(newAngle)*radius;
    d.y=Math.sin(newAngle)*radius;
  }
}

// Dibujar galaxia
function drawGalaxy(){
  const {w,h,cx,cy}=WORLD;
  
  // Fondo negro profundo
  bg.fillStyle='#000';
  bg.fillRect(0,0,w,h);
  
  bg.save();
  bg.translate(cx,cy);
  bg.rotate(WORLD.rotation);
  
  const px=WORLD.parallax.x*20;
  const py=WORLD.parallax.y*15;
  bg.translate(px,py);
  
  // Dibujar polvo primero (capa de fondo)
  bg.globalCompositeOperation='screen';
  for(const d of Galaxy.dust){
    const grad=bg.createRadialGradient(d.x,d.y,0,d.x,d.y,d.size*3);
    grad.addColorStop(0,`hsla(${d.hue},70%,60%,${d.alpha})`);
    grad.addColorStop(1,'transparent');
    bg.fillStyle=grad;
    bg.fillRect(d.x-d.size*3,d.y-d.size*3,d.size*6,d.size*6);
  }
  
  // Dibujar brazos espirales con glow
  bg.globalCompositeOperation='lighter';
  
  for(const arm of Galaxy.arms){
    // Glow del brazo
    for(let i=0;i<arm.stars.length-1;i++){
      const s1=arm.stars[i];
      const s2=arm.stars[i+1];
      
      const grad=bg.createLinearGradient(s1.x,s1.y,s2.x,s2.y);
      grad.addColorStop(0,`hsla(${arm.color.h},${arm.color.s}%,${arm.color.l}%,0.08)`);
      grad.addColorStop(1,`hsla(${arm.color.h},${arm.color.s}%,${arm.color.l}%,0.08)`);
      
      bg.strokeStyle=grad;
      bg.lineWidth=8;
      bg.beginPath();
      bg.moveTo(s1.x,s1.y);
      bg.lineTo(s2.x,s2.y);
      bg.stroke();
    }
  }
  
  // Dibujar estrellas individuales
  for(const star of Galaxy.stars){
    const pulseFactor=Math.sin(star.pulse)*0.3+0.7;
    const size=star.size*pulseFactor*star.depth;
    const brightness=star.brightness*pulseFactor;
    
    // Núcleo de estrella
    bg.fillStyle=`hsla(${star.hue},${star.sat}%,${star.light}%,${brightness})`;
    bg.beginPath();
    bg.arc(star.x,star.y,size,0,Math.PI*2);
    bg.fill();
    
    // Glow si es grande
    if(star.size>1.5){
      const glowGrad=bg.createRadialGradient(star.x,star.y,0,star.x,star.y,size*4);
      glowGrad.addColorStop(0,`hsla(${star.hue},${star.sat}%,${star.light+10}%,${brightness*0.4})`);
      glowGrad.addColorStop(1,'transparent');
      bg.fillStyle=glowGrad;
      bg.beginPath();
      bg.arc(star.x,star.y,size*4,0,Math.PI*2);
      bg.fill();
    }
  }
  
  bg.restore();
}

// Supernovas y efectos especiales
const Supernovas=[];

function spawnSupernova(){
  if(WORLD.ended)return;
  
  const angle=Math.random()*Math.PI*2;
  const radius=rand(100,Math.min(WORLD.w,WORLD.h)*0.4);
  
  Supernovas.push({
    x:Math.cos(angle)*radius,
    y:Math.sin(angle)*radius,
    age:0,
    life:rand(1.5,2.5),
    size:rand(3,6),
    hue:rand(180,280),
    particles:[]
  });
}

function updateSupernovas(dt){
  for(const sn of Supernovas){
    sn.age+=dt;
    
    // Generar partículas
    if(sn.age<sn.life*0.3&&chance(0.3)){
      for(let i=0;i<3;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=rand(50,150);
        sn.particles.push({
          x:0,y:0,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed,
          size:rand(1,2),
          alpha:1,
          hue:sn.hue+rand(-30,30)
        });
      }
    }
    
    // Actualizar partículas
    for(const p of sn.particles){
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.alpha-=dt*0.5;
    }
  }
  
  // Limpiar supernovas muertas
  for(let i=Supernovas.length-1;i>=0;i--){
    if(Supernovas[i].age>Supernovas[i].life){
      Supernovas.splice(i,1);
    }
  }
}

function drawSupernovas(){
  if(!Supernovas.length)return;
  
  fx.save();
  fx.translate(WORLD.cx,WORLD.cy);
  fx.rotate(WORLD.rotation);
  fx.globalCompositeOperation='lighter';
  
  for(const sn of Supernovas){
    const progress=sn.age/sn.life;
    const alpha=1-progress;
    const size=sn.size*(1+progress*5);
    
    // Núcleo brillante
    const coreGrad=fx.createRadialGradient(sn.x,sn.y,0,sn.x,sn.y,size);
    coreGrad.addColorStop(0,`hsla(${sn.hue},100%,90%,${alpha})`);
    coreGrad.addColorStop(0.5,`hsla(${sn.hue},90%,70%,${alpha*0.6})`);
    coreGrad.addColorStop(1,'transparent');
    fx.fillStyle=coreGrad;
    fx.beginPath();
    fx.arc(sn.x,sn.y,size,0,Math.PI*2);
    fx.fill();
    
    // Ondas de choque
    if(progress<0.5){
      fx.strokeStyle=`hsla(${sn.hue},80%,70%,${(1-progress*2)*0.5})`;
      fx.lineWidth=2;
      fx.beginPath();
      fx.arc(sn.x,sn.y,size*progress*10,0,Math.PI*2);
      fx.stroke();
    }
    
    // Partículas
    for(const p of sn.particles){
      if(p.alpha<=0)continue;
      fx.fillStyle=`hsla(${p.hue},85%,65%,${p.alpha})`;
      fx.beginPath();
      fx.arc(sn.x+p.x,sn.y+p.y,p.size,0,Math.PI*2);
      fx.fill();
    }
  }
  
  fx.restore();
}

// Eventos de audio
let whisperQueue=["COSMOS","INFINITO","ETERNO","BRILLANTE"];

function flash(ms=150){
  if(!flashEl||WORLD.ended)return;
  flashEl.classList.add('is-on');
  setTimeout(()=>flashEl.classList.remove('is-on'),ms);
}

function showWhisper(text,dur=1500){
  if(!whisperEl||WORLD.ended)return;
  whisperEl.textContent=text||whisperQueue.shift()||"";
  whisperEl.classList.add('show');
  setTimeout(()=>whisperEl.classList.remove('show'),dur);
}

// Cues de eventos
const cues=[
  {t:66,once:false,hit:()=>showWhisper("COSMOS",1400)},
  {t:75,once:true,hit:()=>spawnSupernova()},
  {t:85,once:true,hit:()=>{spawnSupernova();flash(140)}},
  {t:95,once:true,hit:()=>showWhisper("INFINITO",1300)},
  {t:102,once:true,hit:()=>flash(130)},
  {t:110,once:true,hit:()=>{spawnSupernova();spawnSupernova()}},
  {t:124,once:false,hit:()=>{document.body.classList.add('v-ramp-1');showWhisper("ETERNO",1400)}},
  {t:135,once:true,hit:()=>{flash(150);spawnSupernova()}},
  {t:140,once:false,hit:()=>document.body.classList.add('v-preclimax')},
  {t:143,once:true,hit:()=>flash(160)}
];
cues.forEach(c=>c._last=-Infinity);

function evalCues(t){
  if(WORLD.ended)return;
  for(const c of cues){
    if(Math.abs(t-c.t)<=0.15){
      if(c.once&&(t-c._last)<2)continue;
      c.hit();c._last=t;
    }
  }
}

// Control de tiempo
const currentTime=()=>{
  if(WORLD.hasAudio)return audio.currentTime||0;
  if(!WORLD.startTime)WORLD.startTime=performance.now();
  return WORLD.t0+(performance.now()-WORLD.startTime)/1000;
};

// Interactividad
stage.addEventListener('pointermove',(e)=>{
  const r=stage.getBoundingClientRect();
  WORLD.parallax.x=clamp(((e.clientX-r.left)/r.width)*2-1,-1,1);
  WORLD.parallax.y=clamp(((e.clientY-r.top)/r.height)*2-1,-1,1);
  document.body.classList.add('v-boost-stars');
  clearTimeout(window.__boost_t);
  window.__boost_t=setTimeout(()=>document.body.classList.remove('v-boost-stars'),400);
});

stage.addEventListener('pointerdown',(e)=>{
  if(WORLD.ended)return;
  const el=document.createElement('div');
  el.className='tap-note';
  el.style.left=e.clientX+'px';
  el.style.top=e.clientY+'px';
  stage.appendChild(el);
  setTimeout(()=>el.remove(),1500);
  spawnSupernova();
});

// Iniciar experiencia
btnStart?.addEventListener('click',startAt61);

async function startAt61(){
  const SEEK=61.0;
  document.body.classList.add('v-active');
  
  if(!WORLD.hasAudio){
    console.warn('Iniciando sin audio - modo visualización');
    WORLD.startTime=performance.now();
    loop();
    return;
  }
  
  const forceSeek=()=>{
    try{
      audio.currentTime=SEEK;
      console.log('Audio posicionado en',audio.currentTime);
    }catch(e){
      console.error('Error al posicionar audio:',e);
    }
  };
  
  if(audio.readyState>=1){
    forceSeek();
  }else{
    audio.addEventListener('loadedmetadata',forceSeek,{once:true});
  }
  
  try{
    await audio.play();
    console.log('Audio reproduciendo desde',audio.currentTime);
  }catch(e){
    console.warn('Error al reproducir audio:',e);
  }
  
  loop();
}

// Fade final
function updateFadeOut(t){
  if(t>=143){
    const k=clamp((t-143)/2,0,1);
    const brightness=1-k;
    document.documentElement.style.setProperty('--brightness',brightness.toFixed(3));
    
    if(k>=0.98){
      document.body.classList.add('v-end');
      WORLD.ended=true;
    }
  }
}

// Loop principal
let lastFrameTime=performance.now();

function loop(){
  const now=performance.now();
  const dt=Math.min(0.05,(now-lastFrameTime)/1000);
  lastFrameTime=now;
  
  const t=currentTime();
  
  // Guardias de tiempo
  if(WORLD.hasAudio&&document.body.classList.contains('v-active')&&t<WORLD.t0-0.1){
    audio.currentTime=WORLD.t0;
  }
  
  if(t>=WORLD.t1&&!WORLD.ended){
    document.body.classList.add('v-end');
    WORLD.ended=true;
  }
  
  // Actualizar
  if(!WORLD.ended){
    evalCues(t);
    updateGalaxy(dt);
    updateSupernovas(dt);
  }
  
  updateFadeOut(t);
  
  // Limpiar canvas
  bg.clearRect(0,0,WORLD.w,WORLD.h);
  fx.clearRect(0,0,WORLD.w,WORLD.h);
  
  // Dibujar
  drawGalaxy();
  drawSupernovas();
  
  // Continuar loop si no ha terminado
  const brightness=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--brightness'))||1;
  if(!WORLD.ended || brightness>0.05){
    requestAnimationFrame(loop);
  }else{
    console.log('Experiencia finalizada');
  }
}

// Boot
function boot(){
  resize();
  initGalaxy();
  
  // Detectar audio
  console.log('Intentando cargar audio desde:', audio.src || audio.currentSrc);
  
  audio.addEventListener('error',(e)=>{
    console.error('Error al cargar audio:',e);
    console.error('Fuentes intentadas:',Array.from(audio.querySelectorAll('source')).map(s=>s.src));
    WORLD.hasAudio=false;
    if(noAudioMsg){
      noAudioMsg.classList.remove('hidden');
      const pathsEl=noAudioMsg.querySelector('.audio-paths');
      if(pathsEl){
        pathsEl.textContent=`Buscando en:\n• music/planetarium.mp3\n• ./planetarium.mp3`;
      }
    }
  });
  
  audio.addEventListener('canplaythrough',()=>{
    console.log('✓ Audio cargado correctamente:',audio.duration,'segundos');
    WORLD.hasAudio=true;
    if(noAudioMsg)noAudioMsg.classList.add('hidden');
  },{once:true});
  
  audio.addEventListener('loadedmetadata',()=>{
    console.log('✓ Metadata de audio cargada. Duración:',audio.duration,'segundos');
  });
  
  // Visibilidad
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&
       document.body.classList.contains('v-active')&&
       audio.paused&&!WORLD.ended&&WORLD.hasAudio){
      audio.play().catch(()=>{});
    }
  });
  
  console.log('Sistema inicializado. Galaxia con',Galaxy.stars.length,'estrellas');
}

// Iniciar
boot();
