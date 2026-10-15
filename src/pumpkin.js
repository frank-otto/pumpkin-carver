// The carvable pumpkin: parametric ribbed body (uv = our own spherical mapping, u=.5 faces the camera),
// a carve MASK canvas (discard in the shader), a GROOVE canvas (knife lines), a GUIDE canvas (dashed target lines),
// an inner flesh shell that glows when the candle is lit, a glowing cut-edge band, chunks that pop out.
import * as THREE from 'three';
import { rnd } from './world.js';

export const PR = 1.55, SQ = .8;             // radius, vertical squash
export const MW = 1024, MH = 512;            // mask / groove / guide canvas size (full uv)
// face space (fx,fy in [-1,1], y down) -> uv
export const FU = .165, FV = .19, FV0 = .53;
export const f2uv = (fx, fy) => [.5 + fx * FU, FV0 + fy * FV];
export const uv2f = (u, v) => [(u - .5) / FU, (v - FV0) / FV];

export function surf(u, v, k = 1, out = new THREE.Vector3()) {
  const ph = (u - .5) * Math.PI * 2, th = v * Math.PI;
  const sx = Math.sin(th) * Math.sin(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.cos(ph);
  const rib = 1 + .055 * Math.cos(10 * ph) * Math.pow(Math.max(0, 1 - sy * sy), .35) - .02 * Math.pow(Math.abs(Math.sin(5 * ph)), 6);
  let y = sy * SQ; if (sy > .8) y -= (sy - .8) * .55; if (sy < -.85) y += (-.85 - sy) * .5;
  return out.set(sx * rib * PR * k, y * PR * k, sz * rib * PR * k);
}
function bodyGeometry(NU = 160, NV = 100, k = 1) {
  const pos = [], uv = [], idx = [], v3 = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const u = i / NU, v = j / NV; surf(u, v, k, v3); pos.push(v3.x, v3.y, v3.z); uv.push(u, 1 - v); }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function skinTextures(seed) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'); const r = rnd(seed);
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#9a4a10'); gr.addColorStop(.12, '#d8701a'); gr.addColorStop(.5, '#e8801f'); gr.addColorStop(.88, '#c8621a'); gr.addColorStop(1, '#7a3a10'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 10; i++) { const x = (i + .5) * 102.4; const lg = g.createLinearGradient(x - 51, 0, x + 51, 0); lg.addColorStop(0, 'rgba(90,30,0,.35)'); lg.addColorStop(.5, 'rgba(255,170,70,.12)'); lg.addColorStop(1, 'rgba(90,30,0,.35)'); g.fillStyle = lg; g.fillRect(x - 51, 0, 102, 512); }
  for (let i = 0; i < 900; i++) { const x = r() * 1024, y = 40 + r() * 432; g.strokeStyle = `rgba(${r() < .5 ? '255,190,110' : '120,50,10'},${.05 + r() * .1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y + 10 + r() * 40); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(110,80,40,${.08 + r() * .12})`; g.beginPath(); g.ellipse(r() * 1024, 60 + r() * 400, 2 + r() * 6, 1 + r() * 3, r() * 3, 0, 7); g.fill(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return map;
}
function canvasTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; return { c, g: c.getContext('2d'), t }; }

export function createPumpkin(scene, flameTex) {
  const P = { group: new THREE.Group() }; scene.add(P.group);
  P.mask = canvasTex(MW, MH); P.groove = canvasTex(MW, MH); P.guide = canvasTex(MW, MH);
  P.mask.t.colorSpace = P.groove.t.colorSpace = THREE.NoColorSpace; P.guide.t.colorSpace = THREE.SRGBColorSpace;
  P.skin = skinTextures(11);
  P.U = { uMask: { value: P.mask.t }, uGroove: { value: P.groove.t }, uGuide: { value: P.guide.t }, uGuideA: { value: 1 }, uGlow: { value: 0 }, uTexel: { value: new THREE.Vector2(4.5 / MW, 4.5 / MH) } };
  const mat = new THREE.MeshStandardMaterial({ map: P.skin, roughness: .5, metalness: 0, bumpMap: P.skin, bumpScale: 1.2 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, P.U);
    sh.fragmentShader = 'uniform sampler2D uMask, uGroove, uGuide; uniform float uGuideA, uGlow; uniform vec2 uTexel;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float cm = texture2D(uMask, vMapUv).r; if (cm > .5) discard;
        float nb = max(max(texture2D(uMask, vMapUv + vec2(uTexel.x, 0.)).r, texture2D(uMask, vMapUv - vec2(uTexel.x, 0.)).r), max(texture2D(uMask, vMapUv + vec2(0., uTexel.y)).r, texture2D(uMask, vMapUv - vec2(0., uTexel.y)).r));
        float edge = smoothstep(.15, .6, nb);
        float gv = texture2D(uGroove, vMapUv).r; diffuseColor.rgb *= 1. - .6 * gv;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95, .72, .38), edge);
        vec4 gd = texture2D(uGuide, vMapUv); diffuseColor.rgb = mix(diffuseColor.rgb, gd.rgb, gd.a * uGuideA);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1., .55, .15) * edge * (.08 + 1.5 * uGlow) + gd.rgb * gd.a * uGuideA * .45;`);
  };
  P.outer = new THREE.Mesh(bodyGeometry(), mat); P.outer.castShadow = true; P.outer.receiveShadow = true; P.group.add(P.outer);
  // inner flesh shell (seen through the holes): back faces only, glows with the candle
  P.innerMat = new THREE.MeshStandardMaterial({ color: '#a85a1c', roughness: .95, side: THREE.BackSide, emissive: '#ff8a2a', emissiveIntensity: 0 });
  P.inner = new THREE.Mesh(bodyGeometry(80, 50, .9), P.innerMat); P.group.add(P.inner);
  // stem
  const stemG = new THREE.CylinderGeometry(.13, .22, .6, 9, 4); { const p = stemG.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) + .3; p.setX(k, p.getX(k) + y * y * .25); } stemG.computeVertexNormals(); }
  P.stem = new THREE.Mesh(stemG, new THREE.MeshStandardMaterial({ color: '#5a6a30', roughness: .8 })); P.stem.position.y = PR * SQ - .12; P.stem.rotation.z = -.2; P.stem.castShadow = true; P.group.add(P.stem);
  // candle inside
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(.15, .16, .3, 14), new THREE.MeshStandardMaterial({ color: '#d9a46a', roughness: .7, emissive: '#7a3a08', emissiveIntensity: .6 })); cm.position.y = -PR * SQ * .8; P.group.add(cm);
  P.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: '#ffd08a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); P.flame.scale.set(.32, .62, 1); P.flame.position.y = cm.position.y + .42; P.group.add(P.flame);
  P.light = new THREE.PointLight('#ff9a3a', 0, 9, 1.6); P.light.position.y = cm.position.y + .6; P.group.add(P.light);
  // ground glow decal
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; { const g = gc.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,150,60,.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  P.glowDecal = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); P.glowDecal.rotation.x = -Math.PI / 2;
  P.chunkSkin = new THREE.MeshStandardMaterial({ map: P.skin, roughness: .5 }); P.chunkFlesh = new THREE.MeshStandardMaterial({ color: '#f0b45a', roughness: .85, emissive: '#5a2a00', emissiveIntensity: .25 });
  P.polys = []; P.low = { w: 256, h: 128, data: new Uint8Array(256 * 128) };
  P.lowC = document.createElement('canvas'); P.lowC.width = 256; P.lowC.height = 128;
  resetCarve(P); return P;
}
export function resetCarve(P) {
  for (const k of ['mask', 'groove', 'guide']) { P[k].g.clearRect(0, 0, MW, MH); if (k !== 'guide') { P[k].g.fillStyle = '#000'; P[k].g.fillRect(0, 0, MW, MH); } P[k].t.needsUpdate = true; }
  P.polys.length = 0; P.low.data.fill(0);
}
const px = (u, v) => [u * MW, v * MH];
export function redrawMask(P) {
  const g = P.mask.g; g.fillStyle = '#000'; g.fillRect(0, 0, MW, MH); g.fillStyle = '#fff';
  for (const poly of P.polys) { g.beginPath(); poly.forEach(([u, v], i) => { const [x, y] = px(u, v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); }
  P.mask.t.needsUpdate = true;
  const lg = P.lowC.getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, 256, 128); lg.fillStyle = '#fff';
  for (const poly of P.polys) { lg.beginPath(); poly.forEach(([u, v], i) => i ? lg.lineTo(u * 256, v * 128) : lg.moveTo(u * 256, v * 128)); lg.closePath(); lg.fill(); }
  const d = lg.getImageData(0, 0, 256, 128).data; for (let i = 0; i < 256 * 128; i++) P.low.data[i] = d[i * 4] > 127 ? 1 : 0;
}
export const carvedAt = (P, u, v) => P.low.data[Math.min(127, Math.max(0, Math.floor(v * 128))) * 256 + Math.min(255, Math.max(0, Math.floor(u * 256)))] === 1;
export function grooveLine(P, a, b, w = 5) { const g = P.groove.g; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = w; g.beginPath(); g.moveTo(...px(a[0], a[1])); g.lineTo(...px(b[0], b[1])); g.stroke(); P.groove.t.needsUpdate = true; }
export function clearGroove(P) { P.groove.g.fillStyle = '#000'; P.groove.g.fillRect(0, 0, MW, MH); P.groove.t.needsUpdate = true; }
export function drawGuides(P, pieces, thick = 1) {
  const g = P.guide.g; g.clearRect(0, 0, MW, MH); g.lineJoin = 'round'; g.lineCap = 'round';
  for (const pc of pieces) {
    const path = () => { g.beginPath(); pc.uv.forEach(([u, v], i) => { const [x, y] = px(u, v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    path(); g.fillStyle = 'rgba(255,230,180,.10)'; g.fill();
    path(); g.strokeStyle = 'rgba(40,14,0,.75)'; g.lineWidth = 9 * thick; g.setLineDash([]); g.stroke();
    path(); g.strokeStyle = 'rgba(255,244,214,1)'; g.lineWidth = 3.6 * thick; g.setLineDash([12 * thick, 8 * thick]); g.stroke(); g.setLineDash([]);
  }
  P.guide.t.needsUpdate = true;
}
// a pumpkin-skin chunk for a carved polygon (outer skin with the same uv, flesh back + walls)
export function buildChunk(P, poly) {
  let pts = poly; if (pts.length > 56) { const k = pts.length / 56; pts = Array.from({ length: 56 }, (_, i) => poly[Math.floor(i * k)]); }
  const c2 = pts.map(([u, v]) => new THREE.Vector2(u, v)); if (THREE.ShapeUtils.isClockWise(c2)) c2.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(c2, []); const n = c2.length; if (!tris.length) return null;
  const pos = [], uv = [], v3 = new THREE.Vector3(), cen = new THREE.Vector3();
  for (const p of c2) cen.add(surf(p.x, p.y, 1, v3)); cen.divideScalar(n);
  const add = (u, v, k) => { surf(u, v, k, v3).sub(cen); pos.push(v3.x, v3.y, v3.z); uv.push(u, 1 - v); };
  for (const p of c2) add(p.x, p.y, 1.005); for (const p of c2) add(p.x, p.y, .935);
  const outerIdx = [], fleshIdx = [];
  for (const [a, b, c] of tris) { outerIdx.push(a, c, b); fleshIdx.push(a + n, b + n, c + n); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; fleshIdx.push(i, j, i + n, j, j + n, i + n); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([...outerIdx, ...fleshIdx]); g.addGroup(0, outerIdx.length, 0); g.addGroup(outerIdx.length, fleshIdx.length, 1); g.computeVertexNormals();
  const m = new THREE.Mesh(g, [P.chunkSkin, P.chunkFlesh]); m.castShadow = true; m.position.copy(cen); m.userData.normal = cen.clone().normalize(); return m;
}
// ---------------- target face patterns (face space) ----------------
const circle = (cx, cy, rx, ry = rx, n = 20) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * 6.283) * rx, cy + Math.sin(i / n * 6.283) * ry]);
const triUp = (cx, cy, w, h) => [[cx, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
const mirror = p => p.map(([x, y]) => [-x, y]).reverse();
function smile(w, y0, sag, thick, teeth = 0, jag = 0, n = 26) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { const s = i / n, x = -w + 2 * w * s, k = 1 - (x / w) ** 2; top.push([x, y0 + thick * .35 * k]); bot.push([x, y0 + (sag + thick) * k]); }
  if (jag) for (let i = 1; i < n; i++) { const z = (i % 2 ? 1 : -1) * jag * Math.sin(Math.PI * i / n); top[i][1] += z > 0 ? z : 0; bot[i][1] -= z < 0 ? -z * .9 : 0; }
  const out = top.slice();
  if (teeth) { // square teeth hanging from the top edge
    const res = []; const tw = 2 * w / (teeth * 2 + 1);
    for (const p of top) { const slot = Math.floor((p[0] + w) / tw); res.push([p[0], p[1] + (slot % 2 === 1 && Math.abs(p[0]) < w * .8 ? thick * .55 : 0)]); }
    out.splice(0, out.length, ...res);
  }
  return out.concat(bot.reverse());
}
const star = (cx, cy, R, r, n = 5) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
const quad = (pts) => pts;
export const PATTERNS = {
  easy: [
    () => [triUp(-.42, -.45, .46, .42), mirror(triUp(-.42, -.45, .46, .42)), smile(.62, .25, .28, .16)],
    () => [circle(-.42, -.44, .2, .22), circle(.42, -.44, .2, .22), smile(.6, .26, .3, .14)],
    () => [triUp(-.42, -.45, .44, .4), mirror(triUp(-.42, -.45, .44, .4)), triUp(0, -.02, .22, .2), smile(.6, .3, .25, .14)]
  ],
  medium: [
    () => [triUp(-.42, -.45, .44, .4), mirror(triUp(-.42, -.45, .44, .4)), triUp(0, -.04, .2, .18), smile(.66, .24, .3, .2, 2)],
    () => [quad([[-.68, -.62], [-.18, -.42], [-.24, -.26], [-.62, -.32]]), mirror(quad([[-.68, -.62], [-.18, -.42], [-.24, -.26], [-.62, -.32]])), triUp(0, -.04, .2, .18), smile(.68, .26, .3, .18, 0, .08)],
    () => [circle(-.42, -.44, .19, .23), circle(.42, -.44, .19, .23), quad([[0, -.17], [.1, -.05], [0, .07], [-.1, -.05]]), smile(.66, .25, .32, .2, 3)]
  ],
  hard: [
    () => [quad([[-.42, -.74], [-.28, -.44], [-.42, -.14], [-.56, -.44]]), mirror(quad([[-.42, -.74], [-.28, -.44], [-.42, -.14], [-.56, -.44]])), triUp(0, -.0, .16, .14), smile(.72, .26, .34, .2, 0, .13, 30)],
    () => [star(-.42, -.43, .27, .12), star(.42, -.43, .27, .12), smile(.7, .24, .32, .22, 3)],
    () => [quad([[-.72, -.72], [-.2, -.58], [-.22, -.5], [-.7, -.62]]), mirror(quad([[-.72, -.72], [-.2, -.58], [-.22, -.5], [-.7, -.62]])), triUp(-.42, -.32, .34, .26), mirror(triUp(-.42, -.32, .34, .26)), triUp(0, .0, .16, .14), smile(.72, .3, .3, .2, 0, .12, 30)]
  ],
  kids: [
    () => [triUp(-.42, -.45, .5, .46), mirror(triUp(-.42, -.45, .5, .46)), smile(.64, .26, .3, .18)],
    () => [circle(-.42, -.44, .23, .25), circle(.42, -.44, .23, .25), smile(.62, .26, .32, .16)]
  ]
};
// demo face for the menu pumpkin (already carved and glowing)
export const DEMO = () => [triUp(-.42, -.45, .44, .4), mirror(triUp(-.42, -.45, .44, .4)), triUp(0, -.04, .2, .18), smile(.66, .24, .3, .2, 2)];
export const toUV = poly => poly.map(([x, y]) => f2uv(x, y));
