// Логика прокрутки карты: карта двигается только после достижения порогов.
// Если игрок внутри безопасной зоны, он двигается сам; иначе карта начинает уезжать под него.
//
// Важная идея:
// - playerX — координата игрока относительно окна;
// - mapScrollX — на сколько пикселей сдвинута карта относительно начала мира;
// - safe zone — центр экрана, где игрок может перемещаться без прокрутки карты;
// - при достижении края safe zone начинаем двигать карту.

export type MapScrollState = {
  scrollX: number;
  mapWidth: number;
  viewWidth: number;
};

export const CAMERA_MARGIN = 240;

export function updateMapScroll(
  mapScrollX: number,
  mapWidth: number,
  viewWidth: number,
  playerX: number,
  playerHalfWidth: number,
  windowWidth: number,
  moveLeft: boolean,
  moveRight: boolean,
  delta: number,
  speed: number,
): number {
  const maxScroll = Math.max(0, mapWidth - viewWidth);

  // Безопасная зона для игрока ограничена отступом от краёв окна.
  // Если игрок подошёл к этой границе, начинаем прокрутку карты.
  const leftBoundary = CAMERA_MARGIN + playerHalfWidth;
  const rightBoundary = windowWidth - CAMERA_MARGIN - playerHalfWidth;

  // Левая граница: если игрок дошёл до левого порога и держит клавишу влево,
  // карта должна уходить вправо, то есть mapScrollX уменьшается.
  if (moveLeft && playerX <= leftBoundary && mapScrollX > 0) {
    return Math.max(0, mapScrollX - speed * (delta / 1000));
  }

  // Правая граница: если игрок дошёл до правого порога и держит клавишу вправо,
  // карта должна уходить влево, то есть mapScrollX увеличивается.
  if (moveRight && playerX >= rightBoundary && mapScrollX < maxScroll) {
    return Math.min(maxScroll, mapScrollX + speed * (delta / 1000));
  }

  return mapScrollX;
}
