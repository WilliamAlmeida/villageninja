/** Fases puramente visuais: não alteram duração de proteção, prisão ou dano. */
export function wallView(dx: number, dy: number): 'front' | 'oblique' | 'profile' {
  const x = Math.abs(dx), y = Math.abs(dy);
  if (y <= x * 0.25) return 'front';
  return x < y * 0.8 ? 'profile' : 'oblique';
}

export function wallUsesProfile(dx: number, dy: number) {
  return wallView(dx, dy) === 'profile';
}

export function wallFrame(age: number, remaining: number) {
  if (remaining < 0.45) return Math.min(7, 5 + Math.floor(Math.max(0, 0.45 - remaining) / 0.15));
  if (age < 0.25) return Math.min(2, Math.floor(Math.max(0, age) / (0.25 / 3)));
  return remaining < 0.65 ? 4 : 3;
}

export function sandCoffinFrame(remaining: number, duration: number) {
  const age = Math.max(0, duration - remaining);
  if (remaining <= 0.3) return remaining > 0.15 ? 6 : 7;
  if (remaining <= 0.65) return remaining > 0.475 ? 4 : 5;
  if (age < 0.45) return Math.min(2, Math.floor(age / 0.15));
  return 3;
}

export function jukaiFrame(remaining: number, duration: number) {
  const age = Math.max(0, duration - remaining);
  if (remaining <= .45) return Math.min(7, 5 + Math.floor(Math.max(0, .45 - remaining) / .15));
  if (age < .45) return Math.min(2, Math.floor(age / .15));
  return age < .8 ? 3 : 4;
}
