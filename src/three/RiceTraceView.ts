import * as THREE from 'three';
import type { RiceTrace } from '../systems/PerceptionSystem';

export function createRiceTraceView(trace: RiceTrace, visibleToHuman: boolean): THREE.Mesh {
  const view = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.53, 28),
    new THREE.MeshBasicMaterial({ color: 0x364049, transparent: true,
      opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
  view.rotation.x = -Math.PI / 2;
  view.position.set(trace.position.x, 0.07, trace.position.z);
  view.renderOrder = 2;
  syncRiceTraceView(view, trace, visibleToHuman);
  return view;
}

export function syncRiceTraceView(view: THREE.Mesh, trace: RiceTrace,
  visibleToHuman: boolean): void {
  view.visible = visibleToHuman;
  (view.material as THREE.MeshBasicMaterial).opacity = trace.strength * 0.9;
}
