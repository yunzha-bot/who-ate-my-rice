import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private pauseLabel!: Phaser.GameObjects.Text;
  private paused = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height, player: playerConfig, walls } = GAME_CONFIG;

    this.cameras.main.setBounds(0, 0, width, height);
    this.physics.world.setBounds(0, 0, width, height);

    this.createSolidTexture('player-square', playerConfig.color, playerConfig.size);
    this.createSolidTexture('wall-square', GAME_CONFIG.wallColor);

    this.player = this.physics.add.sprite(
      playerConfig.x,
      playerConfig.y,
      'player-square',
    );
    this.player.setCollideWorldBounds(true);

    for (const wallConfig of walls) {
      const wall = this.physics.add.staticImage(
        wallConfig.x,
        wallConfig.y,
        'wall-square',
      );
      wall.setDisplaySize(wallConfig.width, wallConfig.height);
      wall.refreshBody();
      this.physics.add.collider(this.player, wall);
    }

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    window.addEventListener('keydown', this.handleEscape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.handleEscape);
    });

    this.pauseLabel = this.add
      .text(width / 2, height / 2, '已暂停 · 按 Esc 继续', {
        color: '#ffffff',
        fontFamily: 'sans-serif',
        fontSize: '28px',
        backgroundColor: '#30343a',
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(10);
  }

  update(): void {
    if (this.paused) return;

    const horizontal = Number(this.cursors.right.isDown || this.wasd.D.isDown)
      - Number(this.cursors.left.isDown || this.wasd.A.isDown);
    const vertical = Number(this.cursors.down.isDown || this.wasd.S.isDown)
      - Number(this.cursors.up.isDown || this.wasd.W.isDown);
    const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize();

    this.player.setVelocity(
      direction.x * GAME_CONFIG.player.speed,
      direction.y * GAME_CONFIG.player.speed,
    );
  }

  private createSolidTexture(key: string, color: number, size = 1): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseLabel.setVisible(this.paused);

    if (this.paused) {
      this.player.setVelocity(0, 0);
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
  }

  private handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.repeat) return;
    event.preventDefault();
    this.togglePause();
  };
}
