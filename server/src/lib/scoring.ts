export function getPointsForPosition(position: number): number {
  if (position === 1) return 10;
  if (position === 2) return 6;
  if (position === 3) return 4;
  return 1;
}
