import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEBUG_CATEGORY_DEFINITIONS,
  DEFAULT_EXPANDED_DEBUG_CATEGORIES,
  escapeCandidateProperties,
  filterDebugCategories,
} from '../src/three/DebugDetailsPanel.ts';

test('Details panel includes the collapsible escape-door category and keeps defaults', () => {
  assert.deepEqual(DEBUG_CATEGORY_DEFINITIONS.map(({ id }) => id), [
    'human-ai', 'deepseek-ai', 'threat-escape', 'door-escape', 'door-lock',
    'sprint', 'safe-wait', 'curiosity-passage', 'animation', 'dev-freeze', 'other',
  ]);
  assert.deepEqual(DEFAULT_EXPANDED_DEBUG_CATEGORIES, [
    'deepseek-ai', 'safe-wait', 'curiosity-passage',
  ]);
});

test('search filters property names, values, and preserves matching category', () => {
  const categories = [
    { id: 'deepseek-ai', title: 'DeepSeek AI', properties: [
      { key: 'state', label: '当前状态', value: 'SEEK_RICE' },
      { key: 'target', label: '目标米堆', value: 'rice_06' },
    ] },
    { id: 'safe-wait', title: 'SAFE_WAIT', properties: [
      { key: 'active', label: '是否激活', value: '进行中' },
    ] },
  ];

  assert.deepEqual(filterDebugCategories(categories, 'rice_06').map(category => ({
    id: category.id,
    keys: category.properties.map(property => property.key),
  })), [{ id: 'deepseek-ai', keys: ['target'] }]);
  assert.deepEqual(filterDebugCategories(categories, '当前状态').map(category => category.id), [
    'deepseek-ai',
  ]);
  assert.equal(filterDebugCategories(categories, '').length, 2);
});

test('candidate score arrays become nested searchable property rows', () => {
  const rows = escapeCandidateProperties([{
    roomId: 'living-room', score: 12.5, routeLength: 8.2, exits: 2,
    covered: true, blockedExit: false, alternateRoute: true, recentVisitPenalty: 3,
  }]);

  assert.equal(rows[0].label, 'living-room');
  assert.equal(rows[0].children.length, 7);
  const categories = [{ id: 'threat-escape', title: 'Threat / Escape', properties: rows }];
  assert.equal(filterDebugCategories(categories, '路线长度')[0].properties[0].children[0].label,
    '路线长度');
  assert.equal(filterDebugCategories(categories, 'living-room').length, 1);
});
