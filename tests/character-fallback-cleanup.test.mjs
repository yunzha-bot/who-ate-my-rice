import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { disposeDeepSeekModel } from '../src/three/DeepSeekGlbModel.ts';

const source = readFileSync(new URL('../src/three/CharacterActionView.ts', import.meta.url), 'utf8');
const method = source.match(/  private async loadVisual\([\s\S]*?\n  }\n/)?.[0];
assert.ok(method);

for (const failure of ['before-attach', 'animation-init', 'hair-init']) {
  test(`failed ${failure} clears the visual and disposes each owned resource once`, async () => {
    const root = new THREE.Group(), model = new THREE.Group();
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
    model.add(new THREE.Mesh(geometry, material)); model.animations = [new THREE.AnimationClip('Idle', 1, [])];
    let geometryDisposals = 0, materialDisposals = 0, animationDisposals = 0, externalVisual = null;
    geometry.addEventListener('dispose', () => geometryDisposals++);
    material.addEventListener('dispose', () => materialDisposals++);
    const Harness = runInNewContext(stripTypeScriptTypes(`class ViewHarness { ${method} }; ViewHarness;`), {
      loadDeepSeekModel: async () => model, disposeDeepSeekModel,
      DeepSeekAnimation: class {
        constructor() { if (failure === 'animation-init') throw Error('injected animation initialization'); }
        dispose() { animationDisposals++; }
      },
      DeepSeekHairMotion: class { constructor() { throw Error('injected hair initialization'); } },
      C: { characterAnimation: { transitionMs: 80 } }, console: { warn() {} },
    });
    const view = new Harness(); view.disposed = false; view.deepseekAnimation = null; view.deepseekHair = null;
    view.avatar = { root,
      useExternalVisual(object) { if (failure === 'before-attach') throw Error('injected bounds failure'); externalVisual = object; root.add(object); },
      clearExternalVisual() { if (externalVisual) disposeDeepSeekModel(externalVisual); externalVisual = null; },
    };
    await view.loadVisual();
    assert.equal(root.children.length, 0); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
    assert.equal(view.deepseekAnimation, null); assert.equal(view.deepseekHair, null);
    assert.equal(animationDisposals, failure === 'hair-init' ? 1 : 0);
  });
}
