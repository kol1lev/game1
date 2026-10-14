import Phaser from 'phaser';
import musicOne from '../sound/music/one.mp3';
import musicTwo from '../sound/music/two.mp3';
import musicThree from '../sound/music/three.mp3';
import musicFour from '../sound/music/four.mp3';
import musicFive from '../sound/music/five.mp3';
import musicSix from '../sound/music/six.mp3';
import musicSeven from '../sound/music/seven.mp3';
import musicEight from '../sound/music/eight.mp3';
import trainSound1 from '../sound/other/MSTR_NT_Metro_KS01.mp3';
import trainSound2 from '../sound/other/MSTR_NT_Metro_KS02.mp3';
import trainSound3 from '../sound/other/MSTR_NT_Train_TW01.mp3';
import trainSound4 from '../sound/other/MSTR_NT_Train_TW02.mp3';
import step1 from '../sound/steps/CONCRETE_Generic_Step_1.mp3';
import step2 from '../sound/steps/CONCRETE_Generic_Step_2.mp3';
import step3 from '../sound/steps/CONCRETE_Generic_Step_3.mp3';
import step4 from '../sound/steps/CONCRETE_Generic_Step_4.mp3';
import step5 from '../sound/steps/CONCRETE_Generic_Step_5.mp3';
import step6 from '../sound/steps/CONCRETE_Generic_Step_6.mp3';
import step7 from '../sound/steps/CONCRETE_Generic_Step_7.mp3';
import waterDrop from '../sound/other/water_drop_synthetic.mp3';
import monsterSound from '../sound/other/Monster_SoftGrowl2.mp3';

const MUSIC_TRACKS = [musicOne, musicTwo, musicThree, musicFour, musicFive, musicSix, musicSeven, musicEight];
const MUSIC_VOLUME = 0.8;
const TRAIN_SOUNDS = [trainSound1, trainSound2, trainSound3, trainSound4];
const TRAIN_VOLUME = 0.3;
const STEP_SOUNDS = [step1, step2, step3, step4, step5, step6, step7];
const STEP_VOLUME = 0.6;
const MONSTER_VOLUME = 1;
const MONSTER_KEY = 'moster';
const NPC_STEP_MAX_VOLUME = 0.6;
const NPC_STEP_MIN_VOLUME = 0.03;
const NPC_STEP_AUDIBLE_WIDTH = 1.2;
const WATER_DROP_KEY = 'water-drop';
const WATER_DROP_VOLUME = 0.06;
const WATER_DROP_INTERVAL_MS = 1000;
const WATER_DROP_START_DELAY_MS = 600;

// Единственный менеджер всего звука в игре: музыка по кругу и зацикленный стук колёс.
// Звуки живут в глобальном менеджере Phaser и в статическом экземпляре этого класса,
// поэтому не прерываются при перезапуске сцены (смена вагона, рестарт после поражения).
export class BackgroundMusic {
  private static instance?: BackgroundMusic;

  private musicTrack?: Phaser.Sound.BaseSound;
  private train?: Phaser.Sound.BaseSound;
  private monster?: Phaser.Sound.BaseSound;
  private trackIndex = 0;
  private trainSoundindex = 1;
  private stepIndex = 0;
  private waterDropTimer?: Phaser.Time.TimerEvent;

  private constructor() {}

  public static getInstance(): BackgroundMusic {
    if (!BackgroundMusic.instance) {
      BackgroundMusic.instance = new BackgroundMusic();
    }

    return BackgroundMusic.instance;
  }

  // Загружает аудио. Повторные вызовы игнорируются: кэш Phaser переживает перезапуск сцены.
  public preload(scene: Phaser.Scene): void {
    // Критичные звуки, нужные сразу: первый трек, первый звук поезда, шаги, капли, рык.
    this.loadCritical(scene);
  }

  // Критичные для старта звуки: без них игрок услышит тишину в первые секунды.
  private loadCritical(scene: Phaser.Scene): void {
    const critical: Array<[string, string]> = [
      [this.getMusicKey(0), MUSIC_TRACKS[0]],
      [this.getTrainKey(0), TRAIN_SOUNDS[0]],
      ...STEP_SOUNDS.map((url, index) => [this.getStepKey(index), url] as [string, string]),
      [WATER_DROP_KEY, waterDrop],
      [MONSTER_KEY, monsterSound],
    ];

    critical.forEach(([key, url]) => scene.load.audio(key, url));
  }

