import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { SkillCooldown } from '../src/systems/SkillCooldown.ts';
import { deepseekLockGate, humanSearchGate, lockArmsPlayerCooldown,
  resolveQSkill } from '../src/systems/SkillGates.ts';

// S7C-1B：两个 Q 技能的冷却与门禁规则。
test('冷却：初始可用，arm 后进入冷却，到期恢复', () => {
  const cooldown = new SkillCooldown(12_000);
  assert.equal(cooldown.ready, true);
  assert.equal(cooldown.state, 'READY');
  assert.equal(cooldown.remainingMs, 0);
  cooldown.arm();
  assert.equal(cooldown.ready, false);
  assert.equal(cooldown.state, 'COOLDOWN');
  assert.equal(cooldown.remainingMs, 12_000);
  cooldown.advance(11_999);
  assert.equal(cooldown.ready, false);
  cooldown.advance(1);
  assert.equal(cooldown.ready, true);
  assert.equal(cooldown.remainingMs, 0);
  assert.equal(cooldown.armCount, 1);
});

test('冷却只随传入的 delta 推进：暂停与 DEV 冻结期间不会自己走时间', () => {
  // 玩法时间由 ThreeGame 的 gameplayDelta 提供；冻结/暂停时该值为 0，所以冷却
  // 只能靠显式 advance 前进。源码里不允许出现自己的时钟读数。
  const source = readFileSync(
    new URL('../src/systems/SkillCooldown.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now|performance\.now|setTimeout|setInterval/,
    'SkillCooldown 不得自带时钟');
  const cooldown = new SkillCooldown(1_000);
  cooldown.arm();
  cooldown.advance(0);
  assert.equal(cooldown.remainingMs, 1_000, 'delta 为 0 时（暂停/冻结）不推进');
  cooldown.advance(400);
  cooldown.advance(400);
  assert.equal(cooldown.remainingMs, 200, '推进必须由外部时间驱动且可重复');
});

test('reset 清空本局冷却（重开/返回阵营页不遗留状态）', () => {
  const cooldown = new SkillCooldown(20_000);
  cooldown.arm();
  cooldown.advance(5_000);
  cooldown.reset();
  assert.equal(cooldown.ready, true);
  assert.equal(cooldown.remainingMs, 0);
  assert.equal(cooldown.armCount, 0);
});

test('同一个 Q 键在不同阵营下只映射到一个技能，不互相覆盖', () => {
  assert.equal(resolveQSkill('DEEPSEEK'), 'LOCK_DOOR');
  assert.equal(resolveQSkill('HUMAN'), 'FAN_SEARCH');
  assert.equal(resolveQSkill(null), 'NONE');
  // 返回值是单个字符串：不存在「一次按键拿到两个技能」的可能。
  for (const faction of ['DEEPSEEK', 'HUMAN', null]) {
    assert.equal(typeof resolveQSkill(faction), 'string');
  }
});

test('Human Q：不在冷却就允许释放；冷却中给出剩余秒数', () => {
  assert.deepEqual(humanSearchGate({ ready: true, remainingSeconds: 0 }),
    { ok: true, message: null });
  const blocked = humanSearchGate({ ready: false, remainingSeconds: 8.44 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /搜查冷却中：剩 8\.4 秒/);
});

test('DeepSeek Q：藏身中禁止锁门，冷却中禁止重复锁门', () => {
  const concealed = deepseekLockGate({ concealed: true, ready: true, remainingSeconds: 0 });
  assert.equal(concealed.ok, false);
  assert.match(concealed.message, /藏身中不能锁门/);
  const cooling = deepseekLockGate({ concealed: false, ready: false, remainingSeconds: 19.55 });
  assert.equal(cooling.ok, false);
  assert.match(cooling.message, /锁门冷却中：剩 19\.6 秒/);
  assert.deepEqual(deepseekLockGate({ concealed: false, ready: true, remainingSeconds: 0 }),
    { ok: true, message: null });
});

test('只有锁门成功才开始 20 秒冷却，失败不消耗', () => {
  assert.equal(GAME_CONFIG.door.playerLockCooldownMs, 20_000);
  assert.equal(lockArmsPlayerCooldown('LOCKED'), true);
  for (const failure of ['INVALID_STATE', 'OUT_OF_RANGE', 'LOCK_LIMIT_REACHED',
    'LOCK_CORE_DISABLED', 'NOT_FOUND', 'NOT_ALLOWED']) {
    assert.equal(lockArmsPlayerCooldown(failure), false, `${failure} 不应消耗冷却`);
  }

  // 与规则组合一次：失败保持可用，成功后进入 20 秒冷却。
  const cooldown = new SkillCooldown(GAME_CONFIG.door.playerLockCooldownMs);
  for (const failure of ['INVALID_STATE', 'OUT_OF_RANGE']) {
    if (lockArmsPlayerCooldown(failure)) cooldown.arm();
  }
  assert.equal(cooldown.ready, true);
  if (lockArmsPlayerCooldown('LOCKED')) cooldown.arm();
  assert.equal(cooldown.remainingSeconds, 20);
});
