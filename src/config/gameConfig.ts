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
  wallColor: 0x4e5359,
  walls: [
    { x: 300, y: 220, width: 320, height: 32 },
    { x: 620, y: 390, width: 32, height: 290 },
    { x: 790, y: 165, width: 220, height: 32 },
  ],
} as const;
