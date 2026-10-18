import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { loadConfigFromFile } from 'vite';
import { verifyPagesBuild } from '../scripts/verify-pages-build.mjs';

const base = '/who-ate-my-rice/';
let serial = 0;
async function moduleAt(file, prefix) {
  const url = new URL(`../src/three/${file}`, import.meta.url);
  let source = readFileSync(url, 'utf8')
    .replaceAll('import.meta.env.BASE_URL', JSON.stringify(prefix))
    .replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('typeof import.meta.env', "'object'");
  source = source.replace(/from '([^']+)'/g, (_, specifier) =>
    `from '${specifier.startsWith('.') ? new URL(specifier, url).href : import.meta.resolve(specifier)}'`);
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}#pages-${serial++}`);
}

test('Pages build selects repository base only with the explicit build flag; DEV stays rooted', async () => {
  const saved = process.env.PAGES_DEPLOYMENT;
  try {
    for (const [flag, command, expected] of [[undefined, 'build', '/'], ['true', 'build', base], ['true', 'serve', '/'], ['false', 'build', '/']]) {
      if (flag === undefined) delete process.env.PAGES_DEPLOYMENT;
      else process.env.PAGES_DEPLOYMENT = flag;
      const loaded = await loadConfigFromFile({ command, mode: command === 'build' ? 'production' : 'development' });
      assert.equal(loaded.config.base ?? '/', expected, `${command}/${flag}`);
      assert.deepEqual(loaded.config.server, { host: '127.0.0.1', port: 5173, strictPort: true });
      assert.deepEqual(loaded.config.plugins.map(p => p.name), ['scene-layout-save', 'throwable-layout-save', 'room-light-layout-save', 'production-asset-filter']);
      assert.equal(loaded.config.plugins.find(p=>p.name==='room-light-layout-save').apply,'serve',
        'light position writes must remain unavailable in production builds');
    }
  } finally {
    if (saved === undefined) delete process.env.PAGES_DEPLOYMENT;
    else process.env.PAGES_DEPLOYMENT = saved;
  }
});

test('actual model modules expose base-aware public URLs for root and project hosting', async () => {
  for (const prefix of ['/', base]) {
    const deepseek = await moduleAt('DeepSeekGlbModel.ts', prefix);
    const rice = await moduleAt('RiceBagModel.ts', prefix);
    assert.equal(deepseek.DEEPSEEK_ANIMATED_GLB_URL, `${prefix}assets/characters/deepseek/deepseek_animated_v6_hair.glb`);
    assert.equal(deepseek.DEEPSEEK_GLB_URL, `${prefix}assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb`);
    assert.equal(rice.RICE_BAG_MODEL_URL, `${prefix}assets/props/rice-bag/rice-bag.glb`);
  }
});

test('menu and result markup use project-base portraits without changing faction controls', async () => {
  const ui = await moduleAt('GameUiLayout.ts', base);
  const menu = { innerHTML: '', querySelectorAll: () => [] };
  ui.populateFactionMenu(menu, () => {});
  for (const url of Object.values(ui.UI_PORTRAITS)) assert(url.startsWith(`${base}assets/ui/portraits/`), url);
  for (const url of [ui.UI_PORTRAITS.DEEPSEEK, ui.UI_PORTRAITS.HUMAN]) {
    assert(menu.innerHTML.includes(url)); assert(ui.REPORT_MARKUP.includes(url));
  }
  assert.equal(ui.deepseekResultPortrait('DEEPSEEK'), ui.UI_PORTRAITS.DEEPSEEK_WIN);
  assert.equal(ui.deepseekResultPortrait('HUMAN'), ui.UI_PORTRAITS.DEEPSEEK_LOSE);
  assert.equal((menu.innerHTML.match(/class="faction-card"/g) ?? []).length, 2);
});

test('existing audio loaders already respect the same build base', () => {
  for (const file of ['GameAudio.ts', 'StartupView.ts'])
    assert.match(readFileSync(new URL(`../src/three/${file}`, import.meta.url), 'utf8'), /import\.meta\.env\.BASE_URL}assets\/audio\//);
});

