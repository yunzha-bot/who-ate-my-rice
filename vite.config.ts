import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authoredMapSource } from './src/three/map/MapEditModel.ts';
import { importLayoutText, layoutSource } from './src/three/map/MapLayoutStore.ts';

const layoutPath = resolve('src/three/map/sceneLayout.json');
const revision = (text: string) => createHash('sha256').update(text).digest('hex');

function sceneLayoutSave(): Plugin {
  return { name: 'scene-layout-save', configureServer(server) {
    let saving = false;
    server.middlewares.use('/__dev/scene-layout', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${server.config.server.port}`) {
        res.statusCode = 403; res.end(JSON.stringify({ error: '非法来源' })); return;
      }
      let current: string;
      try { current = await readFile(layoutPath, 'utf8'); }
      catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `读取项目布局失败：${String(error)}` }));
        return;
      }
      if (req.method === 'GET') {
        res.end(JSON.stringify({ revision: revision(current) })); return;
      }
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      if (saving) {
        res.statusCode = 409; res.end(JSON.stringify({ error: '另一份布局正在保存，请稍后重试' }));
        return;
      }
      saving = true;
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1_000_000) throw Error('布局文件过大');
        }
        const request = JSON.parse(raw);
        if (request.revision !== revision(current)) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: '项目布局已被其他修改更新，请刷新后重新检查，未覆盖新布局' }));
          return;
        }
        const parsed = importLayoutText(JSON.stringify(request.document), authoredMapSource());
        if (!parsed.ok) {
          res.statusCode = 400; res.end(JSON.stringify({ error: parsed.message })); return;
        }
        const source = layoutSource(parsed.document);
        const next = JSON.stringify({ furniture: source.furniture, hideSpots: source.hideSpots }, null, 2) + '\n';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await copyFile(layoutPath, `${layoutPath}.${stamp}.bak`);
        const temporary = `${layoutPath}.${process.pid}.tmp`;
        await writeFile(temporary, next);
        await rename(temporary, layoutPath);
        res.end(JSON.stringify({ revision: revision(next), savedAt: new Date().toISOString() }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `写入失败：${String(error)}` }));
      } finally {
        saving = false;
      }
    });
  } };
}

/**
 * 本地开发固定使用 http://127.0.0.1:5173/。
 * strictPort: 端口被占用时直接报错退出，绝不静默切换到 5174 等其他端口。
 */
export default defineConfig({
  plugins: [sceneLayoutSave()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
