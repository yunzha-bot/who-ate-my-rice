import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyBindings,DEFAULT_KEY_BINDINGS,KEY_BINDINGS_STORAGE_KEY,formatBindingText} from '../src/three/KeyBindings.ts';
import {InputManager} from '../src/three/InputManager.ts';

test('bindings keep defaults and fixed Escape/arrow movement; duplicate/reserved assignments do not mutate',()=>{
 const b=new KeyBindings(null);
 assert.deepEqual(b.values,DEFAULT_KEY_BINDINGS);
 const before={...b.values};
 for(const code of ['KeyQ','Escape','Tab','ArrowUp','F5','MetaLeft','ControlLeft',''])assert(b.assign('KeyE',code));
 assert.deepEqual(b.values,before);
 assert.equal(b.actionFor('Escape'),'Escape');assert.equal(b.actionFor('ArrowUp'),'KeyW');
});

test('rebinding disables old physical key, translates new one, and safely permits a released key to be reassigned',()=>{
 const b=new KeyBindings(null);
 assert.equal(b.assign('KeyE','KeyG'),null);
 assert.equal(b.actionFor('KeyG'),'KeyE');assert.equal(b.actionFor('KeyE'),null);
 assert.equal(b.assign('KeyF','KeyE'),null);
 assert.equal(b.actionFor('KeyE'),'KeyF');
 b.reset();assert.deepEqual(b.values,DEFAULT_KEY_BINDINGS);
});

test('valid preferences persist; malformed, partial or conflicting storage falls back to defaults',()=>{
 let value=null;
 const storage={getItem:()=>value,setItem:(key,v)=>{assert.equal(key,KEY_BINDINGS_STORAGE_KEY);value=v;}};
 const b=new KeyBindings(storage);b.assign('Space','ShiftLeft');assert(b.save());
 assert.equal(new KeyBindings(storage).values.Space,'ShiftLeft');
 for(const invalid of ['broken',JSON.stringify({version:1,bindings:{KeyE:'KeyG'}}),
  JSON.stringify({version:1,bindings:{...DEFAULT_KEY_BINDINGS,KeyE:'KeyQ'}}),
  JSON.stringify({version:1,bindings:{...DEFAULT_KEY_BINDINGS,KeyE:'Escape'}})]){
  value=invalid;assert.deepEqual(new KeyBindings(storage).values,DEFAULT_KEY_BINDINGS);
 }
});

test('blocked storage leaves current-session bindings usable and reports saving failure',()=>{
 const b=new KeyBindings({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});
 assert.equal(b.assign('KeyE','KeyG'),null);assert.equal(b.save(),false);
 assert.equal(b.actionFor('KeyG'),'KeyE');
});

test('HUD/help display replacement is one-pass and follows reassigned positions',()=>{
 const b=new KeyBindings(null);b.assign('KeyE','KeyG');b.assign('KeyQ','KeyE');b.assign('Space','ShiftLeft');
 assert.equal(b.text('E 交互 · Q 布网 · Space 强破'),'G 交互 · E 布网 · 左 Shift 强破');
 assert.equal(formatBindingText('DeepSeek / Human / WASD'),'DeepSeek / Human / WASD');
});

test('real input maps press/hold/release, preserves touch action codes and multiple movement sources',()=>{
 const previous=globalThis.window;globalThis.window=new EventTarget();
 const b=new KeyBindings(null);b.assign('KeyE','KeyG');b.assign('KeyW','KeyT');
 const input=new InputManager(b);
 const down=(code,repeat=false)=>input.onKeyDown({code,repeat,preventDefault(){}});
 const up=code=>input.onKeyUp({code});
 try{
  down('KeyE');assert.equal(input.isHeld('KeyE'),false);
  input.onKeyDown({code:'KeyG',ctrlKey:true,repeat:false,preventDefault(){assert.fail('browser shortcut blocked');}});
  assert.equal(input.isHeld('KeyE'),false);
  input.onKeyDown({code:'KeyG',target:{tagName:'INPUT'},repeat:false,preventDefault(){assert.fail('typing blocked');}});
  assert.equal(input.isHeld('KeyE'),false);
  down('KeyG');assert(input.consumePress('KeyE'));assert(input.isHeld('KeyE'));
  down('KeyG',true);assert.equal(input.consumePress('KeyE'),false);up('KeyG');assert.equal(input.isHeld('KeyE'),false);
  input.setTouchHeld('KeyE',true);assert(input.consumePress('KeyE'));assert(input.isHeld('KeyE'));input.setTouchHeld('KeyE',false);
  down('KeyT');down('ArrowUp');up('KeyT');assert.deepEqual(input.localDirection(),{x:0,y:-1});
  up('ArrowUp');assert.deepEqual(input.localDirection(),{x:0,y:0});
  down('KeyG');input.clear();assert.equal(input.isHeld('KeyE'),false);assert.equal(input.consumePress('KeyE'),false);
 }finally{input.dispose();globalThis.window=previous;}
});
