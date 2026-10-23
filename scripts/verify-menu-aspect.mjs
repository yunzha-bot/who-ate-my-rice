// Actual menu geometry at multiple desktop aspect ratios; no persistent profile or runtime edits.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = resolve(process.env.MENU_ASPECT_ARTIFACT_DIR ?? 'docs/verification/menu-aspect-2026-10-22');
await mkdir(out, { recursive: true });
const rows = [], failures = [], errors = [];
for (const channel of (process.env.MENU_ASPECT_CHANNELS ?? 'chrome,msedge').split(',')) {
  const browser = await chromium.launch({ channel, headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(`${channel}: ${e}`));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${channel}: ${r.status()} ${r.url()}`); });
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('.startup-view').waitFor({ state: 'detached', timeout: 90000 });
    let baseline;
    for (const [width, height] of [[1920,1080],[1768,890],[1266,1195],[1366,768],[1000,1000],[2560,1080],[1280,900],[1279,900],[640,900],[455,768],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const rect = n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; };
        return { viewport:[innerWidth,innerHeight], overflow:document.querySelector('.faction-menu').scrollWidth > innerWidth,
          unit:getComputedStyle(document.querySelector('.faction-menu')).getPropertyValue('--menu-vw'),
          logo:rect(document.querySelector('.menu-logo')),
          settings:rect(document.querySelector('.menu-settings')),
          dock:rect(document.querySelector('.faction-dock')),
          cards:[...document.querySelectorAll('.faction-card')].map(card => ({ box:rect(card),
            font:parseFloat(getComputedStyle(card.querySelector('strong')).fontSize),
            portrait:rect(card.querySelector('.faction-portrait')),
            fit:getComputedStyle(card.querySelector('.faction-portrait')).objectFit })),
          copy:[...document.querySelectorAll('.faction-copy small,.faction-description b')].map(n=>n.textContent) };
      });
      baseline ??= metrics;
      for (let i=0;i<2;i++) {
        const card=metrics.cards[i], ref=baseline.cards[i];
        if (Math.abs((card.box.w/card.box.h)/(ref.box.w/ref.box.h)-1)>.01) failures.push(`${channel}/${width}x${height}: card ${i} aspect distortion`);
        if (Math.abs((card.portrait.w/card.portrait.h)/(ref.portrait.w/ref.portrait.h)-1)>.01) failures.push(`${channel}/${width}x${height}: portrait box ${i} aspect distortion`);
        assert.equal(card.fit,'contain');
      }
      if (metrics.overflow) failures.push(`${channel}/${width}x${height}: horizontal overflow`);
      assert(Math.abs(metrics.dock.x + metrics.dock.w / 2 - width / 2) < 1,
        `${channel}/${width}x${height}: faction group must be horizontally centered`);
      assert(metrics.copy.includes('人类方') && metrics.copy.includes('我的大米！'));
      rows.push({ channel, ...metrics });
      await page.screenshot({ path:resolve(out,`${channel}-${width}x${height}-${rows.length}.png`) });
      // Exercise popovers and live selection in the same geometry, not just file existence.
      await page.locator('[data-menu-panel="difficulty"]').click();
      await page.locator('input[name="difficulty"][value="HARD"]').check();
      await page.keyboard.press('Escape');
      await page.locator('[data-menu-panel="audio"]').click();
      await page.locator('.menu-audio-slot input[type="range"]').first().fill('37');
      await page.keyboard.press('Escape');
      for (const faction of ['HUMAN','DEEPSEEK']) {
        await page.locator(`.faction-card[data-faction="${faction}"]`).click();
        assert.equal(await page.locator(`.faction-card[data-faction="${faction}"]`).getAttribute('aria-pressed'),'true');
        assert(await page.locator('.faction-menu').isHidden(),'faction card should immediately start the selected side');
        await page.reload();
        await page.locator('.startup-view').waitFor({ state: 'detached', timeout: 90000 });
      }
      await page.evaluate(() => { document.activeElement?.blur(); });
    }
  } finally { await browser.close(); }
}
await writeFile(resolve(out,'results.json'),JSON.stringify({rows,failures,errors},null,2));
console.log(JSON.stringify({cases:rows.length,failures,errors},null,2));
assert.equal(failures.length,0,'opening artwork must keep its reference proportions at every desktop aspect ratio');
assert.deepEqual(errors,[]);
