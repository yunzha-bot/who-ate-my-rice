// Layout equivalent only: inverse CSS viewport + DPR, not actual browser toolbar zoom.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = resolve(process.env.MENU_ZOOM_ARTIFACT_DIR ?? 'docs/verification/menu-native-zoom-2026-10-23');
await mkdir(out, { recursive: true });
const rows = [], errors = [], flows = [];
const reference = process.env.MENU_ZOOM_BASELINE_FILE
  ? JSON.parse(await readFile(process.env.MENU_ZOOM_BASELINE_FILE, 'utf8')).layouts.find(r => r.width === 1920 && r.height === 1080) : null;
for (const channel of (process.env.MENU_ZOOM_CHANNELS ?? 'chrome,msedge').split(',')) {
  const browser = await chromium.launch({ channel, headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(`${channel}: ${e}`));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${channel}: ${r.status()} ${r.url()}`); });
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(), source = await response.text();
      assert(source.includes('const game = new ThreeGame('));
      await route.fulfill({ response, body: source.replace('const game = new ThreeGame(', 'const game = window.__zoomGame = new ThreeGame(') });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('.startup-view').waitFor({ state: 'detached', timeout: 90000 });
    const cdp = await page.context().newCDPSession(page);
    let baseline;
    for (const zoom of [1, 1.25, 1.5, 2, 3, .5, .25]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: Math.round(1920 / zoom), height: Math.round(1080 / zoom), deviceScaleFactor: zoom, mobile: false,
      });
      await page.evaluate(async () => {
        document.querySelector('.faction-menu').scrollTop = 0;
        document.activeElement?.blur(); await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('.faction-menu img')].map(i => i.decode()));
      });
      await page.waitForTimeout(100);
      const metrics = await page.evaluate(() => {
        const rect = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const menu = document.querySelector('.faction-menu');
        return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, overflow: menu.scrollWidth > menu.clientWidth,
          logo: rect(document.querySelector('.menu-logo')), settings: rect(document.querySelector('.menu-settings')),
          settingsFont: parseFloat(getComputedStyle(document.querySelector('.menu-setting-button')).fontSize),
          removedStart: !document.querySelector('.menu-start'),
          cards: [...document.querySelectorAll('.faction-card')].map(card => ({ box: rect(card),
            portrait: rect(card.querySelector('.faction-portrait')), fit: getComputedStyle(card.querySelector('img')).objectFit,
            labels: [...card.querySelectorAll('.faction-copy strong,.faction-copy small,.faction-description b')].map(n => ({
              text: n.textContent, font: parseFloat(getComputedStyle(n).fontSize), box: rect(n),
              client: n.clientWidth, scroll: n.scrollWidth,
              paperRight: parseFloat(getComputedStyle(n, '::before').right) || 0,
            })) })),
          rendererRatio: window.__zoomGame.renderer.getPixelRatio(),
          camera: [window.__zoomGame.camera.left, window.__zoomGame.camera.right, window.__zoomGame.camera.top, window.__zoomGame.camera.bottom] };
      });
      baseline ??= metrics;
      assert(!metrics.overflow && metrics.removedStart);
      assert.equal(metrics.rendererRatio, Math.min(zoom, 2));
      assert.deepEqual(metrics.camera, baseline.camera, 'UI reflow must not change the scene frustum');
      assert(Math.abs(metrics.settingsFont - baseline.settingsFont) < .05, 'CSS font must not shrink to cancel zoom');
      for (let i = 0; i < 2; i++) {
        const card = metrics.cards[i], ref = baseline.cards[i];
        const expectedScale = Math.min(1, (metrics.viewport[0] - 48) / baseline.cards[0].box.w);
        assert(Math.abs(card.box.w / ref.box.w - expectedScale) < .005, 'card only shrinks when one full card no longer fits');
        assert(Math.abs((card.box.w / card.box.h) / (ref.box.w / ref.box.h) - 1) < .005, 'card aspect ratio');
        assert(Math.abs((card.portrait.w / card.portrait.h) / (ref.portrait.w / ref.portrait.h) - 1) < .005, 'portrait aspect ratio');
        assert.equal(card.fit, 'contain');
        for (let j = 0; j < card.labels.length; j++) {
          const label = card.labels[j], original = ref.labels[j];
          assert(label.scroll <= label.client + Math.max(0, -label.paperRight) + 3, `label overflow: ${label.text}`);
          assert(Math.abs(label.font * zoom / original.font - zoom * expectedScale) < .03, 'physical text must respond to browser zoom');
        }
      }
      assert.equal(metrics.cards[1].box.y > metrics.cards[0].box.y + metrics.cards[0].box.h, metrics.viewport[0] < 1280, 'column breakpoint');
      if (zoom === 1 && reference) {
        const compare = (box, old) => { for (const [key, previous] of [['x', 'x'], ['y', 'y'], ['w', 'width'], ['h', 'height']])
          assert(Math.abs(box[key] - old[previous]) < 1, `1920 baseline changed: ${key}`); };
        compare(metrics.logo, reference.logo); compare(metrics.settings, reference.settings);
        metrics.cards.forEach((card, i) => { compare(card.box, reference.cards[i]); compare(card.portrait, reference.portraits[i]); });
      }
      const capture = async name => {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
        await writeFile(resolve(out, `${channel}-${Math.round(zoom * 100)}-${name}.png`), Buffer.from(data, 'base64'));
      };
      await capture('menu');
      await page.locator('[data-menu-panel="audio"]').click();
      await page.locator('.menu-audio-slot input[type="range"]').first().fill('37');
      assert.equal(await page.evaluate(() => window.__zoomGame.audio.settings.master), .37);
      await page.keyboard.press('Escape');
      await page.locator('[data-menu-panel="difficulty"]').click();
      await page.locator('input[name="difficulty"][value="HARD"]').check();
      assert.equal(await page.evaluate(() => window.__zoomGame.difficultyView.value), 'HARD');
      await page.keyboard.press('Escape');
      await page.locator('.menu-credits-open').click(); assert(await page.locator('.menu-credits-dialog').isVisible());
      await page.keyboard.press('Escape');
      for (const faction of ['DEEPSEEK', 'HUMAN']) {
        const card = page.locator(`.faction-card[data-faction="${faction}"]`);
        await card.scrollIntoViewIfNeeded();
        if (faction === 'HUMAN' && zoom >= 2) await capture('scrolled-human');
        if (faction === 'HUMAN' && zoom === 1) { await card.focus(); await page.keyboard.press('Enter'); }
        else await card.click();
        assert.equal(await page.evaluate(() => window.__zoomGame.match.phase), 'READY');
        assert.equal(await page.evaluate(() => window.__zoomGame.control.selectedFaction), faction);
        const teaching = await page.locator('.controls-help').isVisible();
        if (teaching) await page.locator('.controls-help-close').click();
        await page.waitForFunction(() => window.__zoomGame.match.phase === 'PLAYING', null, { timeout: 30000 });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
        assert(await page.locator('.faction-menu').isVisible());
        assert.equal(await page.locator('.faction-card[aria-pressed="true"]').count(), 0);
        flows.push({ channel, zoom, faction, teaching, ready: true, playing: true, returned: true });
      }
      rows.push({ channel, zoom, ...metrics });
      console.log(`${channel} ${zoom * 100}%: geometry/settings/both factions passed`);
    }
  } finally { await browser.close(); }
}
await writeFile(resolve(out, 'results.json'), JSON.stringify({ method: 'CSS viewport + DPR equivalent; not browser toolbar zoom', rows, flows, errors }, null, 2));
assert.deepEqual(errors, []);
console.log(JSON.stringify({ cases: rows.length, flows: flows.length, errors }));
