import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { HardNightView } from '../src/three/HardNightView.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { VisionSystem, PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { InteriorShadowView } from '../src/three/InteriorShadowView.ts';
import { ThrowableSystem } from '../src/systems/ThrowableSystem.ts';
import { ThrowableView } from '../src/three/ThrowableView.ts';
import { CaptureNetSystem } from '../src/systems/CaptureNetSystem.ts';
import { CaptureNetView } from '../src/three/CaptureNetView.ts';
import { HideSearchView } from '../src/three/HideSearchView.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';

const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const method = name => source.match(new RegExp(`  private ${name}\\([\\s\\S]*?\\n  }\\r?\\n`))[0];
const getter = source.match(/  private get nightActive\([\s\S]*?\n  }\r?\n/)[0];
const opponentGetter = source.match(/  private get opponentVisible\([\s\S]*?\n  }\r?\n/)?.[0] ?? '';
const renderedGetter = source.match(/  private get opponentRendered\([\s\S]*?\n  }\r?\n/)?.[0] ?? '';
const Harness = runInNewContext(stripTypeScriptTypes(`class Harness {
  ${getter} ${opponentGetter} ${renderedGetter} ${method('syncNightPresentation')} ${method('throwActors')}
}; Harness`, { mode: 'transform' }), { C });

function fixture(difficulty, observer) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xfaf7ef);
  const ambient = new THREE.HemisphereLight(0xfff5e4, 0x9c9988, 2);
  const moon = new THREE.DirectionalLight(0xffefd8, 2.4);
  const player = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const human = player.clone(); player.position.set(0, .7, 0); human.position.set(1, .7, 0);
  const glb = new THREE.Group(); player.add(glb); human.add(new THREE.Group());
  scene.add(player, human, ambient, moon);
  const shadows = new InteriorShadowView(), dpShadow = shadows.add(player), humanShadow = shadows.add(human);
  const game = new Harness(); Object.assign(game, {
    difficulty, control: { selectedFaction: observer }, player, human,
    vision: new VisionSystem({ visionRange: C.difficulty.hardNightVisionRange }),
    perceptionGeometry: new PerceptionGeometry([{ id: 'w', kind: 'wall', x: .5, z: 0, width: .2, depth: 3, height: 2 }], [], () => []),
    hardNightView: new HardNightView(scene, ambient, moon), hideSearchView: new HideSearchView(scene),
    hide: { isConcealed: () => false }, match: { phase: 'PLAYING' }, devFreeze: { isFrozen: false },
    pulseLock: { isOpen: false }, controlsHelp: { visible: false }, captureNet: { mode: 'NONE', rootMs: 0 },
    throwables: { isStunned: () => false }, sprint: { state: 'NORMAL' },
    playerAction: { headingRad: 0 }, humanAction: { headingRad: 0 },
  });
  return { game, scene, ambient, moon, shadows, dpShadow, humanShadow, glb };
}

test('only HARD hides the opposing render root and shadow, for either selected faction', () => {
  for (const level of ['EASY', 'NORMAL', 'HARD']) for (const faction of ['HUMAN', 'DEEPSEEK']) {
    const f = fixture(level, faction), { game } = f;
    const before = [game.player.position.clone(), game.human.position.clone()];
    game.syncNightPresentation(); f.shadows.update();
    const dpVisible = level !== 'HARD' || faction === 'DEEPSEEK';
    const humanVisible = level !== 'HARD' || faction === 'HUMAN';
    assert.equal(game.player.visible, dpVisible); assert.equal(game.human.visible, humanVisible);
    assert.equal(f.dpShadow.visible, dpVisible); assert.equal(f.humanShadow.visible, humanVisible);
    assert.equal(f.glb.parent.visible, dpVisible, 'late GLB remains inside suppressed actor root');
    assert.ok(game.player.position.equals(before[0]) && game.human.position.equals(before[1]));
    for (const actor of game.throwActors()) {
      assert.equal(actor.hidden, false, 'render suppression must not become gameplay concealment');
      assert.equal(actor.canAct, true); assert.equal(actor.renderVisible, actor.faction === faction || level !== 'HARD');
    }
    f.shadows.dispose(); game.hideSearchView.dispose();
  }
});

