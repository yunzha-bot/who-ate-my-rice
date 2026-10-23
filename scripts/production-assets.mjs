import { realpath, unlink } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

// Exact private historical versions only. Keep v6 and future assets; DEV is unfiltered.
export const PRODUCTION_EXCLUDED_ASSETS = [
  'assets/characters/deepseek/deepseek_animated_v1.glb',
  'assets/characters/deepseek/deepseek_animated_v2.glb',
  'assets/characters/deepseek/deepseek_animated_v3.glb',
  'assets/characters/deepseek/deepseek_animated_v4.glb',
  'assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb',
  'assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb',
];

/** Vite copies public before writeBundle. Never filter the development server. */
export function productionAssetFilter() {
  let outDir, projectRoot, outputName;
  return {
    name: 'production-asset-filter', apply: 'build', enforce: 'post',
    configResolved(config) {
      projectRoot = config.root;
      outDir = resolve(config.root, config.build.outDir);
      outputName = relative(resolve(config.root), outDir);
      if (!['dist', 'dist-tencent'].includes(outputName))
        throw new Error('Production asset filtering only supports the project dist or dist-tencent directory');
    },
    async writeBundle() {
      const folder = resolve(outDir, 'assets/characters/deepseek');
      let actual;
      try { actual = await realpath(folder); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      const actualOut = await realpath(outDir);
      if (relative(resolve(await realpath(projectRoot), outputName), actualOut) !== '')
        throw new Error('Refusing to filter a redirected output directory');
      const expected = resolve(actualOut, 'assets/characters/deepseek');
      if (relative(expected, actual) !== '')
        throw new Error('Refusing to filter a redirected character output directory');
      for (const file of PRODUCTION_EXCLUDED_ASSETS) {
        try { await unlink(resolve(outDir, file)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    },
  };
}
