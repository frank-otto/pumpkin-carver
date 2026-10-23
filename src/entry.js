import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWorld, updateWorld, QUALITY } from './world.js';
import { createPumpkin, resetCarve, redrawMask, carvedAt, grooveLine, clearGroove, drawGuides, buildChunk, PATTERNS, DEMO, toUV, uv2f, surf, PR, SQ } from './pumpkin.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const URL_TXT = '@Frank_AI_Lab';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__pcSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
const DIFF = {
  easy: { time: 75, n: 3, snap: .4, stars: [.45, .62, .78], mult: 1, guide: 1.3 },
  medium: { time: 55, n: 3, snap: 0, stars: [.5, .68, .82], mult: 1, guide: 1 },
  hard: { time: 42, n: 3, snap: 0, stars: [.52, .7, .84], mult: 1.5, guide: .9 },
  kids: { time: 0, n: 2, snap: .25, stars: [0, .3, .55], mult: 1, guide: 1.8 }
};
// language follows the phone/browser (German devices → DE, else EN) until the player picks one with the DE/EN toggle
function autoLang() { try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return /^de\b/i.test(l) ? 'de' : 'en'; } catch (e) { return 'en'; } }
const S = {
  state: 'menu', mode: 'challenge', lang: (ls.get('pc-lang', '') || autoLang()), diff: ls.get('pc-diff', 'medium'), kids: ls.get('pc-kids', '0') === '1', q: ls.get('pc-q', ''), qUser: !!ls.get('pc-q', ''),
  score: 0, gt: 0, el: 0, idx: 0, time: 0, timerOn: false, acc: 0, accs: [], starsAll: [], cuts: 0, newBest: false, best: 0, rv: 0, shake: 0, endT: -1,
  name: ls.get('pc-name', 'Player') || 'Player', lastScore: 0, lastStars: 0
};
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'high'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()], bestKey = () => 'pc-best-' + dkey();
A.setClock(() => S.gt);
const t = k => T[S.lang][k] || T.en[k] || k;

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer, QUALITY[S.q], 7); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(40, 1, .1, 200);
const F = createFX(scene, W.soft, W.smokeTex);
const P = createPumpkin(scene, W.flameTex); const PY = W.STUMP + PR * SQ - .05; P.group.position.set(0, PY, 0); P.glowDecal.position.set(0, W.STUMP + .02, 0); scene.add(P.glowDecal);
let composer, bloom;
function buildComposer() {
  if (composer) { composer.passes.forEach(p => p.dispose && p.dispose()); composer.dispose(); } // passes (bloom/bokeh render targets) are not freed by composer.dispose()
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .32 * QUALITY[S.q].bloom, .4, .92); composer.addPass(bloom); // small + high threshold: the face glows, no glare veil
  composer.addPass(new OutputPass());
}
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('pc-q', qn); }
  const q = QUALITY[qn]; renderer.shadowMap.enabled = q.shadows; W.moon.castShadow = q.shadows;
  if (q.shadows) { W.moon.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.moon.shadow.map) { W.moon.shadow.map.dispose(); W.moon.shadow.map = null; } }
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  buildComposer(); resize(); $('btnQ').textContent = '⚙ ' + t('q_' + qn);
}
let VW = 1, VH = 1, fitDist = 7;
function fit(aspect) { const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return Math.max(2.15 / th, 1.9 / (th * aspect)); }
function resize() {
  VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); }
  camera.aspect = VW / VH; camera.updateProjectionMatrix(); fitDist = fit(camera.aspect);
}