test('HARD renders opponents up to 5 units, with synchronized range/occlusion/concealment hiding', () => {
  assert.equal(C.difficulty.hardNightRenderRange, 5);
  for (const faction of ['HUMAN', 'DEEPSEEK']) {
    const f = fixture('HARD', faction), { game } = f;
    const empty = new PerceptionGeometry([], [], () => []);
    const target = faction === 'HUMAN' ? game.player : game.human;
    const observer = faction === 'HUMAN' ? game.human : game.player;
    observer.position.set(0, .7, 0); target.position.set(2, .7, 0);
    const step = geometry => {
      game.perceptionGeometry = geometry;
      game.vision.update(0, game.human.position, game.player.position, geometry);
      game.syncNightPresentation(1000); f.shadows.update();
    };
    step(empty);
    assert.equal(target.visible, true, 'near unobstructed opponent must render');
    assert.equal(game.throwActors().find(actor => actor.faction !== faction).renderVisible, true);
    for (const distance of [4, 4.999, 5, 5.001, 10, 50, 5]) {
      target.position.x = distance; step(empty);
      const visible = distance <= 5;
      assert.equal(target.visible, visible, `unobstructed opponent at ${distance} uses the 5-unit limit`);
      assert.equal(game.vision.get(faction).visible, visible, 'both factions must share the 5-unit sight boundary');
      assert.ok(game.vision.get(faction).lastSeen);
      assert.equal(game.throwActors().find(actor => actor.faction !== faction).renderVisible, visible);
      assert.equal((faction === 'HUMAN' ? f.dpShadow : f.humanShadow).visible, visible);
    }
    target.position.x = 2;
    const wall = new PerceptionGeometry([{ id: 'w', kind: 'wall', x: 1, z: 0, width: .2, depth: 3, height: 2 }], [], () => []);
    step(wall); assert.equal(target.visible, false, 'close but wall-occluded is still invisible');
    assert.equal(game.throwActors().find(actor => actor.faction !== faction).renderVisible, false);
    assert.equal((faction === 'HUMAN' ? f.dpShadow : f.humanShadow).visible, false);
    step(empty); assert.equal(target.visible, true, 'reacquisition immediately restores the model');
    assert.equal((faction === 'HUMAN' ? f.dpShadow : f.humanShadow).visible, true);
    const door = { id: 'd', x: 1, z: 0, width: 2, rotation: Math.PI / 2, initialState: 'CLOSED' };
    let doorState = 'CLOSED';
    const doorway = new PerceptionGeometry([], [door], () => [{ id: 'd', state: doorState }]);
    for (const state of ['CLOSED', 'LOCKED', 'OPEN']) {
      doorState = state; step(doorway);
      assert.equal(target.visible, state === 'OPEN', `${state} door controls rendering`);
    }
    if (faction === 'HUMAN') {
      game.hide.isConcealed = () => true; game.vision.setConcealed('DEEPSEEK', true); step(empty);
      assert.equal(target.visible, false, 'real furniture concealment still hides the DP actor');
    }
    f.shadows.dispose(); game.hideSearchView.dispose();
  }
});

