// Real local browser screenshots plus isolated observation of the unchanged match entry.
// Reuse the running project Vite server. No saved profile, project writes or production globals.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = resolve(process.env.OPENING_ARTIFACT_DIR ?? 'docs/verification/opening-static');
await mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:5173';
const channel = process.env.OPENING_CHANNEL ?? 'chrome', prefix = channel === 'chrome' ? '' : `${channel}-`;
const browser = await chromium.launch({ channel, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = { layouts: [], interactions: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => results.errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) results.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(origin);
  await page.locator('.startup-view').waitFor({ state: 'detached', timeout: 90000 });
  // Label skins are CSS images, so explicitly await their real decoding before screenshots.
  await page.evaluate(async () => Promise.all([...document.querySelectorAll('.faction-copy strong,.faction-copy small,.faction-description b')].map(async node => {
    const url = getComputedStyle(node, '::before').backgroundImage.match(/url\(["']?([^"')]+)/)?.[1];
    if (!url) throw new Error('Label backing missing');
    const image = new Image(); image.src = url; await image.decode();
  })));
  for (const [width, height] of [[1920,1080], [1768,890], [1600,900], [1366,768], [960,450], [390,844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/${prefix}static-${width}x${height}.png` });
    const layout = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height }; };
      return { width:innerWidth, height:innerHeight, overflowX:document.querySelector('.faction-menu').scrollWidth > innerWidth,
        logo:rect('.menu-logo'), cards:[rect('.faction-card[data-faction="DEEPSEEK"]'),rect('.faction-card[data-faction="HUMAN"]')],
        start:document.querySelector('.menu-start') ? rect('.menu-start') : null, settings:rect('.menu-settings'),
        portraits:[...document.querySelectorAll('.faction-portrait')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}),
        footer:rect('.menu-credits'),
        images:[...document.querySelectorAll('.faction-menu img')].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,fit:getComputedStyle(i).objectFit})) };
    });
    assert.equal(layout.overflowX, false, JSON.stringify(layout));
    assert(layout.images.every(i=>i.loaded));
    assert(layout.images.filter(i=>i.src.includes('portraits')).every(i=>i.fit==='contain'));
    if (width >= 1366) {
      assert(layout.logo.y + layout.logo.height < layout.cards[0].y + 50, 'logo must not cover character cards');
    }
    results.layouts.push(layout);
  }
  await page.setViewportSize({width:1920,height:1080});
  // Use the real Vite-transformed main, adding an observation handle in this test page only.
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert(source.includes('const game = new ThreeGame('));
    await route.fulfill({ response, body: source.replace('const game = new ThreeGame(', 'const game = window.__openingGame = new ThreeGame(') });
  });
  await page.reload();
  await page.locator('.startup-view').waitFor({state:'detached',timeout:90000});
  const phase = () => page.evaluate(() => window.__openingGame.match.phase);
  assert.equal(await page.locator('.menu-start').count(),0,'separate start button must stay removed');
  assert.equal(await phase(),'FACTION_SELECT');
  await page.locator('[data-menu-panel="audio"]').click();
  assert(await page.locator('.menu-audio-slot').isVisible());
  assert.equal(await page.locator('.menu-audio-slot input[type="range"]').count(),5);
  await page.locator('.menu-audio-slot input[type="range"]').first().fill('37');
  assert.equal(await page.evaluate(()=>window.__openingGame.audio.settings.master),.37);
  await page.getByLabel('总静音',{exact:true}).check();
  assert.equal(await page.evaluate(()=>window.__openingGame.audio.settings.muted),true);
  await page.locator('[data-menu-panel="difficulty"]').click();
  assert(await page.locator('.menu-audio-slot').isHidden());
  for(const id of ['NORMAL','HARD','EASY']) {
    if(await page.locator('.menu-difficulty-slot').isHidden()) await page.locator('[data-menu-panel="difficulty"]').click();
    await page.locator(`input[name="difficulty"][value="${id}"]`).check();
    assert.equal(await page.evaluate(()=>window.__openingGame.difficultyView.value),id);
  }
  await page.locator('[data-menu-panel="audio"]').click(); await page.keyboard.press('Escape');
  assert(await page.locator('.menu-audio-slot').isHidden());
  assert(await page.locator('[data-menu-panel="audio"]').evaluate(n=>document.activeElement===n));
  await page.locator('.menu-credits-open').click(); assert(await page.locator('.menu-credits-dialog').isVisible());
  await page.keyboard.press('Escape'); assert(await page.locator('.menu-credits-dialog').isHidden());
  results.interactions.push('five real volume buses / mute / three difficulties / mutually exclusive panels / Escape focus / credits');
  for(const faction of ['DEEPSEEK','HUMAN']) {
    const card = page.locator(`.faction-card[data-faction="${faction}"]`);
    if(faction==='DEEPSEEK') {
      // A fresh authority is unready; the normal StartupView has already permanently admitted its own authority.
      await page.evaluate(async()=>{const {StartupReadiness}=await import('/src/three/StartupReadiness.ts');
        window.__savedOpeningGate=window.__openingGame.startupReadiness;
        window.__openingGame.startupReadiness=new StartupReadiness();});
      await card.click(); assert.equal(await phase(),'FACTION_SELECT','loading gate must reject early faction activation');
      await page.evaluate(()=>{window.__openingGame.startupReadiness=window.__savedOpeningGate;delete window.__savedOpeningGate;});
    }
    await card.click();
    assert.equal(await phase(),'READY');
    assert(await page.locator('.faction-menu').isHidden());
    assert.equal(await page.evaluate(()=>window.__openingGame.control.controlledFaction),faction);
    if(faction==='DEEPSEEK') {
      assert(await page.locator('.controls-help').isVisible(),'first-round teaching retained');
      await page.locator('.controls-help-close').click();
    }
    await page.waitForFunction(()=>window.__openingGame.match.phase==='PLAYING');
    assert.equal(await page.locator('.game-canvas').evaluate(n=>getComputedStyle(n).filter),'none');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.__openingGame.match.phase==='PAUSED');
    await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
    assert.equal(await phase(),'FACTION_SELECT');
    assert.equal(await page.locator('.menu-start').count(),0);
    assert.equal(await page.locator('.faction-card[aria-pressed="true"]').count(),0);
    results.interactions.push(`${faction}: card click starts directly / teaching where applicable / PLAYING / pause / reset menu`);
  }
  assert.deepEqual(results.errors,[]);
  await writeFile(`${out}/${prefix}browser-results.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }
