// Coreografias do ninja em camadas (só desenho): passos com os quadros das folhas de pose (soco, chute, selos, no ar,
// atingido), a altura do corpo acima do chão (salto: a sombra fica no chão) e um efeito (girar espelhando, rolar).
// Jutsu usa `JutsuDef.moves`; aqui ficam as que não são de jutsu (reações ao dano). Ver docs/taijutsu.md.

export type MovePose = 'strike' | 'kick' | 'cast' | 'air' | 'hurt';
/** `spin`: espelha o lado a cada instante (giro); `roll`: o desenho gira como uma bola (Gatsūga, Nikudan Sensha). */
export type MoveFx = 'spin' | 'roll';
/** Um passo: folha de pose, quadro (0–3), duração (s), altura do corpo acima do chão (px de mundo) e efeito. */
export type JutsuMove = [MovePose, number, number, number?, MoveFx?];

/** Reações ao dano (`playHurt` em combat.ts): leve recua; forte é jogado para trás, cai e levanta; lançado vai ao alto. */
export const MOVE_SEQS: Record<string, JutsuMove[]> = {
  'hurt-light': [['hurt', 0, 0.22]],
  'hurt-down': [['hurt', 1, 0.16, 5], ['hurt', 2, 0.5], ['hurt', 3, 0.3]],
  'hurt-launch': [['hurt', 1, 0.14, 10], ['hurt', 1, 0.22, 22], ['hurt', 1, 0.14, 8], ['hurt', 2, 0.45], ['hurt', 3, 0.3]],
};

/** Duração total de uma coreografia. */
export const movesTime = (seq: JutsuMove[]) => seq.reduce((a, m) => a + m[2], 0);

/** O passo da coreografia em que caem `elapsed` segundos, com a altura interpolada até a do passo seguinte. */
export function moveAt(seq: JutsuMove[], elapsed: number): { pose: MovePose; frame: number; h: number; fx?: MoveFx } {
  let left = Math.max(0, elapsed);
  for (let i = 0; i < seq.length; i++) {
    const [pose, frame, d, h = 0, fx] = seq[i]!;
    if (left < d || i === seq.length - 1) {
      const next = seq[i + 1]?.[3] ?? 0;
      const k = Math.min(1, left / d);
      // sobe e desce suave entre os passos (a altura do passo vale no começo dele)
      return { pose, frame, h: h + (next - h) * k * k, fx };
    }
    left -= d;
  }
  const last = seq[seq.length - 1]!;
  return { pose: last[0], frame: last[1], h: 0, fx: last[4] };
}
