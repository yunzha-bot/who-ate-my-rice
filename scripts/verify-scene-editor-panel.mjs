// Real DOM/CSS regression; use an installed Playwright or supply PLAYWRIGHT_MODULE.
// Requires the existing local Vite server. Does not access profiles or save layout files.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:5173';
const fixture=`<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head>
<body><div id="app"><div id="top"></div></div><script type="module">
import { SceneEditorPanel } from '/src/three/SceneEditorPanel.ts';
import { MapEditSession,authoredMapSource } from '/src/three/map/MapEditModel.ts';
import { ThrowableEditor } from '/src/three/ThrowableEditor.ts';
import { ThrowableSystem } from '/src/systems/ThrowableSystem.ts';
import initial from '/src/three/map/throwableLayout.json';
import { RoomLightEditor } from '/src/three/RoomLightEditor.ts';
import { RoomLightSystem,createRoomLightSwitches } from '/src/systems/RoomLightSystem.ts';
const session=new MapEditSession(authoredMapSource());window.changes=[];window.saved=0;
const state={open:true,freezeState:'FROZEN',freezeReason:'SCENE_EDITOR',selection:'guest_bed',
  draftStatus:'UNCHANGED',lastRejection:'无',appliedCount:0,anchorsVisible:true,rotationSnap:false,events:[],
  layout:{label:'SAVED',text:'已保存',saved:true,authored:true,pending:false},layoutSavedAt:null,layoutError:null};
const noop=()=>{};
const panel=new SceneEditorPanel({container:document.querySelector('#app'),topRow:document.querySelector('#top'),
  enabled:true,onOpen:noop,onClose:noop,onSelect:id=>{state.selection=id;panel.render(session,state);},
  onFocus:noop,onFieldChange:(...args)=>window.changes.push(args),onApply:noop,onDiscard:noop,
  onResetTarget:noop,onExport:noop,onSave:()=>window.saved++,onImportFile:noop,onRestoreDefault:noop,
  onAnchorsVisible:noop,onRegionPreviewVisible:noop,onRotationSnapChange:noop});
const props=new ThrowableEditor(initial,authoredMapSource,new ThrowableSystem(initial),{
  models:new Map(initial.map(p=>[p.id,{userData:{}}])),setEditorLayout:noop},noop,noop);
const lights=new RoomLightEditor(new RoomLightSystem(createRoomLightSwitches(()=>true)),
  {targets:new Map(),setEditorLayout:noop},[],authoredMapSource,noop,noop);
panel.appendExtension(props.element);panel.appendExtension(lights.element);
panel.setOpen(true);panel.render(session,state);props.render();window.ready=true;
</script></body></html>`;
const results=[];
for(const channel of ['chrome','msedge']){
  const browser=await chromium.launch({channel,headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route(origin+'/__scene_editor_panel_check__',route=>route.fulfill({contentType:'text/html',body:fixture}));
    for(const viewport of [{width:762,height:484},{width:1280,height:720},{width:1920,height:1080}]){
      await page.setViewportSize(viewport);await page.goto(origin+'/__scene_editor_panel_check__');
      await page.waitForFunction(()=>window.ready);
      for(const expanded of [false,true]){
        await page.locator('.room-light-editor').evaluate((e,open)=>e.open=open,expanded);
        const metrics=await page.evaluate(()=>{const p=document.querySelector('.scene-editor-panel'),
          d=document.querySelector('.scene-editor-detail'),f=d.querySelector('.scene-editor-form');
          return {detailHeight:d.clientHeight,panelHeight:p.clientHeight,panelScrollHeight:p.scrollHeight,
            panelOverflow:getComputedStyle(p).overflowY,formWidth:f.clientWidth,formScrollWidth:f.scrollWidth};});
        console.log(JSON.stringify({channel,viewport,expanded,...metrics}));
        assert.ok(metrics.detailHeight>=120,'coordinate detail area must not collapse to a thin strip');
        assert.ok(metrics.panelHeight<=viewport.height-40,'panel stays within viewport');
        assert.ok(metrics.formScrollWidth<=metrics.formWidth+1,'inputs fit without horizontal clipping');
        const field=page.locator('.scene-editor-detail [data-field="x"]');await field.scrollIntoViewIfNeeded();
        assert.ok(await field.evaluate(e=>{const r=e.getBoundingClientRect();
          return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),'coordinate input is not clipped by an ancestor');
        await field.fill('1.25');await field.press('Tab');
        assert.ok(await page.evaluate(()=>window.changes.some(p=>p[1]==='x'&&p[2]===1.25)));
        const save=page.getByRole('button',{name:'保存布局',exact:true});await save.click();
        assert.ok(await page.evaluate(()=>window.saved>0),'save remains reachable by scrolling');
        results.push({channel,viewport,expanded,...metrics});
      }
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
console.log(JSON.stringify({passed:results.length,results},null,2));
