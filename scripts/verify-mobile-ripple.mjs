// Exercise the real HUD and styles at fixed animation times in touch browsers.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = 'http://127.0.0.1:5173';
const out = resolve(process.env.MOBILE_ARTIFACT_DIR ?? 'docs/verification/mobile-ripple-soft-2026-10-22');
await mkdir(out, { recursive: true });
const results = [];
for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    await page.route(origin + '/__ripple_check__', route => route.fulfill({ contentType: 'text/html', body: `
      <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{background:#455769}</style><div id="app"></div><script type="module">
      import '/src/style.css'; import '/src/industrial-ui.css'; import '/src/sheet-ui.css';
      import '/src/s13-ui.css'; import '/src/game-ui.css'; import '/src/opening-menu.css'; import '/src/mobile-ui.css';
      import {AlphaHudView} from '/src/three/AlphaHudView.ts';
      const hud = new AlphaHudView(document.querySelector('#app'), {
        direction(){}, held(){}, aimStart(){}, aimEnd(){}, aimCancel(){}, pause(){}, cancel(){}
      });
      hud.root.hidden=false;
      const button=hud.root.querySelector('[data-touch-code="KeyE"]');
      button.textContent='交互\\n按住吃米'; button.dataset.interactionState='READY';
      window.hudReady=true;
      </script>` }));
    await page.goto(origin + '/__ripple_check__');
    await page.waitForFunction(() => window.hudReady);
    const button = page.locator('[data-touch-code="KeyE"]');
    const samples = [];
    for (const time of [0, 350, 650, 900]) {
      samples.push(await button.evaluate((node, time) => {
        const animation=node.getAnimations({subtree:true}).find(a=>a.animationName==='mobile-interaction-ripple');
        if(!animation) throw Error('missing interaction animation');
        animation.pause(); animation.currentTime=time;
        const style=getComputedStyle(node,'::after'), rect=node.getBoundingClientRect();
        const matrix=new DOMMatrixReadOnly(style.transform);
        const width=parseFloat(style.width),height=parseFloat(style.height);
        return {time, transform:style.transform, sx:matrix.a, sy:matrix.d,
          outerWidth:width*matrix.a, outerHeight:height*matrix.d,
          left:parseFloat(style.left), top:parseFloat(style.top), opacity:Number(style.opacity),
          borderWidth:parseFloat(style.borderTopWidth), shadow:style.boxShadow, filter:style.filter,
          width:rect.width, height:rect.height};
      }, time));
      await page.screenshot({path:resolve(out,`${channel}-${time}ms.png`)});
      if (time === 650) {
        const box=await button.boundingBox();
        await page.screenshot({path:resolve(out,`${channel}-650ms-detail.png`),
          clip:{x:box.x-14,y:box.y-14,width:box.width+28,height:box.height+28}});
      }
    }
    console.log(channel, JSON.stringify(samples));
    const first=samples[0], middle=samples[1], last=samples[2];
    assert(middle.outerWidth>first.outerWidth && middle.outerHeight>first.outerHeight, 'white outline must expand outward at 350ms');
    assert(last.outerWidth>middle.outerWidth && last.outerHeight>middle.outerHeight, 'outline must keep expanding at 650ms');
    assert(middle.opacity>.25, 'expanded outline must still be visible');
    assert(last.opacity>.25, 'outward travel must remain visible at 650ms, not just flash at the edge');
    assert(middle.opacity>first.opacity,'soft ripple must gradually appear rather than flash on');
    assert.equal(middle.borderWidth,0,'avoid browser rounding fractional borders up to 1px');
    assert(middle.shadow.endsWith('0.65px'),'outline must use a subpixel thin stroke');
    assert(parseFloat(middle.filter.slice(5))>=.3 && parseFloat(middle.filter.slice(5))<.65,
      'outline must have a narrow soft edge');
    const end=samples[3];
    assert(Math.abs(end.outerWidth-first.outerWidth-10)<.1 &&
      Math.abs(end.outerHeight-first.outerHeight-10)<.1, 'spread must stop at 5px per side');
    assert.equal(end.opacity,0,'outline must fade before the next cycle');
    await button.evaluate(node=>node.dataset.interactionState='NONE');
    assert.equal(await button.evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    await page.emulateMedia({reducedMotion:'reduce'});
    await button.evaluate(node=>node.dataset.interactionState='READY');
    assert.equal(await button.evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    results.push({channel,samples,removedWhenUnavailable:true,reducedMotion:true});
  } finally { await browser.close(); }
}
await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));
