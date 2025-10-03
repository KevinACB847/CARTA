/* =========================================================
   VIAJE — Galaxia Espiral COMPLETA
   ========================================================= */
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#000;color:#fff;overflow:hidden}
body{
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}

:root{
  --core-glow:1;
  --rotation-speed:1;
  --zoom:1;
  --brightness:1;
}

/* Stage */
.stage{
  position:relative;width:100vw;height:100vh;overflow:hidden;
  background:radial-gradient(ellipse at center, #0a0e27 0%, #000000 70%);
  perspective:1200px;
  transform:scale(var(--zoom));
  filter:brightness(var(--brightness));
  transition:filter 600ms ease, transform 800ms ease;
}

#bgCanvas,#fxCanvas{
  position:absolute;inset:0;width:100%;height:100%;display:block;
}
#bgCanvas{z-index:1}
#fxCanvas{z-index:3;mix-blend-mode:screen;pointer-events:none}

/* Núcleo galáctico */
.galaxy-core{
  position:absolute;
  left:50%;top:50%;
  width:200px;height:200px;
  transform:translate(-50%,-50%);
  border-radius:50%;
  background:radial-gradient(circle at 40% 40%,
    rgba(255,255,255,1) 0%,
    rgba(255,200,100,0.9) 15%,
    rgba(255,150,50,0.7) 30%,
    rgba(200,100,255,0.4) 50%,
    rgba(100,150,255,0.2) 70%,
    transparent 100%
  );
  box-shadow:
    0 0 40px rgba(255,255,255,0.8),
    0 0 80px rgba(255,200,100,0.6),
    0 0 120px rgba(255,150,50,0.4),
    0 0 160px rgba(200,100,255,0.3);
  z-index:2;
  animation:coreGlow 4s ease-in-out infinite;
  opacity:calc(0.9 * var(--core-glow));
}

@keyframes coreGlow{
  0%,100%{
    transform:translate(-50%,-50%) scale(1);
    box-shadow:
      0 0 40px rgba(255,255,255,0.8),
      0 0 80px rgba(255,200,100,0.6),
      0 0 120px rgba(255,150,50,0.4);
  }
  50%{
    transform:translate(-50%,-50%) scale(1.15);
    box-shadow:
      0 0 60px rgba(255,255,255,1),
      0 0 120px rgba(255,200,100,0.8),
      0 0 180px rgba(255,150,50,0.6),
      0 0 240px rgba(200,100,255,0.4);
  }
}

/* Anillo de acreción */
.accretion-disk{
  position:absolute;
  left:50%;top:50%;
  width:300px;height:80px;
  transform:translate(-50%,-50%) rotateX(75deg);
  background:radial-gradient(ellipse at center,
    rgba(255,100,50,0.6) 0%,
    rgba(255,150,100,0.4) 30%,
    rgba(100,150,255,0.2) 60%,
    transparent 100%
  );
  border-radius:50%;
  z-index:2;
  animation:diskRotate 8s linear infinite;
  filter:blur(2px);
}

@keyframes diskRotate{
  from{transform:translate(-50%,-50%) rotateX(75deg) rotateZ(0deg)}
  to{transform:translate(-50%,-50%) rotateX(75deg) rotateZ(360deg)}
}

/* Susurros cósmicos */
.v-whisper{
  position:absolute;
  left:50%;top:15%;
  transform:translate(-50%,-50%);
  font-size:clamp(1.2rem,2vw,2rem);
  font-weight:700;
  letter-spacing:0.15em;
  text-transform:uppercase;
  color:#fff;
  text-shadow:
    0 0 20px rgba(100,200,255,1),
    0 0 40px rgba(100,200,255,0.8),
    0 0 60px rgba(255,100,200,0.6),
    0 0 80px rgba(255,100,200,0.4);
  opacity:0;
  transition:opacity 700ms ease;
  z-index:10;
  pointer-events:none;
  filter:drop-shadow(0 0 30px rgba(100,200,255,0.8));
}

.v-whisper.show{
  opacity:1;
  animation:whisperPulse 2s ease-in-out infinite;
}

@keyframes whisperPulse{
  0%,100%{
    text-shadow:
      0 0 20px rgba(100,200,255,1),
      0 0 40px rgba(100,200,255,0.8),
      0 0 60px rgba(255,100,200,0.6);
  }
  50%{
    text-shadow:
      0 0 30px rgba(100,200,255,1),
      0 0 60px rgba(100,200,255,1),
      0 0 90px rgba(255,100,200,0.8),
      0 0 120px rgba(255,100,200,0.6);
  }
}

/* Flash */
.flash{
  position:absolute;inset:0;
  background:radial-gradient(circle at center,
    rgba(255,255,255,0.8) 0%,
    rgba(100,200,255,0.4) 40%,
    transparent 70%
  );
  opacity:0;
  transition:opacity 150ms ease-out;
  z-index:20;
  pointer-events:none;
  mix-blend-mode:screen;
}
.flash.is-on{opacity:1}

