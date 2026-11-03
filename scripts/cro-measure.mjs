// usage: node cro-measure.mjs <label> <baseUrl> [routes comma sep, "" = root]  -> out/<label>/*
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';
const [label, BASE = 'http://127.0.0.1:4173/', routesArg = ',#/audit'] = process.argv.slice(2);
const routes = routesArg.split(',').map(r => (r === 'root' ? '' : r));
const OUT = `C:/Users/ANVIOSA/fourcee-audit/cro-out/${label}`;
fs.mkdirSync(OUT, { recursive: true });
const HEAVY = /\.(glb|gltf|wasm|task|usdz|fbx|hdr|exr|drc|ktx2|bin|mp4|webm|gif|png|jpg|jpeg|webp|svg|woff2?|ttf|js|css|json)(\?|$)/i;
const res = {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

for (const mobile of [true, false]) {
  const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const tag = mobile ? 'm' : 'd';
  const browser = await chromium.launch({ headless: true });
  for (const r of routes) {
    const ctx = await browser.newContext(mobile
      ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
      : { viewport: vp });
    const page = await ctx.newPage();
    const key = `${tag}${r ? '-' + r.replace('#/', '') : '-root'}`;
    const reqs = [];
    const pending = [];
    page.on('response', (resp) => {
      pending.push((async () => {
        try {
          const rq = resp.request();
          const s = await rq.sizes();
          let gz = null;
          const url = resp.url();
          const ct = resp.headers()['content-type'] || '';
          if (/javascript|css|json|html|svg|wasm|text/.test(ct) || /\.(js|css|json|svg|wasm|task)$/.test(url.split('?')[0])) {
            try { const b = await resp.body(); gz = zlib.gzipSync(b).length; } catch {}
          }
          reqs.push({ url: url.replace(/^https?:\/\/[^/]+/, m => m.includes('127.0.0.1') ? '' : m), host: new URL(url).hostname, status: resp.status(), bytes: s.responseBodySize, gzipEst: gz, t: Date.now() - t0 });
        } catch {}
      })());
    });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, longTasks: [], cls: 0 };
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    });
    const t0 = Date.now();
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
    const tDom = Date.now() - t0;
    // splash gate
    let splashSeen = false, tSplashGone = null, tSplashFirst = null;
    const sp = page.locator('[data-testid=splash]');
    try { await sp.first().waitFor({ state: 'attached', timeout: 3000 }); splashSeen = true; tSplashFirst = Date.now() - t0; } catch {}
    if (splashSeen) { await sp.first().waitFor({ state: 'detached', timeout: 90000 }).catch(() => {}); tSplashGone = Date.now() - t0; }
    await page.waitForLoadState('load').catch(() => {});
    const tLoad = Date.now() - t0;
    // wait for h1 (content)
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const tH1 = Date.now() - t0;
    await sleep(3500); // let the portal guide etc appear (as a real visitor would see)
    const folded0 = await page.evaluate(() => !!document.querySelector('[role=dialog],[aria-modal=true]'));
    await page.screenshot({ path: `${OUT}/${key}-00-first-view-incl-overlays.png` });
    await page.getByRole('button', { name: 'Got it' }).evaluateAll(els => els.forEach(el => el.click())).catch(() => {});
    await sleep(600);
    // second gate: audit intro splash
    await page.screenshot({ path: `${OUT}/${key}-01-above-fold.png` });

    const analyse = () => page.evaluate(() => {
      const cands = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4; });
      cands.sort((a, b) => b.scrollHeight - a.scrollHeight);
      const sc = cands[0] || document.scrollingElement;
      const vh = window.innerHeight, vw = window.innerWidth;
      const visible = (e) => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      // words in viewport
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let words = 0, n; const textSample = [];
      while ((n = tw.nextNode())) {
        const t = n.textContent.trim(); if (!t) continue;
        const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName)) continue;
        if (!visible(p)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) { words += t.split(/\s+/).length; if (textSample.length < 60) textSample.push(t.slice(0, 60)); }
      }
      const scTop = sc === document.scrollingElement ? window.scrollY : sc.scrollTop;
      const secs = [...(sc.querySelectorAll ? sc.querySelectorAll('section') : [])];
      const secInfo = secs.map(s => { const r = s.getBoundingClientRect(); return { id: s.id || '', h: Math.round(r.height), y: Math.round(r.top + scTop), h2: (s.querySelector('h1,h2,h3')?.textContent || '').trim().slice(0, 50) }; });
      const ctaRe = /audit|live|get |book|call|calculate|try |checkout|request|start|plan|pricing|demo|invoice|choose|select|contact|talk|continue|enquire|reserve|schedule/i;
      const ctas = [...document.querySelectorAll('button,a[href],[role=button]')].filter(e => visible(e)).map(e => {
        const r = e.getBoundingClientRect(); const txt = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        let fixed = false; for (let p = e; p; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') { fixed = true; break; } }
        return { text: txt.slice(0, 60), fx: /fx-btn/.test(e.className), fixed, y: Math.round(r.top + (fixed ? 0 : scTop)), screen: fixed ? 0 : +((r.top + scTop) / vh).toFixed(2), h: Math.round(r.height), w: Math.round(r.width) };
      }).filter(c => c.text && (c.fx || ctaRe.test(c.text)));
      const inputs = [...document.querySelectorAll('input,textarea,select')].filter(e => visible(e) && !['range', 'checkbox', 'hidden'].includes(e.type)).map(e => ({ type: e.type, fs: parseFloat(getComputedStyle(e).fontSize), ph: e.placeholder }));
      const canv = document.querySelectorAll('canvas').length, vids = document.querySelectorAll('video').length;
      return { scrollEl: sc === document.scrollingElement ? 'document' : (sc.tagName + '.' + String(sc.className).slice(0, 40)), scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, vh, screens: +(sc.scrollHeight / vh).toFixed(2), sections: secs.length, secInfo, wordsAboveFold: words, textSample, ctas, inputs, canvases: canv, videos: vids, domNodes: document.getElementsByTagName('*').length, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 100) };
    });
    let a = await analyse();
    // scroll-through + screenshots
    const step = Math.round(vp.height * 0.85);
    const seq = [];
    const primaryRe = /get live|go live|checkout|pricing|book|start|hear|request/i;
    let firstFxIdx = null, primIdx = null, i = 0;
    const maxShots = 45;
    const total = a.scrollHeight;
    const tScroll0 = Date.now();
    let reachedAt = {};
    for (let y = 0; y < total + step && i < maxShots; y += step, i++) {
      await page.evaluate((yy) => { const c = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 4; }).sort((p, q) => q.scrollHeight - p.scrollHeight)[0]; (c || document.scrollingElement).scrollTo(0, yy); }, y);
      await sleep(350);
      const inview = await page.evaluate(({ re }) => {
        const vh = innerHeight; const rx = new RegExp(re, 'i');
        return [...document.querySelectorAll('button,a[href]')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.visibility !== 'hidden' && r.top >= 0 && r.bottom <= vh && rx.test(e.innerText || ''); }).map(e => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 50));
      }, { re: primaryRe.source });
      if (inview.length && primIdx === null) { primIdx = i; reachedAt = { stepIndex: i, scrollY: y, ms: Date.now() - tScroll0, cta: inview[0] }; }
      await page.screenshot({ path: `${OUT}/${key}-scroll-${String(i).padStart(2, '0')}.png` });
      seq.push({ i, y, inview });
    }
    await page.evaluate(() => { const c = [...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll'); }).sort((p, q) => q.scrollHeight - p.scrollHeight)[0]; (c || document.scrollingElement).scrollTo(0, 0); });
    await Promise.all(pending);
    const m = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint'); return { ...window.__m, fcp: fcp?.startTime, domContentLoaded: nav?.domContentLoadedEventEnd, loadEvt: nav?.loadEventEnd }; });
    const tbt = m.longTasks.reduce((s, [, d]) => s + Math.max(0, d - 50), 0);
    const byHost = {}; let tot = 0, totGz = 0;
    for (const q of reqs) { tot += q.bytes || 0; totGz += (q.gzipEst ?? q.bytes) || 0; byHost[q.host] = (byHost[q.host] || 0) + (q.bytes || 0); }
    const ext = {}; reqs.filter(q => !q.url.startsWith('/')).forEach(q => { ext[q.host] = (ext[q.host] || 0) + 1; });
    const heavy = reqs.filter(q => (q.bytes || 0) > 150000).sort((p, q) => q.bytes - p.bytes).slice(0, 15).map(q => ({ url: q.url.slice(0, 110), kb: Math.round(q.bytes / 1024), gzKb: q.gzipEst ? Math.round(q.gzipEst / 1024) : null, atMs: q.t }));
    const threeD = reqs.filter(q => /\.(glb|gltf|wasm|task|usdz|fbx|hdr|exr|drc|ktx2)(\?|$)|webgi|three|mediapipe|draco/i.test(q.url)).map(q => ({ url: q.url.slice(0, 100), kb: Math.round((q.bytes || 0) / 1024), atMs: q.t }));
    res[key] = { route: r || '(root)', viewport: vp, timing: { domMs: tDom, splashFirstSeenMs: tSplashFirst, splashGoneMs: tSplashGone, loadMs: tLoad, h1VisibleMs: tH1, fcp: Math.round(m.fcp || 0), lcp: Math.round(m.lcp || 0), tbtMs: tbt, longTasks: m.longTasks.length, cls: +m.cls.toFixed(3) },
      overlayAtFirstView: folded0, layout: a, scroll: { stepPx: step, stepsToPrimary: reachedAt, steps: seq.length }, load: { requests: reqs.length, totalKB: Math.round(tot / 1024), gzipEstKB: Math.round(totGz / 1024), externalHosts: ext, heavy, threeD, threeDKB: Math.round(threeD.reduce((s, q) => s + q.kb, 0)) } };
    fs.writeFileSync(`${OUT}/${key}.json`, JSON.stringify(res[key], null, 2));
    console.log('done', key, 'screens', a.screens, 'secs', a.sections, 'words', a.wordsAboveFold, 'kb', Math.round(tot / 1024));
    await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(`${OUT}/all.json`, JSON.stringify(res, null, 2));
console.log('ALL DONE');
