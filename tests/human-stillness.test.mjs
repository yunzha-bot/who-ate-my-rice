import test from 'node:test';
import assert from 'node:assert/strict';
import { HumanStillness } from '../src/systems/HumanStillness.ts';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const human = { x: 8, z: 0 };
const rice = { id: 'rice-a', x: 0, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const nav = {
  nearestFree: point => ({ ...point }),
  findPath: (from, to) => [{ ...from, doorId: null }, { ...to, doorId: null }],
};
const aiInput = (clock, visible, extra = {}) => ({
  deltaMs: 50, deepseek: { x: 0, z: 0 }, rice: [rice], doors: [],
  canOpenDoor: () => true, sprintState: 'NORMAL',
  visibleHuman: visible ? human : null,
  humanStillMs: visible ? clock.stillMs : undefined,
  humanStillEventId: visible ? clock.eventId : undefined,
  ...extra,
});

test('Human stationary time is independent of visibility, tolerates jitter, freezes and resets', () => {
  const clock = new HumanStillness(human);
  clock.update(human, 8_000); // Human may be completely hidden this whole time.
  assert.equal(clock.stillMs, 8_000);
  clock.update({ x: human.x + C.deepseekAI.curiosityMovementEpsilon / 2, z: 0 }, 200);
  assert.equal(clock.stillMs, 8_200);
  const event = clock.eventId;
  // PAUSED: gameplay does not call update.
  assert.equal(clock.stillMs, 8_200);
  clock.update({ x: human.x + C.deepseekAI.curiosityMovementEpsilon * 2, z: 0 }, 0);
  assert.equal(clock.eventId, event + 1);
  assert.equal(clock.stillMs, 0);
  clock.reset(human);
  assert.equal(clock.eventId, 0);
  assert.equal(clock.stillMs, 0);
});

test('eight seconds hidden and only 0.2 seconds visible qualifies without a fresh five-second watch', () => {
  const clock = new HumanStillness(human);
  clock.update(human, 8_000);
  let rolls = 0;
  const ai = new DeepSeekAIController(nav, [], [], () => { rolls++; return 0; });
  for (let frame = 0; frame < 4; frame++) {
    clock.update(human, 50);
    ai.update(aiInput(clock, true));
  }
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  assert.equal(rolls, 1);
  assert.equal(ai.curiosityStillMs, 8_200);
});

test('los changes do not repeat a failed draw; real movement starts a new event', () => {
  const clock = new HumanStillness(human);
  clock.update(human, 8_000);
  let rolls = 0;
  const ai = new DeepSeekAIController(nav, [], [], () => { rolls++; return 0.9; });
  ai.update(aiInput(clock, true));
  assert.equal(rolls, 1);
  for (let frame = 0; frame < 4; frame++) {
    clock.update(human, 50);
    ai.update(aiInput(clock, false));
    ai.update(aiInput(clock, true));
  }
  assert.equal(rolls, 1);
  const moved = { x: human.x + C.deepseekAI.curiosityMovementEpsilon * 2, z: 0 };
  clock.update(moved, 0);
  ai.update(aiInput(clock, true, { visibleHuman: moved }));
  assert.equal(ai.curiosityStillMs, 0);
  assert.equal(rolls, 1);
  clock.update(moved, C.deepseekAI.curiosityStillMs);
  ai.update(aiInput(clock, true, { visibleHuman: moved }));
  assert.equal(rolls, 2);
});