// ---------------- knife + debris + chunks ----------------
const knife = new THREE.Group(); {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(.07, .05); sh.lineTo(.07, .62); sh.lineTo(-.02, .62); sh.quadraticCurveTo(-.03, .2, 0, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .012, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#c8ccd8', metalness: .85, roughness: .32 })); blade.position.z = -.006; knife.add(blade);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .42, 10), new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: .7 })); handle.position.set(.03, .82, 0); knife.add(handle);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.16, .035, .07), new THREE.MeshStandardMaterial({ color: '#8a8070', metalness: .6, roughness: .4 })); guard.position.set(.03, .62, 0); knife.add(guard);
  knife.traverse(o => { if (o.isMesh) o.castShadow = true; }); knife.visible = false; scene.add(knife);
}
const seedGeo = new THREE.SphereGeometry(.045, 8, 6); seedGeo.scale(1, .32, .7);
const pulpGeo = new THREE.IcosahedronGeometry(.06, 0);
const seedMat = new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: .5 }), pulpMat = new THREE.MeshStandardMaterial({ color: '#f09a2a', roughness: .6 });
const debris = []; for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(i % 3 ? seedGeo : pulpGeo, i % 3 ? seedMat : pulpMat); m.visible = false; scene.add(m); debris.push({ m, v: new THREE.Vector3(), life: 0, w: new THREE.Vector3() }); }
let dCur = 0;
function burst(at, nrm, n) { for (let i = 0; i < n; i++) { const d = debris[dCur]; dCur = (dCur + 1) % debris.length; d.m.visible = true; d.m.position.copy(at); d.m.scale.setScalar(.8 + rng() * .6); d.life = 4 + rng() * 2;
  d.v.copy(nrm).multiplyScalar(1.4 + rng() * 2.2).add(new THREE.Vector3((rng() - .5) * 2, 1 + rng() * 2, (rng() - .5) * 2)); d.w.set(rng() * 9, rng() * 9, rng() * 9); } }
const groundY = (x, z) => Math.hypot(x, z) < 1.95 ? W.STUMP : 0;
const chunks = [];
function physicsObj(o, dt, bounce, onLand) {
  o.v.y -= 9.8 * dt; o.m.position.addScaledVector(o.v, dt); o.m.rotation.x += o.w.x * dt; o.m.rotation.y += o.w.y * dt; o.m.rotation.z += o.w.z * dt;
  const gy = groundY(o.m.position.x, o.m.position.z) + (o.r || .03);
  if (o.m.position.y < gy) { o.m.position.y = gy; const vy = -o.v.y; if (vy > .6 && onLand) onLand(vy); o.v.y = vy * bounce; o.v.x *= .6; o.v.z *= .6; o.w.multiplyScalar(.5); }
}

// ---------------- target pieces + accuracy ----------------
const AN = 160, ABOX = 1.15; // accuracy grid in face space [-ABOX, ABOX]^2
const accC = document.createElement('canvas'); accC.width = accC.height = AN; const accG = accC.getContext('2d', { willReadFrequently: true });
function rasterFace(polysUV) {
  accG.fillStyle = '#000'; accG.fillRect(0, 0, AN, AN); accG.fillStyle = '#fff';
  for (const p of polysUV) { accG.beginPath(); p.forEach(([u, v], i) => { const [fx, fy] = uv2f(u, v); const x = (fx + ABOX) / (2 * ABOX) * AN, y = (fy + ABOX) / (2 * ABOX) * AN; i ? accG.lineTo(x, y) : accG.moveTo(x, y); }); accG.closePath(); accG.fill(); }
  const d = accG.getImageData(0, 0, AN, AN).data, out = new Uint8Array(AN * AN); for (let i = 0; i < AN * AN; i++) out[i] = d[i * 4] > 127 ? 1 : 0; return out;
}
function iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k], y = b[k]; if (x & y) i++; if (x | y) u++; } return u ? i / u : 0; }
function cover(piece, carved) { let i = 0, n = 0; for (let k = 0; k < piece.length; k++) if (piece[k]) { n++; if (carved[k]) i++; } return n ? i / n : 0; }
let pieces = [], targetMask = null;
function setPattern(polys) {
  pieces = polys.map(p => { const uv = toUV(p); return { uv, mask: rasterFace([uv]), cut: false }; });
  targetMask = rasterFace(pieces.map(p => p.uv)); drawGuides(P, pieces, D().guide); P.U.uGuideA.value = 1;
}
function updateAcc() {
  if (S.mode === 'free') return 0; const cm = rasterFace(P.polys); S.acc = iou(cm, targetMask);
  for (const p of pieces) p.cut = cover(p.mask, cm) > .6; return S.acc;
}

