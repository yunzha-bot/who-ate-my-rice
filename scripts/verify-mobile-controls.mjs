// Isolated local browser fixtures only. No profiles, project saves, or production globals.
// Use an existing Vite on 127.0.0.1:5173 and an installed/bundled Playwright.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = 'http://127.0.0.1:5173';
const artifacts = process.env.MOBILE_ARTIFACT_DIR ?? await mkdtemp(join(tmpdir(), 'rice-mobile-'));
await mkdir(artifacts,{recursive:true});
console.log(JSON.stringify({artifacts}));
const fixture = `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head>
<body><div id="app"></div><script type="module">
import '/src/style.css'; import '/src/industrial-ui.css'; import '/src/sheet-ui.css';
import '/src/s13-ui.css'; import '/src/game-ui.css'; import '/src/opening-menu.css'; import '/src/mobile-ui.css';
import {ThreeGame} from '/src/three/ThreeGame.ts'; import {StartupView} from '/src/three/StartupView.ts';
import * as THREE from '/node_modules/.vite/deps/three.js';
const root=document.querySelector('#app'), startup=new StartupView(root);
window.game=new ThreeGame(root,startup.readiness); window.THREE=THREE;
window.parkOpponent=()=>{const g=window.game,a=g.control.controlled(g.player,g.human),other=a===g.player?g.human:g.player;
  for(let x=-24;x<=24;x+=2)for(let z=-16;z<=16;z+=2)if(Math.hypot(x-a.position.x,z-a.position.z)>15&&g.collision.canOccupyStaticXZ(x,z,.3,.7)){
    other.position.x=x;other.position.z=z;return;}};
startup.onSimplify=()=>window.game.useSimplifiedStartupVisual(); void startup.prepared();
</script></body></html>`;
const results = [];
for (const channel of (process.env.MOBILE_CHANNELS ?? 'chrome,msedge').split(',')) {
  const browser = await chromium.launch({ channel, headless: true,
    args: process.env.MOBILE_USE_GPU==='1' ? ['--enable-unsafe-swiftshader'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of process.env.MOBILE_DESKTOP_ONLY==='1' ? [] : [{width:667,height:375}, {width:844,height:390}]) {
      const context = await browser.newContext({ viewport, hasTouch:true, isMobile:true, deviceScaleFactor:3 });
      const page = await context.newPage(), errors=[];
      page.on('pageerror', error=>errors.push(String(error)));
      await page.route(origin+'/__mobile_check__*',route=>route.fulfill({contentType:'text/html',body:fixture}));
      await page.goto(origin+'/__mobile_check__?matchSeed=20261018');
      await page.waitForFunction(()=>window.game?.startupReadiness.canStart, null, {timeout:60000});
      await page.locator('.startup-view').waitFor({state:'detached',timeout:30000});
      const cdp = await context.newCDPSession(page), fingers=new Map();
      const dispatch=type=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...fingers].map(([id,p])=>({id,...p}))});
      const start=async(id,x,y)=>{fingers.set(id,{x,y});await dispatch('touchStart');};
      const move=async(id,x,y)=>{fingers.set(id,{x,y});await dispatch('touchMove');};
      const end=async id=>{fingers.delete(id);await dispatch('touchEnd');};
      const center=async selector=>{const r=await page.locator(selector).boundingBox();assert(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
      const tap=async selector=>{await page.waitForFunction(s=>!document.querySelector(s).disabled,selector);const p=await center(selector);await start(99,p.x,p.y);await end(99);};
      for (const faction of ['HUMAN','DEEPSEEK']) {
        await page.locator('.faction-card[data-faction="'+faction+'"]').tap();
        if(await page.locator('.controls-help').isVisible()) await page.locator('.controls-help-close').tap();
        await page.waitForFunction(()=>window.game.match.phase==='PLAYING');
        const layout = await page.evaluate(()=>{
          const g=window.game,boxes=[...document.querySelectorAll('.mobile-actions button,.mobile-toolbar button,.mobile-stick')]
            .filter(node=>node.getClientRects().length).map(node=>{const r=node.getBoundingClientRect();return{text:node.textContent,x:r.x,y:r.y,w:r.width,h:r.height};});
          return {coarse:matchMedia('(pointer: coarse)').matches,dpr:g.renderer.getPixelRatio(),boxes};
        });
        assert(layout.coarse);assert.equal(layout.dpr,1.35);
        for(const r of layout.boxes){assert(r.x>=0&&r.y>=0&&r.x+r.w<=viewport.width+1&&r.y+r.h<=viewport.height+1,JSON.stringify(r));assert(r.h>=44);}
        if(process.env.MOBILE_LAYOUT_ONLY==='1'){
          await page.screenshot({path:join(artifacts,channel+'-'+viewport.width+'-'+faction+'-layout.png')});
          assert(await page.locator('.mobile-actions button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length)
            .every(n=>n.getBoundingClientRect().height<=70)),'phone labels fit compact touch targets');
          assert.deepEqual(errors,[]);results.push({channel,viewport,faction,layout:true});
          await page.evaluate(()=>window.game.returnToFactionSelect());continue;
        }
        await page.evaluate(()=>window.parkOpponent());
        // Edge contact keeps a safe visual center, but the real input starts at zero.
        await start(1,2,viewport.height*.63);
        const edgeStick=await page.locator('.mobile-stick').boundingBox();assert(edgeStick);
        assert(edgeStick.x+edgeStick.width/2>=64,'floating center inset');
        assert.deepEqual(await page.evaluate(()=>window.game.input.localDirection()),{x:0,y:0});
        await move(1,30,viewport.height*.63);assert.equal(await page.evaluate(()=>window.game.input.localDirection().x),1);
        const baseAfter=await page.locator('.mobile-stick').boundingBox();assert.equal(baseAfter.x,edgeStick.x,'base is fixed during drag');
        await end(1);assert(await page.locator('.mobile-stick').isHidden());
        // Move the real actor through the real collision system using a trusted browser touch.
        const before=await page.evaluate(()=>{const g=window.game,a=g.control.controlled(g.player,g.human);return{x:a.position.x,z:a.position.z};});
        assert(await page.locator('.mobile-stick').isHidden());
        const stick=await center('.mobile-move-zone');await start(1,stick.x,stick.y);
        assert.deepEqual(await page.evaluate(()=>window.game.input.localDirection()),{x:0,y:0},'first contact must not cause edge-clamp drift');
        await move(1,stick.x+36,stick.y);
        await page.waitForFunction(p=>{const g=window.game,a=g.control.controlled(g.player,g.human);return Math.hypot(a.position.x-p.x,a.position.z-p.z)>.05;},before);
        await page.screenshot({path:join(artifacts,channel+'-'+viewport.width+'-'+faction+'-floating-stick.png')});
        await end(1);assert.deepEqual(await page.evaluate(()=>window.game.input.localDirection()),{x:0,y:0});
        assert(await page.locator('.mobile-stick').isHidden());
        // Place one real basin within pickup reach in this controlled fixture.
        await page.evaluate(()=>{const g=window.game,a=g.control.controlled(g.player,g.human),item=g.throwables.items.find(i=>i.kind==='BASIN');
          item.state='GROUND';item.holder=null;item.readyAt=0;item.x=a.position.x;item.z=a.position.z;window.propId=item.id;});
        await page.waitForFunction(()=>!document.querySelector('[data-touch-code="KeyF"]').disabled);
        await tap('[data-touch-code="KeyF"]');
        await page.waitForFunction(()=>!!window.game.throwables.held(window.game.control.controlledFaction));
        const heldBefore=await page.evaluate(()=>window.game.throwables.items.find(i=>i.id===window.propId).remainingThrows);
        const throwButton=await center('.mobile-throw');await start(2,throwButton.x,throwButton.y);
        const aimOwner=await page.evaluate(()=>({id:window.game.throwableView.touchAimPointer,phase:window.game.match.phase,
          held:!!window.game.throwables.held(window.game.control.controlledFaction),stun:window.game.throwables.stunRemaining}));
        assert.notEqual(aimOwner.id,null,'touch must start aiming: '+JSON.stringify(aimOwner));
        const target=await page.evaluate(()=>{const g=window.game,a=g.control.controlled(g.player,g.human),p=a.position.clone();p.x+=2;
          p.y=0;p.project(g.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
        await move(2,target.x,target.y);
        const qButton=await center('[data-touch-code="KeyQ"]');await move(2,qButton.x,qButton.y);
        assert.equal(await page.evaluate(()=>window.game.input.isHeld('KeyQ')),false,'dragging over another button must not press it');
        await move(2,target.x,target.y);
        await start(1,stick.x,stick.y);
        await move(1,stick.x+32,stick.y-4);
        assert.equal(await page.evaluate(()=>window.game.throwableView.touchAimPointer),aimOwner.id,'joystick movement must preserve throw aim');
        await page.screenshot({path:join(artifacts,channel+'-'+viewport.width+'-'+faction+'-aim-multitouch.png')});
        // CDP touchEnd lifts all contacts; individual release ownership has a separate unit regression.
        fingers.clear();await dispatch('touchEnd');
        await page.waitForFunction(n=>window.game.throwables.items.find(i=>i.id===window.propId).remainingThrows===n-1,heldBefore);
        // A cancelled gesture must retain the held prop and its durability.
        await page.evaluate(()=>{const g=window.game,item=g.throwables.items.find(i=>i.id===window.propId);item.state='HELD';item.holder=g.control.controlledFaction;});
        await page.waitForFunction(()=>!document.querySelector('.mobile-throw').disabled);
        await start(2,throwButton.x,throwButton.y);fingers.clear();await dispatch('touchCancel');
        assert.equal(await page.evaluate(()=>window.game.throwableView.touchAimPointer),null);
        assert.equal(await page.evaluate(()=>window.game.throwables.items.find(i=>i.id===window.propId).remainingThrows),heldBefore-1);
        // Pausing mid-aim cancels the gesture rather than completing it on release.
        await start(2,throwButton.x,throwButton.y);await move(2,target.x,target.y);
        await tap('.mobile-pause');await page.waitForFunction(()=>window.game.match.phase==='PAUSED');
        fingers.clear();await dispatch('touchCancel');
        assert.equal(await page.evaluate(()=>window.game.throwableView.touchAimPointer),null);
        assert.equal(await page.evaluate(()=>window.game.throwables.items.find(i=>i.id===window.propId).remainingThrows),heldBefore-1);
        await page.getByRole('button',{name:'继续游戏',exact:true}).tap();await page.waitForFunction(()=>window.game.match.phase==='PLAYING');
        if(faction==='HUMAN'){
          // Choose a physically valid, unprotected test area; random spawns may be too narrow for nets.
          assert(await page.evaluate(()=>{const g=window.game;for(let x=-22;x<=22;x+=2)for(let z=-15;z<=15;z+=2){
            if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;
            g.human.position.x=x;g.human.position.z=z;g.followCamera();g.camera.updateMatrixWorld(true);
            for(const dx of [-2,2,-1,1])for(const dz of [-1,1,-2,2]){
              const p={x:x+dx,z:z+dz};if(!g.captureNet.valid(g.human.position,p,g.traceThrow,g.netGroundClear))continue;
              const q=new window.THREE.Vector3(p.x,0,p.z).project(g.camera),sx=(q.x+1)*innerWidth/2,sy=(1-q.y)*innerHeight/2;
              if(document.elementFromPoint(sx,sy)===g.renderer.domElement)return true;
            }}return false;}),'controlled placement area');
          await tap('[data-touch-code="KeyQ"]');await page.waitForFunction(()=>window.game.captureNet.mode==='AIMING');
          const spot=await page.evaluate(()=>{const g=window.game;for(let x=-3;x<=3;x+=.25)for(let z=-3;z<=3;z+=.25){
            const p={x:g.human.position.x+x,z:g.human.position.z+z};if(!g.captureNet.valid(g.human.position,p,g.traceThrow,g.netGroundClear))continue;
            const q=new window.THREE.Vector3(p.x,0,p.z).project(g.camera),sx=(q.x+1)*innerWidth/2,sy=(1-q.y)*innerHeight/2;
            if(document.elementFromPoint(sx,sy)===g.renderer.domElement)return{x:sx,y:sy};}return null;});
          if(!spot){await page.screenshot({path:join(artifacts,'placement-failure.png')});console.log(await page.evaluate(()=>({position:window.game.human.position,phase:window.game.match.phase,mode:window.game.captureNet.mode,
            canvasAtCenter:document.elementFromPoint(innerWidth/2,innerHeight/2)?.className})));}
          assert(spot,'reachable visible net placement point');await start(3,spot.x,spot.y);
          assert.equal(await page.evaluate(()=>window.game.captureNet.mode),'AIMING');
          await end(3);await page.waitForFunction(()=>window.game.captureNet.nets.length===1);
          assert.equal(await page.locator('[data-touch-code="KeyQ"]').getAttribute('data-slots'),'3');
          await page.screenshot({path:join(artifacts,channel+'-'+viewport.width+'-human.png')});
        }
        // All action arbitration is exercised with controlled, legal positions; gameplay rules are unchanged.
        if(faction==='HUMAN'){
          await tap('[data-touch-code="KeyV"]');
          await page.waitForFunction(()=>window.game.humanSearchCooldown.remainingSeconds>0);
        }else{
          const s=await center('.mobile-move-zone'),sprint=await center('[data-touch-code="Space"]');
          await start(1,s.x,s.y);await move(1,s.x+30,s.y);await start(2,sprint.x,sprint.y);
          await page.waitForFunction(()=>window.game.sprint.state==='SPRINT_RUNNING');
          fingers.clear();await dispatch('touchEnd');
          // End the sprint via its normal system clock in this setup so E/hide can be checked without waiting on rendering.
          await page.evaluate(()=>window.game.sprint.advance(3000,{x:0,y:0}));
        }
        assert(await page.evaluate(()=>{const g=window.game,a=g.control.controlled(g.player,g.human);
          for(const view of g.doorViews.values()){const d=view.definition;
            for(const side of [-1,1]){const x=d.x+Math.sin(d.rotation)*side*.85,z=d.z+Math.cos(d.rotation)*side*.85;
              if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;
              a.position.x=x;a.position.z=z;
              if(g.nearestInteractableDoor(a.position)?.door.id!==d.id)continue;
              const state=g.doorSystem.get(d.id);state.state='CLOSED';state.locked=false;state.lockCoreState='ACTIVE';
              g.syncDoor(d.id);g.followCamera();window.doorId=d.id;window.parkOpponent();return true;
            }}return false;}),'legal door approach');
        await page.waitForFunction(()=>document.querySelector('[data-touch-code="KeyE"]').dataset.interactionState==='READY');
        assert.equal(await page.locator('.world-interaction').evaluate(n=>getComputedStyle(n).display),'none');
        const ripple=await page.locator('[data-touch-code="KeyE"]').evaluate(n=>{const s=getComputedStyle(n,'::after');return {animation:s.animationName,duration:s.animationDuration,transform:s.transform};});
        assert.equal(ripple.animation,'mobile-interaction-ripple');
        assert.equal(ripple.duration,'1.05s');
        await page.screenshot({path:join(artifacts,channel+'-'+viewport.width+'-'+faction+'-interaction-ripple.png')});
        await page.emulateMedia({reducedMotion:'reduce'});
        assert.equal(await page.locator('[data-touch-code="KeyE"]').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
        await page.emulateMedia({reducedMotion:'no-preference'});
        const approach=await page.evaluate(()=>{const g=window.game,a=g.control.controlled(g.player,g.human),p={x:a.position.x,z:a.position.z};
          for(let x=-24;x<24;x+=2)for(let z=-16;z<16;z+=2){if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;a.position.x=x;a.position.z=z;if(!g.currentInteractionPrompt())return p;}throw Error('no empty legal point');});
        await page.waitForFunction(()=>document.querySelector('[data-touch-code="KeyE"]').dataset.interactionState==='NONE');
        assert.equal(await page.locator('[data-touch-code="KeyE"]').evaluate(n=>getComputedStyle(n,'::after').animationName),'none');
        await page.evaluate(p=>{const g=window.game,a=g.control.controlled(g.player,g.human);a.position.x=p.x;a.position.z=p.z;g.followCamera();},approach);
        await page.waitForFunction(()=>document.querySelector('[data-touch-code="KeyE"]').dataset.interactionState==='READY');
        await page.keyboard.press('h');assert.equal(await page.locator('.world-interaction').evaluate(n=>getComputedStyle(n).display),'flex','a real keyboard restores its E prompt on a touch device');
        await tap('[data-touch-code="KeyE"]');await page.waitForFunction(()=>window.game.doorSystem.get(window.doorId).state==='OPEN');
        if(faction==='HUMAN'){
          await page.evaluate(()=>{const g=window.game,d=g.doorSystem.get(window.doorId);d.state='LOCKED';d.locked=true;d.lockCoreState='ACTIVE';g.syncDoor(d.id);});
          await tap('[data-touch-code="KeyE"]');await page.waitForFunction(()=>window.game.pulseLock.isOpen);
          await page.waitForFunction(()=>document.querySelector('[data-touch-code="KeyE"]').textContent==='点按解锁');
          await tap('[data-touch-code="KeyE"]');
          await page.waitForFunction(()=>window.game.pulseLock.get(window.doorId).feedback!=='NONE');
          await page.locator('.mobile-cancel').tap();assert.equal(await page.evaluate(()=>window.game.pulseLock.isOpen),false);
          await tap('[data-touch-code="Space"]');await page.waitForFunction(()=>window.game.doorSystem.get(window.doorId).state==='OPEN');
          assert(await page.evaluate(()=>window.game.humanDoorSkill.cooldownRemainingMs>0));
          assert(await page.evaluate(()=>{const g=window.game;g.humanSearchCooldown.reset();
            for(const spot of g.hideSpots){const f=g.mapFurniture.find(f=>f.id===spot.furnitureId);if(!f)continue;
              for(let r=1;r<=3;r+=.5)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const x=f.x+Math.cos(angle)*r,z=f.z+Math.sin(angle)*r;
                if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;g.human.position.x=x;g.human.position.z=z;
                g.lastHumanFacing={x:(f.x-x)/r,y:(f.z-z)/r};
                if(!g.nearestInteractableDoor(g.human.position)&&g.playerQTargetResolution(g.human.position).pointedLegalTarget){
                  g.followCamera();window.parkOpponent();window.searchBefore=g.furnitureSearchCount;return true;}
              }}return false;}),'legal furniture search approach');
          await tap('[data-touch-code="KeyE"]');await page.waitForFunction(()=>window.game.furnitureSearchCount>window.searchBefore);
        }else{
          await page.evaluate(()=>{const g=window.game,d=g.doorSystem.get(window.doorId);d.state='CLOSED';d.locked=false;g.syncDoor(d.id);});
          await tap('[data-touch-code="KeyQ"]');await page.waitForFunction(()=>window.game.doorSystem.get(window.doorId).state==='LOCKED');
          assert.equal(await page.locator('[data-touch-code="KeyQ"]').getAttribute('data-slots'),'2');
          assert(await page.evaluate(()=>{const g=window.game;
            for(const view of g.riceViews.values())for(const [dx,dz] of [[.6,0],[-.6,0],[0,.6],[0,-.6]]){
              const x=view.position.x+dx,z=view.position.z+dz;
              if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;g.player.position.x=x;g.player.position.z=z;g.followCamera();g.camera.updateMatrixWorld(true);
              const prompt=g.currentInteractionPrompt();if(prompt?.label==='吃米'&&!prompt.blocked){g.followCamera();window.parkOpponent();return true;}}
            return false;}),'legal rice approach');
          const e=await center('[data-touch-code="KeyE"]');await start(1,e.x,e.y);
          await page.waitForFunction(()=>window.game.rice.totalProgressMs>0);await end(1);
          assert(await page.evaluate(()=>{const g=window.game;
            for(const spot of g.hideSpots){const f=g.mapFurniture.find(f=>f.id===spot.furnitureId);if(!f)continue;
              for(let r=1;r<=3;r+=.5)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const x=f.x+Math.cos(angle)*r,z=f.z+Math.sin(angle)*r;
                if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;g.player.position.x=x;g.player.position.z=z;g.followCamera();g.camera.updateMatrixWorld(true);
                const prompt=g.currentInteractionPrompt();if(prompt?.label==='躲藏'&&!prompt.blocked){g.followCamera();window.parkOpponent();return true;}
              }}return false;}),'legal hide approach');
          await tap('[data-touch-code="KeyE"]');await page.waitForFunction(()=>window.game.hide.isConcealed('DEEPSEEK'));
          await tap('[data-touch-code="KeyE"]');await page.waitForFunction(()=>!window.game.hide.isConcealed('DEEPSEEK'));
        }
        await page.evaluate(()=>{const g=window.game;g.difficulty='HARD';g.applyDifficulty();const s=g.roomLights.switches[0],a=g.control.controlled(g.player,g.human);
          a.position.x=s.approach.x;a.position.z=s.approach.z;g.followCamera();window.parkOpponent();window.lightId=s.roomId;window.wasLit=g.roomLights.isOn(s.roomId);});
        await page.locator('[data-touch-code="KeyL"]').waitFor({state:'visible'});await tap('[data-touch-code="KeyL"]');
        await page.waitForFunction(()=>window.game.roomLights.isOn(window.lightId)!==window.wasLit);
        await page.locator('.mobile-pause').tap();await page.waitForFunction(()=>window.game.match.phase==='PAUSED');
        const paused=await page.evaluate(()=>window.game.match.elapsedMs);await page.waitForTimeout(120);
        assert.equal(await page.evaluate(()=>window.game.match.elapsedMs),paused);
        await page.getByRole('button',{name:'继续游戏',exact:true}).tap();await page.waitForFunction(()=>window.game.match.phase==='PLAYING');
        // Rotation clears input and pauses; returning to landscape does not auto-resume.
        await start(1,stick.x,stick.y);await move(1,stick.x+30,stick.y);await page.setViewportSize({width:viewport.height,height:viewport.width});fingers.clear();await dispatch('touchCancel');
        await page.waitForFunction(()=>window.game.match.phase==='PAUSED');
        assert(await page.locator('.mobile-rotate').isVisible());assert.deepEqual(await page.evaluate(()=>window.game.input.localDirection()),{x:0,y:0});
        await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>window.game.match.phase),'PAUSED');
        await page.getByRole('button',{name:'继续游戏',exact:true}).tap();await page.evaluate(()=>window.game.match.forceCapture());
        await page.waitForFunction(()=>window.game.match.phase==='FINISHED');
        await page.getByRole('button',{name:'再来一局',exact:true}).tap();await page.waitForFunction(()=>window.game.match.phase==='PLAYING');
        await page.locator('.mobile-pause').tap();
        await page.getByRole('button',{name:'返回主菜单',exact:true}).tap();await page.waitForFunction(()=>window.game.match.phase==='FACTION_SELECT');
        assert.deepEqual(errors,[]);
        results.push({channel,viewport,faction,checks:'movement/pickup/multitouch-throw/cancel/skills/doors/lights/capacity/pause/rotation/results/restart/menu',
          factionChecks:faction==='HUMAN'?'net-placement/V-capture/space-break/E-furniture/pulse-lock':'sprint/lock-door/hold-to-eat/hide-enter-exit',
          dpr:layout.dpr,model:await page.evaluate(()=>window.game.startupReadiness.model)});
        console.log(JSON.stringify(results.at(-1)));
      }
      await context.close();
    }
    const desktop=await browser.newContext({viewport:{width:1280,height:720},hasTouch:false});
    const page=await desktop.newPage();await page.route(origin+'/__mobile_check__*',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto(origin+'/__mobile_check__');await page.waitForFunction(()=>window.game?.startupReadiness.canStart);
    await page.locator('.startup-view').waitFor({state:'detached'});
    await page.locator('.faction-card[data-faction="HUMAN"]').click();
    if(await page.locator('.controls-help').isVisible())await page.locator('.controls-help-close').click();
    await page.waitForFunction(()=>window.game.match.phase==='PLAYING');
    assert.equal(await page.locator('.mobile-controls').isVisible(),false);
    assert.equal(await page.locator('.mobile-rotate').isVisible(),false);
    assert(await page.locator('.alpha-skills').isVisible());
    await page.keyboard.down('d');assert.equal(await page.evaluate(()=>window.game.input.localDirection().x),1);
    await page.keyboard.up('d');assert.deepEqual(await page.evaluate(()=>window.game.input.localDirection()),{x:0,y:0});
    assert(await page.evaluate(()=>{const g=window.game;for(const view of g.doorViews.values()){const d=view.definition;for(const side of [-1,1]){
      const x=d.x+Math.sin(d.rotation)*side*.85,z=d.z+Math.cos(d.rotation)*side*.85;if(!g.collision.canOccupyStaticXZ(x,z,.3,.7))continue;
      g.human.position.x=x;g.human.position.z=z;if(g.nearestInteractableDoor(g.human.position)?.door.id!==d.id)continue;
      const state=g.doorSystem.get(d.id);state.state='CLOSED';state.locked=false;g.syncDoor(d.id);g.followCamera();window.doorId=d.id;window.parkOpponent();return true;}}return false;}));
    await page.keyboard.press('e');await page.waitForFunction(()=>window.game.doorSystem.get(window.doorId).state==='OPEN');
    await page.evaluate(()=>{const g=window.game,a=g.human,item=g.throwables.items.find(i=>i.kind==='BASIN');item.state='GROUND';item.holder=null;item.readyAt=0;item.x=a.position.x;item.z=a.position.z;window.propId=item.id;});
    await page.keyboard.press('f');await page.waitForFunction(()=>!!window.game.throwables.held('HUMAN'));
    const desktopTarget=await page.evaluate(()=>{const g=window.game,a=g.human.position;for(const dx of [-2,-1,1,2])for(const dz of [-2,-1,1,2]){
      const p={x:a.x+dx,z:a.z+dz};if(g.traceThrow(a,p,.12)!==null)continue;const v=new window.THREE.Vector3(p.x,0,p.z).project(g.camera),x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;
      if(x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)===g.renderer.domElement)return{x,y};}return null;});
    assert(desktopTarget);await page.mouse.move(desktopTarget.x,desktopTarget.y);await page.mouse.down();
    assert.equal(await page.evaluate(()=>window.game.throwableView.aiming),'HUMAN');await page.waitForTimeout(40);await page.mouse.up();
    await page.waitForFunction(()=>window.game.throwables.items.find(i=>i.id===window.propId).remainingThrows===2);
    await page.screenshot({path:join(artifacts,channel+'-desktop-keyboard-mouse.png')});
    results.push({channel,desktop:true,touchUIHidden:true,keyboard:true,eDoor:true,mouseThrow:true});await desktop.close();
  } finally { await browser.close(); }
}
await writeFile(join(artifacts,'results.json'),JSON.stringify({passed:results.length,artifacts,results},null,2));
console.log(JSON.stringify({passed:results.length,artifacts,results},null,2));
