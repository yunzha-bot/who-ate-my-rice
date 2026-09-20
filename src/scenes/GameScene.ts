import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { GameStateSystem } from '../systems/GameStateSystem';
import { RiceSystem } from '../systems/RiceSystem';
import { SprintSystem } from '../systems/SprintSystem';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private human!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private ijkl!: Record<'I' | 'J' | 'K' | 'L', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private sprintKey!: Phaser.Input.Keyboard.Key;
  private riceSystem!: RiceSystem;
  private sprint!: SprintSystem;
  private match!: GameStateSystem;
  private riceLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private pauseLabel!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height, player: playerConfig, human: humanConfig, rice: riceConfig, walls } = GAME_CONFIG;

    this.match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs);
    this.sprint = new SprintSystem(
      GAME_CONFIG.sprint.durationMs,
      GAME_CONFIG.sprint.riskThreshold,
      GAME_CONFIG.sprint.stunMs,
    );

    this.cameras.main.setBounds(0, 0, width, height);
    this.physics.world.setBounds(0, 0, width, height);

    this.createSolidTexture('player-square', playerConfig.color, playerConfig.size);
    this.createSolidTexture('human-square', humanConfig.color, humanConfig.size);
    this.createSolidTexture('wall-square', GAME_CONFIG.wallColor);

    this.player = this.physics.add.sprite(
      playerConfig.x,
      playerConfig.y,
      'player-square',
    );
    this.player.setCollideWorldBounds(true);
    this.human = this.physics.add.sprite(humanConfig.x, humanConfig.y, 'human-square');
    this.human.setCollideWorldBounds(true);
    this.add.text(humanConfig.x, humanConfig.y - 32, '人类：IJKL', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '15px',
    }).setOrigin(0.5);

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
      this.physics.add.collider(this.human, wall);
    }

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.ijkl = this.input.keyboard!.addKeys('I,J,K,L') as typeof this.ijkl;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.sprintKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.handleGlobalKeyDown);
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

    this.resultLabel = this.add
      .text(width / 2, height / 2, '', {
        color: '#ffffff', fontFamily: 'sans-serif', fontSize: '26px',
        backgroundColor: '#30343a', align: 'center', padding: { x: 24, y: 18 },
      })
      .setOrigin(0.5).setVisible(false).setDepth(11);

    this.statusLabel = this.add.text(16, height - 16, '', {
      color: '#ffffff', fontFamily: 'sans-serif', fontSize: '16px',
      backgroundColor: '#30343a', padding: { x: 10, y: 8 },
    }).setOrigin(0, 1).setDepth(5);

    this.riceLabel = this.add.text(width - 16, 16, '', {
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '20px',
      backgroundColor: '#30343a',
      padding: { x: 10, y: 8 },
    }).setOrigin(1, 0).setDepth(5);
    this.updateRiceLabel(false);
    this.updateStatusLabel();
  }

  update(_time: number, deltaMs: number): void {
    const sprintPressed = Phaser.Input.Keyboard.JustDown(this.sprintKey);
    if (this.match.phase === 'READY') {
      this.match.advanceReady(deltaMs);
      this.updateStatusLabel();
      return;
    }
    if (this.match.phase !== 'PLAYING') return;

    const horizontal = Number(this.cursors.right.isDown || this.wasd.D.isDown)
      - Number(this.cursors.left.isDown || this.wasd.A.isDown);
    const vertical = Number(this.cursors.down.isDown || this.wasd.S.isDown)
      - Number(this.cursors.up.isDown || this.wasd.W.isDown);
    const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize();

    // S4 uses the one test rice as the temporary global progress ratio.
    const riceProgressRatio = this.riceSystem.rice.progressMs / this.riceSystem.rice.maxProgressMs;
    if (sprintPressed) {
      this.sprint.tryStart(direction, riceProgressRatio);
    }
    this.sprint.advance(deltaMs, direction);
    const playerDirection = this.sprint.movementDirection(direction);
    const playerSpeed = GAME_CONFIG.player.speed *
      (this.sprint.state === 'SPRINT_RUNNING' ? GAME_CONFIG.sprint.speedMultiplier : 1);

    this.player.setVelocity(
      playerDirection.x * playerSpeed,
      playerDirection.y * playerSpeed,
    );
    this.player.setAngle(this.sprint.state === 'STUNNED' ? 90 : 0);
    if (this.sprint.state === 'STUNNED') this.player.setTint(0xff7777);
    else this.player.clearTint();

    const humanHorizontal = Number(this.ijkl.L.isDown) - Number(this.ijkl.J.isDown);
    const humanVertical = Number(this.ijkl.K.isDown) - Number(this.ijkl.I.isDown);
    const humanDirection = new Phaser.Math.Vector2(humanHorizontal, humanVertical).normalize();
    this.human.setVelocity(
      humanDirection.x * GAME_CONFIG.player.speed * GAME_CONFIG.human.speedMultiplier,
      humanDirection.y * GAME_CONFIG.player.speed * GAME_CONFIG.human.speedMultiplier,
    );

    const riceConfig = GAME_CONFIG.rice;
    const inRange = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      riceConfig.x,
      riceConfig.y,
    ) <= riceConfig.interactionRange;
    this.riceSystem.update(
      deltaMs,
      this.sprint.state === 'NORMAL' && this.interactKey.isDown && inRange && direction.lengthSq() === 0,
    );
    const inCaptureRange = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.human.x, this.human.y,
    ) <= GAME_CONFIG.match.captureRange;
    this.match.advancePlaying(deltaMs, inCaptureRange, this.riceSystem.rice.completed);
    if (this.match.result) this.finishMatch();
    this.updateRiceLabel(inRange);
    this.updateStatusLabel();
  }

  private updateStatusLabel(): void {
    const phase = this.match.phase;
    const phaseText = phase === 'READY'
      ? `准备：${Math.ceil(this.match.readyRemainingMs / 1000)} 秒`
      : phase === 'PLAYING' ? '对局中' : phase === 'PAUSED' ? '已暂停' : '已结束';
    const riceRatio = this.riceSystem.rice.progressMs / this.riceSystem.rice.maxProgressMs;
    const currentRisk = this.sprint.state === 'NORMAL'
      ? riceRatio >= GAME_CONFIG.sprint.riskThreshold ? 'RISK SPRINT' : 'SAFE SPRINT'
      : this.sprint.riskMode === 'FALL_ON_END' ? 'RISK SPRINT' : 'SAFE SPRINT';
    this.statusLabel.setText(
      `${phaseText}  时间：${this.formatTime(this.match.elapsedMs)}\n` +
      `蓝色 WASD/方向键 + E；移动时点 Space 冲刺｜橙色 IJKL\n` +
      `抓捕：${(this.match.captureProgressMs / 1000).toFixed(2)} / ${(GAME_CONFIG.match.captureMs / 1000).toFixed(2)} 秒\n` +
      `状态：${this.sprint.state}  米总进度：${Math.round(riceRatio * 100)}%\n` +
      `${currentRisk}  冲刺剩余：${(this.sprint.sprintRemainingMs / 1000).toFixed(1)} 秒\n` +
      `结束摔倒：${this.sprint.riskMode === 'FALL_ON_END' ? 'YES' : 'NO'}  眩晕剩余：${(this.sprint.stunRemainingMs / 1000).toFixed(1)} 秒`,
    );
  }

  private formatTime(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:` +
      `${String(totalSeconds % 60).padStart(2, '0')}`;
  }

  private finishMatch(): void {
    this.player.setVelocity(0, 0);
    this.human.setVelocity(0, 0);
    this.riceSystem.interrupt();
    const result = this.match.result!;
    this.resultLabel.setText(
      `${result.winner === 'DEEPSEEK' ? 'DeepSeek 娘' : '人类'}获胜\n` +
      `原因：${result.reason === 'RICE_COMPLETED' ? '测试大米完成' : '抓捕完成'}\n` +
      `对局时间：${this.formatTime(result.elapsedMs)}\n` +
      `大米：${this.riceSystem.rice.completed ? '已完成' : '未完成'}\n` +
      `按 R 重新开始`,
    ).setVisible(true);
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
    const hint = rice.completed ? '已吃完'
      : this.sprint.state !== 'NORMAL' ? '冲刺或眩晕中无法进食'
      : inRange ? '按住 E 进食，移动可中断' : '靠近大米后按住 E';
    this.riceLabel.setText(
      `大米进度：${(rice.progressMs / 1000).toFixed(1)} / ${(rice.maxProgressMs / 1000).toFixed(1)} 秒\n` +
      `状态：${states[rice.interactionState]}\n${hint}`,
    );
  }

  private createSolidTexture(key: string, color: number, size = 1): void {
    if (this.textures.exists(key)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private togglePause(): void {
    if (this.match.pause()) {
      this.pauseLabel.setVisible(true);
      this.riceSystem.interrupt();
      this.updateRiceLabel(false);
      this.player.setVelocity(0, 0);
      this.human.setVelocity(0, 0);
      this.physics.world.pause();
    } else if (this.match.resume()) {
      this.pauseLabel.setVisible(false);
      this.physics.world.resume();
    }
    this.updateStatusLabel();
  }

  private handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.togglePause();
    } else if (event.key.toLowerCase() === 'r' && this.match.phase === 'FINISHED') {
      event.preventDefault();
      this.scene.restart();
    }
  };
}
