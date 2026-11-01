/** Mulberry32: all model randomness comes from a world-scoped generator. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function coordinateNoise(x: number, y: number, seed: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
export function smoothNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = coordinateNoise(ix, iy, seed), b = coordinateNoise(ix + 1, iy, seed);
  const c = coordinateNoise(ix, iy + 1, seed), d = coordinateNoise(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
