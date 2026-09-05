// Deterministic PRNG so demo data is stable across reloads/server restarts.
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number) {
  const rand = mulberry32(seed);
  return {
    next: () => rand(),
    range: (min: number, max: number) => min + rand() * (max - min),
    int: (min: number, max: number) => Math.floor(min + rand() * (max - min + 1)),
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(rand() * arr.length)];
    },
    chance: (p: number) => rand() < p,
    gaussian: (mean: number, stdDev: number) => {
      const u1 = Math.max(rand(), 1e-9);
      const u2 = rand();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z0 * stdDev;
    },
  };
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}
