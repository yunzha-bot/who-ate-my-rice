import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { RiceSystem } from '../systems/RiceSystem';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private riceSystem!: RiceSystem;
  private riceLabel!: Phaser.GameObjects.Text;
  private pauseLabel!: Phaser.GameObjects.Text;
  private paused = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height, player: playerConfig, rice: riceConfig, walls } = GAME_CONFIG;

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

    this.add
      .rectangle(riceConfig.x, riceConfig.y, riceConfig.size, riceConfig.size, riceConfig.color)
      .setStrokeStyle(2, 0x846d43);
    this.add.text(riceConfig.x, riceConfig.y - 32, '大米', {
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '18px',
    }).setOrigin(0.5);
    this.riceSystem = new RiceSystem(
      riceConfig.id,
      riceConfig.maxProgressMs,
      riceConfig.prepareMs,
    );

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
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
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

    this.riceLabel = this.add.text(width - 16, 16, '', {
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      backgroundColor: '#30343a',
      padding: { x: 10, y: 8 },
    }).setOrigin(1, 0).setDepth(5);
    this.updateRiceLabel(false);
  }

  update(_time: number, deltaMs: number): void {
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

    const riceConfig = GAME_CONFIG.rice;
    const inRange = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      riceConfig.x,
      riceConfig.y,
    ) <= riceConfig.interactionRange;
    this.riceSystem.update(deltaMs, this.interactKey.isDown && inRange && direction.lengthSq() === 0);
    this.updateRiceLabel(inRange);
  }

  private updateRiceLabel(inRange: boolean): void {
    const rice = this.riceSystem.rice;
    const states = {
      IDLE: '未交互',
      PREPARING: '准备中',
      EATING: '进食中',
      INTERRUPTED: '已中断',
      COMPLETED: '已完成',
    };
    const hint = rice.completed ? '已吃完' : inRange ? '按住 E 进食，移动可中断' : '靠近大米后按住 E';
    this.riceLabel.setText(
      `大米进度：${(rice.progressMs / 1000).toFixed(1)} / ${(rice.maxProgressMs / 1000).toFixed(1)} 秒\n` +
      `状态：${states[rice.interactionState]}\n${hint}`,
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
      this.riceSystem.interrupt();
      this.updateRiceLabel(false);
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