function artifact() {
  const root = mkdtempSync(join(tmpdir(), 'rice-pages-audit-'));
  const publicFiles = ['assets/characters/deepseek/deepseek_animated_v6_hair.glb', 'assets/props/rice-bag/rice-bag.glb'];
  const put = (file, content) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), content); };
  for (const file of publicFiles) { put(`public/${file}`, file); put(`dist/${file}`, file); }
  put('dist/index.html', `<script src="${base}assets/index-test.js"></script><link href="${base}assets/index-test.css">`);
  put('dist/assets/index-test.js', `const model = '${base}${publicFiles[0]}';`);
  put('dist/assets/index-test.css', 'body { color: black }');
  return { root, publicFiles, put };
}

test('upload audit accepts only unchanged approved public files and exact app entries', () => {
  const { root, publicFiles, put } = artifact(), result = verifyPagesBuild(root, publicFiles);
  assert.equal(result.base, base); assert.equal(result.count, 5);
  assert(result.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  put('dist/assets/index-test.js', `const prefix = '${base}'; const model = \`\${prefix}${publicFiles[0]}\`;`);
  assert.equal(verifyPagesBuild(root, publicFiles).count, 5);
});

test('upload audit rejects private/unknown files, changed assets and missing public files', () => {
  for (const [file, content, error] of [
    ['dist/private.bak', 'backup', /Private\/development artifact/],
    ['dist/extra.json', '{}', /Unapproved artifact/],
    ['dist/assets/props/rice-bag/rice-bag.glb', 'changed', /Changed public asset/],
  ]) {
    const { root, publicFiles, put } = artifact(); put(file, content);
    assert.throws(() => verifyPagesBuild(root, publicFiles), error);
  }
  const { root, publicFiles, put } = artifact(); put('public/missing.png', 'required');
  assert.throws(() => verifyPagesBuild(root, [...publicFiles, 'missing.png']), /Missing artifact/);
});

test('upload audit rejects linked artifacts before packaging can dereference them', () => {
  const { root, publicFiles } = artifact();
  symlinkSync(join(root, 'public'), join(root, 'dist/link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => verifyPagesBuild(root, publicFiles), /Linked artifact/);
});

test('upload audit rejects wrong base and resurrected development or old-model references', () => {
  for (const forbidden of ['KeyZ', 'KeyC', 'KeyX', '/__dev/scene-layout', 'deepseek_animated_v5_hair_ready.glb']) {
    const { root, publicFiles, put } = artifact();
    put('dist/assets/index-test.js', `const model = '${base}${publicFiles[0]}'; const forbidden = '${forbidden}';`);
    assert.throws(() => verifyPagesBuild(root, publicFiles), /Development\/private reference/);
  }
  const { root, publicFiles, put } = artifact();
  put('dist/index.html', '<script src="/assets/index-test.js"></script><link href="/assets/index-test.css">');
  assert.throws(() => verifyPagesBuild(root, publicFiles), /Wrong Pages entry URL/);
});

test('Pages workflow is manual, main-only, production-only and uploads audited dist with pinned actions', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|pull_request_target|release|schedule):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.confirm_production == true/);
  assert.match(workflow, /github\.sha == inputs\.approved_sha/);
  assert.match(workflow, /ref: \$\{\{ github\.sha }}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /npm ci --include=dev/);
  assert.match(workflow, /NODE_ENV: production/);
  assert.match(workflow, /PAGES_DEPLOYMENT: 'true'/);
  assert.match(workflow, /node scripts\/verify-pages-build\.mjs/);
  assert.match(workflow, /path: \.\/dist\n/);
  assert.match(workflow, /enablement: false/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /pages: write/); assert.match(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /contents: write|npm run dev|--mode development|secrets\./);
  const actions = [...workflow.matchAll(/uses: (actions\/[\w-]+)@([^\s]+)/g)];
  assert.equal(actions.length, 5);
  for (const action of actions) assert.match(action[2], /^[a-f0-9]{40}$/);
});