/* UI */
.ui{
  position:absolute;inset:0;
  display:grid;place-items:center;
  z-index:50;
  pointer-events:none;
}

.btn-start{
  pointer-events:auto;
  appearance:none;
  border:3px solid rgba(100,200,255,0.5);
  border-radius:50px;
  padding:1.2rem 2.5rem;
  font-size:1.2rem;
  font-weight:700;
  letter-spacing:0.1em;
  text-transform:uppercase;
  background:linear-gradient(135deg,
    rgba(20,20,60,0.9),
    rgba(60,20,100,0.9)
  );
  color:#fff;
  cursor:pointer;
  position:relative;
  overflow:hidden;
  backdrop-filter:blur(10px);
  box-shadow:
    0 0 30px rgba(100,200,255,0.5),
    0 0 60px rgba(255,100,200,0.3),
    inset 0 0 20px rgba(100,200,255,0.2);
  transition:all 300ms ease;
  animation:btnFloat 3s ease-in-out infinite;
}

.btn-start::before{
  content:"";
  position:absolute;
  inset:-50%;
  background:linear-gradient(45deg,
    transparent 30%,
    rgba(255,255,255,0.3) 50%,
    transparent 70%
  );
  transform:translateX(-100%) rotate(45deg);
  transition:transform 600ms ease;
}

.btn-start:hover{
  transform:translateY(-3px) scale(1.05);
  border-color:rgba(100,200,255,0.8);
  box-shadow:
    0 0 40px rgba(100,200,255,0.8),
    0 0 80px rgba(255,100,200,0.5),
    0 0 120px rgba(100,200,255,0.3),
    inset 0 0 30px rgba(100,200,255,0.3);
}

.btn-start:hover::before{
  transform:translateX(100%) rotate(45deg);
}

.btn-start:active{
  transform:translateY(0) scale(1);
}

@keyframes btnFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-5px)}
}

body.v-active .ui{display:none}

/* Estados */
body.v-ramp-1{
  --core-glow:1.3;
  --rotation-speed:1.2;
  --brightness:1.1;
}

body.v-preclimax{
  --core-glow:1.6;
  --rotation-speed:1.4;
  --zoom:1.08;
  --brightness:1.2;
}

body.v-boost-stars{
  --brightness:1.15;
}

body.v-end .stage{
  filter:brightness(0);
  transition:filter 2000ms ease;
}

body.v-end .v-whisper,
body.v-end .galaxy-core{
  opacity:0;
  transition:opacity 1500ms ease;
}

/* Tap effects */
.tap-note{
  position:absolute;
  width:8px;height:8px;
  border-radius:50%;
  background:radial-gradient(circle,
    rgba(255,255,255,1),
    rgba(100,200,255,0.8),
    transparent
  );
  box-shadow:
    0 0 20px rgba(100,200,255,1),
    0 0 40px rgba(100,200,255,0.6);
  pointer-events:none;
  z-index:30;
  animation:noteRise 1500ms ease-out forwards;
}

@keyframes noteRise{
  0%{
    transform:translate(-50%,-50%) scale(0.5);
    opacity:0;
  }
  20%{opacity:1}
  100%{
    transform:translate(-50%,-100vh) scale(1.5);
    opacity:0;
  }
}

/* Mensaje sin audio */
.no-audio-msg{
  position:absolute;inset:0;
  background:rgba(0,0,0,0.95);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:1.5rem;
  padding:2rem;
  text-align:center;
  z-index:100;
  backdrop-filter:blur(10px);
}

.no-audio-msg.hidden{display:none}

.no-audio-msg h2{
  font-size:1.8rem;
  color:#64c8ff;
  text-shadow:0 0 20px rgba(100,200,255,0.8);
  margin:0;
}

.no-audio-msg p{
  font-size:1rem;
  color:rgba(255,255,255,0.8);
  max-width:500px;
  line-height:1.6;
  margin:0;
}

.no-audio-msg .audio-paths{
  font-size:0.85rem;
  color:rgba(255,200,100,0.9);
  font-family:monospace;
  background:rgba(255,255,255,0.1);
  padding:0.5rem 1rem;
  border-radius:8px;
  margin-top:0.5rem;
}

/* Responsive */
@media (max-width:768px){
  .galaxy-core{
    width:150px;height:150px;
  }
  .accretion-disk{
    width:220px;height:60px;
  }
  .btn-start{
    padding:1rem 2rem;
    font-size:1rem;
  }
  .v-whisper{
    font-size:1rem;
  }
}

@media (prefers-reduced-motion:reduce){
  *{
    animation-duration:0.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:0.01ms !important;
  }
}

.hidden{display:none !important}
