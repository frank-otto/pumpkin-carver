// WebAudio player for the embedded CC0 samples (window.PC_SOUNDS, base64 mp3) – works via file://
let ctx = null, master = null, musicGain = null, loopGain = null, music = null, windSrc = null, bufs = {}, ready = false, muted = false;
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
// iOS Safari: create/resume inside the tap, play a 1-sample silent buffer (unlocks output), ask for 'playback' (ignores the mute switch)
function kick(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
export function audioState() { return ctx ? ctx.state : 'none'; }
export async function unlock() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); kick(ctx); if (ctx.state !== 'running') ctx.resume().catch(() => {}); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
  loopGain = ctx.createGain(); loopGain.gain.value = 0.35; loopGain.connect(master);
  const src = window.PC_SOUNDS || {};
  await Promise.all(Object.keys(src).map(k => new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })));
  ready = true; window.__pcAudioReady = Object.keys(bufs).length; startWind();
}
export function play(n, vol = 1, rate = 1, delay = 0) {
  log.push({ n, t: clock() + delay, v: vol, r: rate });
  if (!ready || !bufs[n]) return;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(ctx.currentTime + delay);
}
function startWind() { if (windSrc || !bufs.wind) return; windSrc = ctx.createBufferSource(); windSrc.buffer = bufs.wind; windSrc.loop = true; windSrc.connect(loopGain); windSrc.start(); }
export function startMusic() {
  log.push({ n: 'music_graveyard', t: clock(), v: 1, r: 1, loop: 1 });
  if (!ready || music) return;
  music = ctx.createBufferSource(); music.buffer = bufs.music_graveyard; music.loop = true; music.connect(musicGain); music.start();
}
export function stopMusic() { log.push({ n: '__stopmusic', t: clock() }); if (music) { try { music.stop(); } catch (e) {} music = null; } }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export function isMuted() { return muted; }
let lastKnife = 0;
export const sfx = {
  knife(t) { if (t - lastKnife < .11) return; lastKnife = t; const r = Math.random(); play(r < .6 ? 'slime' : 'goo', .16 + Math.random() * .08, .75 + Math.random() * .3); },
  cut(big) { play('crunch', .75, .85 + Math.random() * .15); play('squish_a', .65, .9 + Math.random() * .2, .03); play('sub', .3 + big * .2, 1.2); },
  pop() { play('splat', .35, 1.1 + Math.random() * .2, .05); play('swish_a', .3, .8); },
  land(v) { play(Math.random() < .5 ? 'thud_a' : 'thud_b', Math.min(.6, .2 + v * .08), 1.2 + Math.random() * .2); },
  scratch() { play('swish_b', .3, 1.3); },
  light() { play('match', .9, 1); play('fwoosh', .55, .8, .45); play('sub', .45, .9, .45); },
  reveal(stars) { if (stars >= 3) { play('harp', .55); play('sparkle', .55, 1, .1); play('magic', .45, 1, .2); } else if (stars === 2) { play('chime_c', .6); play('sparkle', .4, .9, .1); } else play('chime_c', .5, .85); },
  great() { play('epic', .4); },
  undo() { play('soft', .6, .8); play('swish_a', .25, 1.5); },
  tick() { play('thud_a', .22, 1.7); },
  owl() { play('owl', .25, .95); },
  start(kids) { play('stinger', .6); if (kids) play('laugh_kids', .5, 1, .4); },
  end(best) { play('bell', .55, .9); play('howl', .3, 1, .3); if (best) play('success', .6, 1, .2); },
  ui() { play('soft', .4, 1.5); }
};