// ---------------- carving ----------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let stroke = null; const chunkList = [];
function hitAt(cx, cy) {
  ndc.set(cx / VW * 2 - 1, -(cy / VH) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hs = ray.intersectObject(P.outer, false);
  for (const h of hs) { const u = h.uv.x, v = 1 - h.uv.y; const n = h.face.normal.clone().transformDirection(P.outer.matrixWorld); if (n.dot(ray.ray.direction) > 0) continue; return { u, v, p: h.point, n }; }
  return null;
}
function placeKnife(h, cutting) {
  if (!h) { knife.visible = false; return; } knife.visible = true;
  knife.position.copy(h.p).addScaledVector(h.n, cutting ? -.05 : .08);
  knife.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.n); knife.rotateX(-.35); knife.rotateY(.6);
}
function canCarve() { return S.state === 'carve' && !(P.swap > 0); }
function strokeStart(cx, cy) {
  if (!canCarve()) return false; const h = hitAt(cx, cy); if (!h) return false;
  stroke = { pts: [[h.u, h.v]], last: h }; placeKnife(h, true); if (!S.timerOn && S.mode === 'challenge' && D().time) S.timerOn = true; return true;
}
function strokeMove(cx, cy) {
  const h = hitAt(cx, cy); if (!stroke) { if (S.state === 'carve' && !isTouch) placeKnife(h, false); return; }
  if (!h) return; placeKnife(h, true);
  const l = stroke.pts[stroke.pts.length - 1]; const du = h.u - l[0], dv = h.v - l[1];
  if (Math.hypot(du * 2, dv) > .004) { grooveLine(P, l, [h.u, h.v], 5); stroke.pts.push([h.u, h.v]); A.sfx.knife(S.gt); if (rng() < .25) sparks(F, h.p, 1, { colors: ['#ffcf8a'], speed: .6, life: .35, grav: 2, size: .04 }); }
}
function polyAreaF(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = uv2f(...pts[i]), [x2, y2] = uv2f(...pts[(i + 1) % pts.length]); a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
function strokeEnd() {
  if (!stroke) return; const pts = stroke.pts; stroke = null; if (isTouch) knife.visible = false;
  if (pts.length < 5) return;
  const fs = pts.map(p => uv2f(...p)); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of fs) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const diag = Math.hypot(x1 - x0, y1 - y0), gap = Math.hypot(fs[0][0] - fs[fs.length - 1][0], fs[0][1] - fs[fs.length - 1][1]);
  if (diag < .1) { A.sfx.scratch(); return; }
  if (!S.kids && gap > Math.max(.12, diag * .45)) { A.sfx.scratch(); popText(t('close'), '#ffe2b8', .8); return; }
  cutPoly(pts);
}
function cutPoly(pts, quiet) {
  if (polyAreaF(pts) < .006) { A.sfx.scratch(); return false; }
  let poly = pts, label = null, col = '#ffffff';
  if (S.mode === 'challenge') {
    const sm = rasterFace([pts]); let best = 0, bp = null; for (const p of pieces) { if (p.cut) continue; const q = iou(sm, p.mask); if (q > best) { best = q; bp = p; } }
    if (D().snap && bp && best >= D().snap && best < .97) { poly = bp.uv.map(x => x.slice()); label = t('magic'); col = '#ffe38a'; }
    else if (S.kids) { label = t('great'); col = '#ffe38a'; }
    else if (best >= .8) { label = t('clean'); col = '#b8ffb0'; } else if (best >= .6) { label = t('nice'); col = '#fff0a8'; } else if (best >= .35) { label = t('rough'); col = '#ffd0a0'; } else { label = t('off'); col = '#ffb8b8'; }
  }
  P.polys.push(poly); redrawMask(P); S.cuts++;
  // chunk pops out
  const ch = buildChunk(P, poly);
  if (ch) { ch.position.applyMatrix4(P.group.matrixWorld); ch.quaternion.copy(P.group.quaternion); scene.add(ch); const n = ch.userData.normal.clone().applyQuaternion(P.group.quaternion);
    const o = { m: ch, v: n.clone().multiplyScalar(2 + rng()).add(new THREE.Vector3((rng() - .5), 1.6 + rng(), .4)), w: new THREE.Vector3((rng() - .5) * 8, (rng() - .5) * 8, (rng() - .5) * 8), r: .06, landed: 0 }; chunks.push(o); chunkList.push(o);
    burst(ch.position, n, 10 + Math.round(rng() * 6)); puff(F, ch.position, 2, '#c87a3a', .5); }
  if (!quiet) { A.sfx.cut(polyAreaF(poly)); A.sfx.pop(); S.shake = Math.max(S.shake, .25); }
  if (S.mode === 'challenge') { const before = pieces.filter(p => p.cut).length; updateAcc(); drawGuides(P, pieces.filter(p => !p.cut), D().guide); hud(); pulse('hAccBox');
    if (label && !quiet) popText(label, col, 1.05); if (!quiet && pieces.every(p => p.cut) && before < pieces.length) S.autoT = S.gt + .7; }
  return true;
}
function undo() {
  if (S.state !== 'carve' || !P.polys.length) return; P.polys.pop(); redrawMask(P); const o = chunkList.pop(); if (o) { puff(F, o.m.position, 2, '#8a6a4a', .4); scene.remove(o.m); o.m.geometry.dispose(); chunks.splice(chunks.indexOf(o), 1); }
  updateAcc(); if (S.mode === "challenge") drawGuides(P, pieces.filter(p => !p.cut), D().guide); hud(); A.sfx.undo();
}