test('both factions keep model/held visibility/shadows for 1 second after sight loss, without AI sight', () => {
  assert.equal(C.difficulty.hardNightHideDelayMs, 1000);
  for (const faction of ['HUMAN', 'DEEPSEEK']) {
    const f = fixture('HARD', faction), { game } = f;
    const empty = new PerceptionGeometry([], [], () => []);
    const target = faction === 'HUMAN' ? game.player : game.human;
    const observer = faction === 'HUMAN' ? game.human : game.player;
    observer.position.set(0, .7, 0); target.position.set(2, .7, 0);
    game.perceptionGeometry = empty;
    const step = ms => {
      game.vision.update(ms, game.human.position, game.player.position, game.perceptionGeometry);
      game.syncNightPresentation(ms); f.shadows.update();
    };
    const check = visible => {
      assert.equal(target.visible, visible);
      assert.equal(game.throwActors().find(a => a.faction !== faction).renderVisible, visible);
      assert.equal((faction === 'HUMAN' ? f.dpShadow : f.humanShadow).visible, visible);
    };
    for (const reason of ['RANGE', 'WALL']) {
      game.perceptionGeometry = empty; target.position.x = 2; step(0); check(true);
      if (reason === 'RANGE') target.position.x = 6;
      else game.perceptionGeometry = new PerceptionGeometry([{ id: 'wall', kind: 'wall', x: 1, z: 0, width: .2, depth: 3, height: 2 }], [], () => []);
      step(0); check(true);
      assert.equal(game.vision.get(faction).visible, false, 'AI loses current sight immediately');
      step(999); check(true); step(1); check(false); step(1000); check(false);
    }
    game.perceptionGeometry = empty; target.position.x = 2; step(0); check(true);
    target.position.x = 6; step(500); check(true);
    game.match.phase = 'PAUSED'; step(2000); check(true);
    game.match.phase = 'PLAYING'; game.devFreeze.isFrozen = true; step(2000); check(true);
    game.devFreeze.isFrozen = false; game.controlsHelp.visible = true; step(2000); check(true);
    game.controlsHelp.visible = false; step(499); check(true); step(1); check(false);
    target.position.x = 2; step(0); check(true);
    target.position.x = 6; step(700); check(true);
    target.position.x = 2; step(0); target.position.x = 6; step(999); check(true); step(1); check(false);
    target.position.x = 2; step(0); check(true);
    if (faction === 'HUMAN') {
      game.hide.isConcealed = () => true; step(0); check(false);
      game.hide.isConcealed = () => false; target.position.x = 6; step(0); check(false);
    }
    target.position.x = 2; step(0); target.position.x = 6; step(100); check(true);
    game.hardNightView.resetVisibility(); step(0); check(false);
    target.position.x = 2; step(0); target.position.x = 6; step(100); check(true);
    game.control.selectedFaction = faction === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN'; step(0);
    assert.equal(game.hardNightView.opponentVisible, false, 'changing observer must not inherit grace');
    f.shadows.dispose(); game.hideSearchView.dispose();
  }
  assert.ok(method('resetRound').includes('this.hardNightView.resetVisibility()'));
  assert.match(source, /\(\) => !this\.nightActive \|\| this\.control\.selectedFaction === 'DEEPSEEK' \|\| this\.opponentRendered/,
    'body net must use the delayed render result too');
});

test('HARD night restores exact day lights/background on EASY, NORMAL and menu; hiding still works', () => {
  const f = fixture('HARD', 'HUMAN'), { game } = f;
  const background = f.scene.background, sky = f.ambient.color.clone(), ground = f.ambient.groundColor.clone();
  const sunlight = f.moon.color.clone();
  game.syncNightPresentation(); assert.notEqual(f.scene.background, background);
  assert.ok(f.ambient.intensity < 2 && f.moon.intensity < 2.4);
  for (const level of ['EASY', 'HARD', 'NORMAL']) {
    game.difficulty = level; game.syncNightPresentation();
    if (level === 'HARD') continue;
    assert.equal(f.scene.background, background); assert.ok(f.ambient.color.equals(sky));
    assert.ok(f.ambient.groundColor.equals(ground) && f.moon.color.equals(sunlight));
    assert.equal(f.ambient.intensity, 2); assert.equal(f.moon.intensity, 2.4);
    assert.equal(game.human.visible, true); assert.equal(game.player.visible, true);
  }
  game.difficulty = 'HARD'; game.control.selectedFaction = null; game.syncNightPresentation();
  assert.equal(f.scene.background, background);
  game.control.selectedFaction = 'HUMAN'; game.sceneEditor = { isOpen: true }; game.syncNightPresentation();
  assert.equal(f.scene.background, background, 'DEV authoring keeps its day view and actors');
  assert.equal(game.player.visible, true);
  game.hide.isConcealed = () => true; game.syncNightPresentation(); assert.equal(game.player.visible, false);
  f.shadows.dispose(); game.hideSearchView.dispose();
});

