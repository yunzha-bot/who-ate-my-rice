import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { productionAssetFilter, PRODUCTION_EXCLUDED_ASSETS } from '../scripts/production-assets.mjs';

for (const output of ['dist', 'dist-tencent']) test(`${output}: filter removes only six exact private built copies and leaves originals/v6/future files`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'rice-production-assets-'));
  const preserved = ['assets/characters/deepseek/deepseek_animated_v6_hair.glb',
    'assets/characters/deepseek/deepseek_animated_v7.glb', 'assets/audio/menu.ogg'];
  assert.deepEqual(PRODUCTION_EXCLUDED_ASSETS.map(file => file.split('/').at(-1)),
    [...[1, 2, 3, 4].map(version => `deepseek_animated_v${version}.glb`),
      'deepseek_animated_v5_hair_ready.glb', 'deepseek_midpoly_18500_standalone.glb']);
  for (const directory of ['public', output]) for (const file of [...PRODUCTION_EXCLUDED_ASSETS, ...preserved]) {
    const target = join(root, directory, file);
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, file);
  }
  const plugin = productionAssetFilter();
  assert.equal(plugin.apply, 'build');
  plugin.configResolved({ root, build: { outDir: output } }); await plugin.writeBundle();
  for (const file of PRODUCTION_EXCLUDED_ASSETS) {
    await assert.rejects(readFile(join(root, output, file)), { code: 'ENOENT' });
    assert.equal(await readFile(join(root, 'public', file), 'utf8'), file);
  }
  for (const file of preserved) assert.equal(await readFile(join(root, output, file), 'utf8'), file);
  await plugin.writeBundle(); // Missing historical models in a fresh public checkout are valid.
});

test('filter refuses output directories outside the exact project build allowlist', () => {
  for (const outDir of ['public', 'src', '../other-project', '/', 'nested/dist-tencent', 'dist-tencent/../public']) {
    assert.throws(() => productionAssetFilter().configResolved({ root: process.cwd(), build: { outDir } }),
      /only supports the project dist/);
  }
});

test('a build with no character directory requires no deletion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rice-production-assets-empty-'));
  const plugin = productionAssetFilter(); plugin.configResolved({ root, build: { outDir: 'dist' } });
  await plugin.writeBundle();
});

for (const outputName of ['dist', 'dist-tencent']) test(`${outputName}: filter refuses a character output redirected to source`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'rice-production-assets-link-'));
  const source = join(root, 'public/assets/characters/deepseek');
  const output = join(root, outputName, 'assets/characters/deepseek');
  await mkdir(source, { recursive: true }); await mkdir(dirname(output), { recursive: true });
  const original = join(source, 'deepseek_animated_v1.glb'); await writeFile(original, 'original');
  await symlink(source, output, process.platform === 'win32' ? 'junction' : 'dir');
  const plugin = productionAssetFilter(); plugin.configResolved({ root, build: { outDir: outputName } });
  await assert.rejects(plugin.writeBundle(), /redirected character output/);
  assert.equal(await readFile(original, 'utf8'), 'original');
});

for (const output of ['dist', 'dist-tencent']) test(`${output}: filter refuses redirected build root`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'rice-production-assets-dist-link-'));
  const source = join(root, 'public/assets/characters/deepseek');
  await mkdir(source, { recursive: true });
  const original = join(source, 'deepseek_animated_v1.glb'); await writeFile(original, 'original');
  await symlink(join(root, 'public'), join(root, output), process.platform === 'win32' ? 'junction' : 'dir');
  const plugin = productionAssetFilter(); plugin.configResolved({ root, build: { outDir: output } });
  await assert.rejects(plugin.writeBundle(), /redirected output directory/);
  assert.equal(await readFile(original, 'utf8'), 'original');
});
