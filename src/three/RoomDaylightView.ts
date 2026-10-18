import * as THREE from 'three';
import { ROOMS } from './map/apartmentMap.ts';
import type { RoomLightSystem } from '../systems/RoomLightSystem.ts';

/** Restore the original day lights per fragment, only inside lit room bounds. */
export class RoomDaylightView {
  private readonly scene: THREE.Scene;
  private readonly originals = new WeakMap<THREE.Material, {
    compile: THREE.Material['onBeforeCompile']; key: THREE.Material['customProgramCacheKey'];
  }>();
  private readonly uniforms: {
    riceRoomLighting: { value: boolean };
    riceRoomBounds: { value: THREE.Vector4[] };
    riceRoomOn: { value: number[] };
    riceDaySky: { value: THREE.Color };
    riceDayGround: { value: THREE.Color };
    riceDaySun: { value: THREE.Color };
  };

  constructor(scene: THREE.Scene, ambient: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
    this.scene = scene;
    this.uniforms = {
      riceRoomLighting: { value: false },
      riceRoomBounds: { value: ROOMS.map(r => new THREE.Vector4(r.minX, r.maxX, r.minZ, r.maxZ)) },
      riceRoomOn: { value: ROOMS.map(() => 0) },
      riceDaySky: { value: ambient.color.clone().multiplyScalar(ambient.intensity) },
      riceDayGround: { value: ambient.groundColor.clone().multiplyScalar(ambient.intensity) },
      riceDaySun: { value: sun.color.clone().multiplyScalar(sun.intensity) },
    };
  }

  sync(enabled: boolean, system: RoomLightSystem): void {
    this.uniforms.riceRoomLighting.value = enabled;
    ROOMS.forEach((r, i) => { this.uniforms.riceRoomOn.value[i] = enabled && system.isOn(r.id) ? 1 : 0; });
    // Includes asynchronously loaded GLB meshes and newly applied editor geometry.
    this.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) this.patch(material);
    });
  }

  private patch(material: THREE.Material): void {
    if (this.originals.has(material) ||
        !('isMeshStandardMaterial' in material || 'isMeshLambertMaterial' in material || 'isMeshPhongMaterial' in material)) return;
    const original = { compile: material.onBeforeCompile, key: material.customProgramCacheKey };
    this.originals.set(material, original);
    const uniforms = this.uniforms;
    material.onBeforeCompile = function(shader, renderer) {
      original.compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 riceWorldPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vec4 riceWorld = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          riceWorld = batchingMatrix * riceWorld;
        #endif
        #ifdef USE_INSTANCING
          riceWorld = instanceMatrix * riceWorld;
        #endif
        riceWorldPosition = ( modelMatrix * riceWorld ).xyz;
      `);
      shader.fragmentShader = `
        varying vec3 riceWorldPosition;
        uniform bool riceRoomLighting;
        uniform vec4 riceRoomBounds[${ROOMS.length}];
        uniform float riceRoomOn[${ROOMS.length}];
        uniform vec3 riceDaySky, riceDayGround, riceDaySun;
        bool riceIsDaylit() {
          if (!riceRoomLighting) return false;
          for (int r = 0; r < ${ROOMS.length}; r++) {
            vec4 b = riceRoomBounds[r];
            if (riceRoomOn[r] > 0.5 && riceWorldPosition.x >= b.x && riceWorldPosition.x <= b.y &&
                riceWorldPosition.z >= b.z && riceWorldPosition.z <= b.w) return true;
          }
          return false;
        }
      ` + shader.fragmentShader;
      const lighting = THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );',
          'getDirectionalLightInfo( directionalLight, directLight );\nif (riceDaylit) directLight.color = riceDaySun;')
        .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );', `
          HemisphereLight riceHemi = hemisphereLights[ i ];
          if (riceDaylit) { riceHemi.skyColor = riceDaySky; riceHemi.groundColor = riceDayGround; }
          irradiance += getHemisphereLightIrradiance( riceHemi, geometryNormal );
        `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>',
        'bool riceDaylit = riceIsDaylit();\n' + lighting);
    };
    material.customProgramCacheKey = function() { return original.key.call(this) + '|rice-room-daylight-v1'; };
    material.needsUpdate = true;
  }

  dispose(): void {
    this.scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        const original = this.originals.get(material);
        if (!original) continue;
        material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key;
        material.needsUpdate = true; this.originals.delete(material);
      }
    });
  }
}