// ---------------- flow ----------------
function freshPumpkin() {
  resetCarve(P); for (const o of chunks) { scene.remove(o.m); o.m.geometry.dispose(); } /* each chunk owns its geometry; materials are shared */ chunks.length = 0; chunkList.length = 0; for (const d of debris) { d.m.visible = false; d.life = 0; }
  setGlow(0); P.group.rotation.set(0, 0, 0); P.swap = 0;
}
let glowK = 0; function setGlow(k) { glowK = k; }
function patternFor(i) { const pool = PATTERNS[dkey()]; return pool[Math.min(i, pool.length - 1)](); }
function start(mode) {
  A.unlock(); S.mode = mode || 'challenge'; S.state = 'carve'; S.score = 0; S.idx = 0; S.accs = []; S.starsAll = []; S.cuts = 0; S.newBest = false; S.el = 0; S.endT = -1;
  S.best = +ls.get(bestKey(), 0) || 0; nextPumpkin(true); show(null); A.sfx.start(S.kids); A.startMusic(); hud();
}
function nextPumpkin(first) {
  freshPumpkin(); P.swap = first ? .35 : .6; S.state = 'carve'; S.time = D().time; S.timerOn = false; S.acc = 0; S.autoT = 0; S.lastTick = 99; S.pel = 0;
  if (S.mode === 'free') { pieces = []; targetMask = null; P.U.uGuideA.value = 0; P.guide.g.clearRect(0, 0, 1024, 512); P.guide.t.needsUpdate = true; } else setPattern(patternFor(S.idx));
  hud(); $('btnLight').disabled = false;
}
function light() {
  if (S.state !== 'carve') return; S.state = 'reveal'; S.rv = 0; stroke = null; knife.visible = false; S.timerOn = false; A.sfx.light();
  if (S.mode === 'challenge') {
    const acc = updateAcc(), d = D(); const tk = isTouch ? .88 : 1, st = acc >= d.stars[2] * tk ? 3 : acc >= d.stars[1] * tk ? 2 : acc >= d.stars[0] * tk ? 1 : 0; const stars = S.kids ? Math.max(1, st) : st;
    const tb = acc >= .5 && d.time ? Math.round(S.time * 8) : 0, bonus = acc >= .9 ? 300 : 0; const pts = Math.round((Math.round(acc * 1000) + tb + bonus) * d.mult);
    S.score += pts; S.accs.push(acc); S.starsAll.push(stars); S.lastScore = pts; S.lastStars = stars; S.lastAcc = acc;
  }
}
function revealStep(dt) {
  S.rv += dt; const r = S.rv;
  setGlow(clamp((r - .45) / .9, 0, 1));
  if (r > 1.1 && r - dt <= 1.1) { sparks(F, new THREE.Vector3(0, PY + .2, 1.2), 26, { colors: ['#ffd08a', '#ffb050', '#fff0c8'], speed: 2.2, up: 1.2, life: 1, grav: -.2, size: .07 });
    if (S.mode === 'challenge') { A.sfx.reveal(S.lastStars); if (S.lastAcc >= .9) A.sfx.great();
      popText(`${Math.round(S.lastAcc * 100)}% · ${'★'.repeat(S.lastStars)}${'☆'.repeat(3 - S.lastStars)}`, '#ffe9b0', 1.35, 0, true); popText(`+${S.lastScore}`, '#ffffff', 1.1, 0, true); hud(); pulse('hScoreBox'); }
    else A.sfx.reveal(3); }
  const spin = clamp((r - 1.7) / 3.2, 0, 1); P.group.rotation.y = ease(spin) * Math.PI * 2;
  if (r > 5.8) {
    if (S.mode === 'challenge' && S.idx + 1 < D().n) { S.idx++; nextPumpkin(false); }
    else end();
  }
}
function end() {
  S.state = 'end'; A.stopMusic(); knife.visible = false; stroke = null; setGlow(1); P.U.uGuideA.value = 0;
  if (S.mode === 'challenge') { if (S.score > S.best) { S.best = S.score; S.newBest = true; ls.set(bestKey(), S.score); } A.sfx.end(S.newBest); } else A.sfx.end(false);
  const free = S.mode === 'free';
  $('eTitle').textContent = free ? t('freeOver') : S.kids ? t('kidsOver') : t('over');
  $('eScore').textContent = free ? '🎃' : S.score; $('eBest').textContent = free ? '' : S.newBest ? t('newBest') : `${t('best')}: ${S.best}`;
  const stars = S.starsAll.reduce((a, b) => a + b, 0), avg = S.accs.length ? S.accs.reduce((a, b) => a + b, 0) / S.accs.length : 0;
  $('eStats').textContent = free ? `${S.cuts} ${t('cuts')}` : `${'★'.repeat(stars)} ${stars}/${S.starsAll.length * 3} ${t('stars')} · ${Math.round(avg * 100)}% ${t('avg')} · ${S.cuts} ${t('cuts')}`;
  $('eName').value = S.name; show('end');
}
function toMenu() { S.state = 'menu'; A.stopMusic(); show('menu'); demoPumpkin(); }
function demoPumpkin() { freshPumpkin(); P.polys.push(...DEMO().map(toUV)); redrawMask(P); P.U.uGuideA.value = 0; setGlow(1); }