  // Полный набор аудио: ключ -> url. Нужен, чтобы докачивать только недостающее.
  private collectAudioAssets(): Array<[string, string]> {
    const remainingMusic = MUSIC_TRACKS
      .slice(1)
      .map((url, index) => [this.getMusicKey(index + 1), url] as [string, string]);
    const remainingTrain = TRAIN_SOUNDS
      .slice(1)
      .map((url, index) => [this.getTrainKey(index + 1), url] as [string, string]);

    return [
      // Остальные звуки поезда — приоритетнее, они играют постоянно.
      ...remainingTrain,
      // Остальные музыкальные треки — следующие по приоритету.
      ...remainingMusic,
    ];
  }

  // Качает аудио в фоне, не задерживая первый кадр. Дозагружает только то, чего нет в кэше.
  public preloadDeferred(scene: Phaser.Scene): void {
    // shutdown сцены сбрасывает загрузчик, поэтому занят ли он — спрашиваем у него самого.
    if (scene.load.isLoading()) {
      return;
    }

    const missing = this.collectAudioAssets().filter(([key]) => !scene.cache.audio.has(key));
    if (missing.length === 0) {
      return;
    }

    missing.forEach(([key, url]) => scene.load.audio(key, url));
    scene.load.start();
  }
  

  // Включает музыку и звук поезда; уже играющие звуки не перезапускаются.
  public start(scene: Phaser.Scene): void {
    this.startMusic(scene);
    this.startTrain(scene);
    this.startWaterDrop(scene);
  }

  public startMusic(scene: Phaser.Scene): void {
    if (this.musicTrack?.isPlaying) {
      return;
    }

    this.playTrack(scene);
  }

  public startTrain(scene: Phaser.Scene): void {
    if (this.train?.isPlaying) {
      return;
    }

    this.playTrain(scene);
  }

  public stopMusic(): void {
    this.stopSound(this.musicTrack);
    this.musicTrack = undefined;
  }

  public stopTrain(): void {
    this.stopSound(this.train);
    this.train = undefined;
  }

  public stopAll(): void {
    this.stopMusic();
    this.stopTrain();
    this.stopWaterDrop();
    this.stopMonster()
  }

  // Короткий одиночный звук: вариант шага чередуется по кругу, чтобы шаги не звучали одинаково.
  public playStep(scene: Phaser.Scene): void {
    this.stepIndex = (this.stepIndex + 1) % STEP_SOUNDS.length;
    scene.sound.play(this.getStepKey(this.stepIndex), { volume: STEP_VOLUME });
  }

  // Шаг NPC: чем ближе к игроку, тем громче. Дальше NPC_STEP_AUDIBLE_WIDTH * ширины экрана — не слышно.
  public playNpcStep(scene: Phaser.Scene, distance: number): void {
    const maxDistance = scene.scale.width * NPC_STEP_AUDIBLE_WIDTH;
    if (distance >= maxDistance) {
      return;
    }

    // Линейное затухание: 1 когда NPC вплотную, 0 на границе слышимости.
    const falloff = 1 - distance / maxDistance;
    const volume = NPC_STEP_MIN_VOLUME + (NPC_STEP_MAX_VOLUME - NPC_STEP_MIN_VOLUME) * falloff;
    this.stepIndex = (this.stepIndex + 1) % STEP_SOUNDS.length;
    scene.sound.play(this.getStepKey(this.stepIndex), { volume });
  }

  // Капает вода в текущем вагоне: первая капля через WATER_DROP_START_DELAY_MS после старта вагона,
  // дальше — каждые WATER_DROP_INTERVAL_MS.
  private startWaterDrop(scene: Phaser.Scene): void {
    // start() вызывается в create() каждого нового вагона, поэтому таймер предыдущего вагона
    // убираем явно и запускаем отсчёт заново.
    this.stopWaterDrop();

    this.waterDropTimer = scene.time.addEvent({
      delay: WATER_DROP_INTERVAL_MS,
      // Отсчёт начинаем не с нуля, а с середины интервала, чтобы первая капля прозвучала раньше.
      startAt: WATER_DROP_INTERVAL_MS - WATER_DROP_START_DELAY_MS,
      loop: true,
      callback: () => scene.sound.play(WATER_DROP_KEY, { volume: WATER_DROP_VOLUME }),
    });
  }

