import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { distanceToXZSegment } from '../systems/NavigationSystem';
import type { DeepSeekAIController } from '../systems/DeepSeekAIController';
import type { Point } from './map/apartmentMap';

/** DEV-only display. Actual Human coordinates never flow back to the AI. */
export class AISafetyPathView {
  readonly group = new THREE.Group();
  enabled = false;
  private signature = '';
  constructor(scene: THREE.Scene) { scene.add(this.group); }
  update(data: DeepSeekAIController['safetyDebug'], actualHuman: Point): void {
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    const signature = JSON.stringify([data, actualHuman.x, actualHuman.z]);
    if (signature === this.signature) return;
    this.signature = signature;
    for (const child of [...this.group.children]) {
      const line = child as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      line.geometry.dispose(); line.material.dispose(); this.group.remove(line);
    }
    this.ring(actualHuman, C.match.captureRadius, 0xff4545);
    this.ring(actualHuman, C.match.captureRadius + C.deepseekAI.stationaryPassageSafetyMargin, 0xffc745);
    if (data.human) this.ring(data.human, 0.12, 0xffffff);
    if (data.rice) this.ring(data.rice, 0.18, 0xff8bf3);
    if (data.eat) this.ring(data.eat, 0.22, 0x45ff9a);
    if (data.observation) this.ring(data.observation, 0.26, 0x49ddff);
    this.route(data.defaultPath, data.human, 0x8888ff);
    this.route(data.safePath, data.human, 0x45ff9a);
  }
  private line(points: Point[], color: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, 0.09, p.z)));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color,
      depthTest: false, transparent: true, opacity: 0.9 }));
    line.renderOrder = 20;
    line.raycast = () => {};
    this.group.add(line);
  }
  private ring(center: Point, radius: number, color: number): void {
    this.line(Array.from({ length: 65 }, (_, i) => ({
      x: center.x + Math.cos(i * Math.PI / 32) * radius,
      z: center.z + Math.sin(i * Math.PI / 32) * radius })), color);
  }
  private route(path: readonly Point[], human: Point | null, color: number): void {
    for (let i = 1; i < path.length; i++) {
      const unsafe = human && distanceToXZSegment(human, path[i-1], path[i]) <
        C.match.captureRadius + C.deepseekAI.stationaryPassageSafetyMargin;
      this.line([path[i-1], path[i]], unsafe ? 0xff4545 : color);
    }
  }
}
