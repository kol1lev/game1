export type PlayerMovementInput = {
  left: boolean;
  right: boolean;
};

export function updatePlayerMovement(
  player: Phaser.GameObjects.Rectangle,
  input: PlayerMovementInput,
  delta: number,
  speed: number,
): void {
  let direction = 0;

  if (input.left) direction -= 1;
  if (input.right) direction += 1;

  if (direction === 0) return;

  player.x += direction * speed * (delta / 1000);
}
