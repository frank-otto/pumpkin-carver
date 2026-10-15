// Moody pumpkin patch at night: gradient sky with stars and a soft (non-glaring) moon, rolling dark hills with tree
// silhouettes, a wooden carving stump, soil with vines and leaves, background pumpkins (some already glowing),
// hay bale, fence, fog, fireflies. Lights: cool moon + hemi, warm work lantern (dims for the candle reveal).
import * as THREE from 'three';

export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .8, parts: .45 },
  mid: { dpr: 1.25, shadows: false, bloom: 1, parts: .7 },
  high: { dpr: 1.6, shadows: true, shadowSize: 1024, bloom: 1, parts: 1 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, parts: 1.3 }
};
export function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = rnd(5);
  for (let i = 0; i < 26; i++) { const x = 128 + (r() - .5) * 110, y = 128 + (r() - .5) * 110, s = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  return new THREE.CanvasTexture(c);
}
export function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 84, 2, 32, 72, 50); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.25, 'rgba(255,190,80,.95)'); gr.addColorStop(.6, 'rgba(255,110,20,.45)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(62, 70, 32, 124); g.quadraticCurveTo(2, 70, 32, 4); g.fill(); return new THREE.CanvasTexture(c);
}
function soilTexture(seed) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const r = rnd(seed);
  g.fillStyle = '#2a1d16'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { const x = r() * N, y = r() * N, s = 1 + r() * 5; g.fillStyle = `rgba(${40 + r() * 50},${28 + r() * 30},${18 + r() * 20},${.25 + r() * .4})`; g.beginPath(); g.ellipse(x, y, s, s * (.5 + r() * .5), r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 260; i++) { const x = r() * N, y = r() * N; g.strokeStyle = `rgba(${50 + r() * 40},${70 + r() * 40},${30 + r() * 20},${.3 + r() * .3})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 10, y - 4 - r() * 10); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function woodTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); const r = rnd(seed);
  g.fillStyle = '#5a3a22'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${30 + r() * 40},${15 + r() * 20},5,${.3 + r() * .35})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const rr = 10 + i * 3.6 + r() * 2; g.ellipse(256, 256, rr, rr * (.95 + r() * .1), 0, 0, 7); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function barkTexture(seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'); const r = rnd(seed);
  g.fillStyle = '#4a3020'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${15 + r() * 30},${10 + r() * 15},5,${.4 + r() * .4})`; g.lineWidth = 2 + r() * 4; g.beginPath(); const x = r() * 256; g.moveTo(x, 0); for (let y = 0; y <= 512; y += 32) g.lineTo(x + (r() - .5) * 10, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// small decorative jack-o'-lantern face texture (emissive) for distant background pumpkins
function faceTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffb040'; const tri = (x, y, s, up = 1) => { g.beginPath(); g.moveTo(x, y - s * up); g.lineTo(x + s, y + s * .6 * up); g.lineTo(x - s, y + s * .6 * up); g.fill(); };
  tri(42, 50, 13); tri(86, 50, 13); if (kind) tri(64, 70, 7);
  g.beginPath(); g.moveTo(30, 84); g.quadraticCurveTo(64, 120, 98, 84); g.quadraticCurveTo(64, 98, 30, 84); g.fill();
  return new THREE.CanvasTexture(c);
}
export function skinColor(r) { return new THREE.Color().setHSL(.065 + r * .02, .82, .42 + r * .06); }

export function createWorld(renderer, q, seed = 7) {
  const scene = new THREE.Scene(); const W = { scene }; const r = rnd(seed); W.rng = r;
  scene.fog = new THREE.FogExp2('#120c22', .035);
  // ---- sky dome (gradient + stars), soft moon ----
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float uT; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 top = vec3(.025,.02,.07), mid = vec3(.10,.06,.20), hor = vec3(.26,.13,.26);
        vec3 c = mix(hor, mid, smoothstep(0., .25, y)); c = mix(c, top, smoothstep(.25, .8, y));
        vec3 q = floor(vP * 260.); float s = step(.9965, h(q)) * smoothstep(.05, .35, y); s *= .55 + .45 * sin(uT * 2. + h(q + 3.) * 40.);
        c += vec3(.75,.78,.95) * s * .8; gl_FragColor = vec4(c, 1.); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), skyMat); scene.add(sky); W.sky = sky;
  const soft = softTexture(), smoke = smokeTexture(); W.soft = soft; W.smokeTex = smoke; W.flameTex = flameTexture();
  const moonC = document.createElement('canvas'); moonC.width = moonC.height = 256; { const g = moonC.getContext('2d'); const gr = g.createRadialGradient(128, 128, 50, 128, 128, 128); gr.addColorStop(0, 'rgba(200,190,230,.25)'); gr.addColorStop(1, 'rgba(200,190,230,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = '#d9d2c2'; g.beginPath(); g.arc(128, 128, 48, 0, 7); g.fill(); const rr = rnd(2); for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(150,140,130,${.15 + rr() * .2})`; g.beginPath(); g.arc(100 + rr() * 56, 100 + rr() * 56, 4 + rr() * 9, 0, 7); g.fill(); } }
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(moonC), fog: false, depthWrite: false, color: '#c8c0b8' })); moonS.position.set(-26, 22, -60); moonS.scale.setScalar(16); scene.add(moonS);
  // ---- hills + trees (silhouettes) ----
  const hillMat = new THREE.MeshStandardMaterial({ color: '#140e1c', roughness: 1 });
  for (let i = 0; i < 3; i++) { const geo = new THREE.PlaneGeometry(160, 20, 80, 1); const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { if (p.getY(k) > 0) p.setY(k, 10 + Math.sin(p.getX(k) * (.05 + i * .02) + i * 2) * (2.5 + i) + Math.sin(p.getX(k) * .13 + i) * 1.2 - i * 3.5); } geo.computeVertexNormals(); const m = new THREE.Mesh(geo, hillMat); m.position.set(0, -7.5, -38 + i * 8); scene.add(m); }
  const bark = barkTexture(3), treeMat = new THREE.MeshStandardMaterial({ map: bark, color: '#2a1e22', roughness: 1 });
  const branch = (g, from, dir, len, rad, depth) => { const to = from.clone().addScaledVector(dir, len); const c = new THREE.Mesh(new THREE.CylinderGeometry(rad * .65, rad, len, 6), treeMat); c.position.copy(from).add(to).multiplyScalar(.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(c);
    if (depth > 0) for (let k = 0; k < 2 + (r() < .4 ? 1 : 0); k++) { const nd = dir.clone().add(new THREE.Vector3((r() - .5) * 1.4, r() * .4, (r() - .5) * .8)).normalize(); branch(g, to, nd, len * (.6 + r() * .15), rad * .62, depth - 1); } };
  for (const [x, z, s] of [[-13, -16, 1.2], [12, -19, 1.4], [-20, -24, 1.5], [19, -12, 1], [4, -27, 1.3], [-6, -21, .9]]) { const g = new THREE.Group(); branch(g, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 3.2, .35, 4); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = r() * 6; scene.add(g); }
  // ---- ground ----
  const soil = soilTexture(9); soil.repeat.set(14, 14);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: soil, color: '#9a8a8a', roughness: .95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); W.ground = ground;
  // carving stump (table)
  const wood = woodTexture(4), stumpTop = new THREE.MeshStandardMaterial({ map: wood, roughness: .85, color: '#c8a888' }), stumpSide = new THREE.MeshStandardMaterial({ map: bark, roughness: 1, color: '#7a5a4a' });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.15, .9, 28), [stumpSide, stumpTop, stumpSide]); stump.position.y = .45; stump.castShadow = stump.receiveShadow = true; scene.add(stump); W.STUMP = .9;
  // vines + leaves
  const vineMat = new THREE.MeshStandardMaterial({ color: '#2e4a22', roughness: .9 }), leafMat = new THREE.MeshStandardMaterial({ color: '#2c5a26', roughness: .8, side: THREE.DoubleSide });
  const leafGeo = new THREE.CircleGeometry(.35, 7); leafGeo.scale(1, .8, 1);
  for (let v = 0; v < 9; v++) { const a0 = r() * 6.28, R0 = 3 + r() * 6; const pts = []; for (let k = 0; k < 8; k++) { const a = a0 + k * .22, rr = R0 + k * .5; pts.push(new THREE.Vector3(Math.cos(a) * rr, .05 + Math.sin(k) * .03, Math.sin(a) * rr - 2)); }
    const curve = new THREE.CatmullRomCurve3(pts); const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .035, 5), vineMat); vine.castShadow = true; scene.add(vine);
    for (let k = 0; k < 6; k++) { const p = curve.getPoint(r()); const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.copy(p).add(new THREE.Vector3(0, .06, 0)); lf.rotation.set(-Math.PI / 2 + (r() - .5) * .8, 0, r() * 6); lf.scale.setScalar(.7 + r() * .8); scene.add(lf); } }
  // background pumpkins (a few glowing)
  W.bgGlow = [];
  const bgGeo = new THREE.SphereGeometry(1, 24, 16); { const p = bgGeo.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const ph = Math.atan2(x, z); const f = 1 + .06 * Math.cos(10 * ph) * Math.sqrt(Math.max(0, 1 - y * y)); p.setXYZ(k, x * f, y * .78, z * f); } bgGeo.computeVertexNormals(); }
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4a5a2a', roughness: .8 });
  const spots = [[-5.5, -3.5, .9, 1], [5.2, -4.2, 1, 1], [-8.5, -9, 1.2, 0], [8, -10, 1.1, 1], [-3, -12, .9, 0], [3.5, -15, 1.3, 1], [-11, -15, 1, 1], [12.5, -6, .8, 0], [-14, -6, 1.1, 0], [0, -20, 1.5, 1]];
  for (const [x, z, s, lit] of spots) {
    const m = new THREE.Mesh(bgGeo, new THREE.MeshStandardMaterial({ color: skinColor(r()), roughness: .55, emissiveMap: lit ? faceTexture(r() < .5) : null, emissive: lit ? '#ff9a30' : '#000000', emissiveIntensity: lit ? 1.4 : 0 }));
    m.scale.setScalar(s); m.position.set(x, s * .76, z); m.rotation.y = Math.atan2(-x, 8 - z) + (r() - .5) * .3; m.castShadow = true; scene.add(m);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .35, 6), stemMat); st.position.set(0, .85, 0); st.rotation.z = (r() - .5) * .5; m.add(st);
    if (lit) { W.bgGlow.push({ m, ph: r() * 6 }); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#ff8a30', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(x, .15, z + s * .8); gl.scale.set(3 * s, 1.2 * s, 1); scene.add(gl); }
  }
  // hay bale + fence + lantern post
  const hay = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: '#8a7038', roughness: 1 })); hay.position.set(-6.8, .55, -1.5); hay.rotation.y = .5; hay.castShadow = hay.receiveShadow = true; scene.add(hay);
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1 });
  for (let i = 0; i < 16; i++) { const x = -16 + i * 2.1; const post = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.4 + r() * .3, .18), fenceMat); post.position.set(x, .7, -8.5 - Math.sin(i) * .3); post.rotation.z = (r() - .5) * .15; scene.add(post); }
  for (const y of [.55, 1.1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(34, .12, .08), fenceMat); rail.position.set(0, y, -8.6); scene.add(rail); }
  // ---- lights ----
  W.hemi = new THREE.HemisphereLight('#6a64b0', '#2a1a14', .9); scene.add(W.hemi);
  const moon = new THREE.DirectionalLight('#9aa8ff', 1.5); moon.position.set(-8, 12, -6); moon.castShadow = true; moon.shadow.bias = -.0006; moon.shadow.normalBias = .03;
  const sc = moon.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40; scene.add(moon, moon.target); W.moon = moon;
  W.work = new THREE.PointLight('#ffc890', 26, 16, 1.7); W.work.position.set(2.6, 4.4, 5.2); scene.add(W.work); // warm work lantern (front, above)
  W.fill = new THREE.DirectionalLight('#ffb880', .55); W.fill.position.set(-4, 3, 6); scene.add(W.fill);
  // ---- fog sprites + fireflies ----
  W.fogS = []; for (let i = 0; i < Math.round(18 * q.parts); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, color: '#4a3a6a', transparent: true, opacity: .1 + r() * .06, depthWrite: false })); const a = r() * 6.28, rr = 5 + r() * 14; s.position.set(Math.cos(a) * rr, .5 + r() * .6, Math.sin(a) * rr - 3); s.scale.set(7 + r() * 5, 2.2, 1); scene.add(s); W.fogS.push({ s, ph: r() * 6, x0: s.position.x }); }
  const nF = Math.round(40 * q.parts), fg = new THREE.BufferGeometry(), fp = new Float32Array(nF * 3), fb = [];
  for (let i = 0; i < nF; i++) { const a = r() * 6.28, rr = 4 + r() * 12; fb.push([Math.cos(a) * rr, .4 + r() * 2.5, Math.sin(a) * rr - 4, r() * 6]); }
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); W.ff = { fb, fp, fg };
  const ffm = new THREE.Points(fg, new THREE.PointsMaterial({ map: soft, color: '#d8f080', size: .14, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })); ffm.frustumCulled = false; scene.add(ffm);
  return W;
}
export function updateWorld(W, t, dt) {
  W.sky.material.uniforms.uT.value = t;
  for (const b of W.bgGlow) b.m.material.emissiveIntensity = 1.15 + Math.sin(t * 7 + b.ph) * .12 + Math.sin(t * 13.3 + b.ph) * .08;
  for (const f of W.fogS) f.s.position.x = f.x0 + Math.sin(t * .1 + f.ph) * 1.5;
  const { fb, fp, fg } = W.ff; for (let i = 0; i < fb.length; i++) { const b = fb[i]; fp[i * 3] = b[0] + Math.sin(t * .4 + b[3]) * 1.2; fp[i * 3 + 1] = b[1] + Math.sin(t * .9 + b[3] * 2) * .4; fp[i * 3 + 2] = b[2] + Math.cos(t * .35 + b[3]) * 1.2; } fg.attributes.position.needsUpdate = true;
}
