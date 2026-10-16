import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';

const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const tools = ['DebugDetailsPanel', 'SceneEditor', 'DevBDebug', 'DevBParamPersistence',
  'AISafetyPathView', 'AILogCollector', 'DevBRuntimeBinding'];

test('production constant-folds every development-only tool constructor away', async () => {
  const { code } = await transformWithEsbuild(source, 'ThreeGame.ts', {
    target: 'es2022', define: { 'import.meta.env.DEV': 'false' }, minifySyntax: true,
  });
  for (const name of tools) assert.doesNotMatch(code, new RegExp(`new ${name}\\(`), name);
});

test('development retains all tool constructors and the original persistence path', async () => {
  const { code } = await transformWithEsbuild(source, 'ThreeGame.ts', {
    target: 'es2022', define: { 'import.meta.env.DEV': 'true' }, minifySyntax: true,
  });
  for (const name of tools) assert.match(code, new RegExp(`new ${name}\\(`), name);
  assert.match(code, /this\.devBPersistence\.read\(\)/);
});

test('camera turn and restore shortcuts exist only in development builds', async () => {
  for (const development of [false, true]) {
    const { code } = await transformWithEsbuild(source, 'ThreeGame.ts', {
      target: 'es2022', define: { 'import.meta.env.DEV': String(development) }, minifySyntax: true,
    });
    for (const key of ['KeyZ', 'KeyC', 'KeyX'])
      assert.equal(code.includes(key), development, `${key}: DEV=${development}`);
    for (const call of ['this.cameraOrbit.turn(1)', 'this.cameraOrbit.turn(-1)', 'this.cameraOrbit.restore()'])
      assert.equal(code.includes(call), development, `${call}: DEV=${development}`);
    assert.ok(code.includes('this.cameraOrbit.update(deltaMs)'), 'normal camera timing remains');
    assert.ok(code.includes('this.followCamera()'), 'player camera follow remains');
  }
});

test('production disables map labels, door labels and editor-only anchor generation', async () => {
  const { code } = await transformWithEsbuild(source, 'ThreeGame.ts', {
    target: 'es2022', define: { 'import.meta.env.DEV': 'false' }, minifySyntax: true,
  });
  // esbuild minifies the boolean literal false to !1.
  assert.equal([...code.matchAll(/debug: !1,\s*editorTools: !1/g)].length, 2);
  assert.match(code, /new DoorView\(door, index, !1\)/);
  const mapSource = readFileSync(new URL('../src/three/map/MapBuilder.ts', import.meta.url), 'utf8');
  const indicatorEnd = mapSource.indexOf('hideSpotIndicatorRoot.add(indicator);');
  const guard = mapSource.indexOf('if (options.editorTools === false) continue;');
  const anchorStart = mapSource.indexOf("group.name = `anchor-${spot.id}`");
  assert.ok(indicatorEnd >= 0 && indicatorEnd < guard && guard < anchorStart,
    'retain gameplay indicators while skipping editor geometry');
});

test('production drains diagnostic event queues even without a log collector', () => {
  assert.match(source, /const hideEvents = this\.hide\.drainEvents\(\), aiHideEvents = this\.deepseekAI\.drainHideEvents\(\)/);
  assert.match(source, /const searchEvents = this\.humanAI\.drainHumanSearchEvents\(\)/);
  assert.match(source, /const doorEscapeEvents = this\.deepseekAI\.drainDoorEscapeEvents\(\)/);
  assert.match(source, /const doorLockEvents = this\.deepseekAI\.drainDoorLockEvents\(\)/);
  assert.match(source, /this\.aiLogCollector\?\.diffSnapshot\(/);
  assert.match(readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8'), /name: 'scene-layout-save', apply: 'serve'/);
});