test('actual ThreeGame vision wiring caps both factions only on HARD, retains walls and last-seen expiry', () => {
  assert.equal(C.difficulty.hardNightVisionRange, 5);
  const initializer = source.match(/private vision = ([\s\S]*?);\r?\n/)[1];
  const create = runInNewContext(`(function() { return ${initializer}; })`, { VisionSystem, C });
  const game = { difficulty: 'EASY', runtime: { visionRange: 11 } };
  const vision = create.call(game), empty = new PerceptionGeometry([], [], () => []);
  for (const level of ['EASY', 'NORMAL', 'HARD']) {
    game.difficulty = level; vision.reset(); vision.update(0, { x: 0, z: 0 }, { x: 10.5, z: 0 }, empty);
    for (const faction of ['HUMAN', 'DEEPSEEK']) assert.equal(vision.get(faction).visible, level !== 'HARD');
  }
  vision.update(0, { x: 0, z: 0 }, { x: 2, z: 0 }, empty);
  const last = vision.get('HUMAN').lastSeen;
  vision.update(50, { x: 0, z: 0 }, { x: 10.5, z: 0 }, empty);
  assert.deepEqual(vision.get('HUMAN').lastSeen, last, 'unseen movement cannot refresh exact location');
  vision.update(C.perception.lastSeenMs, { x: 0, z: 0 }, { x: 10.5, z: 0 }, empty);
  assert.equal(vision.get('HUMAN').lastSeen, null); assert.equal(vision.get('DEEPSEEK').lastSeen, null);
  const walls = new PerceptionGeometry([{ id: 'w', kind: 'wall', x: 1, z: 0, width: .2, depth: 3, height: 2 }], [], () => []);
  vision.update(0, { x: 0, z: 0 }, { x: 2, z: 0 }, walls);
  assert.equal(vision.get('HUMAN').status, 'BLOCKED'); assert.equal(vision.get('DEEPSEEK').status, 'BLOCKED');
  game.runtime.visionRange = 30; vision.update(0, { x: 0, z: 0 }, { x: 10.5, z: 0 }, empty);
  assert.equal(vision.get('HUMAN').visible, false, 'DEV range may not bypass the night cap');
});

test('both selected factions feed 5-unit sight into the real opposing AI controllers', () => {
  const initializer = source.match(/private vision = ([\s\S]*?);\r?\n/)[1];
  const create = runInNewContext(`(function() { return ${initializer}; })`, { VisionSystem, C });
  const navigation = { nearestFree: p => p,
    findPath: (a, b) => [{ ...a, doorId: null }, { ...b, doorId: null }] };
  const rooms = [{ id: 'room', x: 0, z: 0, minX: -20, maxX: 20, minZ: -20, maxZ: 20, major: true }];
  // Execute the actual input expressions at the two ThreeGame call sites.
  const humanTarget = source.match(/visibleTarget: (sight\.visible[^,]+),/)[1];
  const dpTarget = source.match(/visibleHuman: (sight\.visible[^,]+),/)[1];
  for (const selectedFaction of ['DEEPSEEK', 'HUMAN']) {
    const game = { difficulty: 'HARD', runtime: { visionRange: 11 },
      human: { position: { x: 0, z: 0 } }, player: { position: { x: 0, z: 0 } } };
    const vision = create.call(game), geometry = new PerceptionGeometry([], [], () => []);
    const humanAi = new HumanAIController(navigation, rooms, [], () => 0);
    const dpAi = new DeepSeekAIController(navigation, []);
    let now = 0;
    for (const distance of [2.9, 3.1, 4, 4.999, 5, 5.001]) {
      game.player.position.x = distance; now += 250;
      vision.update(250, game.human.position, game.player.position, geometry);
      const observer = selectedFaction === 'DEEPSEEK' ? 'HUMAN' : 'DEEPSEEK';
      const sight = vision.get(observer);
      const visible = runInNewContext(`(function() { return ${selectedFaction === 'DEEPSEEK' ? humanTarget : dpTarget}; })`, { sight }).call(game);
      assert.equal(visible !== null, distance <= 5, `${observer} receives the same sight boundary`);
      if (selectedFaction === 'DEEPSEEK') {
        humanAi.update({ deltaMs: 250, nowMs: now, human: game.human.position,
          visibleTarget: visible, lastSeen: sight.lastSeen, heard: null, heardDanger: null,
          visibleTraces: [], captureEligible: false, doors: [], canOpenDoor: () => true });
        assert.equal(humanAi.state, distance <= 5 ? 'CHASE' : 'INVESTIGATE');
      } else {
        dpAi.update({ deltaMs: 250, deepseek: game.player.position, visibleHuman: visible,
          lastSeenHuman: sight.lastSeen, perceptionNowMs: now, geometry, doors: [],
          rice: [{ id: 'rice', x: 15, z: 0, progressMs: 0, maxProgressMs: C.rice.maxProgressMs, completed: false }],
          canOpenDoor: () => true });
        assert.equal(dpAi.threatSource === 'VISION', distance <= 5,
          'DP AI must retain visual threat beyond the old 3-unit boundary, not necessarily flee at any distance');
      }
    }
  }
});

