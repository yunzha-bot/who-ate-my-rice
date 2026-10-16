import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { productionAssetFilter } from './scripts/production-assets.mjs';
import { authoredMapSource } from './src/three/map/MapEditModel.ts';
import { importLayoutText, layoutSource } from './src/three/map/MapLayoutStore.ts';
import { validateThrowableLayout } from './src/three/map/ThrowableLayoutModel.ts';

const layoutPath = resolve('src/three/map/sceneLayout.json');
const throwableLayoutPath = resolve('src/three/map/throwableLayout.json');
const revision = (text: string) => createHash('sha256').update(text).digest('hex');
// Both entry points write authored layouts; serialize them under one DEV save lock.
let layoutSaving = false;

function sceneLayoutSave(): Plugin {
  return { name: 'scene-layout-save', apply: 'serve', configureServer(server) {
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
      if (layoutSaving) {
        res.statusCode = 409; res.end(JSON.stringify({ error: '另一份布局正在保存，请稍后重试' }));
        return;
      }
      layoutSaving = true;
      try {
        current = await readFile(layoutPath, 'utf8');
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
        let propsCurrent: string | null=null, propsNext: string | null=null;
        if(request.throwables!==undefined){
          propsCurrent=await readFile(throwableLayoutPath,'utf8');
          if(request.throwables?.revision!==revision(propsCurrent)){
            res.statusCode=409;res.end(JSON.stringify({error:'道具位置已被其他修改更新，请刷新，未覆盖任何布局'}));return;
          }
          const error=validateThrowableLayout(request.throwables.layout,JSON.parse(propsCurrent),
            {...authoredMapSource(),...source});
          if(error){res.statusCode=400;res.end(JSON.stringify({error}));return;}
          propsNext=JSON.stringify(request.throwables.layout,null,2)+'\n';
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const mapChanged=next!==current, propsChanged=propsNext!==null&&propsNext!==propsCurrent;
        const temporary = `${layoutPath}.${process.pid}.tmp`;
        const propsTemporary=`${throwableLayoutPath}.${process.pid}.tmp`;
        // Validate both versions and prepare both backups before replacing either file.
        if(mapChanged){await copyFile(layoutPath, `${layoutPath}.${stamp}.bak`);await writeFile(temporary,next);}
        if(propsChanged){await copyFile(throwableLayoutPath,`${throwableLayoutPath}.${stamp}.bak`);await writeFile(propsTemporary,propsNext!);}
        // Furniture is last: its config dependency may restart Vite after replacement.
        if(propsChanged)await rename(propsTemporary,throwableLayoutPath);
        if(mapChanged)await rename(temporary,layoutPath);
        res.end(JSON.stringify({ revision: revision(next), savedAt: new Date().toISOString(),
          ...(propsNext!==null?{throwableRevision:revision(propsNext)}:{}) }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `写入失败：${String(error)}；请核对文件，可能部分写入，自动备份保留` }));
      } finally {
        layoutSaving = false;
      }
    });
  } };
}

/** Independent prop layout: never writes sceneLayout or resurrects game-round objects. */
function throwableLayoutSave(): Plugin {
  return {name:'throwable-layout-save',apply:'serve',configureServer(server){
    server.middlewares.use('/__dev/throwable-layout',async(req,res)=>{
      res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${server.config.server.port}`){
        res.statusCode=403;res.end(JSON.stringify({error:'非法来源'}));return;}
      if(req.method!=='GET'&&req.method!=='POST'){res.statusCode=405;res.end();return;}
      if(req.method==='POST'&&layoutSaving){res.statusCode=409;res.end(JSON.stringify({error:'布局正在保存'}));return;}
      if(req.method==='POST')layoutSaving=true;
      try{
        const current=await readFile(throwableLayoutPath,'utf8'),reference=JSON.parse(current);
        if(req.method==='GET'){res.end(JSON.stringify({revision:revision(current),layout:reference}));return;}
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw Error('布局文件过大');}
        const request=JSON.parse(raw);
        if(request.revision!==revision(current)){res.statusCode=409;
          res.end(JSON.stringify({error:'投掷物文件已更新，请刷新重新编辑，未覆盖新文件'}));return;}
        const source={...authoredMapSource(),...JSON.parse(await readFile(layoutPath,'utf8'))};
        const error=validateThrowableLayout(request.layout,reference,source);
        if(error){res.statusCode=400;res.end(JSON.stringify({error}));return;}
        const next=JSON.stringify(request.layout,null,2)+'\n';
        const stamp=new Date().toISOString().replace(/[:.]/g,'-');
        await copyFile(throwableLayoutPath,`${throwableLayoutPath}.${stamp}.bak`);
        const temporary=`${throwableLayoutPath}.${process.pid}.tmp`;
        await writeFile(temporary,next);await rename(temporary,throwableLayoutPath);
        res.end(JSON.stringify({revision:revision(next),savedAt:new Date().toISOString()}));
      }catch(error){res.statusCode=500;res.end(JSON.stringify({error:`投掷物保存失败：${String(error)}`}));}
      finally{if(req.method==='POST')layoutSaving=false;}
    });
  }};
}

/**
 * 本地开发固定使用 http://127.0.0.1:5173/。
 * strictPort: 端口被占用时直接报错退出，绝不静默切换到 5174 等其他端口。
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.PAGES_DEPLOYMENT === 'true' ? '/who-ate-my-rice/' : '/',
  plugins: [sceneLayoutSave(), throwableLayoutSave(), productionAssetFilter()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
}));
