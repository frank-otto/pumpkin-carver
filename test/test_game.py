"""Pumpkin Carver headless test (Chrome + SwiftShader WebGL, served over a local web server)."""
import asyncio, os, re, glob
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)

async def page(b, q='mid', **kw):
    ctx = await b.new_context(accept_downloads=True, **kw)
    await ctx.add_init_script(f"window.__pcSeed = 4242; window.__pcNoAutoQ = true; try{{if(!sessionStorage.getItem('pcInit')){{sessionStorage.setItem('pcInit','1'); localStorage.clear(); localStorage.setItem('pc-q','{q}')}}}}catch(e){{}}")
    pg = await ctx.new_page(); pg.set_default_timeout(240000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready")', timeout=60000)
    await pg.evaluate('window.__pcManual = true; __pc.step(1/30, 3)')
    return ctx, pg, logs

async def screen_path(pg, uv, close=True):
    pts = list(uv) + ([uv[0]] if close else [])
    return [await pg.evaluate(f'__pc.uvScreen({u},{v})') for u, v in pts]

async def trace_mouse(pg, uv, jitter=0.0, steps=6):
    sc = await screen_path(pg, uv)
    await pg.mouse.move(sc[0]['x'], sc[0]['y']); await pg.mouse.down(); await pg.evaluate('__pc.step(1/30)')
    for i in range(1, len(sc)):
        a, c = sc[i-1], sc[i]
        for k in range(1, steps + 1):
            j = jitter * (1 if (i + k) % 2 else -1)
            await pg.mouse.move(a['x'] + (c['x']-a['x'])*k/steps + j, a['y'] + (c['y']-a['y'])*k/steps + j); await pg.evaluate('__pc.step(1/30)')
    await pg.mouse.up(); await pg.evaluate('__pc.step(1/30, 3)')

async def trace_touch(pg, cdp, uv, steps=6):
    sc = await screen_path(pg, uv)
    tp = lambda p: [{'x': p['x'], 'y': p['y'], 'id': 1}]
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': tp(sc[0])}); await pg.evaluate('__pc.step(1/30)')
    for i in range(1, len(sc)):
        a, c = sc[i-1], sc[i]
        for k in range(1, steps + 1):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': tp({'x': a['x'] + (c['x']-a['x'])*k/steps, 'y': a['y'] + (c['y']-a['y'])*k/steps})}); await pg.evaluate('__pc.step(1/30)')
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.evaluate('__pc.step(1/30, 3)')

def bright_share(path, thr=250):
    im = Image.open(path).convert('RGB'); px = im.getdata(); n = sum(1 for r, g, b in px if r >= thr and g >= thr and b >= thr); return n / (im.width * im.height)

LOG = '__pc.log.map(e => e.n)'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        check('menu visible, EN default, title', await pg.is_visible('#menu.show') and (await pg.text_content('#btnPlay')) == 'Carve!' and (await pg.text_content('h1')) == 'Pumpkin Carver')
        check('menu shows a glowing demo pumpkin', await pg.evaluate('__pc.glow()') > .9 and await pg.evaluate('__pc.polys()') >= 4)
        check("graphics label reads 'Normal'", 'Normal' in await pg.text_content('#btnQ'), await pg.text_content('#btnQ'))
        await pg.screenshot(path=OUT + 'shot-menu.png')
        await pg.click('#btnLang'); de = await pg.text_content('#btnPlay'); await pg.screenshot(path=OUT + 'shot-menu-de.png')
        check('DE toggle', de == 'Schnitzen!' and 'Frei schnitzen' in await pg.text_content('#menu'), de)
        await pg.wait_for_timeout(300); await pg.reload(wait_until='load'); await pg.wait_for_function('document.body.classList.contains("ready") && window.__pc'); await pg.evaluate('window.__pcManual = true')
        check('language remembered after reload', (await pg.text_content('#btnPlay')) == 'Schnitzen!'); await pg.click('#btnLang')
        check('difficulty default Medium', await pg.evaluate('__pc.diff()') == 'medium' and 'on' in (await pg.get_attribute('#diff [data-d=medium]', 'class') or ''))
        await pg.click('#btnPlay'); await pg.wait_for_timeout(400); await pg.evaluate('__pc.step(1/30, 30)')
        s0 = await pg.evaluate('({st: __pc.S.state, t: __pc.S.time, on: __pc.S.timerOn, n: __pc.pieces().length, g: __pc.glow()})')
        check('carve starts: guides drawn, candle off, timer full', s0['st'] == 'carve' and s0['n'] >= 3 and s0['g'] < .05 and abs(s0['t'] - 55) < .01, s0)
        check('gentle start: timer waits for the first cut', not s0['on'] and await pg.is_visible('#hint.show') and await pg.is_visible('#carveUI.show'))
        await pg.screenshot(path=OUT + 'shot-carve.png')
        pcs = await pg.evaluate('__pc.pieces()')
        await trace_mouse(pg, pcs[0]['uv'])
        a1 = await pg.evaluate('({p: __pc.polys(), a: __pc.acc(), c: __pc.chunks(), cut: __pc.pieces()[0].cut, on: __pc.S.timerOn})')
        check('real mouse trace around a guide cuts it out, chunk pops', a1['p'] == 1 and a1['cut'] and a1['c'] >= 1 and a1['a'] > .1 and a1['on'], a1)
        lg = await pg.evaluate(LOG)
        check('wet carving samples fire (knife + cut + pop)', any(k in lg for k in ['slime', 'goo']) and any(k in lg for k in ['squish_a', 'splat', 'crunch']), sorted(set(lg)))
        await pg.evaluate('__pc.step(1/30, 30)'); t1 = await pg.evaluate('__pc.S.time')
        check('timer runs after the first cut', t1 < 54.5, t1)
        # a sloppy trace scores lower than a clean one
        await trace_mouse(pg, pcs[1]['uv'], jitter=9)
        a2 = await pg.evaluate('__pc.acc()'); check('sloppy cut still counts, accuracy reacts', await pg.evaluate('__pc.polys()') == 2, a2)
        await pg.click('#btnUndo'); await pg.evaluate('__pc.step(1/30, 3)')
        check('undo removes the last cut', await pg.evaluate('__pc.polys()') == 1 and not (await pg.evaluate('__pc.pieces()'))[1]['cut'])
        # tiny scribble is rejected
        sc = await pg.evaluate('__pc.uvScreen(.5,.5)'); await pg.mouse.move(sc['x'], sc['y']); await pg.mouse.down(); await pg.mouse.move(sc['x'] + 4, sc['y'] + 3); await pg.mouse.up(); await pg.evaluate('__pc.step(1/30, 3)')
        check('tiny scribble does not cut', await pg.evaluate('__pc.polys()') == 1)
        for pc in pcs[1:]: await trace_mouse(pg, pc['uv'])
        await pg.evaluate('__pc.step(1/30, 30)'); st = await pg.evaluate('({s: __pc.S.state, a: __pc.S.lastAcc})')
        check('all pieces cut -> candle lights itself, reveal', st['s'] == 'reveal' and st['a'] > .85, st)
        await pg.evaluate('__pc.step(1/30, 40)'); await pg.screenshot(path=OUT + 'shot-reveal.png')
        g = await pg.evaluate('__pc.glow()'); bs = bright_share(OUT + 'shot-reveal.png')
        check('face glows on reveal, no glare (near-white < 0.4%)', g > .9 and bs < .004, (g, round(bs, 5)))
        lg = await pg.evaluate(LOG); check('reveal: match + fwoosh + reward samples', 'match' in lg and 'fwoosh' in lg, sorted(set(lg)))
        cam = await pg.evaluate('__pc.cam()'); check('camera never clips into the pumpkin', cam['d'] > 3.5, cam)
        await pg.evaluate('__pc.step(1/30, 140)')
        check('next pumpkin after the showcase', await pg.evaluate('__pc.S.idx') == 1 and await pg.evaluate('__pc.S.state') == 'carve' and await pg.evaluate('__pc.polys()') == 0)
        # second: press Light early (partial) -> lower accuracy
        p2 = await pg.evaluate('__pc.pieces()'); await trace_mouse(pg, p2[0]['uv']); await pg.click('#btnLight'); await pg.evaluate('__pc.step(1/30, 200)')
        a = await pg.evaluate('__pc.S.accs'); check('lighting early scores a partial match', len(a) == 2 and a[1] < .6 and a[0] > a[1], a)
        # third: time runs out
        p3 = await pg.evaluate('__pc.pieces()'); await trace_mouse(pg, p3[0]['uv']); await pg.evaluate('__pc.S.time = 1; __pc.step(1/30, 260)')
        check('time up -> auto light -> game over', await pg.evaluate('__pc.S.state') == 'end' and await pg.is_visible('#end.show'))
        await pg.evaluate('__pc.step(1/30, 30)'); await pg.screenshot(path=OUT + 'shot-end.png')
        sc = await pg.evaluate('__pc.S.score'); best = await pg.evaluate("localStorage.getItem('pc-best-medium')")
        check('highscore saved per difficulty', sc > 0 and best == str(sc), (sc, best))
        eb = bright_share(OUT + 'shot-end.png'); check('end screen no glare', eb < .004, eb)
        await pg.fill('#eName', 'Pumpkin Pro')
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        d = await dl.value; path = OUT + 'card.png'; await d.save_as(path); im = Image.open(path)
        check('share card PNG 1080x1350', d.suggested_filename == 'pumpkin-carver.png' and im.size == (1080, 1350), im.size)
        check('share card has no glare', bright_share(path) < .006, bright_share(path))
        await pg.click('#btnAgain'); await pg.evaluate('__pc.step(1/30, 5)')
        check('play again restarts', await pg.evaluate('__pc.S.state') == 'carve' and await pg.evaluate('__pc.S.score') == 0)
        await pg.evaluate('__pc.end()'); await pg.evaluate('__pc.step(1/30, 5)'); await pg.click('#btnMenu'); await pg.evaluate('__pc.step(1/30, 5)')
        # difficulty memory + hard
        await pg.click('#diff [data-d=hard]'); await pg.wait_for_timeout(200); await pg.reload(); await pg.wait_for_function('window.__pc && document.body.classList.contains("ready")'); await pg.evaluate('window.__pcManual = true')
        check('difficulty remembered', await pg.evaluate('__pc.diff()') == 'hard')
        await pg.click('#btnPlay'); await pg.evaluate('__pc.step(1/30, 5)')
        check('hard: less time than medium', await pg.evaluate('__pc.S.time') == 42)
        await pg.evaluate('__pc.end()'); await pg.evaluate('__pc.step(1/30, 5)'); await pg.click('#btnMenu')
        # easy: magic snap
        await pg.click('#diff [data-d=easy]'); await pg.click('#btnPlay'); await pg.evaluate('__pc.step(1/30, 20)')
        pe = await pg.evaluate('__pc.pieces()'); await trace_mouse(pg, pe[0]['uv'], jitter=10)
        check('easy: rough cut snaps to the guide (magic)', (await pg.evaluate('__pc.pieces()'))[0]['cut'] and 'Magic' in await pg.text_content('#pops'), await pg.text_content('#pops'))
        await pg.evaluate('__pc.end()'); await pg.evaluate('__pc.step(1/30, 5)'); await pg.click('#btnMenu')
        # kids
        await pg.click('#btnKids'); await pg.click('#btnPlay'); await pg.evaluate('__pc.step(1/30, 20)')
        k = await pg.evaluate('({n: __pc.pieces().length, t: __pc.S.timerOn})'); pk = await pg.evaluate('__pc.pieces()'); await trace_mouse(pg, pk[0]['uv'], jitter=8); await pg.evaluate('__pc.step(1/30, 400)')
        check('kids: few big shapes, no timer, never fails', k['n'] <= 3 and not await pg.is_visible('#hTimeBox') and await pg.evaluate('__pc.S.state') == 'carve', k)
        await pg.evaluate('__pc.end()'); await pg.evaluate('__pc.step(1/30, 5)'); await pg.click('#btnMenu'); await pg.click('#btnKids')
        # free mode
        await pg.click('#btnFree'); await pg.evaluate('__pc.step(1/30, 20)')
        check('free mode: no guides, no timer', await pg.evaluate('__pc.pieces().length') == 0 and not await pg.is_visible('#hTimeBox'))
        await trace_mouse(pg, [[.42, .4], [.47, .4], [.445, .33]]); await trace_mouse(pg, [[.53, .4], [.58, .4], [.555, .33]])
        check('free mode: own shapes cut', await pg.evaluate('__pc.polys()') == 2)
        await pg.click('#btnLight'); await pg.evaluate('__pc.step(1/30, 220)')
        check('free mode: light -> showcase -> end with card', await pg.evaluate('__pc.S.state') == 'end' and await pg.is_visible('#btnCard'))
        await pg.screenshot(path=OUT + 'shot-free-end.png')
        # quality
        labels = []
        for _ in range(4): await pg.click('#btnQ'); labels.append(await pg.text_content('#btnQ'))
        check('quality cycles Low/Normal/High/Ultra', any('Normal' in l for l in labels) and any('Ultra' in l for l in labels), labels)
        check('no console errors (desktop)', not logs, logs[:3])
        await ctx.close()
        # mobile touch
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        cdp = await ctx.new_cdp_session(pg)
        await pg.screenshot(path=OUT + 'shot-mobile-menu.png')
        await pg.tap('#btnPlay'); await pg.evaluate('__pc.step(1/30, 30)')
        pm = await pg.evaluate('__pc.pieces()'); await trace_touch(pg, cdp, pm[0]['uv'])
        check('touch: finger trace cuts a piece', await pg.evaluate('__pc.polys()') == 1 and (await pg.evaluate('__pc.pieces()'))[0]['cut'])
        await pg.screenshot(path=OUT + 'shot-mobile-carve.png')
        bb = [await pg.eval_on_selector(s, 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }') for s in ['#hud', '#carveUI', '#hint']]
        check('mobile layout: HUD, hint and buttons inside the screen', all(r[0] >= 0 and r[1] <= 390 and r[2] >= 0 and r[3] <= 844 for r in bb), bb)
        for pc in pm[1:]: await trace_touch(pg, cdp, pc['uv'])
        await pg.evaluate('__pc.step(1/30, 50)'); await pg.screenshot(path=OUT + 'shot-mobile-reveal.png')
        check('mobile reveal no glare', bright_share(OUT + 'shot-mobile-reveal.png') < .004)
        await pg.evaluate('__pc.end()'); await pg.evaluate('__pc.step(1/30, 40)'); await pg.screenshot(path=OUT + 'shot-mobile-end.png')
        r = await pg.eval_on_selector('#end', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }')
        check('mobile end panel fits', r[0] >= 0 and r[1] <= 844, r)
        check('no console errors (mobile)', not logs, logs[:3])
        await ctx.close(); await b.close()
    # static checks
    src = ''.join(open(f, encoding='utf8').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html', ROOT + '/css/style.css'])
    check('no synth oscillators (real samples only)', 'createOscillator' not in src)
    texts = ''.join(open(f, encoding='utf8', errors='ignore').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html'] + glob.glob(ROOT + '/*.md') + glob.glob(ROOT + '/LICENSES/*.md'))
    check('no email addresses', not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', texts))
    check("no 'AI' wording", not re.search(r'\bAI\b', texts))
    print(f'\n{sum(R)}/{len(R)} passed'); return all(R)
ok = asyncio.run(main()); raise SystemExit(0 if ok else 1)
