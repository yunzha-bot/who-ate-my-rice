import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { RiceTrace } from '../systems/PerceptionSystem';

export function createRiceTraceView(trace: RiceTrace, visibleToHuman: boolean): THREE.Group {
  const view = new THREE.Group();
  const visual = GAME_CONFIG.perception.traceVisual;
  for (const side of [-1, 1]) {
    const footprint = new THREE.Mesh(new THREE.CircleGeometry(visual.footprintRadius, 20),
      new THREE.MeshBasicMaterial({ color: visual.color, transparent: true,
        opacity: visual.opacity, side: THREE.DoubleSide, depthWrite: false }));
    footprint.scale.set(visual.widthScale, visual.lengthScale, 1);
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.set(side * visual.sideOffset, 0, side * visual.forwardOffset);
    footprint.renderOrder = 2;
    view.add(footprint);
  }
  view.position.set(trace.position.x, visual.groundOffset, trace.position.z);
  view.rotation.y = trace.heading;
  view.renderOrder = 2;
  syncRiceTraceView(view, trace, visibleToHuman);
  return view;
}

export function syncRiceTraceView(view: THREE.Group, trace: RiceTrace,
  visibleToHuman: boolean): void {
  view.visible = visibleToHuman;
  view.traverse(object => {
    if (object instanceof THREE.Mesh)
      (object.material as THREE.MeshBasicMaterial).opacity =
        trace.strength * GAME_CONFIG.perception.traceVisual.opacity;
  });
}