test('hidden opponents do not leak held props or body nets, while flying props remain rendered', t => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = { createElement: () => ({ style: {}, setAttribute() {}, remove() {} }) };
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
  const canvas = new EventTarget(); canvas.parentElement = { append() {} };
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera();
  const a = { faction: 'DEEPSEEK', x: 0, z: 0, heading: 0, canAct: true, hidden: false, renderVisible: false };
  const b = { ...a, faction: 'HUMAN', x: 2, renderVisible: true }, clear = () => null;
  const system = new ThrowableSystem([{ id: 'basin', kind: 'BASIN', x: 0, z: 0 }]);
  assert.equal(system.pickup(a, clear), true);
  const view = new ThrowableView(canvas, scene, camera, system, () => [a, b], () => 'HUMAN', clear, () => {});
  view.sync(); assert.equal(scene.getObjectByName('basin').visible, false);
  a.renderVisible = true; view.sync(); assert.equal(scene.getObjectByName('basin').visible, true);
  a.renderVisible = false; assert.equal(system.throw(a, { x: 3, z: 0 }, clear), true);
  view.sync(); assert.equal(scene.getObjectByName('basin').visible, true, 'only held props inherit render visibility');
  const net = new CaptureNetSystem(); net.rootMs = 5000;
  let showBody = false;
  const netView = new CaptureNetView(canvas, scene, camera, net, () => b, () => a,
    () => false, clear, () => true, () => true, () => showBody);
  const body = netView.root.children[C.captureNet.maxActiveNets + 1];
  netView.sync(); assert.equal(body.visible, false); assert.equal(net.rootMs, 5000);
  showBody = true; netView.sync(); assert.equal(body.visible, true);
  view.dispose(); netView.dispose();
});

test('night suppression is applied before contact shadows/render and hides AI inspection markers', () => {
  const f = fixture('HARD', 'DEEPSEEK'), { game } = f;
  game.hideSearchView.showAiInspection({ x: 1, z: 0 }, 0, { x: 1, z: 1 }, { width: 1, depth: 1, height: 1 });
  game.syncNightPresentation();
  const root = f.scene.children.find(node => node.children.length === 5);
  assert.equal(root.children[2].visible, false); assert.equal(root.children[3].visible, false);
  const tick = source.slice(source.indexOf('private tick ='), source.indexOf('private followEditorCamera'));
  const nightSyncAt = tick.indexOf('this.syncNightPresentation(');
  assert.ok(nightSyncAt >= 0 && nightSyncAt < tick.indexOf('this.actorShadows.update()'));
  assert.ok(nightSyncAt < tick.indexOf('this.renderer.render('));
  assert.ok(tick.includes('this.syncNightPresentation(helpWasVisible ? 0 : gameplayMs)'));
  f.shadows.dispose(); game.hideSearchView.dispose();
});

test('night world feedback retains self warnings without pinpointing a hidden opponent', () => {
  const FeedbackHarness = runInNewContext(stripTypeScriptTypes(`class FeedbackHarness {
    ${method('showWorldFeedback')}
  }; FeedbackHarness`, { mode: 'transform' }));
  const game = new FeedbackHarness(), listener = new THREE.Vector3(0, 0, 0), calls = [];
  Object.assign(game, { nightActive: true, control: { selected: () => ({ position: listener }), selectedFaction: 'HUMAN' },
    perceptionGeometry: { inspectVision: () => ({ status: 'VISIBLE' }) }, hide: { isConcealed: () => false },
    player: { position: new THREE.Vector3(2, 0, 0) }, feedback: { show: text => calls.push(text) } });
  game.showWorldFeedback('self warning', 'bad', listener);
  game.showWorldFeedback('opponent preparing', 'soft', game.player.position);
  assert.deepEqual(calls, ['self warning']);
  game.nightActive = false; game.showWorldFeedback('day feedback', 'soft', game.player.position);
  assert.deepEqual(calls, ['self warning', 'day feedback']);
});