// ---------------- UI ----------------
function show(id) { for (const s of ['menu', 'end']) $(s).classList.toggle('show', s === id); document.body.dataset.state = S.state === 'reveal' ? 'carve' : S.state; document.body.classList.toggle('kids', S.kids); document.body.classList.toggle('free', S.mode === 'free'); }
function pulse(id, bad) { const el = $(id); if (!el) return; el.classList.remove('pulse', 'bad'); void el.offsetWidth; el.classList.add('pulse'); if (bad) el.classList.add('bad'); }
function hud() {
  $('hScore').textContent = S.score; $('hPumpkin').textContent = `${Math.min(S.idx + 1, D().n)}/${D().n}`;
  $('hTime').textContent = D().time ? Math.ceil(S.time) : '∞'; $('hAcc').textContent = Math.round(S.acc * 100) + '%';
  $('hTimeBox').classList.toggle('low', S.timerOn && S.time < 10);
}
function applyLang() {
  document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  $('h3').textContent = S.kids ? t('h3k') : t('h3'); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').style.display = S.kids ? 'none' : '';
  $('btnSound').classList.toggle('on', !A.isMuted()); $('btnQ').textContent = '⚙ ' + t('q_' + S.q); hud();
}
const timers = [], popT = [];
function popText(txt, col, big = 1, yOff = 0, center = false) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt;
  let x = VW / 2, y = VH * .3; if (!center && lastPtr) { x = clamp(lastPtr.x, 110, VW - 110); y = clamp(lastPtr.y - 60, 110, VH - 140); }
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = col;
  { const now = S.gt; popT.splice(0, popT.length, ...popT.filter(q => now - q < .7)); el.style.marginTop = (popT.length * 44 - yOff) + 'px'; popT.push(now); }
  el.style.fontSize = (30 * big * (VW < 600 ? .85 : 1)) + 'px'; $('pops').appendChild(el); timers.push({ t: S.gt + 1.4, f: () => el.remove() });
}
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }

