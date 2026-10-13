import Phaser from 'phaser';
import npcIdleTexture from '../pics/npc/_side idle.png';
import npcWalkTexture from '../pics/npc/_side walk.png';
import goodnightTexture from '../pics/other/goodnight.png';
import { BackgroundMusic } from './BackgroundMusic';

const NPC_FRAME_SIZE = 64;
const NPC_SCALE = 12;
const NPC_DISPLAY_SIZE = NPC_FRAME_SIZE * NPC_SCALE;
const NPC_IDLE_ANIMATION = 'npc-idle';
const NPC_WALK_ANIMATION = 'npc-walk';
const GOODNIGHT_TEXTURE_KEY = 'npc-goodnight';
const GREETING_DURATION_MS = 3000;
// Шаг звучит каждые столько пикселей пройденного пути: быстрее идёт — чаще шаги.
const NPC_STEP_DISTANCE_PX = 45;

export class Npc {
  private sprite: Phaser.GameObjects.Sprite;
  private interactionText: Phaser.GameObjects.Text;
  private greetingImage: Phaser.GameObjects.Image;
  private worldX: number;
  private targetWorldX: number;
  private hasGreeted = false;
  private ellipsisActive = false;
  private greetingTimer?: Phaser.Time.TimerEvent;
  private ellipsisTimer?: Phaser.Time.TimerEvent;
  private stepDistance = 0;

  public static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(NPC_IDLE_ANIMATION, npcIdleTexture, {
      frameWidth: NPC_FRAME_SIZE,
      frameHeight: NPC_FRAME_SIZE,
    });
    scene.load.spritesheet(NPC_WALK_ANIMATION, npcWalkTexture, {
      frameWidth: NPC_FRAME_SIZE,
      frameHeight: NPC_FRAME_SIZE,
    });
    scene.load.image(GOODNIGHT_TEXTURE_KEY, goodnightTexture);
  }

  constructor(
    scene: Phaser.Scene,
    mapWidth: number,
    startsAtRight: boolean,
    mapScrollX: number,
    y: number,
    private readonly speed: number,
    travelRatio: number,
    greetingTextureKey = GOODNIGHT_TEXTURE_KEY,
    private readonly loseOnSecondInteraction = false,
  ) {
    const idleTexture = scene.textures.get(NPC_IDLE_ANIMATION);
    const walkTexture = scene.textures.get(NPC_WALK_ANIMATION);
    idleTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    walkTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    if (!scene.anims.exists(NPC_IDLE_ANIMATION)) {
      scene.anims.create({
        key: NPC_IDLE_ANIMATION,
        frames: scene.anims.generateFrameNumbers(NPC_IDLE_ANIMATION, { start: 0, end: 4 }),
        frameRate: 2,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(NPC_WALK_ANIMATION)) {
      scene.anims.create({
        key: NPC_WALK_ANIMATION,
        frames: scene.anims.generateFrameNumbers(NPC_WALK_ANIMATION, { start: 0, end: 5 }),
        frameRate: this.speed / 20,
        repeat: -1,
      });
    }

    this.worldX = startsAtRight ? mapWidth - NPC_DISPLAY_SIZE / 2 : NPC_DISPLAY_SIZE / 2;
    this.targetWorldX = mapWidth * (startsAtRight ? 1 - travelRatio : travelRatio);
    this.sprite = scene.add.sprite(this.worldX - mapScrollX, y, NPC_IDLE_ANIMATION);
    this.sprite.setScale(NPC_SCALE);
    this.sprite.setDepth(2);
    this.sprite.flipX = !startsAtRight;
    this.sprite.anims.play(NPC_WALK_ANIMATION);

    this.interactionText = scene.add.text(0, 0, 'E чтобы говорить', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
    });
    this.interactionText.setOrigin(0.5, 1);
    this.interactionText.setDepth(4);
    this.interactionText.setVisible(false);

    scene.textures.get(greetingTextureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.greetingImage = scene.add.image(0, 0, greetingTextureKey);
    this.greetingImage.setDisplaySize(300, 96);
    this.greetingImage.setOrigin(0.5, 1);
    this.greetingImage.setDepth(4);
    this.greetingImage.setVisible(false);
  }

  public update(
    delta: number,
    mapScrollX: number,
    playerX: number,
    playerWidth: number,
    interactPressed: boolean,
  ): boolean {
    const distanceToTarget = this.targetWorldX - this.worldX;
    const step = this.speed * (delta / 1000);

    if (Math.abs(distanceToTarget) <= step) {
      this.worldX = this.targetWorldX;
      this.stepDistance = 0;
      this.sprite.anims.play(NPC_IDLE_ANIMATION, true);
    } else {
      this.worldX += Math.sign(distanceToTarget) * step;
      this.sprite.flipX = distanceToTarget > 0;
      this.sprite.anims.play(NPC_WALK_ANIMATION, true);

      // Шаг через каждые NPC_STEP_DISTANCE_PX пройденного пути; громкость падает с расстоянием до игрока.
      this.stepDistance += step;
      if (this.stepDistance >= NPC_STEP_DISTANCE_PX) {
        this.stepDistance = 0;
        const npcScreenX = this.worldX - mapScrollX;
        BackgroundMusic.getInstance().playNpcStep(this.sprite.scene, Math.abs(npcScreenX - playerX));
      }
    }

    this.sprite.x = this.worldX - mapScrollX;
    if (this.greetingImage.visible) {
      this.greetingImage.setPosition(this.sprite.x, this.getSpeechY());
    }

    const playerIsClose = this.isCloseTo(playerX, playerWidth);
    // Первое приветствие и повторяемые многоточия — отдельные состояния взаимодействия с таймерами.
    const canInteract = this.loseOnSecondInteraction || !this.greetingImage.visible;
    let secondInteractionCausesLose = false;
    if (playerIsClose && interactPressed && canInteract && !this.ellipsisActive) {
      if (!this.hasGreeted) {
        this.hasGreeted = true;
        this.greetingImage.setPosition(this.sprite.x, this.getSpeechY());
        this.greetingImage.setVisible(true);
        this.greetingTimer = this.sprite.scene.time.delayedCall(GREETING_DURATION_MS, () => {
          this.greetingImage.setVisible(false);
        });
      } else if (this.loseOnSecondInteraction) {
        secondInteractionCausesLose = true;
      } else {
        this.ellipsisActive = true;
        this.ellipsisTimer = this.sprite.scene.time.delayedCall(GREETING_DURATION_MS, () => {
          this.ellipsisActive = false;
        });
      }
    }

    const text = this.ellipsisActive ? '...' : 'E чтобы говорить';
    this.interactionText.setText(text);
    this.interactionText.setPosition(this.sprite.x, this.getSpeechY());
    this.interactionText.setVisible(this.ellipsisActive || (playerIsClose && !this.hasGreeted && !this.greetingImage.visible));
    return secondInteractionCausesLose;
  }

  private getSpeechY(): number {
    return this.sprite.y - this.sprite.displayHeight / 4;
  }

  public isCloseTo(screenX: number, otherWidth: number): boolean {
    const contactDistance = (this.sprite.displayWidth + otherWidth) / 4;
    return Math.abs(this.sprite.x - screenX) <= contactDistance;
  }

  public getScreenPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  public hide(): void {
    this.sprite.setVisible(false);
    this.interactionText.setVisible(false);
    this.greetingImage.setVisible(false);
    this.greetingTimer?.remove();
    this.ellipsisTimer?.remove();
  }
}