  public stopWaterDrop(): void {
    // Убирать звук из менеджера не нужно: scene.sound.play создаёт временный экземпляр
    // и сам удаляет его после окончания воспроизведения.
    this.waterDropTimer?.remove();
    this.waterDropTimer = undefined;
  }

    // Рык монстра при поражении: одиночный звук, не зацикливается.
  public playMonster(scene: Phaser.Scene): void {
    this.stopMonster();

    const monster = scene.sound.add(MONSTER_KEY, {
      volume: MONSTER_VOLUME,
    });
    this.monster = monster;

    monster.once(Phaser.Sound.Events.COMPLETE, () => {
      scene.sound.remove(monster);
      this.monster = undefined;
    });

    monster.play();
  }

  public stopMonster(): void {
    if (!this.monster) {
      return;
    }

    this.monster.removeAllListeners(Phaser.Sound.Events.COMPLETE);
    this.monster.stop();
    this.monster = undefined;
  }

  private playTrack(scene: Phaser.Scene): void {
    const nextKey = this.getMusicKey(this.trackIndex);

    // Если следующий трек ещё не загружен, ждём 500 мс и пробуем снова.
    // Это защита от тишины, когда фоновая загрузка не успевает.
    if (!scene.cache.audio.has(nextKey)) {
      scene.time.delayedCall(500, () => this.playTrack(scene));
      return;
    }

    const track = scene.sound.add(nextKey, {
      volume: MUSIC_VOLUME,
      loop: false,
    });
    this.musicTrack = track;

    // По окончании трека убираем его из менеджера и включаем следующий по кругу.
    track.once(Phaser.Sound.Events.COMPLETE, () => {
      scene.sound.remove(track);
      this.trackIndex = (this.trackIndex + 1) % MUSIC_TRACKS.length;
      this.playTrack(scene);
    });

    track.play();
  }
  

  private playTrain(scene: Phaser.Scene): void {
    const nextKey = this.getTrainKey(this.trainSoundindex);

    // Если следующий звук поезда ещё не загружен, ждём 500 мс и пробуем снова.
    if (!scene.cache.audio.has(nextKey)) {
      scene.time.delayedCall(500, () => this.playTrain(scene));
      return;
    }

    const ctrain = scene.sound.add(nextKey, {
        volume: this.trainSoundindex > 0 ? TRAIN_VOLUME * 0.08 : TRAIN_VOLUME * 0.03,
        loop: false,
    });
    this.train = ctrain;

    ctrain.once(Phaser.Sound.Events.COMPLETE, () => {
        scene.sound.remove(ctrain);
        this.trainSoundindex = (this.trainSoundindex + 1) % TRAIN_SOUNDS.length;
        this.playTrain(scene);
    });
    
    ctrain.play();
  }

  private stopSound(sound?: Phaser.Sound.BaseSound): void {
    if (!sound) {
      return;
    }

    // Отписываемся до остановки, чтобы событийный обработчик не запустил следующий трек.
    sound.removeAllListeners(Phaser.Sound.Events.COMPLETE);
    sound.stop();
  }

  private getMusicKey(index: number): string {
    return `music-${index}`;
  }

  private getTrainKey(index: number): string {
    return `train-${index}`;
  }

  private getStepKey(index: number): string {
    return `step-${index}`;
  }

  public handleDefeat(): void {
    this.stopTrain();
    this.stopWaterDrop();
    this.advanceTrainIndex();
  }

  public handleVictory(): void {
    this.stopMusic();
    this.stopTrain();
    this.stopWaterDrop();
    this.trackIndex = (this.trackIndex + 1) % MUSIC_TRACKS.length;
    this.advanceTrainIndex();
  }

  private advanceTrainIndex(): void {
    this.trainSoundindex = (this.trainSoundindex + 1) % TRAIN_SOUNDS.length;
  }

}
