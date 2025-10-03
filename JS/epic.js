/* =========================================
   La La Land – Planetarium Epic
   2:25 → 3:59 (145 s → 239 s)
   WebGL nebulosa, flares sincronizados, estrellas dinámicas
   ========================================= */
(() => {
  const EPIC_START = 145; // segundos
  const EPIC_END   = 239;
  const compas = [
    145.0, 148.6, 152.2, 155.8, 159.4, 163.0, 166.6, 170.2,
    173.8, 177.4, 181.0, 184.6, 188.2, 191.8, 195.4, 199.0,
    202.6, 206.2, 209.8, 213.4, 217.0, 220.6, 224.2, 227.8, 231.4, 235.0
  ];
  let nextCompas = 0;

  /* ---------- Nodos del DOM ---------- */
  const body   = document.body;
  const audio  = document.getElementById('song');
  const stage  = document.getElementById('stage');

  /* ---------- Crear capas visuales ---------- */
  // Nebulosa (WebGL canvas)
  const nebulaCanvas = document.createElement('canvas');
  nebulaCanvas.id = 'nebula-gl';
  Object.assign(nebulaCanvas.style, {
    position: 'fixed', inset: 0, zIndex: -3, opacity: 0,
    transition: 'opacity 3s ease', pointerEvents: 'none'
  });
  document.body.appendChild(nebulaCanvas);

  // Estrellas (tres capas)
  ['stars-layer-1', 'stars-layer-2', 'stars-layer-3'].forEach(id => {
    const div = document.createElement('div');
    div.id = id;
    document.body.appendChild(div);
  });

  // Viñeta épica
  const vignette = document.createElement('div');
  vignette.id = 'vignette-epic';
  document.body.appendChild(vignette);

  // Tinte dinámico
  const tint = document.createElement('div');
  tint.id = 'tint-epic';
  document.body.appendChild(tint);

  /* ---------- WebGL Nebulosa (sin librerías) ---------- */
  const gl = nebulaCanvas.getContext('webgl') || nebulaCanvas.getContext('experimental-webgl');
  let glReady = false;
  if (gl) {
    const vert = `
      attribute vec2 a_pos;
      void main(){ gl_Position=vec4(a_pos,0.0,1.0); }`;
    const frag = `
      precision mediump float;
      uniform float u_time;
      uniform vec2  u_res;
      vec3 hue(float t){ return 0.5+0.5*cos(t+vec3(0,2,4)); }
      float noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv = (gl_FragCoord.xy/u_res.xy)*2.0-1.0;
        uv.x *= u_res.x/u_res.y;
        vec2 p = uv*2.0;
        float d = length(p);
        vec3 col = vec3(0);
        for(float i=0.;i<5.;i++){
          float a = atan(p.y,p.x) + u_time*0.05*(i+1.);
          float r = pow(d, 0.7);
          float s = sin(25.*r - u_time*1.5 + i);
          col += 0.015 * s * hue(u_time*0.3 + i);
          p *= mat2(cos(a),-sin(a),sin(a),cos(a));
        }
        col += 0.04/(d+0.02);                   // estrellas brillantes
        col *= smoothstep(1.0,0.2,d);           // viñeta suave
        gl_FragColor = vec4(col,1.0);
      }`;

    function createShader(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    }
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vert));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc  = gl.getUniformLocation(program, 'u_res');

    function resizeGL() {
      const dpr = window.devicePixelRatio || 1;
      nebulaCanvas.width  = innerWidth * dpr;
      nebulaCanvas.height = innerHeight * dpr;
      gl.viewport(0, 0, nebulaCanvas.width, nebulaCanvas.height);
    }
    addEventListener('resize', resizeGL);
    resizeGL();

    let startTime = performance.now();
    function drawGL() {
      gl.uniform1f(timeLoc, (performance.now() - startTime) * 0.001);
      gl.uniform2f(resLoc, nebulaCanvas.width, nebulaCanvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (body.classList.contains('epic')) requestAnimationFrame(drawGL);
    }
    glReady = true;
    drawGL();
  }

  /* ---------- Flares sincronizados ---------- */
  function addFlare() {
    const f = document.createElement('div');
    f.className = 'flare-epic';
    document.body.appendChild(f);
    f.addEventListener('animationend', () => f.remove(), { once: true });
  }

  /* ---------- Loop de sincronía ---------- */
  function epicLoop() {
    const t = audio.currentTime;
    const inEpic = t >= EPIC_START && t <= EPIC_END;

    body.classList.toggle('epic', inEpic);

    if (inEpic) {
      nebulaCanvas.style.opacity = '1';
      // Flares por compás
      while (nextCompas < compas.length && t >= compas[nextCompas]) {
        addFlare();
        nextCompas++;
      }
    } else {
      nebulaCanvas.style.opacity = '0';
      if (t < EPIC_START) nextCompas = 0; // reset si rebobina
    }

    requestAnimationFrame(epicLoop);
  }

  /* ---------- Arrancar cuando el audio esté listo ---------- */
  audio.addEventListener('loadedmetadata', () => {
    epicLoop();
  });
})();
