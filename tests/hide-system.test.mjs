import assert from 'node:assert/strict';
import test from 'node:test';
import { HideSystem } from '../src/systems/HideSystem.ts';

// S7C-1B：藏身状态机是纯逻辑，进入是「点按即切换」——没有 ENTERING 计时，也没有
// 独立的 Human 距离门槛；所有几何合法性都由调用方用既有接口算好后传进来。
const enterContext = (overrides = {}) => ({
  phase: 'PLAYING',
  faction: 'DEEPSEEK',
  playerControlled: true,
  position: { x: -14.4, z: -6.15 },
  spotId: 'hide_main_bed',
  spotCode: 'LEGAL',
  spotLegal: true,
  captureProgressMs: 0,
  sprintState: 'NORMAL',
  ...overrides,
});

test('E 点按立即藏身：进入位置就是退出位置，事件可被 drain', () => {
  const hide = new HideSystem();
  const result = hide.enter(enterContext());
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ENTERED');
  assert.equal(hide.state, 'CONCEALED');
  assert.equal(hide.spotId, 'hide_main_bed');
  assert.deepEqual(hide.entryPosition, { x: -14.4, z: -6.15 });
  assert.equal(hide.isConcealed('DEEPSEEK'), true);
  assert.equal(hide.isConcealed('HUMAN'), false);
  assert.equal(hide.enterCount, 1);
  assert.deepEqual(hide.drainEvents(), [
    { type: 'HIDE_ENTER', reason: 'hide_main_bed', spotId: 'hide_main_bed' },
  ]);
  assert.deepEqual(hide.drainEvents(), []);
});

test('藏身进入的每条拒绝路径都在同一处判定，且不改变藏身状态', () => {
  const cases = [
    ['NOT_PLAYING', { phase: 'READY' }],
    ['WRONG_FACTION', { faction: 'HUMAN' }],
    ['NOT_PLAYER_CONTROLLED', { playerControlled: false }],
    ['STUNNED', { sprintState: 'STUNNED' }],
    ['SPRINT_ACTIVE', { sprintState: 'SPRINT_RUNNING' }],
    ['CAPTURE_IN_PROGRESS', { captureProgressMs: 1 }],
    ['NO_HIDE_SPOT', { spotId: null }],
    ['POSITION_ILLEGAL', { spotLegal: false, spotCode: 'SURFACE_BLOCKED' }],
  ];
  for (const [code, overrides] of cases) {
    const hide = new HideSystem();
    const result = hide.enter(enterContext(overrides));
    assert.equal(result.ok, false, code);
    assert.equal(result.code, code);
    assert.equal(hide.state, 'OUTSIDE', `${code} 不得改变藏身状态`);
    assert.equal(hide.enterCount, 0);
    assert.equal(hide.rejectCount, 1);
    assert.match(hide.lastRejectReason, new RegExp(code));
    assert.deepEqual(hide.drainEvents().map(event => event.type), ['HIDE_REJECT']);
  }
});

test('已经在藏身中时再按 E 进入会被拒绝，且不会换到另一个点', () => {
  const hide = new HideSystem();
  hide.enter(enterContext());
  const again = hide.enter(enterContext({ spotId: 'hide_main_wardrobe' }));
  assert.equal(again.code, 'ALREADY_CONCEALED');
  assert.equal(hide.spotId, 'hide_main_bed');
  assert.equal(hide.enterCount, 1);
});

test('退出：点按 E 成功；与 Human 碰撞圆重叠时拒绝并保持藏身', () => {
  const hide = new HideSystem();
  hide.enter(enterContext());
  const blocked = hide.exit('PLAYER_E', { humanOverlap: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'HUMAN_BLOCKING');
  // 关键安全断言：退出被拒绝不能把藏身状态丢掉。
  assert.equal(hide.state, 'CONCEALED');
  assert.equal(hide.spotId, 'hide_main_bed');
  assert.equal(hide.exitCount, 0);

  const ok = hide.exit('PLAYER_E');
  assert.equal(ok.ok, true);
  assert.equal(hide.state, 'OUTSIDE');
  assert.equal(hide.spotId, null);
  assert.equal(hide.entryPosition, null);
  assert.equal(hide.exitCount, 1);
  assert.equal(hide.lastExitReason, 'PLAYER_E');
  assert.deepEqual(hide.drainEvents().map(event => event.type),
    ['HIDE_ENTER', 'HIDE_EXIT']);
  assert.equal(hide.exit('PLAYER_E').code, 'NOT_CONCEALED');
});

test('非重叠时即使处于常规抓捕半径内也允许退出（判定只接收 humanOverlap）', () => {
  const hide = new HideSystem();
  hide.enter(enterContext());
  assert.equal(hide.exit('PLAYER_E', { humanOverlap: false }).ok, true);
  assert.equal(hide.state, 'OUTSIDE');
});

test('搜查命中与强制清空的退出原因可以区分', () => {
  const hide = new HideSystem();
  hide.enter(enterContext());
  assert.equal(hide.forcedExit('SEARCHED').ok, true);
  assert.equal(hide.lastExitReason, 'SEARCHED');
  assert.equal(hide.state, 'OUTSIDE');
  assert.equal(hide.forcedExit('ROUND_RESET').ok, false);
});

test('occupancyOf 只在藏身时给出占用者，未使用的点永远为 null', () => {
  const hide = new HideSystem();
  assert.equal(hide.occupancyOf('hide_main_bed'), null);
  hide.enter(enterContext());
  assert.equal(hide.occupancyOf('hide_main_bed'), 'DEEPSEEK');
  assert.equal(hide.occupancyOf('hide_closet'), null);
  hide.forcedExit('ROUND_RESET');
  assert.equal(hide.occupancyOf('hide_main_bed'), null);
});

test('新局 reset 清空状态、计数与事件（不留下异常免疫或输入锁定）', () => {
  const hide = new HideSystem();
  hide.enter(enterContext());
  hide.enter(enterContext());
  hide.exit('PLAYER_E');
  hide.reset();
  assert.equal(hide.state, 'OUTSIDE');
  assert.equal(hide.spotId, null);
  assert.equal(hide.concealedFaction, null);
  assert.equal(hide.entryPosition, null);
  assert.equal(hide.enterCount, 0);
  assert.equal(hide.exitCount, 0);
  assert.equal(hide.rejectCount, 0);
  assert.equal(hide.lastRejectReason, '无');
  assert.equal(hide.lastExitReason, '无');
  assert.deepEqual(hide.drainEvents(), []);
});