// ---------------- input ----------------
let isTouch = false, lastPtr = null, ptrId = null;
canvas.addEventListener('pointerdown', e => { A.unlock(); isTouch = e.pointerType === 'touch'; lastPtr = { x: e.clientX, y: e.clientY };
  if (strokeStart(e.clientX, e.clientY)) { e.preventDefault(); ptrId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} } });
canvas.addEventListener('pointermove', e => { isTouch = e.pointerType === 'touch'; lastPtr = { x: e.clientX, y: e.clientY }; strokeMove(e.clientX, e.clientY); });
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { if (ptrId === e.pointerId || ptrId === null) { strokeEnd(); ptrId = null; } });
canvas.addEventListener('pointerleave', () => { if (!stroke && S.state === 'carve') knife.visible = false; });
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; if (e.repeat) return;
  if (e.code === 'Enter' && S.state === 'menu') { start('challenge'); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && S.state === 'carve') { e.preventDefault(); light(); }
  if ((e.code === 'KeyZ' || e.code === 'Backspace') && S.state === 'carve') undo();
});
$('btnPlay').onclick = () => start('challenge'); $('btnFree').onclick = () => start('free');
$('btnAgain').onclick = () => start(S.mode); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); };
$('btnLight').onclick = () => light(); $('btnUndo').onclick = () => undo();
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('pc-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('pc-diff', S.diff); applyLang(); A.sfx.ui(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('pc-kids', S.kids ? '1' : '0'); applyLang(); show('menu'); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);

// ---------------- share card (renders the pumpkin centered at 4:5) ----------------
async function saveCard(share) {
  S.name = ($('eName').value || '').trim() || 'Player'; ls.set('pc-name', S.name);
  try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350, RW = 864, RH = 1080;
  renderer.setPixelRatio(1); renderer.setSize(RW, RH, false); composer.setPixelRatio(1); composer.setSize(RW, RH);
  const old = { a: camera.aspect, p: camera.position.clone(), q: camera.quaternion.clone() };
  camera.aspect = RW / RH; camera.updateProjectionMatrix(); const dist = fit(camera.aspect) * 1.25;
  camera.position.set(.6, PY + 1.1, dist); camera.lookAt(0, PY - .15, 0); P.group.rotation.y = 0; composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.position.copy(old.p); camera.quaternion.copy(old.q); resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(10,6,20,.8)'); gr.addColorStop(.24, 'rgba(10,6,20,.1)'); gr.addColorStop(.78, 'rgba(10,6,20,.15)'); gr.addColorStop(1, 'rgba(10,6,20,.9)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(20,8,30,.85)', lw = 8) => { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 96); txt('🎃 Pumpkin Carver', CW / 2, 130, '#ffd9a8', 'rgba(60,20,0,.8)', 10);
  k.font = Fo(500, 44); txt(S.name.slice(0, 18), CW / 2, 205, '#ffffff');
  if (S.mode === 'challenge') { const stars = S.starsAll.reduce((a, b) => a + b, 0); k.font = Fo(700, 70); txt(`${S.score}  ·  ${'★'.repeat(stars)}`, CW / 2, 290, '#fff0c8');
    k.font = Fo(500, 34); txt(`${S.kids ? t('kids') : t('d_' + S.diff)} · ${Math.round(S.accs.reduce((a, b) => a + b, 0) / Math.max(1, S.accs.length) * 100)}% ${t('avg')}${S.newBest ? ' · ' + t('newBest') : ''}`, CW / 2, 340, '#ffe4c8'); }
  else { k.font = Fo(600, 52); txt(t('cardMine'), CW / 2, 290, '#fff0c8'); }
  k.font = Fo(600, 48); txt(S.mode === 'challenge' ? t('cardLine') : t('cardLine'), CW / 2, 1230, '#ffd27a');
  k.font = Fo(400, 32); txt(t('cardCta') + ' · ' + URL_TXT, CW / 2, 1290, 'rgba(255,255,255,.92)');
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); window.__pcCard = { w: c.width, h: c.height };
  const file = new File([blob], 'pumpkin-carver.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Pumpkin Carver — ${t('cardLine')} ${URL_TXT}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pumpkin-carver.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ---------------- simulation ----------------
const camPos = new THREE.Vector3(0, 4, 12), look = new THREE.Vector3(0, PY, 0), _v = new THREE.Vector3(), _l = new THREE.Vector3();
let owlT = 18;
function step(dt) {
  dt = Math.min(dt, 1 / 20); S.gt += dt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  const st = S.state;
  if (st === 'carve') { S.el += dt; S.pel += dt;
    if (S.timerOn) { S.time = Math.max(0, S.time - dt); const s = Math.ceil(S.time); if (S.time < 5.5 && s !== S.lastTick && S.time > 0) { S.lastTick = s; A.sfx.tick(); } if (S.time <= 0) { popText(t('timeUp'), '#ffd0a0', 1.2, 0, true); strokeEnd(); light(); } }
    if (S.autoT && S.gt >= S.autoT) { S.autoT = 0; light(); } }
  if (S.state === 'reveal') revealStep(dt);
  // swap animation (new pumpkin pops up)
  if (P.swap > 0) { P.swap = Math.max(0, P.swap - dt); }
  const sk = P.swap > 0 ? 1 - P.swap / .6 : 1; const sc = P.swap > 0 ? (sk < .5 ? .001 + sk * 2 : 1 + Math.sin((sk - .5) * 2 * Math.PI) * .12 * (1 - sk)) : 1; P.group.scale.setScalar(Math.max(.001, sc));
  // glow
  const g = glowK, fl = 1 + Math.sin(S.gt * 7.3) * .08 + Math.sin(S.gt * 19.1) * .05 + Math.sin(S.gt * 2.1) * .05 + (rng() - .5) * .05;
  P.U.uGlow.value = g * fl; P.innerMat.emissiveIntensity = g * 1.35 * fl; P.light.intensity = g * 9 * fl; P.flame.material.opacity = g; P.flame.scale.set(.3, .58 * fl, 1);
  P.glowDecal.material.opacity = g * .24 * fl; W.work.intensity = lerp(26, 5, g); W.hemi.intensity = lerp(.9, .5, g); W.fill.intensity = lerp(.55, .15, g); P.U.uGuideA.value = S.mode === 'free' ? 0 : lerp(1, 0, g);
  if (st === 'menu' || st === 'end') P.group.rotation.y = Math.sin(S.gt * .4) * .5;
  // chunks + debris
  for (const o of chunks) if (o.m.position.y > -1) physicsObj(o, dt, .25, vy => { if (o.landed++ < 2) A.sfx.land(vy); });
  for (const d of debris) { if (d.life <= 0) continue; d.life -= dt; physicsObj(d, dt, .2); if (d.life < .6) d.m.scale.setScalar(Math.max(.01, d.life / .6)); if (d.life <= 0) d.m.visible = false; }
  // camera
  const carving = st === 'carve' || st === 'reveal';
  const dist = st === 'reveal' ? fitDist * 1.12 : carving ? fitDist : fitDist * 1.3;
  let ox = 0, oy = 0; if (st === 'end') { if (camera.aspect > 1) ox = -1.25 * Math.min(1.6, camera.aspect); else oy = 1.5; }
  const orbit = st === 'menu' ? Math.sin(S.gt * .15) * .35 : st === 'reveal' ? Math.sin(S.rv * .8) * .12 : 0;
  _v.set(Math.sin(orbit) * dist - ox * .0, PY + (carving ? .55 : 1.0), Math.cos(orbit) * dist);
  camPos.lerp(_v, 1 - Math.exp(-dt * 3)); camera.position.copy(camPos);
  if (S.shake > .01) camera.position.add(new THREE.Vector3(rng() - .5, rng() - .5, 0).multiplyScalar(S.shake * .08));
  _l.set(-ox, PY - (carving ? .05 : .1) - oy, 0); look.lerp(_l, 1 - Math.exp(-dt * 3)); camera.lookAt(look); camera.updateMatrixWorld();
  S.shake *= Math.exp(-dt * 6);
  if (st !== 'carve' && !stroke) knife.visible = false;
  updateWorld(W, S.gt, dt);
  updateFX(F, dt, VH * renderer.getPixelRatio() * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  owlT -= dt; if (owlT < 0) { owlT = 25 + rng() * 20; if (st !== 'menu') A.sfx.owl(); }
  if (st === 'carve' && Math.floor(S.gt * 10) !== S._h) { S._h = Math.floor(S.gt * 10); hud(); }
  const hk = S.mode === 'free' ? 'hintF' : S.kids ? 'hintK' : 'hint';
  $('hint').classList.toggle('show', st === 'carve' && S.idx === 0 && S.cuts === 0 && S.pel > .4); $('hint').textContent = t(hk);
  $('carveUI').classList.toggle('show', st === 'carve');
}
function render() { composer.render(); }
const fps = { ema: 60, n: 0, acc: 0, frames: 0, checked: 0 };
function fpsTick(dt) { fps.acc += dt; fps.frames++; if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.ema = fps.n ? fps.ema * .6 + f * .4 : f; fps.n++; fps.acc = 0; fps.frames = 0;
  if (!S.qUser && !window.__pcNoAutoQ && fps.n >= 3 && fps.ema < 42 && S.q !== 'low' && S.gt - fps.checked > 3) { fps.checked = S.gt; const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(fps.ema)} fps)`); fps.n = 0; } } }

applyQuality(S.q); applyLang(); show('menu'); demoPumpkin();
for (let i = 0; i < 90; i++) step(1 / 30); // settle camera so frame 0 is already framed (never black)
let last = performance.now();
function loop(now) { const dt = (now - last) / 1000; last = now; if (!window.__pcManual) { step(dt); render(); fpsTick(dt); } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
const uvScreen = (u, v) => { const p = surf(u, v, 1); P.group.localToWorld(p); const q = p.clone().project(camera); return { x: (q.x * .5 + .5) * VW, y: (-q.y * .5 + .5) * VH, z: q.z }; };
window.__pc = { S, audioState: () => A.audioState(), start, end, light, undo, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  pieces: () => pieces.map(p => ({ uv: p.uv, cut: p.cut })), cut: (poly, quiet) => cutPoly(poly, quiet), acc: () => updateAcc(), polys: () => P.polys.length, chunks: () => chunks.length,
  uvScreen, diffs: DIFF, diff: () => S.diff, knife: () => ({ visible: knife.visible }), glow: () => glowK,
  cam: () => ({ d: camera.position.distanceTo(new THREE.Vector3(0, PY, 0)), near: camera.near, y: camera.position.y }) };
document.body.classList.add('ready');
