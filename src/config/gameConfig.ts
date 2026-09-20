export const GAME_CONFIG = {
  width: 960,
  height: 600,
  backgroundColor: '#858b91',
  player: {
    x: 120,
    y: 120,
    size: 32,
    speed: 230,
    color: 0x3197ff,
  },
  rice: {
    id: 'rice-1',
    x: 450,
    y: 420,
    size: 30,
    color: 0xf2e5bc,
    interactionRange: 60,
    prepareMs: 400,
    maxProgressMs: 60_000,
  },
  wallColor: 0x4e5359,
  walls: [
    { x: 300, y: 220, width: 320, height: 32 },
    { x: 620, y: 390, width: 32, height: 290 },
    { x: 790, y: 165, width: 220, height: 32 },
  ],
} as const;
